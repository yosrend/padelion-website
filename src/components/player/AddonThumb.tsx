// Add-on pictures for /book and the rentals section: renders of the venue's own racket model
// in three colourways, a can of balls and a folded towel. The old line drawings stay as a fallback.
import racketControl from "@/assets/addons/racket-control.webp";
import racketBalanced from "@/assets/addons/racket-balanced.webp";
import racketPower from "@/assets/addons/racket-power.webp";
import balls from "@/assets/addons/balls.webp";
import towel from "@/assets/addons/towel.webp";

const PHOTO = {
  control: { src: racketControl, alt: "Control racket, blue" },
  balanced: { src: racketBalanced, alt: "Balanced racket, yellow" },
  power: { src: racketPower, alt: "Power racket, orange" },
  balls: { src: balls, alt: "A can of three padel balls" },
  towel: { src: towel, alt: "A folded Padelion towel" },
} as const;

type Kind = "control" | "balanced" | "power" | "balls" | "towel";

export function addonKind(name: string): Kind {
  const n = name.toLowerCase();
  if (n.includes("control")) return "control";
  if (n.includes("power")) return "power";
  if (n.includes("racket")) return "balanced";
  if (n.includes("ball")) return "balls";
  return "towel";
}

const HEADS: Record<"control" | "balanced" | "power", string> = {
  // round head, low balance
  control: "M40 8 C58 8 68 22 68 38 C68 54 56 66 40 66 C24 66 12 54 12 38 C12 22 22 8 40 8 Z",
  // teardrop head
  balanced: "M40 6 C60 6 68 22 66 38 C64 54 52 66 40 66 C28 66 16 54 14 38 C12 22 20 6 40 6 Z",
  // diamond head, head heavy
  power: "M40 4 C54 6 66 18 68 30 C69 42 60 58 40 66 C20 58 11 42 12 30 C14 18 26 6 40 4 Z",
};

const HOLES: Array<[number, number]> = [
  [32, 22], [40, 18], [48, 22], [28, 30], [36, 28], [44, 28], [52, 30],
  [30, 38], [38, 36], [46, 36], [54, 38], [32, 46], [40, 44], [48, 46], [36, 54], [44, 54],
];

function Racket({ kind }: { kind: "control" | "balanced" | "power" }) {
  return (
    <svg viewBox="0 0 80 112" aria-hidden="true">
      <rect x="35" y="66" width="10" height="10" rx="2" fill="var(--ink-2)" />
      <rect x="34" y="76" width="12" height="32" rx="5" fill="var(--ink)" />
      <rect x="34" y="84" width="12" height="3" fill="var(--neon)" opacity="0.9" />
      <path d={HEADS[kind]} fill="var(--ink)" stroke="var(--neon)" strokeWidth="3.5" />
      {HOLES.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.1" fill="var(--ink-2)" />
      ))}
    </svg>
  );
}

function Balls() {
  return (
    <svg viewBox="0 0 80 112" aria-hidden="true">
      <rect x="18" y="10" width="44" height="92" rx="10" fill="var(--blue-tint)" stroke="var(--blue)" strokeWidth="2.5" />
      <rect x="16" y="8" width="48" height="8" rx="4" fill="var(--blue)" />
      {[34, 58, 82].map((cy) => (
        <g key={cy}>
          <circle cx="40" cy={cy} r="11" fill="var(--neon)" />
          <path d={`M30 ${cy - 4} C36 ${cy} 36 ${cy + 4} 30 ${cy + 8}`} stroke="var(--white)" strokeWidth="1.8" fill="none" />
          <path d={`M50 ${cy - 8} C44 ${cy - 4} 44 ${cy} 50 ${cy + 4}`} stroke="var(--white)" strokeWidth="1.8" fill="none" />
        </g>
      ))}
    </svg>
  );
}

function Towel() {
  return (
    <svg viewBox="0 0 80 112" aria-hidden="true">
      <rect x="14" y="26" width="52" height="64" rx="8" fill="var(--white)" stroke="var(--dashed)" strokeWidth="2" />
      <rect x="14" y="26" width="52" height="16" rx="8" fill="var(--fill)" />
      <rect x="14" y="74" width="52" height="6" fill="var(--blue)" />
      <rect x="14" y="83" width="52" height="3" fill="var(--neon)" />
      <path d="M22 42 V70 M30 42 V70 M38 42 V70 M46 42 V70 M54 42 V70" stroke="var(--divider)" strokeWidth="1.5" />
    </svg>
  );
}

export function AddonThumb({ name, drawn = false }: { name: string; drawn?: boolean }) {
  const kind = addonKind(name);
  if (drawn)
    return (
      <span className="addon-thumb" data-kind={kind}>
        {kind === "balls" ? <Balls /> : kind === "towel" ? <Towel /> : <Racket kind={kind} />}
      </span>
    );
  return (
    <span className="addon-thumb" data-kind={kind}>
      <img src={PHOTO[kind].src} alt={PHOTO[kind].alt} width={400} height={400} loading="lazy" decoding="async" />
    </span>
  );
}

/** One line under the add-on name that says who it is for. */
export function addonNote(name: string): string | null {
  switch (addonKind(name)) {
    case "control":
      return "Round head, forgiving. Good if you are new.";
    case "balanced":
      return "Teardrop head for players who mix it up.";
    case "power":
      return "Diamond head, heavier. For hard smashes.";
    case "balls":
      return "New balls, sealed can.";
    default:
      return "Fresh from the desk.";
  }
}
