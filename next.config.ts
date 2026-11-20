import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Image Docker minimale pour Cloud Run : `.next/standalone` contient un
  // `server.js` et seulement les dépendances réellement utilisées.
  output: "standalone",
  experimental: {
    // Défaut Next.js (1 Mo) trop bas pour l'upload de photo de plat dans
    // l'action "use server" de /restaurants/[id]/menu — voir creerPlat.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
