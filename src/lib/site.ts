/**
 * Public address of the deployed site. Set VITE_SITE_URL in .env (no trailing slash).
 * QR codes and share images point here, so a phone camera always lands on the live site.
 */
const fromEnv = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "");

export function siteUrl(): string {
  if (fromEnv) return fromEnv;
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function siteHost(): string {
  return siteUrl().replace(/^https?:\/\//, "");
}
