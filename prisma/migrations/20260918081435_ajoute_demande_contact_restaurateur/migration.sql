-- CreateTable
CREATE TABLE "DemandeContactRestaurateur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "etablissement" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandeContactRestaurateur_pkey" PRIMARY KEY ("id")
);
