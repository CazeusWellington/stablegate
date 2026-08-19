import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/client'
import { simulationQueue } from '../../jobs/simulationQueue'

export async function adminRoutes(app: FastifyInstance) {

  // Admin auth prehandler
  const requireAdmin = async (req: any, reply: any) => {
    await app.authenticate(req, reply)
    if (!req.user?.userId) return reply.code(401).send({ error: 'Unauthorized' })
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!user?.isAdmin) return reply.code(403).send({ error: 'Admin access required' })
  }

  // GET /admin/stats — platform overview
  app.get('/stats', { preHandler: [requireAdmin] }, async (req, reply) => {
    const [
      totalUsers, totalHorses, totalRaces, completedRaces,
      totalPaidIn, totalPaidOut, openRaces
    ] = await Promise.all([
      prisma.user.count(),
      prisma.horse.count(),
      prisma.race.count(),
      prisma.race.count({ where: { status: 'COMPLETED' } }),
      prisma.walletTransaction.aggregate({
        where: { type: { in: ['RACE_ENTRY_FEE', 'TRAINER_UNLOCK', 'BREEDING_FEE', 'TRAINING_SESSION', 'MARKETPLACE_PURCHASE', 'NEW_HORSE_PURCHASE'] } },
        _sum: { amount: true }
      }),
      prisma.walletTransaction.aggregate({
        where: { type: 'RACE_PAYOUT' },
        _sum: { amount: true }
      }),
      prisma.race.count({ where: { status: { in: ['OPEN', 'FILLING', 'AUCTION', 'LOCKED'] } } }),
    ])

    return reply.send({
      totalUsers,
      totalHorses,
      totalRaces,
      completedRaces,
      totalPaidIn: Math.abs(Number(totalPaidIn._sum.amount) || 0),
      totalPaidOut: Number(totalPaidOut._sum.amount) || 0,
      openRaces,
    })
  })

  // POST /admin/races — manually create a race
  app.post('/races', { preHandler: [requireAdmin] }, async (req: any, reply) => {
    const schema = z.object({
      name: z.string(),
      tier: z.enum(['FREE', 'BRONZE', 'SILVER', 'GOLD', 'CLASSIC']),
      surface: z.enum(['DIRT', 'TURF', 'SYNTHETIC']),
      distance: z.enum(['SPRINT', 'MID', 'ROUTE']),
      fieldSize: z.number().min(4).max(14),
      entryFee: z.number().min(0),
      houseRakePct: z.number().min(0).max(0.30),
      jockeyPct: z.number().min(0).max(0.20),
      guaranteedPurse: z.number().optional(),
      scheduledAt: z.string().optional(),
      auctionWindowSecs: z.number().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const race = await prisma.race.create({ data: body.data })
    return reply.code(201).send({ race })
  })

  // POST /admin/races/:id/force-simulate — bypass queue for testing
  app.post('/races/:id/force-simulate', { preHandler: [requireAdmin] }, async (req: any, reply) => {
    const race = await prisma.race.findUnique({ where: { id: req.params.id } })
    if (!race) return reply.code(404).send({ error: 'Race not found' })

    await simulationQueue.add('run-simulation', { raceId: req.params.id })
    return reply.send({ message: 'Simulation queued', raceId: req.params.id })
  })

  // GET /admin/races/:id/audit — full simulation audit log
  app.get('/races/:id/audit', { preHandler: [requireAdmin] }, async (req: any, reply) => {
    const race = await prisma.race.findUnique({
      where: { id: req.params.id },
      include: {
        entries: {
          include: { horse: true, jockey: true, user: { select: { username: true } } }
        }
      }
    })
    if (!race) return reply.code(404).send({ error: 'Race not found' })

    return reply.send({
      race,
      simulationInputs: race.simulationInputs,
      simulationOutputs: race.simulationOutputs,
    })
  })

  // GET /admin/users — user list with balances
  app.get('/users', { preHandler: [requireAdmin] }, async (req: any, reply) => {
    const users = await prisma.user.findMany({
      select: {
        id: true, username: true, email: true,
        walletBalance: true, auctionSuccessRate: true,
        createdAt: true,
        _count: { select: { horses: true, raceEntries: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return reply.send({ users })
  })

  // POST /admin/users/:id/adjust-balance — manual balance adjustment
  app.post('/users/:id/adjust-balance', { preHandler: [requireAdmin] }, async (req: any, reply) => {
    const schema = z.object({ amount: z.number(), reason: z.string() })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const user = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) return reply.code(404).send({ error: 'User not found' })

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { walletBalance: { increment: body.data.amount } }
      }),
      prisma.walletTransaction.create({
        data: {
          userId: user.id,
          type: 'ADJUSTMENT',
          amount: body.data.amount,
          balanceBefore: Number(user.walletBalance),
          balanceAfter: Number(user.walletBalance) + body.data.amount,
          description: `Admin adjustment: ${body.data.reason}`,
        }
      })
    ])

    return reply.send({ message: 'Balance adjusted' })
  })
}
