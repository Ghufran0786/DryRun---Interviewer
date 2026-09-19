import { readSnapshotPng } from "@/lib/snapshotStorage";
import sharp from "sharp";

export const PDF_SNAPSHOT_MAX_WIDTH = 1000;

export async function readSnapshotPngOriginal(storageKey: string): Promise<Buffer> {
  return readSnapshotPng(storageKey);
}

export async function readSnapshotPngForPdf(storageKey: string): Promise<Buffer> {
  const input = await readSnapshotPngOriginal(storageKey);
  return sharp(input)
    .resize({
      width: PDF_SNAPSHOT_MAX_WIDTH,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}
