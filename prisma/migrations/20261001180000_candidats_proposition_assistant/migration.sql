-- Assistant de recherche : les restaurants éligibles (renvoyés par les
-- recherches de l'agent) à côté de ceux finalement proposés, pour mesurer
-- l'exposition rapportée à l'éligibilité.
ALTER TABLE "PropositionAssistant" ADD COLUMN "candidatIds" TEXT[];
