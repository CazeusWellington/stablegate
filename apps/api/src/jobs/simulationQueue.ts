import { Queue, Worker } from 'bullmq'
import { redis } from '../db/redis'
import { prisma } from '../db/client'
import { RaceService } from '../services/raceService'
import axios from 'axios'

const SIMULATION_URL = process.env.SIMULATION_SERVICE_URL || 'http://localhost:8001'

export const simulationQueue = new Queue('simulation', {
  connection: redis,
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200 }
})

export function initSimulationWorker() {
  const worker = new Worker('simulation', async (job) => {
    const { name, data } = job

    if (name === 'resolve-auction') {
      await RaceService.resolveAuction(data.raceId)
      return
    }

    if (name === 'run-simulation') {
      await runRaceSimulation(data.raceId)
      return
    }

    if (name === 'expire-race') {
      await expireRace(data.raceId)
      return
    }

    if (name === 'jockey-season-review') {
      await reviewJockeySeasons()
      return
    }
  }, {
    connection: redis,
    concurrency: 5,
  })

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err)
  })

  return worker
}

async function runRaceSimulation(raceId: string) {
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: {
      entries: {
        include: { horse: true, jockey: true }
      }
    }
  })
  if (!race) throw new Error(`Race ${raceId} not found`)

  // Build simulation payload
  const payload = {
    race_id: raceId,
    surface: race.surface,
    distance: race.distance,
    entries: race.entries.map(e => ({
      entry_id: e.id,
      horse: {
        speed_figure: e.horse.speedFigure,
        running_style: e.horse.runningStyle,
        favored_distance: e.horse.favoredDistance,
        surface_preference: e.horse.surfacePreference,
        stamina_rating: e.horse.staminaRating,
        consistency_score: e.horse.consistencyScore,
        total_races: e.horse.totalRaces,
      },
      jockey: e.jockey ? {
        running_style: e.jockey.runningStyle,
        win_rate: e.jockey.winRate,
        surface_win_rate: race.surface === 'DIRT' ? e.jockey.dirtWinRate
          : race.surface === 'TURF' ? e.jockey.turfWinRate
          : e.jockey.syntheticWinRate,
        distance_win_rate: race.distance === 'SPRINT' ? e.jockey.sprintWinRate : e.jockey.routeWinRate,
        base_modifier: e.jockey.baseModifier,
      } : null,
      is_ghost: e.isGhostEntry,
    }))
  }

  // Store inputs for audit
  await prisma.race.update({
    where: { id: raceId },
    data: { status: 'SIMULATING', simulationInputs: payload }
  })

  // Call Python simulation service
  const response = await axios.post(`${SIMULATION_URL}/simulate`, payload, { timeout: 10000 })
  const simResults = response.data.results

  // Store outputs for audit
  await prisma.race.update({
    where: { id: raceId },
    data: { simulationOutputs: simResults }
  })

  // Process trait discovery for each horse entry
  for (const entry of race.entries) {
    if (entry.isGhostEntry) continue

    const jockeyStyle = entry.jockey?.runningStyle ?? null
    const { bonusRaces, reason } = require('../services/traitDiscovery').TraitDiscoveryService.calculateBonus(
      entry.horse, jockeyStyle, race.surface, race.distance
    )

    const effectiveRaceCount = entry.horse.totalRaces + 1 - bonusRaces
    const revealed = await require('../services/traitDiscovery').TraitDiscoveryService.checkAndReveal(
      entry.horse, effectiveRaceCount
    )

    if (revealed.length > 0) {
      await prisma.horse.update({
        where: { id: entry.horseId },
        data: { traitsDiscovered: { increment: revealed.length } }
      })
      for (const trait of revealed) {
        await prisma.traitDiscoveryEvent.create({
          data: {
            horseId: entry.horseId,
            raceEntryId: entry.id,
            traitName: trait.traitName,
            traitValue: String(trait.value),
            discoveredVia: bonusRaces > 0 ? 'BONUS_INTERVAL' : 'RACE_INTERVAL',
            racesAtUnlock: entry.horse.totalRaces + 1,
            bonusApplied: bonusRaces > 0,
            bonusReason: reason.join(', '),
          }
        })
      }
    }

    // Update jockey stats
    if (entry.jockey) {
      const simResult = simResults.find((r: any) => r.entry_id === entry.id)
      if (simResult) {
        const jockeyWon = simResult.position === 1
        const jockeyTop3 = simResult.position <= 3
        await prisma.jockey.update({
          where: { id: entry.jockey.id },
          data: {
            careerRaces: { increment: 1 },
            careerWins: jockeyWon ? { increment: 1 } : undefined,
          }
        })
        // Recalculate win rate
        const jockey = await prisma.jockey.findUnique({ where: { id: entry.jockey.id } })
        if (jockey) {
          await prisma.jockey.update({
            where: { id: entry.jockey.id },
            data: { winRate: jockey.careerWins / jockey.careerRaces }
          })
        }
      }
    }
  }

  // Distribute payouts
  await RaceService.distributePayouts(raceId, simResults.map((r: any) => ({
    entryId: r.entry_id,
    position: r.position,
    finishTime: r.finish_time,
    finalScore: r.final_score,
  })))
}

async function expireRace(raceId: string) {
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: { entries: true }
  })
  if (!race || race.status === 'COMPLETED') return

  // Refund all entry fees
  for (const entry of race.entries) {
    if (entry.isGhostEntry || entry.entryFeeRefunded) continue
    const fee = Number(entry.entryFeePaid)
    if (fee > 0) {
      await prisma.user.update({
        where: { id: entry.userId },
        data: { walletBalance: { increment: fee } }
      })
      await prisma.raceEntry.update({
        where: { id: entry.id },
        data: { entryFeeRefunded: true }
      })
    }
  }

  await prisma.race.update({
    where: { id: raceId },
    data: { status: 'CANCELLED' }
  })
}

async function reviewJockeySeasons() {
  const SEASON_RACES = 50
  const jockeys = await prisma.jockey.findMany({ where: { isActive: true } })

  for (const jockey of jockeys) {
    if (jockey.careerRaces < SEASON_RACES) continue

    const seasonNumber = Math.floor(jockey.careerRaces / SEASON_RACES)
    const existingSeason = await prisma.jockeySeasonRecord.findUnique({
      where: { jockeyId_seasonNumber: { jockeyId: jockey.id, seasonNumber } }
    })
    if (existingSeason) continue

    // Determine promotion/relegation
    let wasPromoted = false
    let wasRelegated = false
    let newTier = jockey.tier

    const wr = jockey.winRate

    if (jockey.tier === 'ROOKIE' && wr >= 0.05) {
      newTier = 'BUDGET'; wasPromoted = true
    } else if (jockey.tier === 'BUDGET') {
      if (wr >= 0.08) { newTier = 'MID'; wasPromoted = true }
      else if (wr < 0.04) { /* stays BUDGET — floor tier */ }
    } else if (jockey.tier === 'MID') {
      if (wr >= 0.14) { newTier = 'TOP'; wasPromoted = true }
      else if (wr < 0.08) { newTier = 'BUDGET'; wasRelegated = true }
    } else if (jockey.tier === 'TOP') {
      if (wr >= 0.22) { newTier = 'ELITE'; wasPromoted = true }
      else if (wr < 0.15) { newTier = 'MID'; wasRelegated = true }
    }

    await prisma.$transaction([
      prisma.jockeySeasonRecord.create({
        data: {
          jockeyId: jockey.id,
          seasonNumber,
          races: SEASON_RACES,
          wins: Math.round(jockey.careerWins),
          winRate: jockey.winRate,
          tierAtStart: jockey.tier,
          tierAtEnd: newTier,
          wasPromoted,
          wasRelegated,
        }
      }),
      prisma.jockey.update({
        where: { id: jockey.id },
        data: {
          tier: newTier,
          baseModifier: getTierBaseModifier(newTier, jockey.winRate),
          minimumPct: getTierMinPct(newTier),
        }
      })
    ])
  }
}

function getTierBaseModifier(tier: string, winRate: number): number {
  const base = { ELITE: 1.16, TOP: 1.08, MID: 1.03, BUDGET: 0.97, ROOKIE: 0.91 }
  return (base[tier as keyof typeof base] ?? 1.0) + (winRate * 0.2)
}

function getTierMinPct(tier: string): number {
  return { ELITE: 0.11, TOP: 0.08, MID: 0.055, BUDGET: 0.035, ROOKIE: 0.025 }[tier as string] ?? 0.05
}
