import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
const distDir = process.env.WEB_DIST_DIR;
if (distDir && !/^\.next-browser-[a-f0-9-]+$/.test(distDir)) throw new Error("Invalid browser build directory");
const config: NextConfig = { outputFileTracingRoot: path.resolve(fileURLToPath(new URL("../..", import.meta.url))), ...(distDir ? { distDir } : {}) };
export default config;
