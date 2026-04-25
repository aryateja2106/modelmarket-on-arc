// arcmeter API — x402-style metered nl2shell endpoint
// Hackathon PoC: mock payment verification, in-memory + JSONL persistence.
// Swap points for real x402 facilitator are marked with TODO.

require('dotenv').config();

const { ethers } = require('ethers');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const { getModel, listModels, addModel } = require('./models');
const { runInference } = require('./inference');
const walletRoutes = require('./wallet-routes');

const PORT = process.env.PORT || 7402;
const PAY_TO = '0x1111111111111111111111111111111111111111';
const PRICE_BASE_UNITS = '1000'; // 1000 = $0.001 USDC (6 decimals)
const NETWORK = 'arc-testnet';
const ASSET = '0x3600000000000000000000000000000000000000'; // USDC on Arc
const RESOURCE_URL = `http://localhost:${PORT}/v1/nl2shell`;
const JSONL_PATH = path.join(__dirname, 'transactions.jsonl');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/', walletRoutes);

// In-memory transaction log (mirrored to transactions.jsonl)
const transactions = [];
const usedNonces = new Set();
const startedAt = Date.now();

// ---- Mock nl2shell ----
function mockNl2Shell(prompt) {
  const p = (prompt || '').toLowerCase();
  if (p.includes('kill') || p.includes('port')) return 'lsof -ti:8080 | xargs kill -9';
  if (p.includes('find') || p.includes('large')) return 'find . -type f -size +100M -mtime -7';
  if (p.includes('git')) return 'git log --oneline -20';
  if (p.includes('memory')) return 'ps aux --sort=-%mem | head';
  if (p.includes('disk')) return 'du -sh ./* | sort -h';
  return `echo "[nl2shell mock]: ${prompt}"`;
}

// ---- x402 helpers ----
function paymentRequirement() {
  return {
    scheme: 'exact',
    network: NETWORK,
    maxAmountRequired: PRICE_BASE_UNITS,
    resource: RESOURCE_URL,
    description: 'Convert natural language to shell command via nl2shell',
    mimeType: 'application/json',
    payTo: PAY_TO,
    maxTimeoutSeconds: 60,
    asset: ASSET,
    extra: { name: 'USD Coin', version: '2' },
  };
}

function build402Body() {
  return {
    x402Version: 1,
    error: 'X-PAYMENT header is required',
    accepts: [paymentRequirement()],
  };
}

// Real EIP-3009 verifier
function verifyPayment(payload, requirement) {
  if (!payload || typeof payload !== 'object') return { valid: false, reason: 'payload not object' };
  if (payload.x402Version !== 1) return { valid: false, reason: 'bad x402Version' };
  if (payload.scheme !== requirement.scheme) return { valid: false, reason: 'scheme mismatch' };
  // Skip network check if it's 'arc-testnet' vs 'arc-sepolia' etc for hackathon leniency
  
  const inner = payload.payload;
  if (!inner || typeof inner !== 'object') return { valid: false, reason: 'missing payload.payload' };
  const signature = inner.signature;
  const auth = inner.authorization;
  if (!signature || !auth) return { valid: false, reason: 'missing signature or auth' };

  if (signature.startsWith('0xMOCK')) {
    console.log('[arcmeter] accepting MOCK signature');
    return { valid: true };
  }

  try {
    const domain = {
      name: (requirement.extra && requirement.extra.name) || 'USD Coin',
      version: (requirement.extra && requirement.extra.version) || '2',
      chainId: 5042002, // Arc Testnet
      verifyingContract: requirement.asset || ASSET
    };

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

    const recovered = ethers.verifyTypedData(domain, types, auth, signature);
    if (recovered.toLowerCase() !== auth.from.toLowerCase()) {
      return { valid: false, reason: 'signature mismatch' };
    }
    
    if (usedNonces.has(auth.nonce)) {
      return { valid: false, reason: 'nonce already used' };
    }

    if (auth.to.toLowerCase() !== requirement.payTo.toLowerCase()) {
      return { valid: false, reason: 'recipient mismatch' };
    }
    if (BigInt(auth.value) < BigInt(requirement.maxAmountRequired)) {
      return { valid: false, reason: 'insufficient value' };
    }
    
    const now = Math.floor(Date.now() / 1000);
    if (now < Number(auth.validAfter)) return { valid: false, reason: 'payment not yet valid' };
    if (now > Number(auth.validBefore)) return { valid: false, reason: 'payment expired' };

    usedNonces.add(auth.nonce);
    return { valid: true };
  } catch (err) {
    return { valid: false, reason: `verification error: ${err.message}` };
  }
}

function decodeXPayment(headerVal) {
  try {
    const json = Buffer.from(headerVal, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function encodeXPaymentResponse(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

function recordTx(tx) {
  transactions.push(tx);
  try {
    fs.appendFileSync(JSONL_PATH, JSON.stringify(tx) + '\n');
  } catch (e) {
    console.error('[arcmeter] jsonl append failed:', e.message);
  }
}

// ---- Routes ----
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

app.post('/v1/nl2shell', (req, res) => {
  const t0 = Date.now();
  const prompt = (req.body && req.body.prompt) || '';
  const xPayment = req.header('X-PAYMENT');

  if (!xPayment) {
    console.log(`[arcmeter] 402 nl2shell prompt="${prompt}"`);
    return res.status(402).json(build402Body());
  }

  const decoded = decodeXPayment(xPayment);
  if (!decoded) {
    return res.status(400).json({ error: 'X-PAYMENT header is not valid base64 JSON' });
  }

  // TODO: Replace with real x402 facilitator call (POST <facilitator>/verify)
  const verification = verifyPayment(decoded, paymentRequirement());
  if (!verification.valid) {
    return res.status(402).json({
      x402Version: 1,
      error: `payment invalid: ${verification.reason}`,
      accepts: [paymentRequirement()],
    });
  }

  const command = mockNl2Shell(prompt);
  const txId = nanoid();
  const from = decoded.payload.authorization.from;
  const latencyMs = Date.now() - t0;
  const tx = {
    id: txId,
    timestamp: new Date().toISOString(),
    from,
    amount: PRICE_BASE_UNITS,
    prompt,
    output: command,
    latencyMs,
  };
  recordTx(tx);

  // TODO: Replace with real x402 facilitator settlement (POST <facilitator>/settle)
  const xPaymentResponse = encodeXPaymentResponse({
    success: true,
    txHash: '0xMOCK' + nanoid(),
    networkId: NETWORK,
    payer: from,
  });
  res.setHeader('X-PAYMENT-RESPONSE', xPaymentResponse);

  console.log(`[arcmeter] 200 nl2shell tx=${txId} from=${from} latency=${latencyMs}ms prompt="${prompt}"`);

  res.status(200).json({
    command,
    model: 'nl2shell',
    paid: { amount: PRICE_BASE_UNITS, asset: ASSET, txId },
  });
});

app.get('/v1/transactions', (_req, res) => {
  // newest first
  res.json([...transactions].reverse());
});

app.get('/v1/stats', (_req, res) => {
  const total = transactions.length;
  const totalUsdcSettled = transactions
    .reduce((sum, t) => sum + BigInt(t.amount || PRICE_BASE_UNITS), BigInt(0))
    .toString();
  const avgLatencyMs = total === 0
    ? 0
    : Math.round(transactions.reduce((s, t) => s + (t.latencyMs || 0), 0) / total);

  // per-model counts
  const perModel = {};
  // per-seller earnings
  const perSeller = {};
  for (const tx of transactions) {
    const mid = tx.modelId || 'nl2shell';
    perModel[mid] = (perModel[mid] || 0) + 1;
    const seller = tx.sellerAddr || PAY_TO;
    if (!perSeller[seller]) perSeller[seller] = BigInt(0);
    perSeller[seller] += BigInt(tx.amount || PRICE_BASE_UNITS);
  }
  const perSellerOut = {};
  for (const [addr, val] of Object.entries(perSeller)) {
    perSellerOut[addr] = val.toString();
  }

  res.json({
    totalTransactions: total,
    totalUsdcSettled,
    avgLatencyMs,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    paidPerCallUsdc: '0.001',
    perModel,
    perSellerUsdcSettled: perSellerOut,
  });
});

// ---- Model marketplace routes ----

app.get('/v1/models', (_req, res) => {
  res.json(listModels());
});

app.post('/v1/models', (req, res) => {
  const { id, name, backend, model, priceBaseUnits, seller, description } = req.body || {};
  if (!id || !name || !backend || !priceBaseUnits || !seller) {
    return res.status(400).json({ error: 'id, name, backend, priceBaseUnits, seller are required' });
  }
  if (getModel(id)) {
    return res.status(409).json({ error: `model id "${id}" already exists` });
  }
  const entry = { id, name, backend, model: model || null, priceBaseUnits, seller, description: description || '' };
  addModel(entry);
  console.log(`[arcmeter] registered model id=${id} backend=${backend}`);
  res.status(201).json(entry);
});

app.post('/v1/models/:id/infer', async (req, res) => {
  const t0 = Date.now();
  const modelId = req.params.id;
  const model = getModel(modelId);
  if (!model) {
    return res.status(404).json({ error: `model "${modelId}" not found` });
  }

  const prompt = (req.body && req.body.prompt) || '';
  const xPayment = req.header('X-PAYMENT');

  const requirement = {
    scheme: 'exact',
    network: NETWORK,
    maxAmountRequired: model.priceBaseUnits,
    resource: `http://localhost:${PORT}/v1/models/${modelId}/infer`,
    description: `Inference via ${model.name}`,
    mimeType: 'application/json',
    payTo: model.seller,
    maxTimeoutSeconds: 60,
    asset: ASSET,
    extra: { name: 'USD Coin', version: '2' },
  };

  if (!xPayment) {
    console.log(`[arcmeter] 402 infer model=${modelId} prompt="${prompt}"`);
    return res.status(402).json({
      x402Version: 1,
      error: 'X-PAYMENT header is required',
      accepts: [requirement],
    });
  }

  const decoded = decodeXPayment(xPayment);
  if (!decoded) {
    return res.status(400).json({ error: 'X-PAYMENT header is not valid base64 JSON' });
  }

  const verification = verifyPayment(decoded, requirement);
  if (!verification.valid) {
    return res.status(402).json({
      x402Version: 1,
      error: `payment invalid: ${verification.reason}`,
      accepts: [requirement],
    });
  }

  const output = await runInference(model, prompt);
  const txId = nanoid();
  const txHash = '0xMOCK' + nanoid() + nanoid();
  const from = decoded.payload.authorization.from;
  const latencyMs = Date.now() - t0;
  const tx = {
    id: txId,
    timestamp: new Date().toISOString(),
    from,
    amount: model.priceBaseUnits,
    modelId,
    modelName: model.name,
    backend: model.backend,
    sellerAddr: model.seller,
    txHash,
    prompt,
    output,
    latencyMs,
  };
  recordTx(tx);

  const xPaymentResponse = encodeXPaymentResponse({
    success: true,
    txHash,
    networkId: NETWORK,
    payer: from,
  });
  res.setHeader('X-PAYMENT-RESPONSE', xPaymentResponse);

  console.log(`[arcmeter] 200 infer model=${modelId} tx=${txId} from=${from} latency=${latencyMs}ms`);

  res.status(200).json({
    output,
    model: model.name,
    paid: {
      txId,
      txHash,
      amount: model.priceBaseUnits,
      asset: ASSET,
      payTo: model.seller,
      network: NETWORK,
      payer: from,
    },
  });
});

// ---- Seller earnings ----

app.get('/v1/sellers/:addr/earnings', (req, res) => {
  const addr = req.params.addr.toLowerCase();
  const sellerTxs = transactions.filter((t) => (t.sellerAddr || PAY_TO).toLowerCase() === addr);
  const totalUsdcSettled = sellerTxs
    .reduce((sum, t) => sum + BigInt(t.amount || PRICE_BASE_UNITS), BigInt(0))
    .toString();
  const byModel = new Map();
  for (const tx of sellerTxs) {
    const id = tx.modelId || 'unknown';
    if (!byModel.has(id)) {
      byModel.set(id, { id, name: tx.modelName || id, backend: tx.backend || 'unknown', totalCalls: 0, totalUsdcEarned: BigInt(0) });
    }
    const m = byModel.get(id);
    m.totalCalls += 1;
    m.totalUsdcEarned += BigInt(tx.amount || PRICE_BASE_UNITS);
  }
  const models = [...byModel.values()].map((m) => ({
    id: m.id,
    name: m.name,
    backend: m.backend,
    totalCalls: m.totalCalls,
    totalUsdcEarned: m.totalUsdcEarned.toString(),
  }));
  const recent = sellerTxs.slice(-20).reverse().map((t) => ({
    txId: t.id,
    txHash: t.txHash,
    timestamp: t.timestamp,
    modelId: t.modelId,
    amount: t.amount,
    payer: t.from,
    latencyMs: t.latencyMs,
  }));
  res.json({
    sellerAddr: addr,
    totalCalls: sellerTxs.length,
    totalUsdcSettled,
    models,
    recentTransactions: recent,
  });
});

app.listen(PORT, () => {
  console.log(`[arcmeter] listening on http://localhost:${PORT}`);
});
