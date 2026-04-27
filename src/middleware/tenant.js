// Reads x-client-id from the request and attaches it to req.clientId.
// In production this would come from the JWT/auth context, not a header.
module.exports = function tenant(req, res, next) {
  const raw = req.header('x-client-id');
  if (!raw) return res.status(401).json({ error: 'missing x-client-id header' });
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid x-client-id' });
  }
  req.clientId = id;
  next();
};
