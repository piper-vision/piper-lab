# Prompt for Claude Design

Copy/paste this into the Claude Design project (LISTENTO product page wireframe, Pricing section) to fix the Business tier's licensing segmentation. This is scoped only to the Business pricing card — don't touch anything else on the page, and keep LISTENTO and GLIMPSE as separate, independent product pages (no cross-sell changes needed here).

---

I need to fix the Business tier in the LISTENTO pricing section. It currently shows a flat price ("$275.00/yr") next to a "Get in Touch" CTA, which contradicts itself — a stated flat price implies self-serve checkout (like the Basic and Pro tiers, which both have direct "Get X Yearly" buttons), while "Get in Touch" implies a sales-assisted, custom-quote process. Right now a user can't tell which one it actually is.

There are two requirements driving this fix, both from the client brief:

1. **Volume-based routing.** Smaller business enquiries should be able to buy directly (self-serve), while larger deployments (roughly 300+ seats) should be routed to a qualified-lead/contact-sales flow rather than instant checkout.

2. **License-type segmentation.** The business/enterprise segment on this page is currently one generic bucket, but the rest of the site (footer, nav) already separates Business, Education and Students as distinct sectors. The Business tier needs to reflect that schools/colleges (education licensing) and general commercial businesses are different buyer types, not the same thing.

Please restructure the Business card to resolve the contradiction and reflect both splits. A reasonable approach (adjust as needed to fit the existing wireframe style):

- Replace the single flat price with either a real starting/self-serve price (e.g. "From $X/seat/yr") paired with a direct "Get Business Yearly" checkout button for smaller teams, OR remove the flat number entirely and replace it with "Custom pricing" text that matches the "Get in Touch" CTA — pick whichever keeps the price and the CTA behaviour consistent with each other.
- Add a lightweight toggle, tab, or two sub-options within the Business card distinguishing "Business" from "Education" (school/college) licensing, so each links to the appropriate path rather than funnelling everyone through one generic option.
- Add a short qualifying line under the tier (e.g. "For teams under 300 seats. Larger deployments or education licensing — get a custom quote") so it's clear which path a visitor should take before they click anything.

Keep it at the same low-fidelity wireframe style as the rest of the file — grey placeholder boxes, no colour, Arial-style type, italic design-note callouts for anything that needs a decision flagged (e.g. the exact seat threshold, which is still TBC from the client).
