#!/usr/bin/env node
// ArcMeter multi-buyer — drives the multi-model marketplace API.
// Fetches /v1/models, then hammers each model with paid inferences to stack up 50+ tx.
// Mock x402 signing; real EIP-3009 signing comes later.

"use strict";

const { ethers } = require("ethers");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// ---------- config ----------
const COUNT = parseInt(process.env.COUNT || "20", 10); // calls *per model*
const SELLER_URL = (process.env.SELLER_URL || "http://localhost:7402").replace(/\/+$/, "");
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "4", 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || "30", 10);

const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const CHAIN_ID = 5042002;

// ---------- wallet (MOCK) ----------
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
let promptData;
try {
  promptData = JSON.parse(fs.readFileSync(path.join(__dirname, "prompts.json"), "utf8"));
} catch (e) {
  console.error("[multi-buyer] failed to load prompts.json:", e.message);
  process.exit(1);
}

// Support both old flat array and new categorised object.
const shellPrompts =
  Array.isArray(promptData)
    ? promptData
    : (promptData.shell || []).concat(promptData.general || []);
const generalPrompts =
  Array.isArray(promptData)
    ? promptData
    : (promptData.general || []).concat(promptData.shell || []);

function pickPromptForModel(modelId) {
  const id = (modelId || "").toLowerCase();
  const pool =
    id.includes("nl2shell") || id.includes("shell")
      ? shellPrompts
      : generalPrompts;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- payment header ----------
async function buildPaymentHeader(accepts, priceBaseUnits) {
  const value = priceBaseUnits != null ? String(priceBaseUnits) : accepts.maxAmountRequired;
  const auth = {
    from: walletAddress,
    to: accepts.payTo,
    value,
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

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function friendlyNetErr(err) {
  const code = err && (err.code || (err.cause && err.cause.code));
  if (code === "ECONNREFUSED") return `seller unreachable at ${SELLER_URL} (connection refused)`;
  if (code === "ENOTFOUND") return `seller hostname not found for ${SELLER_URL}`;
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT")
    return `seller timed out at ${SELLER_URL}`;
  return `${err.message || err}`;
}

// ---------- one paid inference for a model ----------
async function paidInfer(model) {
  const t0 = Date.now();
  const prompt = pickPromptForModel(model.id);
  const url = `${SELLER_URL}/v1/models/${encodeURIComponent(model.id)}/infer`;

  // Step 1: probe — expect 402
  const probe = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (probe.status !== 402) {
    throw new Error(`[${model.id}] expected 402 on probe, got ${probe.status}`);
  }
  const body = await probe.json();
  const accepts = body && body.accepts && body.accepts[0];
  if (!accepts) throw new Error(`[${model.id}] 402 body missing accepts[0]`);

  // Use priceBaseUnits from model listing if accepts doesn't have it; fall back to maxAmountRequired.
  const priceBaseUnits = accepts.maxAmountRequired || model.priceBaseUnits;

  // Step 2: pay — same endpoint with X-PAYMENT
  const xPayment = await buildPaymentHeader(accepts, priceBaseUnits);
  const paid = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-payment": xPayment },
    body: JSON.stringify({ prompt }),
  });
  if (paid.status !== 200) {
    throw new Error(`[${model.id}] expected 200 on paid call, got ${paid.status}`);
  }

  const amount = priceBaseUnits || accepts.maxAmountRequired || "0";
  return { latencyMs: Date.now() - t0, amount: BigInt(amount) };
}

// ---------- per-model worker pool ----------
async function runModel(model, perModelStats, onTick) {
  const stats = perModelStats;
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= COUNT) return;
      try {
        const r = await paidInfer(model);
        stats.ok++;
        stats.totalLatency += r.latencyMs;
        stats.totalPaidUnits += r.amount;
        onTick(model.id, "ok", r.amount);
      } catch (e) {
        stats.fail++;
        if (!stats.firstErr) stats.firstErr = friendlyNetErr(e);
        onTick(model.id, "fail", 0n);
      }
      if (DELAY_MS > 0) await sleep(Math.floor(Math.random() * DELAY_MS));
    }
  }

  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker());
  await Promise.all(workers);
}

// ---------- fetch model list ----------
async function fetchModels() {
  const res = await fetch(`${SELLER_URL}/v1/models`, { method: "GET" });
  if (!res.ok) throw new Error(`GET /v1/models returned ${res.status}`);
  const data = await res.json();
  // Accept { models: [...] } or a bare array.
  const list = Array.isArray(data) ? data : data.models;
  if (!Array.isArray(list) || list.length === 0) throw new Error("No models returned from /v1/models");
  return list;
}

// ---------- main ----------
async function main() {
  console.log(`[multi-buyer] wallet: ${shortAddr(walletAddress)}`);
  console.log(`[multi-buyer] target: ${SELLER_URL}  count=${COUNT}/model  concurrency=${CONCURRENCY}`);
  console.log("");

  // Pre-flight: fetch model list
  let models;
  try {
    models = await fetchModels();
  } catch (e) {
    console.error(`[multi-buyer] error fetching models: ${friendlyNetErr(e)}`);
    console.error(`[multi-buyer] hint: is the seller running? try SELLER_URL=... node multi-buyer.js`);
    process.exit(1);
  }

  console.log(`[multi-buyer] found ${models.length} model(s):`);
  for (const m of models) {
    const price = m.priceBaseUnits != null
      ? `$${(Number(m.priceBaseUnits) / 1e6).toFixed(4)} USDC`
      : "(price from 402)";
    console.log(`             • ${m.id}  ${price}`);
  }
  console.log(`[multi-buyer] total target: ${models.length * COUNT} tx`);
  console.log("");

  // Per-model stats
  const modelStats = {};
  for (const m of models) {
    modelStats[m.id] = { ok: 0, fail: 0, totalLatency: 0, totalPaidUnits: 0n, firstErr: null };
  }

  // Rolling counters
  let totalTx = 0;
  let totalUnits = 0n;
  const startedAt = Date.now();

  function onTick(modelId, status, amount) {
    totalTx++;
    if (status === "ok") totalUnits += amount;
    const usdc = (Number(totalUnits) / 1e6).toFixed(4);
    const ms = modelStats[modelId];
    const modelUsdc = (Number(ms.totalPaidUnits) / 1e6).toFixed(4);
    process.stdout.write(
      `\r[multi-buyer] tx=${totalTx}  USDC=$${usdc}  | ${modelId}: ok=${ms.ok} fail=${ms.fail} $${modelUsdc}  `
    );
  }

  // Run all models in parallel (each model has its own worker pool of CONCURRENCY slots)
  const modelJobs = models.map((m) => runModel(m, modelStats[m.id], onTick));
  await Promise.all(modelJobs);

  const durationMs = Date.now() - startedAt;
  const totalUSDC = Number(totalUnits) / 1e6;
  const tps = totalTx > 0 ? (totalTx / (durationMs / 1000)).toFixed(1) : "0.0";

  console.log("\n");
  console.log("══════════════════════════════════════════════════════");
  console.log("  ArcMeter multi-buyer summary");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  total tx:         ${totalTx}`);
  console.log(`  total USDC:       $${totalUSDC.toFixed(6)}`);
  console.log(`  duration:         ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`  throughput:       ${tps} tx/s`);
  console.log("──────────────────────────────────────────────────────");
  console.log("  model               ok    fail   USDC paid   avg ms");
  console.log("──────────────────────────────────────────────────────");

  let anyFail = false;
  for (const m of models) {
    const s = modelStats[m.id];
    const avg = s.ok ? Math.round(s.totalLatency / s.ok) : 0;
    const usdc = (Number(s.totalPaidUnits) / 1e6).toFixed(6);
    const id = m.id.padEnd(20).slice(0, 20);
    console.log(
      `  ${id}  ${String(s.ok).padStart(4)}  ${String(s.fail).padStart(4)}   $${usdc}   ${avg}ms`
    );
    if (s.fail > 0) {
      anyFail = true;
      console.log(`    first error: ${s.firstErr}`);
    }
  }

  console.log("══════════════════════════════════════════════════════");
  console.log(`  wallet: ${shortAddr(walletAddress)}`);
  console.log("══════════════════════════════════════════════════════");

  process.exit(anyFail ? 1 : 0);
}

process.on("unhandledRejection", (e) => {
  console.error(`\n[multi-buyer] fatal: ${friendlyNetErr(e)}`);
  process.exit(1);
});
process.on("uncaughtException", (e) => {
  console.error(`\n[multi-buyer] fatal: ${friendlyNetErr(e)}`);
  process.exit(1);
});

main();
