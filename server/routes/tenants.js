const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireSuperadmin } = require('../middleware/auth');

// GET /api/tenants - list all tenants (only superadmin sees all; staff sees only their own)
router.get('/', authenticateToken, (req, res) => {
  if (req.user.role === 'superadmin') {
    const tenants = db.prepare('SELECT * FROM tenants ORDER BY id ASC').all();
    return res.json(tenants);
  }
  const own = req.user.tenant_id
    ? db.prepare('SELECT * FROM tenants WHERE id = ?').all(req.user.tenant_id)
    : [];
  res.json(own);
});

// GET /api/tenants/:id
router.get('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'superadmin' && Number(req.params.id) !== Number(req.user.tenant_id)) {
    return res.status(403).json({ error: 'Acesso restrito a propria farmacia.' });
  }
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  if (!tenant) {
    return res.status(404).json({ error: 'Farmácia não encontrada.' });
  }
  res.json(tenant);
});

const botEngine = require('../bot/botEngine');

// POST /api/tenants - create new pharmacy (SaaS platform owner)
router.post('/', authenticateToken, requireSuperadmin, (req, res) => {
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
    free_shipping_threshold = 120.00,
    min_delivery_value = 0.00,
    address,
    business_hours = '08:00 às 22:00',
    welcome_message,
    logo_url,
  } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: 'Nome e identificador (slug) são obrigatórios.' });
  }

  try {
    const feeDefault = delivery_fee_default !== undefined && delivery_fee_default !== null && delivery_fee_default !== ''
      ? Number(delivery_fee_default)
      : 7.00;
    const minDelivery = min_delivery_value !== undefined && min_delivery_value !== null && min_delivery_value !== ''
      ? Number(min_delivery_value)
      : 0.00;

    const insert = db.prepare(`
      INSERT INTO tenants (
        name, slug, cnpj, phone, email, plan, pix_key, pix_type,
        delivery_fee_default, free_shipping_threshold, min_delivery_value,
        address, business_hours, welcome_message, logo_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      feeDefault,
      Number(free_shipping_threshold) || 120.00,
      minDelivery,
      address || '',
      business_hours,
      welcome_message || `Olá! Bem-vindo(a) à ${name}. Qual remédio ou produto você procura hoje?`,
      logo_url || null
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
router.put('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'superadmin' && Number(req.params.id) !== Number(req.user.tenant_id)) {
    return res.status(403).json({ error: 'Acesso restrito a propria farmacia.' });
  }
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
    min_delivery_value,
    min_order_value,
    address,
    business_hours,
    welcome_message,
    pharmacist_alert_phone,
    gemini_api_key,
    ai_enabled,
    ai_system_prompt,
    status,
    plan,
    logo_url,
  } = req.body;

  try {
    const minVal = min_delivery_value !== undefined ? min_delivery_value : min_order_value;

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
        min_delivery_value = COALESCE(?, min_delivery_value),
        address = COALESCE(?, address),
        business_hours = COALESCE(?, business_hours),
        welcome_message = COALESCE(?, welcome_message),
        pharmacist_alert_phone = COALESCE(?, pharmacist_alert_phone),
        gemini_api_key = COALESCE(?, gemini_api_key),
        ai_enabled = COALESCE(?, ai_enabled),
        ai_system_prompt = COALESCE(?, ai_system_prompt),
        status = COALESCE(?, status),
        plan = COALESCE(?, plan),
        logo_url = CASE WHEN ? IS NOT NULL THEN ? ELSE logo_url END
      WHERE id = ?
    `).run(
      name,
      cnpj,
      phone,
      email,
      pix_key,
      pix_type,
      delivery_fee_default !== undefined && delivery_fee_default !== '' ? Number(delivery_fee_default) : null,
      free_shipping_threshold !== undefined && free_shipping_threshold !== '' ? Number(free_shipping_threshold) : null,
      minVal !== undefined && minVal !== '' ? Number(minVal) : null,
      address,
      business_hours,
      welcome_message,
      pharmacist_alert_phone !== undefined ? (pharmacist_alert_phone ? String(pharmacist_alert_phone).replace(/\D/g, '') : '') : null,
      gemini_api_key !== undefined ? (gemini_api_key ? String(gemini_api_key).trim() : '') : null,
      ai_enabled !== undefined ? (ai_enabled ? 1 : 0) : null,
      ai_system_prompt !== undefined ? String(ai_system_prompt) : null,
      status,
      plan,
      logo_url !== undefined ? logo_url : null,
      logo_url !== undefined ? logo_url : null,
      tenantId
    );

    const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar configurações: ' + err.message });
  }
});

// POST /api/tenants/:id/preview-pix - test/preview generated Pix code
router.post('/:id/preview-pix', authenticateToken, (req, res) => {
  if (req.user.role !== 'superadmin' && Number(req.params.id) !== Number(req.user.tenant_id)) {
    return res.status(403).json({ error: 'Acesso restrito a propria farmacia.' });
  }
  const { pix_key, pix_type, amount = 10.00 } = req.body;
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id) || {};
  const effectiveKey = pix_key !== undefined ? pix_key : tenant.pix_key;
  const effectiveType = pix_type !== undefined ? pix_type : tenant.pix_type;

  const code = botEngine.generatePixCode({
    pixKey: effectiveKey || '12345678000190',
    pixType: effectiveType || 'cnpj',
    merchantName: tenant.name || 'FARMACIA',
    merchantCity: 'SAO PAULO',
    amount: Number(amount) || 10.00,
    txid: 'TESTEPIX'
  });
  const formattedKey = botEngine.formatPixKey(effectiveKey, effectiveType);
  res.json({ pix_code: code, formatted_key: formattedKey });
});

module.exports = router;
