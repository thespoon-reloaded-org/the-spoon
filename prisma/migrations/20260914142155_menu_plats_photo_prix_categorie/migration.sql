-- CreateEnum
CREATE TYPE "CategoriePlat" AS ENUM ('ENTREE', 'PLAT', 'DESSERT');

-- AlterTable
ALTER TABLE "PlatCuillere" ADD COLUMN     "categorie" "CategoriePlat" NOT NULL DEFAULT 'PLAT',
ADD COLUMN     "photoMisAJourLe" TIMESTAMP(3),
ADD COLUMN     "prixCentimes" INTEGER NOT NULL DEFAULT 0;
