-- CreateTable
CREATE TABLE "Facture" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "mois" TIMESTAMP(3) NOT NULL,
    "montantTotalCentimes" INTEGER NOT NULL,
    "genereeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneFacture" (
    "id" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "couvertsFactures" INTEGER NOT NULL,
    "montantCentimes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LigneFacture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Facture_restaurantId_idx" ON "Facture"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "Facture_restaurantId_mois_key" ON "Facture"("restaurantId", "mois");

-- CreateIndex
CREATE UNIQUE INDEX "LigneFacture_bookingId_key" ON "LigneFacture"("bookingId");

-- CreateIndex
CREATE INDEX "LigneFacture_factureId_idx" ON "LigneFacture"("factureId");

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneFacture" ADD CONSTRAINT "LigneFacture_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneFacture" ADD CONSTRAINT "LigneFacture_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
