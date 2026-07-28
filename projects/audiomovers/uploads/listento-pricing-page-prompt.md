# Prompt for Claude Design

Copy/paste this into the Claude Design project to build a new, standalone LISTENTO pricing page.

---

I need a dedicated LISTENTO pricing page, separate from the LISTENTO product page. Per the client brief, this should be built from the same pricing component already on the product page — not a different design — just expanded, since it now has a full page to itself rather than being one section mid-page.

**Reuse as-is from the product page:**
- The Monthly/Yearly toggle above the tiers.
- The Basic / Pro / Business comparison table, including the Business tier's seat-count input (live price calculation, CTA and pricing swap to "Contact us" / "Custom pricing" once the entered seat count crosses the enterprise threshold).
- The "Education or Students? Get in touch" link under the Business tier, unaffected by seat count.
- Standard site header (Products / Solutions / Downloads / News / Support nav, including the Solutions dropdown) and footer.

**What makes this page longer than the product-page section:**

1. **Full, uncollapsed feature comparison table.** The product page has a "Compare all features ↓" link implying more rows exist than are shown there. On this page, show the complete comparison table in full — every feature row across Basic/Pro/Business, not the condensed list.

2. **A billing-focused FAQ section — separate from the Product FAQ on the product page.** The product page's FAQ covers compatibility, trial mechanics and workflow fit. This one should instead cover: monthly vs. annual billing, upgrading/downgrading between tiers, cancellation and refund policy, accepted payment methods, invoice billing for the Business tier, and seat/licence management (adding, removing, reassigning). This follows directly from the brief's own suggestion that pricing-table content "common to all plans" is often better handled as FAQ content than repeated across tiers.

3. **Reuse the testimonial section** from the product page, to keep some trust reinforcement present this late in the funnel, right before someone commits to a plan.

**One constraint to keep in mind:** don't add or imply any multi-product bundling or combined checkout (e.g. "add LISTENTO + GLIMPSE to cart"). The billing provider (PadelBilling) can't currently support bundled purchases — flag this with an italic design note anywhere the layout might otherwise suggest combining products, so it's not accidentally designed in.

Keep it at the same low-fidelity wireframe style as the rest of the file — grey placeholder boxes, no colour, Arial-style type, italic design-note callouts for anything still TBC.
