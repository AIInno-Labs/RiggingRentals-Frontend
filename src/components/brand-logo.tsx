import Image from "next/image";
import { COMPANY } from "@/features/documents/company-profile";

const SIZE = {
  nav: { width: 200, height: 44, className: "h-8 w-auto md:h-9" },
  login: { width: 360, height: 80, className: "h-14 w-auto sm:h-16" },
  print: { width: 300, height: 68, className: "h-12 w-auto print:h-11" },
  email: { width: 220, height: 50, className: "h-10 w-auto" },
} as const;

export type BrandLogoVariant = keyof typeof SIZE;

export function BrandLogo({
  variant = "nav",
  className = "",
  priority = false,
}: {
  variant?: BrandLogoVariant;
  className?: string;
  priority?: boolean;
}) {
  const size = SIZE[variant];
  return (
    <Image
      src={COMPANY.logoPath}
      alt={COMPANY.tradingAs}
      width={size.width}
      height={size.height}
      priority={priority}
      className={`${size.className} ${className}`.trim()}
    />
  );
}
