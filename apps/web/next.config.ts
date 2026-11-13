import type { NextConfig } from "next";
import path from "node:path";
const distDir = process.env.WEB_DIST_DIR;
if (distDir && !/^\.next-browser-[a-f0-9-]+$/.test(distDir)) throw new Error("Invalid browser build directory");
const config: NextConfig = { outputFileTracingRoot: path.resolve(__dirname, "../.."), ...(distDir ? { distDir } : {}) };
export default config;
