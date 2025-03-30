const authenticateRemoteUser = (req, res, next) => {
  // Check if authentication is required
  const authRequired = process.env.REMOTE_CONTROL_AUTH_REQUIRED === 'true';
  if (!authRequired) {
    return next();
  }

  // Check for allowed IPs
  const allowedIPs = (process.env.REMOTE_CONTROL_ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);
  if (allowedIPs.length > 0) {
    const clientIP = req.ip || req.connection.remoteAddress;
    if (allowedIPs.includes(clientIP) || allowedIPs.includes('*')) {
      return next();
    }
  }

  // Check for auth token
  const authToken = process.env.REMOTE_CONTROL_AUTH_TOKEN;
  if (!authToken) {
    return res.status(500).json({ error: 'Authentication is required but no token is configured' });
  }

  // Get the token from the request
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Validate the token
  if (token !== authToken) {
    return res.status(403).json({ error: 'Invalid authentication token' });
  }

  next();
};

module.exports = {
  authenticateRemoteUser
}; 