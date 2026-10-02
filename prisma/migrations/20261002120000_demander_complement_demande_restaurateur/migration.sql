-- AlterEnum
-- `INFOS_DEMANDEES` se place avant les issues terminales : une demande encore
-- ouverte peut être acceptée ou rejetée ensuite.
ALTER TYPE "StatutDemandeRestaurateur" ADD VALUE 'INFOS_DEMANDEES' BEFORE 'ACCEPTEE';

-- AlterEnum
-- `COMPLEMENT_DEMANDE` se place avant `DECISION` : l'ordre de déclaration de
-- l'enum sert à départager deux événements au même horodatage, du plus récent
-- au plus ancien (voir le commentaire du type dans schema.prisma).
ALTER TYPE "TypeEvenementDemandeRestaurateur" ADD VALUE 'COMPLEMENT_DEMANDE' BEFORE 'DECISION';
