-- Trace du passage dans l'onboarding, une par population.
--
-- Trois parcours distincts (dîneur, restaurateur, staff), trois tables de
-- personnes déjà séparées par leurs trois instances better-auth : la trace
-- suit le même découpage plutôt qu'une table transverse qui n'aurait pu
-- porter de clé étrangère vers aucune des trois.
--
-- Une date, pas un booléen : « quand » se relit, « vrai » ne dit rien. `null`
-- veut dire jamais vu — l'onboarding s'ouvre alors tout seul à l'arrivée.
-- Tout le monde est à `null` au départ, y compris les comptes existants :
-- c'est voulu, personne n'a encore vu ces écrans.

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "onboardingVuLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RestaurantContact" ADD COLUMN     "onboardingVuLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "onboardingVuLe" TIMESTAMP(3);
