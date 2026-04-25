// circle.js — thin wrapper around Circle Programmable Wallets REST API
// Docs: https://developers.circle.com/w3s/programmable-wallets
//
// Reads from env:
//   CIRCLE_API_KEY        — your Circle API key
//   CIRCLE_ENTITY_SECRET  — your entity secret (for developer-controlled wallets)
//   CIRCLE_WALLET_SET_ID  — default wallet set to use
//
// MOCK MODE: if CIRCLE_API_KEY is missing, all functions return plausible fake
// data so the demo runs without credentials. Mock objects are logged with [circle:mock].
//
// BLOCKCHAIN NOTE: Circle's API supports "ARC-TESTNET" natively as of Mar 2026.
// We use "ARC-TESTNET" as the default blockchain.

'use strict';

const CIRCLE_BASE = 'https://api.circle.com';
const DEFAULT_BLOCKCHAIN = process.env.CIRCLE_BLOCKCHAIN || 'ARC-TESTNET';

const isMock = !process.env.CIRCLE_API_KEY || !process.env.CIRCLE_ENTITY_SECRET;

// Lazy-load official SDK only when real keys present.
let _sdkClient = null;
function sdkClient() {
  if (_sdkClient) return _sdkClient;
  const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
  _sdkClient = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  });
  return _sdkClient;
}

// ---- Mock helpers ----
let mockWalletSetId = process.env.CIRCLE_WALLET_SET_ID || 'mock-walletset-0000';
const mockWallets = new Map();
let mockIdCounter = 1000;

function mockId(prefix) {
  return `${prefix}-${(mockIdCounter++).toString(16).padStart(8, '0')}`;
}

function mockAddress() {
  return '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function mockWallet(name, walletSetId, blockchain) {
  const id = mockId('wallet');
  const w = {
    id,
    walletSetId: walletSetId || mockWalletSetId,
    name: name || 'mock-wallet',
    blockchain: blockchain || DEFAULT_BLOCKCHAIN,
    address: mockAddress(),
    state: 'LIVE',
    accountType: 'SCA',
    createDate: new Date().toISOString(),
    updateDate: new Date().toISOString(),
  };
  mockWallets.set(id, w);
  return w;
}

/**
 * Create a wallet set (group of wallets).
 * @param {string} name
 * @returns {Promise<{id, name, ...}>}
 */
async function createWalletSet(name) {
  if (isMock) {
    const result = { id: mockWalletSetId, name: name || 'mock-walletset', createDate: new Date().toISOString() };
    console.log('[circle:mock] createWalletSet ->', result);
    return result;
  }
  const resp = await sdkClient().createWalletSet({ name });
  return resp.data && resp.data.walletSet ? resp.data.walletSet : resp.data;
}

/**
 * Create a wallet inside a wallet set.
 * @param {{name, walletSetId, blockchain}} opts
 * @returns {Promise<wallet>}
 */
async function createWallet({ name, walletSetId, blockchain } = {}) {
  const wsId = walletSetId || process.env.CIRCLE_WALLET_SET_ID || mockWalletSetId;
  const chain = blockchain || DEFAULT_BLOCKCHAIN;

  if (isMock) {
    const w = mockWallet(name, wsId, chain);
    console.log('[circle:mock] createWallet ->', { id: w.id, address: w.address, blockchain: w.blockchain });
    return w;
  }
  const resp = await sdkClient().createWallets({
    blockchains: [chain],
    count: 1,
    walletSetId: wsId,
    metadata: [{ name: name || 'arcmeter-wallet', refId: name }],
    accountType: chain.startsWith('ARC') ? 'EOA' : 'SCA',
  });
  const wallets = (resp.data && resp.data.wallets) || [];
  if (wallets.length === 0) {
    throw new Error('Circle API: No wallets returned');
  }
  return wallets[0];
}

/**
 * Get a single wallet by ID.
 * @param {string} walletId
 * @returns {Promise<wallet>}
 */
async function getWallet(walletId) {
  if (isMock) {
    const w = mockWallets.get(walletId) || { id: walletId, address: mockAddress(), state: 'LIVE', blockchain: DEFAULT_BLOCKCHAIN };
    console.log('[circle:mock] getWallet ->', walletId);
    return w;
  }
  const resp = await sdkClient().getWallet({ id: walletId });
  return (resp.data && resp.data.wallet) || resp.data;
}

/**
 * List all wallets in the entity.
 * @returns {Promise<wallet[]>}
 */
async function listWallets() {
  if (isMock) {
    const all = Array.from(mockWallets.values());
    console.log('[circle:mock] listWallets ->', all.length, 'wallets');
    return all;
  }
  const resp = await sdkClient().listWallets({});
  return (resp.data && resp.data.wallets) || [];
}

/**
 * Get USDC balance for a wallet.
 * @param {string} walletId
 * @returns {Promise<{usdc: string, raw: any}>}
 */
async function getBalance(walletId) {
  if (isMock) {
    const result = { usdc: '10.00', raw: [{ token: { symbol: 'USDC' }, amount: '10.00' }] };
    console.log('[circle:mock] getBalance walletId=%s ->', walletId, result.usdc, 'USDC');
    return result;
  }
  const resp = await sdkClient().getWalletTokenBalance({ id: walletId });
  const balances = (resp.data && resp.data.tokenBalances) || [];
  const usdcEntry = balances.find((b) => b.token && (b.token.symbol === 'USDC' || b.token.name.includes('USD Coin')));
  return { usdc: usdcEntry ? usdcEntry.amount : '0.00', raw: balances };
}

/**
 * Transfer USDC from a developer-controlled wallet.
 * @param {{walletId, to, amount, tokenId}} opts
 *   tokenId — the Circle token ID for USDC on the target chain (required for real API)
 * @returns {Promise<{id, state, txHash}>}
 */
async function transfer({ walletId, to, amount, tokenId } = {}) {
  if (isMock) {
    const result = {
      id: mockId('transfer'),
      walletId,
      to,
      amount,
      state: 'COMPLETE',
      txHash: '0xmock' + Math.random().toString(16).slice(2),
      createDate: new Date().toISOString(),
    };
    console.log('[circle:mock] transfer', amount, 'USDC', walletId, '->', to, 'txHash:', result.txHash);
    return result;
  }
  const resp = await sdkClient().createTransaction({
    walletId,
    tokenId,
    destinationAddress: to,
    amounts: [amount],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  });
  return (resp.data && resp.data) || resp;
}

module.exports = {
  createWalletSet,
  createWallet,
  getWallet,
  listWallets,
  getBalance,
  transfer,
  isMock,
  DEFAULT_BLOCKCHAIN,
};
