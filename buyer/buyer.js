#!/usr/bin/env node
// ArcMeter buyer agent — hammers an x402-metered API to generate paid txns.
// Hackathon mock-first: signatures are fake. Real EIP-3009 signing comes later.

"use strict";

const { ethers } = require("ethers");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// ---------- config ----------
const COUNT = parseInt(process.env.COUNT || "100", 10);
const SELLER_URL = (process.env.SELLER_URL || "http://localhost:7402").replace(/\/+$/, "");
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "5", 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || "50", 10);

const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const CHAIN_ID = 5042002;

// ---------- wallet (MOCK) ----------
// MOCK ADDRESS, swap for real ethers.Wallet later.
const privateKey = process.env.BUYER_PRIVATE_KEY || "0x" + crypto.randomBytes(32).toString("hex");
const isMockWallet = !process.env.BUYER_PRIVATE_KEY;
const wallet = new ethers.Wallet(privateKey);
const walletAddress = wallet.address;

function shortAddr(addr) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

// ---------- real x402 signing ----------
async function signPayment(authorization, domain) {
  if (isMockWallet) {
    return "0xMOCK" + crypto.randomBytes(32).toString("hex");
  }

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' }
    ]
  };

  return wallet.signTypedData(domain, types, authorization);
}

// ---------- prompts ----------
let prompts;
try {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "prompts.json"), "utf8"));
  // Support both flat array (legacy) and categorised object { shell: [], general: [] }.
  prompts = Array.isArray(raw) ? raw : [].concat(raw.shell || [], raw.general || []);
  if (prompts.length === 0) throw new Error("empty prompts.json");
} catch (e) {
  console.error("[buyer] failed to load prompts.json:", e.message);
  process.exit(1);
}

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pickPrompt = () => prompts[Math.floor(Math.random() * prompts.length)];

async function buildPaymentHeader(accepts) {
  const auth = {
    from: walletAddress,
    to: accepts.payTo,
    value: accepts.maxAmountRequired,
    validAfter: Math.floor(Date.now() / 1000) - 60,
    validBefore: Math.floor(Date.now() / 1000) + 3600,
    nonce: "0x" + crypto.randomBytes(32).toString("hex"),
  };

  const domain = {
    name: (accepts.extra && accepts.extra.name) || "USD Coin",
    version: (accepts.extra && accepts.extra.version) || "2",
    chainId: CHAIN_ID,
    verifyingContract: (accepts.asset && accepts.asset.startsWith("0x")) ? accepts.asset : USDC_ADDRESS,
  };

  const signature = await signPayment(auth, domain);

  const payload = {
    x402Version: 1,
    scheme: "exact",
    network: accepts.network,
    payload: {
      signature,
      authorization: auth,
    },
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function friendlyNetErr(err) {
  const code = err && (err.code || (err.cause && err.cause.code));
  if (code === "ECONNREFUSED") return `seller unreachable at ${SELLER_URL} (connection refused)`;
  if (code === "ENOTFOUND") return `seller hostname not found for ${SELLER_URL}`;
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT")
    return `seller timed out at ${SELLER_URL}`;
  return `${err.message || err}`;
}

// ---------- one paid call ----------
async function paidCall() {
  const t0 = Date.now();
  const prompt = pickPrompt();

  // Step 1: probe — expect 402 with accepts[]
  const probe = await fetch(`${SELLER_URL}/v1/nl2shell`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (probe.status !== 402) {
    throw new Error(`expected 402 on probe, got ${probe.status}`);
  }
  const body = await probe.json();
  const accepts = body && body.accepts && body.accepts[0];
  if (!accepts) throw new Error("402 body missing accepts[0]");

  // Step 2: pay — same call with X-PAYMENT
  const xPayment = await buildPaymentHeader(accepts);
  const paid = await fetch(`${SELLER_URL}/v1/nl2shell`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-payment": xPayment },
    body: JSON.stringify({ prompt }),
  });
  if (paid.status !== 200) {
    throw new Error(`expected 200 on paid call, got ${paid.status}`);
  }
  const json = await paid.json();
  const settlementHeader = paid.headers.get("x-payment-response");
  let settlement = null;
  if (settlementHeader) {
    try {
      settlement = JSON.parse(Buffer.from(settlementHeader, "base64").toString("utf8"));
    } catch (_) {
      /* ignore decode errors — still counts as success */
    }
  }
  const amount = (json.paid && json.paid.amount) || accepts.maxAmountRequired;
  return { latencyMs: Date.now() - t0, amount: BigInt(amount), settlement };
}

// ---------- worker pool ----------
async function main() {
  console.log(`[buyer] wallet: ${shortAddr(walletAddress)}`);
  console.log(
    `[buyer] target: ${SELLER_URL}  count=${COUNT}  concurrency=${CONCURRENCY}  delay=${DELAY_MS}ms`
  );

  // Pre-flight ping so we fail fast & cleanly if seller is down.
  try {
    await fetch(`${SELLER_URL}/v1/nl2shell`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "ping" }),
    });
  } catch (e) {
    console.error(`[buyer] error: ${friendlyNetErr(e)}`);
    console.error(`[buyer] hint: is the seller running? try \`SELLER_URL=... node buyer.js\``);
    process.exit(1);
  }

  const stats = {
    ok: 0,
    fail: 0,
    totalLatency: 0,
    totalPaidUnits: 0n, // USDC base units (6 decimals)
    firstErr: null,
  };
  const startedAt = Date.now();
  let nextIndex = 0;

  async function worker(id) {
    while (true) {
      const i = nextIndex++;
      if (i >= COUNT) return;
      try {
        const r = await paidCall();
        stats.ok++;
        stats.totalLatency += r.latencyMs;
        stats.totalPaidUnits += r.amount;
        if (stats.ok % 10 === 0) {
          const avg = Math.round(stats.totalLatency / stats.ok);
          const usdc = Number(stats.totalPaidUnits) / 1e6;
          console.log(
            `[buyer] ${stats.ok}/${COUNT} ok | avg ${avg}ms | $${usdc.toFixed(3)} USDC settled`
          );
        }
      } catch (e) {
        stats.fail++;
        if (!stats.firstErr) stats.firstErr = friendlyNetErr(e);
      }
      if (DELAY_MS > 0) await sleep(Math.floor(Math.random() * DELAY_MS));
    }
  }

  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, (_, i) => worker(i));
  await Promise.all(workers);

  const durationMs = Date.now() - startedAt;
  const total = stats.ok + stats.fail;
  const avg = stats.ok ? Math.round(stats.totalLatency / stats.ok) : 0;
  const tps = total > 0 ? (total / (durationMs / 1000)).toFixed(1) : "0.0";
  const usdc = Number(stats.totalPaidUnits) / 1e6;

  console.log("============================");
  console.log("ArcMeter buyer summary");
  console.log("============================");
  console.log(`total calls:       ${total}`);
  console.log(`successful:        ${stats.ok}`);
  console.log(`failed:            ${stats.fail}`);
  console.log(`total duration:    ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`avg latency:       ${avg}ms`);
  console.log(`throughput:        ${tps} tx/s`);
  console.log(`total USDC paid:   $${usdc.toFixed(6)}`);
  console.log(`wallet:            ${shortAddr(walletAddress)}`);
  console.log("============================");
  if (stats.fail > 0 && stats.firstErr) {
    console.log(`first error:       ${stats.firstErr}`);
  }

  process.exit(stats.fail > 0 && stats.ok === 0 ? 1 : 0);
}

// Last-chance handlers so we never spew a stack trace at the user.
process.on("unhandledRejection", (e) => {
  console.error(`[buyer] fatal: ${friendlyNetErr(e)}`);
  process.exit(1);
});
process.on("uncaughtException", (e) => {
  console.error(`[buyer] fatal: ${friendlyNetErr(e)}`);
  process.exit(1);
});

main();
