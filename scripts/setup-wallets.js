#!/usr/bin/env node
// setup-wallets.js — One-time setup: creates a Circle WalletSet + wallets for all
// marketplace participants, then writes arcmeter/wallets.json.
//
// Usage:
//   node scripts/setup-wallets.js
//
// Env (optional — omit for mock mode):
//   CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, CIRCLE_WALLET_SET_ID

'use strict';

const fs = require('fs');
const path = require('path');
const circle = require('../api/circle');

const WALLETS_JSON = path.join(__dirname, '..', 'wallets.json');

// Models from the registry that need seller wallets
const SELLER_MODELS = [
  { id: 'gemini-flash', name: 'seller-gemini-flash' },
  { id: 'llama-local', name: 'seller-llama-local' },
  { id: 'nl2shell', name: 'seller-nl2shell' },
];

async function main() {
  console.log(`\n[setup-wallets] Starting Circle wallet setup (mock=${circle.isMock})`);
  if (circle.isMock) {
    console.log('[setup-wallets] No CIRCLE_API_KEY found — running in MOCK mode. All wallet IDs are fake.');
  }

  // 1. Create (or reuse) wallet set
  console.log('\n--- Step 1: WalletSet ---');
  const wsName = 'arcmeter-hackathon';
  const walletSet = await circle.createWalletSet(wsName);
  const walletSetId = walletSet.id;
  console.log(`  WalletSet id=${walletSetId} name=${wsName}`);

  // 2. Create seller wallets
  console.log('\n--- Step 2: Seller Wallets ---');
  const sellerWallets = [];
  for (const m of SELLER_MODELS) {
    const w = await circle.createWallet({ name: m.name, walletSetId, blockchain: circle.DEFAULT_BLOCKCHAIN });
    sellerWallets.push({ modelId: m.id, role: 'seller', walletId: w.id, address: w.address, name: m.name });
    console.log(`  [seller] model=${m.id} walletId=${w.id} address=${w.address}`);
  }

  // 3. Create buyer/agent wallet
  console.log('\n--- Step 3: Buyer/Agent Wallet ---');
  const buyerWallet = await circle.createWallet({ name: 'buyer-agent', walletSetId, blockchain: circle.DEFAULT_BLOCKCHAIN });
  const buyerEntry = { role: 'buyer', walletId: buyerWallet.id, address: buyerWallet.address, name: 'buyer-agent' };
  console.log(`  [buyer] walletId=${buyerWallet.id} address=${buyerWallet.address}`);

  // 4. Write wallets.json
  const output = {
    walletSetId,
    blockchain: circle.DEFAULT_BLOCKCHAIN,
    mock: circle.isMock,
    createdAt: new Date().toISOString(),
    sellers: sellerWallets,
    buyer: buyerEntry,
  };

  fs.writeFileSync(WALLETS_JSON, JSON.stringify(output, null, 2));
  console.log(`\n[setup-wallets] Wrote ${WALLETS_JSON}`);

  console.log('\n=== Summary ===');
  console.log(`WalletSet:  ${walletSetId}`);
  console.log(`Blockchain: ${circle.DEFAULT_BLOCKCHAIN}`);
  console.log(`Mock mode:  ${circle.isMock}`);
  console.log('\nSeller wallets:');
  for (const s of sellerWallets) {
    console.log(`  ${s.modelId.padEnd(15)} walletId=${s.walletId}  address=${s.address}`);
  }
  console.log('\nBuyer wallet:');
  console.log(`  ${'buyer-agent'.padEnd(15)} walletId=${buyerEntry.walletId}  address=${buyerEntry.address}`);
  console.log('\nDone. Other modules can require wallets.json to read addresses.\n');
}

main().catch((err) => {
  console.error('[setup-wallets] Fatal error:', err);
  process.exit(1);
});
