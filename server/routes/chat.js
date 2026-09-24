const express = require('express');
const router = express.Router();
const db = require('../db/database');
const botEngine = require('../bot/botEngine');
const sessionManager = require('../baileys/sessionManager');

// GET /api/chat/:tenantId/conversations
router.get('/:tenantId/conversations', (req, res) => {
  const tenantId = req.params.tenantId;

  const convs = db
    .prepare(
      `
    SELECT c.*,
      (SELECT text FROM messages m WHERE m.tenant_id = c.tenant_id AND m.customer_phone = c.customer_phone ORDER BY m.id DESC LIMIT 1) as last_message,
      (SELECT timestamp FROM messages m WHERE m.tenant_id = c.tenant_id AND m.customer_phone = c.customer_phone ORDER BY m.id DESC LIMIT 1) as last_message_time
    FROM conversations c
    WHERE c.tenant_id = ?
    ORDER BY c.last_message_at DESC
  `
    )
    .all(tenantId);

  res.json(convs);
});

// GET /api/chat/:tenantId/messages/:customerPhone
router.get('/:tenantId/messages/:customerPhone', (req, res) => {
  const { tenantId, customerPhone } = req.params;

  const messages = db
    .prepare(
      `
    SELECT * FROM messages
    WHERE tenant_id = ? AND customer_phone = ?
    ORDER BY id ASC
  `
    )
    .all(tenantId, customerPhone);

  const conversation = db
    .prepare(
      `
    SELECT * FROM conversations
    WHERE tenant_id = ? AND customer_phone = ?
  `
    )
    .get(tenantId, customerPhone);

  res.json({
    conversation,
    messages,
  });
});

// POST /api/chat/:tenantId/send - Attendant sends manual message
router.post('/:tenantId/send', async (req, res) => {
  const { tenantId } = req.params;
  const { customerPhone, text } = req.body;

  if (!customerPhone || !text) {
    return res.status(400).json({ error: 'Telefone e texto são obrigatórios.' });
  }

  // Save in db
  db.prepare(`
    INSERT INTO messages (tenant_id, customer_phone, from_me, text)
    VALUES (?, ?, 1, ?)
  `).run(tenantId, customerPhone, text);

  // Update last message time
  db.prepare(`
    UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND customer_phone = ?
  `).run(tenantId, customerPhone);

  // Send via Baileys
  await sessionManager.sendMessage(tenantId, customerPhone, text);

  res.json({ success: true });
});

// POST /api/chat/:tenantId/toggle-human - Take over chat or return to bot
router.post('/:tenantId/toggle-human', (req, res) => {
  const { tenantId } = req.params;
  const { customerPhone, isHuman } = req.body;

  db.prepare(`
    UPDATE conversations SET is_human_agent = ? WHERE tenant_id = ? AND customer_phone = ?
  `).run(isHuman ? 1 : 0, tenantId, customerPhone);

  res.json({ success: true, is_human_agent: isHuman ? 1 : 0 });
});

module.exports = router;
