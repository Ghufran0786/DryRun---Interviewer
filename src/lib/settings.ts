import { prisma } from "@/lib/db";
import type { Settings } from "@prisma/client";

const SETTINGS_ID = "singleton";

export async function getSettings(): Promise<Settings> {
  const existing = await prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) {
    return existing;
  }
  try {
    return await prisma.settings.create({ data: { id: SETTINGS_ID } });
  } catch (error: unknown) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string"
        ? (error as { code: string }).code
        : "";
    if (code === "P2002") {
      const row = await prisma.settings.findUnique({
        where: { id: SETTINGS_ID },
      });
      if (row) {
        return row;
      }
    }
    throw error;
  }
}
