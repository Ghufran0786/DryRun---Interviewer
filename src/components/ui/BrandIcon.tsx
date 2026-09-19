import type { BrandDecorItem } from "@/lib/backgroundDecor";
import {
  siDocker,
  siGo,
  siGraphql,
  siJavascript,
  siKubernetes,
  siNodedotjs,
  siPostgresql,
  siPython,
  siReact,
  siRedis,
  siRust,
  siTypescript,
} from "simple-icons";

const BRAND_PATHS: Record<BrandDecorItem["slug"], string> = {
  typescript: siTypescript.path,
  python: siPython.path,
  go: siGo.path,
  rust: siRust.path,
  react: siReact.path,
  docker: siDocker.path,
  postgresql: siPostgresql.path,
  redis: siRedis.path,
  kubernetes: siKubernetes.path,
  nodedotjs: siNodedotjs.path,
  graphql: siGraphql.path,
  javascript: siJavascript.path,
};

type BrandIconProps = {
  slug: BrandDecorItem["slug"];
  sizePx: number;
  className?: string;
};

export function BrandIcon({ slug, sizePx, className = "" }: BrandIconProps) {
  const path = BRAND_PATHS[slug];
  return (
    <svg
      viewBox="0 0 24 24"
      width={sizePx}
      height={sizePx}
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}
