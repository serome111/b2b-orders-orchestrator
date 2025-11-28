const jwt = require('jsonwebtoken');
const config = require('../config');

function extractToken(req) {
  const header = req.headers['authorization'];
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

function authenticate(requireServiceTokenOnly = false) {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }

    if (token === config.serviceToken) {
      req.auth = { type: 'service' };
    } else {
      try {
        const payload = jwt.verify(token, config.jwtSecret);
        req.auth = { type: 'user', payload };
      } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    }

    if (requireServiceTokenOnly && req.auth.type !== 'service') {
      return res.status(403).json({ message: 'Service token required' });
    }

    next();
  };
}

const serviceOnly = authenticate(true);

module.exports = {
  authenticate,
  serviceOnly
};
