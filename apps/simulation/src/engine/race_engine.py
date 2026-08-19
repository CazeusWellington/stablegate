"""
StableGate Race Simulation Engine
8-step algorithm producing statistically grounded race results.

EQUIBASE INTEGRATION POINTS are marked with # [EQUIBASE] comments.
When Equibase data is licensed, replace the placeholder coefficient
tables with values derived from historical data.
"""


# ─── SURFACE FIT COEFFICIENTS ─────────────────────────────────────────────────
# How much a horse's preferred surface vs actual race surface matters.
# [EQUIBASE] Replace with coefficients derived from historical surface splits.
SURFACE_FIT = {
    ("DIRT", "DIRT"):         1.00,
    ("TURF", "TURF"):         1.00,
    ("SYNTHETIC", "SYNTHETIC"): 1.00,
    ("DIRT", "TURF"):         0.88,
    ("DIRT", "SYNTHETIC"):    0.92,
    ("TURF", "DIRT"):         0.87,
    ("TURF", "SYNTHETIC"):    0.90,
    ("SYNTHETIC", "DIRT"):    0.91,
    ("SYNTHETIC", "TURF"):    0.89,
    (None, "DIRT"):           0.95,  # unknown preference — slight penalty
    (None, "TURF"):           0.95,
    (None, "SYNTHETIC"):      0.95,
}

# ─── DISTANCE FIT COEFFICIENTS ────────────────────────────────────────────────
# [EQUIBASE] Replace with coefficients from historical distance performance data.
DISTANCE_FIT = {
    ("SPRINT", "SPRINT"): 1.00,
    ("MID", "MID"):       1.00,
    ("ROUTE", "ROUTE"):   1.00,
    ("SPRINT", "MID"):    0.93,
    ("SPRINT", "ROUTE"):  0.86,
    ("MID", "SPRINT"):    0.92,
    ("MID", "ROUTE"):     0.94,
    ("ROUTE", "SPRINT"):  0.85,
    ("ROUTE", "MID"):     0.93,
    (None, "SPRINT"):     0.95,
    (None, "MID"):        0.95,
    (None, "ROUTE"):      0.95,
}

# ─── STYLE MATCH MODIFIERS ────────────────────────────────────────────────────
# Horse running style vs jockey riding style.
# [EQUIBASE] These can be calibrated from historical jockey-horse style pairing data.
STYLE_MATCH = {
    ("FRONT_RUNNER", "FRONT_RUNNER"): 1.14,
    ("STALKER",      "STALKER"):      1.14,
    ("PRESSER",      "PRESSER"):      1.14,
    ("CLOSER",       "CLOSER"):       1.14,
    ("STALKER",      "FRONT_RUNNER"): 1.07,
    ("STALKER",      "PRESSER"):      1.07,
    ("PRESSER",      "FRONT_RUNNER"): 1.05,
    ("PRESSER",      "STALKER"):      1.06,
    ("CLOSER",       "STALKER"):      1.04,
    ("CLOSER",       "PRESSER"):      1.02,
    ("FRONT_RUNNER", "STALKER"):      0.96,
    ("FRONT_RUNNER", "PRESSER"):      0.95,
    ("FRONT_RUNNER", "CLOSER"):       0.94,
    ("CLOSER",       "FRONT_RUNNER"): 0.95,
}

# Field size pace modifier — larger fields change pace dynamics
FIELD_SIZE_MODIFIER = {
    4:  1.02, 5:  1.01, 6:  1.00, 7:  0.99, 8:  0.99,
    9:  0.98, 10: 0.98, 11: 0.97, 12: 0.97, 13: 0.96, 14: 0.96,
}

# Career fatigue curve (optional — disabled by default per product decision)
# Set USE_CAREER_FATIGUE = True to enable
USE_CAREER_FATIGUE = False
FATIGUE_ONSET_RACE = 40  # starts after race 40
FATIGUE_MAX_PENALTY = 0.04  # max 4% reduction at race 50


def career_fatigue_modifier(total_races: int) -> float:
    if not USE_CAREER_FATIGUE or total_races < FATIGUE_ONSET_RACE:
        return 1.0
    progress = (total_races - FATIGUE_ONSET_RACE) / (50 - FATIGUE_ONSET_RACE)
    return 1.0 - (progress * FATIGUE_MAX_PENALTY)


class RaceEngine:

    def simulate(self, payload: dict) -> list[dict]:
        """
        Run the full 8-step race simulation.
        Returns a list of result dicts sorted by finishing position.
        """
        surface = payload["surface"]
        distance = payload["distance"]
        entries = payload["entries"]
        field_size = len(entries)

        scored = []

        for entry in entries:
            horse = entry["horse"]
            jockey = entry.get("jockey")
            entry_id = entry["entry_id"]
            is_ghost = entry.get("is_ghost", False)

            # ── Step 1: Base score ──────────────────────────────────────────
            speed_fig = horse["speed_figure"]
            speed_normalized = speed_fig / 120.0  # normalize to 0–1

            horse_surface_pref = horse.get("surface_preference")
            surface_coeff = SURFACE_FIT.get(
                (horse_surface_pref, surface),
                SURFACE_FIT.get((None, surface), 0.95)
            )

            horse_dist_pref = horse.get("favored_distance")
            distance_coeff = DISTANCE_FIT.get(
                (horse_dist_pref, distance),
                DISTANCE_FIT.get((None, distance), 0.95)
            )

            base_score = speed_normalized * surface_coeff * distance_coeff

            # ── Step 2: Jockey modifier ─────────────────────────────────────
            jockey_modifier = 1.0
            style_modifier = 1.0

            if jockey:
                horse_style = horse.get("running_style")
                jockey_style = jockey.get("running_style")

                # Base jockey modifier from stats
                # [EQUIBASE] win_rate and surface_win_rate will be enriched
                # from real Equibase jockey historical data
                jockey_modifier = jockey.get("base_modifier", 1.0)

                # Surface-specific adjustment
                surface_wr = jockey.get("surface_win_rate", jockey.get("win_rate", 0.10))
                distance_wr = jockey.get("distance_win_rate", jockey.get("win_rate", 0.10))

                # Blend base modifier with surface/distance performance
                jockey_modifier = jockey_modifier * 0.7 + (surface_wr + distance_wr) * 1.5

                # Style match
                if horse_style and jockey_style:
                    style_modifier = STYLE_MATCH.get(
                        (horse_style, jockey_style),
                        0.98  # slight mismatch default
                    )

            # ── Step 3: Condition modifier ──────────────────────────────────
            field_modifier = FIELD_SIZE_MODIFIER.get(field_size, 0.97)

            # Career fatigue (optional)
            fatigue_mod = career_fatigue_modifier(horse.get("total_races", 0))

            # ── Composite score (pre-variance) ──────────────────────────────
            composite = (
                base_score
                * jockey_modifier
                * style_modifier
                * field_modifier
                * fatigue_mod
            )

            # ── Step 4: Variance injection ──────────────────────────────────
            # consistency_score controls the width of the distribution
            # 100 = very tight, 1 = very wide
            consistency = horse.get("consistency_score") or 65
            noise_scale = (1.0 - (consistency / 100.0)) * 0.15 + 0.02

            # Weighted draw from normal distribution
            noise = np.random.normal(0, noise_scale)

            # Cap variance so it can't fully override a dominant talent gap
            max_noise = noise_scale * 2.5
            noise = max(min(noise, max_noise), -max_noise)

            final_score = composite + noise

            scored.append({
                "entry_id": entry_id,
                "is_ghost": is_ghost,
                "speed_figure": speed_fig,
                "composite_score": round(composite, 6),
                "final_score": round(final_score, 6),
                "debug": {
                    "base_score": round(base_score, 4),
                    "surface_coeff": surface_coeff,
                    "distance_coeff": distance_coeff,
                    "jockey_modifier": round(jockey_modifier, 4),
                    "style_modifier": style_modifier,
                    "field_modifier": field_modifier,
                    "fatigue_mod": round(fatigue_mod, 4),
                    "noise": round(noise, 4),
                }
            })

        # ── Step 5: Field ranking ───────────────────────────────────────────
        scored.sort(key=lambda x: x["final_score"], reverse=True)

        # ── Steps 6–8: Assign positions and finish times ────────────────────
        results = []
        base_time_seconds = self._base_time(distance)
        cumulative_gap = 0.0

        for position, entry in enumerate(scored, start=1):
            # Cumulative gap ensures monotonically increasing finish times
            if position > 1:
                cumulative_gap += random.uniform(0.15, 0.45)
            finish_seconds = base_time_seconds + cumulative_gap
            finish_time = self._format_time(finish_seconds)

            results.append({
                "entry_id": entry["entry_id"],
                "position": position,
                "is_ghost": entry["is_ghost"],
                "finish_time": finish_time,
                "final_score": entry["final_score"],
                "composite_score": entry["composite_score"],
                "debug": entry["debug"],
            })

        return results

    def _base_time(self, distance: str) -> float:
        """Approximate base finish time in seconds by distance."""
        # [EQUIBASE] Replace with actual median finish times from historical data
        return {
            "SPRINT": 70.0,   # ~6f — approx 1:10
            "MID":    85.0,   # ~7–8f — approx 1:25
            "ROUTE":  100.0,  # ~1m+ — approx 1:40
        }.get(distance, 85.0)

    def _format_time(self, seconds: float) -> str:
        """Format seconds as M:SS.s"""
        minutes = int(seconds // 60)
        secs = seconds % 60
        return f"{minutes}:{secs:04.1f}"
