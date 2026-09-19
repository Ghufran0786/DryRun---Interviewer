/** Deterministic floating decor layout (no runtime randomness). */

export type FloatMotion = "drift" | "bob" | "sway";

export type MaterialDecorItem = {
  id: string;
  kind: "material";
  icon: string;
  left: string;
  top: string;
  sizePx: number;
  opacity: number;
  motion: FloatMotion;
  durationSec: number;
  delaySec: number;
};

export type BrandDecorItem = {
  id: string;
  kind: "brand";
  slug:
    | "typescript"
    | "python"
    | "go"
    | "rust"
    | "react"
    | "docker"
    | "postgresql"
    | "redis"
    | "kubernetes"
    | "nodedotjs"
    | "graphql"
    | "javascript";
  left: string;
  top: string;
  sizePx: number;
  opacity: number;
  motion: FloatMotion;
  durationSec: number;
  delaySec: number;
};

export type DecorItem = MaterialDecorItem | BrandDecorItem;

export const FLOATING_DECOR: DecorItem[] = [
  {
    id: "m-terminal",
    kind: "material",
    icon: "terminal",
    left: "4%",
    top: "12%",
    sizePx: 40,
    opacity: 0.16,
    motion: "drift",
    durationSec: 18,
    delaySec: 0,
  },
  {
    id: "m-database",
    kind: "material",
    icon: "database",
    left: "88%",
    top: "10%",
    sizePx: 44,
    opacity: 0.14,
    motion: "bob",
    durationSec: 11,
    delaySec: 1.2,
  },
  {
    id: "m-laptop",
    kind: "material",
    icon: "laptop_chromebook",
    left: "7%",
    top: "38%",
    sizePx: 36,
    opacity: 0.15,
    motion: "sway",
    durationSec: 14,
    delaySec: 0.5,
  },
  {
    id: "m-headphones",
    kind: "material",
    icon: "headphones",
    left: "92%",
    top: "34%",
    sizePx: 38,
    opacity: 0.17,
    motion: "bob",
    durationSec: 9,
    delaySec: 2,
  },
  {
    id: "m-mic",
    kind: "material",
    icon: "mic",
    left: "14%",
    top: "72%",
    sizePx: 34,
    opacity: 0.16,
    motion: "drift",
    durationSec: 16,
    delaySec: 3,
  },
  {
    id: "m-monitor",
    kind: "material",
    icon: "desktop_windows",
    left: "82%",
    top: "68%",
    sizePx: 40,
    opacity: 0.15,
    motion: "sway",
    durationSec: 13,
    delaySec: 1,
  },
  {
    id: "m-memory",
    kind: "material",
    icon: "memory",
    left: "22%",
    top: "22%",
    sizePx: 32,
    opacity: 0.13,
    motion: "bob",
    durationSec: 12,
    delaySec: 4,
  },
  {
    id: "m-hub",
    kind: "material",
    icon: "hub",
    left: "76%",
    top: "20%",
    sizePx: 36,
    opacity: 0.14,
    motion: "drift",
    durationSec: 20,
    delaySec: 2.5,
  },
  {
    id: "m-dns",
    kind: "material",
    icon: "dns",
    left: "5%",
    top: "52%",
    sizePx: 34,
    opacity: 0.14,
    motion: "sway",
    durationSec: 15,
    delaySec: 0.8,
  },
  {
    id: "m-code",
    kind: "material",
    icon: "code",
    left: "48%",
    top: "8%",
    sizePx: 30,
    opacity: 0.12,
    motion: "bob",
    durationSec: 10,
    delaySec: 1.5,
  },
  {
    id: "m-developer",
    kind: "material",
    icon: "developer_board",
    left: "58%",
    top: "78%",
    sizePx: 34,
    opacity: 0.13,
    motion: "drift",
    durationSec: 17,
    delaySec: 3.5,
  },
  {
    id: "m-lan",
    kind: "material",
    icon: "lan",
    left: "35%",
    top: "62%",
    sizePx: 32,
    opacity: 0.12,
    motion: "sway",
    durationSec: 11,
    delaySec: 2.2,
  },
  {
    id: "b-typescript",
    kind: "brand",
    slug: "typescript",
    left: "68%",
    top: "14%",
    sizePx: 28,
    opacity: 0.18,
    motion: "bob",
    durationSec: 10,
    delaySec: 0.3,
  },
  {
    id: "b-python",
    kind: "brand",
    slug: "python",
    left: "12%",
    top: "48%",
    sizePx: 30,
    opacity: 0.17,
    motion: "drift",
    durationSec: 14,
    delaySec: 1.8,
  },
  {
    id: "b-go",
    kind: "brand",
    slug: "go",
    left: "90%",
    top: "48%",
    sizePx: 28,
    opacity: 0.16,
    motion: "sway",
    durationSec: 12,
    delaySec: 2.8,
  },
  {
    id: "b-rust",
    kind: "brand",
    slug: "rust",
    left: "26%",
    top: "84%",
    sizePx: 26,
    opacity: 0.17,
    motion: "bob",
    durationSec: 9,
    delaySec: 0.6,
  },
  {
    id: "b-react",
    kind: "brand",
    slug: "react",
    left: "72%",
    top: "42%",
    sizePx: 30,
    opacity: 0.18,
    motion: "drift",
    durationSec: 16,
    delaySec: 4.2,
  },
  {
    id: "b-docker",
    kind: "brand",
    slug: "docker",
    left: "42%",
    top: "28%",
    sizePx: 28,
    opacity: 0.16,
    motion: "sway",
    durationSec: 13,
    delaySec: 1.1,
  },
  {
    id: "b-postgresql",
    kind: "brand",
    slug: "postgresql",
    left: "52%",
    top: "88%",
    sizePx: 28,
    opacity: 0.15,
    motion: "bob",
    durationSec: 11,
    delaySec: 3.2,
  },
  {
    id: "b-redis",
    kind: "brand",
    slug: "redis",
    left: "8%",
    top: "28%",
    sizePx: 26,
    opacity: 0.16,
    motion: "drift",
    durationSec: 15,
    delaySec: 2.4,
  },
  {
    id: "b-kubernetes",
    kind: "brand",
    slug: "kubernetes",
    left: "94%",
    top: "82%",
    sizePx: 30,
    opacity: 0.17,
    motion: "bob",
    durationSec: 10,
    delaySec: 0.9,
  },
  {
    id: "b-node",
    kind: "brand",
    slug: "nodedotjs",
    left: "38%",
    top: "46%",
    sizePx: 26,
    opacity: 0.14,
    motion: "sway",
    durationSec: 12,
    delaySec: 3.8,
  },
  {
    id: "b-graphql",
    kind: "brand",
    slug: "graphql",
    left: "62%",
    top: "58%",
    sizePx: 28,
    opacity: 0.15,
    motion: "drift",
    durationSec: 18,
    delaySec: 1.4,
  },
  {
    id: "b-javascript",
    kind: "brand",
    slug: "javascript",
    left: "18%",
    top: "62%",
    sizePx: 28,
    opacity: 0.16,
    motion: "bob",
    durationSec: 13,
    delaySec: 2.1,
  },
];
