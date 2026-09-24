const express = require('express');
const router = express.Router();
const sessionManager = require('../baileys/sessionManager');
const db = require('../db/database');

// GET /api/whatsapp/:tenantId/status
router.get('/:tenantId/status', (req, res) => {
  const tenantId = req.params.tenantId;
  const state = sessionManager.getSessionState(tenantId);
  res.json(state);
});

// POST /api/whatsapp/:tenantId/connect
router.post('/:tenantId/connect', async (req, res) => {
  const tenantId = req.params.tenantId;
  try {
    const state = await sessionManager.initSession(tenantId);
    res.json({ success: true, ...state });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao iniciar conexão WhatsApp: ' + err.message });
  }
});

// POST /api/whatsapp/:tenantId/disconnect
router.post('/:tenantId/disconnect', async (req, res) => {
  const tenantId = req.params.tenantId;
  try {
    const result = await sessionManager.disconnect(tenantId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desconectar: ' + err.message });
  }
});

// POST /api/whatsapp/:tenantId/send-test
router.post('/:tenantId/send-test', async (req, res) => {
  const tenantId = req.params.tenantId;
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios.' });
  }

  const success = await sessionManager.sendMessage(tenantId, phone, message);
  res.json({
    success,
    message: success
      ? 'Mensagem enviada com sucesso!'
      : 'Sessão WhatsApp desconectada ou erro no envio.',
  });
});

module.exports = router;
