import { prisma } from '../db/client'
import { SurfaceType, FavoredDistance, RaceTier } from '@prisma/client'

const SURFACES: SurfaceType[] = ['DIRT', 'TURF', 'SYNTHETIC']
const DISTANCES: FavoredDistance[] = ['SPRINT', 'MID', 'ROUTE']

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function initRaceCreationScheduler() {
  // Delay startup to ensure database connection is ready
  setTimeout(() => {
    ensureFreRacesAvailable()
    setInterval(ensureFreRacesAvailable, 60_000)

    scheduleGoldStakes()
    setInterval(scheduleGoldStakes, 7 * 24 * 60 * 60_000)
  }, 5000)

  console.log('Race scheduler started')
}

async function ensureFreRacesAvailable() {
  const openFreeRaces = await prisma.race.count({
    where: { tier: 'FREE', status: { in: ['OPEN', 'FILLING'] } }
  })

  // Keep at least 5 free races open at all times
  const toCreate = Math.max(0, 5 - openFreeRaces)
  for (let i = 0; i < toCreate; i++) {
    await createRace('FREE', 0, 15, 6, 0, 0.08, 120)
  }
}

async function createBronzeRace() {
  const openBronze = await prisma.race.count({
    where: { tier: 'BRONZE', status: { in: ['OPEN', 'FILLING'] } }
  })
  if (openBronze >= 10) return

  const entryFee = [10, 15, 20, 25][Math.floor(Math.random() * 4)]
  await createRace('BRONZE', entryFee, 15, 10, 4, 0.08, 2 * 3600)
}

async function scheduleGoldStakes() {
  const saturday = getNextSaturday()
  const existing = await prisma.race.findFirst({
    where: {
      tier: 'GOLD',
      scheduledAt: { gte: new Date(), lte: addDays(saturday, 1) },
      status: { notIn: ['CANCELLED', 'COMPLETED'] }
    }
  })
  if (existing) return

  await prisma.race.create({
    data: {
      name: `Gold Stakes — ${saturday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      tier: 'GOLD',
      status: 'OPEN',
      surface: randomPick(SURFACES),
      distance: randomPick(DISTANCES),
      fieldSize: 14,
      minFieldSize: 6,
      entryFee: 150,
      houseRakePct: 0.18,
      jockeyPct: 0.08,
      guaranteedPurse: 1000,
      auctionWindowSecs: 1800, // 30 min
      scheduledAt: saturday,
      expiresAt: addDays(saturday, 1),
    }
  })
}

async function createRace(
  tier: RaceTier,
  entryFee: number,
  houseRakePct: number,
  fieldSize: number,
  minFieldSize: number,
  jockeyPct: number,
  expiresInSeconds: number
) {
  const surface = randomPick(SURFACES)
  const distance = randomPick(DISTANCES)
  const tierNames: Record<string, string[]> = {
    FREE: ['Maiden Free', 'Starter Free'],
    BRONZE: ['Bronze Claiming', 'Bronze Open'],
    SILVER: ['Silver Allowance', 'Silver Stakes'],
    GOLD: ['Gold Stakes'],
    CLASSIC: ['Invitational Classic'],
  }
  const nameBase = randomPick(tierNames[tier] || [tier])

  const count = await prisma.race.count({ where: { tier } })
  const name = `${nameBase} #${count + 1}`

  return prisma.race.create({
    data: {
      name,
      tier,
      status: 'OPEN',
      surface,
      distance,
      fieldSize,
      minFieldSize,
      entryFee,
      houseRakePct: houseRakePct / 100,
      jockeyPct,
      auctionWindowSecs: tier === 'FREE' ? 0 : 600,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    }
  })
}

function getNextSaturday(): Date {
  const d = new Date()
  const day = d.getDay()
  const diff = (6 - day + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  d.setHours(15, 0, 0, 0) // 3PM
  return d
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + days)
  return result
}
