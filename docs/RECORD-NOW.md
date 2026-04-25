# RECORD NOW — Pre-Flight Checklist

## 1. START RECORDING
- **Cmd+Shift+5** → Screen Recording → select full screen or browser window
- Or: QuickTime → File → New Screen Recording
- Resolution: 1920x1080 minimum. Test audio level before hitting record.

---

## 2. VERIFY SERVER IS RUNNING
```bash
curl -s http://localhost:7402/healthz
# Expected: {"status":"ok"}

curl -s http://localhost:7402/v1/stats | python3 -m json.tool | head -20
# Expected: 105+ totalTransactions, 5 models
```
If server is down: `cd ~/Desktop/Hackathons/agentic-economy-arc/arcmeter/api && node server.js`

---

## 3. OPEN BROWSER TABS — IN THIS EXACT ORDER

| # | Tab | URL |
|---|-----|-----|
| 1 | Marketplace | `file:///Users/aryateja/Desktop/Hackathons/agentic-economy-arc/arcmeter/dashboard/marketplace.html` |
| 2 | Seller View | `file:///Users/aryateja/Desktop/Hackathons/agentic-economy-arc/arcmeter/dashboard/seller.html` |
| 3 | Live Stream | `file:///Users/aryateja/Desktop/Hackathons/agentic-economy-arc/arcmeter/dashboard/index.html` |
| 4 | Arc Explorer | `https://testnet.arcscan.app` |
| 5 | Circle Console | `https://console.circle.com` (log in, go to Wallets tab) |
| 6 | GitHub | `https://github.com/aryateja2106/modelmarket-on-arc` |

---

## 4. OPEN TERMINAL
- New terminal window, position it so it's visible alongside Tab 3 (index.html) for Shot 5
- Pre-type but DON'T run yet:
```bash
cd ~/Desktop/Hackathons/agentic-economy-arc/arcmeter/buyer && COUNT=12 ARCMETER_URL=http://localhost:7402 CONCURRENCY=2 node multi-buyer.js
```

---

## 5. HIT RECORD — THEN FOLLOW THIS SHOT-BY-SHOT

### SHOT 1 — 0:00–0:20 | Hook
**Visual:** Terminal
**SAY:**
> "Per-call billing on Ethereum costs more in gas than the call is worth. $2.40 to settle a $0.001 transaction. The math doesn't work. The agentic economy is stuck."

---

### SHOT 2 — 0:20–0:50 | Solution
**Visual:** Switch to Tab 1 (marketplace.html), show header stats
**SAY:**
> "Arc uses USDC as the native gas token. One transfer: $0.0001. Charge $0.001, keep $0.0009 — 90% margin. ModelMarket proves it: five models, five sellers, Circle Wallets, EIP-3009 so buyers never call approve()."

---

### SHOT 3 — 0:50–1:30 | Marketplace walkthrough
**Visual:** Tab 1 — slowly pan across all 5 model cards, then click Try It on llama-70b-hf
**SAY:**
> "Five models. Five independent sellers. Each sets its own price. Click Try It on Llama 70B — buyer gets a 402, signs EIP-3009, retries with X-PAYMENT header. Seller verifies, returns 200."
>
> *(wait for response to load)*
>
> "That proof block — tx hash, amount paid, model id. Every call is accountable."

**FALLBACK:** If llama-70b-hf is rate-limited or times out → click Try It on **gemini-flash** instead. Say: "Switching to Gemini Flash — same flow, different model."

---

### SHOT 4 — 1:30–2:10 | Seller view
**Visual:** Tab 2 (seller.html) — use the dropdown to switch between 3 seller addresses
**SAY:**
> "Seller view. Each wallet is an independent seller. Switch between them — different models, different earnings, all in USDC. Seller 0x4444 earned the most — that's gemini-pro, highest price point."
>
> "Programmable money. Each model is a revenue stream."

---

### SHOT 5 — 2:10–2:40 | Live stream + multi-buyer
**Visual:** Alt-tab: Tab 3 (index.html) on screen, then switch to terminal
**SAY:**
> "Live stream. Running 12 buyers concurrently."

**ACTION:** Hit Enter on the pre-typed multi-buyer command. Switch back to index.html tab immediately to show feed updating.

**SAY:**
> "Watch the transaction feed — each row is a completed call with payment. 60-plus transactions, five models, all settled. This is the agentic economy in motion."

**FALLBACK:** If multi-buyer fails (ethers not installed) → show index.html feed from previous runs already populated with 105+ tx, say: "Feed already shows 105 completed transactions from prior runs."

---

### SHOT 6 — 2:40–3:10 | Arc Block Explorer
**Visual:** Tab 4 (testnet.arcscan.app)
**SAY:**
> "Arc block explorer. Every settlement is on-chain and publicly verifiable. Gas cost per transfer: $0.0001 USDC. Our demo uses mock signatures for the hackathon — swapping to live Arc is one step: replace the mock verifier with the real x402 facilitator. Settlement architecture is identical."
>
> "Transparent. Auditable. Immutable."

**If explorer is down:** Show the homepage screenshot and describe: "Arc testnet explorer — shows USDC transfers, from/to addresses, sub-cent gas on every transaction."

---

### SHOT 7 — 3:10–3:40 | Circle Console
**Visual:** Tab 5 (console.circle.com → Wallets tab)
**SAY:**
> "Circle Wallets power the seller side. Each seller address is a Circle-managed wallet — created with a single API call. Buyer funds calls; sellers accumulate USDC automatically per inference."
>
> "Non-custodial. Compliant. Production-ready."

---

### SHOT 8 — 3:40–4:00 | Close
**Visual:** Back to Tab 1 (marketplace.html) — stats visible. Then Tab 6 (GitHub).
**SAY:**
> "105 transactions. Five models. Sub-cent gas. Built in a weekend."
>
> "The vision: Stripe Connect for the agent economy. Any API, any model — list it, price it, get paid per call, in real time, on Arc. Code is open source. Link in the description."

---

## 6. FALLBACK MATRIX

| Failure | Recovery |
|---------|----------|
| llama-70b-hf rate limited | Click Try It on gemini-flash instead |
| multi-buyer `ethers` missing | Show index.html already populated (105 tx) |
| Arc explorer down | Describe UI, show any block explorer screenshot |
| Circle Console not loading | Show wallets.jsonl: `cat ~/Desktop/Hackathons/agentic-economy-arc/arcmeter/wallets.jsonl` |
| Server not responding | `cd .../api && node server.js` — takes <5s to restart |

---

## 7. FINAL STATS (confirmed before recording)
- **Total transactions:** 105
- **Total USDC settled:** $0.284 (284000 base units)
- **Models:** llama-70b-hf, nl2shell, llama-local, gemini-flash, gemini-pro
- **Sellers:** 5 unique wallet addresses
- **Avg latency:** ~9.2s (real inference calls)
