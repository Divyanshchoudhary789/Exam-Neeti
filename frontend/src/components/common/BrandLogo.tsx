import Link from "next/link";

type Size = "sm" | "md" | "lg";

const TILE: Record<Size, string> = {
  sm: "h-9 w-9 rounded-xl p-1",
  md: "h-11 w-11 rounded-2xl p-1.5",
  lg: "h-14 w-14 rounded-2xl p-2",
};

const TITLE: Record<Size, string> = {
  sm: "text-base",
  md: "text-[19px]",
  lg: "text-[22px]",
};

interface BrandLogoProps {
  /** Wrap the lockup in a link. Pass `null` to render plain (no link). */
  href?: string | null;
  size?: Size;
  /** Show the "Every Score Has a Strategy" tagline under the wordmark. */
  subtitle?: boolean;
  /** Render only the logo tile, no wordmark. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * The Exam Neeti brand lockup — the actual logo from `public/logo.png`
 * (never an "EN" text placeholder) plus the wordmark. Use this everywhere the
 * brand appears so the mark stays consistent across the app.
 */
export function BrandLogo({
  href = "/",
  size = "md",
  subtitle = true,
  iconOnly = false,
  className = "",
}: BrandLogoProps) {
  const tile = (
    <span
      className={`flex ${TILE[size]} items-center justify-center bg-white shadow-sm ring-1 ring-slate-900/5 shrink-0 overflow-hidden`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Exam Neeti"
        className="h-full w-full object-contain"
      />
    </span>
  );

  const content = iconOnly ? (
    tile
  ) : (
    <span className={`flex items-center gap-3 ${className}`}>
      {tile}
      <span className="flex flex-col text-left">
        <span
          className={`font-sans ${TITLE[size]} font-black tracking-tight text-slate-900 leading-none`}
        >
          Exam <span className="text-[#4338ca]">Neeti</span>
        </span>
        {subtitle && (
          <span className="text-[11px] font-semibold tracking-wide text-slate-400 mt-1">
            Every Score Has a Strategy
          </span>
        )}
      </span>
    </span>
  );

  if (href == null) return content;

  return (
    <Link href={href} className={`w-fit group ${iconOnly ? className : ""}`}>
      {content}
    </Link>
  );
}

export default BrandLogo;
