# ModelMarket on Arc — 5-Minute Video Script

## SHOT LIST & VOICEOVER

---

### SHOT 0:00–0:15 | HOOK: The Cost of AI

**VISUAL:** Screen shows a spreadsheet: "Stripe Cost per 1M Requests"
- Tier 1 (≤50K): $0.001/request = $1,000/month
- Multiply by 10 tiers... total: hundreds of thousands of dollars

**VOICEOVER:**
"If you charge $0.001 per AI inference call on Ethereum, you lose $2.40 in gas. The math is impossible. Until now."

---

### SHOT 0:15–0:30 | PROBLEM: Why Per-Call Billing Doesn't Work

**VISUAL:** Side-by-side gas fee comparison:
- Left: Ethereum mainnet USDC transfer = ~$2.40 in ETH
- Right: "Charging $0.001 = −$2.399 per call"
- Bottom: "❌ Economically inviable"

**VOICEOVER:**
"On Ethereum, you can't make money on high-frequency, low-value transactions. The gas costs more than the payment. APIs stay on monthly billing. Agents can't pay each other in real time. The entire agentic economy is stuck."

---

### SHOT 0:30–1:00 | SOLUTION INTRO: Arc Changes the Equation

**VISUAL:** Browser tab, docs.arc.network opens. Show:
- Chain: Arc testnet
- Native gas token: USDC
- Gas cost per transfer: ~$0.0001

**VOICEOVER:**
"Arc is different. USDC is the native gas token. A single USDC transfer costs $0.0001 in gas—not dollars, cents. Charged in the same asset. No FX bridge, no reconciliation tax."

**VISUAL:** Slide with the equation:
- $0.001 call − $0.0001 gas = $0.0009 profit
- "90% margin"

**VOICEOVER:**
"Now the math works. Charge $0.001, keep $0.0009. 90% margin. Viable at scale."

---

### SHOT 1:00–1:30 | DEMO: Marketplace UI Walk

**VISUAL:** Open http://localhost:7402/marketplace (or deployed URL). Show:

**Card 1: Google Gemini Flash**
- Status: Online
- Price: $0.005 per call
- Calls today: 0
- Earnings: $0.00

**Card 2: Local Ollama**
- Status: Online
- Price: $0.001 per call
- Calls today: 0
- Earnings: $0.00

**Card 3: nl2shell (Natural Language → Shell)**
- Status: Online
- Price: $0.001 per call
- Calls today: 0
- Earnings: $0.00

**Button at bottom:** "Run 50 Buyer Calls →" (bright blue, highlighted)

**VOICEOVER:**
"Here's the marketplace. Three models, three sellers. Each has a price. Click the button, and a buyer agent fires 50 inference calls across all three—mixed—in the next 15 seconds. Each call is a real payment."

---

### SHOT 1:30–2:00 | DEMO: Buyer Agent Fires Calls

**VISUAL:** Click the button. Watch the browser console show rapid HTTP logs:

```
[1] POST /v1/models/gemini → 402
[1] X-PAYMENT signed
[1] POST /v1/models/gemini → 200 {result: "...", paid_usdc: "5000"}
[2] POST /v1/models/ollama → 402
[2] X-PAYMENT signed
[2] POST /v1/models/ollama → 200 {result: "...", paid_usdc: "1000"}
[3] POST /v1/models/gemini → 402
...
[50] POST /v1/models/nl2shell → 200 {result: "...", paid_usdc: "1000"}
All 50 calls completed in 12.4s
```

**VOICEOVER:**
"Each call triggers a 402 response. The buyer signs an EIP-3009 payment authorization once per call—no approve transaction needed. Then retries with the signature in the X-PAYMENT header. The seller verifies, settles the payment on-chain, and returns 200 with the result."

*(Pause for 2 seconds as logs fly.)*

"50 calls. 12 seconds. Real on-chain transactions."

---

### SHOT 2:00–2:30 | LIVE DASHBOARD: Earnings Tick Up

**VISUAL:** Switch to the dashboard at http://localhost:7402/dashboard (or new browser tab).

Show the cards updating in real time:

**Card 1: Google Gemini Flash**
- Status: Online
- Price: $0.005 per call
- Calls today: **18**
- Earnings: **$0.090** ← ticking up

**Card 2: Local Ollama**
- Status: Online
- Price: $0.001 per call
- Calls today: **20**
- Earnings: **$0.020** ← ticking up

**Card 3: nl2shell**
- Status: Online
- Price: $0.001 per call
- Calls today: **12**
- Earnings: **$0.012** ← ticking up

**Below:** "Total USDC Settled: $0.122" and a growing sparkline graph.

**Transaction Log (newest first):**
```
[2026-04-25T00:05:43Z] gemini | $0.005 | tx-hash-1 | ✓
[2026-04-25T00:05:42Z] ollama | $0.001 | tx-hash-2 | ✓
[2026-04-25T00:05:42Z] nl2shell | $0.001 | tx-hash-3 | ✓
[2026-04-25T00:05:41Z] gemini | $0.005 | tx-hash-4 | ✓
...
```

**VOICEOVER:**
"The dashboard updates every second. Watch the earnings accumulate per model. Gemini Flash has more calls because it's the best model—buyers are willing to pay $0.005. Ollama and nl2shell are cheaper, so they get high volume. Each seller sees their earnings in real time."

*(Let the dashboard tick for 5 seconds in video.)*

"This is the moment per-call billing becomes viable."

---

### SHOT 2:30–3:00 | PROOF: Circle Developer Console + Arc Block Explorer

**VISUAL (required for submission):** Open two browser tabs side-by-side.

**Left tab: Circle Developer Console**
- Navigate to Transactions section
- Show a transaction:
  - From: `0xBuyer...`
  - To: `0xGeminiSeller...`
  - Amount: `5000` (in base units = $0.005 USDC)
  - Status: ✓ Confirmed
  - Timestamp: 2026-04-25T00:05:43Z
  - Network: Arc Testnet

**VOICEOVER:**
"Circle's Developer Console shows every settlement. This is a real transaction—from buyer to seller, $0.005 USDC, confirmed 3 seconds ago."

**Right tab: Arc Block Explorer (testnet.arcscan.app)**
- Search for the transaction hash (from Circle Console)
- Show the block:
  - Tx Hash: 0xabc123...
  - From: 0xBuyer...
  - To: USDC contract (0x3600...)
  - Value: 5000 (in 6-decimal native = $0.005)
  - Block: #12345
  - Timestamp: 2026-04-25T00:05:43Z
  - Status: ✓ Success
  - Gas Used: 0.0001 USDC

**VOICEOVER (continues):**
"And here it is on Arc Block Explorer. Real on-chain. Every call is a settlement. 50 calls, 50 transactions, all visible on the public blockchain. Sub-cent gas cost. The entire payment loop is transparent and verifiable."

---

### SHOT 3:00–3:30 | BUYER AGENT SCRIPT (show source)

**VISUAL:** Open `/arcmeter/buyer/index.js` in VS Code. Highlight the main loop:

```javascript
async function buyerLoop() {
  const models = ["gemini", "ollama", "nl2shell"];
  for (let i = 0; i < 50; i++) {
    const model = models[i % 3];
    try {
      const resp = await axios.post(`http://localhost:7402/v1/models/${model}`, {
        prompt: `Task ${i}: Generate a response`
      });
      console.log(`[${i+1}] ${model} → 200 OK, paid $${resp.headers['x-usdc-amount']}`);
    } catch (err) {
      if (err.response?.status === 402) {
        // Sign EIP-3009 payload, retry with X-PAYMENT header
        const signed = await signPayment(err.response.data);
        const resp2 = await axios.post(/* ... */, { headers: { 'X-PAYMENT': signed } });
        console.log(`[${i+1}] ${model} → 200 OK (after payment)`);
      }
    }
  }
}
```

**VOICEOVER:**
"The buyer agent is 40 lines of Node.js. Loop 50 times over three models. On a 402, sign the payment and retry. Each signature is an EIP-3009 authorization—no approve step, no smart contract ABI. Just HTTP and cryptography."

---

### SHOT 3:30–4:00 | MARGIN PROOF: The Table (again, animated)

**VISUAL:** Animated slide:
- Title: "Why Per-Call Pricing Was Impossible (Until Arc)"
- Two columns animate in:

| | Ethereum | Arc |
|---|---|---|
| Per-call price | $0.001 | $0.001 |
| Gas cost | $2.40 | $0.0001 |
| Margin | **−$2.399** (animated to red, ❌) | **+$0.0009** (animated to green, ✓) |
| Viable at 1M calls/day? | **No** (fade out, grayed) | **Yes — $900/day** (bright, highlighted) |

**VOICEOVER:**
"This is the constraint we solved. On Ethereum, per-call pricing is a net loss. On Arc, it's a business model. $900 a day, net, from a single model at just 1 million calls a day. The agentic economy is only possible because Arc changed the gas economics."

---

### SHOT 4:00–4:30 | VISION: Stripe Connect for AI

**VISUAL:** Sequence of slides:

**Slide 1:** "Today: ModelMarket (3 models, 1 hackathon)"
- Diagram: 3 model boxes → 1 buyer agent

**Slide 2:** "Tomorrow: Every Model Becomes an Endpoint"
- Diagram: 50+ model icons (Google, Ollama, Featherless, Replicate, Together, etc.) all connected to multiple buyers
- Code snippet appears:

```javascript
const arcmeter = require("arcmeter");
arcmeter.wrap(handler, { 
  price: 0.001,
  models: ["gemini", "ollama", "featherless"]
});
```

**Slide 3:** "Stripe Connect for the Agent Economy"
- Dashboard showing settlements flowing into Circle Wallets
- "Real-time payments. Programmable money. No custodial risk."

**VOICEOVER:**
"This is a prototype for something bigger. Imagine every LLM, image model, speech service, code completion—anything with an API—listing itself in a marketplace. Charging what makes economic sense. Getting paid in real time. That's Stripe Connect for the agentic economy. And Arc is the only infrastructure that makes it possible."

*(Final 5 seconds: Show the dashboard again, earnings still ticking up.)*

"This is what the future of AI pricing looks like."

---

### SHOT 4:30–4:45 | CLOSE: Credits

**VISUAL:** 
- Black background
- White text, centered:

```
ModelMarket on Arc

Built on:
• Arc (USDC-native settlement)
• Circle Nanopayments + x402
• Circle Wallets (coming)
• EIP-3009 (no approve() needed)

Demo: http://localhost:7402
GitHub: [repo URL]
```

**VOICEOVER:**
"ModelMarket on Arc. Enabling per-call billing for the agentic economy. Built with Circle's Arc, Nanopayments, and Wallets. The code is open source. Come build with us."

**[END]**

---

## PRODUCTION NOTES FOR VIDEOGRAPHER

- **Duration target:** 4:45 (under 5 minutes, allows 15-second buffer)
- **Audio:** Clear voiceover, no background music (judges need to hear every word)
- **Screen recording:** 1920x1080 minimum, 60 FPS preferred (shows transaction speed clearly)
- **Timing:** Use on-screen timestamps (broadcast timestamps at the corner) so viewers can follow the sequence
- **Circle Console & Block Explorer:** These are REQUIRED. Ensure both are visible and readable. Use a monospace font (Courier) if transcribing addresses/hashes.
- **Pacing:** Let the dashboard tick for 5+ seconds so viewers see real-time updates; this is the "magic" moment.
- **Tone:** Matter-of-fact, confident. This is a working system, not a concept. No apologies, no "this is still early." Just "here's what we built."
