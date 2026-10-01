-- CreateEnum
CREATE TYPE "StatutDemandeRestaurateur" AS ENUM ('A_QUALIFIER', 'ACCEPTEE', 'REJETEE');

-- CreateEnum
CREATE TYPE "TypeEvenementDemandeRestaurateur" AS ENUM ('DEPOT', 'DECISION');

-- AlterTable
ALTER TABLE "DemandeContactRestaurateur" ADD COLUMN     "statut" "StatutDemandeRestaurateur" NOT NULL DEFAULT 'A_QUALIFIER';

-- CreateTable
CREATE TABLE "EvenementDemandeRestaurateur" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "type" "TypeEvenementDemandeRestaurateur" NOT NULL,
    "details" JSONB,
    "auteurStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvenementDemandeRestaurateur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvenementDemandeRestaurateur_demandeId_idx" ON "EvenementDemandeRestaurateur"("demandeId");

-- CreateIndex
CREATE INDEX "EvenementDemandeRestaurateur_auteurStaffId_idx" ON "EvenementDemandeRestaurateur"("auteurStaffId");

-- AddForeignKey
ALTER TABLE "EvenementDemandeRestaurateur" ADD CONSTRAINT "EvenementDemandeRestaurateur_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "DemandeContactRestaurateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvenementDemandeRestaurateur" ADD CONSTRAINT "EvenementDemandeRestaurateur_auteurStaffId_fkey" FOREIGN KEY ("auteurStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reconstitution du dépôt des demandes reçues avant cette migration.
--
-- Le journal d'une demande commence à son dépôt ; sans cette ligne, une
-- demande ancienne s'ouvrirait sur un journal vide alors que sa date de
-- dépôt est connue. Même logique que la reconstitution du journal des
-- dossiers (20260918131841_journal_evenements_dossier) : identifiant en
-- `gen_random_uuid()::text` (Prisma génère les cuid côté client) et INSERT
-- gardé par un NOT EXISTS, pour que rejouer ce fichier ne crée pas de doublon.
INSERT INTO "EvenementDemandeRestaurateur" ("id", "demandeId", "type", "auteurStaffId", "createdAt")
SELECT gen_random_uuid()::text, d."id", 'DEPOT', NULL, d."createdAt"
FROM "DemandeContactRestaurateur" d
WHERE NOT EXISTS (
    SELECT 1 FROM "EvenementDemandeRestaurateur" e
    WHERE e."demandeId" = d."id" AND e."type" = 'DEPOT'
);
