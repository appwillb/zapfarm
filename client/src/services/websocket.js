// WebSocket Real-Time Client for ZapFarm SaaS
// Connects to /ws?tenant_id={tenantId} with automatic reconnection and event dispatching.

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.tenantId = null;
    this.subscribers = new Map(); // eventType -> Set of callback functions
    this.reconnectTimeout = null;
    this.reconnectDelay = 2000;
    this.isExplicitlyClosed = false;
    this.pingInterval = null;
  }

  getWebSocketUrl(tenantId) {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // Vite dev server fallback to port 3001
    const host = loc.port === '5173' ? `${loc.hostname}:3001` : loc.host;
    return `${protocol}//${host}/ws?tenant_id=${tenantId || 1}`;
  }

  connect(tenantId) {
    if (this.ws && this.tenantId === tenantId && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.disconnect();
    this.tenantId = tenantId;
    this.isExplicitlyClosed = false;

    const url = this.getWebSocketUrl(tenantId);
    console.log(`[WebSocket] Conectando ao ZapFarm Live Events: ${url}`);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log(`[WebSocket] Conexão ativa com sucesso para a Farmácia (Tenant #${tenantId})`);
        this.reconnectDelay = 2000;
        this.emit('_connection_change', { status: 'connected' });

        // Keep-alive heartbeat ping every 30s
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(JSON.stringify({ type: 'ping' }));
            } catch (e) {}
          }
        }, 30000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type) {
            this.emit(data.type, data.payload || data);
          }
        } catch (e) {
          console.warn('[WebSocket] Mensagem recebida não-JSON:', event.data);
        }
      };

      this.ws.onclose = (event) => {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.emit('_connection_change', { status: 'disconnected', code: event.code });

        if (!this.isExplicitlyClosed) {
          console.log(`[WebSocket] Conexão fechada. Reconectando em ${this.reconnectDelay / 1000}s...`);
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 15000);
            this.connect(this.tenantId);
          }, this.reconnectDelay);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket] Erro na conexão:', err);
      };
    } catch (err) {
      console.error('[WebSocket] Falha ao iniciar WebSocket:', err);
    }
  }

  disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  }

  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType).add(callback);

    // Return unbind function for useEffect cleanup
    return () => {
      const set = this.subscribers.get(eventType);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }

  emit(eventType, data) {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(data);
        } catch (e) {
          console.error(`[WebSocket] Erro no subscriber de ${eventType}:`, e);
        }
      }
    }
  }
}

export const wsClient = new WebSocketClient();
