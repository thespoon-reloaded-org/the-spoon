import "dotenv/config";

import { hashPassword } from "better-auth/crypto";

import { prisma } from "../src/lib/prisma";

/** Mot de passe des contacts restaurant et du staff seedés — uniquement pour le dev local. */
const MOT_DE_PASSE_CONTACT_DEV = "password123";

/** Une poignée de vrais restaurants, pour avoir quelque chose à chercher en dev. */
const restaurants = [
  {
    nom: "Chez Antoine",
    ville: "Lyon",
    cuisine: "Bouchon lyonnais",
    adresse: "12 rue Mercière, 69002 Lyon",
    horaires: "Mar-Sam 12h-14h, 19h-22h30",
    description: "Quenelles et gratin dauphinois, service en salle depuis 1987.",
    capacite: 40,
    noteCuilleres: 4.3,
    nombreAvis: 128,
    plats: [
      {
        nom: "Gratin dauphinois",
        description: "Crémeux, cuit trois heures.",
        categorie: "PLAT" as const,
        prixCentimes: 1650,
      },
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
    horaires: "Lun-Dim 11h30-14h30, 18h30-23h",
    description: "Comptoir de 12 places, ramen maison et izakaya le soir.",
    capacite: 24,
    noteCuilleres: 4.7,
    nombreAvis: 64,
    plats: [
      {
        nom: "Ramen tonkotsu",
        description: "Bouillon os de porc 18h, œuf mollet.",
        categorie: "PLAT" as const,
        prixCentimes: 1450,
      },
    ],
    contacts: [{ nom: "Haruto Sato", email: "haruto@miso-bar.example", role: "GERANT" as const }],
  },
  {
    nom: "Le Petit Marché",
    ville: "Paris",
    cuisine: "Bistrot",
    adresse: "9 rue de Bretagne, 75003 Paris",
    horaires: null,
    description: null,
    capacite: 30,
    noteCuilleres: null,
    nombreAvis: 0,
    plats: [
      { nom: "Pot-au-feu", description: null, categorie: "PLAT" as const, prixCentimes: 1800 },
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
    horaires: "Lun-Sam 12h-14h30, 19h-23h30",
    description: "Pâtes fraîches faites sur place, carte de vins italiens.",
    capacite: 45,
    noteCuilleres: 4.8,
    nombreAvis: 212,
    plats: [
      {
        nom: "Risotto aux cèpes",
        description: "Riz carnaroli, cèpes séchés, parmesan 24 mois.",
        categorie: "PLAT" as const,
        prixCentimes: 2200,
      },
    ],
  },
  {
    nom: "Racines Vertes",
    ville: "Paris",
    cuisine: "Végé",
    adresse: "22 rue du Faubourg Saint-Denis, 75010 Paris",
    horaires: "Mar-Dim 12h-14h30, 19h-22h",
    description: "Cuisine végétale de saison, tout est fait maison.",
    capacite: 28,
    noteCuilleres: 4.6,
    nombreAvis: 97,
    plats: [
      {
        nom: "Velouté de potimarron",
        description: "Noisettes torréfiées, huile de courge.",
        categorie: "ENTREE" as const,
        prixCentimes: 950,
      },
    ],
  },
  {
    nom: "Beyrouth Café",
    ville: "Paris",
    cuisine: "Libanais",
    adresse: "7 rue de Turenne, 75003 Paris",
    horaires: "Lun-Sam 12h-15h, 18h30-23h",
    description: "Mezzés à partager, grande table pour les groupes.",
    capacite: 36,
    noteCuilleres: 4.5,
    nombreAvis: 73,
    plats: [
      {
        nom: "Chorba libanaise",
        description: "Soupe de lentilles corail, citron confit.",
        categorie: "ENTREE" as const,
        prixCentimes: 850,
      },
    ],
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

async function run() {
  await prisma.staff.deleteMany();
  await prisma.platCuillere.deleteMany();
  await prisma.restaurant.deleteMany();

  const motDePasseHash = await hashPassword(MOT_DE_PASSE_CONTACT_DEV);
  let nombreContacts = 0;

  for (const { plats, contacts, ...restaurant } of restaurants) {
    const restaurantCree = await prisma.restaurant.create({
      data: { ...restaurant, platsCuillere: { create: plats } },
    });

    for (const contact of contacts ?? []) {
      const contactCree = await prisma.restaurantContact.create({
        data: { ...contact, restaurantId: restaurantCree.id },
      });
      // Compte de connexion du contact — même mécanique que l'auth dîneur
      // (accountId = id du user, providerId "credential"), cf. authRestaurant
      // dans src/lib/auth.ts.
      await prisma.restaurantContactAccount.create({
        data: {
          id: contactCree.id,
          accountId: contactCree.id,
          providerId: "credential",
          userId: contactCree.id,
          password: motDePasseHash,
        },
      });
      nombreContacts++;
    }
  }
  for (const membre of staff) {
    const staffCree = await prisma.staff.create({ data: membre });
    // Compte de connexion du membre du staff — même mécanique que les
    // contacts restaurant (accountId = id du user, providerId "credential"),
    // cf. authAdmin dans src/lib/auth.ts.
    await prisma.staffAccount.create({
      data: {
        id: staffCree.id,
        accountId: staffCree.id,
        providerId: "credential",
        userId: staffCree.id,
        password: motDePasseHash,
      },
    });
  }

  console.log(`${restaurants.length} restaurants créés, avec leur plat à la cuillère.`);
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
