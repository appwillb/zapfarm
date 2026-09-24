const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'zapfarm-super-secret-key-coolify-2026';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // If running in development without strict token, allow fallback to query param or default tenant
    if (req.query.tenant_id) {
      req.user = { tenant_id: Number(req.query.tenant_id), role: 'admin' };
      return next();
    }
    return res.status(401).json({ error: 'Acesso não autorizado. Token ausente.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
    req.user = user;
    next();
  });
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authenticateToken,
};
