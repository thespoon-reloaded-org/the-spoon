import { Storage } from "@google-cloud/storage";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

export const TAILLE_MAX_PHOTO = 5 * 1024 * 1024; // 5 Mo

/**
 * Types image acceptés — liste fermée, pas juste `image/*`. Exclut
 * volontairement `image/svg+xml` : un SVG est un document XML qui peut
 * embarquer du JavaScript, et ces photos sont servies telles quelles (même
 * `Content-Type`) par des routes publiques sans authentification
 * (`/api/plats/[platId]/photo`, `/api/restaurants/[id]/photo`) — accepter du
 * SVG ouvrirait une XSS stockée sur ces URLs.
 */
const TYPES_IMAGE_ACCEPTES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Valide un fichier envoyé comme photo — utilisé pour les plats et pour la fiche établissement. */
export function validerImage(photo: File): string | null {
  if (!TYPES_IMAGE_ACCEPTES.has(photo.type)) return "La photo doit être une image (JPG, PNG, WEBP ou GIF).";
  if (photo.size > TAILLE_MAX_PHOTO) return "Photo trop lourde (5 Mo max).";
  return null;
}

/** Lit le fichier envoyé sous le nom `photo` dans un formulaire — utilisé pour les plats et la fiche établissement. */
export function lirePhoto(formData: FormData): File | null {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return null;
  return photo;
}

/**
 * Envoie une photo sur un store (Cloud Storage en prod, disque local en dev
 * — voir `creerStorePhotos`). Si l'écriture échoue (disque plein,
 * permissions, panne du store...), ne bloque pas l'enregistrement de
 * l'entité pour autant — retourne un message à afficher à l'utilisateur au
 * lieu de laisser croire que tout s'est bien passé.
 */
export async function sauvegarderPhotoEntite(
  store: StorePhotos,
  key: string,
  photo: File,
  messageEchec: string,
): Promise<string | null> {
  try {
    await store.set(key, photo, { metadata: { contentType: photo.type } });
    return null;
  } catch (erreur) {
    console.error(`Échec de l'upload d'une photo (clé ${key}) :`, erreur);
    return messageEchec;
  }
}

type ResultatPhoto = { data: Blob; metadata: { contentType?: string } } | null;

/**
 * Le sous-ensemble d'API de stockage dont ce projet a besoin. Hérité de
 * Netlify Blobs (hébergement d'origine) ; Cloud Storage et le disque local
 * l'implémentent à l'identique.
 */
export interface StorePhotos {
  set(key: string, valeur: Blob, options: { metadata: { contentType: string } }): Promise<unknown>;
  getWithMetadata(key: string, options: { type: "blob" }): Promise<ResultatPhoto>;
  delete(key: string): Promise<void>;
}

/**
 * Store de secours pour le développement local : pas de bucket Cloud Storage
 * pour un simple `pnpm dev`. On écrit donc les photos sur disque, dans un
 * dossier ignoré par git (`.local-blobs/<bucket>/`). Même interface que le
 * vrai store, donc le reste du code (actions, route de lecture) ne sait pas
 * lequel il utilise.
 */
/**
 * `key` (id de plat, de restaurant ou de pièce jointe) vient in fine d'un
 * paramètre d'URL public — jamais utilisé tel quel dans un chemin de fichier
 * ou un nom d'objet sans passer par ici. Un `key` contenant `/` ou `..`
 * permettrait de sortir du dossier (ou du préfixe) prévu et de lire/écraser
 * un autre fichier.
 */
function verifierCle(key: string) {
  if (!/^[a-z0-9]+$/i.test(key)) {
    throw new Error(`Clé de photo invalide : ${key}`);
  }
  return key;
}

function creerStoreLocal(bucket: string): StorePhotos {
  const dossier = path.join(process.cwd(), ".local-blobs", bucket);

  const cheminSecurise = (key: string) => path.join(dossier, verifierCle(key));
  const cheminMetadonnees = (key: string) => `${cheminSecurise(key)}.json`;

  return {
    async set(key, valeur, { metadata }) {
      await mkdir(dossier, { recursive: true });
      const octets = Buffer.from(await valeur.arrayBuffer());
      await writeFile(cheminSecurise(key), octets);
      await writeFile(cheminMetadonnees(key), JSON.stringify(metadata));
    },
    async getWithMetadata(key) {
      try {
        const [octets, metadataBrute] = await Promise.all([
          readFile(cheminSecurise(key)),
          readFile(cheminMetadonnees(key), "utf-8").catch(() => "{}"),
        ]);
        const metadata: { contentType?: string } = JSON.parse(metadataBrute);
        return { data: new Blob([octets], { type: metadata.contentType }), metadata };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await Promise.all([
        rm(cheminSecurise(key), { force: true }),
        rm(cheminMetadonnees(key), { force: true }),
      ]);
    },
  };
}

/**
 * Store Cloud Storage : un bucket GCS par environnement (`PHOTOS_BUCKET`),
 * un préfixe par « bucket » logique (`plats-photos/<id>`,
 * `restaurants-photos/<id>`...). Le type de contenu est porté par l'objet
 * lui-même. Les identifiants viennent du compte de service du service Cloud
 * Run — aucune clé dans l'environnement.
 */
function creerStoreCloudStorage(bucketGcs: string, prefixe: string): StorePhotos {
  const bucket = new Storage().bucket(bucketGcs);
  const objet = (key: string) => bucket.file(`${prefixe}/${verifierCle(key)}`);

  return {
    async set(key, valeur, { metadata }) {
      const octets = Buffer.from(await valeur.arrayBuffer());
      await objet(key).save(octets, { contentType: metadata.contentType, resumable: false });
    },
    async getWithMetadata(key) {
      // Clé invalide : même réponse que le store local (introuvable), pas une erreur.
      if (!/^[a-z0-9]+$/i.test(key)) return null;
      const fichier = objet(key);
      try {
        const [[octets], [meta]] = await Promise.all([fichier.download(), fichier.getMetadata()]);
        return {
          data: new Blob([new Uint8Array(octets)], { type: meta.contentType }),
          metadata: { contentType: meta.contentType },
        };
      } catch (erreur) {
        if ((erreur as { code?: number }).code === 404) return null;
        throw erreur;
      }
    },
    async delete(key) {
      await objet(key).delete({ ignoreNotFound: true });
    },
  };
}

const storesParBucket = new Map<string, StorePhotos>();

/**
 * Store de photos pour un « bucket » donné (un par type d'entité — plats,
 * restaurants...), mémorisé — un seul store construit par bucket et par
 * instance serveur, pas un par requête. Avec `PHOTOS_BUCKET` (Cloud Run :
 * prod et prévisualisations), les photos vont dans ce bucket Cloud Storage ;
 * sinon (`pnpm dev` en local), sur disque — voir `creerStoreLocal`.
 */
export function creerStorePhotos(bucket: string): StorePhotos {
  const existant = storesParBucket.get(bucket);
  if (existant) return existant;

  const bucketGcs = process.env.PHOTOS_BUCKET;
  const store = bucketGcs ? creerStoreCloudStorage(bucketGcs, bucket) : creerStoreLocal(bucket);
  storesParBucket.set(bucket, store);
  return store;
}
