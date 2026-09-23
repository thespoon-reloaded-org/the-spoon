-- CreateEnum
CREATE TYPE "Allergene" AS ENUM ('GLUTEN', 'CRUSTACES', 'OEUFS', 'POISSONS', 'ARACHIDES', 'SOJA', 'LAIT', 'FRUITS_A_COQUE', 'CELERI', 'MOUTARDE', 'SESAME', 'SULFITES', 'LUPIN', 'MOLLUSQUES');

-- AlterTable
-- `allergenes` part à vide et `allergenesDeclaresLe` à NULL sur toute la carte
-- existante : "non renseigné", pas "sans allergène". Aucun plat déjà en base
-- n'a été déclaré par qui que ce soit, et un défaut rassurant serait un
-- mensonge affiché au dîneur.
ALTER TABLE "PlatCuillere" ADD COLUMN     "allergenes" "Allergene"[],
ADD COLUMN     "allergenesDeclaresLe" TIMESTAMP(3);
