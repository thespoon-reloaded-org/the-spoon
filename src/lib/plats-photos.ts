import { getStore } from "@netlify/blobs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

type ResultatPhoto = { data: Blob; metadata: { contentType?: string } } | null;

/** Le sous-ensemble de l'API Netlify Blobs dont ce projet a besoin. */
interface StorePhotos {
  set(key: string, valeur: Blob, options: { metadata: { contentType: string } }): Promise<unknown>;
  getWithMetadata(key: string, options: { type: "blob" }): Promise<ResultatPhoto>;
  delete(key: string): Promise<void>;
}

const DOSSIER_LOCAL = path.join(process.cwd(), ".local-blobs", "plats-photos");

/**
 * `key` est un id de plat (cuid), mais vient in fine d'un paramètre d'URL
 * public (`/api/plats/[platId]/photo`) — jamais utilisé tel quel dans un
 * chemin de fichier sans passer par ici. Un `key` contenant `/` ou `..`
 * permettrait de sortir de `DOSSIER_LOCAL` (path.join ne fait aucun
 * sandboxing) et de lire/écraser un fichier arbitraire sur le disque en dev.
 */
function cheminSecurise(key: string) {
  if (!/^[a-z0-9]+$/i.test(key)) {
    throw new Error(`Clé de photo invalide : ${key}`);
  }
  return path.join(DOSSIER_LOCAL, key);
}

function cheminDonnees(key: string) {
  return cheminSecurise(key);
}

function cheminMetadonnees(key: string) {
  return `${cheminSecurise(key)}.json`;
}

/**
 * Store de secours pour le développement local : Netlify Blobs a besoin de
 * `netlify dev` (il n'est configuré ni par `NETLIFY_BLOBS_CONTEXT`, ni par un
 * siteID/token manuel) pour émuler un store en local — trop de friction pour
 * un simple `pnpm dev`. On écrit donc les photos sur disque, dans un dossier
 * ignoré par git (`.local-blobs/`). Même interface que le vrai store, donc le
 * reste du code (actions, route de lecture) ne sait pas lequel il utilise.
 */
const storeLocal: StorePhotos = {
  async set(key, valeur, { metadata }) {
    await mkdir(DOSSIER_LOCAL, { recursive: true });
    const octets = Buffer.from(await valeur.arrayBuffer());
    await writeFile(cheminDonnees(key), octets);
    await writeFile(cheminMetadonnees(key), JSON.stringify(metadata));
  },
  async getWithMetadata(key) {
    try {
      const [octets, metadataBrute] = await Promise.all([
        readFile(cheminDonnees(key)),
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
      rm(cheminDonnees(key), { force: true }),
      rm(cheminMetadonnees(key), { force: true }),
    ]);
  },
};

/**
 * Store des photos de plats — une entrée par plat, clé = id du plat (une
 * seule photo par plat, un nouvel upload remplace l'ancienne). Sur Netlify
 * (build/déploiement), `NETLIFY_BLOBS_CONTEXT` est toujours présent et
 * Netlify Blobs prend le relais automatiquement ; sinon (`next dev` en
 * local), on retombe sur `storeLocal` — voir plus haut.
 */
export function getPlatsPhotosStore(): StorePhotos {
  if (process.env.NETLIFY_BLOBS_CONTEXT) {
    return getStore("plats-photos");
  }
  return storeLocal;
}
