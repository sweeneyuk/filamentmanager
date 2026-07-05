const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('./database');
const crypto = require('crypto');

// Generate a random JWT secret if one doesn't exist in settings
const getJwtSecret = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT value FROM settings WHERE key = 'jwt_secret'", (err, row) => {
      if (err) return reject(err);
      if (row && row.value) {
        resolve(row.value);
      } else {
        const secret = crypto.randomBytes(64).toString('hex');
        db.run("INSERT INTO settings (key, value) VALUES ('jwt_secret', ?)", [secret], (err) => {
          if (err) return reject(err);
          resolve(secret);
        });
      }
    });
  });
};

// Middleware to protect routes
const authenticateToken = async (req, res, next) => {
  // Allow public access if no users exist (initial setup phase)
  db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row.count === 0) {
      // If no users exist, we allow all requests through so the app can function 
      // or redirect to setup. But we should just pass through and let the frontend 
      // handle the setup redirect.
      req.user = null;
      req.setupRequired = true;
      return next();
    }

    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
    const token = headerToken || req.query.token;

    if (!token) {
      return res.status(401).json({ error: 'Access denied, token missing' });
    }

    try {
      const secret = await getJwtSecret();
      jwt.verify(token, secret, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        req.setupRequired = false;
        next();
      });
    } catch (err) {
      res.status(500).json({ error: 'Authentication error' });
    }
  });
};

// OpenID Connect Logic
const initOidcClient = async (redirectUri) => {
  try {
    const { Issuer } = require('openid-client');
    const getSetting = (key) => new Promise((resolve) => db.get("SELECT value FROM settings WHERE key = ?", [key], (e, r) => resolve(r ? r.value : null)));
    
    const issuerUrl = await getSetting('oidc_issuer');
    const clientId = await getSetting('oidc_client_id');
    const clientSecret = await getSetting('oidc_client_secret');

    if (!issuerUrl || !clientId || !clientSecret) return null;

    const issuer = await Issuer.discover(issuerUrl);
    const client = new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [redirectUri || 'http://localhost:3000/api/auth/oidc/callback'],
      response_types: ['code'],
    });

    return client;
  } catch (err) {
    console.error('Failed to initialize OIDC Client:', err.message);
    return null;
  }
};

module.exports = {
  authenticateToken,
  getJwtSecret,
  initOidcClient
};
