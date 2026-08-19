import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/client'

const MARKETPLACE_CUT = 0.07

export async function marketplaceRoutes(app: FastifyInstance) {

  // GET /marketplace — all active listings
  app.get('/', async (req: any, reply) => {
    const { surface, style, maxPrice, minPrice, status, sort } = req.query as any

    const listings = await prisma.marketplaceListing.findMany({
      where: {
        status: status || 'ACTIVE',
        ...(maxPrice ? { askingPrice: { lte: Number(maxPrice) } } : {}),
        ...(minPrice ? { askingPrice: { gte: Number(minPrice) } } : {}),
        horse: {
          ...(surface ? { surfacePreference: surface } : {}),
          ...(style ? { runningStyle: style } : {}),
        }
      },
      include: {
        horse: {
          select: {
            id: true, name: true, speedFigure: true, runningStyle: true,
            status: true, wins: true, totalRaces: true,
            traitsDiscovered: true, surfacePreference: true,
            favoredDistance: true, estimatedValue: true,
          }
        },
        seller: { select: { username: true } }
      },
      orderBy: sort === 'speed' ? { horse: { speedFigure: 'desc' } }
        : sort === 'wins' ? { horse: { wins: 'desc' } }
        : sort === 'price-desc' ? { askingPrice: 'desc' }
        : { askingPrice: 'asc' },
      take: 50,
    })

    return reply.send({ listings })
  })

  // POST /marketplace/list — list a horse for sale
  app.post('/list', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const schema = z.object({
      horseId: z.string(),
      askingPrice: z.number().min(1).max(100000),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const horse = await prisma.horse.findFirst({
      where: { id: body.data.horseId, ownerId: req.user.userId }
    })
    if (!horse) return reply.code(404).send({ error: 'Horse not found' })
    if (horse.status === 'BREEDING_LOCKED') {
      return reply.code(400).send({ error: 'Cannot list a horse currently in breeding' })
    }

    // Cancel any existing listing
    await prisma.marketplaceListing.updateMany({
      where: { horseId: horse.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    })

    const listing = await prisma.marketplaceListing.create({
      data: {
        horseId: horse.id,
        sellerId: req.user.userId,
        askingPrice: body.data.askingPrice,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      }
    })

    return reply.code(201).send({ listing })
  })

  // POST /marketplace/:id/buy
  app.post('/:id/buy', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.id },
      include: { horse: true, seller: true }
    })
    if (!listing || listing.status !== 'ACTIVE') {
      return reply.code(404).send({ error: 'Listing not found or no longer available' })
    }
    if (listing.sellerId === req.user.userId) {
      return reply.code(400).send({ error: 'Cannot buy your own listing' })
    }

    const buyer = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!buyer) return reply.code(404).send({ error: 'User not found' })

    const price = Number(listing.askingPrice)
    if (Number(buyer.walletBalance) < price) {
      return reply.code(402).send({ error: 'Insufficient wallet balance' })
    }

    const houseCut = Math.round(price * MARKETPLACE_CUT * 100) / 100
    const sellerReceives = Math.round((price - houseCut) * 100) / 100

    await prisma.$transaction([
      // Deduct from buyer
      prisma.user.update({
        where: { id: req.user.userId },
        data: { walletBalance: { decrement: price } }
      }),
      // Credit seller
      prisma.user.update({
        where: { id: listing.sellerId },
        data: { walletBalance: { increment: sellerReceives } }
      }),
      // Transfer horse ownership
      prisma.horse.update({
        where: { id: listing.horseId },
        data: { ownerId: req.user.userId }
      }),
      // Mark listing sold
      prisma.marketplaceListing.update({
        where: { id: listing.id },
        data: { status: 'SOLD' }
      }),
      // Record purchase
      prisma.marketplacePurchase.create({
        data: {
          listingId: listing.id,
          buyerId: req.user.userId,
          salePrice: price,
          houseCut,
          sellerReceives,
        }
      }),
      // Buyer wallet transaction
      prisma.walletTransaction.create({
        data: {
          userId: req.user.userId,
          type: 'MARKETPLACE_PURCHASE',
          amount: -price,
          balanceBefore: Number(buyer.walletBalance),
          balanceAfter: Number(buyer.walletBalance) - price,
          description: `Purchased: ${listing.horse.name}`,
          referenceId: listing.id,
          referenceType: 'listing',
        }
      }),
      // Seller wallet transaction
      prisma.walletTransaction.create({
        data: {
          userId: listing.sellerId,
          type: 'MARKETPLACE_SALE',
          amount: sellerReceives,
          balanceBefore: Number(listing.seller.walletBalance),
          balanceAfter: Number(listing.seller.walletBalance) + sellerReceives,
          description: `Sold: ${listing.horse.name} (7% fee deducted)`,
          referenceId: listing.id,
          referenceType: 'listing',
        }
      }),
    ])

    return reply.send({
      message: `${listing.horse.name} purchased successfully`,
      price,
      houseCut,
      sellerReceives,
    })
  })

  // DELETE /marketplace/:id — cancel listing
  app.delete('/:id', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const listing = await prisma.marketplaceListing.findFirst({
      where: { id: req.params.id, sellerId: req.user.userId, status: 'ACTIVE' }
    })
    if (!listing) return reply.code(404).send({ error: 'Listing not found' })

    await prisma.marketplaceListing.update({
      where: { id: listing.id },
      data: { status: 'CANCELLED' }
    })

    return reply.send({ message: 'Listing cancelled' })
  })
}
