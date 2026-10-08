require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { WebSocketServer, WebSocket } = require('ws');

// Initialize Database
const db = require('./db/database');

// Ensure uploads directory exists
const uploadsDir = process.env.UPLOADS_DIR || path.join(process.env.DATA_DIR || path.join(__dirname, '../data'), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const sessionManager = require('./baileys/sessionManager');
const authRoutes = require('./routes/auth');
const tenantsRoutes = require('./routes/tenants');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const driversRoutes = require('./routes/drivers');
const whatsappRoutes = require('./routes/whatsapp');
const chatRoutes = require('./routes/chat');
const dashboardRoutes = require('./routes/dashboard');
const simulationRoutes = require('./routes/simulation');
const campaignsRoutes = require('./routes/campaigns');
const suppliersRoutes = require('./routes/suppliers');

const app = express();
const server = http.createServer(app);

// ============================================================================
// PRODUCAO: seguranca obrigatoria
// ============================================================================
// JWT_SECRET forte e OBRIGATORIO em producao. Sem ele, qualquer pessoa pode
// forjar tokens de acesso a todas as farmacias.
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error('=========================================================================');
  console.error('ERRO FATAL: JWT_SECRET nao configurado ou muito curto (minimo 32 chars).');
  console.error('Configure no painel do Coolify em Environment Variables e reinicie o app.');
  console.error('=========================================================================');
  process.exit(1);
}

// CORS restrito: em producao, apenas o dominio do proprio app (mesma origem
// serve o frontend estatico, entao CORS nem seria necessario; se um dominio
// externo for preciso, configurar CORS_ORIGIN no ambiente).
const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : true);
app.use(cors(corsOrigin === false ? undefined : { origin: corsOrigin }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup WebSocket Server for Live updates (com autenticacao JWT por conexao)
const { JWT_SECRET } = require('./middleware/auth');
const jwt = require('jsonwebtoken');
const wss = new WebSocketServer({
  server,
  path: '/ws',
  // Rejeita o handshake ANTES de abrir a conexao: sem token valido, o cliente
  // nem chega a completar o upgrade HTTP para WebSocket.
  verifyClient: (info, cb) => {
    const url = new URL(info.req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) {
      return cb(false, 4401, 'Token ausente');
    }
    try {
      const user = jwt.verify(token, JWT_SECRET);
      const tenantId = Number(url.searchParams.get('tenant_id') || 1);
      // Escopo: superadmin pode ouvir qualquer tenant; funcionario so o proprio
      if (user.role !== 'superadmin' && Number(user.tenant_id) !== tenantId) {
        return cb(false, 4403, 'Sem permissao para este tenant');
      }
      info.req.user = user;
      cb(true);
    } catch (err) {
      cb(false, 4403, 'Token invalido ou expirado');
    }
  },
});
const wsClients = new Map(); // ws -> tenantId

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const tenantId = Number(url.searchParams.get('tenant_id') || 1);
  wsClients.set(ws, tenantId);

  ws.on('close', () => {
    wsClients.delete(ws);
  });
});

// Configure sessionManager to broadcast live events to connected frontend clients
sessionManager.setWsBroadcaster((tenantId, data) => {
  const payload = JSON.stringify(data);
  for (const [ws, clientTenantId] of wsClients.entries()) {
    if (ws.readyState === WebSocket.OPEN && clientTenantId === Number(tenantId)) {
      ws.send(payload);
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'ZapFarm SaaS',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/suppliers', suppliersRoutes);

// Serve uploaded media (receipts, prescriptions) statically
app.use('/uploads', express.static(uploadsDir));

// Serve static frontend in production (Coolify / Docker / Built assets)
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// Fallback for SPA routing in production
app.use((req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return res.status(404).json({ error: 'Endpoint não encontrado.' });
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>ZapFarm API Running</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>ZapFarm Backend está rodando com sucesso! 🚀</h1>
            <p>Acesse o frontend em desenvolvimento na porta 5173 ou execute <code>npm run build</code> para gerar os arquivos de produção.</p>
          </body>
        </html>
      `);
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 ZapFarm SaaS Server rodando na porta ${PORT}`);
  console.log(`🌐 API Health Check: http://localhost:${PORT}/health`);
  console.log(`📡 WebSocket Path: ws://localhost:${PORT}/ws`);
  console.log(`=======================================================`);

  // Auto-restore any saved WhatsApp Baileys sessions for tenants
  sessionManager.initAllSavedSessions();
});

// ============================================================================
// JOB: Expiracao automatica de pedidos Pix nao pagos (libera estoque reservado)
// Roda a cada 5 minutos. Pedidos pending_payment com mais de 1 hora sem
// comprovante enviados sao cancelados e o estoque reservado e devolvido.
// ============================================================================
const botEngine = require('./bot/botEngine');

const PIX_EXPIRATION_MINUTES = Number(process.env.PIX_EXPIRATION_MINUTES) || 60;

function expireStalePixOrders() {
  try {
    const staleOrders = db.prepare(`
      SELECT id, tenant_id, customer_phone, customer_name
      FROM orders
      WHERE status = 'pending_payment'
        AND receipt_status = 'none'
        AND datetime(created_at) <= datetime('now', '-' || ? || ' minutes')
    `).all(PIX_EXPIRATION_MINUTES);

    if (staleOrders.length === 0) return;

    const restoreStock = db.prepare('UPDATE products SET reserved_quantity = MAX(0, reserved_quantity - ?) WHERE id = ?');
    const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');

    for (const order of staleOrders) {
      const items = getItems.all(order.id);
      for (const item of items) {
        restoreStock.run(item.quantity, item.product_id);
      }
      db.prepare("UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);

      try {
        db.prepare(`
          INSERT INTO audit_logs (tenant_id, user_name, action, details)
          VALUES (?, 'Sistema (Expiracao Pix)', 'PEDIDO_EXPIRADO', ?)
        `).run(order.tenant_id, `Pedido #${order.id} cancelado automaticamente: Pix nao pago em ${PIX_EXPIRATION_MINUTES} minutos. Estoque reservado devolvido.`);
      } catch (e) {}

      // Avisa o cliente que o pedido expirou e o carrinho foi liberado
      botEngine.sendReply(
        order.tenant_id,
        order.customer_phone,
        `⏰ *Pedido #${order.id} expirado*\n\n` +
        `Identificamos que o pagamento via Pix nao foi concluido no prazo de ${PIX_EXPIRATION_MINUTES} minutos, entao o pedido foi cancelado e o estoque foi liberado.\n\n` +
        `Se quiser concluir a compra, e so me chamar aqui que a gente refaz o pedido na hora! 💊`
      ).catch((e) => console.error('Erro ao notificar cliente de expiracao:', e.message));
    }

    if (staleOrders.length > 0) {
      console.log(`[ExpiracaoPix] ${staleOrders.length} pedido(s) expirado(s) por Pix nao pago. Estoque devolvido.`);
    }
  } catch (err) {
    console.error('[ExpiracaoPix] Erro no job de expiracao de pedidos:', err.message);
  }
}

setInterval(expireStalePixOrders, 5 * 60 * 1000);
setTimeout(expireStalePixOrders, 60 * 1000); // primeira checagem 1 min apos o boot

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Encerrando servidor com segurança...');
  server.close(() => process.exit(0));
});
