import { BadRequestException, HttpException, NotFoundException, PayloadTooLargeException, ServiceUnavailableException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, writeFile, lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";
import { uploadedMenuImage } from "./menu-images";

export const MENU_UPLOAD_BYTES = 4_000_000;
const OUTPUT_BYTES = 1024 * 1024;
const STORAGE_FILES = 1000;

export class MenuImageStorage {
  private busy = false;
  private readonly attempts = new Map<string, { count: number; until: number }>();
  constructor(private readonly root = resolve(__dirname, "../../../../.local/menu-images")) {}

  async upload(tenantId: string, request: Readable & { headers: Record<string, string | string[] | undefined> }, save: (key: string, bytes: number) => Promise<void>) {
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
    const attempt = this.attempts.get(tenantId);
    if (this.busy || (attempt && attempt.count >= 10) || (!attempt && this.attempts.size >= 1000)) throw new HttpException("Upload busy", 429);
    this.attempts.set(tenantId, { count: (attempt?.count ?? 0) + 1, until: attempt?.until ?? now + 60000 });
    const type = request.headers["content-type"];
    if (typeof type !== "string" || !["image/jpeg", "image/png", "image/webp"].includes(type)) throw new BadRequestException();
    const length = request.headers["content-length"];
    if (length !== undefined && (typeof length !== "string" || !/^\d+$/.test(length) || Number(length) > MENU_UPLOAD_BYTES)) throw new PayloadTooLargeException();
    this.busy = true;
    const timer = setTimeout(() => request.destroy(), 15000);
    try {
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > MENU_UPLOAD_BYTES) throw new PayloadTooLargeException();
        chunks.push(Buffer.from(chunk));
      }
      if (!size) throw new BadRequestException();
      let output: Buffer;
      try {
        const image = sharp(Buffer.concat(chunks), { failOn: "warning", limitInputPixels: 16000000, limitInputChannels: 4 });
        const metadata = await image.metadata();
        if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image");
        output = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp().toBuffer();
      } catch { throw new BadRequestException(); }
      if (output.length > OUTPUT_BYTES) throw new PayloadTooLargeException();
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      if ((await readdir(this.root)).length >= STORAGE_FILES) throw new HttpException("Image storage full", 429);
      const key = `upload-${randomBytes(24).toString("hex")}.webp`;
      await writeFile(resolve(this.root, key), output, { flag: "wx", mode: 0o600 });
      // Failed database saves remain bounded by the storage file quota; no automatic deletion.
      await save(key, output.length);
      return { data: { imageKey: key } };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    } finally { clearTimeout(timer); this.busy = false; }
  }

  async read(key: string) {
    if (!uploadedMenuImage(key)) throw new NotFoundException();
    try {
      const path = resolve(this.root, key), stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OUTPUT_BYTES) throw new NotFoundException();
      return await readFile(path);
    } catch { throw new NotFoundException(); }
  }
}
