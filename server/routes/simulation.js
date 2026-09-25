const express = require('express');
const router = express.Router();
const botEngine = require('../bot/botEngine');
const sessionManager = require('../baileys/sessionManager');
const db = require('../db/database');

// POST /api/simulation/message - simulate an incoming customer WhatsApp message
router.post('/message', async (req, res) => {
  const { tenant_id = 1, phone = '5511999887766', text, name = 'Cliente Teste' } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Texto da mensagem é obrigatório.' });
  }

  try {
    // Broadcast live event to connected frontend
    sessionManager.broadcast(Number(tenant_id), 'new_chat_message', {
      customerPhone: phone,
      fromMe: false,
      text,
      pushName: name,
      timestamp: new Date().toISOString(),
    });

    await botEngine.handleIncomingMessage({
      tenantId: Number(tenant_id),
      customerPhone: phone,
      text,
      pushName: name,
    });

    const messages = db
      .prepare('SELECT * FROM messages WHERE tenant_id = ? AND customer_phone = ? ORDER BY id ASC')
      .all(tenant_id, phone);

    const conv = botEngine.getConversation(tenant_id, phone);

    res.json({
      success: true,
      conversation: conv,
      messages,
    });
  } catch (err) {
    console.error('Error in simulation message:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/simulation/history/:tenantId/:phone
router.get('/history/:tenantId/:phone', (req, res) => {
  const { tenantId, phone } = req.params;
  const messages = db
    .prepare('SELECT * FROM messages WHERE tenant_id = ? AND customer_phone = ? ORDER BY id ASC')
    .all(tenantId, phone);
  const conv = botEngine.getConversation(tenantId, phone);

  res.json({
    conversation: conv,
    messages,
  });
});

// POST /api/simulation/reset
router.post('/reset', (req, res) => {
  const { tenant_id = 1, phone = '5511999887766' } = req.body;
  try {
    db.prepare('DELETE FROM messages WHERE tenant_id = ? AND customer_phone = ?').run(tenant_id, phone);
    botEngine.updateConversation(tenant_id, phone, 'idle', {}, 0);
    res.json({ success: true, message: 'Simulação reiniciada.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
