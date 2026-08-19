from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from .engine.race_engine import RaceEngine

app = FastAPI(title="StableGate Simulation Service", version="1.0.0")
engine = RaceEngine()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/simulate")
def simulate_race(payload: dict):
    results = engine.simulate(payload)
    return {"results": results}
