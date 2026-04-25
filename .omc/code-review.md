# ArcMeter Code Review — Security, x402, Circle, Buyer

Date: 2026-04-25
Reviewer: worker-1
Scope:
- `api/server.js`
- `api/circle.js`
- `api/wallet-routes.js`
- `api/inference.js`
- `api/models.js`
- `buyer/buyer.js`
- `buyer/multi-buyer.js`

## Executive Summary

The current implementation is demo-functional in mock mode, but it is not safe to present as real paid inference yet. The main blockers are:

1. `X-PAYMENT` accepts arbitrary fake signatures and does not enforce the advertised payment requirement.
2. Circle "real mode" silently falls back to mock success on SDK/API errors, including payouts.
3. Wallet creation, balance, and payout routes are unauthenticated; with real Circle credentials, any caller can trigger transfers.

Mock fallback can stay for the hackathon, but it must be explicit and impossible to confuse with real settlement when credentials are present.

## Critical Findings

### C1. x402 verification is shape-only; arbitrary fake payments unlock inference

Files:
- `api/server.js:68-83`
- `api/server.js:126-158`
- `api/server.js:268-300`
- `buyer/buyer.js:27-69`
- `buyer/multi-buyer.js:27-81`

`verifyPaymentMock()` only checks that `signature`, `authorization.from`, `authorization.to`, and `authorization.value` exist. It does not verify EIP-3009 typed-data signatures, recover the payer, verify nonce uniqueness, check `validAfter`/`validBefore`, enforce `to === requirement.payTo`, enforce `value >= requirement.maxAmountRequired`, enforce `resource`, or settle payment. The server then emits a mock `X-PAYMENT-RESPONSE` and records a paid transaction.

Impact: Anyone can base64-encode any object with a `signature` string and receive paid inference for free. Dashboard totals can show fake settled USDC.

Required fix:
- Add a real verifier path when x402/facilitator config is present.
- In mock mode, return response fields clearly marked as mock and keep this path gated by missing real config only.
- Validate the authorization against the exact requirement before inference:
  - `scheme`
  - `network`
  - `payTo`
  - `asset`
  - `amount`
  - `resource`
  - expiration window
  - nonce uniqueness

### C2. Circle real mode silently degrades to mock success

Files:
- `api/circle.js:106-112`
- `api/circle.js:129-142`
- `api/circle.js:156-162`
- `api/circle.js:175-180`
- `api/circle.js:195-203`
- `api/circle.js:226-246`
- `api/wallet-routes.js:97-107`

When `CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET` are set, SDK failures still return mock wallet, balance, and transfer objects. The payout route then returns those mock transfer results as success.

Impact: During the demo, bad Circle config or unsupported chain behavior can look like real wallet creation or seller payout. This is especially dangerous for `/v1/wallets/:id/payout` because a failed real transfer can be reported as complete.

Required fix:
- Only use mock fallback when credentials are absent or when an explicit `CIRCLE_FORCE_MOCK=true` is set.
- When credentials are present, SDK/API failures should return non-2xx errors.
- Include a `mode: "mock" | "real"` field in wallet/payout responses and dashboard data.

### C3. Unauthenticated payout route can transfer funds from developer-controlled wallets

Files:
- `api/server.js:24-27`
- `api/wallet-routes.js:38-62`
- `api/wallet-routes.js:76-85`
- `api/wallet-routes.js:91-111`

All wallet routes are mounted globally with `cors()` open to all origins. There is no API key, admin guard, ownership check, allowlist, CSRF protection, amount limit, or wallet ownership lookup. If real Circle credentials are enabled and this server is reachable, any caller can request:

```http
POST /v1/wallets/:id/payout
{ "to": "0x...", "amount": "..." }
```

Impact: Direct fund-loss risk for any Circle wallet ID that can be guessed, scraped, or previously created through this API.

Required fix:
- Require an admin/demo secret for wallet creation and payout routes.
- Validate `id` belongs to a wallet created by this app and has the correct role.
- Validate `to` as an EVM address.
- Enforce max payout and positive decimal amount.
- Require `tokenId` in real mode or resolve it server-side from a trusted config.

## High Findings

### H1. Model registration is public and unvalidated

Files:
- `api/server.js:216-227`
- `api/models.js:42-51`

`POST /v1/models` lets any caller register arbitrary model IDs, backends, sellers, and `priceBaseUnits`. There is no auth and no validation for seller address, positive integer pricing, backend allowlist, ID length/characters, or model name length.

Impact: Attackers can create malicious marketplace listings, inflate/poison dashboard stats, trigger backend errors, or set invalid prices that later break BigInt aggregation.

Required fix:
- Put model registration behind the same admin/demo secret.
- Validate:
  - `id`: short slug
  - `backend`: `mock | gemini | ollama`
  - `priceBaseUnits`: decimal integer string, positive, sub-cent cap if required
  - `seller`: valid EVM address

### H2. Payment replay is not prevented

Files:
- `api/server.js:99-105`
- `api/server.js:136-158`
- `api/server.js:277-300`
- `buyer/buyer.js:52-58`
- `buyer/multi-buyer.js:64-70`

The server does not track used nonces, transaction hashes, or settled transfer identifiers. The same `X-PAYMENT` header can be replayed repeatedly within or outside its validity window because validity is not checked.

Impact: One valid payment can generate unlimited inference calls and dashboard transactions.

Required fix:
- Keep a bounded in-memory nonce cache for demo mode.
- In real mode, rely on settlement/facilitator response and store settled transaction hash/payment ID.
- Reject reused nonces/payment IDs.

### H3. Buyer trusts any 402 requirement and does not verify settlement response

Files:
- `buyer/buyer.js:95-120`
- `buyer/multi-buyer.js:111-130`

The buyers take the first `accepts[0]` and sign/pay it without checking expected resource, expected seller, amount ceiling, asset, or network. `buyer.js` decodes `X-PAYMENT-RESPONSE` but does not require it to be present or successful; `multi-buyer.js` ignores it entirely.

Impact: A malicious or misconfigured seller endpoint can request payment to an unexpected address or for a higher amount, and the buyer will count HTTP 200 as paid success even if settlement failed.

Required fix:
- Validate `accepts.resource` matches the requested URL.
- Validate `accepts.asset === "USDC"` and network/chain ID are expected.
- Enforce max per-call price from local config.
- Require `X-PAYMENT-RESPONSE` in real mode and require `success === true` plus a real settlement hash/ID.

### H4. Paid inference can hang indefinitely or charge for backend errors

Files:
- `api/server.js:277-308`
- `api/inference.js:19-55`

Gemini and Ollama calls have no timeout. `runInference()` catches backend failures and returns an error string, but the server still records the transaction and returns `200` with `paid`.

Impact: A slow backend can tie up requests during the 50+ transaction demo. A failed backend can still appear as paid settled inference.

Required fix:
- Add per-backend `AbortController` timeouts.
- Decide whether backend failures should be charged. If yes, label them as charged failures in stats. If no, only settle/record payment after successful inference.

## Medium Findings

### M1. Prompt/output data is stored and exposed publicly

Files:
- `api/server.js:140-149`
- `api/server.js:281-292`
- `api/server.js:169-171`

Prompts and generated outputs are persisted to JSONL and returned by `GET /v1/transactions` without redaction or auth.

Impact: Prompts may include sensitive commands, repo paths, API names, or PII. The public dashboard endpoint leaks them.

Recommended fix:
- Store prompt/output only in mock/demo mode or redact by default.
- Return abbreviated prompt/output fields to dashboard clients.

### M2. Synchronous JSONL writes can stall the event loop and persistence failures are ignored

Files:
- `api/server.js:99-105`
- `api/wallet-routes.js:28-34`

`appendFileSync()` runs on the request path. If disk IO stalls, every request stalls. If append fails, the API still claims success.

Impact: Demo load can become jittery under transaction bursts, and transaction history can diverge from dashboard stats.

Recommended fix:
- Use async append or a buffered writer for demo load.
- Include a non-fatal persistence warning in health/status if JSONL append fails.

### M3. Wallet listing is memory-only and not reconciled with Circle

Files:
- `api/wallet-routes.js:22-23`
- `api/wallet-routes.js:65-70`

The route comment says it also fetches from Circle, but the implementation returns only `walletStore`, which resets on process restart.

Impact: Real wallets created earlier disappear from the UI/API after restart, making balances and payout flows confusing.

Recommended fix:
- In real mode, call `circle.listWallets()` and merge app role metadata where available.
- In mock mode, memory-only is acceptable for the demo if labeled.

### M4. Config parsing accepts invalid numeric values

Files:
- `buyer/buyer.js:12-15`
- `buyer/multi-buyer.js:13-16`

`parseInt()` results are not checked. `COUNT=NaN`, negative counts, or huge concurrency can produce confusing behavior or overload the API.

Recommended fix:
- Clamp `COUNT`, `CONCURRENCY`, and `DELAY_MS`.
- Fail fast on invalid values with a friendly error.

## Low / Correctness Notes

### L1. `circleRequest()` is unused

Files:
- `api/circle.js:19-90`

The REST helper and `CIRCLE_BASE` are not used. This is harmless but confusing during real Circle integration.

### L2. Comments contradict current Circle chain default

Files:
- `api/circle.js:12-20`

The comment says Circle does not support Arc and defaults to Polygon Amoy, but `DEFAULT_BLOCKCHAIN` now defaults to `ARC-TESTNET`. If Circle still rejects Arc, this interacts badly with C2 and becomes mock success.

### L3. Unicode output in CLI scripts can reduce portability

Files:
- `buyer/buyer.js:23-24`
- `buyer/multi-buyer.js:23-24`
- `buyer/multi-buyer.js:188-257`

This is not a security issue, but box-drawing characters and ellipsis can render poorly in some terminals or log aggregators.

## x402 Protocol Readiness Checklist

Before claiming "real x402":

- Real EIP-3009 typed-data signature generation in buyers.
- Server/facilitator verifies signature and authorization.
- `chainId`/network matches Arc testnet config.
- USDC contract/token address is explicit.
- `payTo`, amount, asset, resource, and expiry are enforced.
- Nonce replay is rejected.
- Settlement response is required and contains a real transaction/payment ID.
- Dashboard distinguishes `mock` from `real` settlement.

## Circle Readiness Checklist

Before claiming "real Circle":

- No silent mock fallback when Circle credentials are set.
- Payout route requires admin/demo auth.
- Amounts and recipient addresses are validated.
- Token ID/chain support is configured, not client-supplied blindly.
- API errors return non-2xx and are visible in the dashboard/logs.
- Wallet list reconciles with Circle in real mode.

## Verification Performed

- Static review of the specified API and buyer files.
- Confirmed no repository-level `.git` directory is present at `/Users/aryateja/Desktop/Hackathons/agentic-economy-arc`, so git diff/status verification is unavailable from this root.

No code changes were made outside this report.
