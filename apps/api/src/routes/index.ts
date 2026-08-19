import { FastifyInstance } from 'fastify'
import { authRoutes } from './auth'
import { horseRoutes } from './horses'
import { raceRoutes } from './races'
import { jockeyRoutes } from './jockeys'
import { marketplaceRoutes } from './marketplace'
import { breedingRoutes } from './breeding'
import { payoutRoutes } from './payouts'
import { adminRoutes } from './admin'

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: '/api/v1/auth' })
  await app.register(horseRoutes, { prefix: '/api/v1/horses' })
  await app.register(raceRoutes, { prefix: '/api/v1/races' })
  await app.register(jockeyRoutes, { prefix: '/api/v1/jockeys' })
  await app.register(marketplaceRoutes, { prefix: '/api/v1/marketplace' })
  await app.register(breedingRoutes, { prefix: '/api/v1/breeding' })
  await app.register(payoutRoutes, { prefix: '/api/v1/payouts' })
  await app.register(adminRoutes, { prefix: '/api/v1/admin' })

  app.get('/health', async () => ({ status: 'ok', ts: Date.now() }))
}
