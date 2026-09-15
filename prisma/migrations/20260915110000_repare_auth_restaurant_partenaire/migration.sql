-- Répare un écart entre le schéma attendu et la vraie base de prod (Neon) :
-- la table RestaurantContact existait déjà mais sans emailVerified/image/
-- updatedAt, et RestaurantContactSession/Account/Verification n'existaient
-- pas du tout — la migration d'origine (20260914000000_init) ne s'était
-- jamais appliquée entièrement sur cette base, alors que _prisma_migrations
-- la marquait comme appliquée. Résultat : toute connexion restaurant
-- partenaire échouait en prod avec une erreur Prisma P2022
-- ("RestaurantContact.emailVerified does not exist"), invisible en local/CI
-- où la base était correcte depuis le début.
--
-- Entièrement idempotent (IF NOT EXISTS / DO $$ ... EXCEPTION) : ne modifie
-- ni ne supprime aucune donnée existante, et ne fait rien sur une base déjà
-- à jour (local, CI, tout environnement qui a la migration init complète).

-- AlterTable
ALTER TABLE "RestaurantContact"
  ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "image" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RestaurantContactSession" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RestaurantContactSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RestaurantContactAccount" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantContactAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RestaurantContactVerification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantContactVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RestaurantContactSession_userId_idx" ON "RestaurantContactSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantContactSession_token_key" ON "RestaurantContactSession"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RestaurantContactAccount_userId_idx" ON "RestaurantContactAccount"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RestaurantContactVerification_identifier_idx" ON "RestaurantContactVerification"("identifier");

-- AddForeignKey (pas de IF NOT EXISTS pour les contraintes — on ignore l'erreur si elle existe déjà)
DO $$ BEGIN
    ALTER TABLE "RestaurantContactSession" ADD CONSTRAINT "RestaurantContactSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RestaurantContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "RestaurantContactAccount" ADD CONSTRAINT "RestaurantContactAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RestaurantContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
