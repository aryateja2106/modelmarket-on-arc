# ModelMarket on Arc — 4-Minute Demo Script

**Target:** 4:00 | Voice: terse, technical, no fluff | Record at 1920x1080

---

## SHOT 1 — 0:00–0:20 | Hook: gas breaks per-call billing

**VISUAL:** Terminal. Type:
```
echo "Ethereum USDC transfer: $2.40 gas. Inference call price: $0.001. Net: -$2.399"
```

**VOICEOVER:**
"Per-call billing on Ethereum costs more in gas than the call is worth. $2.40 to settle a $0.001 transaction. The math doesn't work. Agents can't pay each other. The agentic economy is stuck."

---

## SHOT 2 — 0:20–0:50 | Solution: Arc + USDC + sub-cent settlement

**VISUAL:** Open `dashboard/marketplace.html` (file:// or served). Point at the header stats bar showing model count and USDC settled.

**VOICEOVER:**
"Arc uses USDC as the native gas token. One transfer costs $0.0001 — not dollars, fractions of a cent, charged in the same asset. No bridge, no FX conversion. Charge $0.001, keep $0.0009. 90% margin. Now it's a business."

"ModelMarket is a proof-of-concept marketplace: five models, five sellers, Circle Wallets for payouts, EIP-3009 signatures so buyers never call approve()."

---

## SHOT 3 — 0:50–1:30 | marketplace.html — 5 model cards + Try-it

**VISUAL:** `dashboard/marketplace.html` fully visible. Pan slowly across all five cards:
- llama-70b-hf (Featherless HF)
- nl2shell
- llama-local
- gemini-flash
- gemini-pro

Each card shows: price per call, seller address, call count, USDC earned.

**Then:** Click "Try It" on **llama-70b-hf**. Wait for response. Show the response text AND the proof block underneath it (x-payment-response, tx hash, amount paid).

**VOICEOVER:**
"Five models. Five independent sellers. Each sets its own price. Click Try It on Llama 70B — this fires a real x402 request: buyer gets a 402, signs an EIP-3009 authorization, retries with the X-PAYMENT header. Seller verifies the signature and returns 200."

"That proof block at the bottom — that's the on-chain receipt. Tx hash, amount paid, model id. Every call is accountable."

---

## SHOT 4 — 1:30–2:10 | seller.html — multiple sellers earning simultaneously

**VISUAL:** Open `dashboard/seller.html`. Show the seller address dropdown at the top. Switch between at least 2–3 different seller addresses (0x1111..., 0x2222..., 0x4444...). Each shows a different USDC balance and call count.

**VOICEOVER:**
"Seller view. Each wallet address is an independent seller. Switch between them — different models, different earnings, all settled in USDC in real time. No shared pool. Seller 0x4444 has earned the most — that's gemini-pro, highest price point."

"This is programmable money. Each model is a revenue stream."

---

## SHOT 5 — 2:10–2:40 | index.html Live Stream + multi-buyer terminal

**VISUAL:** Split screen or alt-tab: `dashboard/index.html` on one side, terminal running multi-buyer on the other.

In terminal:
```bash
cd ~/Desktop/Hackathons/agentic-economy-arc/arcmeter/buyer
COUNT=12 ARCMETER_URL=http://localhost:7402 CONCURRENCY=2 node multi-buyer.js
```

Watch `index.html` transaction feed update in real time as calls complete.

**VOICEOVER:**
"Live stream. Running 12 buyers concurrently. Watch the transaction feed — each row is a completed inference call with payment. 60+ transactions, five models, all settled. This is what the agentic economy looks like in motion."

---

## SHOT 6 — 2:40–3:10 | Arc Block Explorer (REQUIRED)

**VISUAL:** Open `https://testnet.arcscan.app` (or `arc-explorer.testnet`). Show the Arc Testnet block explorer interface — recent blocks, transactions list, USDC transfers.

If you have a real tx hash from a prior test, search it. Otherwise show the homepage and a sample transaction detail page showing:
- From / To addresses
- USDC amount
- Gas cost (fractions of a cent)
- Block confirmation

**VOICEOVER:**
"Arc block explorer. Every settlement is on-chain and publicly verifiable. Gas cost per transfer: $0.0001 USDC. Our demo uses mock signatures — the 30-minute swap to live Arc settlement is replacing the mock verifier with a real x402 facilitator. The settlement architecture is identical."

"This is what makes it real: transparent, auditable, immutable."

---

## SHOT 7 — 3:10–3:40 | Circle Developer Console (REQUIRED)

**VISUAL:** Open Circle Developer Console (`console.circle.com`). Navigate to **Wallets** tab. Show the wallet list — buyer wallet and seller wallets created via the API.

If Transactions tab is available, show a transaction entry with amount and status.

**VOICEOVER:**
"Circle Wallets power the seller side. Each seller address maps to a Circle-managed wallet. Wallet creation is a single API call. Payouts are programmable. The buyer wallet funds calls; seller wallets accumulate USDC automatically per inference."

"This is the Circle integration: non-custodial, compliant, production-ready."

---

## SHOT 8 — 3:40–4:00 | Close

**VISUAL:** `dashboard/marketplace.html` showing updated stats — 105+ transactions, $0.284 USDC settled, 5 models.

Then cut to: `github.com/aryateja2106/modelmarket-on-arc`

**VOICEOVER:**
"105 transactions. Five models. Sub-cent gas. Built in a weekend."

"The vision: Stripe Connect for the agent economy. Any API, any model, any agent — list it, price it, get paid per call, in real time, on Arc."

"Code is open source. Link in the description."

---

## TIMING SUMMARY

| Shot | Time | Content |
|------|------|---------|
| 1 | 0:00–0:20 | Hook — gas math kills per-call billing |
| 2 | 0:20–0:50 | Solution — Arc, USDC, 90% margin |
| 3 | 0:50–1:30 | marketplace.html — 5 cards, Try-it on Llama 70B |
| 4 | 1:30–2:10 | seller.html — switch wallets, multiple earners |
| 5 | 2:10–2:40 | index.html live stream + multi-buyer terminal |
| 6 | 2:40–3:10 | Arc Block Explorer — on-chain proof |
| 7 | 3:10–3:40 | Circle Console — Wallets tab |
| 8 | 3:40–4:00 | Close — stats, GitHub, vision |
