import { prisma } from "@/lib/db";
import type { Settings } from "@prisma/client";

const SETTINGS_ID = "singleton";

export async function getSettings(): Promise<Settings> {
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}
