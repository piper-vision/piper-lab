# Audiomovers Website Redesign — Sitemap & Information Architecture

Prepared by KOTA · Day 1 discovery output · Sources: client brief (27 May 2026), signed Statement of Work v2, kickoff call (16 July 2026 — Granola transcript + notes), User Flows & Wireframes notes, live-site audit of audiomovers.com (Firecrawl, 22 July 2026, cross-checked against a fuller July 1 content extraction).

This document is structure only — page list, hierarchy, page purpose, and section/block-level content with a reason for each block. No visual or layout detail. It's built to hand straight to wireframing.

---

## 1. Intake summary

**Business goal:** increase conversion from new site visitor to subscription trial start — the single top priority above all else, per the brief and SOW.

**Primary conversion action:** start a free trial (subscription products) or free download/demo (perpetual products), via the persistent "TRY [PRODUCT] FREE" header CTA.

**Audiences (in priority order per brief section 7):**
1. New user, undecided — landed on a product page from an ad, deciding whether to try it.
2. New business/enterprise user — needs pricing clarity and a pre-qualification path (small teams self-serve, large teams routed to sales).
3. Existing direct user — onboarding, feature adoption, upgrade.
4. Existing user — cancellation flow (win-back framing).
5. Lapsed user — win-back.
6. Existing user needing support (billing, product, account).
7. New user buying a perpetual product outright.
8. Existing business/enterprise user managing licences (out of scope — authenticated account area).

**New audience this project exists to serve:** film/TV/gaming professionals arriving for the new video product (codename **Glimpse**, launching September 2026), who don't yet know the Audiomovers/LISTENTO brand and need a different trust-building path than the existing music-industry audience.

**Must-have pages (contractual, per signed SOW sitemap):** Home, Product pages, Pricing, Sectors pages, Downloads, Single download, News, Single news article, About Us, Support + Support category pages, Single FAQ, Press, Podcast, Legal, Search results. Checkout flow and the authenticated account area are UX/design-only — no development in this project.

**Content volume:** large. ~90 news articles, 80+ individual FAQ articles, 7 products (6 existing + Glimpse), 3 existing sector pages. This is a content-heavy site, not a brochure site — nav and template decisions need to hold up under volume, not just look clean with 5 sample pages.

**Competitor/reference sites:** NordVPN (brief) — clear hierarchy, painless purchasing journey, fast sign-up.

**CMS/platform:** Storyblok retained; migrating front-end from Create React App to Next.js (SSR). Most CMS content retained as-is; new/reworked components scoped at discovery. This favours evolving the current IA rather than starting from a blank page — carry-forward is the default, not the exception.

**Decided since the first draft of this document (22 July, Matt):**
- **Plan selection happens before sign-up.** Confirmed direction: users choose their plan up front, ahead of any account-creation wall, rather than today's sign-up-first flow. This resolves what was an open question at kickoff and is now built into the Pricing and Checkout flow sections below.
- **LISTENTO and Glimpse get a different template approach from the five perpetual-purchase products.** Not a shared one-size template with minor variants — two genuinely distinct page patterns, reflecting that subscription tiers and one-off purchases are different enough commercially to need different structures.
- **Pricing moves from one consolidated page to individual pages per product**, with "Pricing" becoming a nav dropdown (mirroring "Products") rather than a single link. See the restructured Pricing section below — this is a scope change against the signed SOW, flagged accordingly.

**Still open, not yet decided (from kickoff call — genuinely unresolved, not KOTA's call to make unilaterally):**
- Whether users are currently browsing or landing directly on what they need — affects how much homepage/nav work matters vs. product-page-direct-entry work.
- Whether audio and video products would ever bundle (10–20% overlap expected, not an ongoing bundle for now).

These don't block the sitemap below, but they do affect wireframe-stage flow decisions — flagging so they're not silently assumed one way.

---

## 2. Existing-site audit — what changed from assumptions

A fuller content extraction exists from 1 July 2026 (in project files) covering marketing pages, product pages, downloads, press, podcast, news and terms verbatim. This session re-mapped and spot-checked the live site on 22 July via Firecrawl to catch anything missed or changed since, because two of that document's conclusions turned out to be wrong and matter to this project:

- **"No dedicated Business page exists — net-new build."** Incorrect. `/audiomovers-for-business` resolves to canonical `/sectors/business` and is a live, populated page today, alongside `/sectors/education` and `/sectors/students`. The SOW's own sitemap already reflects this (marks Sectors pages as **Reskin**, not new). The brief's "no dedicated business landing page" pain point is really about the page's clarity and pre-qualification, not its existence.
- **"FAQ/support is unreachable — no `/faq` page, subdomain didn't load."** Incorrect. `/support` resolves to canonical `/support/get-help` and is fully live, with working sub-pages for product/billing/account support and 80+ individual FAQ articles under `/articles/faq/...`. The brief's complaint stands (it's genuinely hard to *find* and browse), but the content and URL structure already exist and match the SOW's expected routes almost exactly — this is a restructuring and surfacing job, not a from-scratch build.

Both corrections matter because they change several pages in the carry-forward audit below from "new build" to "reskin/restructure of real content," which is lower risk and different work than building from nothing.

**New findings from this session's crawl, not in the earlier extraction:**
- A parallel, redundant taxonomy exists for articles: `/tag/[topic]` (~26 tags — LISTENTO, OMNIBUS, DOLBYATMOS, PROTOOLS, etc.) and `/category/[name]` (Press, News, Product Support, Billing Support, Guest Editorial) both archive the same underlying articles differently, alongside `/news` and `/press` as their own hand-curated lists. Four different ways to arrive at overlapping content, no single canonical browse path.
- Two near-duplicate press destinations: `/press` (curated mentions + awards + press kit download) and `/press-releases` (a separate, dedicated press-release archive with its own press kits). SOW's sitemap only mentions `/press`.
- `/wp/` resolves to a 404. Dead, orphaned link — not real content, don't carry forward, just make sure it 301s or drops cleanly.
- `referrals.audiomovers.com` is a separate subdomain (referral program) with thin/placeholder-looking content on the one page checked. Outside this project's domain and SOW scope — flagging its existence rather than silently ignoring it, but not treating it as part of this sitemap.
- Several bare-slug product URLs exist alongside the canonical `/products/[slug]` ones (e.g. `/listento`, `/omnibus`, `/minibus`, `/inject`, `/binaural-renderer-for-apple-music`). Likely redirect aliases — worth explicit confirmation so the SOW's 301 redirect work covers them.
- A one-off campaign landing page exists (`/marketing/back-to-school`) built ad hoc outside any general template — direct evidence for the brief's requested page-builder template; this is the kind of page that template should replace going forward.

None of the above changes the SOW's contracted page list. They do change how several rows in that list should be scoped, and they surface a few things (the redundant taxonomy, the duplicate press pages, the dead link) that were never explicitly commissioned but sit inside the pages that were — flagging for a decision rather than quietly carrying them all forward or quietly dropping them.

---

## 3. Proposed sitemap

### Primary navigation (6 items + persistent CTA + account/search)

`Products` (dropdown) · `Sectors` (dropdown) · `Pricing` (dropdown — updated 22 Jul, was a single link) · `Downloads` · `News` · `Support` — plus a persistent **"Try [Product] Free"** CTA and account/search icons, matching the current live header pattern and within the 5–7 top-level item convention. Three of the six top-level items are now dropdowns rather than one — worth a sense-check at wireframe stage that this doesn't tip into feeling menu-heavy, given the brief's own complaint that the current header is "fiddly and very information dense."

### Footer navigation

`About Us` · `Press` · `Podcast` · `Terms` · `Privacy Policy` · `CCPA Policy` · `Abbey Road Studios` (external)

### Full page hierarchy

```
Home  /
Products  (nav dropdown, no index page)
├── LISTENTO                          /products/listento
├── Glimpse [working name — video]    /products/glimpse            ⚑ new
├── AirCaster                         /products/aircaster
├── Binaural Renderer for Apple Music /products/binaural-renderer-for-apple-music
├── Inject                            /products/inject
├── Minibus                           /products/minibus
└── Omnibus                           /products/omnibus
Sectors  (nav dropdown, no index page)
├── Business                          /sectors/business
├── Education                        /sectors/education
├── Students                          /sectors/students
└── Film / TV / Gaming                /sectors/[tbd]                ⚑ new — confirmed with Matt 22 Jul, slug TBD
Pricing  (nav dropdown, updated 22 Jul — was a single page)
├── LISTENTO                          /pricing/listento             ⚑ new — subscription-tier template
├── Glimpse [working name]            /pricing/glimpse              ⚑ new — subscription-tier template
├── AirCaster                         /pricing/aircaster            ⚑ new — perpetual-purchase template
├── Binaural Renderer for Apple Music /pricing/binaural-renderer-for-apple-music  ⚑ new — perpetual-purchase template
├── Inject                            /pricing/inject               ⚑ new — perpetual-purchase template
├── Minibus                           /pricing/minibus              ⚑ new — perpetual-purchase template
└── Omnibus                           /pricing/omnibus              ⚑ new — perpetual-purchase template
    (old consolidated /pricing page retired — see §5 Flag 7 for redirect handling)
Downloads                              /downloads
└── Single download (×7, one per product)  /download/[product]      ⚑ new
News                                    /news
└── Single news article                /articles/news/[slug]
Press                                   /press
Podcast                                 /podcast
About Us                                /about
Support                                 /support/get-help
├── Product support                    /support/product
├── Billing support                    /support/billing
├── Account support                    /support/account             ⚑ unverified, see §6
├── Contact us                         /support/contact-us
└── Single FAQ                         /articles/faq/[slug]
Legal / Terms                           /terms
Search results                          /search
Landing page template (page builder)    /marketing/[slug]           ⚑ new template

Checkout flow (UX/design only, no build)
├── Login / sign up
├── Plan select (subscription products)
├── Checkout upsell
├── Payment details (Paddle iframe — no UX/UI work, provider-controlled)
└── Order complete

Account area (UX audit + styleguide only, no build)  my.audiomovers.com
```

---

## 4. Per-page breakdown

Each entry: purpose (the one job this page does that no other page does), task type as contracted in the SOW, and the sections/blocks it needs — each with a reason, and a note on whether the copy/structure is carried from the live site or needs to be written new.

### Home — `/`
**Purpose:** convert a cold/warm visitor into a trial start or a "which product is this for me" decision, for both existing (music) and new (video) audiences simultaneously. **Task: Full rebuild.**

| Block | Reason | Source |
|---|---|---|
| Hero (flexible/dynamic) | Brief + kickoff explicitly ask for a hero that can flex to promote whichever product needs it (new video launch, seasonal campaigns like Black Friday) rather than being hard-coded to LISTENTO — this is the #1 homepage change requested. | New component, existing hero copy as fallback content |
| Product grid | Existing site's clearest "what do you sell" moment; needs to expand from 6 to 7 cards and resolve the messaging hierarchy problem (LISTENTO is historically dominant, but video is the launch priority) | Carried copy, new hierarchy/prioritisation |
| Contextual CTA | Brief explicitly asks to evolve the single "TRY LISTENTO FREE" CTA into something that responds to context (which product/audience the visitor is likely here for) | New |
| Trust/credential strip | Proven high-value content (Grammy-winning names) that supports the "mature, trusted, high-quality" brand positioning the video launch specifically needs with a less-forgiving new audience | Carried verbatim |
| Latest news teaser | Existing funnel entry point; brief wants blog→funnel entry points to work harder | Carried, content refresh ongoing |
| Podcast teaser | Existing engaged-audience content; SOW confirms podcast cards get reused here | Carried |

### Product pages — `/products/[slug]` (×7)
**Purpose:** get a visitor who already knows roughly what this product does to a trial/purchase with minimal friction. **Task: Full rebuild** — updated 22 July: **two distinct templates, not one shared template with variants.**

**Template A — Subscription products (LISTENTO, Glimpse):**

| Block | Reason | Source |
|---|---|---|
| Hero (name, headline, short description, price-from, single CTA, supported platforms) | Existing pattern tested and working; SOW/brief ask for cleaner hierarchy, not reinvention | Carried (LISTENTO), new (Glimpse) |
| Benefit blocks (title + subcopy, 3–6 per product) | Core product explanation; existing copy is substantial and product-specific, no reason to discard | Carried verbatim (LISTENTO), new (Glimpse) |
| Video/demo row | Brief specifically flags "balance of imagery/video" as underused today — existing rows are mostly text links, an upgrade opportunity | Carried links, new presentation |
| Pricing teaser + "See plans" link | Full tier comparison now lives on the product's own dedicated pricing page (see restructured Pricing section below) rather than being embedded in full here — the product page's job is to sell the product, the pricing page's job is to help pick a plan | New (pricing detail moved off this page) |
| Credential wall | Consistent trust-building pattern across all product pages, product-specific names already exist | Carried verbatim (LISTENTO), new (Glimpse) |
| Closing CTA | Standard close; needs the same contextual-CTA treatment as the homepage | Carried, new logic |

**Template B — Perpetual-purchase products (AirCaster, Binaural Renderer, Inject, Minibus, Omnibus):**

| Block | Reason | Source |
|---|---|---|
| Hero (name, headline, short description, one-off price, Buy Now / Free Demo CTAs, supported platforms) | Same pattern as today, but structurally simpler than the subscription hero since there's one price, not a tier choice | Carried verbatim |
| Benefit blocks (title + subcopy) | Carried per product | Carried verbatim |
| Video/demo row | Same upgrade opportunity as Template A | Carried links, new presentation |
| Feature/spec list (currently embedded in some product pages, e.g. OMNIBUS's AVB/NDI channel counts) | These products sell on capability/spec rather than tiered value — worth keeping spec detail close to the product rather than pushed to a separate pricing page | Carried verbatim |
| Credential wall | Same trust-building pattern | Carried verbatim |
| Closing CTA (Buy Now / Free Demo) | Simpler than Template A's contextual logic — one product, one price, one decision | Carried, minor logic update |

**Glimpse (new video product)** uses Template A but with entirely new copy — no existing content to carry forward, and this is the page carrying the most commercial weight in the whole project (the reason the redesign is happening). Flag: content/copy for this page depends on brand guideline and product-messaging work still in progress; this is a schedule dependency, not an IA one.

### Pricing — `/pricing/[product]` (×7) — restructured 22 July, was one consolidated `/pricing` page
**Purpose:** updated from "single source of truth for everything" to "help a visitor who's already interested in one specific product pick a plan and commit" — one page per product, reached via the new Pricing nav dropdown, and the page where plan selection now formally happens (point 1, confirmed 22 July: plan is chosen here, before any account/sign-up wall). **Task: full rebuild**, scope increase from the SOW's original single-page brief — flagged in §5.

**Subscription pricing pages (LISTENTO, Glimpse) — `/pricing/listento`, `/pricing/glimpse`:**

| Block | Reason |
|---|---|
| Tier comparison (Basic / Pro / Business) | Brief's #1 flagged pain point — carried data, needs the same simplification pass as before, just now living on its own page instead of embedded three times across the site (product page, old `/pricing`, and this page) |
| Plan selector / CTA per tier | This is now the actual point of plan selection in the funnel, per the confirmed flow — needs to hand off cleanly into login/sign-up with the chosen plan already carried forward, not lost |
| Billing toggle (monthly/annual) | Carried from the existing pricing table; kickoff notes flagged the "monthly ↔ annual" toggle logic as mildly confusing today — worth a clarity pass, not a redesign |
| Business/Enterprise tier explainer | "Get in touch" tier has no self-serve path today by design (Paddle can't bundle/reassign licences pre-Billing-migration) — kickoff notes flag this as needing a clearer, more transparent explanation of what the tier actually includes |

**Perpetual-purchase pricing pages (AirCaster, Binaural Renderer, Inject, Minibus, Omnibus) — `/pricing/[product]`:**

| Block | Reason |
|---|---|
| Single price + feature checklist | One price, one decision — no tier comparison needed, so this page is intentionally thinner than the subscription pricing pages (point 2's template split applies here too) |
| Buy Now / Free Demo CTAs | Carried directly from today's product-page pricing blocks |
| Worth a build-vs-merge check at wireframe stage | Because these pages are inherently thin (a single price and a couple of CTAs), it's worth sense-checking with Matt/Nat whether they earn a fully separate URL or would serve the user just as well as an anchor/section on the product page itself — flagging rather than assuming |

### Sectors — `/sectors/business`, `/sectors/education`, `/sectors/students`
**Purpose:** pre-qualify and route enterprise/institutional buyers so low-value enquiries self-serve and high-value ones reach sales. **Task: Reskin**, HubSpot form embed retained.

| Block | Reason |
|---|---|
| Hero + value prop | Existing copy is solid (licence reassignment, flexible payment, bespoke limits, centralised management, expert support) — reskin only |
| Feature list | Carried verbatim across all three sector pages, near-identical structure today |
| Enquiry form (HubSpot) | Explicitly retained per SOW; kickoff notes flag the segmentation/definition of "who counts as enterprise vs. self-serve" as still unclear and needing to be more transparent on this page specifically — a content/clarity fix, not a structural one |

**Film/TV/Gaming sector page — new, confirmed 22 July.** Not in the SOW's original contracted list, but confirmed as needed: this audience is expected to arrive largely via organic search rather than direct-to-product entry, so a dedicated Sectors page is needed to establish trust and context before routing into the Glimpse product page — the same job the existing Business/Education/Students pages do for their audiences. Slug and exact positioning (under Sectors vs. a launch-specific URL) still TBD; content depends on brand guideline and product-messaging work in progress. Flag this as a scope addition against the signed SOW (Sectors pages were contracted as reskin-only, covering the three existing pages) — worth a one-line note to Nat/Abbey Road so it's an acknowledged addition rather than a surprise at review.

### Downloads — `/downloads`
**Purpose:** get an existing or new user to the correct installer for their product/OS as fast as possible. **Task: Full rebuild** — explicitly the page the brief calls "visually overwhelming."

| Block | Reason |
|---|---|
| Search/filter | Already exists in the current design; the fix here is making six-stacked-tables navigable, not adding net-new functionality |
| Per-product version table | Core data (release date, version, OS, notes, legacy toggle) is all real and current — carry the data, redesign the density |

### Single download — `/download/[product]` (×7)
**Purpose:** land a user who already knows their product on exactly that product's install info, nothing else. **Task: New page** — SOW explicitly calls this net-new, replacing today's versioned-installer-filename URLs.

Content is a subset of the existing `/downloads` data, filtered to one product — no new copy required, just a new URL/template.

### News — `/news`
**Purpose:** central content hub, and (per SOW's functionality table) a funnel entry point into trial conversion. **Task: Reskin.**

Current state is ~90 articles in one undifferentiated chronological list mixing product announcements, artist case studies, how-to guides, and press — exactly the brief's "leading people into the funnel from blog" ask, currently unmet because there's no way to tell these content types apart at a glance. Reskin scope should include resolving this via the categorisation/filtering already promised in the SOW's functionality table, rather than leaving the single flat list as-is.

### Single news article — `/articles/news/[slug]`
**Task: Reskin.** Existing article template and copy carried verbatim; SOW example URL confirmed live and matches.

### Press — `/press` and Press Releases — `/press-releases`
**Purpose:** press mentions/awards (`/press`) vs. downloadable press releases and kits (`/press-releases`). **Task: Reskin** (per SOW, `/press` only — `/press-releases` isn't in the SOW's sitemap at all).

Both pages exist live today and serve genuinely overlapping purposes for two different visitor intents (journalist looking for a release to download vs. a general visitor scanning credibility). Flagged in §5 for a merge-or-keep-both decision rather than silently carrying one forward and dropping the other, or silently merging them without sign-off.

### Podcast — `/podcast`
**Task: Reskin**, reusing the homepage's podcast card component per SOW. 22 episodes carried verbatim.

### About Us — `/about`
**Task: Reskin.** Mission/story copy and the Nile Rodgers advisory board module carried verbatim — this is correctly the lowest-density, lowest-priority page in the whole project relative to Home/Product/Downloads/Support.

### Support — `/support/get-help`
**Purpose:** self-serve support hub, the brief's second-most-cited pain point after conversion itself ("buried and difficult to find"). **Task: Full rebuild**, explicitly scoped for search, navigation and FAQ organisation work.

| Block | Reason |
|---|---|
| Three-way category split (Product / Billing / Account) | Already exists and is a sound structure — the rebuild is about surfacing and searching it better, not reinventing the split |
| Popular FAQs | Existing "load more" pattern works but scales poorly across 80+ articles without real search — matches the SOW's "on-site FAQ and support search with categorisation" functionality requirement |

### Support category pages — `/support/product`, `/support/billing`, `/support/account`
**Task: Full rebuild.** Product support already lists all 6 existing products with dedicated FAQ groupings per product (Glimpse will need one added). Billing support covers payments/upgrades/discounts. Account support exists per the hub page's own copy but its URL couldn't be independently confirmed in this crawl — see §6.

### Support: Contact us — `/support/contact-us`
**Task:** covered under the Support full-rebuild scope. Existing form (OS/DAW/issue-type fields) carried as structure; content unchanged.

### Single FAQ — `/articles/faq/[slug]`
**Task: Reskin.** 80+ individual FAQ articles exist and were spot-checked directly against the SOW's own example URL — confirmed live, verbatim carry-forward.

### Legal — `/terms`
**Task: Reskin.** Full EULA, Paddle billing-as-seller-of-record disclosure, 14-day cooling-off right, and open-source licence schedule — carried verbatim, correctly low-priority for visual work.

### Search results — `/search`
**Task: Reskin.** Functionality explicitly kept as-is per SOW; only visual alignment needed.

### General-purpose landing page template — `/marketing/[slug]`
**Task: New template**, not a fixed page. Brief explicitly asks for this so sales/events/social-ad landing pages can be built internally without a dev cycle each time. `/marketing/back-to-school` is today's evidence of the gap this template fills — built as a one-off outside any repeatable system.

### Checkout flow (Plan select → Login/sign-up → Upsell → Payment details → Order complete)
**Task: UX/design only, no development.** Updated 22 July: **plan select now confirmed to happen first**, on the product's dedicated pricing page, before any account-creation wall — reordered from today's live flow (sign-up before plan) and from the "still open" status this was under at kickoff. Payment details step remains a Paddle-provided iframe, explicitly out of scope for UX/UI work. One thing to pin down at wireframe stage: since plan selection now lives on `/pricing/[product]` rather than being a distinct checkout screen, confirm exactly where the flow "starts" for a user coming from a product page CTA vs. one coming from a pricing-page CTA, so the handoff into login/sign-up carries the selected plan cleanly either way.

### Account area — `my.audiomovers.com`
**Task: UX audit + styleguide only, explicitly no development** (SOW marks the authenticated account area fully out of scope for build). User Flows notes flag two concrete issues worth carrying into the styleguide brief: multi-tab navigation reads as confusing, and the "you can't log in until you verify your email" state isn't currently communicated clearly to the user.

---

## 5. Flags requiring a decision

**Flag 1 — RESOLVED 22 July.** Confirmed with Matt: this audience is expected to arrive largely via organic search rather than direct-to-product entry, so a dedicated `/sectors/[tbd]` page is needed (same job the existing Business/Education/Students sector pages do), separate from the Glimpse product page. This is a scope addition against the signed SOW, which only contracted the three existing sector pages as reskins — recommend flagging this one line to Nat/Abbey Road as an acknowledged addition rather than letting it surface as a surprise later. Exact slug, nav placement, and section content still to be defined once brand/product-messaging work lands.

**Flag 2 — Two press destinations, one contracted.** `/press` and `/press-releases` both exist live and serve adjacent-but-different intents (credibility browsing vs. downloadable release/press-kit access). SOW only contracts `/press`. Recommend confirming with the client whether `/press-releases` is being intentionally retired, folded into `/press`, or simply missing from the SOW by omission — carrying it forward silently or dropping it silently are both the wrong call to make unilaterally.

**Flag 3 — Redundant article taxonomy (tags vs. categories vs. hand-built lists).** `/tag/[topic]` (~26 tags), `/category/[name]` (5 categories), `/news`, and `/press` all archive overlapping article content in different ways today, with no single canonical browse path. The SOW's functionality table already promises "filtering by category and content type" as part of the FAQ/support search work — recommend this becomes the single resolved mechanism, with the standalone tag and category archive URLs either redirected into it or retired, rather than carrying all four systems forward in parallel.

**Flag 4 — Business/Enterprise segmentation clarity.** Kickoff notes flag that "Enterprise is ill-defined by the business" and needs clearer segmentation by licence type up front. This reads as a content-and-messaging fix to the existing `/sectors/business` page (and possibly the Pricing page's Business tier) rather than a new page — flagging so it doesn't get lost between IA and copywriting ownership.

**Flag 5 — Mobile-to-desktop purchase journey.** Not a sitemap/page-list issue (no new pages implied), but flagging since it's a named priority: the brief and kickoff call both note heavy mobile traffic that rarely completes purchase, since the products are desktop software. A proposed "send me a link" capture-and-defer CTA pattern was discussed but not decided. This affects component/CTA design on Product and Pricing pages at the wireframe stage, not the page list itself.

**Flag 6 — Bundling/basket, explicitly ruled out.** Kickoff notes confirm no plans for "add to basket"/multi-product cart interactivity on the marketing site — noting this here so it isn't proposed at wireframe stage as an IA "improvement." Business/enterprise multi-licence bundling happens via backend workaround today and via Paddle Billing basket links (not surfaced on-site) once migrated.

**Flag 7 — Pricing restructure is a scope change against the signed SOW, and the old `/pricing` URL needs a decision.** The SOW contracted one `/pricing` page, full rebuild. Moving to 7 individual `/pricing/[product]` pages (confirmed 22 July) is materially more page-build work than what was scoped/quoted — worth a one-line flag to Nat/Abbey Road so it's an acknowledged change, not a surprise at the next milestone review. Separately, `/pricing` is a real, presumably SEO-valuable URL today — recommend deciding whether it 301s to the LISTENTO pricing page (most-trafficked product), becomes a thin index linking out to all 7, or something else, rather than letting it dead-end.

**Flag 8 — Are dedicated pricing pages worth it for the five perpetual products?** Confirmed direction is individual pricing pages for every product, but AirCaster/Binaural Renderer/Inject/Minibus/Omnibus each have just one price and one CTA — there's very little on these pages that isn't already on the product page itself. Flagging so this gets a deliberate "yes, separate page" answer at wireframe stage rather than defaulting to it because the nav pattern implies one page per product — a thin, near-empty page is its own kind of usability problem.

---

## 6. Carry-forward audit

Every page/content type found on the live site, and its disposition in the new sitemap.

| Existing page/type | Nav position | Disposition |
|---|---|---|
| `/` Home | Primary | Carried forward — full rebuild |
| `/products/listento` | Products dropdown | Carried forward — full rebuild |
| `/products/aircaster` | Products dropdown | Carried forward — full rebuild |
| `/products/binaural-renderer-for-apple-music` | Products dropdown | Carried forward — full rebuild |
| `/products/inject` | Products dropdown | Carried forward — full rebuild |
| `/products/minibus` | Products dropdown | Carried forward — full rebuild |
| `/products/omnibus` (canonical for `/omnibus`) | Products dropdown | Carried forward — full rebuild |
| — (no existing video product page) | — | New — Glimpse product page added |
| `/pricing` | Primary | **Superseded** — replaced by 7 individual `/pricing/[product]` pages (see Flag 7 for redirect/index decision on the old URL) |
| `/sectors/business` (canonical for `/audiomovers-for-business`) | Sectors dropdown | Carried forward — reskin |
| `/sectors/education` (canonical for `/audiomovers-for-education`) | Sectors dropdown | Carried forward — reskin |
| `/sectors/students` (canonical for `/audiomovers-for-students`) | Sectors dropdown | Carried forward — reskin |
| — (no existing film/TV/gaming sector page) | — | New — confirmed 22 Jul, scope addition against signed SOW (see Flag 1) |
| `/downloads` | Primary | Carried forward — full rebuild |
| Versioned installer download pages (e.g. `/downloads/Omnibus-Installer-...`) | Orphaned (not in nav) | Superseded by new `/download/[product]` pages; content merged in, old URLs need 301s |
| `/news` | Primary | Carried forward — reskin |
| `/articles/news/[slug]` (~90 articles) | Reached via News/tags/categories | Carried forward verbatim — reskin |
| `/press` | Footer | Carried forward — reskin |
| `/press-releases` | Orphaned (not in nav, not in SOW) | **Flagged — see Flag 2** |
| `/podcast` (22 episodes) | Footer | Carried forward — reskin |
| `/about` | Footer | Carried forward — reskin |
| `/support/get-help` (canonical for `/support`) | Primary | Carried forward — full rebuild |
| `/support/product` (canonical for `/help/guides`) | Support sub-nav | Carried forward — full rebuild |
| `/support/billing` | Support sub-nav | Carried forward — full rebuild |
| `/support/account` | Support sub-nav (referenced in copy, URL not independently confirmed) | Carried forward — **status: could not fully audit, needs manual URL check** |
| `/support/contact-us` | Support sub-nav | Carried forward, in scope of Support rebuild |
| `/articles/faq/[slug]` (80+ articles) | Reached via Support | Carried forward verbatim — reskin |
| `/terms` | Footer | Carried forward — reskin |
| `/search` | Header icon | Carried forward — reskin, functionality unchanged |
| `/marketing/back-to-school` (example one-off landing page) | Orphaned (campaign-only) | Not carried forward as a fixed page; its existence justifies the new general-purpose landing-page template |
| `/tag/[topic]` (~26 tag archives) | Orphaned (not in main nav) | **Flagged — see Flag 3** — recommend consolidating into News/Support filtering rather than carrying forward as standalone URLs |
| `/category/[name]` (5 category archives) | Orphaned (not in main nav) | **Flagged — see Flag 3** — same as above |
| `/wp/` | Orphaned | **Status: could not audit — resolves to a 404.** Not carried forward; confirm it 301s cleanly rather than dead-ending |
| Bare-slug product URLs (`/listento`, `/omnibus`, `/minibus`, `/inject`, `/binaural-renderer-for-apple-music`) | Orphaned | Presumed redirect aliases to canonical `/products/[slug]` — confirm and fold into the SOW's 301 redirect scope |
| `my.audiomovers.com`, `/account`, `/forgot`, `auth.pre-prod.*`, `my.pre-prod.*` | Account subdomain | Out of scope for build (SOW) — UX audit/styleguide only |
| `transmitter.audiomovers.com`, `/sessions` | Product app subdomain | Out of scope — these are the product itself (LISTENTO transmitter/receiver), not the marketing site |
| `/purchase/price-plan`, `/purchase/payment-info` | Checkout flow | Out of scope for development (Paddle-provided); UX/design only per SOW |
| `referrals.audiomovers.com` | Separate subdomain | **Status: could not fully audit** — thin/placeholder content on the one page checked, outside this project's domain; flagging its existence rather than assuming it's irrelevant |

---

## 7. Handoff to wireframing

Ready to pass to `wireframe-from-sitemap`: the page hierarchy and section lists in §3–4 above, plus the full existing-site content inventory (July 1 extraction + this session's additions) for real copy on every reskin/carry-forward page. Before wireframes start on Sectors, Pricing, Product pages, or the homepage hero, Flags 1–2, 4 and 7–8 above should be resolved — they change section-level content or page count on those specific pages, not just visual treatment.

## 8. Summary

- **Total pages in new sitemap:** ~31 page types (7 product pages across 2 templates, 4 sector pages including the new film/TV/gaming page, 7 individual pricing pages across 2 templates, downloads ×2 templates, news ×2 templates, support ×5, plus Home/Press/Podcast/About/Terms/Search), up from the ~25 in the first draft of this document, driven by the pricing restructure — down from a more fragmented ~30+ live URL patterns once the tag/category redundancy (Flag 3) is resolved.
- **Nothing on the live site is being silently dropped.** Every existing page and content type has an explicit disposition above; the only page marked for removal outright is the dead `/wp/` 404 and the superseded `/pricing` URL (replaced, not dropped — see Flag 7), and the only genuinely open "keep or cut" call is `/press-releases` (Flag 2).
- **Two corrections to prior assumptions:** the Business sector page and the FAQ/support structure both already exist and are more complete than earlier documentation suggested — this is restructuring real content, not building from zero, on both of the brief's most-cited pain points.
- **Confirmed with Matt on 22 July:** film/TV/gaming gets its own new Sectors page (Flag 1); plan selection now happens before sign-up, on each product's dedicated pricing page; LISTENTO/Glimpse and the five perpetual products get two genuinely different page templates, not one shared template; Pricing moves from one page to a dropdown of 7 individual pages.
- **Two of these are scope changes against the signed SOW** (the new Sectors page, and the 1-page-to-7-page pricing restructure) — both flagged for a one-line heads-up to Nat/Abbey Road rather than surfacing as a surprise at the next milestone review.
- **Sign-off:** Flags 1 and the three 22-July decisions resolved with Matt (KOTA). Flags 2, 3, 4, 6, 7 and 8 still open — recommend a short review of those before locking the structure and starting wireframes.
