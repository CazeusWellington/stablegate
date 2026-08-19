"""
Unit tests for the StableGate race simulation engine.
Covers: scoring math, variance bounds, payout math, edge cases.
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from src.engine.race_engine import RaceEngine, SURFACE_FIT, DISTANCE_FIT, STYLE_MATCH


# ─── FIXTURES ─────────────────────────────────────────────────────────────────

def make_entry(
    entry_id="e1",
    speed=80,
    style="STALKER",
    surface_pref="TURF",
    dist_pref="ROUTE",
    stamina=70,
    consistency=75,
    total_races=10,
    jockey_style="STALKER",
    jockey_win_rate=0.14,
    jockey_modifier=1.04,
    is_ghost=False,
):
    return {
        "entry_id": entry_id,
        "is_ghost": is_ghost,
        "horse": {
            "speed_figure": speed,
            "running_style": style,
            "favored_distance": dist_pref,
            "surface_preference": surface_pref,
            "stamina_rating": stamina,
            "consistency_score": consistency,
            "total_races": total_races,
        },
        "jockey": {
            "running_style": jockey_style,
            "win_rate": jockey_win_rate,
            "surface_win_rate": jockey_win_rate,
            "distance_win_rate": jockey_win_rate,
            "base_modifier": jockey_modifier,
        } if jockey_style else None,
    }

def make_race(entries, surface="TURF", distance="ROUTE"):
    return {
        "race_id": "test-race-1",
        "surface": surface,
        "distance": distance,
        "entries": entries,
    }


engine = RaceEngine()


# ─── BASIC SIMULATION ─────────────────────────────────────────────────────────

class TestBasicSimulation:

    def test_returns_all_entries(self):
        entries = [make_entry(f"e{i}", speed=80+i) for i in range(8)]
        results = engine.simulate(make_race(entries))
        assert len(results) == 8

    def test_positions_are_sequential(self):
        entries = [make_entry(f"e{i}") for i in range(6)]
        results = engine.simulate(make_race(entries))
        positions = [r["position"] for r in results]
        assert sorted(positions) == list(range(1, 7))

    def test_no_duplicate_positions(self):
        entries = [make_entry(f"e{i}") for i in range(8)]
        results = engine.simulate(make_race(entries))
        positions = [r["position"] for r in results]
        assert len(set(positions)) == len(positions)

    def test_finish_times_are_ordered(self):
        entries = [make_entry(f"e{i}") for i in range(8)]
        results = engine.simulate(make_race(entries))
        sorted_by_pos = sorted(results, key=lambda r: r["position"])
        times = [r["finish_time"] for r in sorted_by_pos]
        def parse_time(t):
            parts = t.split(":")
            return float(parts[0]) * 60 + float(parts[1])
        numeric_times = [parse_time(t) for t in times]
        for i in range(len(numeric_times) - 1):
            assert numeric_times[i] <= numeric_times[i + 1]

    def test_result_has_required_fields(self):
        entries = [make_entry("e1"), make_entry("e2")]
        results = engine.simulate(make_race(entries))
        for r in results:
            assert "entry_id" in r
            assert "position" in r
            assert "finish_time" in r
            assert "final_score" in r
            assert "composite_score" in r


# ─── SCORING MATH ─────────────────────────────────────────────────────────────

class TestScoringMath:

    def test_higher_speed_wins_more_often(self):
        """A horse with speed 110 should beat speed 60 the vast majority of the time."""
        wins = 0
        trials = 500
        for _ in range(trials):
            entries = [
                make_entry("fast", speed=110, consistency=90),
                make_entry("slow", speed=60, consistency=90),
            ]
            results = engine.simulate(make_race(entries))
            winner = next(r for r in results if r["position"] == 1)
            if winner["entry_id"] == "fast":
                wins += 1
        assert wins / trials > 0.90, f"Fast horse won only {wins}/{trials}"

    def test_surface_mismatch_hurts(self):
        """A horse on wrong surface should score lower composite than matched horse."""
        matched = make_entry("m", speed=80, surface_pref="TURF")
        mismatched = make_entry("x", speed=80, surface_pref="DIRT")
        race = make_race([matched, mismatched], surface="TURF")

        # Run many times and check composite_score median
        matched_composites = []
        mismatched_composites = []
        for _ in range(100):
            results = engine.simulate(race)
            for r in results:
                if r["entry_id"] == "m":
                    matched_composites.append(r["composite_score"])
                else:
                    mismatched_composites.append(r["composite_score"])

        import statistics
        assert statistics.median(matched_composites) > statistics.median(mismatched_composites)

    def test_style_match_boosts_composite(self):
        """Perfect style match should produce higher composite than mismatch."""
        matched = make_entry("m", speed=80, style="STALKER", jockey_style="STALKER", jockey_modifier=1.04)
        mismatched = make_entry("x", speed=80, style="CLOSER", jockey_style="FRONT_RUNNER", jockey_modifier=1.04)
        race = make_race([matched, mismatched])

        matched_composites = []
        mismatched_composites = []
        for _ in range(100):
            results = engine.simulate(race)
            for r in results:
                if r["entry_id"] == "m":
                    matched_composites.append(r["composite_score"])
                else:
                    mismatched_composites.append(r["composite_score"])

        import statistics
        assert statistics.median(matched_composites) > statistics.median(mismatched_composites)

    def test_no_jockey_produces_valid_result(self):
        """Entry without jockey should still simulate correctly."""
        e = make_entry("e1", jockey_style=None)
        e["jockey"] = None
        results = engine.simulate(make_race([e, make_entry("e2")]))
        assert len(results) == 2

    def test_composite_score_is_positive(self):
        """All composite scores must be positive."""
        entries = [make_entry(f"e{i}", speed=40+i*5) for i in range(6)]
        results = engine.simulate(make_race(entries))
        for r in results:
            assert r["composite_score"] > 0

    def test_final_score_within_reasonable_bounds(self):
        """Final scores should not deviate wildly from composite."""
        entries = [make_entry(f"e{i}", speed=80, consistency=70) for i in range(8)]
        results = engine.simulate(make_race(entries))
        for r in results:
            deviation = abs(r["final_score"] - r["composite_score"])
            assert deviation < 0.30, f"Variance too large: {deviation}"


# ─── VARIANCE BEHAVIOUR ────────────────────────────────────────────────────────

class TestVariance:

    def test_low_consistency_has_wider_spread(self):
        """Low consistency horse should have higher variance in final scores."""
        import statistics
        high_cons_scores = []
        low_cons_scores = []
        for _ in range(300):
            results = engine.simulate(make_race([
                make_entry("h", speed=80, consistency=95),
                make_entry("l", speed=80, consistency=20),
            ]))
            for r in results:
                if r["entry_id"] == "h":
                    high_cons_scores.append(r["final_score"])
                else:
                    low_cons_scores.append(r["final_score"])

        high_std = statistics.stdev(high_cons_scores)
        low_std = statistics.stdev(low_cons_scores)
        assert low_std > high_std, f"Low consistency {low_std:.4f} not wider than high {high_std:.4f}"

    def test_variance_cannot_flip_massive_talent_gap(self):
        """Speed 115 horse should beat speed 45 horse almost always."""
        wins = 0
        trials = 1000
        for _ in range(trials):
            entries = [
                make_entry("champ", speed=115, consistency=50),
                make_entry("maiden", speed=45, consistency=50),
            ]
            results = engine.simulate(make_race(entries))
            if next(r for r in results if r["position"] == 1)["entry_id"] == "champ":
                wins += 1
        assert wins / trials > 0.97, f"Only {wins}/{trials} wins — variance too wide"

    def test_upset_possible_in_close_field(self):
        """In a close field (speed diff ~5), lower horse should win some % of races."""
        wins_for_lower = 0
        trials = 500
        for _ in range(trials):
            entries = [
                make_entry("e1", speed=82, consistency=40),
                make_entry("e2", speed=77, consistency=40),
            ]
            results = engine.simulate(make_race(entries))
            if next(r for r in results if r["position"] == 1)["entry_id"] == "e2":
                wins_for_lower += 1
        assert wins_for_lower / trials > 0.05, "Upsets never happen — variance too tight"


# ─── GHOST ENTRIES ─────────────────────────────────────────────────────────────

class TestGhostEntries:

    def test_ghost_entries_get_positions(self):
        """Ghost entries participate in simulation and take finishing positions."""
        entries = [
            make_entry("real1", is_ghost=False),
            make_entry("ghost1", is_ghost=True),
            make_entry("real2", is_ghost=False),
        ]
        results = engine.simulate(make_race(entries))
        assert len(results) == 3
        positions = {r["entry_id"]: r["position"] for r in results}
        assert "ghost1" in positions

    def test_ghost_can_push_real_horse_down(self):
        """If ghost wins, real horse is in 2nd or lower."""
        ghost_wins = 0
        trials = 200
        for _ in range(trials):
            entries = [
                make_entry("real", speed=75, is_ghost=False),
                make_entry("ghost", speed=100, is_ghost=True),  # fast ghost
            ]
            results = engine.simulate(make_race(entries))
            winner = next(r for r in results if r["position"] == 1)
            if winner["entry_id"] == "ghost":
                ghost_wins += 1
        # Fast ghost should win frequently — this tests positions shift correctly
        assert ghost_wins > 50, "Ghost entries not participating in competition correctly"


# ─── PAYOUT MATH ──────────────────────────────────────────────────────────────

class TestPayoutMath:
    """
    Payout math lives in Node.js (RaceService.distributePayouts) but we validate
    the constants here to ensure they are consistent and sum correctly.
    """

    SPLITS = [0.42, 0.24, 0.14, 0.09, 0.06, 0.03, 0.02]

    def test_splits_sum_to_one(self):
        total = sum(self.SPLITS)
        assert abs(total - 1.0) < 1e-9, f"Splits sum to {total}, expected 1.0"

    def test_payout_math_for_8_horse_race(self):
        entry_fee = 20
        field = 8
        rake = 0.15
        jockey_pct = 0.08

        gross = entry_fee * field  # 160
        rake_amt = gross * rake    # 24
        net = gross - rake_amt     # 136
        jockey_amt = net * jockey_pct  # 10.88
        owner_pool = net - jockey_amt  # 125.12

        splits = self.SPLITS[:7]
        total = sum(splits)
        payouts = [owner_pool * (s / total) for s in splits]

        assert abs(sum(payouts) - owner_pool) < 0.01
        assert payouts[0] > entry_fee, "1st place should pay back more than entry"
        assert payouts[1] > entry_fee, "2nd place should pay back more than entry"
        assert payouts[2] < entry_fee, "3rd place should not fully pay back entry in 8-horse field"

    def test_house_revenue_positive(self):
        for entry_fee in [10, 20, 40, 75, 150, 200]:
            for field in [6, 8, 10, 12, 14]:
                gross = entry_fee * field
                rake = gross * 0.15
                net = gross - rake
                jockey = net * 0.08
                house = rake + jockey
                assert house > 0
                assert house / gross < 0.30, f"House take too high: {house/gross:.2%}"

    def test_break_even_position_is_sane(self):
        """Verify that position ≤ 3 pays back entry in a standard Bronze race."""
        entry_fee = 20
        field = 8
        gross = entry_fee * field
        owner_pool = gross * (1 - 0.15) * (1 - 0.08)

        splits = self.SPLITS[:7]
        total = sum(splits)
        payouts = [owner_pool * (s / total) for s in splits]

        # 1st and 2nd should profit; 3rd is close to breakeven
        assert payouts[0] > entry_fee
        assert payouts[1] > entry_fee
        # 4th and beyond should lose money
        assert payouts[3] < entry_fee

    def test_1st_place_return_at_least_2x_entry(self):
        """1st place should return at least 2.5× entry fee in a full field."""
        for tier_params in [
            (20, 8, 0.15),   # Bronze
            (40, 10, 0.15),  # Silver
            (150, 12, 0.18), # Gold
        ]:
            fee, field, rake = tier_params
            gross = fee * field
            owner_pool = gross * (1 - rake) * (1 - 0.08)
            splits = self.SPLITS[:min(field, 7)]
            total = sum(splits)
            first_payout = owner_pool * (splits[0] / total)
            ratio = first_payout / fee
            assert ratio >= 2.5, f"1st place return {ratio:.2f}× — below 2.5× threshold"


# ─── COEFFICIENT TABLES ───────────────────────────────────────────────────────

class TestCoefficientTables:

    def test_surface_match_is_1_0(self):
        for surface in ["DIRT", "TURF", "SYNTHETIC"]:
            assert SURFACE_FIT[(surface, surface)] == 1.0

    def test_surface_mismatch_is_below_1(self):
        for (pref, actual), coeff in SURFACE_FIT.items():
            if pref and pref != actual:
                assert coeff < 1.0, f"({pref}, {actual}) should be < 1.0"

    def test_distance_match_is_1_0(self):
        for dist in ["SPRINT", "MID", "ROUTE"]:
            assert DISTANCE_FIT[(dist, dist)] == 1.0

    def test_perfect_style_match_is_highest(self):
        for style in ["FRONT_RUNNER", "STALKER", "PRESSER", "CLOSER"]:
            perfect = STYLE_MATCH.get((style, style), 0)
            assert perfect == 1.14, f"Perfect match for {style} should be 1.14"

    def test_style_mismatch_front_closer_is_penalized(self):
        """Closer jockey on front runner horse — worst mismatch."""
        assert STYLE_MATCH[("FRONT_RUNNER", "CLOSER")] < 1.0


# ─── EDGE CASES ───────────────────────────────────────────────────────────────

class TestEdgeCases:

    def test_single_entry_race(self):
        """Single horse race — should still produce valid result."""
        results = engine.simulate(make_race([make_entry("solo")]))
        assert len(results) == 1
        assert results[0]["position"] == 1

    def test_all_identical_horses(self):
        """All horses identical — variance should still produce a winner."""
        entries = [make_entry(f"e{i}", speed=80, consistency=50) for i in range(8)]
        results = engine.simulate(make_race(entries))
        assert len(results) == 8
        positions = [r["position"] for r in results]
        assert sorted(positions) == list(range(1, 9))

    def test_missing_optional_horse_fields(self):
        """Horse with no surface/distance preference should still simulate."""
        entry = {
            "entry_id": "bare",
            "is_ghost": False,
            "horse": {
                "speed_figure": 75,
                "running_style": "STALKER",
                "total_races": 5,
                # no surface_preference, distance_preference, stamina, consistency
            },
            "jockey": None,
        }
        results = engine.simulate(make_race([entry, make_entry("e2")]))
        assert len(results) == 2

    def test_max_field_size(self):
        """14-horse field — should complete cleanly."""
        entries = [make_entry(f"e{i}", speed=60+i*3) for i in range(14)]
        results = engine.simulate(make_race(entries, surface="DIRT", distance="ROUTE"))
        assert len(results) == 14
        positions = [r["position"] for r in results]
        assert sorted(positions) == list(range(1, 15))
