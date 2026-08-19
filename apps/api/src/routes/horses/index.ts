import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/client'
import { generateHorse, SpeedTier } from '../../services/horseGenerator'
import { TraitDiscoveryService } from '../../services/traitDiscovery'

const TRAINER_UNLOCK_COST = 150
const TRAINING_SESSION_COST = 30
const HOUSE_BUYBACK_RATE = 0.08

export async function horseRoutes(app: FastifyInstance) {

  // GET /horses — my stable
  app.get('/', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const horses = await prisma.horse.findMany({
      where: { ownerId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: { traitEvents: { orderBy: { createdAt: 'desc' }, take: 5 } }
    })
    return reply.send({ horses })
  })

  // GET /horses/:id — single horse detail
  app.get('/:id', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const horse = await prisma.horse.findFirst({
      where: { id: req.params.id, ownerId: req.user.userId },
      include: {
        traitEvents: { orderBy: { createdAt: 'asc' } },
        raceEntries: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { race: true, jockey: true }
        }
      }
    })
    if (!horse) return reply.code(404).send({ error: 'Horse not found' })

    // Build visible trait state
    const traits = TraitDiscoveryService.buildTraitState(horse)
    return reply.send({ horse, traits })
  })

  // POST /horses/purchase — buy a new horse from the house
  app.post('/purchase', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const schema = z.object({ tier: z.enum(['MAIDEN', 'LOW', 'MID', 'HIGH', 'ELITE']).optional() })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const tier = (body.data.tier || 'MID') as SpeedTier
    const prices: Record<string, number> = {
      MAIDEN: 50, LOW: 65, MID: 70, HIGH: 80, ELITE: 95
    }
    const price = prices[tier]

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!user || Number(user.walletBalance) < price) {
      return reply.code(402).send({ error: 'Insufficient wallet balance' })
    }

    const attrs = generateHorse(tier)

    const [horse] = await prisma.$transaction([
      prisma.horse.create({
        data: {
          name: attrs.name,
          ownerId: req.user.userId,
          speedFigure: attrs.speedFigure,
          runningStyle: attrs.runningStyle,
          favoredDistance: attrs.favoredDistance,
          surfacePreference: attrs.surfacePreference,
          staminaRating: attrs.staminaRating,
          consistencyScore: attrs.consistencyScore,
          peakAgeWindow: attrs.peakAgeWindow,
          hiddenTalent: attrs.hiddenTalent,
          discoveryInterval: attrs.discoveryInterval,
          discoveryHint: attrs.discoveryHint,
          estimatedValue: attrs.estimatedValue,
          traitsDiscovered: 2,
        }
      }),
      prisma.user.update({
        where: { id: req.user.userId },
        data: { walletBalance: { decrement: price } }
      }),
      prisma.walletTransaction.create({
        data: {
          userId: req.user.userId,
          type: 'NEW_HORSE_PURCHASE',
          amount: -price,
          balanceBefore: Number(user.walletBalance),
          balanceAfter: Number(user.walletBalance) - price,
          description: `Purchased horse: ${attrs.name}`,
        }
      })
    ])

    return reply.code(201).send({ horse })
  })

  // POST /horses/:id/trainer-unlock — pay $150 to reveal 2 traits
  app.post('/:id/trainer-unlock', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const horse = await prisma.horse.findFirst({
      where: { id: req.params.id, ownerId: req.user.userId }
    })
    if (!horse) return reply.code(404).send({ error: 'Horse not found' })
    if (horse.status === 'RETIRED') return reply.code(400).send({ error: 'Cannot use trainer unlock on a retired horse' })
    if (horse.trainerUnlocksUsed >= 2) return reply.code(400).send({ error: 'Maximum trainer unlocks reached (2 per career)' })
    if (horse.traitsDiscovered >= 8) return reply.code(400).send({ error: 'All traits already discovered' })

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!user || Number(user.walletBalance) < TRAINER_UNLOCK_COST) {
      return reply.code(402).send({ error: 'Insufficient wallet balance' })
    }

    const revealed = await TraitDiscoveryService.trainerUnlock(horse)

    await prisma.$transaction([
      prisma.horse.update({
        where: { id: horse.id },
        data: {
          traitsDiscovered: { increment: revealed.length },
          trainerUnlocksUsed: { increment: 1 },
          ...TraitDiscoveryService.buildUpdateFromRevealed(revealed, horse)
        }
      }),
      prisma.user.update({
        where: { id: req.user.userId },
        data: { walletBalance: { decrement: TRAINER_UNLOCK_COST } }
      }),
      prisma.walletTransaction.create({
        data: {
          userId: req.user.userId,
          type: 'TRAINER_UNLOCK',
          amount: -TRAINER_UNLOCK_COST,
          balanceBefore: Number(user.walletBalance),
          balanceAfter: Number(user.walletBalance) - TRAINER_UNLOCK_COST,
          description: `Trainer unlock for ${horse.name}`,
          referenceId: horse.id,
          referenceType: 'horse',
        }
      }),
      ...revealed.map(r => prisma.traitDiscoveryEvent.create({
        data: {
          horseId: horse.id,
          traitName: r.traitName,
          traitValue: String(r.value),
          discoveredVia: 'TRAINER_UNLOCK',
          racesAtUnlock: horse.totalRaces,
          trainerUnlock: true,
        }
      }))
    ])

    return reply.send({ revealed, message: `${revealed.length} trait(s) unlocked` })
  })

  // POST /horses/:id/training-session
  app.post('/:id/training-session', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const horse = await prisma.horse.findFirst({
      where: { id: req.params.id, ownerId: req.user.userId }
    })
    if (!horse) return reply.code(404).send({ error: 'Horse not found' })
    if (horse.status !== 'ACTIVE') return reply.code(400).send({ error: 'Horse must be active' })

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!user || Number(user.walletBalance) < TRAINING_SESSION_COST) {
      return reply.code(402).send({ error: 'Insufficient wallet balance' })
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.userId },
        data: { walletBalance: { decrement: TRAINING_SESSION_COST } }
      }),
      prisma.walletTransaction.create({
        data: {
          userId: req.user.userId,
          type: 'TRAINING_SESSION',
          amount: -TRAINING_SESSION_COST,
          balanceBefore: Number(user.walletBalance),
          balanceAfter: Number(user.walletBalance) - TRAINING_SESSION_COST,
          description: `Training session for ${horse.name}`,
          referenceId: horse.id,
          referenceType: 'horse',
        }
      })
    ])

    return reply.send({ message: 'Training session logged', cost: TRAINING_SESSION_COST })
  })

  // POST /horses/:id/sell-to-house — house buyback
  app.post('/:id/sell-to-house', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const horse = await prisma.horse.findFirst({
      where: { id: req.params.id, ownerId: req.user.userId }
    })
    if (!horse) return reply.code(404).send({ error: 'Horse not found' })
    if (horse.status === 'BREEDING_LOCKED') {
      return reply.code(400).send({ error: 'Cannot sell a horse currently in breeding' })
    }

    const offer = Math.max(10, Math.round(Number(horse.estimatedValue) * HOUSE_BUYBACK_RATE))
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!user) return reply.code(404).send({ error: 'User not found' })

    await prisma.$transaction([
      prisma.horse.update({
        where: { id: horse.id },
        data: { ownerId: 'house', status: 'RETIRED' }
      }),
      prisma.user.update({
        where: { id: req.user.userId },
        data: { walletBalance: { increment: offer } }
      }),
      prisma.walletTransaction.create({
        data: {
          userId: req.user.userId,
          type: 'HORSE_BUYBACK',
          amount: offer,
          balanceBefore: Number(user.walletBalance),
          balanceAfter: Number(user.walletBalance) + offer,
          description: `House buyback: ${horse.name}`,
          referenceId: horse.id,
          referenceType: 'horse',
        }
      })
    ])

    return reply.send({ offer, message: `${horse.name} sold to house for $${offer}` })
  })
}
