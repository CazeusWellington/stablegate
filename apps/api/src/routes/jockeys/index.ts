import { FastifyInstance } from 'fastify'
import { prisma } from '../../db/client'

export async function jockeyRoutes(app: FastifyInstance) {

  // GET /jockeys — full roster ranked by composite score
  app.get('/', async (req: any, reply) => {
    const jockeys = await prisma.jockey.findMany({
      where: { isActive: true },
      orderBy: { compositeScore: 'desc' },
    })
    return reply.send({ jockeys })
  })

  // GET /jockeys/available/:raceId — jockeys not yet assigned in a race
  app.get('/available/:raceId', async (req: any, reply) => {
    const assignedJockeyIds = await prisma.raceEntry.findMany({
      where: { raceId: req.params.raceId, jockeyId: { not: null } },
      select: { jockeyId: true }
    })
    const takenIds = assignedJockeyIds.map(e => e.jockeyId!).filter(Boolean)

    const auctionBidJockeyIds = await prisma.jockeyBid.findMany({
      where: { raceId: req.params.raceId, status: 'PENDING' },
      select: { jockeyId: true }
    })
    const inAuctionIds = auctionBidJockeyIds.map(b => b.jockeyId)

    const allJockeys = await prisma.jockey.findMany({
      where: { isActive: true },
      orderBy: { compositeScore: 'desc' },
    })

    const enriched = allJockeys.map(j => ({
      ...j,
      assignmentStatus: takenIds.includes(j.id) ? 'ASSIGNED'
        : inAuctionIds.includes(j.id) ? 'IN_AUCTION'
        : 'AVAILABLE'
    }))

    return reply.send({ jockeys: enriched })
  })

  // GET /jockeys/:id — jockey detail + career stats
  app.get('/:id', async (req: any, reply) => {
    const jockey = await prisma.jockey.findUnique({
      where: { id: req.params.id },
      include: {
        seasonRecords: { orderBy: { seasonNumber: 'desc' }, take: 10 }
      }
    })
    if (!jockey) return reply.code(404).send({ error: 'Jockey not found' })
    return reply.send({ jockey })
  })
}
