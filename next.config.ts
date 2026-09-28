import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@react-pdf/renderer",
    "mammoth",
    "unpdf",
    "compromise",
    "keyword-extractor",
    "stopword",
  ],
};

export default nextConfig;
