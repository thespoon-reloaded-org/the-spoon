-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "photoMisAJourLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Staff" ALTER COLUMN "updatedAt" DROP DEFAULT;
