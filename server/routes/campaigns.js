const express = require('express');
const router = express.Router();
const db = require('../db/database');
const sessionManager = require('../baileys/sessionManager');

// In-memory set to manage background campaign workers
const activeWorkers = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Background queue processor with anti-ban delay and randomization
async function processCampaignQueue(campaignId, tenantId) {
  if (activeWorkers.has(campaignId)) return;
  activeWorkers.set(campaignId, true);

  console.log(`[Campanhas] 🚀 Iniciando processamento da campanha #${campaignId} para tenant #${tenantId}`);

  try {
    const tenant = db.prepare('SELECT name FROM tenants WHERE id = ?').get(tenantId);
    const tenantName = tenant?.name || 'Nossa Farmácia';

    while (activeWorkers.get(campaignId)) {
      const campaign = db.prepare('SELECT * FROM marketing_campaigns WHERE id = ?').get(campaignId);
      if (!campaign || campaign.status !== 'running') {
        console.log(`[Campanhas] ⏸️ Campanha #${campaignId} pausada ou finalizada.`);
        break;
      }

      // Fetch next pending lead
      const nextItem = db
        .prepare('SELECT * FROM campaign_logs WHERE campaign_id = ? AND status = ? LIMIT 1')
        .get(campaignId, 'pending');

      if (!nextItem) {
        // No more pending leads; mark as completed
        db.prepare(
          'UPDATE marketing_campaigns SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run('completed', campaignId);

        sessionManager.broadcast(tenantId, 'campaign_completed', {
          campaignId,
          sent_count: campaign.sent_count,
          failed_count: campaign.failed_count,
          total_leads: campaign.total_leads,
        });

        console.log(`[Campanhas] 🎉 Campanha #${campaignId} concluída com sucesso! Total: ${campaign.total_leads}`);
        break;
      }

      // Personalize message with customer name and pharmacy name
      const customerName = nextItem.customer_name || 'Cliente';
      let personalizedText = campaign.message
        .replace(/{nome}/gi, customerName)
        .replace(/{cliente}/gi, customerName)
        .replace(/{farmacia}/gi, tenantName)
        .replace(/{data}/gi, new Date().toLocaleDateString('pt-BR'));

      console.log(`[Campanhas] 📤 Enviando para ${nextItem.phone} (${customerName})...`);

      // Attempt send via Baileys WhatsApp
      const success = await sessionManager.sendMessage(
        tenantId,
        nextItem.phone,
        personalizedText,
        campaign.image_url
      );

      if (success) {
        db.prepare(
          'UPDATE campaign_logs SET status = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run('sent', nextItem.id);
        db.prepare(
          'UPDATE marketing_campaigns SET sent_count = sent_count + 1 WHERE id = ?'
        ).run(campaignId);
      } else {
        db.prepare(
          'UPDATE campaign_logs SET status = ?, error_message = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run('failed', 'Não foi possível entregar a mensagem no WhatsApp', nextItem.id);
        db.prepare(
          'UPDATE marketing_campaigns SET failed_count = failed_count + 1 WHERE id = ?'
        ).run(campaignId);
      }

      // Re-fetch updated campaign counts for broadcast
      const currentStats = db.prepare('SELECT sent_count, failed_count, total_leads FROM marketing_campaigns WHERE id = ?').get(campaignId);

      sessionManager.broadcast(tenantId, 'campaign_progress', {
        campaignId,
        sent_count: currentStats.sent_count,
        failed_count: currentStats.failed_count,
        total_leads: currentStats.total_leads,
        last_phone: nextItem.phone,
        last_name: customerName,
        success,
      });

      // Anti-ban human delay: base delay + random jitter (± 5 to 10 seconds)
      const baseDelay = Number(campaign.delay_seconds) || 25;
      const jitter = Math.floor(Math.random() * 8) - 4; // -4 to +4 seconds
      const finalDelaySeconds = Math.max(12, baseDelay + jitter);

      console.log(`[Campanhas] ⏳ Aguardando intervalo de segurança anti-ban (${finalDelaySeconds}s) antes do próximo envio...`);
      await sleep(finalDelaySeconds * 1000);
    }
  } catch (err) {
    console.error(`[Campanhas] ❌ Erro na execução da campanha #${campaignId}:`, err);
  } finally {
    activeWorkers.delete(campaignId);
  }
}

// GET /api/campaigns - List campaigns for tenant
router.get('/', (req, res) => {
  const { tenant_id } = req.query;
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório.' });

  const campaigns = db
    .prepare(
      `
    SELECT * FROM marketing_campaigns
    WHERE tenant_id = ?
    ORDER BY id DESC
  `
    )
    .all(Number(tenant_id));

  res.json(campaigns);
});

// Helper to clean Brazilian phone numbers
function sanitizePhone(rawPhone) {
  if (!rawPhone) return '';
  let clean = String(rawPhone).replace(/\D/g, '');
  if (clean.length === 10 || clean.length === 11) {
    clean = '55' + clean;
  }
  return clean;
}

// GET /api/campaigns/leads - Get available qualified leads for broadcast
router.get('/leads', (req, res) => {
  const { tenant_id } = req.query;
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório.' });

  const tId = Number(tenant_id);

  // 1. Fetch opt-out phones for this tenant
  const optOutRows = db.prepare('SELECT phone FROM opt_out_leads WHERE tenant_id = ?').all(tId);
  const optOutSet = new Set(optOutRows.map((r) => r.phone.replace(/\D/g, '')));

  // 2. Fetch manual leads
  const manualLeads = db
    .prepare(
      `
    SELECT phone, name, created_at as last_message_at, source
    FROM marketing_leads
    WHERE tenant_id = ?
    ORDER BY id DESC
  `
    )
    .all(tId);

  // 3. Fetch unique leads from conversations and orders
  const conversations = db
    .prepare(
      `
    SELECT customer_phone as phone, customer_name as name, last_message_at, 'chat' as source
    FROM conversations
    WHERE tenant_id = ? AND customer_phone IS NOT NULL AND customer_phone != ''
    ORDER BY last_message_at DESC
  `
    )
    .all(tId);

  const orders = db
    .prepare(
      `
    SELECT customer_phone as phone, customer_name as name, created_at as last_message_at, 'order' as source
    FROM orders
    WHERE tenant_id = ? AND customer_phone IS NOT NULL AND customer_phone != ''
    ORDER BY created_at DESC
  `
    )
    .all(tId);

  const leadMap = new Map();

  for (const item of [...manualLeads, ...conversations, ...orders]) {
    const raw = String(item.phone || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (!digits || digits.length < 8) continue;

    // Check opt-out
    if (optOutSet.has(digits)) continue;

    if (!leadMap.has(digits)) {
      leadMap.set(digits, {
        phone: raw,
        clean_phone: digits,
        name: item.name && item.name !== 'Cliente' ? item.name : 'Cliente',
        last_interaction: item.last_message_at,
        source: item.source || 'chat',
      });
    } else if (item.name && item.name !== 'Cliente' && leadMap.get(digits).name === 'Cliente') {
      leadMap.get(digits).name = item.name;
    }
  }

  const leads = Array.from(leadMap.values());

  res.json({
    total_available: leads.length,
    total_opt_out: optOutSet.size,
    leads,
  });
});

// POST /api/campaigns/leads - Add single lead manually
router.post('/leads', (req, res) => {
  const { tenant_id, phone, name } = req.body;
  if (!tenant_id || !phone) {
    return res.status(400).json({ error: 'tenant_id e phone são obrigatórios.' });
  }

  const cleanPhone = sanitizePhone(phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Número de WhatsApp inválido. Digite DDD + número (ex: 11988887777).' });
  }

  const leadName = (name || 'Cliente').trim();
  const tId = Number(tenant_id);

  try {
    db.prepare(`
      INSERT INTO marketing_leads (tenant_id, phone, name, source)
      VALUES (?, ?, ?, 'manual')
      ON CONFLICT(tenant_id, phone) DO UPDATE SET name = excluded.name
    `).run(tId, cleanPhone, leadName);

    // Also register in conversations so it is readily visible in chat if needed
    try {
      db.prepare(`
        INSERT INTO conversations (tenant_id, customer_phone, customer_name, state)
        VALUES (?, ?, ?, 'idle')
        ON CONFLICT(tenant_id, customer_phone) DO UPDATE SET customer_name = excluded.customer_name
      `).run(tId, cleanPhone, leadName);
    } catch (_) {}

    res.status(201).json({
      success: true,
      lead: { phone: cleanPhone, name: leadName, source: 'manual' },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/leads/bulk - Import multiple leads (CSV / pasted list)
router.post('/leads/bulk', (req, res) => {
  const { tenant_id, raw_text, contacts } = req.body;
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório.' });

  const tId = Number(tenant_id);
  const leadsToInsert = [];

  if (Array.isArray(contacts) && contacts.length > 0) {
    for (const c of contacts) {
      const clean = sanitizePhone(c.phone);
      if (clean && clean.length >= 10) {
        leadsToInsert.push({ phone: clean, name: (c.name || 'Cliente').trim() });
      }
    }
  } else if (typeof raw_text === 'string' && raw_text.trim()) {
    // Parse lines: each line can be "Phone, Name" or "Name; Phone" or just "Phone"
    const lines = raw_text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check if comma or semicolon separated
      const parts = trimmed.split(/[,;\t]/).map((p) => p.trim());
      let pPhone = '';
      let pName = 'Cliente';

      if (parts.length >= 2) {
        const p1Digits = parts[0].replace(/\D/g, '');
        const p2Digits = parts[1].replace(/\D/g, '');

        if (p1Digits.length >= 10) {
          pPhone = p1Digits;
          pName = parts[1] || 'Cliente';
        } else if (p2Digits.length >= 10) {
          pPhone = p2Digits;
          pName = parts[0] || 'Cliente';
        }
      } else {
        pPhone = trimmed.replace(/\D/g, '');
      }

      const clean = sanitizePhone(pPhone);
      if (clean && clean.length >= 10) {
        leadsToInsert.push({ phone: clean, name: pName });
      }
    }
  }

  if (leadsToInsert.length === 0) {
    return res.status(400).json({ error: 'Nenhum contato com número de telefone válido encontrado.' });
  }

  const insertStmt = db.prepare(`
    INSERT INTO marketing_leads (tenant_id, phone, name, source)
    VALUES (?, ?, ?, 'import')
    ON CONFLICT(tenant_id, phone) DO UPDATE SET name = excluded.name
  `);

  const insertMany = db.transaction((list) => {
    let count = 0;
    for (const item of list) {
      insertStmt.run(tId, item.phone, item.name);
      count++;
    }
    return count;
  });

  const inserted = insertMany(leadsToInsert);

  res.json({
    success: true,
    total_imported: inserted,
    message: `${inserted} contatos importados com sucesso!`,
  });
});

// DELETE /api/campaigns/leads/:phone - Remove lead from broadcast list
router.delete('/leads/:phone', (req, res) => {
  const { tenant_id } = req.query;
  const rawPhone = req.params.phone;

  if (!tenant_id || !rawPhone) {
    return res.status(400).json({ error: 'tenant_id e phone são obrigatórios.' });
  }

  const tId = Number(tenant_id);
  const cleanPhone = sanitizePhone(rawPhone);

  try {
    // Delete from marketing_leads
    db.prepare('DELETE FROM marketing_leads WHERE tenant_id = ? AND (phone = ? OR phone = ?)').run(
      tId,
      rawPhone,
      cleanPhone
    );

    // Also register in opt_out_leads to prevent pulling from old chats/orders
    db.prepare(`
      INSERT OR REPLACE INTO opt_out_leads (tenant_id, phone, reason)
      VALUES (?, ?, 'Removido pelo usuário')
    `).run(tId, cleanPhone);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/test - Send immediate test broadcast to single phone number
router.post('/test', async (req, res) => {
  const { tenant_id, phone, message, image_url } = req.body;

  if (!tenant_id || !phone || !message) {
    return res.status(400).json({ error: 'tenant_id, phone e message são obrigatórios.' });
  }

  try {
    const tenant = db.prepare('SELECT name FROM tenants WHERE id = ?').get(Number(tenant_id));
    const tenantName = tenant?.name || 'Nossa Farmácia';

    const testText = message
      .replace(/{nome}/gi, 'Cliente Teste')
      .replace(/{cliente}/gi, 'Cliente Teste')
      .replace(/{farmacia}/gi, tenantName)
      .replace(/{data}/gi, new Date().toLocaleDateString('pt-BR'));

    const success = await sessionManager.sendMessage(
      tenant_id,
      phone,
      testText,
      image_url || null
    );

    if (success) {
      res.json({ success: true, message: 'Disparo de teste enviado com sucesso!' });
    } else {
      res.status(500).json({
        error: 'WhatsApp desconectado ou falha no envio. Verifique o status da conexão.',
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns - Create and start campaign
router.post('/', async (req, res) => {
  const { tenant_id, title, message, image_url, target_audience = 'all', delay_seconds = 25 } = req.body;

  if (!tenant_id || !title || !message) {
    return res.status(400).json({ error: 'tenant_id, title e message são obrigatórios.' });
  }

  const tId = Number(tenant_id);

  // 1. Fetch available leads
  const optOutRows = db.prepare('SELECT phone FROM opt_out_leads WHERE tenant_id = ?').all(tId);
  const optOutSet = new Set(optOutRows.map((r) => r.phone.replace(/\D/g, '')));

  const conversations = db
    .prepare(
      `
    SELECT customer_phone as phone, customer_name as name, last_message_at
    FROM conversations
    WHERE tenant_id = ? AND customer_phone IS NOT NULL AND customer_phone != ''
  `
    )
    .all(tId);

  const orders = db
    .prepare(
      `
    SELECT customer_phone as phone, customer_name as name, created_at as last_message_at
    FROM orders
    WHERE tenant_id = ? AND customer_phone IS NOT NULL AND customer_phone != ''
  `
    )
    .all(tId);

  const leadMap = new Map();
  for (const item of [...conversations, ...orders]) {
    const raw = String(item.phone || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (!digits || digits.length < 8) continue;
    if (optOutSet.has(digits)) continue;

    if (!leadMap.has(digits)) {
      leadMap.set(digits, {
        phone: raw,
        name: item.name && item.name !== 'Cliente' ? item.name : 'Cliente',
      });
    } else if (item.name && item.name !== 'Cliente' && leadMap.get(digits).name === 'Cliente') {
      leadMap.get(digits).name = item.name;
    }
  }

  const qualifiedLeads = Array.from(leadMap.values());

  if (qualifiedLeads.length === 0) {
    return res.status(400).json({
      error: 'Nenhum lead qualificado encontrado para disparo nesta farmácia. É necessário ter clientes no chat ou pedidos.',
    });
  }

  // 2. Insert Campaign
  const result = db
    .prepare(
      `
    INSERT INTO marketing_campaigns (tenant_id, title, message, image_url, target_audience, delay_seconds, total_leads, sent_count, failed_count, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'running')
  `
    )
    .run(
      tId,
      title.trim(),
      message.trim(),
      image_url || null,
      target_audience,
      Number(delay_seconds) || 25,
      qualifiedLeads.length
    );

  const campaignId = result.lastInsertRowid;

  // 3. Insert Campaign logs in batch
  const insertLog = db.prepare(`
    INSERT INTO campaign_logs (campaign_id, tenant_id, phone, customer_name, status)
    VALUES (?, ?, ?, ?, 'pending')
  `);

  const insertMany = db.transaction((leads) => {
    for (const lead of leads) {
      insertLog.run(campaignId, tId, lead.phone, lead.name);
    }
  });

  insertMany(qualifiedLeads);

  // 4. Start background queue processor asynchronously
  processCampaignQueue(campaignId, tId);

  const newCampaign = db.prepare('SELECT * FROM marketing_campaigns WHERE id = ?').get(campaignId);
  res.status(201).json(newCampaign);
});

// GET /api/campaigns/:id - Get details and live logs
router.get('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM marketing_campaigns WHERE id = ?').get(Number(req.params.id));
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });

  const logs = db
    .prepare(
      `
    SELECT * FROM campaign_logs
    WHERE campaign_id = ?
    ORDER BY id ASC
    LIMIT 100
  `
    )
    .all(campaign.id);

  res.json({ campaign, logs });
});

// POST /api/campaigns/:id/pause - Pause campaign
router.post('/:id/pause', (req, res) => {
  const campaignId = Number(req.params.id);
  activeWorkers.set(campaignId, false);
  db.prepare('UPDATE marketing_campaigns SET status = ? WHERE id = ?').run('paused', campaignId);
  res.json({ success: true, status: 'paused' });
});

// POST /api/campaigns/:id/resume - Resume campaign
router.post('/:id/resume', (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = db.prepare('SELECT * FROM marketing_campaigns WHERE id = ?').get(campaignId);
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });

  db.prepare('UPDATE marketing_campaigns SET status = ? WHERE id = ?').run('running', campaignId);
  processCampaignQueue(campaignId, campaign.tenant_id);
  res.json({ success: true, status: 'running' });
});

// POST /api/campaigns/:id/cancel - Cancel campaign
router.post('/:id/cancel', (req, res) => {
  const campaignId = Number(req.params.id);
  activeWorkers.set(campaignId, false);
  db.prepare('UPDATE marketing_campaigns SET status = ? WHERE id = ?').run('cancelled', campaignId);
  res.json({ success: true, status: 'cancelled' });
});

module.exports = router;
