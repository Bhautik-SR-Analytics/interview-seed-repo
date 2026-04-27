// Seeds clients, bin_lookup, payments, and ~2M orders across 3 tenants.
// Idempotent: TRUNCATEs first.

require('dotenv').config();
const { Pool } = require('pg');
const { from: copyFrom } = require('pg-copy-streams');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CLIENTS = [
  { id: 10001, name: 'Acme Wellness' },
  { id: 10002, name: 'Northwind Supplements' },
  { id: 10003, name: 'Globex Skincare' },
];

const BINS = [
  { bin: 411111, bank: 'JPMorgan Chase', card: 'VISA', type: 'CREDIT', country: 'US' },
  { bin: 424242, bank: 'Bank of America', card: 'VISA', type: 'DEBIT', country: 'US' },
  { bin: 450875, bank: 'Wells Fargo', card: 'VISA', type: 'CREDIT', country: 'US' },
  { bin: 510510, bank: 'Citibank', card: 'MASTERCARD', type: 'CREDIT', country: 'US' },
  { bin: 520082, bank: 'Capital One', card: 'MASTERCARD', type: 'CREDIT', country: 'US' },
  { bin: 530000, bank: 'US Bank', card: 'MASTERCARD', type: 'DEBIT', country: 'US' },
  { bin: 540000, bank: 'PNC Bank', card: 'MASTERCARD', type: 'CREDIT', country: 'US' },
  { bin: 371449, bank: 'American Express', card: 'AMEX', type: 'CREDIT', country: 'US' },
  { bin: 378282, bank: 'American Express', card: 'AMEX', type: 'CREDIT', country: 'US' },
  { bin: 601100, bank: 'Discover', card: 'DISCOVER', type: 'CREDIT', country: 'US' },
  { bin: 622202, bank: 'TD Bank', card: 'VISA', type: 'DEBIT', country: 'US' },
  { bin: 453978, bank: 'HSBC', card: 'VISA', type: 'CREDIT', country: 'GB' },
  { bin: 555555, bank: 'Lloyds', card: 'MASTERCARD', type: 'DEBIT', country: 'GB' },
  { bin: 458793, bank: 'Royal Bank of Canada', card: 'VISA', type: 'CREDIT', country: 'CA' },
  { bin: 545454, bank: 'TD Canada', card: 'MASTERCARD', type: 'DEBIT', country: 'CA' },
  { bin: 491174, bank: 'ANZ', card: 'VISA', type: 'CREDIT', country: 'AU' },
  { bin: 519999, bank: 'Westpac', card: 'MASTERCARD', type: 'CREDIT', country: 'AU' },
  { bin: 460000, bank: 'Deutsche Bank', card: 'VISA', type: 'DEBIT', country: 'DE' },
  { bin: 521234, bank: 'BNP Paribas', card: 'MASTERCARD', type: 'CREDIT', country: 'FR' },
  { bin: 400000, bank: 'Other Issuer', card: 'VISA', type: 'CREDIT', country: 'US' },
];

// Per-client gateway/MID combos. Multiple MIDs per client so the BIN x MID groupings are non-trivial.
const PAYMENTS = [
  { gateway_id: 9001, client_id: 10001, mid: 880001, alias: 'NMI - Acme Primary' },
  { gateway_id: 9002, client_id: 10001, mid: 880002, alias: 'NMI - Acme Backup' },
  { gateway_id: 9003, client_id: 10001, mid: 880003, alias: 'Stripe - Acme INTL' },
  { gateway_id: 9101, client_id: 10002, mid: 880101, alias: 'AuthNet - Northwind A' },
  { gateway_id: 9102, client_id: 10002, mid: 880102, alias: 'AuthNet - Northwind B' },
  { gateway_id: 9103, client_id: 10002, mid: 880103, alias: 'NMI - Northwind C' },
  { gateway_id: 9201, client_id: 10003, mid: 880201, alias: 'Worldpay - Globex US' },
  { gateway_id: 9202, client_id: 10003, mid: 880202, alias: 'Worldpay - Globex EU' },
];

const DECLINE_REASONS = [
  'Insufficient Funds',
  'Card Declined',
  'Invalid CVV',
  'Expired Card',
  'Stolen Card',
  'Do Not Honor',
  'Issuer Unavailable',
];

// Distribution: 1.2M / 600k / 200k across the three tenants (~2M total).
// Approval rate is biased per BIN so the analytics endpoint surfaces variance.
// Override total via SEED_ROWS env (split is preserved proportionally).
const TOTAL_ROWS = parseInt(process.env.SEED_ROWS, 10) || 2_000_000;
const ROW_COUNTS = {
  10001: Math.round(TOTAL_ROWS * 0.6),
  10002: Math.round(TOTAL_ROWS * 0.3),
  10003: TOTAL_ROWS - Math.round(TOTAL_ROWS * 0.6) - Math.round(TOTAL_ROWS * 0.3),
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randDate() {
  // last 90 days
  const ms = Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

async function seed() {
  const c = await pool.connect();
  try {
    console.log('Truncating existing data...');
    await c.query(`
      TRUNCATE data.orders, public.payments, public.bin_lookup, public.clients
      RESTART IDENTITY CASCADE
    `);

    console.log('Seeding clients...');
    for (const x of CLIENTS) {
      await c.query('INSERT INTO public.clients (id, client_name) VALUES ($1, $2)', [x.id, x.name]);
    }

    console.log('Seeding bin_lookup...');
    for (const b of BINS) {
      await c.query(
        'INSERT INTO public.bin_lookup (bin, bank, card, type, country) VALUES ($1, $2, $3, $4, $5)',
        [b.bin, b.bank, b.card, b.type, b.country]
      );
    }

    console.log('Seeding payments...');
    for (const p of PAYMENTS) {
      await c.query(
        'INSERT INTO public.payments (gateway_id, client_id, mid, gateway_alias) VALUES ($1, $2, $3, $4)',
        [p.gateway_id, p.client_id, p.mid, p.alias]
      );
    }

    // Use COPY FROM STDIN for orders. Multi-row INSERT works but at millions
    // of rows the parser and per-batch fsync overhead dominate; COPY is ~5-10x faster.
    for (const client of CLIENTS) {
      const clientPayments = PAYMENTS.filter(p => p.client_id === client.id);
      const n = ROW_COUNTS[client.id];
      console.log(`Seeding ${n.toLocaleString()} orders for client ${client.id}...`);
      const startedAt = Date.now();

      // Per-BIN approval-rate skew so the analytics output isn't flat.
      const binApprovalRate = Object.fromEntries(BINS.map(b => [b.bin, 0.5 + Math.random() * 0.45]));

      const stream = c.query(copyFrom(
        `COPY data.orders
           (order_id, date_of_sale, gateway_id, bin, mid_number, order_total, is_approved, decline_reason, client_id)
         FROM STDIN`
      ));

      let nextLog = 200_000;
      for (let i = 0; i < n; i++) {
        const bin = pick(BINS).bin;
        const pmt = pick(clientPayments);
        const approved = Math.random() < binApprovalRate[bin];
        const total = (5 + Math.random() * 200).toFixed(2);
        const orderId = `ORD-${client.id}-${i}`;
        const declineReason = approved ? '\\N' : pick(DECLINE_REASONS);
        // COPY text format: tab-separated; \N is NULL; t/f for boolean.
        const row = `${orderId}\t${randDate()}\t${pmt.gateway_id}\t${bin}\t${pmt.mid}\t${total}\t${approved ? 't' : 'f'}\t${declineReason}\t${client.id}\n`;
        if (!stream.write(row)) {
          await new Promise(resolve => stream.once('drain', resolve));
        }
        if (i + 1 >= nextLog || i + 1 === n) {
          const pct = Math.round(((i + 1) / n) * 100);
          console.log(`  ${(i + 1).toLocaleString()} / ${n.toLocaleString()} (${pct}%)`);
          nextLog += 200_000;
        }
      }
      stream.end();
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`  done in ${elapsed}s`);
    }

    console.log('Done.');
  } finally {
    c.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
