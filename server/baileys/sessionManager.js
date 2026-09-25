const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const botEngine = require('../bot/botEngine');
const db = require('../db/database');

const sessionsDir = path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'sessions');
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

class SessionManager {
  constructor() {
    this.sessions = new Map(); // tenantId -> { socket, qrCodeDataUrl, qrCodeRaw, status, userPhone }
    this.wsBroadcaster = null;

    // Connect bot engine to outbound whatsapp sender and broadcaster
    botEngine.setSendFunction(this.sendMessage.bind(this));
    botEngine.setBroadcastFunction(this.broadcast.bind(this));
  }

  setWsBroadcaster(fn) {
    this.wsBroadcaster = fn;
  }

  broadcast(tenantId, type, payload) {
    if (this.wsBroadcaster) {
      this.wsBroadcaster(tenantId, { type, payload });
    }
  }

  getSessionState(tenantId) {
    const s = this.sessions.get(Number(tenantId));
    if (!s) {
      return {
        status: 'disconnected',
        qrCode: null,
        phone: null,
      };
    }
    return {
      status: s.status,
      qrCode: s.qrCodeDataUrl,
      phone: s.userPhone,
    };
  }

  async initSession(tenantId) {
    const tId = Number(tenantId);
    if (this.sessions.has(tId)) {
      const existing = this.sessions.get(tId);
      if (existing.status === 'connected' || existing.status === 'connecting') {
        return this.getSessionState(tId);
      }
    }

    const sessionPath = path.join(sessionsDir, `tenant_${tId}`);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sessionData = {
      socket: null,
      qrCodeDataUrl: null,
      qrCodeRaw: null,
      status: 'connecting',
      userPhone: null,
    };
    this.sessions.set(tId, sessionData);
    this.broadcast(tId, 'whatsapp_status', { status: 'connecting' });

    try {
      const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['ZapFarm SaaS', 'Chrome', '1.0.0'],
      });

      sessionData.socket = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          sessionData.qrCodeRaw = qr;
          try {
            sessionData.qrCodeDataUrl = await qrcode.toDataURL(qr, { width: 300, margin: 2 });
          } catch (e) {
            console.error('Error rendering QR code to data URL:', e);
          }
          sessionData.status = 'qrcode';
          this.broadcast(tId, 'whatsapp_status', {
            status: 'qrcode',
            qrCode: sessionData.qrCodeDataUrl,
          });
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          sessionData.status = 'disconnected';
          sessionData.qrCodeDataUrl = null;
          sessionData.qrCodeRaw = null;
          sessionData.socket = null;

          this.broadcast(tId, 'whatsapp_status', { status: 'disconnected', reason: statusCode });

          if (shouldReconnect) {
            console.log(`[Tenant ${tId}] Reconectando Baileys em 5 segundos...`);
            setTimeout(() => this.initSession(tId), 5000);
          } else {
            console.log(`[Tenant ${tId}] Sessão deslogada.`);
            // Clean credentials directory if logged out
            try {
              fs.rmSync(sessionPath, { recursive: true, force: true });
            } catch (err) {
              console.error('Error cleaning session dir:', err);
            }
          }
        } else if (connection === 'open') {
          const userPhone = sock.user?.id ? sock.user.id.split(':')[0] : 'Conectado';
          sessionData.status = 'connected';
          sessionData.qrCodeDataUrl = null;
          sessionData.userPhone = userPhone;

          console.log(`[Tenant ${tId}] Conectado ao WhatsApp! Telefone: ${userPhone}`);

          this.broadcast(tId, 'whatsapp_status', {
            status: 'connected',
            phone: userPhone,
          });

          // Log in database
          try {
            db.prepare(`
              INSERT INTO audit_logs (tenant_id, user_name, action, details)
              VALUES (?, 'Baileys', 'WHATSAPP_CONECTADO', ?)
            `).run(tId, `WhatsApp conectado com sucesso. Número: ${userPhone}`);
          } catch (e) {}
        }
      });

      // Handle incoming messages
      sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
          if (!msg.message || msg.key.fromMe) continue;

          // Only process private 1-on-1 customer chats (never groups, status, broadcasts, newsletters or bot)
          const remoteJid = msg.key.remoteJid;
          if (
            !remoteJid ||
            remoteJid.endsWith('@g.us') ||
            remoteJid.includes('broadcast') ||
            remoteJid.endsWith('@newsletter') ||
            remoteJid.endsWith('@bot')
          ) {
            continue;
          }

          // Preserve exact remoteJid to ensure replies are routed correctly (whether @lid or @s.whatsapp.net)
          const customerPhone = remoteJid;
          let pushName = msg.pushName || 'Cliente';

          // If pushName is missing or generic, check if we already have the customer's real name saved
          if (!pushName || pushName === 'Cliente') {
            try {
              const existingConv = db
                .prepare('SELECT customer_name FROM conversations WHERE tenant_id = ? AND customer_phone = ?')
                .get(tId, customerPhone);
              if (existingConv && existingConv.customer_name && existingConv.customer_name !== 'Cliente') {
                pushName = existingConv.customer_name;
              }
            } catch (e) {}
          }

          // Extract text (including support for images without caption, e.g. prescriptions)
          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            (msg.message.imageMessage ? 'Receita médica enviada em foto' : '') ||
            '';

          if (!text) continue;

          console.log(`[Tenant ${tId}] Mensagem recebida de ${customerPhone} (${pushName}): ${text}`);

          // Broadcast to connected web dashboard (chat tab)
          this.broadcast(tId, 'new_chat_message', {
            customerPhone,
            fromMe: false,
            text,
            pushName,
            timestamp: new Date().toISOString(),
          });

          // Pass to Bot State Machine
          try {
            await botEngine.handleIncomingMessage({
              tenantId: tId,
              customerPhone,
              text,
              pushName,
            });
          } catch (err) {
            console.error(`Error processing message in bot engine for tenant ${tId}:`, err);
          }
        }
      });

      return this.getSessionState(tId);
    } catch (err) {
      console.error(`Failed to initialize Baileys session for tenant ${tId}:`, err);
      sessionData.status = 'disconnected';
      return this.getSessionState(tId);
    }
  }

  async sendMessage(tenantId, phone, text) {
    const tId = Number(tenantId);
    const session = this.sessions.get(tId);

    // Broadcast to web dashboard live chat
    this.broadcast(tId, 'new_chat_message', {
      customerPhone: phone,
      fromMe: true,
      text,
      timestamp: new Date().toISOString(),
    });

    if (!session || session.status !== 'connected' || !session.socket) {
      console.log(`[Tenant ${tId}] WhatsApp não está conectado. Mensagem registrada localmente para ${phone}: ${text.substring(0, 50)}...`);
      return false;
    }

    try {
      let jid = String(phone || '').trim();

      // If already a WhatsApp JID (@lid, @s.whatsapp.net, etc.)
      if (jid.includes('@')) {
        // Strip any device index e.g. ":0@lid" or ":1@s.whatsapp.net"
        const [userPart, serverPart] = jid.split('@');
        const userClean = userPart.split(':')[0];
        jid = `${userClean}@${serverPart}`;
      } else {
        // Plain phone digits (e.g. motoboy or manual phone numbers)
        let clean = jid.replace(/[^\d]/g, '');
        // If Brazilian number without country code (10 or 11 digits: DDD + Phone)
        if (clean.length === 10 || clean.length === 11) {
          clean = '55' + clean;
        }
        jid = `${clean}@s.whatsapp.net`;
      }

      console.log(`[Tenant ${tId}] 📤 Enviando WhatsApp via Baileys para JID: ${jid}`);
      const sendResult = await session.socket.sendMessage(jid, { text });
      console.log(`[Tenant ${tId}] ✅ Mensagem enviada com sucesso para ${jid}! (ID: ${sendResult?.key?.id})`);
      return true;
    } catch (err) {
      console.error(`[Tenant ${tId}] ❌ Erro ao enviar mensagem WhatsApp para ${phone}:`, err);
      return false;
    }
  }

  async disconnect(tenantId) {
    const tId = Number(tenantId);
    const session = this.sessions.get(tId);
    if (session && session.socket) {
      try {
        await session.socket.logout();
      } catch (e) {
        try {
          session.socket.end();
        } catch (e2) {}
      }
    }
    this.sessions.delete(tId);

    const sessionPath = path.join(sessionsDir, `tenant_${tId}`);
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    } catch (e) {}

    this.broadcast(tId, 'whatsapp_status', { status: 'disconnected' });
    return { success: true };
  }
}

module.exports = new SessionManager();
