import { snapshotAbsolutePath } from "@/lib/snapshotStorage";
import fs from "node:fs/promises";
import sharp from "sharp";

export const PDF_SNAPSHOT_MAX_WIDTH = 1000;

export async function readSnapshotPngOriginal(relativePath: string): Promise<Buffer> {
  const absolutePath = snapshotAbsolutePath(relativePath);
  return fs.readFile(absolutePath);
}

export async function readSnapshotPngForPdf(relativePath: string): Promise<Buffer> {
  const input = await readSnapshotPngOriginal(relativePath);
  return sharp(input)
    .resize({
      width: PDF_SNAPSHOT_MAX_WIDTH,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}
