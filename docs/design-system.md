# Design system

Tokens and base components live in `src/design-system/padelion`. Page styles are in `src/styles.css`.

## Principles

1. **The player's point of view.** Every headline answers "what do I get". "Your court, locked in 60 seconds.", not "Seamless booking platform".
2. **One loud thing per screen.** Neon marks the single main action.
3. **Colour has a job, or it stays grey.** Blue means "your selection". The blue tint means "needs attention". Everything else is ink and greys.
4. **Real content.** Real prices, court names and times, the same on every screen.
5. **Quiet motion.** Fast, eased, interruptible, and it respects reduced motion.

## Colour

```css
:root {
  --ink: #3A261C;          /* primary text and dark sections */
  --ink-2: #4A3428;
  --neon: #D4FF3A;         /* one primary action per screen */
  --neon-hover: #C6F21F;
  --blue: #2D4E9C;         /* selection only: picked slot, chosen payment, ticket */
  --blue-hover: #243F80;
  --blue-tint: #EEF2FA;    /* needs attention */
  --on-blue-muted: #CBD5EC;
  --white: #FFFFFF;
  --page: #F6F7F4;
  --fill: #F1F2EE;
  --divider: #ECEDE8;
  --border: #E1E3DD;
  --card-border: #E4E6E0;
  --dashed: #C9CCC4;
  --text-1: #3A261C;
  --text-2: #6B6E66;
  --text-3: #9B9F95;
}
```

| Chip | Style |
|---|---|
| Paid | fill background, ink text |
| Balance due | blue-tint background, `#243F80` text |
| On hold | dashed `#C9CCC4` border, text-2 |
| Urgent | ink background, white text |

### Staff theme

The desk and owner screens override the tokens inside `.staff-shell`: white surfaces, black text `#0A0A0A`, lime accents with a gradient `#D4FF3A` to `#84CC16` to `#4FAE1C` for the revenue card, chart fills and the court-use donut. Content sits in an inset panel up to 1280 px wide under a top bar with breadcrumb, date and a live badge.

## Typography

| Role | Font | Size / line height | Weight | Tracking |
|---|---|---|---|---|
| Hero display | Satoshi | 96 to 120 / 0.95 | 500 | -0.05em |
| Display | Satoshi | 56 to 68 / 1.0 | 500 | -0.045em |
| Section title | Satoshi | 44 to 52 / 1.02 | 500 | -0.04em |
| Page title (dashboard) | Satoshi | 28 | 500 | -0.03em |
| Card title | Inter | 17 | 600 | 0 |
| Body | Inter | 16 / 1.55 | 400 | 0 |
| Label | Inter | 14 | 600 | 0 |
| Meta | Inter | 13 | 400 to 500 | 0 |

- Satoshi from Fontshare, Inter from Google Fonts.
- `font-variant-numeric: tabular-nums` on prices, times and KPIs.
- Minimum text size 13 px. Public body text never below 15 px.

## Space, radius, elevation

- Space scale: 4, 8, 12, 16, 20, 24, 28, 32, 40, 56, 72, 96, 120.
- Gutters: 80 px on public desktop pages, 40 px in the dashboard, 16 px on mobile.
- Radius: public buttons and chips 999 px, public cards 20 to 24 px, dashboard buttons 10 px, dashboard cards 14 px, inputs and slots 12 px.
- No drop shadows on cards. Separate with a white card on `--page` or a 1 px `--card-border`. Only liquid glass has a shadow.

## Components

- **Buttons.** Primary: neon, ink text, 600, 52 to 56 px tall (public) or 40 px (dashboard), one per screen. Secondary: white with a 1 px border. Selection: blue with white text. Icons are 18 px Heroicons before the label.
- **Slot grid.** 56 px tall. Open: white with border. Taken: divider fill, text-3. Selected: blue, white text.
- **Inputs.** 48 px, 12 px radius, label above at 14/600. Focus: blue border plus a 3 px blue-tint ring.
- **Radio cards.** Selected state has a 2 px blue border and a filled dot.
- **Ticket.** A ticket with a tear-off stub. Court photo, status chip, day and time, facts row, and a check-in QR in black on white with a quiet zone.
- **KPI card.** White, 14 px radius, meta label with icon, 32 to 40 px Satoshi value, sub-line.
- **Timeline.** Rows are courts, columns are hours. Paid is fill, balance due is blue-tint, hold is dashed.
- **FAQ.** Toggle rows with a +/− in a 32 px circle, height animates over 200 ms.

## Icons

Heroicons v2 outline, `@heroicons/react/24/outline`, stroke 1.5. No emoji, no filled icons, no icons in coloured bubbles.

## Liquid glass

At most two glass elements per screen, only over photo or video: the floating nav pill and the "next open" card on the hero.

```css
.glass {
  background: linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,.07));
  backdrop-filter: blur(22px) saturate(160%);
  border: 1px solid rgba(255,255,255,.28);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 24px 60px rgba(14,39,102,.28);
  color: #fff;
}
@media (prefers-reduced-transparency: reduce) {
  .glass { background: rgba(20,34,74,.94); backdrop-filter: none; }
}
```

## Motion

- Easing `cubic-bezier(0.23, 1, 0.32, 1)` for anything that enters or responds.
- 150 to 200 ms for UI, 300 to 600 ms for scroll reveals, never above 800 ms.
- Press: `scale(0.97)` on `:active`. Hover styles only under `(hover: hover) and (pointer: fine)`.
- Each section reveals once when it first enters the viewport (GSAP ScrollTrigger).
- The 3D courts build part by part on first view: floor, lines, net, walls, posts, lights, one court after another.
- The hold countdown changes the number only, with no animation.
- `prefers-reduced-motion: reduce` sets durations to 0 and stops the hero video on its poster.
- Focus: `outline: 2px solid #2D4E9C; outline-offset: 2px`.

## 3D

- three.js through React Three Fiber and drei.
- The courts are built procedurally in `CourtScene.tsx`. The racket is a GLB model in `public/models/racket.glb` with no brand marks.
- Soft hemisphere light plus one directional light. No bloom.
- `dpr` capped at 1.75, the scene pauses off screen, and a static image shows while loading or without WebGL.

## Copy

- Speak to the player: "you", "your game", "your court". Short sentences. No em dashes.
- Banned words: seamless, elevate, unlock, revolutionize, effortless, cutting-edge, game-changer.
- `Rp 550.000`, `20.00`, "20.00 to 21.30".

## Anti-patterns

- Purple or indigo gradients, glowing orbs, mesh backgrounds.
- Three identical feature cards with an icon, a title and two lines.
- Emoji in the UI, stock "team at laptop" imagery, placeholder names like John Doe.
- Centred everything. Layouts are left-aligned and editorial.
- Card shadows, glass on white, more than one neon element per screen.

## Checklist per screen

- [ ] Exactly one neon primary action.
- [ ] Blue only for a selection or the ticket.
- [ ] Heroicons outline only.
- [ ] Prices and times match the seed data.
- [ ] Visible keyboard focus, reduced motion and reduced transparency honoured.
- [ ] Works at 375 px with no horizontal scroll.
- [ ] No em dashes, no banned words.
