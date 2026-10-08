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
    return res.status(401).json({ error: 'Acesso nao autorizado. Token ausente.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalido ou expirado.' });
    }
    req.user = user;
    next();
  });
}

// Garante que o usuario so acesse dados do seu proprio tenant.
// Superadmin pode acessar qualquer tenant (acesso global da plataforma).
function requireTenant(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Acesso nao autorizado.' });
  }

  if (user.role === 'superadmin') {
    // Superadmin pode indicar tenant via query (troca de farmacia no painel SaaS)
    req.tenantId = req.query.tenant_id ? Number(req.query.tenant_id) : (user.tenant_id || 1);
    return next();
  }

  // Funcionarios so acessam o proprio tenant
  req.tenantId = user.tenant_id;
  next();
}

// Middlewares de permissao por papel
function requireSuperadmin(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador da plataforma.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  const allowed = ['superadmin', 'admin', 'pharmacist'];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ error: 'Acesso restrito a administradores e farmaceuticos.' });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authenticateToken,
  requireTenant,
  requireSuperadmin,
  requireAdmin,
};
