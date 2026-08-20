# KOTA Design System

KOTA is a creative digital agency (London) working with "brands who refuse to blend in" — branding, websites, and digital experiences for clients. Positioning: **Brand led. Strategically built.** Mission pillars: Design with guts · Nail the process · Build to flex · Create to convert.

KOTA doesn't ship its own end-user app — its "product" is the agency itself, presented through **kota.co.uk**, the marketing website. That's the one surface this system builds a UI kit for.

> **Before writing ANY copy with this system — a deck, a screen, a single button label — read CONTENT FUNDAMENTALS below.** KOTA's voice is Colourful + Conversational + Non-conformist, always together: playful but decisive, "we" not "KOTA" after the first mention, contractions, short words, zero emoji, zero clichés, "shit-hot" is the ceiling on profanity. This is not optional flavour text — check new copy against all three pillars before you ship it.

## Sources

- Brand guidelines (Corebook): `https://my.corebook.io/KOTA` — pages: About us, Tone of voice, Logo, Colour, Typography, Graphic components (scraped July 2026). Not fetchable by agents without a human login — treat as reference, not a live link.
- Tone-of-voice one-pager: `uploads/kotatov.png` ("Talk like KOTA") — supplied directly by the user; the full guide is transcribed into CONTENT FUNDAMENTALS below and rebuilt as live specimen cards under the "Voice" group in the Design System tab.
- Font binaries: Neue Montreal Regular + Medium OTFs, and Syne Bold TTF, supplied directly by the user (`uploads/NeueMontreal-Regular.otf`, `uploads/NeueMontreal-Medium.otf`, `uploads/Syne-Bold.ttf`).
- Logo vectors supplied directly by the user (`uploads/kota-logo-keyline-black.svg`, `uploads/kota-logo-keyline-white.svg`), plus two further approved lockups found alongside them in the attached brand folder (`kota-logo-square.svg`, `kota-logo-colourways.svg`).
- Official downloads referenced in the guidelines (Dropbox — not fetchable by agents, ask a human): `KOTA-Fonts.zip`, `KOTA-logo.zip`, `KOTA-Gradients.zip`, animated logo `.mov` files.
- Website reference: screenshots embedded in the brand book itself ("Colour in action", "UI in action", type-in-action pages) show the kota.co.uk look circa the agency's 10-years campaign. No production website code was attached, so the Website UI kit in this system is a faithful recreation from those brand-book captures and the Corebook copy — not a pull from a live codebase.

## Index

- `styles.css` — global CSS entry point (imports everything under `tokens/`)
- `tokens/` — colours, typography, spacing/radii, motion, fonts (`@font-face`), base resets
- `assets/logo/` — real vector logo files (square lockup, keyline black/white, approved colourways sheet)
- `assets/graphics/` — corner-arrow motif (black + white)
- `assets/fonts/` — Neue Montreal OTFs, Syne Bold TTF
- `guidelines/` — 23 foundation specimen cards (Brand / Colors / Spacing / Type / Voice groups in the Design System tab)
- `components/core/` — Button, IconButton, Tag, Badge, Card, Capsule
- `components/feedback/` — Dialog, Toast, Tooltip
- `components/forms/` — Input, Select, Checkbox, Radio, Switch
- `components/navigation/` — Breadcrumb, Tabs
- `ui_kits/website/` — kota.co.uk-style marketing site: header/footer + Home, Work, Studio, Contact screens, interactive shell in `index.html`
- `SKILL.md` — agent-skill entrypoint (portable to Claude Code)

## CONTENT FUNDAMENTALS — "Talk like KOTA"

Transcribed from KOTA's own tone-of-voice guide (`uploads/kotatov.png`). Live specimens of everything below are in the Design System tab under **Voice**. Any copy written with this system — decks, UI kits, marketing pages, this readme — should be checked against all three pillars together, not just one.

**Official positioning statement** — use verbatim for intro/about copy. Bold the phrases shown; don't underline them (underline is reserved for headlines, see below):

> **We're** the **creative digital agency** that works with **brands who refuse to blend in**, helping them make sure their branding, website and digital is as **brilliantly unique** as them.

### The three voice pillars — always together, never just one

- **Colourful** — sounds like *engaging, witty language that showcases our way with words*. Doesn't sound like *absurd, frantic or hard to follow*.
  - Be playful — have fun with dense or dull topics: talk about the elephant in the room, or use engaging language as a way around it.
  - Be decisive — decide what you want to say and stick to it; throwing every idea at the reader means none of them land.
  - Read it aloud — if it sounds unnatural out loud, simplify the sentence, swap the adjectives, or introduce some gentle wit.
  - Real example: **"Making brands a damn site better."** Why it works: we could've just said "improving brands" — instead we played on "damn sight" to reference our core service.

- **Conversational** — sounds like *inclusive and down-to-earth, welcoming everyone into the conversation*. Doesn't sound like *cheesy, soft, or without strategic focus*.
  - We before KOTA — it's more inclusive to say "we". Use "KOTA" no more than once on a page, then "we" after that.
  - Cut it out — swap "we are" for "we're"; keep language as close to everyday speech as possible. Contractions strongly encouraged.
  - Be clear — don't use ten long words when four short ones will do; every word counts, especially on social.
  - Real example: **"Let's get cracking"** → button **"Start your project."** Why it works: a much less formal way of starting that first conversation. Simple, but effective.

- **Non-conformist** — sounds like *crafted language that goes above and beyond just relaying information*. Doesn't sound like *aggressive, bizarre or pretentious*.
  - Be imaginative — we can't sound like everyone else; headlines and openers need to grab attention. Leave "cutting-edge agile innovation" to someone else.
  - Remember audience — what excites them? How formal are they? What terminology are they expecting?
  - Keep it classy — non-conformist isn't licence to litter writing with profanity or emoji. The occasional "shit-hot" is fine; nothing more eyebrow-raising than that.
  - Real example: **"Shit-hot work for hot-shot brands."**

### Rules that apply everywhere

- **No emoji, ever.** Unicode arrows (→ ↗) are fine inline; emoji are not.
- **Casing:** headlines/body are sentence case with full stops ("We are experts in bringing brands to life digitally."). SECTION TITLES ARE UPPERCASE (the "OUR / VALUES" pattern). Syne straplines are lowercase ("rebel against boring"). Meta/labels are tracked-out uppercase ("CELEBRATING 10 YEARS : 2013 – 2023").
- **Emphasis:** headlines get exactly one underlined key phrase ("We are **<u>experts</u>** in bringing brands to life digitally"). Body/intro paragraphs use **bold** for emphasis instead (see positioning statement above) — underline is reserved for display headlines only.
- **More real copy:** "We build immersive, brand-led digital experiences that wow and work hard." / "Award-winning creative web design." / "Good is the enemy of great… we leave no crumbs."

The `ui_kits/website/` screens now put the three pillar examples above to work verbatim — "Making brands a damn site better" (Home), "Shit-hot work for hot-shot brands" (Work), "Let's get cracking" / "Start your project" (Contact) — as a working demonstration, not just a rule written down.

## VISUAL FOUNDATIONS

- **Colour balance:** grey `#EFEFEF`, black `#000`, and white `#FFF` are the *only* page backgrounds. The five secondary pastels — pink `#EFB2D9`, purple `#C4B5F3`, blue `#A8E1EC`, green `#D7E1D3`, peach `#F8E5CB` — are highlights only: value capsules, showcase/social backgrounds, logo colourways. Never body text; never large text on top of them except in black.
- **Type is always monochrome** — black on light surfaces, white on dark, never coloured type. Neue Montreal Regular 400 carries giant headlines and body copy; Medium 500 carries display emphasis and all buttons. Syne Bold is strictly "design furniture": straplines, tiny page titles, breadcrumbs — never body copy.
- **Section-title pattern:** uppercase Neue Montreal Regular, tight tracking (−0.03em), with line two indented/offset to the right — e.g. "OUR" / "VALUES". Numbered list items use "01/" style prefixes.
- **Gradients:** four approved linear pairs (purple–pink, blue–purple, peach–pink, blue–peach) plus "Flow Gradients" — organic, vivid magenta/purple/blue atmospheric fields in light and dark variants, sometimes circular and bleeding off the page edge. CSS recipes live in `tokens/colors.css` (`--flow-light`, `--flow-dark`, `--flow-soft`) approximating the brand's downloadable gradient assets. Gradients are backgrounds only — never put small text directly on them without a scrim.
- **Shapes:** pills everywhere — keyline tag chips, filled black pills, big rotated colour capsules for the agency's values. Rounded-edge image masks (~32px radius, sometimes with one corner "swollen" to ~72px) for photography; fully circular masks for showcase crops and avatars.
- **Borders:** crisp 1px black keylines mark boundaries. **Shadows: none, anywhere** — the brand is flat; separation comes from colour blocking and keylines, not elevation.
- **Corners:** cards sit at ~20px radius; image masks at ~32px; buttons/chips are always full pill. Never a sharp 4–8px "app" corner radius.
- **Signature motif:** the chunky corner arrow (↘ / ↙, 8px stroke) — shipped as real SVGs in `assets/graphics/`. A smaller gradient-stroked version of the same arrow marks project-card links in the Work grid.
- **Imagery:** natural, warm, candid team photography; project/client work is shown inside device crops, browser chrome, or bento-style grids. The white keyline logo may sit over photography with a black scrim for legibility — but the logo must **never** sit over client work.
- **Motion:** rich but smooth — expo-out reveals, marquee text loops, hover inversions (a pill flips from outline to filled black/white), gradient drift. Never bouncy or springy; see `tokens/motion.css` for the two eases (`--ease-out`, `--ease-inout`) and three durations (fast/med/slow).
- **Hover states:** fill inverts (an outline pill fills solid black or white), underlines thicken, corner arrows nudge along their diagonal, images scale to ~1.03 inside their mask.
- **Press states:** no separate press/active treatment observed in the source material beyond the hover fill — components in this system don't add one that isn't grounded in the guidelines.
- **Layout:** generous grey negative space; content max-width ~1440px with fat gutters (`--page-gutter`, clamps 24–72px); header is logo-left + meta strapline + circled hamburger-right. Footers and some section bands go full black.
- **Bento boxes:** mixed-span grids of rounded tiles present multiple visuals in a single frame (seen in the brand book's "UI in action" spread).
- **Transparency & blur:** used sparingly — the hero's flow-gradient blob carries a light blur, and the modal scrim is a 55% black overlay (`--overlay-scrim`). No frosted-glass / backdrop-blur panels in the source material.
- **Imagery colour vibe:** warm, natural, candid — not desaturated, not heavily graded, no grain filter observed.

## ICONOGRAPHY

- **No icon font, no icon system.** KOTA's UI iconography is minimal and hand-kept, not pulled from a library.
- The recurring marks are: the corner-arrow motif (`assets/graphics/arrow-corner.svg` / `arrow-corner-white.svg`), simple 2px-stroke directional arrows inside buttons and links (see `Button`'s `arrow` prop), a circled hamburger (two 2px lines inside a 1px keyline circle — see `IconButton`), and plain `+`/`×` marks for expand/close.
- Icons are always monochrome — black or white, stroke-based, geometric. No filled glyph icons observed.
- **No emoji, ever.** Unicode arrows (→ ↗) are acceptable inline inside pill buttons and breadcrumbs at body text sizes, but the dedicated arrow SVG is preferred wherever it fits.
- If a screen genuinely needs an icon this system doesn't cover, the nearest safe substitute is a thin-stroke geometric set at `stroke-width: 2` (e.g. Lucide) — **flag it as a substitution** and keep it rare; it should read as hand-drawn-simple, not like a UI-kit icon sprite.

## Components

Brand guidelines define no UI component inventory (Corebook covers logo/colour/type/graphic-components, not a UI kit), so `components/` is a standard primitive set, styled strictly from the observed website look and the flat/pill/keyline system above. See "Intentional additions" below.

- **Core** (`components/core/`) — `Button`, `IconButton`, `Tag`, `Badge`, `Card`, `Capsule`
- **Feedback** (`components/feedback/`) — `Dialog`, `Toast`, `Tooltip`
- **Forms** (`components/forms/`) — `Input`, `Select`, `Checkbox`, `Radio`, `Switch`
- **Navigation** (`components/navigation/`) — `Breadcrumb`, `Tabs`

Each component is `<Name>.jsx` + `<Name>.d.ts` (props contract) + `<Name>.prompt.md` (usage), with one demo card per directory (`core.card.html`, `feedback.card.html`, `forms.card.html`, `navigation.card.html`).

### Intentional additions

- The entire `components/` set is an intentional addition — no source defined one. Sized and styled to the brand's own flat/pill/keyline language (no shadows, no non-pill corners, monochrome type), not a generic framework's defaults.
- `Capsule` generalises the brand book's rotated value-pill graphic ("Get Dirty Quickly", "No Crumbs") into a reusable decorative primitive.
- `Card`'s `flow-light` / `flow-dark` surfaces approximate the brand's downloadable gradient assets as CSS recipes (see `tokens/colors.css`), since the actual gradient files are only available as a Dropbox download no agent can fetch.

## UI kits

- **`ui_kits/website/`** — kota.co.uk-style marketing site. `index.html` is an interactive shell: circled-hamburger menu opens a full-black numbered overlay (`01/ Home`, `02/ Work`, …) that switches between four screens, all built from the `components/` primitives above:
  - `WebsiteHeader` / `WebsiteFooter` — logo + meta strapline + hamburger; black CTA footer with link columns
  - `WebsiteHome` — flow-gradient hero with underlined headline, services tags, project-shot placeholders, Syne "rebel against boring" strapline band
  - `WebsiteWork` — black section, offset "OUR / WORK" title, project cards with gradient corner-arrows + year badges, filter tags
  - `WebsiteStudio` — offset "OUR / VALUES" title, five numbered rotated value capsules with real KOTA values copy, team imagery in swollen-corner and circular masks
  - `WebsiteContact` — display headline, pill form card (`Input`/`Select`/`Checkbox`/`Button`), black info card, success `Toast`
  - `Placeholder` — striped placeholder standing in for real photography; swap out for real shots
  - No production website code was available, so layout fidelity comes from the brand book's own website screenshots rather than a codebase — see Caveats.

## Caveats / open questions

- **No UI-kit source for the website.** The Corebook brand guidelines don't include the live site's code, so `ui_kits/website/` is built from the guidelines' embedded screenshots and copy, not a 1:1 code port. Treat it as "on-brand and plausible", not pixel-exact to the current live site.
- **Gradient assets are CSS approximations.** The brand offers a downloadable `KOTA-Gradients.zip` (Dropbox, not fetchable here) of the real Flow Gradient artwork. `--flow-light` / `--flow-dark` / `--flow-soft` in `tokens/colors.css` are hand-built `oklch()`/radial-gradient recipes in the same spirit, not the original files.
- **No animated logo.** The guidelines mention animated logo `.mov` files (Dropbox) — not included; static SVGs only.
- **No second product.** Everything points to kota.co.uk as the one public surface; no separate app was in scope, so only one UI kit exists.
- **Starting points:** component/screen `@startingPoint` tags were intentionally omitted — this system's compiler reports that mechanism as superseded by the newer template system, which wasn't requested here. Ask if you'd like a proper starting-point template built for the website shell.

**Ask:** this system leans heavily on brand-book screenshots and Corebook copy rather than a live codebase or Figma file — if you can get us Figma access or the real kota.co.uk repo, we can tighten the Website UI kit from "faithful recreation" to pixel-exact, and pull the real Flow Gradient assets instead of the CSS approximation. Flag anything above that reads wrong and we'll iterate.
