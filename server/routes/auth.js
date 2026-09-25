const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { generateToken, authenticateToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  let tenant = null;
  if (user.tenant_id) {
    tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(user.tenant_id);
  }

  const token = generateToken(user);

  res.json({
    token,
    user: {
      id: user.id,
      tenant_id: user.tenant_id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    tenant,
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, tenant_id, name, email, role FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  let tenant = null;
  if (user.tenant_id) {
    tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(user.tenant_id);
  }

  res.json({ user, tenant });
});

// GET /api/auth/users - list all users (for SaaS admin)
router.get('/users', (req, res) => {
  const users = db
    .prepare(
      `
    SELECT u.id, u.tenant_id, u.name, u.email, u.role, u.active, u.created_at, t.name as tenant_name
    FROM users u
    LEFT JOIN tenants t ON t.id = u.tenant_id
    ORDER BY u.id ASC
  `
    )
    .all();
  res.json(users);
});

// POST /api/auth/users - create new user
router.post('/users', (req, res) => {
  const { tenant_id, name, email, password, role = 'admin' } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      `
    INSERT INTO users (tenant_id, name, email, password_hash, role, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `
    )
    .run(tenant_id ? Number(tenant_id) : null, name.trim(), email.trim().toLowerCase(), hash, role);

  const newUser = db
    .prepare('SELECT id, tenant_id, name, email, role, active, created_at FROM users WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(newUser);
});

// PUT /api/auth/users/:id - update user (email, name, password, role, tenant_id)
router.put('/users/:id', (req, res) => {
  const userId = Number(req.params.id);
  const { name, email, password, role, tenant_id, active } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  if (email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .get(email.trim().toLowerCase(), userId);
    if (existing) {
      return res.status(409).json({ error: 'Este e-mail já está sendo utilizado por outro usuário.' });
    }
  }

  const newEmail = email ? email.trim().toLowerCase() : user.email;
  const newName = name ? name.trim() : user.name;
  const newRole = role !== undefined ? role : user.role;
  const newTenantId = tenant_id !== undefined ? (tenant_id ? Number(tenant_id) : null) : user.tenant_id;
  const newActive = active !== undefined ? (active ? 1 : 0) : user.active;

  if (password && password.trim().length > 0) {
    const hash = bcrypt.hashSync(password.trim(), 10);
    db.prepare(
      `
      UPDATE users 
      SET name = ?, email = ?, password_hash = ?, role = ?, tenant_id = ?, active = ?
      WHERE id = ?
    `
    ).run(newName, newEmail, hash, newRole, newTenantId, newActive, userId);
  } else {
    db.prepare(
      `
      UPDATE users 
      SET name = ?, email = ?, role = ?, tenant_id = ?, active = ?
      WHERE id = ?
    `
    ).run(newName, newEmail, newRole, newTenantId, newActive, userId);
  }

  const updated = db
    .prepare('SELECT id, tenant_id, name, email, role, active, created_at FROM users WHERE id = ?')
    .get(userId);
  res.json({ success: true, user: updated });
});

// DELETE /api/auth/users/:id - delete user
router.delete('/users/:id', (req, res) => {
  const userId = Number(req.params.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  // Prevent deleting the last superadmin
  if (user.role === 'superadmin') {
    const superadminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'").get().count;
    if (superadminCount <= 1) {
      return res.status(400).json({ error: 'Não é possível excluir o único Super Administrador da plataforma.' });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ success: true });
});

module.exports = router;
