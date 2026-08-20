import { PrismaClient } from '@prisma/client'
import { generateHorse } from '../services/horseGenerator'

const prisma = new PrismaClient()

const HOUSE_USER_ID = 'cmt1s961o000p8fpb15s4shik'

const BATCHES = [
  { tier: 'MAIDEN', count: 10, price: 50 },
  { tier: 'LOW',    count: 10, price: 65 },
  { tier: 'MID',    count: 15, price: 70 },
  { tier: 'HIGH',   count: 10, price: 80 },
  { tier: 'ELITE',  count: 5,  price: 95 },
]

async function main() {
  console.log('Seeding house horses...')

  let total = 0

  for (const batch of BATCHES) {
    for (let i = 0; i < batch.count; i++) {
      const attrs = generateHorse(batch.tier as any)

      await prisma.horse.create({
        data: {
          name: attrs.name,
          ownerId: HOUSE_USER_ID,
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
          estimatedValue: batch.price,
          traitsDiscovered: 2,
          sourceType: 'AI_GENERATED',
        }
      })
      total++
    }
    console.log(`Seeded ${batch.count} ${batch.tier} horses`)
  }

  console.log(`Total: ${total} house horses seeded`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())