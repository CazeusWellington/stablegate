-- CreateEnum
CREATE TYPE "HorseStatus" AS ENUM ('ACTIVE', 'RETIRED', 'FOAL', 'BREEDING_LOCKED');

-- CreateEnum
CREATE TYPE "HorseSource" AS ENUM ('AI_GENERATED', 'BRED', 'EQUIBASE_SEEDED');

-- CreateEnum
CREATE TYPE "RunningStyle" AS ENUM ('FRONT_RUNNER', 'STALKER', 'PRESSER', 'CLOSER');

-- CreateEnum
CREATE TYPE "SurfaceType" AS ENUM ('DIRT', 'TURF', 'SYNTHETIC');

-- CreateEnum
CREATE TYPE "FavoredDistance" AS ENUM ('SPRINT', 'MID', 'ROUTE');

-- CreateEnum
CREATE TYPE "DiscoveryHint" AS ENUM ('STRAIGHTFORWARD', 'MODERATE', 'COMPLEX');

-- CreateEnum
CREATE TYPE "RaceTier" AS ENUM ('FREE', 'BRONZE', 'SILVER', 'GOLD', 'CLASSIC');

-- CreateEnum
CREATE TYPE "RaceStatus" AS ENUM ('OPEN', 'FILLING', 'AUCTION', 'LOCKED', 'SIMULATING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JockeyTier" AS ENUM ('ROOKIE', 'BUDGET', 'MID', 'TOP', 'ELITE');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "JockeyAcquiredVia" AS ENUM ('AUCTION', 'OPEN_PICK');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BreedingStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'RACE_ENTRY_FEE', 'RACE_PAYOUT', 'RACE_ENTRY_REFUND', 'TRAINER_UNLOCK', 'TRAINING_SESSION', 'BREEDING_FEE', 'MARKETPLACE_SALE', 'MARKETPLACE_PURCHASE', 'HORSE_BUYBACK', 'NEW_HORSE_PURCHASE', 'HOUSE_RAKE', 'JOCKEY_FEE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "DiscoveryMethod" AS ENUM ('RACE_INTERVAL', 'BONUS_INTERVAL', 'TRAINER_UNLOCK', 'BIRTH_REVEALED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "walletBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "auctionSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "auctionWins" INTEGER NOT NULL DEFAULT 0,
    "auctionTotal" INTEGER NOT NULL DEFAULT 0,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Horse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "HorseStatus" NOT NULL DEFAULT 'ACTIVE',
    "speedFigure" INTEGER NOT NULL,
    "runningStyle" "RunningStyle" NOT NULL,
    "favoredDistance" "FavoredDistance",
    "surfacePreference" "SurfaceType",
    "staminaRating" INTEGER,
    "consistencyScore" INTEGER,
    "peakAgeWindow" TEXT,
    "hiddenTalent" TEXT,
    "discoveryInterval" INTEGER NOT NULL,
    "discoveryHint" "DiscoveryHint" NOT NULL,
    "traitsDiscovered" INTEGER NOT NULL DEFAULT 2,
    "trainerUnlocksUsed" INTEGER NOT NULL DEFAULT 0,
    "totalRaces" INTEGER NOT NULL DEFAULT 0,
    "paidRaces" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estimatedValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sireId" TEXT,
    "damId" TEXT,
    "sourceType" "HorseSource" NOT NULL DEFAULT 'AI_GENERATED',
    "equibaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Horse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jockey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "JockeyTier" NOT NULL,
    "runningStyle" "RunningStyle" NOT NULL,
    "careerRaces" INTEGER NOT NULL DEFAULT 0,
    "careerWins" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "top3Rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "styleMatchWinRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dirtWinRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "turfWinRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "syntheticWinRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sprintWinRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "routeWinRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "earningsPerMount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "compositeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimumPct" DOUBLE PRECISION NOT NULL,
    "baseModifier" DOUBLE PRECISION NOT NULL,
    "styleIsLocked" BOOLEAN NOT NULL DEFAULT false,
    "seasonsAtCurrentTier" INTEGER NOT NULL DEFAULT 0,
    "consecutivePromoSeasons" INTEGER NOT NULL DEFAULT 0,
    "consecutiveDemoSeasons" INTEGER NOT NULL DEFAULT 0,
    "equibaseJockeyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jockey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JockeySeasonRecord" (
    "id" TEXT NOT NULL,
    "jockeyId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "races" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "top3Rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "earnings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tierAtStart" "JockeyTier" NOT NULL,
    "tierAtEnd" "JockeyTier",
    "wasPromoted" BOOLEAN NOT NULL DEFAULT false,
    "wasRelegated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JockeySeasonRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "RaceTier" NOT NULL,
    "status" "RaceStatus" NOT NULL DEFAULT 'OPEN',
    "surface" "SurfaceType" NOT NULL,
    "distance" "FavoredDistance" NOT NULL,
    "fieldSize" INTEGER NOT NULL,
    "minFieldSize" INTEGER NOT NULL DEFAULT 4,
    "entryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "houseRakePct" DOUBLE PRECISION NOT NULL,
    "jockeyPct" DOUBLE PRECISION NOT NULL,
    "guaranteedPurse" DECIMAL(10,2),
    "actualPurse" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ownerPool" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "houseRevenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "auctionWindowSecs" INTEGER NOT NULL DEFAULT 600,
    "auctionOpensAt" TIMESTAMP(3),
    "auctionClosesAt" TIMESTAMP(3),
    "simulationJobId" TEXT,
    "simulationInputs" JSONB,
    "simulationOutputs" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceEntry" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jockeyId" TEXT,
    "isGhostEntry" BOOLEAN NOT NULL DEFAULT false,
    "jockeyPct" DOUBLE PRECISION,
    "jockeyAcquiredVia" "JockeyAcquiredVia",
    "finishPosition" INTEGER,
    "finishTime" TEXT,
    "payout" DECIMAL(10,2),
    "jockeyFee" DECIMAL(10,2),
    "netPayout" DECIMAL(10,2),
    "compositeScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION,
    "entryFeePaid" DECIMAL(10,2) NOT NULL,
    "entryFeeRefunded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JockeyBid" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "jockeyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bidPct" DOUBLE PRECISION NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "tieBreakRoll" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JockeyBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraitDiscoveryEvent" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "raceEntryId" TEXT,
    "traitName" TEXT NOT NULL,
    "traitValue" TEXT NOT NULL,
    "discoveredVia" "DiscoveryMethod" NOT NULL,
    "racesAtUnlock" INTEGER NOT NULL,
    "bonusApplied" BOOLEAN NOT NULL DEFAULT false,
    "bonusReason" TEXT,
    "trainerUnlock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraitDiscoveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingRecord" (
    "id" TEXT NOT NULL,
    "sireId" TEXT NOT NULL,
    "damId" TEXT NOT NULL,
    "offspringId" TEXT,
    "ownerId" TEXT NOT NULL,
    "breedingFee" DECIMAL(10,2) NOT NULL,
    "inheritanceLog" JSONB NOT NULL,
    "mutationLog" JSONB NOT NULL,
    "status" "BreedingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BreedingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "askingPrice" DECIMAL(10,2) NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePurchase" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "salePrice" DECIMAL(10,2) NOT NULL,
    "houseCut" DECIMAL(10,2) NOT NULL,
    "sellerReceives" DECIMAL(10,2) NOT NULL,
    "stripePaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balanceBefore" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "stripePaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "Horse_ownerId_idx" ON "Horse"("ownerId");

-- CreateIndex
CREATE INDEX "Horse_status_idx" ON "Horse"("status");

-- CreateIndex
CREATE INDEX "Jockey_tier_idx" ON "Jockey"("tier");

-- CreateIndex
CREATE INDEX "Jockey_compositeScore_idx" ON "Jockey"("compositeScore");

-- CreateIndex
CREATE UNIQUE INDEX "JockeySeasonRecord_jockeyId_seasonNumber_key" ON "JockeySeasonRecord"("jockeyId", "seasonNumber");

-- CreateIndex
CREATE INDEX "Race_status_idx" ON "Race"("status");

-- CreateIndex
CREATE INDEX "Race_tier_idx" ON "Race"("tier");

-- CreateIndex
CREATE INDEX "Race_scheduledAt_idx" ON "Race"("scheduledAt");

-- CreateIndex
CREATE INDEX "RaceEntry_raceId_idx" ON "RaceEntry"("raceId");

-- CreateIndex
CREATE INDEX "RaceEntry_horseId_idx" ON "RaceEntry"("horseId");

-- CreateIndex
CREATE INDEX "RaceEntry_userId_idx" ON "RaceEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RaceEntry_raceId_horseId_key" ON "RaceEntry"("raceId", "horseId");

-- CreateIndex
CREATE INDEX "JockeyBid_raceId_jockeyId_idx" ON "JockeyBid"("raceId", "jockeyId");

-- CreateIndex
CREATE UNIQUE INDEX "JockeyBid_raceId_jockeyId_userId_key" ON "JockeyBid"("raceId", "jockeyId", "userId");

-- CreateIndex
CREATE INDEX "TraitDiscoveryEvent_horseId_idx" ON "TraitDiscoveryEvent"("horseId");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingRecord_offspringId_key" ON "BreedingRecord"("offspringId");

-- CreateIndex
CREATE INDEX "BreedingRecord_ownerId_idx" ON "BreedingRecord"("ownerId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_idx" ON "MarketplaceListing"("status");

-- CreateIndex
CREATE INDEX "MarketplaceListing_horseId_idx" ON "MarketplaceListing"("horseId");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_idx" ON "WalletTransaction"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Horse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Horse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JockeySeasonRecord" ADD CONSTRAINT "JockeySeasonRecord_jockeyId_fkey" FOREIGN KEY ("jockeyId") REFERENCES "Jockey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceEntry" ADD CONSTRAINT "RaceEntry_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceEntry" ADD CONSTRAINT "RaceEntry_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceEntry" ADD CONSTRAINT "RaceEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceEntry" ADD CONSTRAINT "RaceEntry_jockeyId_fkey" FOREIGN KEY ("jockeyId") REFERENCES "Jockey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JockeyBid" ADD CONSTRAINT "JockeyBid_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JockeyBid" ADD CONSTRAINT "JockeyBid_jockeyId_fkey" FOREIGN KEY ("jockeyId") REFERENCES "Jockey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JockeyBid" ADD CONSTRAINT "JockeyBid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitDiscoveryEvent" ADD CONSTRAINT "TraitDiscoveryEvent_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePurchase" ADD CONSTRAINT "MarketplacePurchase_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePurchase" ADD CONSTRAINT "MarketplacePurchase_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
