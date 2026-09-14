import { getStore } from "@netlify/blobs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

export const TAILLE_MAX_PHOTO = 5 * 1024 * 1024; // 5 Mo

/** Valide un fichier envoyé comme photo — utilisé pour les plats et pour la fiche établissement. */
export function validerImage(photo: File): string | null {
  if (!photo.type.startsWith("image/")) return "La photo doit être une image.";
  if (photo.size > TAILLE_MAX_PHOTO) return "Photo trop lourde (5 Mo max).";
  return null;
}

type ResultatPhoto = { data: Blob; metadata: { contentType?: string } } | null;

/** Le sous-ensemble de l'API Netlify Blobs dont ce projet a besoin. */
export interface StorePhotos {
  set(key: string, valeur: Blob, options: { metadata: { contentType: string } }): Promise<unknown>;
  getWithMetadata(key: string, options: { type: "blob" }): Promise<ResultatPhoto>;
  delete(key: string): Promise<void>;
}

/**
 * Store de secours pour le développement local : Netlify Blobs a besoin de
 * `netlify dev` (il n'est configuré ni par `NETLIFY_BLOBS_CONTEXT`, ni par un
 * siteID/token manuel) pour émuler un store en local — trop de friction pour
 * un simple `pnpm dev`. On écrit donc les photos sur disque, dans un dossier
 * ignoré par git (`.local-blobs/<bucket>/`). Même interface que le vrai
 * store, donc le reste du code (actions, route de lecture) ne sait pas
 * lequel il utilise.
 */
function creerStoreLocal(bucket: string): StorePhotos {
  const dossier = path.join(process.cwd(), ".local-blobs", bucket);

  /**
   * `key` (id de plat ou de restaurant) vient in fine d'un paramètre d'URL
   * public — jamais utilisé tel quel dans un chemin de fichier sans passer
   * par ici. Un `key` contenant `/` ou `..` permettrait de sortir de
   * `dossier` (path.join ne fait aucun sandboxing) et de lire/écraser un
   * fichier arbitraire sur le disque en dev.
   */
  function cheminSecurise(key: string) {
    if (!/^[a-z0-9]+$/i.test(key)) {
      throw new Error(`Clé de photo invalide : ${key}`);
    }
    return path.join(dossier, key);
  }
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
 * Store de photos pour un « bucket » donné (un par type d'entité — plats,
 * restaurants...). Sur Netlify (build/déploiement), `NETLIFY_BLOBS_CONTEXT`
 * est toujours présent et Netlify Blobs prend le relais automatiquement ;
 * sinon (`next dev` en local), on retombe sur un store disque — voir
 * `creerStoreLocal`.
 */
export function creerStorePhotos(bucket: string): StorePhotos {
  if (process.env.NETLIFY_BLOBS_CONTEXT) {
    return getStore(bucket);
  }
  return creerStoreLocal(bucket);
}
