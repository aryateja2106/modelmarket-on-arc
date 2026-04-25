/* ==========================================================================
   ModelMarket — shared utilities
   ========================================================================== */

'use strict';

const API = 'http://localhost:7402';

/* ---------- fetchJSON --------------------------------------------------- */
async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status);
    err.status = res.status;
    err.res = res;
    throw err;
  }
  return res.json();
}

/* ---------- truncateAddr ------------------------------------------------ */
function truncateAddr(addr) {
  if (!addr) return '—';
  const s = String(addr);
  if (s.length <= 13) return s;
  return s.slice(0, 6) + '…' + s.slice(-4);
}

/* ---------- formatUsdc -------------------------------------------------- */
// base units (BigInt-compatible string or number) → "$X.XXXXXX"
function formatUsdc(baseUnits) {
  try {
    const b = BigInt(String(baseUnits || '0'));
    const whole = b / 1000000n;
    const frac = (b % 1000000n).toString().padStart(6, '0');
    return '$' + whole.toString() + '.' + frac;
  } catch {
    return '$0.000000';
  }
}

/* ---------- formatUsdcShort --------------------------------------------- */
// Shorter form for display: drops trailing zeros after 3dp
function formatUsdcShort(baseUnits) {
  try {
    const b = BigInt(String(baseUnits || '0'));
    const whole = b / 1000000n;
    const frac = (b % 1000000n).toString().padStart(6, '0');
    // show up to 6 decimal places, trim trailing zeros (keep at least 3)
    const trimmed = frac.replace(/0+$/, '') || '000';
    const dp = trimmed.length < 3 ? frac.slice(0, 3) : trimmed;
    return '$' + whole.toString() + '.' + dp;
  } catch {
    return '$0.000';
  }
}

/* ---------- fmtTime ----------------------------------------------------- */
function fmtTime(iso) {
  try {
    return new Date(iso).toTimeString().slice(0, 8);
  } catch {
    return '--:--:--';
  }
}

/* ---------- escapeHtml -------------------------------------------------- */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- truncate ---------------------------------------------------- */
function truncate(s, n) {
  if (s == null) return '';
  s = String(s);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/* ---------- mockXPayment ------------------------------------------------
   Simulates the x402 payment flow:
   1. POST to inferUrl → expect 402 with payment-required details
   2. Build base64-encoded X-PAYMENT header (mock USDC signature)
   3. Retry POST with X-PAYMENT header
   Returns the final JSON response body.
   -------------------------------------------------------------------- */
async function mockXPayment(inferUrl, body) {
  // Step 1: initial request — may get 402
  let res;
  try {
    res = await fetch(inferUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('Network error: ' + e.message);
  }

  if (res.status === 402) {
    let body = {};
    try { body = await res.json(); } catch { /* ignore */ }
    const req = (body.accepts && body.accepts[0]) || {};
    const value = req.maxAmountRequired || '1000';
    const payTo = req.payTo || '0x0000000000000000000000000000000000000000';

    const randHex = (bytes) => '0x' + Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const now = Math.floor(Date.now() / 1000);

    const payment = {
      x402Version: 1,
      scheme: req.scheme || 'exact',
      network: req.network || 'arc-testnet',
      payload: {
        signature: '0xMOCK' + randHex(32).slice(2),
        authorization: {
          from: randHex(20),
          to: payTo,
          value,
          validAfter: String(now - 60),
          validBefore: String(now + 600),
          nonce: randHex(32),
        },
      },
    };
    const xPaymentHeader = btoa(JSON.stringify(payment));

    // Step 2: retry with payment header
    res = await fetch(inferUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': xPaymentHeader,
      },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => 'unknown error');
    throw new Error('Infer failed ' + res.status + ': ' + txt);
  }

  return res.json();
}

/* ---------- animateNumber ----------------------------------------------- */
// Smoothly tick a DOM element's textContent from `from` to `to`
function animateNumber(el, from, to, duration = 500, formatter) {
  if (from === to) {
    el.textContent = formatter ? formatter(to) : to.toLocaleString();
    return;
  }
  const start = performance.now();
  const diff = to - from;
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = Math.round(from + diff * eased);
    el.textContent = formatter ? formatter(current) : current.toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ---------- setLiveStatus ----------------------------------------------- */
// pill: .mm-dot + span element; alive: bool
function setLiveStatus(dotEl, textEl, alive) {
  if (alive) {
    dotEl.classList.add('is-live');
    dotEl.classList.remove('is-err');
    if (textEl) textEl.textContent = 'Live';
  } else {
    dotEl.classList.remove('is-live');
    dotEl.classList.add('is-err');
    if (textEl) textEl.textContent = 'Offline';
  }
}

/* Export for module-less inline usage (global scope) */
window.MM = {
  API,
  fetchJSON,
  truncateAddr,
  formatUsdc,
  formatUsdcShort,
  fmtTime,
  escapeHtml,
  truncate,
  mockXPayment,
  animateNumber,
  setLiveStatus,
};
