-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."StatutReservation" ADD VALUE 'HONOREE';
ALTER TYPE "public"."StatutReservation" ADD VALUE 'NO_SHOW';

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "signaleeLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Restaurant" ADD COLUMN     "delaiAnnulationHeures" INTEGER;

-- CreateTable
CREATE TABLE "public"."ExceptionHoraire" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "jour" TEXT NOT NULL,
    "creneau" TEXT NOT NULL,
    "ouvert" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExceptionHoraire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HoraireFermeture" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "jourSemaine" INTEGER NOT NULL,
    "creneau" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoraireFermeture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExceptionHoraire_restaurantId_jour_creneau_key" ON "public"."ExceptionHoraire"("restaurantId" ASC, "jour" ASC, "creneau" ASC);

-- CreateIndex
CREATE INDEX "ExceptionHoraire_restaurantId_jour_idx" ON "public"."ExceptionHoraire"("restaurantId" ASC, "jour" ASC);

-- CreateIndex
CREATE INDEX "HoraireFermeture_restaurantId_jourSemaine_idx" ON "public"."HoraireFermeture"("restaurantId" ASC, "jourSemaine" ASC);

-- AddForeignKey
ALTER TABLE "public"."ExceptionHoraire" ADD CONSTRAINT "ExceptionHoraire_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HoraireFermeture" ADD CONSTRAINT "HoraireFermeture_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

