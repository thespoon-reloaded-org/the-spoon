-- CreateEnum
CREATE TYPE "IssueDecision" AS ENUM ('ACCORDE', 'PARTIEL', 'REFUSE', 'ESCALADE');

-- CreateEnum
CREATE TYPE "ImputationLitige" AS ENUM ('RESTAURANT', 'THESPOON', 'CLIENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatutDossier" ADD VALUE 'ESCALADE';
ALTER TYPE "StatutDossier" ADD VALUE 'CLOTURE';

-- CreateTable
CREATE TABLE "DecisionDossier" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "issue" "IssueDecision" NOT NULL,
    "montantAccordeCentimes" INTEGER NOT NULL,
    "imputation" "ImputationLitige",
    "motif" TEXT NOT NULL,
    "decideParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionDossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avoir" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "montantCentimes" INTEGER NOT NULL,
    "emisLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avoir_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisionDossier_dossierId_idx" ON "DecisionDossier"("dossierId");

-- CreateIndex
CREATE INDEX "DecisionDossier_decideParId_idx" ON "DecisionDossier"("decideParId");

-- CreateIndex
CREATE UNIQUE INDEX "Avoir_decisionId_key" ON "Avoir"("decisionId");

-- CreateIndex
CREATE INDEX "Avoir_factureId_idx" ON "Avoir"("factureId");

-- AddForeignKey
ALTER TABLE "DecisionDossier" ADD CONSTRAINT "DecisionDossier_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionDossier" ADD CONSTRAINT "DecisionDossier_decideParId_fkey" FOREIGN KEY ("decideParId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avoir" ADD CONSTRAINT "Avoir_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "DecisionDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avoir" ADD CONSTRAINT "Avoir_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des dossiers déjà crédités d'office avant cette migration.
--
-- Jusqu'ici, "crédité d'office" ne créditait rien : le dossier passait au
-- statut CREDITE_OFFICE et s'arrêtait là. Maintenant que l'avoir existe, la
-- règle est que tout dossier crédité en porte un — y compris ceux déposés
-- avant. On leur écrit donc la décision automatique correspondante et son
-- avoir, antidatés à la date de dépôt du dossier (c'est à ce moment-là que la
-- règle de seuil a tranché, pas aujourd'hui).
--
-- `gen_random_uuid()::text` plutôt qu'un cuid : Prisma génère les identifiants
-- côté client, pas côté base. La colonne est du texte, la forme importe peu —
-- ces quelques lignes de rattrapage porteront un uuid là où le reste porte un
-- cuid. Les deux INSERT sont gardés par un NOT EXISTS : rejouer ce fichier ne
-- crée pas de doublon.
INSERT INTO "DecisionDossier" (
    "id", "dossierId", "issue", "montantAccordeCentimes", "imputation", "motif", "decideParId", "createdAt"
)
SELECT
    gen_random_uuid()::text,
    d."id",
    'ACCORDE',
    d."montantContesteCentimes",
    'THESPOON',
    'Crédit d''office : montant contesté sous le seuil d''instruction.',
    NULL,
    d."createdAt"
FROM "Dossier" d
WHERE d."statut" = 'CREDITE_OFFICE'
  AND NOT EXISTS (SELECT 1 FROM "DecisionDossier" existante WHERE existante."dossierId" = d."id");

INSERT INTO "Avoir" ("id", "decisionId", "factureId", "montantCentimes", "emisLe")
SELECT
    gen_random_uuid()::text,
    decision."id",
    dossier."factureId",
    decision."montantAccordeCentimes",
    decision."createdAt"
FROM "DecisionDossier" decision
JOIN "Dossier" dossier ON dossier."id" = decision."dossierId"
WHERE decision."montantAccordeCentimes" > 0
  AND NOT EXISTS (SELECT 1 FROM "Avoir" existant WHERE existant."decisionId" = decision."id");
