import { prisma } from '../db/client'
import { Race, RaceEntry, Jockey } from '@prisma/client'
import { simulationQueue } from '../jobs/simulationQueue'
import { io } from '../index'

const PAYOUT_SPLITS = [0.42, 0.24, 0.14, 0.09, 0.06, 0.03, 0.02]

interface EnterRaceParams {
  raceId: string
  horseId: string
  userId: string
}

interface AssignJockeyParams {
  raceId: string
  jockeyId: string
  horseId: string
  userId: string
}

export class RaceService {

  static async enterRace({ raceId, horseId, userId }: EnterRaceParams) {
    const race = await prisma.race.findUnique({
      where: { id: raceId },
      include: { entries: true }
    })
    if (!race) throw new Error('Race not found')
    if (!['OPEN', 'FILLING'].includes(race.status)) {
      throw new Error('Race is not open for entries')
    }

    const realEntries = race.entries.filter(e => !e.isGhostEntry)
    if (realEntries.length >= race.fieldSize) throw new Error('Race is full')

    // Verify horse ownership and eligibility
    const horse = await prisma.horse.findFirst({
      where: { id: horseId, ownerId: userId, status: 'ACTIVE' }
    })
    if (!horse) throw new Error('Horse not found or not eligible')

    // Check tier restrictions
    if (race.tier === 'SILVER' && horse.wins < 1) {
      throw new Error('Silver races require at least 1 paid race win')
    }
    if (race.tier === 'GOLD' && horse.wins < 3) {
      throw new Error('Gold races require at least 3 wins')
    }
    if (race.tier === 'CLASSIC') {
      throw new Error('Classic races are invite only')
    }

    // Check free race daily limits
    if (race.tier === 'FREE') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const freeToday = await prisma.raceEntry.count({
        where: {
          horseId,
          createdAt: { gte: today },
          race: { tier: 'FREE' }
        }
      })
      if (freeToday >= 3) {
        throw new Error('Free race limit reached (3 per horse per day)')
      }
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new Error('User not found')

    const entryFee = Number(race.entryFee)
    if (entryFee > 0 && Number(user.walletBalance) < entryFee) {
      throw new Error('Insufficient wallet balance')
    }

    // Create entry and deduct fee
    const entry = await prisma.$transaction(async (tx) => {
      const entry = await tx.raceEntry.create({
        data: {
          raceId,
          horseId,
          userId,
          entryFeePaid: entryFee,
        }
      })

      if (entryFee > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { walletBalance: { decrement: entryFee } }
        })
        await tx.walletTransaction.create({
          data: {
            userId,
            type: 'RACE_ENTRY_FEE',
            amount: -entryFee,
            balanceBefore: Number(user.walletBalance),
            balanceAfter: Number(user.walletBalance) - entryFee,
            description: `Entry fee: ${race.name}`,
            referenceId: raceId,
            referenceType: 'race',
          }
        })
      }

      // Update race status
      const newEntryCount = realEntries.length + 1
      let newStatus = race.status
      if (newEntryCount >= race.minFieldSize && race.status === 'OPEN') {
        newStatus = 'FILLING'
      }
      if (newEntryCount >= race.fieldSize) {
        newStatus = 'AUCTION'
        const auctionWindowMs = race.auctionWindowSecs * 1000
        await tx.race.update({
          where: { id: raceId },
          data: {
            status: newStatus,
            auctionOpensAt: new Date(),
            auctionClosesAt: new Date(Date.now() + auctionWindowMs),
          }
        })
      } else {
        await tx.race.update({
          where: { id: raceId },
          data: { status: newStatus }
        })
      }

      return entry
    })

    const updatedEntryCount = realEntries.length + 1

    // Kick off auction close job if full
    if (updatedEntryCount >= race.fieldSize) {
      await simulationQueue.add('resolve-auction', { raceId }, {
        delay: race.auctionWindowSecs * 1000
      })
    }

    return {
      entry,
      entryCount: updatedEntryCount,
      maxField: race.fieldSize,
    }
  }

  static async assignOpenPickJockey({ raceId, jockeyId, horseId, userId }: AssignJockeyParams) {
    const [race, jockey, entry] = await Promise.all([
      prisma.race.findUnique({ where: { id: raceId } }),
      prisma.jockey.findUnique({ where: { id: jockeyId } }),
      prisma.raceEntry.findFirst({ where: { raceId, horseId, userId } })
    ])

    if (!race) throw new Error('Race not found')
    if (!jockey) throw new Error('Jockey not found')
    if (!entry) throw new Error('Not entered in this race')
    if (!['ELITE', 'TOP'].includes(jockey.tier)) {
      // Elite/Top jockeys only via auction; others can be picked directly
    }

    const alreadyAssigned = await prisma.raceEntry.findFirst({
      where: { raceId, jockeyId }
    })
    if (alreadyAssigned) throw new Error('Jockey already assigned in this race')

    await prisma.raceEntry.update({
      where: { id: entry.id },
      data: {
        jockeyId,
        jockeyPct: jockey.minimumPct,
        jockeyAcquiredVia: 'OPEN_PICK',
      }
    })

    return { message: `${jockey.name} assigned at ${jockey.minimumPct * 100}% minimum rate` }
  }

  // Resolve auction — determine winners, handle tie-breaks
  static async resolveAuction(raceId: string) {
    const race = await prisma.race.findUnique({
      where: { id: raceId },
      include: { bids: { include: { user: true } } }
    })
    if (!race) throw new Error('Race not found')

    // Group bids by jockey
    const bidsByJockey: Record<string, typeof race.bids> = {}
    for (const bid of race.bids) {
      if (!bidsByJockey[bid.jockeyId]) bidsByJockey[bid.jockeyId] = []
      bidsByJockey[bid.jockeyId].push(bid)
    }

    const auctionResults: Array<{ jockeyId: string; winnerId: string; winnerPct: number; tieBreakRoll?: number }> = []

    for (const [jockeyId, bids] of Object.entries(bidsByJockey)) {
      if (bids.length === 0) continue

      // Sort by bid amount descending
      const sorted = [...bids].sort((a, b) => b.bidPct - a.bidPct)
      const topBid = sorted[0].bidPct
      const topBidders = sorted.filter(b => b.bidPct === topBid)

      let winner = topBidders[0]

      if (topBidders.length > 1) {
        // Tie-break 1: auction success rate
        const bySuccessRate = topBidders.sort((a, b) =>
          b.user.auctionSuccessRate - a.user.auctionSuccessRate
        )
        const topRate = bySuccessRate[0].user.auctionSuccessRate
        const rateWinners = bySuccessRate.filter(b => b.user.auctionSuccessRate === topRate)

        if (rateWinners.length > 1) {
          // Tie-break 2: dice roll
          const rolls = rateWinners.map(b => ({ bid: b, roll: Math.floor(Math.random() * 100) + 1 }))
          const maxRoll = Math.max(...rolls.map(r => r.roll))
          const rollWinner = rolls.find(r => r.roll === maxRoll)!

          // Record dice roll result
          await prisma.jockeyBid.update({
            where: { id: rollWinner.bid.id },
            data: { tieBreakRoll: rollWinner.roll, resolvedAt: new Date() }
          })
          winner = rollWinner.bid
          auctionResults.push({ jockeyId, winnerId: winner.userId, winnerPct: topBid, tieBreakRoll: rollWinner.roll })
        } else {
          winner = rateWinners[0]
          auctionResults.push({ jockeyId, winnerId: winner.userId, winnerPct: topBid })
        }
      } else {
        auctionResults.push({ jockeyId, winnerId: winner.userId, winnerPct: topBid })
      }

      // Assign jockey to winner's entry
      await prisma.raceEntry.updateMany({
        where: { raceId, userId: winner.userId, jockeyId: null },
        data: {
          jockeyId,
          jockeyPct: topBid / 100,
          jockeyAcquiredVia: 'AUCTION',
        }
      })

      // Mark all bids resolved
      await prisma.jockeyBid.updateMany({
        where: { raceId, jockeyId },
        data: { status: 'LOST', resolvedAt: new Date() }
      })
      await prisma.jockeyBid.update({
        where: { raceId_jockeyId_userId: { raceId, jockeyId, userId: winner.userId } },
        data: { status: 'WON' }
      })

      // Update auction success rate for winner
      await prisma.user.update({
        where: { id: winner.userId },
        data: {
          auctionWins: { increment: 1 },
          auctionTotal: { increment: 1 },
        }
      })

      // Increment total for losers
      for (const loser of bids.filter(b => b.userId !== winner.userId)) {
        await prisma.user.update({
          where: { id: loser.userId },
          data: { auctionTotal: { increment: 1 } }
        })
      }
    }

    // Recalculate auction success rates
    const affectedUserIds = [...new Set(race.bids.map(b => b.userId))]
    for (const userId of affectedUserIds) {
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (user && user.auctionTotal > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { auctionSuccessRate: user.auctionWins / user.auctionTotal }
        })
      }
    }

    // Transition race to LOCKED → queue simulation
    await prisma.race.update({
      where: { id: raceId },
      data: { status: 'LOCKED' }
    })

    // Notify all clients
    io.to(`race:${raceId}`).emit('race:auction_resolved', { raceId, results: auctionResults })

    // Queue simulation job
    await simulationQueue.add('run-simulation', { raceId }, { delay: 5000 })

    return auctionResults
  }

  // Distribute payouts after simulation completes
  static async distributePayouts(raceId: string, results: Array<{ entryId: string; position: number; finishTime: string; finalScore: number }>) {
    const race = await prisma.race.findUnique({
      where: { id: raceId },
      include: { entries: { where: { isGhostEntry: false }, include: { horse: true, user: true } } }
    })
    if (!race) throw new Error('Race not found')

    const entryCount = race.entries.length
    const gross = Number(race.entryFee) * entryCount
    const rake = gross * race.houseRakePct
    const net = gross - rake
    const jockeyAmt = net * race.jockeyPct
    const ownerPool = net - jockeyAmt

    const activeSplits = PAYOUT_SPLITS.slice(0, Math.min(entryCount, 7))
    const totalSplit = activeSplits.reduce((a, b) => a + b, 0)

    for (const result of results) {
      const entry = race.entries.find(e => e.id === result.entryId)
      if (!entry) continue

      const split = activeSplits[result.position - 1] ?? 0
      const payout = result.position <= 7 ? Math.round(ownerPool * (split / totalSplit) * 100) / 100 : 0
      const jockeyFee = payout > 0 ? Math.round(payout * (entry.jockeyPct ?? race.jockeyPct) * 100) / 100 : 0
      const netPayout = payout - jockeyFee

      await prisma.$transaction(async (tx) => {
        // Update entry with result
        await tx.raceEntry.update({
          where: { id: entry.id },
          data: {
            finishPosition: result.position,
            finishTime: result.finishTime,
            finalScore: result.finalScore,
            payout,
            jockeyFee,
            netPayout,
          }
        })

        // Credit payout to owner wallet
        if (netPayout > 0) {
          await tx.user.update({
            where: { id: entry.userId },
            data: { walletBalance: { increment: netPayout } }
          })
          await tx.walletTransaction.create({
            data: {
              userId: entry.userId,
              type: 'RACE_PAYOUT',
              amount: netPayout,
              balanceBefore: Number(entry.user.walletBalance),
              balanceAfter: Number(entry.user.walletBalance) + netPayout,
              description: `Payout: ${race.name} — ${result.position}${['st','nd','rd'][result.position-1]||'th'} place`,
              referenceId: raceId,
              referenceType: 'race',
            }
          })
        }

        // Update horse career stats
        await tx.horse.update({
          where: { id: entry.horseId },
          data: {
            totalRaces: { increment: 1 },
            paidRaces: race.tier !== 'FREE' ? { increment: 1 } : undefined,
            wins: result.position === 1 ? { increment: 1 } : undefined,
            totalEarnings: { increment: netPayout },
          }
        })

        // Retire horse if career cap reached
        const updatedHorse = await tx.horse.findUnique({ where: { id: entry.horseId } })
        if (updatedHorse && updatedHorse.totalRaces >= 50) {
          await tx.horse.update({
            where: { id: entry.horseId },
            data: { status: 'RETIRED' }
          })
        }
      })
    }

    // Update race final financials
    await prisma.race.update({
      where: { id: raceId },
      data: {
        status: 'COMPLETED',
        actualPurse: gross,
        ownerPool,
        houseRevenue: rake + jockeyAmt,
        completedAt: new Date(),
      }
    })

    // Broadcast results
    io.to(`race:${raceId}`).emit('race:completed', {
      raceId,
      results,
      ownerPool,
    })
  }
}
