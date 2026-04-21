import type { SVGProps } from 'react';

/**
 * Cat-eye (agatada) glasses icon — feminine, stylized.
 * Two almond-shaped lenses with upturned outer peaks and a small bridge.
 * Uses currentColor so parent `text-*` utilities still work.
 */
export function CatEyeGlasses(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Left lens — cat-eye with peak at upper-left */}
      <path d="M11 10.2 C 9 11.2, 6 12, 3.5 11.8 C 1.8 11.6, 1 10, 1.5 7.8 C 1.9 5.9, 3.8 5.2, 6 5.6 C 8.8 6.2, 10.5 8, 11 10.2 Z" />
      {/* Right lens — mirror */}
      <path d="M13 10.2 C 15 11.2, 18 12, 20.5 11.8 C 22.2 11.6, 23 10, 22.5 7.8 C 22.1 5.9, 20.2 5.2, 18 5.6 C 15.2 6.2, 13.5 8, 13 10.2 Z" />
      {/* Bridge */}
      <path d="M11 9.2 L 13 9.2" />
      {/* Tiny decorative dots on upper peaks (feminine accent) */}
      <circle cx="3.2" cy="6.4" r="0.35" fill="currentColor" />
      <circle cx="20.8" cy="6.4" r="0.35" fill="currentColor" />
    </svg>
  );
}
