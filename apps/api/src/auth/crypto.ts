import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const COST = 131072;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const MAX_MEMORY = 160 * 1024 * 1024;

function passwordBytes(password: string): Buffer {
  if (typeof password !== "string") throw new Error("Invalid password input");
  const bytes = Buffer.from(password, "utf8");
  if (bytes.length < 12 || bytes.length > 1024) throw new Error("Invalid password input");
  return bytes;
}

function derive(password: Buffer, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: COST, r: BLOCK_SIZE, p: PARALLELISM, maxmem: MAX_MEMORY }, (error, result) => {
      if (error) reject(new Error("Password derivation failed"));
      else resolve(result);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const input = passwordBytes(password);
  const salt = randomBytes(16);
  const key = await derive(input, salt);
  return ["scrypt", COST, BLOCK_SIZE, PARALLELISM, salt.toString("hex"), key.toString("hex")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  let input: Buffer;
  try { input = passwordBytes(password); } catch { return false; }
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== String(COST) || parts[2] !== String(BLOCK_SIZE) || parts[3] !== String(PARALLELISM) || !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false;
  const key = await derive(input, Buffer.from(parts[4], "hex"));
  return timingSafeEqual(key, Buffer.from(parts[5], "hex"));
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Invalid session token");
  return createHash("sha256").update(token).digest("hex");
}
