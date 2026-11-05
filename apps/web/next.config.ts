import type { NextConfig } from "next";
const distDir = process.env.WEB_DIST_DIR;
if (distDir && !/^\.next-browser-[a-f0-9-]+$/.test(distDir)) throw new Error("Invalid browser build directory");
const config: NextConfig = { ...(distDir ? { distDir } : {}) };
export default config;
