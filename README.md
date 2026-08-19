# StableGate — Backend

Simulated horse racing platform. Monorepo containing the Node.js API and Python simulation service.

## Architecture

```
stablegate/
├── apps/
│   ├── api/                  # Node.js + Fastify — REST + WebSocket API
│   │   ├── prisma/           # Database schema (PostgreSQL)
│   │   └── src/
│   │       ├── routes/       # auth, horses, races, jockeys, marketplace, breeding, payouts, admin
│   │       ├── services/     # horseGenerator, raceService, traitDiscovery
│   │       ├── jobs/         # BullMQ workers — simulation queue, race scheduler
│   │       ├── socket/       # Socket.io handlers
│   │       └── db/           # Prisma client, Redis client, seed
│   └── simulation/           # Python + FastAPI — race simulation engine
│       ├── src/
│       │   ├── engine/       # race_engine.py — the 8-step simulation algorithm
│       │   └── tests/        # pytest unit tests
│       └── scripts/
│           └── equibase_import.py   # ← Equibase integration point
└── packages/
    └── shared/               # Shared types (future)
```

## Quick start

### Prerequisites
- Node.js >= 20
- Python >= 3.11
- PostgreSQL
- Redis

### 1. Install dependencies

```bash
npm install
pip install -r apps/simulation/requirements.txt
```

### 2. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your database, Redis, Stripe, and Anthropic keys
```

### 3. Set up database

```bash
npm run db:migrate
npm run db:seed      # seeds 30 jockeys
```

### 4. Start services

```bash
# Terminal 1 — API
npm run dev:api

# Terminal 2 — Simulation service
cd apps/simulation
uvicorn src.main:app --reload --port 8001
```

### 5. Run tests

```bash
# API tests
npm run test:api

# Simulation engine tests (fast, no external deps)
cd apps/simulation
pytest src/tests/ -v
```

---

## Equibase Integration

The platform is designed to slot in real Equibase data with minimal changes. All placeholder data is clearly marked with `# [EQUIBASE]` comments.

### Files to update when licensed

| File | What changes |
|------|-------------|
| `apps/simulation/scripts/equibase_import.py` | Add API calls to fetch real data |
| `apps/simulation/src/engine/race_engine.py` | Replace `SURFACE_FIT`, `DISTANCE_FIT`, base times |
| `apps/api/src/db/seed.ts` | Replace jockey `winRate` with real historical stats |
| `apps/api/src/services/horseGenerator.ts` | Replace `SPEED_DISTRIBUTIONS` with Equibase Beyer distributions |

### Running the import script

```bash
# Set in apps/api/.env:
# EQUIBASE_API_KEY=your_key
# EQUIBASE_API_URL=https://api.equibase.com

cd apps/simulation
python scripts/equibase_import.py
```

The script writes calibrated JSON files to `apps/simulation/data/` which the engine reads at startup. No code changes needed after the first import — just re-run the script when you want to refresh the data.

---

## Railway Deployment

### API service
1. Connect GitHub repo to Railway
2. Add environment variables (copy from `.env.example`)
3. Add PostgreSQL and Redis plugins in Railway dashboard
4. Railway auto-detects Node.js and runs `npm run start`

### Simulation service
1. Create a second Railway service pointing at `apps/simulation/`
2. Set start command: `uvicorn src.main:app --host 0.0.0.0 --port $PORT`
3. Set `SIMULATION_SERVICE_URL` in the API service to point to this service's internal URL

### Environment variables (Railway)
```
DATABASE_URL         # auto-injected by Railway Postgres plugin
REDIS_URL            # auto-injected by Railway Redis plugin
JWT_SECRET           # generate with: openssl rand -hex 32
STRIPE_SECRET_KEY    # from Stripe dashboard
STRIPE_WEBHOOK_SECRET # from Stripe webhook settings
ANTHROPIC_API_KEY    # from Anthropic console
SIMULATION_SERVICE_URL # internal Railway URL for simulation service
```

---

## API Routes

### Auth
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/v1/auth/register | — | Register user |
| POST | /api/v1/auth/login | — | Login |
| GET | /api/v1/auth/me | ✓ | Current user |

### Horses
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/v1/horses | ✓ | My stable |
| GET | /api/v1/horses/:id | ✓ | Horse detail + trait state |
| POST | /api/v1/horses/purchase | ✓ | Buy from house |
| POST | /api/v1/horses/:id/trainer-unlock | ✓ | Reveal 2 traits ($150) |
| POST | /api/v1/horses/:id/training-session | ✓ | Log training ($30) |
| POST | /api/v1/horses/:id/sell-to-house | ✓ | House buyback |

### Races
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/v1/races | — | Race board |
| GET | /api/v1/races/:id | — | Race detail |
| POST | /api/v1/races/:id/enter | ✓ | Enter horse |
| POST | /api/v1/races/:id/bid | ✓ | Sealed jockey bid |
| POST | /api/v1/races/:id/pick-jockey | ✓ | Open pick jockey |
| GET | /api/v1/races/:id/payouts | — | Payout table estimate |

### Jockeys
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/v1/jockeys | — | Full roster |
| GET | /api/v1/jockeys/available/:raceId | — | Available for a race |
| GET | /api/v1/jockeys/:id | — | Jockey + career stats |

### Marketplace
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/v1/marketplace | — | Active listings |
| POST | /api/v1/marketplace/list | ✓ | List horse for sale |
| POST | /api/v1/marketplace/:id/buy | ✓ | Purchase horse |
| DELETE | /api/v1/marketplace/:id | ✓ | Cancel listing |

### Breeding
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/v1/breeding/breed | ✓ | Breed two retired horses |
| GET | /api/v1/breeding/estimate | ✓ | Fee preview |

### Payouts / Wallet
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/v1/payouts/transactions | ✓ | Wallet history |
| POST | /api/v1/payouts/deposit | ✓ | Create deposit payment intent |
| POST | /api/v1/payouts/stripe-webhook | — | Stripe webhook handler |

### Admin
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/v1/admin/stats | admin | Platform overview |
| POST | /api/v1/admin/races | admin | Manually create race |
| POST | /api/v1/admin/races/:id/force-simulate | admin | Force simulation |
| GET | /api/v1/admin/races/:id/audit | admin | Full audit log |
| GET | /api/v1/admin/users | admin | User list |
| POST | /api/v1/admin/users/:id/adjust-balance | admin | Manual balance adjustment |

---

## WebSocket Events

Connect to the Socket.io server and join rooms:

```javascript
socket.emit('race:join', raceId)   // get race updates
socket.emit('user:join', userId)   // get personal notifications
```

| Event | Direction | Payload |
|-------|-----------|---------|
| `race:fill_update` | server→client | `{ raceId, entryCount, maxField }` |
| `race:auction_opened` | server→client | `{ raceId, closesAt }` |
| `race:auction_resolved` | server→client | `{ raceId, results }` |
| `race:simulating` | server→client | `{ raceId }` |
| `race:completed` | server→client | `{ raceId, results, ownerPool }` |
| `horse:trait_unlocked` | server→client | `{ horseId, traitName, value }` |
| `user:notification` | server→client | `{ type, message, referenceId }` |
