// Every landing page photo lives here. Most are frames from the hero film, so the venue looks the
// same everywhere: one glass dome, Court 1 and Court 2 in blue at the back, Court 3 in neon green
// across the front. To swap one, drop the new file in src/assets and change that import only.
import rain from "@/assets/update-rain.jpg";
import aerialDome from "@/assets/venue/aerial-dome.webp";
import domeEntrance from "@/assets/venue/dome-entrance.webp";
import lobbyDesk from "@/assets/venue/lobby-desk.webp";
import playersWalkIn from "@/assets/venue/players-walk-in.webp";
import blueRally from "@/assets/venue/blue-rally.webp";
import courtBlue from "@/assets/venue/court-blue.webp";
import courtGreen from "@/assets/venue/court-green.webp";
import courtsAll from "@/assets/venue/courts-all.webp";

export const photos = {
  reminder: { src: lobbyDesk, alt: "The Padelion front desk under the glass dome at dusk" },
  rain: { src: rain, alt: "Rain outside while the courts stay dry" },
  waitlist: { src: playersWalkIn, alt: "Two players walking in with their rackets" },
  reschedule: { src: blueRally, alt: "A doubles rally on a blue court" },
  cta: { src: aerialDome, alt: "The Padelion glass dome among the palms of Kemang at dusk" },
  visit: { src: domeEntrance, alt: "The entrance of the Padelion glass dome" },
  courtsFallback: { src: courtsAll, alt: "The blue and neon green courts inside the dome" },
  // Booking page court cards.
  courtBlue: { src: courtBlue, alt: "A blue court inside the dome" },
  courtGreen: { src: courtGreen, alt: "The neon green center court" },
};

/**
 * How each court looks and is described, matching the film: Court 3 is the neon green center court
 * across the front of the dome, Court 1 and Court 2 are blue at the back. Text on the site comes from
 * here rather than the court's database label.
 */
export function courtLook(c: { name: string }) {
  const center = /\b3\b/.test(c.name);
  return center
    ? { center, label: "Center court, neon green", short: "center court", walls: "Glass all round, in front of the desk", photo: photos.courtGreen }
    : { center, label: "Indoor, blue", short: "blue court", walls: "Tempered glass, under the dome", photo: photos.courtBlue };
}
