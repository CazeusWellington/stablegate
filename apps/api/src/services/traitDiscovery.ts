import { Horse, FavoredDistance, SurfaceType, RunningStyle } from '@prisma/client'

// Trait unlock order — fixed sequence for every horse
const TRAIT_SEQUENCE = [
  'speedFigure',       // 1 — always revealed
  'runningStyle',      // 2 — always revealed
  'favoredDistance',   // 3 — first hidden
  'surfacePreference', // 4
  'staminaRating',     // 5
  'consistencyScore',  // 6
  'peakAgeWindow',     // 7
  'hiddenTalent',      // 8
]

export interface RevealedTrait {
  traitName: string
  value: string | number | null
}

export interface TraitState {
  speedFigure: { known: boolean; value: number | null }
  runningStyle: { known: boolean; value: RunningStyle | null }
  favoredDistance: { known: boolean; value: FavoredDistance | null; unlockAtRace: number }
  surfacePreference: { known: boolean; value: SurfaceType | null; unlockAtRace: number }
  staminaRating: { known: boolean; value: number | null; unlockAtRace: number }
  consistencyScore: { known: boolean; value: number | null; unlockAtRace: number }
  peakAgeWindow: { known: boolean; value: string | null; unlockAtRace: number }
  hiddenTalent: { known: boolean; value: string | null; unlockAtRace: number }
}

export class TraitDiscoveryService {

  // Build the current visible trait state for a horse
  static buildTraitState(horse: Horse): TraitState {
    const interval = horse.discoveryInterval
    const discovered = horse.traitsDiscovered

    return {
      speedFigure: { known: true, value: horse.speedFigure },
      runningStyle: { known: true, value: horse.runningStyle },
      favoredDistance: {
        known: discovered >= 3,
        value: discovered >= 3 ? horse.favoredDistance : null,
        unlockAtRace: interval * 1,
      },
      surfacePreference: {
        known: discovered >= 4,
        value: discovered >= 4 ? horse.surfacePreference : null,
        unlockAtRace: interval * 2,
      },
      staminaRating: {
        known: discovered >= 5,
        value: discovered >= 5 ? horse.staminaRating : null,
        unlockAtRace: interval * 3,
      },
      consistencyScore: {
        known: discovered >= 6,
        value: discovered >= 6 ? horse.consistencyScore : null,
        unlockAtRace: interval * 4,
      },
      peakAgeWindow: {
        known: discovered >= 7,
        value: discovered >= 7 ? horse.peakAgeWindow : null,
        unlockAtRace: interval * 5,
      },
      hiddenTalent: {
        known: discovered >= 8,
        value: discovered >= 8 ? horse.hiddenTalent : null,
        unlockAtRace: interval * 6,
      },
    }
  }

  // Check if a race earns discovery bonus
  static calculateBonus(
    horse: Horse,
    jockeyStyle: RunningStyle | null,
    raceSurface: SurfaceType,
    raceDistance: FavoredDistance
  ): { bonusRaces: number; reason: string[] } {
    const reasons: string[] = []
    let bonus = 0

    // Style match — compare horse running style vs jockey style
    if (jockeyStyle && horse.runningStyle === jockeyStyle) {
      bonus++
      reasons.push('style match')
    }

    // Surface match — check against horse's ACTUAL preferred surface (hidden or not)
    // This rewards educated guesses even before the trait is revealed
    if (horse.surfacePreference && raceSurface === horse.surfacePreference) {
      bonus++
      reasons.push('surface match')
    }

    // Distance match — same logic
    if (horse.favoredDistance && raceDistance === horse.favoredDistance) {
      bonus++
      reasons.push('distance match')
    }

    return { bonusRaces: Math.min(bonus, 3), reason: reasons }
  }

  // Process trait unlock after a race
  // Returns array of newly revealed traits
  static async checkAndReveal(
    horse: Horse,
    effectiveRaceCount: number // totalRaces after applying bonus
  ): Promise<RevealedTrait[]> {
    const interval = horse.discoveryInterval
    const currentlyDiscovered = horse.traitsDiscovered
    const revealed: RevealedTrait[] = []

    // Work out which traits unlock at which race counts
    const unlockThresholds = [
      { trait: 'favoredDistance',   threshold: interval * 1, index: 3 },
      { trait: 'surfacePreference', threshold: interval * 2, index: 4 },
      { trait: 'staminaRating',     threshold: interval * 3, index: 5 },
      { trait: 'consistencyScore',  threshold: interval * 4, index: 6 },
      { trait: 'peakAgeWindow',     threshold: interval * 5, index: 7 },
      { trait: 'hiddenTalent',      threshold: interval * 6, index: 8 },
    ]

    for (const { trait, threshold, index } of unlockThresholds) {
      if (currentlyDiscovered < index && effectiveRaceCount >= threshold) {
        const value = (horse as any)[trait]
        if (value !== null && value !== undefined) {
          revealed.push({ traitName: trait, value })
        }
      }
    }

    return revealed
  }

  // Trainer unlock — reveal next 2 hidden traits immediately
  static async trainerUnlock(horse: Horse): Promise<RevealedTrait[]> {
    const hiddenTraits = [
      { name: 'favoredDistance',   index: 3, value: horse.favoredDistance },
      { name: 'surfacePreference', index: 4, value: horse.surfacePreference },
      { name: 'staminaRating',     index: 5, value: horse.staminaRating },
      { name: 'consistencyScore',  index: 6, value: horse.consistencyScore },
      { name: 'peakAgeWindow',     index: 7, value: horse.peakAgeWindow },
      { name: 'hiddenTalent',      index: 8, value: horse.hiddenTalent },
    ].filter(t => t.index > horse.traitsDiscovered && t.value !== null)

    const toReveal = hiddenTraits.slice(0, 2)
    return toReveal.map(t => ({ traitName: t.name, value: t.value }))
  }

  // Build Prisma update payload from revealed traits
  static buildUpdateFromRevealed(revealed: RevealedTrait[], horse: Horse): Record<string, any> {
    const update: Record<string, any> = {}
    // Traits are already stored — we just track the discovery count
    // The actual values are stored at horse creation; discovery = permission to display
    return update
  }
}
