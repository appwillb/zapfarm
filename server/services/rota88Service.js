const db = require('../db/database');

const ROTA88_API_URL = process.env.ROTA88_API_URL || 'http://api.rota88.org';
const ROTA88_API_KEY = process.env.ROTA88_API_KEY || 'flb_live_Vxpz6OmeJ70pzndEuPpMEFBpoTrC5j30';
const ROTA88_CONSOLE_URL = process.env.ROTA88_CONSOLE_URL || 'https://painel.rota88.org';

class Rota88Service {
  constructor() {
    this.apiUrl = ROTA88_API_URL.replace(/\/$/, '');
    this.apiKey = ROTA88_API_KEY;
    this.consoleUrl = ROTA88_CONSOLE_URL.replace(/\/$/, '');
  }

  /**
   * Executa requisição HTTP autenticada contra a API do Rota88
   */
  async request(endpoint, method = 'GET', body = null) {
    const url = `${this.apiUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const options = { method, headers };
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const text = await response.text();
      
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        data = text;
      }

      if (!response.ok) {
        console.error(`[Rota88Service] Erro ${response.status} em ${method} ${url}:`, data);
        throw new Error(data?.error || data?.errors?.[0] || `Falha na requisição Rota88: ${response.statusText}`);
      }

      return data;
    } catch (err) {
      console.error(`[Rota88Service] Erro de rede ou comunicação com Rota88:`, err.message);
      throw err;
    }
  }

  /**
   * Geocodifica um endereço em texto para coordenadas GPS via Nominatim/OSM
   */
  async geocodeAddress(addressText, fallbackCity = 'Trindade, Goiás') {
    if (!addressText || addressText.trim().length < 3) {
      return null;
    }
    try {
      const cleanAddress = addressText.replace(/[\n\r]/g, ' ').trim();
      const queries = [
        `${cleanAddress}, Brasil`,
        `${cleanAddress}, ${fallbackCity}, Brasil`,
        `${fallbackCity}, Brasil`
      ];

      for (const q of queries) {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Rota88-ZapFarm-App/1.0 (contato@rota88.org)' }
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0 && list[0].lat && list[0].lon) {
            return {
              lat: Number(list[0].lat),
              lng: Number(list[0].lon)
            };
          }
        }
      }
    } catch (err) {
      console.warn(`[Rota88Service] Falha na geocodificação de "${addressText}":`, err.message);
    }
    // Fallback padrão seguro (Região central de Trindade / GO)
    return { lat: -16.6545, lng: -49.4876 };
  }

  /**
   * Sincroniza e garante que a Farmácia existe como um ponto (Place) no Rota88
   */
  async syncTenantPlace(tenant) {
    if (!tenant) throw new Error('Tenant não informado');

    // Se já tiver o ID do ponto no Rota88, reutiliza
    if (tenant.rota88_place_id) {
      return tenant.rota88_place_id;
    }

    console.log(`[Rota88Service] Criando ponto da farmácia no Rota88: ${tenant.name}`);

    const placePayload = {
      name: tenant.name,
      street1: tenant.address || 'Endereço da Farmácia',
      phone: tenant.phone || '',
      country: 'BR'
    };

    // Geocodifica o endereço da farmácia para ter GPS
    const coords = await this.geocodeAddress(tenant.address || tenant.name);
    if (coords) {
      placePayload.location = {
        type: 'Point',
        coordinates: [coords.lng, coords.lat]
      };
    }

    const place = await this.request('/v1/places', 'POST', placePayload);
    const placeId = place.id;

    // Salva o place_id no banco da farmácia
    db.prepare('UPDATE tenants SET rota88_place_id = ? WHERE id = ?').run(placeId, tenant.id);
    console.log(`[Rota88Service] Farmácia ${tenant.name} sincronizada com sucesso no Rota88! ID: ${placeId}`);

    return placeId;
  }

  /**
   * Despacha um pedido para o Rota88 criando a ordem e traçando rota
   */
  async dispatchOrder(orderId) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new Error('Pedido não encontrado para despacho');

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(order.tenant_id);
    if (!tenant) throw new Error('Farmácia/Tenant não encontrada');

    // Se o pedido for retirada no balcão, não precisa de rota de motoboy
    if (order.delivery_type === 'pickup') {
      return null;
    }

    // 1. Garante que a farmácia é o ponto de coleta (Pickup) com coordenadas
    const pickupPlaceId = await this.syncTenantPlace(tenant);

    // 2. Prepara o ponto de entrega do cliente (Dropoff)
    const dropoffData = {
      name: order.customer_name || 'Cliente ZapFarm',
      phone: order.customer_phone || '',
      street1: order.delivery_address || 'Endereço de Entrega',
      country: 'BR'
    };

    // Se o cliente enviou localização GPS pelo WhatsApp, usa a exata
    if (order.delivery_lat && order.delivery_lng) {
      dropoffData.location = {
        type: 'Point',
        coordinates: [Number(order.delivery_lng), Number(order.delivery_lat)]
      };
    } else {
      // Se digitou texto, geocodifica automaticamente
      const dropoffCoords = await this.geocodeAddress(order.delivery_address);
      if (dropoffCoords) {
        dropoffData.location = {
          type: 'Point',
          coordinates: [dropoffCoords.lng, dropoffCoords.lat]
        };
      }
    }

    // 3. Monta os itens do pacote para rastreio
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    const entities = items.map(item => ({
      name: `${item.quantity}x ${item.product_name} (${item.dosage || ''})`,
      type: 'package'
    }));

    // 4. Cria a Ordem de Transporte e Roteamento no Rota88
    console.log(`[Rota88Service] Despachando Pedido #${order.id} para o Rota88...`);
    const orderPayload = {
      type: 'transport',
      status: 'created',
      notes: `ZapFarm Pedido #${order.id} - ${tenant.name}`,
      payload: {
        pickup: pickupPlaceId,
        dropoff: dropoffData,
        entities: entities.length > 0 ? entities : [{ name: 'Pacote de Medicamentos', type: 'package' }]
      }
    };

    const rota88Res = await this.request('/v1/orders', 'POST', orderPayload);

    const rota88OrderId = rota88Res.id;
    const trackingNumber = rota88Res.tracking_number?.tracking_number || '';
    
    // Formata o link oficial de rastreamento com o domínio do painel
    let trackingUrl = rota88Res.tracking_number?.url || '';
    if (trackingNumber) {
      trackingUrl = `${this.consoleUrl}/~/track-order?order=${trackingNumber}`;
    }

    // Atualiza os dados de rastreio no pedido do ZapFarm
    db.prepare(`
      UPDATE orders 
      SET rota88_order_id = ?,
          rota88_tracking_number = ?,
          rota88_tracking_url = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rota88OrderId, trackingNumber, trackingUrl, order.id);

    console.log(`[Rota88Service] ✅ Pedido #${order.id} integrado ao Rota88 com sucesso!`);
    console.log(`[Rota88Service] Ordem Rota88: ${rota88OrderId} | Rastreio: ${trackingNumber} | URL: ${trackingUrl}`);

    return {
      rota88OrderId,
      trackingNumber,
      trackingUrl
    };
  }
}

module.exports = new Rota88Service();
