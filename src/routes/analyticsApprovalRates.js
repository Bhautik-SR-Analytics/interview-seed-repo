const express = require('express');
const pool = require('../db');

const router = express.Router();

// TODO (interview exercise):
// Implement GET /api/analytics/approval-rates
//
// Return the approval rate broken down by BIN and MID for the caller's client.
// Include bank / card-brand context from public.bin_lookup where available.
// Pagination is nice-to-have.
//
// Notes:
//   - The caller's client_id is available on req.clientId (see src/middleware/tenant.js).
//   - Orders live in data.orders, with a client_id column.
//   - public.bin_lookup is keyed by `bin`.
//   - public.payments has (gateway_id, client_id, mid, gateway_alias).
router.get('/approval-rates', async (req, res) => {
  res.status(501).json({ error: 'not implemented' });
});

module.exports = router;
