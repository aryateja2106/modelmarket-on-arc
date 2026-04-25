# ArcMeter Research Note

Build-time reference. All values pulled from official docs / spec repos. Anything not directly verified is marked [UNCONFIRMED].

## 1. Arc Testnet Basics

| Field | Value |
|---|---|
| RPC URL | `https://rpc.testnet.arc.network` |
| Chain ID | `5042002` |
| Block Explorer | `https://testnet.arcscan.app` |
| Faucet | `https://faucet.circle.com` (select "Arc Testnet") |
| Native gas token | USDC (gas paid in USDC, 18-decimal native representation) |
| Block time | ~2s, PoS |

Source: docs.arc.network, arc.network/blog/circle-launches-arc-public-testnet, chainlist.org/chain/1244.

## 2. USDC Contract Address (Arc Testnet)

- Address: `0x3600000000000000000000000000000000000000` (system / precompile-style address — same on testnet & mainnet per Arc docs).
- Two interfaces: native (18 decimals, used for gas) and ERC-20 (6 decimals, EIP-3009 compatible). Use the ERC-20 interface for x402 payments.

Source: `docs.arc.network/arc/references/contract-addresses`.

## 3. x402 HTTP Flow

**402 response body** (`Content-Type: application/json`):

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "arc-testnet",
      "maxAmountRequired": "1000",
      "resource": "https://api.example.com/weather",
      "description": "Weather data",
      "mimeType": "application/json",
      "payTo": "0xRecipient...",
      "maxTimeoutSeconds": 60,
      "asset": "0x3600000000000000000000000000000000000000",
      "extra": { "name": "USD Coin", "version": "2" }
    }
  ],
  "error": "X-PAYMENT header is required"
}
```

`extra.name`/`extra.version` populate the EIP-712 domain for the asset. [UNCONFIRMED] exact `network` string for Arc — likely `arc-testnet` or `arc-sepolia`; confirm against `@x402/evm` network registry.

**X-PAYMENT request header**: base64(JSON) of the Payment Payload:

```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "arc-testnet",
  "payload": {
    "signature": "0x...",
    "authorization": {
      "from":        "0xBuyer...",
      "to":          "0xRecipient...",
      "value":       "1000",
      "validAfter":  "0",
      "validBefore": "1735689600",
      "nonce":       "0x<random bytes32>"
    }
  }
}
```

**X-PAYMENT-RESPONSE** (200 OK): base64(JSON) Settlement Response with `success`, `transaction`, `network`, `payer`.

Source: `github.com/coinbase/x402/specs/x402-specification.md`, `specs/transports-v2/http.md`, `specs/schemes/exact/scheme_exact_evm.md`.

## 4. Circle Facilitator on Arc

- **Status: BLOCKER.** Circle announced Nanopayments on x402 (Mar 2026, supports Arc testnet) but has **not yet published a hosted facilitator URL**. Quote: "Circle plans to release its facilitator in testnet soon, along with documentation and smart contract source code."
- Coinbase's hosted facilitator (`https://x402.org/facilitator`) is the public default but only supports Base / a fixed network list — [UNCONFIRMED] whether it accepts `arc-testnet`.
- Fallback: run our own facilitator. Reference impls: `coinbase/x402` package `@x402/facilitator` (TS) and `x402-rs/x402-rs` (Rust). Endpoints to expose: `POST /verify`, `POST /settle`, both accepting `{paymentPayload, paymentRequirements}` JSON.

Source: `circle.com/blog/circle-nanopayments-launches-on-testnet...`, `developers.circle.com` (gateway/nanopayments), `github.com/coinbase/x402/issues/447`.

## 5. EIP-3009 transferWithAuthorization Typed Data

`primaryType: "TransferWithAuthorization"`. Domain = `{ name, version, chainId: 5042002, verifyingContract: <USDC address> }`.

Message fields the buyer signs:

| field | type |
|---|---|
| `from` | address |
| `to` | address |
| `value` | uint256 |
| `validAfter` | uint256 |
| `validBefore` | uint256 |
| `nonce` | bytes32 |

USDC on Arc supports EIP-3009 (Circle confirmed via Nanopayments support list). Source: `eips.ethereum.org/EIPS/eip-3009`, `coinbase/x402/specs/schemes/exact/scheme_exact_evm.md`.

## 6. Reference Repo to Fork

Simplest TS server example: `github.com/coinbase/x402` → `examples/typescript/servers/express` (single `/weather` endpoint, $0.001 paywall via `x402-express` middleware). Pair it with `examples/typescript/clients/axios` for the buyer side. Facilitator example: `examples/typescript/facilitator`.

## 7. Minimum Viable Demo Path

- Use the **`exact` scheme (EIP-3009)** — USDC on Arc is 3009-compatible; no on-chain `approve` needed; one signed payload per call.
- Fork `examples/typescript/servers/express`; swap network to `arc-testnet`, asset to `0x3600...0000`, `payTo` to our wallet.
- Run our **own facilitator** locally (fork `examples/typescript/facilitator`, point its provider at `https://rpc.testnet.arc.network`, fund it with testnet USDC for gas). Don't wait on Circle.
- Buyer agent: loop 60 times calling the paid endpoint via `x402-axios` with a funded test EOA; each call = one on-chain `transferWithAuthorization` tx → 60 txs on `testnet.arcscan.app`.
- Dashboard: tail facilitator `/settle` responses (tx hashes) into a websocket → live counter + arcscan links.

---
Word count: ~520. Marked unconfirmed: Arc network slug used by `@x402/evm`, whether Coinbase hosted facilitator covers Arc.
