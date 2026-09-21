-- Les horaires d'ouverture deviennent exploitables.
--
-- Jusqu'ici la fiche restaurant affichait un texte libre ("Mar-Sam 12h-14h,
-- 19h-22h30") pendant que la carte de réservation, juste à côté, proposait
-- les douze créneaux de `CRENEAUX_HORAIRES` sans jamais le lire — on pouvait
-- réserver 22h dans un restaurant fermant à 15h. `PlageOuverture` porte
-- désormais la seule version exploitable, affichée au dîneur *et* utilisée
-- pour décider des créneaux proposés.
--
-- Les deux reprises ci-dessous récupèrent ce qui existait, dans cet ordre :
-- le planning de fermetures réglé par un partenaire (plus récent, plus sûr),
-- puis le texte libre pour les restaurants auxquels personne n'avait touché.
-- Un restaurant dont rien n'est récupérable finit sans aucune plage : pas
-- d'horaires déclarés, tous les créneaux restent proposés comme aujourd'hui.

-- CreateTable
CREATE TABLE "PlageOuverture" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "jourSemaine" INTEGER NOT NULL,
    "debutMinutes" INTEGER NOT NULL,
    "finMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlageOuverture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlageOuverture_restaurantId_jourSemaine_idx" ON "PlageOuverture"("restaurantId", "jourSemaine");

-- AddForeignKey
ALTER TABLE "PlageOuverture" ADD CONSTRAINT "PlageOuverture_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise 1/2 — le planning de fermetures récurrentes (`HoraireFermeture`).
-- Les créneaux qu'il laissait ouverts sont regroupés en suites de créneaux
-- consécutifs (30 min d'écart), chaque suite devenant une plage refermée sur
-- la fin de son dernier créneau (13h30 réservable → service jusqu'à 14h).
WITH creneaux (minutes) AS (
    VALUES (720), (750), (780), (810), (1110), (1140), (1170), (1200), (1230), (1260), (1290), (1320)
),
restaurants AS (
    SELECT DISTINCT h."restaurantId"
    FROM "HoraireFermeture" h
    WHERE NOT EXISTS (SELECT 1 FROM "PlageOuverture" p WHERE p."restaurantId" = h."restaurantId")
),
ouverts AS (
    SELECT r."restaurantId", j."jourSemaine", c.minutes
    FROM restaurants r
    CROSS JOIN generate_series(0, 6) AS j("jourSemaine")
    CROSS JOIN creneaux c
    WHERE NOT EXISTS (
        SELECT 1
        FROM "HoraireFermeture" h
        WHERE h."restaurantId" = r."restaurantId"
          AND h."jourSemaine" = j."jourSemaine"
          AND (
            h.creneau IS NULL
            OR h.creneau = lpad((c.minutes / 60)::text, 2, '0') || ':' || lpad((c.minutes % 60)::text, 2, '0')
          )
    )
),
debuts AS (
    SELECT
        "restaurantId",
        "jourSemaine",
        minutes,
        CASE
            WHEN minutes - lag(minutes) OVER (PARTITION BY "restaurantId", "jourSemaine" ORDER BY minutes) = 30
            THEN 0
            ELSE 1
        END AS ouvre_une_plage
    FROM ouverts
),
suites AS (
    SELECT
        "restaurantId",
        "jourSemaine",
        minutes,
        sum(ouvre_une_plage) OVER (PARTITION BY "restaurantId", "jourSemaine" ORDER BY minutes) AS plage
    FROM debuts
)
INSERT INTO "PlageOuverture" ("id", "restaurantId", "jourSemaine", "debutMinutes", "finMinutes")
SELECT gen_random_uuid()::text, "restaurantId", "jourSemaine", min(minutes), max(minutes) + 30
FROM suites
GROUP BY "restaurantId", "jourSemaine", plage;

-- Reprise 2/2 — le champ texte libre `Restaurant.horaires`, seule trace des
-- vrais horaires pour les restaurants dont personne n'a réglé le planning.
-- Format écrit par les fiches existantes : "Mar-Sam 12h-14h, 19h-22h30",
-- soit une plage de jours suivie d'un ou plusieurs services. Un texte d'une
-- autre forme ne correspond à rien ici et laisse simplement le restaurant
-- sans horaires déclarés.
WITH jours (abrev, "jourSemaine") AS (
    VALUES ('lun', 0), ('mar', 1), ('mer', 2), ('jeu', 3), ('ven', 4), ('sam', 5), ('dim', 6)
),
sources AS (
    SELECT
        r.id,
        lower(substring(r.horaires from '^([A-Za-z]{3})')) AS jour_debut,
        lower(substring(r.horaires from '^[A-Za-z]{3}\s*-\s*([A-Za-z]{3})')) AS jour_fin,
        r.horaires
    FROM "Restaurant" r
    WHERE r.horaires IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "PlageOuverture" p WHERE p."restaurantId" = r.id)
      -- Un restaurant dont un partenaire avait réglé le planning a déjà été
      -- traité ci-dessus, y compris s'il avait tout fermé : le texte libre,
      -- plus ancien, n'a pas à le rouvrir.
      AND NOT EXISTS (SELECT 1 FROM "HoraireFermeture" h WHERE h."restaurantId" = r.id)
),
services AS (
    SELECT s.id, s.jour_debut, s.jour_fin, bornes
    FROM sources s
    CROSS JOIN LATERAL regexp_matches(s.horaires, '(\d{1,2})h(\d{2})?\s*-\s*(\d{1,2})h(\d{2})?', 'g') AS bornes
)
INSERT INTO "PlageOuverture" ("id", "restaurantId", "jourSemaine", "debutMinutes", "finMinutes")
SELECT
    gen_random_uuid()::text,
    s.id,
    j."jourSemaine",
    s.bornes[1]::int * 60 + coalesce(s.bornes[2], '0')::int,
    s.bornes[3]::int * 60 + coalesce(s.bornes[4], '0')::int
FROM services s
JOIN jours premier ON premier.abrev = s.jour_debut
JOIN jours dernier ON dernier.abrev = s.jour_fin
JOIN jours j ON CASE
    WHEN premier."jourSemaine" <= dernier."jourSemaine"
    THEN j."jourSemaine" BETWEEN premier."jourSemaine" AND dernier."jourSemaine"
    ELSE j."jourSemaine" >= premier."jourSemaine" OR j."jourSemaine" <= dernier."jourSemaine"
END;

-- Garde-fou avant la suppression du texte libre : si un restaurant avait des
-- horaires écrits sous une forme qu'aucune des deux reprises n'a su lire, les
-- perdre en silence remettrait sa fiche à "horaires non communiqués" et
-- rouvrirait tous ses créneaux sans que personne ne le voie. On préfère
-- arrêter la migration et nommer les fiches concernées : rien n'est appliqué
-- (Prisma joue chaque migration dans une transaction), le texte est encore
-- là, il suffit de le corriger ou de compléter la reprise avant de rejouer.
-- Un restaurant dont un partenaire avait réglé le planning ne compte pas :
-- la reprise 1 a parlé pour lui, y compris quand elle dit "tout fermé".
DO $$
DECLARE perdus text;
BEGIN
    SELECT string_agg(format('%s (%s)', r.nom, r.horaires), ', ')
    INTO perdus
    FROM "Restaurant" r
    WHERE r.horaires IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "PlageOuverture" p WHERE p."restaurantId" = r.id)
      AND NOT EXISTS (SELECT 1 FROM "HoraireFermeture" h WHERE h."restaurantId" = r.id);

    IF perdus IS NOT NULL THEN
        RAISE EXCEPTION 'Horaires non repris, migration interrompue : %', perdus;
    END IF;
END $$;

-- DropForeignKey
ALTER TABLE "HoraireFermeture" DROP CONSTRAINT "HoraireFermeture_restaurantId_fkey";

-- DropTable
DROP TABLE "HoraireFermeture";

-- AlterTable
ALTER TABLE "Restaurant" DROP COLUMN "horaires";
