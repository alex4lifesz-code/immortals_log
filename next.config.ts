import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
  async redirects() {
    return [
      // Legacy dashboard route redirects (moved from middleware.ts)
      {
        source: "/dashboard/overview",
        destination: "/dashboard/check-in",
        permanent: false,
      },
      {
        source: "/dashboard/overview/:path*",
        destination: "/dashboard/check-in",
        permanent: false,
      },
      {
        source: "/dashboard/main",
        destination: "/dashboard/check-in",
        permanent: false,
      },
      {
        source: "/dashboard/main/:path*",
        destination: "/dashboard/check-in",
        permanent: false,
      },
      // Existing exercise library redirects
      {
        source: "/dashboard/exercise-library",
        destination: "/dashboard/exercise-db",
        permanent: false,
      },
      {
        source: "/dashbaord/exericse-library",
        destination: "/dashboard/exercise-db",
        permanent: false,
      },
      {
        source: "/dashboard/exericse-library",
        destination: "/dashboard/exercise-db",
        permanent: false,
      },
      {
        source: "/dashbaord/:path*",
        destination: "/dashboard/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
