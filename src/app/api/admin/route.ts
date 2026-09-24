import { repondre, routeAdmin } from "@/lib/api-admin/reponses";

/**
 * Sommaire de l'API d'administration — de quoi s'y retrouver sans ouvrir le
 * code. Le détail des champs est dans le README (« API d'administration »).
 */
export const GET = routeAdmin(async () =>
  repondre({
    api: "TheSpoon — administration",
    authentification: "Authorization: Bearer <ADMIN_API_TOKEN>",
    regle:
      "Un appel est tout-ou-rien ; les POST acceptent un objet ou une liste et rendent toujours une liste.",
    routes: [
      {
        methode: "GET",
        chemin: "/api/admin/restaurants",
        role: "Restaurants et leurs contacts (ids à réutiliser)",
      },
      {
        methode: "POST",
        chemin: "/api/admin/restaurants",
        role: "Restaurants, avec carte, horaires et contacts",
      },
      {
        methode: "POST",
        chemin: "/api/admin/restaurants/{id}/contacts",
        role: "Contacts d'un restaurant existant",
      },
      { methode: "POST", chemin: "/api/admin/dineurs", role: "Comptes dîneur" },
      {
        methode: "POST",
        chemin: "/api/admin/staff",
        role: "Membres du staff, datés (instructeurs d'historique)",
      },
      {
        methode: "POST",
        chemin: "/api/admin/reservations",
        role: "Réservations, passées ou futures, avec leur statut",
      },
      {
        methode: "POST",
        chemin: "/api/admin/avis",
        role: "Avis de dîneurs servis, note recalculée",
      },
      {
        methode: "GET",
        chemin: "/api/admin/factures?mois=AAAA-MM",
        role: "Factures d'un mois et leurs lignes",
      },
      {
        methode: "POST",
        chemin: "/api/admin/factures",
        role: "Génère les factures d'un mois { mois }",
      },
      {
        methode: "POST",
        chemin: "/api/admin/dossiers",
        role: "Dépose une contestation et rejoue son instruction (etapes)",
      },
    ],
  }),
);
