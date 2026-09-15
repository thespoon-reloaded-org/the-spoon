-- CreateEnum
CREATE TYPE "MotifContestation" AS ENUM ('NO_SHOW', 'ANNULATION_TARDIVE', 'COUVERTS_SURCOMPTES', 'DOUBLON', 'HORS_PLATEFORME', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutDossier" AS ENUM ('EN_ATTENTE_INSTRUCTION', 'CREDITE_OFFICE');

-- CreateTable
CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "restaurantContactId" TEXT NOT NULL,
    "commentaire" TEXT,
    "montantContesteCentimes" INTEGER NOT NULL,
    "seuilAppliqueCentimes" INTEGER NOT NULL,
    "statut" "StatutDossier" NOT NULL DEFAULT 'EN_ATTENTE_INSTRUCTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneContestee" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "ligneFactureId" TEXT NOT NULL,
    "motif" "MotifContestation" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LigneContestee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PieceJointeDossier" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "nomOriginal" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "tailleOctets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PieceJointeDossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigContestation" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "seuilCreditOfficeCentimes" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigContestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dossier_factureId_idx" ON "Dossier"("factureId");

-- CreateIndex
CREATE INDEX "Dossier_restaurantContactId_idx" ON "Dossier"("restaurantContactId");

-- CreateIndex
CREATE UNIQUE INDEX "LigneContestee_ligneFactureId_key" ON "LigneContestee"("ligneFactureId");

-- CreateIndex
CREATE INDEX "LigneContestee_dossierId_idx" ON "LigneContestee"("dossierId");

-- CreateIndex
CREATE INDEX "PieceJointeDossier_dossierId_idx" ON "PieceJointeDossier"("dossierId");

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_restaurantContactId_fkey" FOREIGN KEY ("restaurantContactId") REFERENCES "RestaurantContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneContestee" ADD CONSTRAINT "LigneContestee_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneContestee" ADD CONSTRAINT "LigneContestee_ligneFactureId_fkey" FOREIGN KEY ("ligneFactureId") REFERENCES "LigneFacture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceJointeDossier" ADD CONSTRAINT "PieceJointeDossier_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
