# ArcMeter Buyer Agent

A zero-dependency Node 18+ script that hammers an x402-metered seller API to
generate 100+ paid transactions for the ArcMeter hackathon demo.

> Hackathon mode: payment signatures are **mocked**. The seller's facilitator
> in dev mode doesn't verify them. The swap point is `signPaymentMock()` in
> `buyer.js` — replace with real EIP-3009 typed-data signing
> (`ethers.signTypedData`) when wiring up the testnet path.

## Run

```bash
cd arcmeter/buyer
npm start
```

or directly:

```bash
node buyer.js
```

## Env vars

| Var           | Default                  | Meaning                                      |
| ------------- | ------------------------ | -------------------------------------------- |
| `COUNT`       | `100`                    | Number of paid calls to make                 |
| `SELLER_URL`  | `http://localhost:7402`  | Base URL of the seller API                   |
| `CONCURRENCY` | `5`                      | Parallel in-flight calls                     |
| `DELAY_MS`    | `50`                     | Max random jitter between a worker's calls   |

Examples:

```bash
COUNT=500 CONCURRENCY=20 npm start
SELLER_URL=https://arcmeter.example.com COUNT=10 npm start
```

## What it does, per call

1. `POST /v1/nl2shell` with a random prompt from `prompts.json` (no auth) → expects `402`.
2. Reads `accepts[0]` from the 402 body.
3. Builds an x402 payment payload (mock signature), base64-encodes it, sets `X-PAYMENT`.
4. `POST /v1/nl2shell` again → expects `200` plus an `X-PAYMENT-RESPONSE` settlement header.
5. Tracks latency, success/fail, and total USDC settled.

Every 10 successful calls it prints a progress line. At the end it prints a
summary block with totals, throughput, and avg latency.

## Output sample

```
[buyer] wallet: 0xabcd…1234
[buyer] target: http://localhost:7402  count=100  concurrency=5  delay=50ms
[buyer] 10/100 ok | avg 38ms | $0.010 USDC settled
[buyer] 20/100 ok | avg 41ms | $0.020 USDC settled
...
============================
ArcMeter buyer summary
============================
total calls:       100
successful:        100
failed:            0
total duration:    8.3s
avg latency:       41ms
throughput:        12.0 tx/s
total USDC paid:   $0.100000
wallet:            0xabcd…1234
============================
```

## Multi-model demo

`multi-buyer.js` drives the new multi-model marketplace API. It:

1. `GET /v1/models` — discovers available models and their per-call prices.
2. For each model, spawns a worker pool and fires `COUNT` paid inferences.
3. Per call: `POST /v1/models/:id/infer` → `402` → build x402 mock payload → retry with `X-PAYMENT` → `200`.
4. Prints a rolling counter line and a per-model summary table at the end.

With 3 models and `COUNT=20` the total comes to **60+ transactions** in a single run.

```bash
cd arcmeter/buyer
COUNT=20 npm run multi
```

Sample stdout:

```
[multi-buyer] wallet: 0xabcd…ef12
[multi-buyer] target: http://localhost:7402  count=20/model  concurrency=4

[multi-buyer] found 3 model(s):
             • gemini-flash   $0.0010 USDC
             • llama-local    $0.0005 USDC
             • nl2shell       $0.0010 USDC
[multi-buyer] total target: 60 tx

[multi-buyer] tx=60  USDC=$0.0430  | nl2shell: ok=20 fail=0 $0.020000

══════════════════════════════════════════════════════
  ArcMeter multi-buyer summary
══════════════════════════════════════════════════════
  total tx:         60
  total USDC:       $0.043000
  duration:         11.2s
  throughput:       5.4 tx/s
──────────────────────────────────────────────────────
  model               ok    fail   USDC paid   avg ms
──────────────────────────────────────────────────────
  gemini-flash          20     0   $0.020000   142ms
  llama-local           20     0   $0.010000    98ms
  nl2shell              20     0   $0.013000    61ms
══════════════════════════════════════════════════════
  wallet: 0xabcd…ef12
══════════════════════════════════════════════════════
```

### Env vars for multi-buyer

| Var           | Default                 | Meaning                                     |
| ------------- | ----------------------- | ------------------------------------------- |
| `COUNT`       | `20`                    | Calls *per model* (3 models → 60 total tx)  |
| `SELLER_URL`  | `http://localhost:7402` | Base URL of the seller API                  |
| `CONCURRENCY` | `4`                     | Parallel in-flight calls (across all models)|
| `DELAY_MS`    | `30`                    | Max random jitter between a worker's calls  |

Prompt selection: models whose ID contains `nl2shell` or `shell` get shell-task prompts; all others get general question prompts. Both categories live in `prompts.json` under `"shell"` and `"general"` keys.

## Files

- `buyer.js` — single-model script (~150 lines, no deps)
- `multi-buyer.js` — multi-model marketplace driver (~200 lines, no deps)
- `prompts.json` — 40 shell prompts + 15 general prompts, categorised
- `package.json` — node 18+ engine, no deps, `npm start` / `npm run multi`

## Swap point: real signing

In `buyer.js`:

```js
// TODO: Replace with real EIP-3009 typed-data signing using ethers.signTypedData()
function signPaymentMock(authorization, privateKey) { ... }
```

When wiring up testnet:

1. `npm i ethers`
2. Generate the wallet via `ethers.Wallet.createRandom()` (use its real address).
3. Replace `signPaymentMock` with a call to `wallet.signTypedData(domain, types, authorization)`
   using the EIP-712 domain `{ name: accepts.extra.name, version: accepts.extra.version, chainId, verifyingContract: accepts.asset }`
   and the EIP-3009 `TransferWithAuthorization` type set.
