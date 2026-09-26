const express = require('express');
const router = express.Router();
const db = require('../db/database');
const botEngine = require('../bot/botEngine');

// GET /api/suppliers?tenant_id=1
router.get('/', (req, res) => {
  const tenantId = req.query.tenant_id || 1;

  try {
    const suppliers = db.prepare(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.active = 1) as product_count,
             (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.active = 1 AND p.stock_quantity <= p.min_stock) as low_stock_count
      FROM suppliers s
      WHERE s.tenant_id = ? AND s.active = 1
      ORDER BY s.name ASC
    `).all(tenantId);

    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar fornecedores/vendedores: ' + err.message });
  }
});

// GET /api/suppliers/:id
router.get('/:id', (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Vendedor não encontrado.' });

    const products = db.prepare(`
      SELECT id, name, dosage, presentation, stock_quantity, min_stock, sale_price
      FROM products
      WHERE supplier_id = ? AND active = 1
      ORDER BY name ASC
    `).all(req.params.id);

    res.json({ ...supplier, products });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar vendedor: ' + err.message });
  }
});

// POST /api/suppliers
router.post('/', (req, res) => {
  const { tenant_id = 1, name, phone, company, email, notes } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Nome e telefone/WhatsApp do vendedor são obrigatórios.' });
  }

  // Clean phone to ensure digits only or proper format
  const cleanPhone = String(phone).replace(/\D/g, '');
  const formattedPhone = cleanPhone.length === 10 || cleanPhone.length === 11 
    ? '55' + cleanPhone 
    : cleanPhone;

  try {
    const insert = db.prepare(`
      INSERT INTO suppliers (tenant_id, name, phone, company, email, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      tenant_id,
      name.trim(),
      formattedPhone,
      company ? company.trim() : '',
      email ? email.trim() : '',
      notes ? notes.trim() : ''
    );

    const created = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar vendedor: ' + err.message });
  }
});

// PUT /api/suppliers/:id
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const { name, phone, company, email, notes, active } = req.body;

  let formattedPhone = phone;
  if (phone) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    formattedPhone = cleanPhone.length === 10 || cleanPhone.length === 11 
      ? '55' + cleanPhone 
      : cleanPhone;
  }

  try {
    db.prepare(`
      UPDATE suppliers SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        company = COALESCE(?, company),
        email = COALESCE(?, email),
        notes = COALESCE(?, notes),
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : null,
      formattedPhone || null,
      company !== undefined ? company.trim() : null,
      email !== undefined ? email.trim() : null,
      notes !== undefined ? notes.trim() : null,
      active !== undefined ? (active ? 1 : 0) : null,
      id
    );

    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar vendedor: ' + err.message });
  }
});

// DELETE /api/suppliers/:id
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  try {
    db.prepare('UPDATE suppliers SET active = 0 WHERE id = ?').run(id);
    // Unlink products or keep history
    res.json({ success: true, message: 'Vendedor/representante removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover vendedor: ' + err.message });
  }
});

// POST /api/suppliers/notify-low-stock/:productId
// Manual action: Pharmacist clicks "Avisar Vendedor Agora"
router.post('/notify-low-stock/:productId', async (req, res) => {
  const productId = req.params.productId;

  try {
    const prod = db.prepare(`
      SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.company as supplier_company
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `).get(productId);

    if (!prod) return res.status(404).json({ error: 'Medicamento não encontrado.' });
    if (!prod.supplier_id || !prod.supplier_phone) {
      return res.status(400).json({ error: 'Este medicamento não possui um vendedor/representante cadastrado com WhatsApp.' });
    }

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(prod.tenant_id);

    const alertMsg = `📦 *SOLICITAÇÃO DE COTAÇÃO E REPOSIÇÃO* 🚨\n\n` +
      `Olá, *${prod.supplier_name}*!\n\n` +
      `A equipe da *${tenant.name}* informa que o medicamento abaixo precisa de atenção e reposição em nosso estoque:\n\n` +
      `💊 *Medicamento:* ${prod.name} ${prod.dosage || ''}\n` +
      `📦 *Apresentação:* ${prod.presentation || prod.form || 'Unidade'}\n` +
      `🏭 *Laboratório / Fabricante:* ${prod.manufacturer || 'Não informado'}\n` +
      `📊 *Estoque Atual:* ${prod.stock_quantity} unidades\n` +
      `⚠️ *Estoque Mínimo:* ${prod.min_stock} unidades\n\n` +
      `👉 Por favor, envie cotação com lote atual e prazo de entrega para novo pedido.\n\n` +
      `Atenciosamente,\n*${tenant.name}*\nWhatsApp: ${tenant.phone || ''}`;

    await botEngine.sendReply(prod.tenant_id, prod.supplier_phone, alertMsg);

    db.prepare('UPDATE products SET last_stock_alert_at = CURRENT_TIMESTAMP WHERE id = ?').run(productId);

    try {
      db.prepare(`
        INSERT INTO audit_logs (tenant_id, user_name, action, details)
        VALUES (?, ?, 'ALERTA_VENDEDOR_MANUAL', ?)
      `).run(prod.tenant_id, req.body.sent_by || 'Farmacêutico', `Alerta manual enviado para ${prod.supplier_name} sobre ${prod.name}.`);
    } catch (e) {}

    res.json({
      success: true,
      message: `Mensagem enviada com sucesso para o representante ${prod.supplier_name} (${prod.supplier_phone})!`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao enviar mensagem para o vendedor: ' + err.message });
  }
});

module.exports = router;
