import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "mammoth", "unpdf"],
};

export default nextConfig;
