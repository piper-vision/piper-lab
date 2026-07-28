# Prompt for Claude Design

Copy/paste this into the Claude Design project (LISTENTO product page wireframe, Pricing section) to replace the Business tier's size toggle with a seat-count input. Scoped only to the Business pricing card — don't touch Basic, Pro, or anything else on the page.

---

In the Business pricing card, there's currently a "Small teams / 300+ seats" toggle above the CTA. Replace it with a seat-count input instead of a toggle — the toggle doesn't let someone specify an actual quantity (e.g. a business ordering 4–15 seats has no way to represent that), and per the brief, small business enquiries need to be able to buy directly rather than being pushed into an enquiry form.

Replace the toggle with:

- A number input or stepper directly on the card, labelled something like "How many seats?" with a sensible default (e.g. 5).
- The displayed price should live-update based on the entered number, calculated as seats × $275/licence/yr (adjust the per-licence rate to whatever the actual figure is).
- Keep the CTA as "Get Business Yearly," pointed at checkout with that seat count pre-filled, for any quantity below the enterprise threshold (currently ~300 seats, per the brief — flag as TBC with an italic design note since the exact cutoff isn't finalised).
- Once the entered number reaches the threshold (300+), automatically swap the CTA to "Contact us" and swap the price display to "Custom pricing" — the routing should be driven entirely by what the user enters, not by a separate switch.

Leave the "Education or Students? Get in touch" link exactly as it is, sitting below this input as its own separate, always-visible line — that path should never be affected by the seat count, since Education and Students always route to the contact form regardless of size.

Keep it at the same low-fidelity wireframe style as the rest of the file — grey placeholder boxes, no colour, Arial-style type, italic design-note callouts for anything still TBC (the seat threshold, the exact per-licence rate).
