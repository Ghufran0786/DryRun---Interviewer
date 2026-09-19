import type { CSSProperties } from "react";

type MaterialIconProps = {
  name: string;
  className?: string;
  filled?: boolean;
  style?: CSSProperties;
};

export function MaterialIcon({
  name,
  className = "",
  filled = false,
  style,
}: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined leading-none ${className}`}
      style={{
        ...style,
        ...(filled ? { fontVariationSettings: "'FILL' 1" } : {}),
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}
