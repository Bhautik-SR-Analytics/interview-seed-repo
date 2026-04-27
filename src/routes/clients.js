// Sample working route. Returns the caller's own client record.
// Demonstrates how to use req.clientId — does NOT model the per-tenant
// orders-table pattern. That's part of the exercise.

const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/me', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, client_name, created_on FROM public.clients WHERE id = $1',
    [req.clientId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'client not found' });
  res.json(rows[0]);
});

module.exports = router;
