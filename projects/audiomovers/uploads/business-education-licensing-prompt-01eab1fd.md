# Prompt for Claude Design

Copy/paste this into the Claude Design project (LISTENTO product page wireframe, Pricing section) to fix the Business tier's licensing segmentation. This is scoped only to the Business pricing card — don't touch anything else on the page, and keep LISTENTO and GLIMPSE as separate, independent product pages (no cross-sell changes needed here).

---

I need to fix the Business tier in the LISTENTO pricing section. It currently shows a flat price ("$275.00/yr") next to a "Get in Touch" CTA, which contradicts itself — a stated flat price implies self-serve checkout (like the Basic and Pro tiers, which both have direct "Get X Yearly" buttons), while "Get in Touch" implies a sales-assisted, custom-quote process. Right now a user can't tell which one it actually is.

The actual routing logic is:

- **Small business enquiries are self-serve** — they should see a real price and be able to check out directly, the same way Basic and Pro work.
- **Large business enquiries (roughly 300+ seats) route to a contact form** — no self-serve checkout for this volume.
- **Students always route to a contact form**, regardless of size.
- **Education (schools & colleges) always routes to a contact form**, regardless of size.

So within the Business card specifically, there needs to be a size-based split (self-serve below the threshold, contact form above it), and Students/Education sit outside that split entirely — they never get a self-serve price, no matter how small the enquiry is.

Please restructure the Business card as follows, adjusting to fit the existing wireframe style:

- Give the self-serve path a real starting price (e.g. "From $X/seat/yr") with a direct "Get Business Yearly" checkout button, and a short qualifying line under it (e.g. "For teams under 300 seats").
- Add a clearly separate "Larger team, or Education/Students?" line or link below the self-serve pricing that routes to a contact form — covering all three of: large business (300+ seats), Education, and Students. These three don't need separate CTAs from each other, just separate from the self-serve business path — a single contact form covering all three is fine unless you want the form itself to ask which category the enquiry falls under.
- Make sure nothing in this card implies Education or Students can ever reach a self-serve price — only the small-business path should show a real number and a checkout button.

Keep it at the same low-fidelity wireframe style as the rest of the file — grey placeholder boxes, no colour, Arial-style type, italic design-note callouts for anything that needs a decision flagged (e.g. the exact seat threshold, which is still TBC from the client).
