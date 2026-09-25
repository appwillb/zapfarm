const express = require('express');
const router = express.Router();
const db = require('../db/database');
const sessionManager = require('../baileys/sessionManager');

// GET /api/drivers?tenant_id=1
router.get('/', (req, res) => {
  const tenantId = req.query.tenant_id || 1;
  const drivers = db.prepare('SELECT * FROM delivery_drivers WHERE tenant_id = ? AND active = 1 ORDER BY name ASC').all(tenantId);
  res.json(drivers);
});

// POST /api/drivers
router.post('/', (req, res) => {
  const { tenant_id = 1, name, phone, vehicle = 'Moto', plate, fee_amount = 7.00 } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Nome e telefone do entregador são obrigatórios.' });
  }

  try {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const insert = db.prepare(`
      INSERT INTO delivery_drivers (tenant_id, name, phone, vehicle, plate, status, fee_amount)
      VALUES (?, ?, ?, ?, ?, 'available', ?)
    `);

    const result = insert.run(tenant_id, name, cleanPhone, vehicle, plate || '', Number(fee_amount) || 7.00);
    const driver = db.prepare('SELECT * FROM delivery_drivers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(driver);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar entregador: ' + err.message });
  }
});

// PUT /api/drivers/:id
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const { name, phone, vehicle, plate, status, fee_amount, active } = req.body;

  try {
    db.prepare(`
      UPDATE delivery_drivers SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        vehicle = COALESCE(?, vehicle),
        plate = COALESCE(?, plate),
        status = COALESCE(?, status),
        fee_amount = COALESCE(?, fee_amount),
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(
      name,
      phone ? phone.replace(/[^\d]/g, '') : null,
      vehicle,
      plate,
      status,
      fee_amount !== undefined ? Number(fee_amount) : null,
      active !== undefined ? (active ? 1 : 0) : null,
      id
    );

    const updated = db.prepare('SELECT * FROM delivery_drivers WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar entregador: ' + err.message });
  }
});

// DELETE /api/drivers/:id
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    db.prepare('UPDATE orders SET driver_id = NULL WHERE driver_id = ?').run(id);
    db.prepare('DELETE FROM delivery_drivers WHERE id = ?').run(id);
    res.json({ success: true, message: 'Entregador excluído com sucesso.' });
  } catch (err) {
    console.error('Erro ao excluir entregador:', err);
    res.status(500).json({ error: 'Erro ao excluir entregador: ' + err.message });
  }
});

// POST /api/drivers/:id/test-message - Test WhatsApp connectivity to driver
router.post('/:id/test-message', async (req, res) => {
  const driver = db.prepare('SELECT * FROM delivery_drivers WHERE id = ?').get(req.params.id);
  if (!driver) return res.status(404).json({ error: 'Entregador não encontrado.' });

  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(driver.tenant_id);

  const testMsg =
    `Olá, ${driver.name}! 👋\n` +
    `Este é um teste de comunicação do sistema de entregas da *${tenant.name}*.\n` +
    `Quando houver um pedido pronto e liberado, você receberá a rota e os detalhes de entrega diretamente aqui! 🛵📦`;

  const sent = await sessionManager.sendMessage(driver.tenant_id, driver.phone, testMsg);
  res.json({
    success: sent,
    message: sent
      ? 'Mensagem enviada com sucesso para o WhatsApp do entregador!'
      : 'Não foi possível enviar via WhatsApp (verifique se a sessão Baileys da farmácia está conectada). Mensagem registrada no log.',
  });
});

module.exports = router;
