import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding jockeys...')

  await prisma.jockey.deleteMany()

  await prisma.jockey.createMany({
    data: [
      { name: 'J. Santos',       tier: 'ELITE',  runningStyle: 'STALKER',      winRate: 0.32, top3Rate: 0.61, styleMatchWinRate: 0.36, dirtWinRate: 0.30, turfWinRate: 0.32, syntheticWinRate: 0.28, sprintWinRate: 0.35, routeWinRate: 0.31, compositeScore: 118, minimumPct: 0.12, baseModifier: 1.18, styleIsLocked: true },
      { name: 'M. Cruz',         tier: 'ELITE',  runningStyle: 'CLOSER',       winRate: 0.29, top3Rate: 0.58, styleMatchWinRate: 0.33, dirtWinRate: 0.27, turfWinRate: 0.29, syntheticWinRate: 0.25, sprintWinRate: 0.32, routeWinRate: 0.28, compositeScore: 116, minimumPct: 0.11, baseModifier: 1.16, styleIsLocked: true },
      { name: 'T. Velazquez',    tier: 'ELITE',  runningStyle: 'FRONT_RUNNER', winRate: 0.27, top3Rate: 0.55, styleMatchWinRate: 0.31, dirtWinRate: 0.25, turfWinRate: 0.27, syntheticWinRate: 0.23, sprintWinRate: 0.30, routeWinRate: 0.26, compositeScore: 115, minimumPct: 0.11, baseModifier: 1.15, styleIsLocked: true },
      { name: 'R. Rosario',      tier: 'ELITE',  runningStyle: 'PRESSER',      winRate: 0.25, top3Rate: 0.52, styleMatchWinRate: 0.29, dirtWinRate: 0.23, turfWinRate: 0.25, syntheticWinRate: 0.21, sprintWinRate: 0.28, routeWinRate: 0.24, compositeScore: 114, minimumPct: 0.10, baseModifier: 1.14, styleIsLocked: true },
      { name: 'D. Gutierrez',    tier: 'TOP',    runningStyle: 'STALKER',      winRate: 0.22, top3Rate: 0.48, styleMatchWinRate: 0.25, dirtWinRate: 0.20, turfWinRate: 0.22, syntheticWinRate: 0.18, sprintWinRate: 0.24, routeWinRate: 0.21, compositeScore: 110, minimumPct: 0.09, baseModifier: 1.10, styleIsLocked: true },
      { name: 'C. Lezcano',      tier: 'TOP',    runningStyle: 'CLOSER',       winRate: 0.21, top3Rate: 0.46, styleMatchWinRate: 0.24, dirtWinRate: 0.19, turfWinRate: 0.21, syntheticWinRate: 0.17, sprintWinRate: 0.23, routeWinRate: 0.20, compositeScore: 109, minimumPct: 0.09, baseModifier: 1.09, styleIsLocked: true },
      { name: 'A. Ortiz',        tier: 'TOP',    runningStyle: 'FRONT_RUNNER', winRate: 0.20, top3Rate: 0.44, styleMatchWinRate: 0.23, dirtWinRate: 0.18, turfWinRate: 0.20, syntheticWinRate: 0.16, sprintWinRate: 0.22, routeWinRate: 0.19, compositeScore: 108, minimumPct: 0.08, baseModifier: 1.08, styleIsLocked: true },
      { name: 'L. Morales',      tier: 'TOP',    runningStyle: 'PRESSER',      winRate: 0.19, top3Rate: 0.43, styleMatchWinRate: 0.22, dirtWinRate: 0.17, turfWinRate: 0.19, syntheticWinRate: 0.15, sprintWinRate: 0.21, routeWinRate: 0.18, compositeScore: 107, minimumPct: 0.08, baseModifier: 1.07, styleIsLocked: true },
      { name: 'P. Pedroza',      tier: 'TOP',    runningStyle: 'STALKER',      winRate: 0.18, top3Rate: 0.41, styleMatchWinRate: 0.21, dirtWinRate: 0.16, turfWinRate: 0.18, syntheticWinRate: 0.14, sprintWinRate: 0.20, routeWinRate: 0.17, compositeScore: 107, minimumPct: 0.08, baseModifier: 1.07, styleIsLocked: true },
      { name: 'S. Cordero',      tier: 'TOP',    runningStyle: 'CLOSER',       winRate: 0.17, top3Rate: 0.40, styleMatchWinRate: 0.20, dirtWinRate: 0.15, turfWinRate: 0.17, syntheticWinRate: 0.13, sprintWinRate: 0.19, routeWinRate: 0.16, compositeScore: 106, minimumPct: 0.07, baseModifier: 1.06, styleIsLocked: true },
      { name: 'B. Pincay',       tier: 'MID',    runningStyle: 'FRONT_RUNNER', winRate: 0.14, top3Rate: 0.35, styleMatchWinRate: 0.16, dirtWinRate: 0.13, turfWinRate: 0.14, syntheticWinRate: 0.11, sprintWinRate: 0.15, routeWinRate: 0.13, compositeScore: 105, minimumPct: 0.06, baseModifier: 1.05, styleIsLocked: true },
      { name: 'K. Day',          tier: 'MID',    runningStyle: 'PRESSER',      winRate: 0.13, top3Rate: 0.34, styleMatchWinRate: 0.15, dirtWinRate: 0.12, turfWinRate: 0.13, syntheticWinRate: 0.10, sprintWinRate: 0.14, routeWinRate: 0.12, compositeScore: 104, minimumPct: 0.06, baseModifier: 1.04, styleIsLocked: true },
      { name: 'E. McCarron',     tier: 'MID',    runningStyle: 'STALKER',      winRate: 0.13, top3Rate: 0.33, styleMatchWinRate: 0.15, dirtWinRate: 0.12, turfWinRate: 0.13, syntheticWinRate: 0.10, sprintWinRate: 0.14, routeWinRate: 0.12, compositeScore: 104, minimumPct: 0.06, baseModifier: 1.04, styleIsLocked: true },
      { name: 'F. Delahoussaye', tier: 'MID',    runningStyle: 'CLOSER',       winRate: 0.12, top3Rate: 0.32, styleMatchWinRate: 0.14, dirtWinRate: 0.11, turfWinRate: 0.12, syntheticWinRate: 0.09, sprintWinRate: 0.13, routeWinRate: 0.11, compositeScore: 103, minimumPct: 0.06, baseModifier: 1.03, styleIsLocked: true },
      { name: 'G. Valenzuela',   tier: 'MID',    runningStyle: 'FRONT_RUNNER', winRate: 0.12, top3Rate: 0.31, styleMatchWinRate: 0.14, dirtWinRate: 0.11, turfWinRate: 0.12, syntheticWinRate: 0.09, sprintWinRate: 0.13, routeWinRate: 0.11, compositeScore: 103, minimumPct: 0.05, baseModifier: 1.03, styleIsLocked: true },
      { name: 'H. Antley',       tier: 'MID',    runningStyle: 'PRESSER',      winRate: 0.11, top3Rate: 0.30, styleMatchWinRate: 0.13, dirtWinRate: 0.10, turfWinRate: 0.11, syntheticWinRate: 0.08, sprintWinRate: 0.12, routeWinRate: 0.10, compositeScore: 102, minimumPct: 0.05, baseModifier: 1.02, styleIsLocked: true },
      { name: 'I. Nakatani',     tier: 'MID',    runningStyle: 'STALKER',      winRate: 0.11, top3Rate: 0.29, styleMatchWinRate: 0.13, dirtWinRate: 0.10, turfWinRate: 0.11, syntheticWinRate: 0.08, sprintWinRate: 0.12, routeWinRate: 0.10, compositeScore: 102, minimumPct: 0.05, baseModifier: 1.02, styleIsLocked: true },
      { name: 'N. Espinoza',     tier: 'MID',    runningStyle: 'CLOSER',       winRate: 0.10, top3Rate: 0.28, styleMatchWinRate: 0.12, dirtWinRate: 0.09, turfWinRate: 0.10, syntheticWinRate: 0.07, sprintWinRate: 0.11, routeWinRate: 0.09, compositeScore: 101, minimumPct: 0.05, baseModifier: 1.01, styleIsLocked: true },
      { name: 'O. Bejarano',     tier: 'BUDGET', runningStyle: 'STALKER',      winRate: 0.08, top3Rate: 0.24, styleMatchWinRate: 0.09, dirtWinRate: 0.07, turfWinRate: 0.08, syntheticWinRate: 0.06, sprintWinRate: 0.09, routeWinRate: 0.07, compositeScore: 99,  minimumPct: 0.04, baseModifier: 0.99, styleIsLocked: true },
      { name: 'Q. Garcia',       tier: 'BUDGET', runningStyle: 'FRONT_RUNNER', winRate: 0.07, top3Rate: 0.22, styleMatchWinRate: 0.08, dirtWinRate: 0.06, turfWinRate: 0.07, syntheticWinRate: 0.05, sprintWinRate: 0.08, routeWinRate: 0.06, compositeScore: 98,  minimumPct: 0.04, baseModifier: 0.98, styleIsLocked: true },
      { name: 'U. Hernandez',    tier: 'BUDGET', runningStyle: 'CLOSER',       winRate: 0.07, top3Rate: 0.21, styleMatchWinRate: 0.08, dirtWinRate: 0.06, turfWinRate: 0.07, syntheticWinRate: 0.05, sprintWinRate: 0.08, routeWinRate: 0.06, compositeScore: 97,  minimumPct: 0.04, baseModifier: 0.97, styleIsLocked: true },
      { name: 'V. Lopez',        tier: 'BUDGET', runningStyle: 'PRESSER',      winRate: 0.06, top3Rate: 0.20, styleMatchWinRate: 0.07, dirtWinRate: 0.05, turfWinRate: 0.06, syntheticWinRate: 0.04, sprintWinRate: 0.07, routeWinRate: 0.05, compositeScore: 97,  minimumPct: 0.04, baseModifier: 0.97, styleIsLocked: true },
      { name: 'W. Martinez',     tier: 'BUDGET', runningStyle: 'STALKER',      winRate: 0.06, top3Rate: 0.19, styleMatchWinRate: 0.07, dirtWinRate: 0.05, turfWinRate: 0.06, syntheticWinRate: 0.04, sprintWinRate: 0.07, routeWinRate: 0.05, compositeScore: 96,  minimumPct: 0.03, baseModifier: 0.96, styleIsLocked: true },
      { name: 'X. Rivera',       tier: 'BUDGET', runningStyle: 'CLOSER',       winRate: 0.06, top3Rate: 0.18, styleMatchWinRate: 0.07, dirtWinRate: 0.05, turfWinRate: 0.06, syntheticWinRate: 0.04, sprintWinRate: 0.07, routeWinRate: 0.05, compositeScore: 96,  minimumPct: 0.03, baseModifier: 0.96, styleIsLocked: true },
      { name: 'Y. Torres',       tier: 'BUDGET', runningStyle: 'FRONT_RUNNER', winRate: 0.05, top3Rate: 0.17, styleMatchWinRate: 0.06, dirtWinRate: 0.04, turfWinRate: 0.05, syntheticWinRate: 0.03, sprintWinRate: 0.06, routeWinRate: 0.04, compositeScore: 95,  minimumPct: 0.03, baseModifier: 0.95, styleIsLocked: true },
      { name: 'Z. Vargas',       tier: 'BUDGET', runningStyle: 'PRESSER',      winRate: 0.05, top3Rate: 0.16, styleMatchWinRate: 0.06, dirtWinRate: 0.04, turfWinRate: 0.05, syntheticWinRate: 0.03, sprintWinRate: 0.06, routeWinRate: 0.04, compositeScore: 95,  minimumPct: 0.03, baseModifier: 0.95, styleIsLocked: true },
      { name: 'Al Reyes',        tier: 'ROOKIE', runningStyle: 'STALKER',      winRate: 0.04, top3Rate: 0.13, styleMatchWinRate: 0.05, dirtWinRate: 0.03, turfWinRate: 0.04, syntheticWinRate: 0.03, sprintWinRate: 0.04, routeWinRate: 0.03, compositeScore: 92,  minimumPct: 0.03, baseModifier: 0.92, styleIsLocked: false },
      { name: 'Bo Flores',       tier: 'ROOKIE', runningStyle: 'CLOSER',       winRate: 0.03, top3Rate: 0.11, styleMatchWinRate: 0.04, dirtWinRate: 0.02, turfWinRate: 0.03, syntheticWinRate: 0.02, sprintWinRate: 0.03, routeWinRate: 0.02, compositeScore: 91,  minimumPct: 0.02, baseModifier: 0.91, styleIsLocked: false },
      { name: 'Ed Jimenez',      tier: 'ROOKIE', runningStyle: 'FRONT_RUNNER', winRate: 0.03, top3Rate: 0.10, styleMatchWinRate: 0.04, dirtWinRate: 0.02, turfWinRate: 0.03, syntheticWinRate: 0.02, sprintWinRate: 0.03, routeWinRate: 0.02, compositeScore: 90,  minimumPct: 0.02, baseModifier: 0.90, styleIsLocked: false },
      { name: 'Si Ramos',        tier: 'ROOKIE', runningStyle: 'PRESSER',      winRate: 0.02, top3Rate: 0.09, styleMatchWinRate: 0.03, dirtWinRate: 0.01, turfWinRate: 0.02, syntheticWinRate: 0.01, sprintWinRate: 0.02, routeWinRate: 0.01, compositeScore: 89,  minimumPct: 0.02, baseModifier: 0.89, styleIsLocked: false },
    ]
  })

  console.log('Seeded 30 jockeys')
  console.log('Seed complete')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())