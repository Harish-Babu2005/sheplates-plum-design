"use client";
// The Sheplates wordmark and the opening animation. The wordmark is one transparent image used as a mask, so it can be painted in
// any brand colour with CSS and always stays sharp and the same shape. Coral is the logo colour everywhere.
export const BRAND_COLOURS = { coral: "#F15B5A", ivory: "#FFF4E6", gold: "#F4B942", green: "#8AC43F", lavender: "#A78BFA" } as const;

/** The logo. `height` sets the size (the width follows); `colour` defaults to the coral of the logo. */
export function Wordmark({ height = 28, colour = BRAND_COLOURS.coral, className = "" }: { height?: number; colour?: string; className?: string }) {
  return <span role="img" aria-label="Sheplates" className={`sp-wordmark ${className}`} style={{ height, width: Math.round(height * 3.3043), backgroundColor: colour }} />;
}

/**
 * Shown every time the site is opened: the wordmark moves through the five brand colours and settles on coral, then the screen fades away.
 * It is plain CSS (no script needed to end it), it can be tapped to skip, and with "reduce motion" it only shows the coral logo briefly.
 */
export function BrandSplash() {
  // Automated tests switch the animation off (NEXT_PUBLIC_BRAND_SPLASH=off) so it never covers the screen they are checking.
  if (process.env.NEXT_PUBLIC_BRAND_SPLASH === "off") return null;
  return (
    <div className="sp-splash" data-testid="brand-splash" aria-hidden="true" onClick={(event) => { (event.currentTarget as HTMLElement).style.display = "none"; }}>
      <span className="sp-splash-mark" />
    </div>
  );
}
