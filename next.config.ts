import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
  async redirects() {
    return [
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
