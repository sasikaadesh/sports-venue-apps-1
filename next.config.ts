import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // The Prisma client is generated to a custom path (lib/generated/prisma), so
  // Next's dependency tracing does not reliably pick up the native query-engine
  // binary it loads at runtime. Include it explicitly for every route,
  // otherwise the Vercel deployment 500s with "could not locate the Query
  // Engine for runtime rhel-openssl-3.0.x".
  outputFileTracingIncludes: {
    "/**": ["lib/generated/prisma/*.so.node"],
  },
  experimental: {
    serverActions: {
      // Court image uploads post through a server action. The default cap is
      // 1 MB, below the 5 MB-per-file limit the storage bucket allows.
      bodySizeLimit: "12mb",
    },
  },
  images: {
    remotePatterns: [
      // Dev placeholders (docs/DESIGN.md).
      { protocol: "https", hostname: "images.unsplash.com" },
      // Court images uploaded to Supabase Storage.
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost }]
        : []),
    ],
  },
};

export default nextConfig;
