import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/client'
import { breedHorse } from '../../services/horseGenerator'

const BASE_BREEDING_FEE = 200
const WIN_MULTIPLIER = 10

export async function breedingRoutes(app: FastifyInstance) {

  // POST /breeding/breed
  app.post('/breed', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const schema = z.object({ sireId: z.string(), damId: z.string() })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const [sire, dam] = await Promise.all([
      prisma.horse.findFirst({ where: { id: body.data.sireId, ownerId: req.user.userId, status: 'RETIRED' } }),
      prisma.horse.findFirst({ where: { id: body.data.damId, ownerId: req.user.userId, status: 'RETIRED' } }),
    ])
    if (!sire) return reply.code(404).send({ error: 'Sire not found or not retired' })
    if (!dam) return reply.code(404).send({ error: 'Dam not found or not retired' })
    if (sire.id === dam.id) return reply.code(400).send({ error: 'Sire and dam must be different horses' })

    const combinedWins = sire.wins + dam.wins
    const breedingFee = BASE_BREEDING_FEE + (combinedWins * WIN_MULTIPLIER)

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!user || Number(user.walletBalance) < breedingFee) {
      return reply.code(402).send({ error: `Insufficient balance. Breeding fee: $${breedingFee}` })
    }

    const { attributes, inheritanceLog, mutationLog } = breedHorse(
      {
        speedFigure: sire.speedFigure,
        runningStyle: sire.runningStyle,
        favoredDistance: sire.favoredDistance,
        surfacePreference: sire.surfacePreference,
        staminaRating: sire.staminaRating,
        consistencyScore: sire.consistencyScore,
        peakAgeWindow: sire.peakAgeWindow,
        hiddenTalent: sire.hiddenTalent,
        discoveryInterval: sire.discoveryInterval,
      },
      {
        speedFigure: dam.speedFigure,
        runningStyle: dam.runningStyle,
        favoredDistance: dam.favoredDistance,
        surfacePreference: dam.surfacePreference,
        staminaRating: dam.staminaRating,
        consistencyScore: dam.consistencyScore,
        peakAgeWindow: dam.peakAgeWindow,
        hiddenTalent: dam.hiddenTalent,
        discoveryInterval: dam.discoveryInterval,
      }
    )

    const [offspring] = await prisma.$transaction([
      prisma.horse.create({
        data: {
          name: attributes.name,
          ownerId: req.user.userId,
          status: 'FOAL',
          sireId: sire.id,
          damId: dam.id,
          sourceType: 'BRED',
          speedFigure: attributes.speedFigure,
          runningStyle: attributes.runningStyle,
          favoredDistance: attributes.favoredDistance,
          surfacePreference: attributes.surfacePreference,
          staminaRating: attributes.staminaRating,
          consistencyScore: attributes.consistencyScore,
          peakAgeWindow: attributes.peakAgeWindow,
          hiddenTalent: attributes.hiddenTalent,
          discoveryInterval: attributes.discoveryInterval,
          discoveryHint: attributes.discoveryHint,
          estimatedValue: attributes.estimatedValue,
          traitsDiscovered: 2, // speed + style always revealed at birth
        }
      }),
      prisma.user.update({
        where: { id: req.user.userId },
        data: { walletBalance: { decrement: breedingFee } }
      }),
      prisma.walletTransaction.create({
        data: {
          userId: req.user.userId,
          type: 'BREEDING_FEE',
          amount: -breedingFee,
          balanceBefore: Number(user.walletBalance),
          balanceAfter: Number(user.walletBalance) - breedingFee,
          description: `Breeding: ${sire.name} × ${dam.name}`,
        }
      }),
    ])

    await prisma.breedingRecord.create({
      data: {
        sireId: sire.id,
        damId: dam.id,
        offspringId: offspring.id,
        ownerId: req.user.userId,
        breedingFee,
        inheritanceLog,
        mutationLog,
        status: 'COMPLETED',
        completedAt: new Date(),
      }
    })

    return reply.code(201).send({
      offspring,
      breedingFee,
      inheritanceLog,
      mutationLog,
      message: `${offspring.name} born successfully`,
    })
  })

  // GET /breeding/estimate — fee preview before committing
  app.get('/estimate', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const schema = z.object({ sireId: z.string(), damId: z.string() })
    const query = schema.safeParse(req.query)
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() })

    const [sire, dam] = await Promise.all([
      prisma.horse.findFirst({ where: { id: query.data.sireId } }),
      prisma.horse.findFirst({ where: { id: query.data.damId } }),
    ])
    if (!sire || !dam) return reply.code(404).send({ error: 'Horse(s) not found' })

    const combinedWins = sire.wins + dam.wins
    const fee = BASE_BREEDING_FEE + (combinedWins * WIN_MULTIPLIER)

    return reply.send({
      sire: { id: sire.id, name: sire.name, wins: sire.wins },
      dam: { id: dam.id, name: dam.name, wins: dam.wins },
      combinedWins,
      breedingFee: fee,
      breakdown: { base: BASE_BREEDING_FEE, winBonus: combinedWins * WIN_MULTIPLIER },
    })
  })
}
