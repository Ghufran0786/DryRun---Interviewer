import { BrandIcon } from "@/components/ui/BrandIcon";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { FLOATING_DECOR, type FloatMotion } from "@/lib/backgroundDecor";

const MOTION_CLASS: Record<FloatMotion, string> = {
  drift: "glyph-motion-drift",
  bob: "glyph-motion-bob",
  sway: "glyph-motion-sway",
};

export function FloatingBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] select-none overflow-hidden [contain:paint]"
      aria-hidden
    >
      {FLOATING_DECOR.map((item) => (
        <div
          key={item.id}
          className={`absolute text-muted ${MOTION_CLASS[item.motion]}`}
          style={{
            left: item.left,
            top: item.top,
            opacity: item.opacity,
            animationDuration: `${item.durationSec}s`,
            animationDelay: `${item.delaySec}s`,
          }}
        >
          {item.kind === "material" ? (
            <MaterialIcon
              name={item.icon}
              className="block"
              style={{ fontSize: item.sizePx }}
            />
          ) : (
            <BrandIcon slug={item.slug} sizePx={item.sizePx} />
          )}
        </div>
      ))}
    </div>
  );
}
