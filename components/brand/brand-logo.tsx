import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "h-7 w-7", px: 28, text: "text-base" },
  md: { box: "h-8 w-8", px: 32, text: "text-lg" },
  lg: { box: "h-9 w-9", px: 36, text: "text-xl" },
} as const;

export type BrandLogoSize = keyof typeof SIZES;

export function BrandLogo({
  href = "/",
  size = "md",
  showName = true,
  /** Prefer square mark in nav; use "logo" only when extra width helps */
  asset = "mark",
  className,
  priority = false,
}: {
  href?: string | null;
  size?: BrandLogoSize;
  showName?: boolean;
  asset?: "mark" | "logo";
  className?: string;
  priority?: boolean;
}) {
  const s = SIZES[size];
  const src = asset === "logo" ? BRAND.assets.logo : BRAND.assets.mark;

  const inner = (
    <>
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg ring-1 ring-border/70 shadow-sm",
          s.box,
        )}
      >
        <Image
          src={src}
          alt={BRAND.shortName}
          width={s.px}
          height={s.px}
          className="h-full w-full object-cover"
          priority={priority}
        />
      </span>
      {showName ? (
        <span
          className={cn(
            "font-serif font-semibold tracking-tight text-ink leading-none",
            s.text,
          )}
        >
          {BRAND.shortName}
        </span>
      ) : null}
    </>
  );

  if (href == null) {
    return (
      <span className={cn("inline-flex items-center gap-2.5", className)}>
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 focus-ring rounded-lg",
        className,
      )}
    >
      {inner}
    </Link>
  );
}
