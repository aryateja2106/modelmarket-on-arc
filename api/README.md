# arcmeter api

x402-style metered API server (hackathon PoC). Mock payment verification today; swap points for a real x402 facilitator are marked with `TODO` in `server.js`.

## Run

```bash
npm install
npm start
# listening on http://localhost:7402
```

Node 18+ required. Server boots in well under a second.

## API contract

All amounts use USDC base units (6 decimals). Per-call price: `1000` base units = `$0.001`.

### `POST /v1/nl2shell`
Body: `{ "prompt": "..." }`

**Without `X-PAYMENT` header** -> `402 Payment Required`:
```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [{
    "scheme": "exact",
    "network": "arc-testnet",
    "maxAmountRequired": "1000",
    "resource": "http://localhost:7402/v1/nl2shell",
    "description": "Convert natural language to shell command via nl2shell",
    "mimeType": "application/json",
    "payTo": "0x1111111111111111111111111111111111111111",
    "maxTimeoutSeconds": 60,
    "asset": "USDC",
    "extra": { "name": "USD Coin", "version": "2" }
  }]
}
```

**With `X-PAYMENT` header** (base64-encoded JSON of shape below) -> `200 OK`:
```json
{
  "command": "lsof -ti:8080 | xargs kill -9",
  "model": "nl2shell",
  "paid": { "amount": "1000", "asset": "USDC", "txId": "<nanoid>" }
}
```

The response also includes header `X-PAYMENT-RESPONSE` (base64 JSON) of:
```json
{ "success": true, "txHash": "0xMOCK<nanoid>", "networkId": "arc-testnet", "payer": "<from-address>" }
```

X-PAYMENT decoded JSON shape (mock-verified for shape only):
```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "arc-testnet",
  "payload": {
    "signature": "0x...",
    "authorization": {
      "from": "0x...",
      "to": "0x1111111111111111111111111111111111111111",
      "value": "1000",
      "validAfter": "0",
      "validBefore": "99999999999",
      "nonce": "0x00"
    }
  }
}
```

### `GET /v1/transactions`
Returns the full transaction log, newest first:
```json
[{ "id": "...", "timestamp": "...", "from": "0x...", "amount": "1000", "prompt": "...", "output": "...", "latencyMs": 2 }]
```

### `GET /v1/stats`
```json
{
  "totalTransactions": 1,
  "totalUsdcSettled": "1000",
  "avgLatencyMs": 2,
  "uptimeSeconds": 12,
  "paidPerCallUsdc": "0.001"
}
```

### `GET /healthz`
```json
{ "status": "ok" }
```

## Storage

- In-memory array `transactions[]`
- Append-only file `./transactions.jsonl` (one JSON object per line)

## Swap points (mock -> real x402)

Search `server.js` for `TODO: Replace with real x402 facilitator call`:
- `verifyPaymentMock` -> `POST <facilitator>/verify`
- settlement step in `POST /v1/nl2shell` -> `POST <facilitator>/settle`

## Quick smoke test

```bash
# 402 path
curl -i -X POST http://localhost:7402/v1/nl2shell \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"kill the process on port 8080"}'

# 200 path
PAY=$(echo '{"x402Version":1,"scheme":"exact","network":"arc-testnet","payload":{"signature":"0xMOCK","authorization":{"from":"0xabc","to":"0x1111111111111111111111111111111111111111","value":"1000","validAfter":"0","validBefore":"99999999999","nonce":"0x00"}}}' | base64)
curl -i -X POST http://localhost:7402/v1/nl2shell \
  -H 'Content-Type: application/json' \
  -H "X-PAYMENT: $PAY" \
  -d '{"prompt":"kill the process on port 8080"}'

curl -s http://localhost:7402/v1/transactions
curl -s http://localhost:7402/v1/stats
```
