"""
Equibase Data Import Script
===========================
This script is the ONLY file that needs to change when Equibase
licensing is in place. It reads from the Equibase API and writes
calibrated coefficient files that the race engine reads at startup.

HOW TO USE:
1. Set EQUIBASE_API_KEY and EQUIBASE_API_URL in your .env
2. Run: python scripts/equibase_import.py
3. The generated coefficients replace the placeholder values in race_engine.py

The script produces:
  - data/surface_fit.json    — surface performance coefficients
  - data/distance_fit.json   — distance performance coefficients
  - data/jockey_stats.json   — per-jockey historical win rates by surface/distance
  - data/speed_distributions.json — Beyer speed figure distributions by horse tier
"""
import os
import json
import requests
from pathlib import Path

EQUIBASE_API_KEY = os.getenv("EQUIBASE_API_KEY", "")
EQUIBASE_API_URL = os.getenv("EQUIBASE_API_URL", "")

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def fetch_jockey_stats(jockey_id: str) -> dict:
    """
    Fetch career statistics for a jockey from Equibase.
    Returns win rates broken down by surface and distance.
    """
    if not EQUIBASE_API_KEY:
        raise EnvironmentError("EQUIBASE_API_KEY not set")

    response = requests.get(
        f"{EQUIBASE_API_URL}/jockeys/{jockey_id}/stats",
        headers={"Authorization": f"Bearer {EQUIBASE_API_KEY}"},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def fetch_surface_coefficients() -> dict:
    """
    Derive surface performance coefficients from historical Equibase data.
    Compares win rates of horses racing on preferred vs non-preferred surface.
    """
    # TODO: Query Equibase for historical results grouped by horse_surface_pref vs race_surface
    # Expected output format:
    # {
    #   "DIRT_DIRT": 1.00,
    #   "DIRT_TURF": 0.87,
    #   ...
    # }
    print("[EQUIBASE] Fetching surface coefficients...")
    print("[EQUIBASE] Not yet licensed — using placeholder values")
    return {}


def fetch_speed_distributions() -> dict:
    """
    Derive Beyer speed figure distributions by horse performance tier.
    Used to calibrate AI horse generation.
    """
    # TODO: Query Equibase for speed figure distributions across race classes
    print("[EQUIBASE] Fetching speed figure distributions...")
    print("[EQUIBASE] Not yet licensed — using placeholder values")
    return {}


def fetch_all_jockey_stats(jockey_name_list: list[str]) -> dict:
    """
    Bulk fetch jockey stats. Maps jockey name → career statistics.
    """
    print(f"[EQUIBASE] Would fetch stats for {len(jockey_name_list)} jockeys")
    print("[EQUIBASE] Not yet licensed — seed data uses placeholder win rates")
    return {}


def write_calibrated_files(surface_data: dict, speed_data: dict, jockey_data: dict):
    """Write calibrated data files for the race engine to consume."""
    if surface_data:
        with open(DATA_DIR / "surface_fit.json", "w") as f:
            json.dump(surface_data, f, indent=2)
        print(f"[EQUIBASE] Wrote surface_fit.json")

    if speed_data:
        with open(DATA_DIR / "speed_distributions.json", "w") as f:
            json.dump(speed_data, f, indent=2)
        print(f"[EQUIBASE] Wrote speed_distributions.json")

    if jockey_data:
        with open(DATA_DIR / "jockey_stats.json", "w") as f:
            json.dump(jockey_data, f, indent=2)
        print(f"[EQUIBASE] Wrote jockey_stats.json")


if __name__ == "__main__":
    print("=" * 60)
    print("StableGate — Equibase Import Script")
    print("=" * 60)

    if not EQUIBASE_API_KEY:
        print("\n[NOTE] EQUIBASE_API_KEY not set.")
        print("When licensed, add your API key to .env and re-run.")
        print("The race engine currently uses statistically-grounded")
        print("placeholder coefficients that can be replaced here.\n")
        print("Files to update when licensed:")
        print("  1. This script (equibase_import.py)")
        print("  2. src/engine/race_engine.py — SURFACE_FIT, DISTANCE_FIT, base times")
        print("  3. src/db/seed.ts — jockey win rates")
        print("  4. src/services/horseGenerator.ts — speed distributions")
        exit(0)

    surface_data = fetch_surface_coefficients()
    speed_data = fetch_speed_distributions()
    jockey_data = {}  # fetch per jockey when needed

    write_calibrated_files(surface_data, speed_data, jockey_data)
    print("\nEquibase import complete.")
