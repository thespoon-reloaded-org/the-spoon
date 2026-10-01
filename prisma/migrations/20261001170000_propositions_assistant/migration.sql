-- Assistant de recherche de l'accueil : les top 10 servis et le verdict du
-- dîneur (cœur plein / cœur brisé).
CREATE TYPE "VerdictProposition" AS ENUM ('AIME', 'AIME_PAS');

CREATE TABLE "PropositionAssistant" (
    "id" TEXT NOT NULL,
    "demande" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "restaurantIds" TEXT[],
    "verdict" "VerdictProposition",
    "verdictLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropositionAssistant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropositionAssistant_createdAt_idx" ON "PropositionAssistant"("createdAt");
