import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../db/client'

const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8)
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    const body = RegisterSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { email, username, password } = body.data

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    })
    if (existing) return reply.code(409).send({ error: 'Email or username already taken' })

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, username, passwordHash, walletBalance: 0 },
      select: { id: true, email: true, username: true, walletBalance: true, createdAt: true }
    })

    const token = app.jwt.sign({ userId: user.id, username: user.username })
    return reply.code(201).send({ user, token })
  })

  app.post('/login', async (req, reply) => {
    const body = LoginSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const user = await prisma.user.findUnique({ where: { email: body.data.email } })
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(body.data.password, user.passwordHash)
    if (!valid) return reply.code(401).send({ error: 'Invalid credentials' })

    const token = app.jwt.sign({ userId: user.id, username: user.username })
    return reply.send({
      user: { id: user.id, email: user.email, username: user.username, walletBalance: user.walletBalance },
      token
    })
  })

  app.get('/me', { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true, email: true, username: true,
        walletBalance: true, auctionSuccessRate: true,
        auctionWins: true, auctionTotal: true, createdAt: true
      }
    })
    if (!user) return reply.code(404).send({ error: 'User not found' })
    return reply.send({ user })
  })
}
