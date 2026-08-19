import { RunningStyle, SurfaceType, FavoredDistance, DiscoveryHint } from '@prisma/client'

// ─── EQUIBASE INTEGRATION POINT ───────────────────────────────────────────────
// When Equibase is licensed, replace the distribution constants below with
// values derived from historical Equibase data via scripts/equibase-import.ts
//
// The distributions are intentionally separated from generation logic so
// swapping real data in requires only updating these constants.
// ──────────────────────────────────────────────────────────────────────────────

// Speed figure distributions by tier (mean, stdDev)
// SOURCE: placeholder — replace with Equibase Beyer speed figure distributions
const SPEED_DISTRIBUTIONS = {
  ELITE:  { mean: 95, std: 6 },
  HIGH:   { mean: 85, std: 7 },
  MID:    { mean: 75, std: 7 },
  LOW:    { mean: 65, std: 6 },
  MAIDEN: { mean: 55, std: 8 },
}

// Style probability weights
// SOURCE: placeholder — replace with Equibase pace style distributions
const STYLE_WEIGHTS: Record<RunningStyle, number> = {
  FRONT_RUNNER: 0.20,
  STALKER:      0.30,
  PRESSER:      0.25,
  CLOSER:       0.25,
}

// Surface preference weights
// SOURCE: placeholder — replace with Equibase surface preference data
const SURFACE_WEIGHTS: Record<SurfaceType, number> = {
  DIRT:      0.55,
  TURF:      0.35,
  SYNTHETIC: 0.10,
}

// Distance preference weights
// SOURCE: placeholder — replace with Equibase distance distribution data
const DISTANCE_WEIGHTS: Record<FavoredDistance, number> = {
  SPRINT: 0.40,
  MID:    0.25,
  ROUTE:  0.35,
}

// Discovery interval ranges by complexity
const INTERVAL_RANGES = {
  STRAIGHTFORWARD: { min: 3, max: 4 },
  MODERATE:        { min: 5, max: 6 },
  COMPLEX:         { min: 7, max: 9 },
}

// Hidden talent pool
// SOURCE: placeholder — can be enriched with Equibase specialty indicators
const HIDDEN_TALENTS = [
  'Mud specialist',
  'Marathon stamina',
  'Gate speed advantage',
  'Late-race acceleration',
  'Turf affinity',
  'Rail runner',
  'Wide runner',
  'Pace setter',
  'Stretch runner',
  'Wet track specialist',
]

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────

function gaussianRandom(mean: number, std: number): number {
  // Box-Muller transform
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return Math.round(Math.max(40, Math.min(120, mean + z * std)))
}

function weightedPick<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let rand = Math.random() * total
  for (const [key, weight] of entries) {
    rand -= weight
    if (rand <= 0) return key
  }
  return entries[0][0]
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── HORSE NAMES ──────────────────────────────────────────────────────────────

const NAME_PREFIXES = [
  'Iron', 'Silver', 'Storm', 'Shadow', 'Golden', 'Crimson', 'Phantom',
  'Thunder', 'Desert', 'Blue', 'Night', 'Swift', 'Blazing', 'Dark',
  'Wild', 'Copper', 'Crystal', 'Arctic', 'Ember', 'Jade',
]
const NAME_SUFFIXES = [
  'Tide', 'Ridge', 'Skies', 'Wind', 'Legacy', 'Circuit', 'Horizon',
  'Comet', 'Stone', 'Road', 'Star', 'Blade', 'Fire', 'River',
  'Peak', 'Echo', 'Flash', 'Blaze', 'Mist', 'Dawn',
]

function generateHorseName(): string {
  return `${pickRandom(NAME_PREFIXES)} ${pickRandom(NAME_SUFFIXES)}`
}

// ─── MAIN GENERATION FUNCTION ─────────────────────────────────────────────────

export interface GeneratedHorseAttributes {
  name: string
  speedFigure: number
  runningStyle: RunningStyle
  favoredDistance: FavoredDistance       // hidden at generation
  surfacePreference: SurfaceType         // hidden at generation
  staminaRating: number                  // hidden
  consistencyScore: number               // hidden
  peakAgeWindow: string                  // hidden
  hiddenTalent: string                   // hidden
  discoveryInterval: number
  discoveryHint: DiscoveryHint
  estimatedValue: number
}

export type SpeedTier = keyof typeof SPEED_DISTRIBUTIONS

export function generateHorse(tier: SpeedTier = 'MID'): GeneratedHorseAttributes {
  const dist = SPEED_DISTRIBUTIONS[tier]
  const speedFigure = gaussianRandom(dist.mean, dist.std)

  const runningStyle = weightedPick(STYLE_WEIGHTS)
  const favoredDistance = weightedPick(DISTANCE_WEIGHTS)
  const surfacePreference = weightedPick(SURFACE_WEIGHTS)

  const staminaRating = randomBetween(40, 95)
  const consistencyScore = randomBetween(30, 95)

  const peakAgeMin = randomBetween(3, 5)
  const peakAgeMax = peakAgeMin + randomBetween(1, 3)
  const peakAgeWindow = `${peakAgeMin}–${peakAgeMax}`

  const hiddenTalent = pickRandom(HIDDEN_TALENTS)

  // Determine discovery complexity
  const complexityRoll = Math.random()
  let discoveryHint: DiscoveryHint
  let intervalRange: { min: number; max: number }

  if (complexityRoll < 0.35) {
    discoveryHint = 'STRAIGHTFORWARD'
    intervalRange = INTERVAL_RANGES.STRAIGHTFORWARD
  } else if (complexityRoll < 0.70) {
    discoveryHint = 'MODERATE'
    intervalRange = INTERVAL_RANGES.MODERATE
  } else {
    discoveryHint = 'COMPLEX'
    intervalRange = INTERVAL_RANGES.COMPLEX
  }

  const discoveryInterval = randomBetween(intervalRange.min, intervalRange.max)

  // Estimate market value based on speed figure and consistency
  const baseValue = (speedFigure - 40) * 2.5
  const consistencyBonus = consistencyScore * 0.5
  const estimatedValue = Math.round(baseValue + consistencyBonus)

  return {
    name: generateHorseName(),
    speedFigure,
    runningStyle,
    favoredDistance,
    surfacePreference,
    staminaRating,
    consistencyScore,
    peakAgeWindow,
    hiddenTalent,
    discoveryInterval,
    discoveryHint,
    estimatedValue,
  }
}

// ─── BREEDING GENERATION ─────────────────────────────────────────────────────

export interface ParentTraits {
  speedFigure: number
  runningStyle: RunningStyle
  favoredDistance?: FavoredDistance | null
  surfacePreference?: SurfaceType | null
  staminaRating?: number | null
  consistencyScore?: number | null
  peakAgeWindow?: string | null
  hiddenTalent?: string | null
  discoveryInterval: number
}

export interface BreedingResult {
  attributes: GeneratedHorseAttributes
  inheritanceLog: Record<string, string>
  mutationLog: Record<string, string>
}

export function breedHorse(sire: ParentTraits, dam: ParentTraits): BreedingResult {
  const inheritanceLog: Record<string, string> = {}
  const mutationLog: Record<string, string> = {}

  function inherit<T>(sireVal: T | null | undefined, damVal: T | null | undefined, traitName: string): T | undefined {
    if (!sireVal && !damVal) return undefined

    const roll = Math.random()
    const mutationRoll = Math.random()

    // 10% mutation chance — only applies to numeric traits
    if (mutationRoll < 0.10 && typeof sireVal === 'number' && typeof damVal === 'number') {
      const mutated = gaussianRandom((sireVal + damVal) / 2, 8)
      mutationLog[traitName] = `mutated to ${mutated} (parents: ${sireVal}, ${damVal})`
      return mutated as unknown as T
    }

    if (roll < 0.45 && sireVal != null) {
      inheritanceLog[traitName] = 'sire'
      return sireVal
    } else if (roll < 0.90 && damVal != null) {
      inheritanceLog[traitName] = 'dam'
      return damVal
    } else {
      // Blended — for numerics, average
      if (typeof sireVal === 'number' && typeof damVal === 'number') {
        const blended = Math.round((sireVal + damVal) / 2)
        inheritanceLog[traitName] = 'blended'
        return blended as unknown as T
      }
      inheritanceLog[traitName] = 'sire'
      return sireVal!
    }
  }

  const speedFigure = Math.round(
    (inherit(sire.speedFigure, dam.speedFigure, 'speedFigure') ?? 70)
  )

  const runningStyle = inherit(sire.runningStyle, dam.runningStyle, 'runningStyle') ?? weightedPick(STYLE_WEIGHTS)

  const favoredDistance = sire.favoredDistance || dam.favoredDistance
    ? inherit(sire.favoredDistance, dam.favoredDistance, 'favoredDistance') ?? weightedPick(DISTANCE_WEIGHTS)
    : weightedPick(DISTANCE_WEIGHTS)

  const surfacePreference = sire.surfacePreference || dam.surfacePreference
    ? inherit(sire.surfacePreference, dam.surfacePreference, 'surfacePreference') ?? weightedPick(SURFACE_WEIGHTS)
    : weightedPick(SURFACE_WEIGHTS)

  const staminaRating = sire.staminaRating || dam.staminaRating
    ? Math.max(20, Math.min(100, inherit(sire.staminaRating, dam.staminaRating, 'staminaRating') ?? 60))
    : randomBetween(40, 95)

  const consistencyScore = sire.consistencyScore || dam.consistencyScore
    ? Math.max(20, Math.min(100, inherit(sire.consistencyScore, dam.consistencyScore, 'consistencyScore') ?? 60))
    : randomBetween(30, 95)

  const peakAgeWindow = sire.peakAgeWindow || dam.peakAgeWindow
    ? inherit(sire.peakAgeWindow, dam.peakAgeWindow, 'peakAgeWindow') ?? '4–6'
    : (() => {
        const min = randomBetween(3, 5)
        return `${min}–${min + randomBetween(1, 3)}`
      })()

  // Hidden talent — 60% chance if either parent has it revealed
  let hiddenTalent = pickRandom(HIDDEN_TALENTS)
  if (sire.hiddenTalent && Math.random() < 0.60) {
    hiddenTalent = sire.hiddenTalent
    inheritanceLog['hiddenTalent'] = 'sire'
  } else if (dam.hiddenTalent && Math.random() < 0.60) {
    hiddenTalent = dam.hiddenTalent
    inheritanceLog['hiddenTalent'] = 'dam'
  }

  // Offspring discovery interval = dominant parent ±1
  const dominantInterval = sire.speedFigure >= dam.speedFigure ? sire.discoveryInterval : dam.discoveryInterval
  const intervalDelta = Math.random() < 0.5 ? -1 : 1
  const discoveryInterval = Math.max(3, Math.min(9, dominantInterval + intervalDelta))

  const discoveryHint: DiscoveryHint =
    discoveryInterval <= 4 ? 'STRAIGHTFORWARD' :
    discoveryInterval <= 6 ? 'MODERATE' : 'COMPLEX'

  const estimatedValue = Math.round((speedFigure - 40) * 2.5 + (consistencyScore ?? 60) * 0.5)

  return {
    attributes: {
      name: generateHorseName(),
      speedFigure,
      runningStyle,
      favoredDistance,
      surfacePreference,
      staminaRating,
      consistencyScore,
      peakAgeWindow: peakAgeWindow ?? '4–6',
      hiddenTalent,
      discoveryInterval,
      discoveryHint,
      estimatedValue,
    },
    inheritanceLog,
    mutationLog,
  }
}
