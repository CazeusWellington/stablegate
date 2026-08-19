import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/client'
import { RaceService } from '../../services/raceService'
import { io } from '../../index'

export async function raceRoutes(app: FastifyInstance) {

  // GET /races — race board (open + scheduled + recent)
  app.get('/', async (req: any, reply) => {
    const { tier, status } = req.query as any

    const races = await prisma.race.findMany({
      where: {
        ...(tier ? { tier } : {}),
        ...(status ? { status } : { status: { in: ['OPEN', 'FILLING', 'AUCTION', 'LOCKED', 'COMPLETED'] } }),
      },
      orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      include: {
        entries: {
          where: { isGhostEntry: false },
          include: { horse: { select: { name: true, speedFigure: true, runningStyle: true, traitsDiscovered: true } } }
        }
      }
    })

    return reply.send({ races })
  })

  // GET /races/:id — single race detail
  app.get('/:id', async (req: any, reply) => {
    const race = await prisma.race.findUnique({
      where: { id: req.params.id },
      include: {
        entries: {
          include: {
            horse: true,
            jockey: true,
            user: { select: { username: true } }
          }
        },
        bids: {
          where: { status: 'PENDING' },
          select: { jockeyId: true, userId: true } // hide bid amounts
        }
      }
    })
    if (!race) return reply.code(404).send({ error: 'Race not found' })
    return reply.send({ race })
  })

  // POST /races/:id/enter — enter a horse in a race
  app.post('/:id/enter', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const schema = z.object({ horseId: z.string() })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { horseId } = body.data
    const result = await RaceService.enterRace({
      raceId: req.params.id,
      horseId,
      userId: req.user.userId,
    })

    // Broadcast updated fill count
    io.to(`race:${req.params.id}`).emit('race:fill_update', {
      raceId: req.params.id,
      entryCount: result.entryCount,
      maxField: result.maxField,
    })

    return reply.code(201).send(result)
  })

  // POST /races/:id/bid — sealed jockey auction bid
  app.post('/:id/bid', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const schema = z.object({
      jockeyId: z.string(),
      bidPct: z.number().min(0).max(50),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const race = await prisma.race.findUnique({ where: { id: req.params.id } })
    if (!race) return reply.code(404).send({ error: 'Race not found' })
    if (race.status !== 'AUCTION') return reply.code(400).send({ error: 'Auction is not open' })
    if (race.auctionClosesAt && new Date() > race.auctionClosesAt) {
      return reply.code(400).send({ error: 'Auction has closed' })
    }

    const jockey = await prisma.jockey.findUnique({ where: { id: body.data.jockeyId } })
    if (!jockey) return reply.code(404).send({ error: 'Jockey not found' })
    if (body.data.bidPct < jockey.minimumPct) {
      return reply.code(400).send({ error: `Bid must be at least ${jockey.minimumPct * 100}%` })
    }

    // Check jockey not already assigned in this race
    const assignedEntry = await prisma.raceEntry.findFirst({
      where: { raceId: req.params.id, jockeyId: body.data.jockeyId }
    })
    if (assignedEntry) return reply.code(409).send({ error: 'Jockey already assigned in this race' })

    const bid = await prisma.jockeyBid.upsert({
      where: {
        raceId_jockeyId_userId: {
          raceId: req.params.id,
          jockeyId: body.data.jockeyId,
          userId: req.user.userId,
        }
      },
      create: {
        raceId: req.params.id,
        jockeyId: body.data.jockeyId,
        userId: req.user.userId,
        bidPct: body.data.bidPct,
      },
      update: { bidPct: body.data.bidPct }
    })

    return reply.code(201).send({ bid, message: 'Bid sealed' })
  })

  // POST /races/:id/pick-jockey — open pick (no auction required)
  app.post('/:id/pick-jockey', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const schema = z.object({ jockeyId: z.string(), horseId: z.string() })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const result = await RaceService.assignOpenPickJockey({
      raceId: req.params.id,
      jockeyId: body.data.jockeyId,
      horseId: body.data.horseId,
      userId: req.user.userId,
    })

    return reply.send(result)
  })

  // GET /races/:id/payouts — payout table estimate
  app.get('/:id/payouts', async (req: any, reply) => {
    const race = await prisma.race.findUnique({
      where: { id: req.params.id },
      include: { entries: { where: { isGhostEntry: false } } }
    })
    if (!race) return reply.code(404).send({ error: 'Race not found' })

    const entryCount = race.entries.length
    const gross = Number(race.entryFee) * entryCount
    const rake = gross * race.houseRakePct
    const net = gross - rake
    const jockeyAmt = net * race.jockeyPct
    const ownerPool = net - jockeyAmt

    const SPLITS = [0.42, 0.24, 0.14, 0.09, 0.06, 0.03, 0.02]
    const activeSplits = SPLITS.slice(0, Math.min(entryCount, 7))
    const total = activeSplits.reduce((a, b) => a + b, 0)

    const payouts = activeSplits.map((s, i) => ({
      position: i + 1,
      payout: Math.round(ownerPool * (s / total) * 100) / 100,
      profitVsEntry: Math.round((ownerPool * (s / total) - Number(race.entryFee)) * 100) / 100,
    }))

    return reply.send({
      gross, rake, net, jockeyAmt, ownerPool,
      houseTotal: rake + jockeyAmt,
      payouts,
      entryCount,
      maxField: race.fieldSize,
    })
  })
}
