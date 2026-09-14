import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Défaut Next.js (1 Mo) trop bas pour l'upload de photo de plat dans
    // l'action "use server" de /restaurants/[id]/menu — voir creerPlat.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
