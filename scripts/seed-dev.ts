import "dotenv/config";

import { hashPassword } from "better-auth/crypto";

import { nouveauCompteCredential } from "../src/lib/comptes";
import { prisma } from "../src/lib/prisma";

/** Mot de passe des contacts restaurant et du staff seedés — uniquement pour le dev local. */
const MOT_DE_PASSE_CONTACT_DEV = "password123";

/**
 * Une poignée de vrais restaurants, pour avoir quelque chose à chercher en
 * dev — pas un jeu de données volumineux et anonyme (voir README, "produit
 * et écrans d'abord"). Chacun a de quoi peupler tous les écrans qui en
 * dépendent : plusieurs plats (entrée/plat/dessert) pour "Ma carte" et la
 * fiche publique, et pour certains un ou deux contacts pour l'espace
 * restaurant. Quelques établissements sont volontairement laissés sans
 * contact : c'est l'état vide affiché sur la fiche admin
 * (`/admin/restaurants/[id]`), et le cas d'usage direct du bouton "Ajouter
 * un contact" qui y vit.
 */
const restaurants = [
  {
    nom: "Chez Antoine",
    ville: "Lyon",
    cuisine: "Bouchon lyonnais",
    adresse: "12 rue Mercière, 69002 Lyon",
    ouverture: "Mar-Sam 12h-14h, 19h-22h30",
    description: "Quenelles et gratin dauphinois, service en salle depuis 1987.",
    capacite: 40,
    noteCuilleres: 4.3,
    nombreAvis: 128,
    plats: [
      { nom: "Salade lyonnaise", description: "Lardons, œuf poché, croûtons.", categorie: "ENTREE" as const, prixCentimes: 950 },
      { nom: "Gratin dauphinois", description: "Crémeux, cuit trois heures.", categorie: "PLAT" as const, prixCentimes: 1650 },
      { nom: "Tarte aux pralines", description: "Praline rose de la Maison Voisin.", categorie: "DESSERT" as const, prixCentimes: 850 },
    ],
    contacts: [
      { nom: "Antoine Dubreuil", email: "antoine@chez-antoine.example", role: "GERANT" as const },
    ],
  },
  {
    nom: "Miso Bar",
    ville: "Lyon",
    cuisine: "Japonais",
    adresse: "5 quai Saint-Vincent, 69001 Lyon",
    ouverture: "Lun-Dim 11h30-14h30, 18h30-23h",
    description: "Comptoir de 12 places, ramen maison et izakaya le soir.",
    capacite: 24,
    noteCuilleres: 4.7,
    nombreAvis: 64,
    plats: [
      { nom: "Gyoza", description: "Porc et chou, sauce ponzu.", categorie: "ENTREE" as const, prixCentimes: 750 },
      { nom: "Ramen tonkotsu", description: "Bouillon os de porc 18h, œuf mollet.", categorie: "PLAT" as const, prixCentimes: 1450 },
      { nom: "Mochi glacé", description: "Thé vert, sésame noir.", categorie: "DESSERT" as const, prixCentimes: 650 },
    ],
    contacts: [{ nom: "Haruto Sato", email: "haruto@miso-bar.example", role: "GERANT" as const }],
  },
  {
    nom: "Le Petit Marché",
    ville: "Paris",
    cuisine: "Bistrot",
    adresse: "9 rue de Bretagne, 75003 Paris",
    description: null,
    capacite: 30,
    noteCuilleres: null,
    nombreAvis: 0,
    plats: [
      { nom: "Œuf mayonnaise", description: null, categorie: "ENTREE" as const, prixCentimes: 700 },
      { nom: "Pot-au-feu", description: null, categorie: "PLAT" as const, prixCentimes: 1800 },
      { nom: "Île flottante", description: null, categorie: "DESSERT" as const, prixCentimes: 750 },
    ],
    contacts: [
      { nom: "Camille Roy", email: "camille@petit-marche.example", role: "CHEF_DE_SALLE" as const },
    ],
  },
  {
    nom: "Trattoria Bellini",
    ville: "Paris",
    cuisine: "Italien",
    adresse: "18 rue Oberkampf, 75011 Paris",
    ouverture: "Lun-Sam 12h-14h30, 19h-23h30",
    description: "Pâtes fraîches faites sur place, carte de vins italiens.",
    capacite: 45,
    noteCuilleres: 4.8,
    nombreAvis: 212,
    plats: [
      { nom: "Burrata", description: "Tomates anciennes, basilic, huile d'olive toscane.", categorie: "ENTREE" as const, prixCentimes: 1200 },
      { nom: "Risotto aux cèpes", description: "Riz carnaroli, cèpes séchés, parmesan 24 mois.", categorie: "PLAT" as const, prixCentimes: 2200 },
      { nom: "Tiramisu", description: "Recette de la nonna, mascarpone maison.", categorie: "DESSERT" as const, prixCentimes: 800 },
    ],
  },
  {
    nom: "Racines Vertes",
    ville: "Paris",
    cuisine: "Végé",
    adresse: "22 rue du Faubourg Saint-Denis, 75010 Paris",
    ouverture: "Mar-Dim 12h-14h30, 19h-22h",
    description: "Cuisine végétale de saison, tout est fait maison.",
    capacite: 28,
    noteCuilleres: 4.6,
    nombreAvis: 97,
    plats: [
      { nom: "Velouté de potimarron", description: "Noisettes torréfiées, huile de courge.", categorie: "ENTREE" as const, prixCentimes: 950 },
      { nom: "Bourguignon de seitan", description: "Champignons de Paris, vin rouge, purée maison.", categorie: "PLAT" as const, prixCentimes: 1750 },
      { nom: "Crumble pommes-poires", description: "Amandes, cannelle.", categorie: "DESSERT" as const, prixCentimes: 700 },
    ],
  },
  {
    nom: "Beyrouth Café",
    ville: "Paris",
    cuisine: "Libanais",
    adresse: "7 rue de Turenne, 75003 Paris",
    ouverture: "Lun-Sam 12h-15h, 18h30-23h",
    description: "Mezzés à partager, grande table pour les groupes.",
    capacite: 36,
    noteCuilleres: 4.5,
    nombreAvis: 73,
    plats: [
      { nom: "Chorba libanaise", description: "Soupe de lentilles corail, citron confit.", categorie: "ENTREE" as const, prixCentimes: 850 },
      { nom: "Moussaka libanaise", description: "Aubergines, pois chiches, tomate.", categorie: "PLAT" as const, prixCentimes: 1600 },
      { nom: "Baklava", description: "Pistaches, sirop de fleur d'oranger.", categorie: "DESSERT" as const, prixCentimes: 600 },
    ],
  },
  {
    nom: "La Criée Bleue",
    ville: "Marseille",
    cuisine: "Fruits de mer",
    adresse: "3 quai des Belges, 13001 Marseille",
    ouverture: "Mar-Dim 12h-14h30, 19h-22h30",
    description: "Poissons de la criée du matin, terrasse sur le Vieux-Port.",
    capacite: 50,
    noteCuilleres: 4.6,
    nombreAvis: 156,
    plats: [
      { nom: "Tartare de daurade", description: "Agrumes, huile d'olive de Provence.", categorie: "ENTREE" as const, prixCentimes: 1400 },
      { nom: "Bouillabaisse", description: "Rouille maison, croûtons, service en deux temps.", categorie: "PLAT" as const, prixCentimes: 3200 },
      { nom: "Tarte au citron", description: "Citrons de Menton, meringue légère.", categorie: "DESSERT" as const, prixCentimes: 850 },
    ],
    contacts: [
      { nom: "Solène Vasseur", email: "solene@criee-bleue.example", role: "GERANT" as const },
    ],
  },
  {
    nom: "Le Comptoir Basque",
    ville: "Bordeaux",
    cuisine: "Basque",
    adresse: "14 cours de l'Intendance, 33000 Bordeaux",
    ouverture: "Mar-Sam 12h-14h, 19h30-22h30",
    description: "Piment d'Espelette et cochon noir de Bigorre.",
    capacite: 32,
    noteCuilleres: 4.4,
    nombreAvis: 58,
    plats: [
      { nom: "Piperade", description: "Œufs brouillés, jambon de Bayonne.", categorie: "ENTREE" as const, prixCentimes: 900 },
      { nom: "Axoa de veau", description: "Piment d'Espelette, oignons doux.", categorie: "PLAT" as const, prixCentimes: 1900 },
      { nom: "Gâteau basque", description: "Crème pâtissière ou cerises noires, au choix.", categorie: "DESSERT" as const, prixCentimes: 750 },
    ],
    // Volontairement sans contact — voir le commentaire en tête de fichier.
  },
  {
    nom: "Cantine Toulousaine",
    ville: "Toulouse",
    cuisine: "Sud-Ouest",
    adresse: "6 place du Capitole, 31000 Toulouse",
    ouverture: "Lun-Sam 12h-14h30, 19h-22h30",
    description: "Cassoulet au canard confit, cuisson à l'ancienne.",
    capacite: 55,
    noteCuilleres: 4.5,
    nombreAvis: 189,
    plats: [
      { nom: "Salade de gésiers", description: "Confits maison, noix.", categorie: "ENTREE" as const, prixCentimes: 1100 },
      { nom: "Cassoulet", description: "Canard confit, saucisse de Toulouse, haricots tarbais.", categorie: "PLAT" as const, prixCentimes: 2100 },
      { nom: "Croustade aux pommes", description: "Pâte filo, armagnac.", categorie: "DESSERT" as const, prixCentimes: 800 },
    ],
    // Deux contacts : sert aussi à vérifier le rendu de la liste à plusieurs
    // entrées sur la fiche admin.
    contacts: [
      { nom: "Iban Etchegoyen", email: "iban@cantine-toulousaine.example", role: "GERANT" as const },
      {
        nom: "Marion Duprat",
        email: "marion@cantine-toulousaine.example",
        role: "CHEF_DE_SALLE" as const,
      },
    ],
  },
  {
    nom: "Chti'Bistrot",
    ville: "Lille",
    cuisine: "Ch'ti",
    adresse: "2 place du Général de Gaulle, 59000 Lille",
    ouverture: "Mar-Dim 12h-14h, 19h-22h",
    description: "Bières du Nord et carbonnade mijotée toute la journée.",
    capacite: 38,
    noteCuilleres: 4.2,
    nombreAvis: 84,
    plats: [
      { nom: "Potjevleesch", description: "Terrine de viandes blanches en gelée.", categorie: "ENTREE" as const, prixCentimes: 950 },
      { nom: "Carbonnade flamande", description: "Bière brune, pain d'épices, frites maison.", categorie: "PLAT" as const, prixCentimes: 1750 },
      { nom: "Gaufre au sucre", description: "Sucre perlé, servie chaude.", categorie: "DESSERT" as const, prixCentimes: 550 },
    ],
    contacts: [
      { nom: "Kevin Deceuninck", email: "kevin@chti-bistrot.example", role: "GERANT" as const },
    ],
  },
  {
    nom: "Beurre Salé",
    ville: "Nantes",
    cuisine: "Breton",
    adresse: "10 rue Crébillon, 44000 Nantes",
    ouverture: "Mer-Dim 12h-14h, 19h-21h30",
    description: "Galettes de blé noir et cidre brut de Fouesnant.",
    capacite: 26,
    noteCuilleres: 4.3,
    nombreAvis: 41,
    plats: [
      { nom: "Rillettes de sardines", description: "Beurre demi-sel, pain de campagne.", categorie: "ENTREE" as const, prixCentimes: 750 },
      { nom: "Galette complète", description: "Jambon, œuf, emmental, blé noir.", categorie: "PLAT" as const, prixCentimes: 1250 },
      { nom: "Kouign-amann", description: "Beurre salé, pâte feuilletée caramélisée.", categorie: "DESSERT" as const, prixCentimes: 600 },
    ],
    // Volontairement sans contact — voir le commentaire en tête de fichier.
  },
  {
    nom: "Table d'Alsace",
    ville: "Strasbourg",
    cuisine: "Alsacien",
    adresse: "4 place de la Cathédrale, 67000 Strasbourg",
    ouverture: "Mar-Sam 12h-14h, 19h-22h",
    description: "Choucroute royale et vins d'Alsace au verre.",
    capacite: 42,
    noteCuilleres: 4.4,
    nombreAvis: 102,
    plats: [
      { nom: "Salade de cervelas", description: "Emmental, oignons, vinaigrette.", categorie: "ENTREE" as const, prixCentimes: 850 },
      { nom: "Choucroute royale", description: "Trois charcuteries, pommes de terre.", categorie: "PLAT" as const, prixCentimes: 1950 },
      { nom: "Kougelhopf", description: "Amandes et raisins secs.", categorie: "DESSERT" as const, prixCentimes: 700 },
    ],
    contacts: [{ nom: "Elise Muller", email: "elise@table-alsace.example", role: "GERANT" as const }],
  },
  {
    nom: "Sol y Sal",
    ville: "Montpellier",
    cuisine: "Espagnol",
    adresse: "8 place de la Comédie, 34000 Montpellier",
    ouverture: "Mar-Dim 12h-14h30, 19h30-23h",
    description: "Tapas et paella au feu de bois, terrasse ombragée.",
    capacite: 34,
    noteCuilleres: 4.6,
    nombreAvis: 119,
    plats: [
      { nom: "Croquetas de jamón", description: "Béchamel au jambon ibérique.", categorie: "ENTREE" as const, prixCentimes: 800 },
      { nom: "Paella valenciana", description: "Poulet, lapin, haricots verts, safran.", categorie: "PLAT" as const, prixCentimes: 2000 },
      { nom: "Crema catalana", description: "Sucre caramélisé au fer chaud.", categorie: "DESSERT" as const, prixCentimes: 700 },
    ],
    contacts: [
      { nom: "Nuria Ferrer", email: "nuria@sol-y-sal.example", role: "CHEF_DE_SALLE" as const },
    ],
  },
  {
    nom: "Niçoise & Co",
    ville: "Nice",
    cuisine: "Niçois",
    adresse: "5 cours Saleya, 06300 Nice",
    ouverture: "Lun-Dim 12h-14h30, 19h-22h30",
    description: "Cuisine du comté de Nice, produits du marché Saleya.",
    capacite: 30,
    noteCuilleres: 4.5,
    nombreAvis: 88,
    plats: [
      { nom: "Salade niçoise", description: "Thon, anchois, œuf, olives de Nice.", categorie: "ENTREE" as const, prixCentimes: 1100 },
      { nom: "Daube niçoise", description: "Bœuf mijoté au vin rouge, olives, orange.", categorie: "PLAT" as const, prixCentimes: 1900 },
      { nom: "Tarte tropézienne", description: "Brioche, crème mousseline.", categorie: "DESSERT" as const, prixCentimes: 750 },
    ],
    // Volontairement sans contact — voir le commentaire en tête de fichier.
  },
];

/** L'organigramme TheSpoon — connexion sur /connexion-admin (voir schema.prisma). */
const staff = [
  { nom: "Léa Fontaine", email: "lea.fontaine@thespoon.example", role: "Support restaurants" },
  {
    nom: "Nadia Belkacem",
    email: "nadia.belkacem@thespoon.example",
    role: "Finance & facturation",
  },
];

/**
 * Les horaires d'un restaurant, écrits comme sur une devanture
 * ("Mar-Sam 12h-14h, 19h-22h30"), traduits en `PlageOuverture`. Le seed
 * garde cette forme parce qu'elle se relit d'un coup d'œil ; la base, elle,
 * ne stocke que la forme exploitable. Un restaurant sans `ouverture` n'a
 * rien déclaré — c'est un cas à avoir en dev aussi (tous les créneaux
 * proposés, cf. `horairesDeclares`).
 *
 * La migration `20260921160000_horaires_ouverture_structures` a fait la même
 * traduction une fois pour toutes en SQL sur les données existantes.
 */
const ABREVIATIONS_JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

function plagesDepuisDeclaration(declaration: string) {
  const jours = /^([A-Za-z]{3})-([A-Za-z]{3})/.exec(declaration);
  if (!jours) throw new Error(`Déclaration d'horaires illisible : "${declaration}"`);
  const premier = ABREVIATIONS_JOURS.indexOf(jours[1]!.toLowerCase());
  const dernier = ABREVIATIONS_JOURS.indexOf(jours[2]!.toLowerCase());
  if (premier < 0 || dernier < 0) throw new Error(`Jours inconnus : "${declaration}"`);

  const services = [...declaration.matchAll(/(\d{1,2})h(\d{2})?-(\d{1,2})h(\d{2})?/g)].map(
    (service) => ({
      debutMinutes: Number(service[1]) * 60 + Number(service[2] ?? 0),
      finMinutes: Number(service[3]) * 60 + Number(service[4] ?? 0),
    }),
  );
  if (services.length === 0) throw new Error(`Aucun service lisible : "${declaration}"`);

  return ABREVIATIONS_JOURS.flatMap((_, jourSemaine) =>
    jourSemaine >= premier && jourSemaine <= dernier
      ? services.map((service) => ({ jourSemaine, ...service }))
      : [],
  );
}

async function run() {
  await prisma.journalAuditRestaurant.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.platCuillere.deleteMany();
  await prisma.restaurant.deleteMany();

  const motDePasseHash = await hashPassword(MOT_DE_PASSE_CONTACT_DEV);
  let nombreContacts = 0;
  let nombrePlats = 0;

  for (const { plats, contacts, ouverture, ...restaurant } of restaurants) {
    const restaurantCree = await prisma.restaurant.create({
      data: {
        ...restaurant,
        platsCuillere: { create: plats },
        plagesOuverture: { create: ouverture ? plagesDepuisDeclaration(ouverture) : [] },
      },
    });
    nombrePlats += plats.length;

    for (const contact of contacts ?? []) {
      const contactCree = await prisma.restaurantContact.create({
        data: { ...contact, restaurantId: restaurantCree.id },
      });
      // Compte de connexion du contact — même mécanique que l'auth dîneur
      // (accountId = id du user, providerId "credential"), cf. authRestaurant
      // dans src/lib/auth.ts et src/lib/comptes.ts.
      await prisma.restaurantContactAccount.create({
        data: nouveauCompteCredential(contactCree.id, motDePasseHash),
      });
      nombreContacts++;
    }
  }
  for (const membre of staff) {
    const staffCree = await prisma.staff.create({ data: membre });
    // Compte de connexion du membre du staff — même mécanique que les
    // contacts restaurant (accountId = id du user, providerId "credential"),
    // cf. authAdmin dans src/lib/auth.ts et src/lib/comptes.ts.
    await prisma.staffAccount.create({
      data: nouveauCompteCredential(staffCree.id, motDePasseHash),
    });
  }

  console.log(`${restaurants.length} restaurants créés, avec ${nombrePlats} plats à la cuillère au total.`);
  console.log(
    `${nombreContacts} contacts restaurant créés (mot de passe : "${MOT_DE_PASSE_CONTACT_DEV}"), connexion sur /connexion-restaurant.`,
  );
  console.log(
    `${staff.length} membres du staff créés (mot de passe : "${MOT_DE_PASSE_CONTACT_DEV}"), connexion sur /connexion-admin.`,
  );
}

run()
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
