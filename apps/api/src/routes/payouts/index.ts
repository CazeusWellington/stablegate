import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../db/client'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-04-10' })

export async function payoutRoutes(app: FastifyInstance) {

  // GET /payouts/transactions — wallet history
  app.get('/transactions', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const { page = '1', limit = '20' } = req.query as any
    const skip = (Number(page) - 1) * Number(limit)

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.walletTransaction.count({ where: { userId: req.user.userId } })
    ])

    return reply.send({ transactions, total, page: Number(page), limit: Number(limit) })
  })

  // POST /payouts/deposit — create Stripe payment intent
  app.post('/deposit', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const schema = z.object({ amount: z.number().min(5).max(10000) })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!user) return reply.code(404).send({ error: 'User not found' })

    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id }
      })
      customerId = customer.id
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId }
      })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(body.data.amount * 100), // cents
      currency: 'usd',
      customer: customerId,
      metadata: { userId: user.id, type: 'deposit' },
    })

    return reply.send({ clientSecret: paymentIntent.client_secret })
  })

  // POST /payouts/stripe-webhook — handle Stripe events
  app.post('/stripe-webhook', async (req: any, reply) => {
    const sig = req.headers['stripe-signature']
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody || req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      )
    } catch (err: any) {
      return reply.code(400).send({ error: `Webhook Error: ${err.message}` })
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent
      if (pi.metadata.type === 'deposit' && pi.metadata.userId) {
        const amount = pi.amount / 100
        const user = await prisma.user.findUnique({ where: { id: pi.metadata.userId } })
        if (user) {
          await prisma.$transaction([
            prisma.user.update({
              where: { id: user.id },
              data: { walletBalance: { increment: amount } }
            }),
            prisma.walletTransaction.create({
              data: {
                userId: user.id,
                type: 'DEPOSIT',
                amount,
                balanceBefore: Number(user.walletBalance),
                balanceAfter: Number(user.walletBalance) + amount,
                description: `Deposit via Stripe`,
                stripePaymentId: pi.id,
              }
            })
          ])
        }
      }
    }

    return reply.send({ received: true })
  })
}
