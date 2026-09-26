require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

// Initialize Database
require('./db/database');

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

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup WebSocket Server for Live updates
const wss = new WebSocketServer({ server, path: '/ws' });
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Encerrando servidor com segurança...');
  server.close(() => process.exit(0));
});
