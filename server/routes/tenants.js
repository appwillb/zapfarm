const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/tenants - list all tenants (for superadmin or switching in demo)
router.get('/', (req, res) => {
  const tenants = db.prepare('SELECT * FROM tenants ORDER BY id ASC').all();
  res.json(tenants);
});

// GET /api/tenants/:id
router.get('/:id', (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  if (!tenant) {
    return res.status(404).json({ error: 'Farmácia não encontrada.' });
  }
  res.json(tenant);
});

// POST /api/tenants - create new pharmacy (SaaS platform owner)
router.post('/', (req, res) => {
  const {
    name,
    slug,
    cnpj,
    phone,
    email,
    plan = 'starter',
    pix_key,
    pix_type = 'cnpj',
    delivery_fee_default = 7.00,
    address,
    business_hours = '08:00 às 22:00',
    welcome_message,
  } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: 'Nome e identificador (slug) são obrigatórios.' });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO tenants (
        name, slug, cnpj, phone, email, plan, pix_key, pix_type,
        delivery_fee_default, address, business_hours, welcome_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      name,
      slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      cnpj || '',
      phone || '',
      email || '',
      plan,
      pix_key || '',
      pix_type,
      Number(delivery_fee_default) || 7.00,
      address || '',
      business_hours,
      welcome_message || `Olá! Bem-vindo(a) à ${name}. Qual remédio ou produto você procura hoje?`
    );

    const newTenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(result.lastInsertRowid);

    // If initial admin user credentials provided, create the pharmacy owner user
    const { admin_name, admin_email, admin_password } = req.body;
    if (admin_email && admin_password) {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync(admin_password, 10);
      db.prepare(`
        INSERT INTO users (tenant_id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, 'admin')
      `).run(newTenant.id, admin_name || `Admin ${name}`, admin_email, hash);
    }

    res.status(201).json(newTenant);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed: tenants.slug')) {
      return res.status(409).json({ error: 'Já existe uma farmácia com este identificador (slug).' });
    }
    res.status(500).json({ error: 'Erro ao criar farmácia: ' + err.message });
  }
});

// PUT /api/tenants/:id - update pharmacy settings
router.put('/:id', (req, res) => {
  const tenantId = req.params.id;
  const {
    name,
    cnpj,
    phone,
    email,
    pix_key,
    pix_type,
    delivery_fee_default,
    free_shipping_threshold,
    address,
    business_hours,
    welcome_message,
    status,
    plan,
  } = req.body;

  try {
    db.prepare(`
      UPDATE tenants SET
        name = COALESCE(?, name),
        cnpj = COALESCE(?, cnpj),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        pix_key = COALESCE(?, pix_key),
        pix_type = COALESCE(?, pix_type),
        delivery_fee_default = COALESCE(?, delivery_fee_default),
        free_shipping_threshold = COALESCE(?, free_shipping_threshold),
        address = COALESCE(?, address),
        business_hours = COALESCE(?, business_hours),
        welcome_message = COALESCE(?, welcome_message),
        status = COALESCE(?, status),
        plan = COALESCE(?, plan)
      WHERE id = ?
    `).run(
      name,
      cnpj,
      phone,
      email,
      pix_key,
      pix_type,
      delivery_fee_default !== undefined ? Number(delivery_fee_default) : null,
      free_shipping_threshold !== undefined ? Number(free_shipping_threshold) : null,
      address,
      business_hours,
      welcome_message,
      status,
      plan,
      tenantId
    );

    const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar configurações: ' + err.message });
  }
});

module.exports = router;
