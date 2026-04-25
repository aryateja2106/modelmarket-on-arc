# ModelMarket on Arc — 5-Slide Pitch

---

## Slide 1: Problem

**APIs and AI inference are trapped in monthly billing.**

Developers want to charge per-request in USDC: $0.001 per inference, $0.0001 per token. But per-call billing has been economically impossible on every chain until now.

Why? On Ethereum mainnet, a single USDC transfer costs ~$2.40 in gas. Charging $0.001 loses 99.96% of revenue to gas. Even L2s leave pennies of overhead per tx. The math doesn't work.

Result: APIs resort to monthly invoicing, agent-to-agent commerce stays on-ledger (no real settlement), and the agentic economy can't exist at scale.

**Speaker note:** "We've built something that makes per-call billing viable. Here's how."

---

## Slide 2: Solution — ModelMarket on Arc

**Arc + USDC nanopayments change the equation.**

ModelMarket is a marketplace where any developer lists an AI model (Google Gemini, local Ollama, or any HTTP endpoint) and earns real USDC per inference call — settled on-chain in near real-time.

How?
- **Arc is USDC-native.** USDC is the gas token. No FX bridge, no reconciliation tax.
- **Per-tx gas is sub-cent.** ~$0.0001 to settle a $0.001 call = 90% margin.
- **x402 is HTTP-native.** 402 → buyer signs EIP-3009 → seller settles → 200. No smart contract ABI learning curve.

The result: $0.001 per call, real on-chain settlement, sub-second latency, Stripe-shaped developer experience.

**Speaker note:** "The only difference between this and impossible is the chain. Here's what real looks like."

---

## Slide 3: Demo — The Marketplace in Action

**Watch three sellers earn USDC in real time.**

(Video shows:)
1. Marketplace UI lists three models:
   - Google Gemini Flash ($0.005/call)
   - Local Ollama ($0.001/call)
   - nl2shell (mock, $0.001/call)

2. Click "Run buyer agent" → 50+ calls fire across all three models in <15 seconds.

3. **Each call:**
   - Buyer sends `{ prompt }`
   - Seller responds 402 (payment required)
   - Buyer signs once per call (EIP-3009)
   - Buyer retries with `X-PAYMENT` header
   - Seller settles, returns 200 + result

4. **Dashboard updates every 1 second:**
   - Total USDC settled: $0.05 → $0.10 → $0.15...
   - Per-model earnings ticking up
   - Transaction log: 50 rows, newest first
   - Latency: avg 80ms per call

5. **(Production mode only)** Circle Developer Console shows the settlement transaction. Arc Block Explorer (`testnet.arcscan.app`) shows the on-chain USDC transfer.

**Speaker note:** "50 transactions, under 15 seconds, each one a real USDC settlement. This is what the agentic economy looks like."

---

## Slide 4: Margin Proof

**The economic viability argument (in one table).**

| | Ethereum mainnet | Arc testnet |
|---|---|---|
| **Per-call price** | $0.001 | $0.001 |
| **Gas cost per tx** | ~$2.40 | ~$0.0001 |
| **Margin per call** | **−$2.399 (loss)** | **+$0.0009 (90% margin)** |
| **Viability at 1M calls/day** | **Impossible** | **Yes — $900/day net** |

On Ethereum, you lose money on every call. On Arc, you keep 90 cents per call.

This is not a faster L1. This is the only chain where the math works.

**Speaker note:** "Arc isn't just cheaper. It's the only chain where per-call pricing clears. That's the difference between a hack and a business model."

---

## Slide 5: Vision — Stripe Connect for the Agent Economy

**Every model on Earth becomes a paying endpoint.**

Today: ModelMarket is three models in a hackathon demo.

Tomorrow: Every LLM, image model, voice model, code completion service lists itself. Developers integrate with one line:

```javascript
const arcmeter = require("arcmeter");
arcmeter.wrap(handler, { price: 0.001, models: ["gemini", "ollama", "local"] });
```

Buyers (agents or humans) call any model, get a 402, sign once, and pay. Settlements batch hourly to reduce chain overhead. Earnings flow to seller wallets in USDC.

The result: **Stripe Connect for AI. Programmable money that's viable at high frequency. Real agent-to-agent commerce at scale.**

Arc makes this possible. x402 makes it simple. Circle Wallets make it accessible.

**Speaker note:** "This is the infrastructure layer for the agentic economy. We're showing the prototype. The vision is every model, every agent, every API you use, could have a price you're comfortable paying and a margin the seller can live on. That's the shift."

---

**Timing:** Slide 1 (0:00–0:30), Slide 2 (0:30–1:00), Slide 3 / demo (1:00–2:30), Slide 4 (2:30–3:00), Slide 5 (3:00–4:30).
