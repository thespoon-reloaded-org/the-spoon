-- AlterTable
ALTER TABLE "Dossier" ADD COLUMN     "instructeurId" TEXT,
ADD COLUMN     "priseEnChargeLe" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Dossier_instructeurId_idx" ON "Dossier"("instructeurId");

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_instructeurId_fkey" FOREIGN KEY ("instructeurId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
