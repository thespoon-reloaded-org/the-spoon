-- CreateEnum
CREATE TYPE "CleFonctionnalite" AS ENUM ('ASSISTANT_RECHERCHE');

-- CreateEnum
CREATE TYPE "EvenementFormation" AS ENUM ('DEMANDES_REFERENCEMENT', 'RESERVATIONS', 'AVIS', 'CONTESTATIONS');

-- CreateTable
CREATE TABLE "Formateur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "onboardingVuLe" TIMESTAMP(3),

    CONSTRAINT "Formateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormateurSession" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FormateurSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormateurAccount" (
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

    CONSTRAINT "FormateurAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormateurVerification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormateurVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fonctionnalite" (
    "cle" "CleFonctionnalite" NOT NULL,
    "active" BOOLEAN NOT NULL,
    "modifieeLe" TIMESTAMP(3) NOT NULL,
    "modifieeParId" TEXT NOT NULL,

    CONSTRAINT "Fonctionnalite_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "JournalFormateur" (
    "id" TEXT NOT NULL,
    "formateurId" TEXT NOT NULL,
    "fonctionnalite" "CleFonctionnalite",
    "active" BOOLEAN,
    "evenement" "EvenementFormation",
    "quantiteDemandee" INTEGER,
    "quantiteCreee" INTEGER,
    "resume" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalFormateur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Formateur_email_key" ON "Formateur"("email");

-- CreateIndex
CREATE INDEX "FormateurSession_userId_idx" ON "FormateurSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FormateurSession_token_key" ON "FormateurSession"("token");

-- CreateIndex
CREATE INDEX "FormateurAccount_userId_idx" ON "FormateurAccount"("userId");

-- CreateIndex
CREATE INDEX "FormateurVerification_identifier_idx" ON "FormateurVerification"("identifier");

-- CreateIndex
CREATE INDEX "JournalFormateur_createdAt_idx" ON "JournalFormateur"("createdAt");

-- CreateIndex
CREATE INDEX "JournalFormateur_formateurId_idx" ON "JournalFormateur"("formateurId");

-- AddForeignKey
ALTER TABLE "FormateurSession" ADD CONSTRAINT "FormateurSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Formateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormateurAccount" ADD CONSTRAINT "FormateurAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Formateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fonctionnalite" ADD CONSTRAINT "Fonctionnalite_modifieeParId_fkey" FOREIGN KEY ("modifieeParId") REFERENCES "Formateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalFormateur" ADD CONSTRAINT "JournalFormateur_formateurId_fkey" FOREIGN KEY ("formateurId") REFERENCES "Formateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
