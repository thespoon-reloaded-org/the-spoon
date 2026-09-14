-- CreateEnum
CREATE TYPE "ActionAuditRestaurant" AS ENUM ('CREATION', 'MODIFICATION');

-- AlterTable
ALTER TABLE "Staff" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "JournalAuditRestaurant" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "action" "ActionAuditRestaurant" NOT NULL,
    "champsModifies" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalAuditRestaurant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalAuditRestaurant_restaurantId_idx" ON "JournalAuditRestaurant"("restaurantId");

-- AddForeignKey
ALTER TABLE "JournalAuditRestaurant" ADD CONSTRAINT "JournalAuditRestaurant_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalAuditRestaurant" ADD CONSTRAINT "JournalAuditRestaurant_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
