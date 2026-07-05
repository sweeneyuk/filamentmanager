const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('./database');
const { getJwtSecret, initOidcClient } = require('./auth');

// Helper
const runQuery = (query, params) => new Promise((resolve, reject) => db.run(query, params, function(err) { err ? reject(err) : resolve(this) }));
const getQuery = (query, params) => new Promise((resolve, reject) => db.get(query, params, (err, row) => err ? reject(err) : resolve(row)));

// Check if setup is required
router.get('/setup-check', async (req, res) => {
  try {
    const row = await getQuery("SELECT COUNT(*) as count FROM users");
    res.json({ setupRequired: row.count === 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initial Setup
router.post('/setup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const row = await getQuery("SELECT COUNT(*) as count FROM users");
    if (row.count > 0) return res.status(403).json({ error: 'Setup already complete' });

    const hash = await bcrypt.hash(password, 10);
    await runQuery("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)", [username, hash]);
    
    // Issue token
    const secret = await getJwtSecret();
    const token = jwt.sign({ username, is_admin: 1 }, secret, { expiresIn: '7d' });
    
    res.json({ success: true, token, user: { username, is_admin: 1 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Local Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const user = await getQuery("SELECT * FROM users WHERE username = ?", [username]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const secret = await getJwtSecret();
    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, secret, { expiresIn: '7d' });
    
    res.json({ success: true, token, user: { username: user.username, is_admin: user.is_admin } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify Token
router.get('/verify', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.json({ valid: false });

  try {
    const secret = await getJwtSecret();
    jwt.verify(token, secret, (err, user) => {
      if (err) return res.json({ valid: false });
      res.json({ valid: true, user });
    });
  } catch (err) {
    res.json({ valid: false });
  }
});

// OIDC Login
router.get('/oidc/login', async (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/auth/oidc/callback`;
    console.log('[OIDC] Initiating login with redirect URI:', redirectUri);
    const client = await initOidcClient(redirectUri);
    if (!client) return res.status(400).json({ error: 'OIDC not configured' });

    const url = client.authorizationUrl({
      scope: 'openid profile email',
    });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OIDC Callback
router.get('/oidc/callback', async (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/auth/oidc/callback`;
    console.log('[OIDC] Processing callback for redirect URI:', redirectUri);
    
    const client = await initOidcClient(redirectUri);
    if (!client) return res.status(400).send('OIDC not configured');

    const params = client.callbackParams(req);
    const tokenSet = await client.callback(redirectUri, params);
    const claims = tokenSet.claims();
    
    // Check if username exists (preferred_username or name or email)
    const username = claims.preferred_username || claims.nickname || claims.name || claims.email;
    console.log('[OIDC] Authenticated user:', username);
    
    const user = await getQuery("SELECT * FROM users WHERE username = ?", [username]);
    if (!user) {
      // User doesn't exist locally, and per user request: "not to create a new user"
      return res.redirect('/login?error=Access+Denied.+User+does+not+exist+locally.');
    }

    const secret = await getJwtSecret();
    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, secret, { expiresIn: '7d' });
    
    // Redirect to frontend with token in hash or query (query is easier for client to parse)
    res.redirect(`/?token=${token}`);
  } catch (err) {
    console.error('OIDC Callback Error:', err);
    res.redirect('/login?error=OIDC+Authentication+Failed');
  }
});

module.exports = router;
