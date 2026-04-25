// wallet-routes.js — Express router for Circle Wallet endpoints
//
// HOW TO MOUNT (api-extension agent: add this to server.js):
//   const walletRoutes = require('./wallet-routes');
//   app.use('/', walletRoutes);
//
// Routes:
//   POST /v1/wallets           — create a Circle wallet {name, role: "seller"|"buyer"}
//   GET  /v1/wallets           — list all wallets
//   GET  /v1/wallets/:id/balance — USDC balance
//   POST /v1/wallets/:id/payout  — transfer USDC to external address {to, amount}

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const circle = require('./circle');

const router = express.Router();

// In-memory store of wallets created via this API
const walletStore = [];

// Persist to wallets.jsonl alongside the api dir
const WALLETS_JSONL = path.join(__dirname, '..', 'wallets.jsonl');

function appendJsonl(obj) {
  try {
    fs.appendFileSync(WALLETS_JSONL, JSON.stringify(obj) + '\n');
  } catch (e) {
    console.error('[wallet-routes] jsonl append failed:', e.message);
  }
}

// POST /v1/wallets
// body: { name: string, role: "seller" | "buyer" }
router.post('/v1/wallets', async (req, res) => {
  const { name, role } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (role && !['seller', 'buyer'].includes(role)) {
    return res.status(400).json({ error: 'role must be "seller" or "buyer"' });
  }

  try {
    const wallet = await circle.createWallet({ name, blockchain: circle.DEFAULT_BLOCKCHAIN });
    const entry = {
      walletId: wallet.id,
      address: wallet.address,
      name: wallet.name || name,
      blockchain: wallet.blockchain,
      role: role || 'buyer',
      createDate: wallet.createDate || new Date().toISOString(),
    };
    walletStore.push(entry);
    appendJsonl(entry);
    console.log(`[wallet-routes] created wallet id=${entry.walletId} role=${entry.role} mock=${circle.isMock}`);
    res.status(201).json(entry);
  } catch (err) {
    console.error('[wallet-routes] createWallet error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /v1/wallets
router.get('/v1/wallets', async (_req, res) => {
  try {
    // Return in-memory store (already enriched with role); also fetch from Circle
    // so wallets created via setup-wallets.js show up if they were added there.
    res.json(walletStore);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /v1/wallets/:id/balance
router.get('/v1/wallets/:id/balance', async (req, res) => {
  const { id } = req.params;
  try {
    const balance = await circle.getBalance(id);
    res.json({ walletId: id, usdc: balance.usdc, raw: balance.raw });
  } catch (err) {
    console.error('[wallet-routes] getBalance error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /v1/wallets/:id/payout
// body: { to: string (external address), amount: string (e.g. "1.5") }
// Used to settle seller earnings to an external wallet address.
router.post('/v1/wallets/:id/payout', async (req, res) => {
  const { id } = req.params;
  const { to, amount, tokenId } = req.body || {};
  if (!to) return res.status(400).json({ error: 'to address is required' });
  if (!amount) return res.status(400).json({ error: 'amount is required' });

  try {
    const result = await circle.transfer({ walletId: id, to, amount, tokenId });
    console.log(`[wallet-routes] payout walletId=${id} to=${to} amount=${amount} USDC tx=${result.id}`);
    res.json({
      walletId: id,
      to,
      amount,
      txId: result.id,
      state: result.state,
      txHash: result.txHash,
    });
  } catch (err) {
    console.error('[wallet-routes] payout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
