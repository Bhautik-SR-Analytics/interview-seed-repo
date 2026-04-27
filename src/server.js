require('dotenv').config();
const express = require('express');
const tenant = require('./middleware/tenant');
const clients = require('./routes/clients');
const approvalRates = require('./routes/analyticsApprovalRates');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api', tenant);
app.use('/api/clients', clients);
app.use('/api/analytics', approvalRates);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on :${port}`));
