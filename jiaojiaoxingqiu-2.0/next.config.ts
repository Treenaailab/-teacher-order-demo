import type { NextConfig } from "next";
const nextConfig: NextConfig = {outputFileTracingRoot: process.cwd(),distDir:process.env.TUTOR_BUILD_DIR||".next"};
export default nextConfig;
