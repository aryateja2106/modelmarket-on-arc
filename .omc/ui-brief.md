# ModelMarket UI/UX Brief

Owner: worker-2  
Recipient: worker-3  
Scope: `arcmeter/dashboard/index.html`, `marketplace.html`, `seller.html`, `styles.css`, `app.js` only.

## Goal

Make the three dashboard pages judge-readable in a 5 minute hackathon demo: the screen should instantly communicate that ModelMarket is a USDC-per-call AI inference marketplace on Arc, that calls are settling live, that buyers can try a model through an x402-style payment flow, and that sellers earn USDC per inference.

Keep this as a polish pass. Do not rearchitect the app, change API contracts, remove mock fallback behavior, or break the 50+ transaction demo loop.

## Atlas Alignment

This repo follows Atlas. Preserve and tighten the existing Atlas-like implementation in `styles.css`.

- Canvas stays pure AMOLED `#000`; no dark gray page backgrounds.
- Primary CTAs use near-white fill (`--accent-primary`), never blue. Blue is for focus, links, selected state, and active dots only.
- Use saturated colors only for status semantics: live/paid/success, warning, error, info. Avoid decorative gradients and broad color washes.
- Keep sizing compact: 13px base text, 28px buttons, 24px inputs, dense table rows.
- Use the 4px spacing grid. Do not introduce 5px, 7px, 10px, 14px, 18px, or 22px.
- Radius must stay 3px, 4px, 6px, or full pills only.
- Borders define surfaces. Do not add card shadows; shadows are only acceptable for the Try-it modal overlay.
- Lucide icons only, 1.5px stroke. No emoji or unicode symbols.
- Default hover transitions should be `background-color` only at about 120ms. Avoid animating icon color. Existing counter flashes are acceptable if restrained.
- Modal backdrop should feel like Atlas overlay: blurred backdrop, compact bordered panel, clear payment and response states.
- Ensure responsive behavior does not wrap nav/status into broken rows at mobile widths.

## Global Navigation And Shell

Current top nav is the right shape. Polish expectations:

- Brand: `ModelMarket` must be visible as the product name in the first viewport.
- Keep three routes obvious: Live Stream, Marketplace, Seller.
- Right status should be judge-readable: live dot plus `Live`/`Offline`; if possible add a short mono sublabel like `API :7402` without clutter.
- Active nav state should be high contrast but monochrome: white text plus near-white underline/border, not blue CTA treatment.
- Mobile: nav can horizontally scroll or compact, but must not overlap the status indicator or clip text incoherently.

## Page 1: `index.html` Live Stream

Primary message: "paid AI calls are settling live on Arc."

Information hierarchy:

1. Header row
   - Title: `Live Stream`
   - Subtitle: `USDC settlements on Arc · 1s poll`
   - Optional right-side compact demo badge: `Demo run: 60 calls target` or `Sub-cent calls`.

2. Stat grid
   - Total transactions: largest attention after title.
   - USDC settled: show six decimals so sub-cent economics are obvious.
   - Calls/sec: live activity proof.
   - Avg latency: confidence that inference is usable.
   - Keep values mono/tabular and stable width so updates do not cause layout shift.

3. Arc economics strip
   - Keep the current "Why Arc?" callout, but make it tighter and numeric.
   - Suggested copy: `Arc keeps $0.001 inference viable: USDC gas + sub-cent settlement preserve margin where mainnet gas cannot.`
   - This should read as a proof point, not a marketing hero.

4. Live transaction ticker/table
   - This is the demo centerpiece. Make newest rows visibly enter or highlight briefly, then settle back into the table.
   - Columns should prioritize: time, model, buyer/from, paid amount, latency, output.
   - Amount should read as paid USDC, e.g. `$0.001000`, not just a green number with no context.
   - Empty state should instruct: `Start the buyer agent to stream paid calls.`
   - Add a small header counter like `50 latest · newest first` if the current count is available.

Judge-visible elements during video:

- Counter moving from 0 toward 60 or already showing 60+.
- `$0.140000` or current settled total visible without scrolling.
- Rows showing multiple models, unique buyers, latency, and outputs.
- Live status dot active.

## Page 2: `marketplace.html` Marketplace

Primary message: "a buyer can discover AI models and pay per call."

Information hierarchy:

1. Header/summary row
   - Title: `Marketplace`
   - Subtitle: `Buy AI inference with USDC · x402 on Arc`
   - Right summary: total settled on Arc, mono six-decimal USDC.

2. Filter row
   - Keep compact pills for All, Gemini, Ollama, Mock/nl2shell.
   - Active filter should be visually clear with border/selected fill.
   - If model count is available, keep it on the right.

3. Model cards
   - Each card should show, in order: model name, backend pill, owner address, one-line description, price per call, total calls, Try it CTA.
   - Price must be prominent and unambiguous: `$0.001000 / call` or equivalent. Sub-cent pricing is a core judging point.
   - Try it button is the only primary CTA on each card. Use near-white fill, not blue.
   - Cards should have consistent minimum height so the CTA row aligns across the grid.

4. Try-it modal
   - This is the key buyer UX. It should make the payment flow legible without adding extra steps.
   - Header: model name, backend/price meta.
   - Body: prompt textarea first, then a compact payment preview before submit:
     - `Price`
     - `Network`
     - `Recipient`
     - `Header`
   - Submit button label should be specific, e.g. `Pay and run`.
   - On submit: show status sequence in-place: `Requesting price`, `Signing X-PAYMENT`, `Running inference`, then response.
   - Response block should show output and a payment confirmation line when available: tx hash/payment id, amount, and latency if the API returns it.
   - Error state must be clear and non-destructive; keep prompt text intact.
   - Escape key, backdrop click, and close button should still work.

Judge-visible elements during video:

- Three model choices visible at once on desktop if data permits.
- Price per call visible on each model card.
- Try-it modal showing a prompt, payment preview, response, and payment confirmation.
- The CTA text communicates that this is paid inference, not a free playground.

## Page 3: `seller.html` Seller Dashboard

Primary message: "model sellers earn USDC from paid calls."

Information hierarchy:

1. Header row
   - Title: `Seller`
   - Subtitle: `USDC earnings from paid inference on Arc`
   - Keep last-updated timestamp near the earnings panel, not as the main title.

2. Seller address control
   - Keep input and Load button compact.
   - Default-loaded seller should be obvious. If a seller loads automatically, show a small label like `Loaded from first listed model`.
   - Error state should not erase prior good data unless the searched address is truly 404.

3. Earnings hero
   - Total earned is the largest number on the page.
   - Supporting stats: total calls, models listed, average per call.
   - USDC amount must use six decimals for hackathon economics.
   - Use a restrained live tick/highlight when earnings change.

4. Per-model breakdown
   - Rows should show model name, backend, calls, earned.
   - Earned column right-aligned and mono.
   - If room, include price/call or average/call as an additional compact column.
   - Empty state should explain what to do next: load a seller address or run buyer traffic.

Judge-visible elements during video:

- Total earned visible without scrolling.
- Per-model rows demonstrate revenue split across models.
- Average per call reinforces the sub-cent marketplace economics.
- Live status dot active.

## Demo-Readiness Checklist

Worker-3 should verify these before posting diffs:

- `index.html`, `marketplace.html`, and `seller.html` load directly from `dashboard/` and still call `http://localhost:7402`.
- Running API in mock mode still supports the 50+ transaction loop.
- No dashboard code requires real Circle keys or real x402 keys to render.
- Navigation works between all three pages.
- Live status changes to `Live` when API polling succeeds and `Offline` when it fails.
- Amounts are formatted as USDC with enough decimals to prove sub-cent pricing.
- Try-it modal can submit a prompt and recover from API errors without losing the prompt.
- New transaction rows are obvious but not visually noisy.
- Desktop viewport around 1440px shows the core proof points without scrolling past the fold.
- Mobile viewport around 390px has no overlapping nav, clipped buttons, or unreadable tables/cards.
- Keyboard focus is visible on links, buttons, inputs, and textarea.
- Lucide icons render after dynamic card/modal updates.
- No emoji, no blue primary CTAs, no decorative shadows on cards.
- Reduced-motion users should not get disruptive decorative animations.

## Suggested Surgical CSS/JS Fixes

- Add missing Atlas tokens if useful: `--ease-apple`, `--dur-fast`, `--dur-base`, `--dur-slow`.
- Replace modal flat fade with blurred backdrop and Atlas overlay timing while preserving current DOM.
- Consider adding utility classes for `mm-kpi-grid`, `mm-proof-strip`, `mm-payment-preview`, and `mm-tx-ticker` rather than many inline styles.
- Keep existing inline page scripts if faster; do not convert to a build system.
- Avoid changing endpoint names or response assumptions unless worker-4 changes require it.

## Handoff Notes

Priority order:

1. Buyer Try-it modal clarity on `marketplace.html`.
2. Live transaction table/ticker readability on `index.html`.
3. Seller earnings hierarchy on `seller.html`.
4. Mobile/responsive cleanup.
5. Micro-polish after behavior is verified.

Post your diffs or a summary back to worker-2 and leader when ready. I will review against this brief and send focused feedback.
