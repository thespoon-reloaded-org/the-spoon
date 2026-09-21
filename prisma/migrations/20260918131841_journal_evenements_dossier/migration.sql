-- CreateEnum
CREATE TYPE "TypeEvenementDossier" AS ENUM ('DEPOT', 'PRISE_EN_CHARGE', 'COMPLEMENT_DEMANDE', 'DECISION', 'AVOIR_EMIS');

-- CreateTable
CREATE TABLE "EvenementDossier" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "type" "TypeEvenementDossier" NOT NULL,
    "details" JSONB,
    "auteurStaffId" TEXT,
    "interne" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvenementDossier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvenementDossier_dossierId_idx" ON "EvenementDossier"("dossierId");

-- CreateIndex
CREATE INDEX "EvenementDossier_auteurStaffId_idx" ON "EvenementDossier"("auteurStaffId");

-- AddForeignKey
ALTER TABLE "EvenementDossier" ADD CONSTRAINT "EvenementDossier_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvenementDossier" ADD CONSTRAINT "EvenementDossier_auteurStaffId_fkey" FOREIGN KEY ("auteurStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reconstitution du journal des dossiers déposés avant cette migration.
--
-- Tout ce qui suit est déductible de l'état existant : date de dépôt, prise en
-- charge, demande de complément, décisions et avoirs sont déjà horodatés. Un
-- journal qui ne commencerait qu'aujourd'hui laisserait les dossiers en cours
-- sans début, et c'est justement le début (le délai d'attente) qu'on cherche à
-- mesurer.
--
-- Deux approximations assumées, impossibles à lever a posteriori : l'auteur
-- d'une demande de complément est supposé être l'instructeur assigné (c'est la
-- seule personne qui pouvait la faire), et une seule demande est reconstituée
-- par dossier — le dossier n'en garde que la dernière, c'est précisément ce
-- que ce journal corrige pour la suite.
--
-- Identifiants en `gen_random_uuid()::text` (Prisma génère les cuid côté
-- client) et chaque INSERT gardé par un NOT EXISTS : rejouer ce fichier ne
-- crée pas de doublon.
INSERT INTO "EvenementDossier" ("id", "dossierId", "type", "details", "auteurStaffId", "interne", "createdAt")
SELECT
    gen_random_uuid()::text,
    d."id",
    'DEPOT',
    jsonb_build_object(
        'montantContesteCentimes', d."montantContesteCentimes",
        'nbLignes', (SELECT count(*) FROM "LigneContestee" l WHERE l."dossierId" = d."id")
    ),
    NULL,
    false,
    d."createdAt"
FROM "Dossier" d
WHERE NOT EXISTS (
    SELECT 1 FROM "EvenementDossier" e WHERE e."dossierId" = d."id" AND e."type" = 'DEPOT'
);

INSERT INTO "EvenementDossier" ("id", "dossierId", "type", "details", "auteurStaffId", "interne", "createdAt")
SELECT gen_random_uuid()::text, d."id", 'PRISE_EN_CHARGE', NULL, d."instructeurId", true, d."priseEnChargeLe"
FROM "Dossier" d
WHERE d."priseEnChargeLe" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "EvenementDossier" e WHERE e."dossierId" = d."id" AND e."type" = 'PRISE_EN_CHARGE'
);

INSERT INTO "EvenementDossier" ("id", "dossierId", "type", "details", "auteurStaffId", "interne", "createdAt")
SELECT
    gen_random_uuid()::text,
    d."id",
    'COMPLEMENT_DEMANDE',
    jsonb_build_object('message', d."complementDemandeMessage"),
    d."instructeurId",
    false,
    d."complementDemandeLe"
FROM "Dossier" d
WHERE d."complementDemandeLe" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "EvenementDossier" e WHERE e."dossierId" = d."id" AND e."type" = 'COMPLEMENT_DEMANDE'
);

INSERT INTO "EvenementDossier" ("id", "dossierId", "type", "details", "auteurStaffId", "interne", "createdAt")
SELECT
    gen_random_uuid()::text,
    decision."dossierId",
    'DECISION',
    jsonb_build_object(
        'issue', decision."issue",
        'montantAccordeCentimes', decision."montantAccordeCentimes",
        'imputation', decision."imputation"
    ),
    decision."decideParId",
    decision."issue" = 'ESCALADE',
    decision."createdAt"
FROM "DecisionDossier" decision
WHERE NOT EXISTS (
    SELECT 1 FROM "EvenementDossier" e
    WHERE e."dossierId" = decision."dossierId"
      AND e."type" = 'DECISION'
      AND e."createdAt" = decision."createdAt"
);

INSERT INTO "EvenementDossier" ("id", "dossierId", "type", "details", "auteurStaffId", "interne", "createdAt")
SELECT
    gen_random_uuid()::text,
    decision."dossierId",
    'AVOIR_EMIS',
    jsonb_build_object('montantCentimes', avoir."montantCentimes"),
    decision."decideParId",
    false,
    avoir."emisLe"
FROM "Avoir" avoir
JOIN "DecisionDossier" decision ON decision."id" = avoir."decisionId"
WHERE NOT EXISTS (
    SELECT 1 FROM "EvenementDossier" e
    WHERE e."dossierId" = decision."dossierId"
      AND e."type" = 'AVOIR_EMIS'
      AND e."createdAt" = avoir."emisLe"
);
