-- Le dîneur qui ne peut plus annuler peut au moins prévenir.
--
-- Passé le délai du restaurant, l'annulation n'est plus possible — mais un
-- dîneur sans aucun moyen de dire "je ne viendrai pas" fabrique un no-show de
-- plus, exactement ce que le produit cherche à réduire. Cette colonne porte
-- ce signal et son horodatage. La réservation reste CONFIRMEE : c'est le
-- restaurant qui tranche honoré/no-show, ce signal ne décide rien à sa place.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "absencePrevenueLe" TIMESTAMP(3);
