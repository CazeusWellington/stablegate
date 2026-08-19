import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { registerRoutes } from './routes'
import { initSocketHandlers } from './socket'
import { initWorkers } from './jobs'
import { prisma } from './db/client'

const app = Fastify({ logger: true })
const httpServer = createServer(app.server)

export const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST'] }
})

async function bootstrap() {
  await app.register(cors, { origin: process.env.CORS_ORIGIN || '*' })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-prod'
  })

  // Decorate request with auth helper
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  await registerRoutes(app)
  initSocketHandlers(io)
  initWorkers()

  const port = Number(process.env.PORT) || 3000
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`StableGate API running on port ${port}`)
}

bootstrap().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
