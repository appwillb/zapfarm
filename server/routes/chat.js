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
      AND c.customer_phone NOT LIKE '%broadcast%'
      AND c.customer_phone NOT LIKE '%newsletter%'
      AND c.customer_phone NOT LIKE '%@g.us%'
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

  // 1. Mark as human agent so the automated bot does not interfere with attendant's chat
  db.prepare(`
    UPDATE conversations 
    SET is_human_agent = 1, last_message_at = CURRENT_TIMESTAMP 
    WHERE tenant_id = ? AND customer_phone = ?
  `).run(tenantId, customerPhone);

  // 2. Save in db
  db.prepare(`
    INSERT INTO messages (tenant_id, customer_phone, from_me, text)
    VALUES (?, ?, 1, ?)
  `).run(tenantId, customerPhone, text);

  // 3. Send via Baileys WhatsApp
  const sent = await sessionManager.sendMessage(tenantId, customerPhone, text);

  const wsStatus = sessionManager.getSessionState(tenantId);
  const isConnected = wsStatus?.status === 'connected';

  let warning = null;
  if (!isConnected) {
    warning = '⚠️ Atenção: O WhatsApp da farmácia está desconectado! A mensagem foi salva no painel, mas NÃO pôde ser entregue no WhatsApp do cliente. Vá até a aba "Conexão WhatsApp" para escanear o QR Code.';
  } else if (!sent) {
    warning = '⚠️ Aviso: Não foi possível entregar a mensagem no WhatsApp deste cliente. Verifique se o número do cliente possui WhatsApp ativo.';
  }

  res.json({
    success: true,
    sentToWhatsApp: sent,
    whatsappConnected: isConnected,
    warning,
  });
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

function deleteChatConversation(tenantId, rawPhone) {
  let customerPhone = rawPhone || '';
  try {
    customerPhone = decodeURIComponent(customerPhone);
  } catch (e) {}

  const cleanPhone = customerPhone.replace(/@.*$/, '');

  // Delete messages matching full phone, clean number, or JID suffix
  const msgResult = db
    .prepare(
      `
    DELETE FROM messages 
    WHERE tenant_id = ? 
      AND (customer_phone = ? OR customer_phone = ? OR customer_phone LIKE ?)
  `
    )
    .run(tenantId, customerPhone, cleanPhone, `${cleanPhone}@%`);

  // Delete conversation matching full phone, clean number, or JID suffix
  const convResult = db
    .prepare(
      `
    DELETE FROM conversations 
    WHERE tenant_id = ? 
      AND (customer_phone = ? OR customer_phone = ? OR customer_phone LIKE ?)
  `
    )
    .run(tenantId, customerPhone, cleanPhone, `${cleanPhone}@%`);

  return {
    success: true,
    deletedMessages: msgResult.changes,
    deletedConversations: convResult.changes,
  };
}

// POST /api/chat/:tenantId/delete-conversation - Delete conversation & messages via POST (robust against URL encoding)
router.post('/:tenantId/delete-conversation', (req, res) => {
  const { tenantId } = req.params;
  const customerPhone = req.body.customerPhone || req.body.phone;

  if (!customerPhone) {
    return res.status(400).json({ error: 'customerPhone é obrigatório.' });
  }

  const result = deleteChatConversation(tenantId, customerPhone);
  res.json(result);
});

// DELETE /api/chat/:tenantId/conversations/:customerPhone - Delete conversation & messages
router.delete('/:tenantId/conversations/:customerPhone', (req, res) => {
  const { tenantId, customerPhone } = req.params;
  const result = deleteChatConversation(tenantId, customerPhone);
  res.json(result);
});

module.exports = router;
