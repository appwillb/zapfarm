const db = require('../db/database');

/**
 * Normaliza e limpa o texto do cliente, removendo pontuações e palavras vazias (stop-words)
 * comuns em perguntas de balcão de farmácia (ex: "qual o valor do", "quanto custa", "tem").
 */
function parseProductQueries(text) {
  if (!text || typeof text !== 'string') return [];

  // Remove URLs ou marcações
  let cleaned = text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[?!.,;:\\/()"'`~_—*#]/g, ' ')
    .toLowerCase();

  // Stopwords e expressões comuns de perguntas em farmácia
  const stopwords = [
    'qual', 'quais', 'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das',
    'um', 'uma', 'uns', 'umas', 'no', 'na', 'nos', 'nas', 'em', 'pra', 'para',
    'valor', 'valores', 'preco', 'preço', 'precos', 'preços', 'quanto', 'quantos',
    'custa', 'custam', 'sai', 'saem', 'ta', 'tá', 'fica', 'ficam',
    'tem', 'têm', 'temos', 'voces', 'vocês', 'vcs', 'vc', 'voce', 'você',
    'vende', 'vendem', 'gostaria', 'queria', 'saber', 'favor', 'por', 'sobre',
    'olá', 'ola', 'bom', 'dia', 'boa', 'tarde', 'noite', 'oi', 'opa', 'alo', 'alô',
    'porfavor', 'pfv', 'pf', 'preciso', 'procura', 'procuro', 'teria', 'teriam',
    'se', 'possivel', 'possível', 'tem aí', 'tem ai', 'aí', 'ai', 'aqui'
  ];

  const stopRegex = new RegExp(`\\b(${stopwords.join('|')})\\b`, 'gi');
  cleaned = cleaned.replace(stopRegex, ' ').replace(/\s+/g, ' ').trim();

  if (!cleaned) return [];

  // Divide múltiplos produtos por conjunções ("e", "mais", ",", "/")
  const terms = cleaned
    .split(/\s+e\s+|\s*,\s*|\s+mais\s+|\s*\/\s*|\s+com\s+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  // Se a divisão não gerou nada ou se era um produto composto longo (ex: "fralda pampers m"), mantém o termo original limpo
  if (terms.length === 0 && cleaned.length >= 2) {
    return [cleaned];
  }

  return terms;
}

/**
 * Busca produtos no banco de dados SQLite para os termos informados
 */
function searchProductsInDb(tenantId, query) {
  if (!query || query.length < 2) return [];
  const cleanQ = query.trim();

  const sql = `
    SELECT id, tenant_id, name, active_ingredient, dosage, form, presentation, barcode,
           sale_price, original_price, is_promotion, stock_quantity, reserved_quantity,
           requires_prescription
    FROM products
    WHERE tenant_id = ? AND active = 1 AND (
      name LIKE ? OR active_ingredient LIKE ? OR barcode = ?
    )
    ORDER BY 
      CASE 
        WHEN name LIKE ? THEN 1
        WHEN name LIKE ? THEN 2
        WHEN active_ingredient LIKE ? THEN 3
        ELSE 4
      END,
      stock_quantity DESC
    LIMIT 4
  `;

  try {
    return db.prepare(sql).all(
      tenantId,
      `%${cleanQ}%`,
      `%${cleanQ}%`,
      cleanQ,
      `${cleanQ}%`,
      `% ${cleanQ}%`,
      `${cleanQ}%`
    );
  } catch (err) {
    console.error('[aiEngine] Erro ao buscar produtos:', err.message);
    return [];
  }
}

function formatMoney(val) {
  return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Chamada à API oficial do Google Gemini (REST)
 */
async function callGeminiApi({ apiKey, systemInstruction, userPrompt, model = 'gemini-2.5-flash' }) {
  const modelsToTry = [model, 'gemini-2.0-flash', 'gemini-1.5-flash'];

  for (const currentModel of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

    const body = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 800,
      },
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500); // 7.5s max timeout

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[aiEngine] Gemini (${currentModel}) retornou status ${res.status}: ${errText.substring(0, 120)}`);
        continue; // Tenta o próximo modelo
      }

      const data = await res.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer && answer.trim()) {
        return answer.trim();
      }
    } catch (err) {
      console.warn(`[aiEngine] Falha ao chamar Gemini modelo ${currentModel}:`, err.message);
    }
  }

  return null;
}

/**
 * Gerador local inteligente de resposta para quando a chave da IA não estiver configurada
 * ou a internet/Google falhar. NUNCA responde erro robótico!
 */
function buildLocalNlpResponse({ tenant, customerName, searchResults, rawText, cart = [] }) {
  const lower = rawText.toLowerCase();

  // 1. Perguntas sobre Entrega / Frete
  if (lower.includes('entrega') || lower.includes('frete') || lower.includes('entregam') || lower.includes('taxa')) {
    const feeText = Number(tenant.delivery_fee_default) > 0
      ? `R$ ${formatMoney(tenant.delivery_fee_default)}`
      : 'GRÁTIS';
    const freeThreshold = Number(tenant.free_shipping_threshold) > 0
      ? `\n🎉 Compras a partir de *R$ ${formatMoney(tenant.free_shipping_threshold)}* têm *FRETE GRÁTIS!*`
      : '';

    return (
      `🛵 *ENTREGA RÁPIDA - ${tenant.name.toUpperCase()}* 📦\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Olá, *${customerName}*! Sim, fazemos entrega direta na sua casa!\n\n` +
      `📍 *Taxa padrão:* ${feeText}${freeThreshold}\n` +
      `⏰ *Horário:* ${tenant.business_hours || 'Durante nosso horário comercial'}\n\n` +
      `Qual medicamento ou produto você gostaria de pedir hoje? Basta me mandar o nome! 💚`
    );
  }

  // 2. Perguntas sobre Endereço / Onde fica
  if (lower.includes('onde fica') || lower.includes('endereco') || lower.includes('endereço') || lower.includes('localizacao') || lower.includes('localização') || lower.includes('bairro')) {
    return (
      `📍 *NOSSA LOCALIZAÇÃO - ${tenant.name.toUpperCase()}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Olá, *${customerName}*! Estamos te esperando no balcão da nossa loja:\n\n` +
      `🏠 *Endereço:* ${tenant.address || 'Venha nos visitar no balcão!'}\n` +
      `⏰ *Horário de Funcionamento:* ${tenant.business_hours || '08:00 às 22:00'}\n\n` +
      `🛵 *Prefere receber em casa?* Fazemos entrega rápida também! Basta mandar os medicamentos que procura.`
    );
  }

  // 3. Perguntas sobre Pagamento
  if (lower.includes('pagamento') || lower.includes('cartao') || lower.includes('cartão') || lower.includes('pix') || lower.includes('dinheiro') || lower.includes('pagar')) {
    return (
      `💳 *FORMAS DE PAGAMENTO ACEITAS*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Olá, *${customerName}*! Facilitamos o pagamento para você:\n\n` +
      `💠 *Pix Instantâneo* (Copia e Cola gerado aqui mesmo no WhatsApp)\n` +
      `💳 *Cartão de Crédito e Débito* (o motoboy leva a maquininha até você)\n` +
      `💵 *Dinheiro* (com troco se precisar)\n\n` +
      `Qual remédio você gostaria de pedir agora? 💊`
    );
  }

  // 4. Produtos Encontrados
  if (searchResults && searchResults.length > 0) {
    let msg = `👋 Olá, *${customerName}*! Tudo bem? 💚\n\n` +
      `Consultei nosso estoque aqui na *${tenant.name}*:\n\n`;

    let totalShown = 0;
    const candidates = [];

    searchResults.forEach((group) => {
      group.products.forEach((p) => {
        totalShown++;
        candidates.push(p);
        const available = p.stock_quantity - p.reserved_quantity;
        const inStock = available > 0;
        const isPromo = p.is_promotion && p.original_price && Number(p.original_price) > Number(p.sale_price);

        msg += `💊 *${p.name}*\n`;
        if (p.active_ingredient && p.active_ingredient.toLowerCase() !== p.name.toLowerCase()) {
          msg += `   ▫️ Princípio: _${p.active_ingredient}_\n`;
        }
        if (p.presentation) {
          msg += `   ▫️ Apresentação: ${p.presentation}\n`;
        }
        if (isPromo) {
          msg += `   ▫️ Preço: *De ~R$ ${formatMoney(p.original_price)}~ por R$ ${formatMoney(p.sale_price)}* 🔥\n`;
        } else {
          msg += `   ▫️ Preço: *R$ ${formatMoney(p.sale_price)}*\n`;
        }
        msg += `   ▫️ Estoque: ${inStock ? `Disponível (${available} un.) ✅` : 'Temporariamente esgotado ⚠️'}\n`;
        if (p.requires_prescription) {
          msg += `   ▫️ ⚠️ _Necessita de receita médica médica retida_\n`;
        }
        msg += `\n`;
      });
    });

    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🛵 *Fazemos entrega rápida!* (Taxa: R$ ${formatMoney(tenant.delivery_fee_default)})\n`;
    msg += `Gostaria que eu separe algum deles para você retirar ou prefere receber na sua casa?\n\n`;
    msg += `💬 *Deseja falar com atendente?* Digite *0*`;

    return { text: msg, candidates };
  }

  // 5. Nenhum produto localizado com os termos informados
  return {
    text:
      `👋 Olá, *${customerName}*! Tudo bem? 💚\n\n` +
      `Não encontrei nenhum produto exatamente com esse nome no nosso catálogo digital no momento.\n\n` +
      `👨‍⚕️ *Nosso farmacêutico de plantão está no balcão da ${tenant.name}* e pode conferir se temos marcas similares, genéricos ou encomendar para você na distribuidora!\n\n` +
      `👉 *Digite 0* para falar com o farmacêutico agora mesmo no balcão.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📸 _Se você tiver a foto da receita médica ou da embalagem, pode enviar aqui pelo WhatsApp que analisamos na hora!_`,
    candidates: []
  };
}

/**
 * Função principal do Atendente Virtual de Inteligência Artificial
 */
async function processAiMessage({ tenantId, customerPhone, customerName, rawText, context = {} }) {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
  if (!tenant) return null;

  // 1. Extração de termos de busca
  const queries = parseProductQueries(rawText);
  const searchResults = [];

  for (const q of queries) {
    const prods = searchProductsInDb(tenantId, q);
    if (prods.length > 0) {
      searchResults.push({ query: q, products: prods });
    }
  }

  // Flat list de produtos encontrados para candidatos de escolha
  const allCandidates = [];
  searchResults.forEach((group) => {
    group.products.forEach((p) => {
      if (!allCandidates.some((c) => c.id === p.id)) {
        allCandidates.push(p);
      }
    });
  });

  const apiKey = tenant.gemini_api_key || process.env.GEMINI_API_KEY;
  const isAiActive = tenant.ai_enabled !== 0;

  // Se houver chave Gemini e IA ativada, chama a IA generativa
  if (apiKey && isAiActive) {
    let productsContextStr = 'Nenhum medicamento específico encontrado diretamente pelo termo.';
    if (allCandidates.length > 0) {
      productsContextStr = allCandidates
        .map(
          (p) =>
            `- [ID ${p.id}] ${p.name} | Princípio: ${p.active_ingredient || 'N/A'} | Apresentação: ${p.presentation || 'N/A'} | Preço: R$ ${formatMoney(p.sale_price)}${p.is_promotion ? ` (Promoção de R$ ${formatMoney(p.original_price)})` : ''} | Estoque disponível: ${p.stock_quantity - p.reserved_quantity} un. | Exige receita: ${p.requires_prescription ? 'SIM' : 'NÃO'}`
        )
        .join('\n');
    }

    const systemInstruction = `
Você é o atendente virtual e assistente farmacêutico oficial da farmácia "${tenant.name}".
Seu objetivo é atender os clientes no WhatsApp com simpatia, calor humano, clareza profissional e agilidade.

DADOS DA FARMÁCIA:
- Nome: ${tenant.name}
- Endereço: ${tenant.address || 'Nossa loja no centro da cidade'}
- Horário de atendimento: ${tenant.business_hours || '08:00 às 22:00'}
- Taxa de entrega: R$ ${formatMoney(tenant.delivery_fee_default)} ${Number(tenant.free_shipping_threshold) > 0 ? `(Frete GRÁTIS em compras acima de R$ ${formatMoney(tenant.free_shipping_threshold)})` : ''}
- Formas de pagamento: Pix Copia e Cola instantâneo, Cartão de crédito/débito na maquininha na entrega, e Dinheiro.

PRODUTOS ENCONTRADOS NO ESTOQUE DA FARMÁCIA PARA A PERGUNTA:
${productsContextStr}

REGRAS OBRIGATÓRIAS DE ATENDIMENTO:
1. Responda em Português do Brasil com tom humano, acolhedor, empático e educado (use emojis moderados: 💊, 😊, 💚, 🛵, 📦).
2. Se o cliente perguntar o valor de um ou mais remédios (ex: "Qual o valor do loratadina e Suprema?"), cite os nomes e os valores exatos de TODOS os remédios encontrados no estoque acima.
3. Se algum produto procurado não foi encontrado, explique com delicadeza e diga que o farmacêutico no balcão pode verificar opções similares ou encomendar.
4. NUNCA invente medicamentos ou preços que não estejam nos produtos acima.
5. Se o produto exigir receita médica retida (antibióticos, controlados), avise com cuidado que precisa da receita médica.
6. Sempre convide o cliente a concluir: pergunte se ele quer que separe para entrega rápida na casa dele ou para retirar no balcão.
7. Se o cliente quiser falar com uma pessoa, atendente humano ou farmacêutico, seja cortês e adicione no fim da mensagem a tag [TRANSF_HUMANO].
8. Mantenha as mensagens bem formatadas para WhatsApp (use *negrito* nos nomes dos remédios e nos preços). Não escreva textos gigantescos, seja direto e prestativo.
`.trim();

    const userPrompt = `Mensagem do cliente (${customerName || 'Cliente'}): "${rawText}"`;

    try {
      const aiReply = await callGeminiApi({
        apiKey,
        systemInstruction,
        userPrompt,
      });

      if (aiReply) {
        const wantsHuman = aiReply.includes('[TRANSF_HUMANO]');
        const cleanReply = aiReply.replace('[TRANSF_HUMANO]', '').trim();

        return {
          text: cleanReply,
          candidates: allCandidates,
          wantsHuman,
          source: 'gemini',
        };
      }
    } catch (e) {
      console.warn('[aiEngine] Erro na execução da IA, caindo para NLP local:', e.message);
    }
  }

  // Fallback para o NLP Local Inteligente (sempre disponível, 100% humanizado e sem erros)
  const localResult = buildLocalNlpResponse({
    tenant,
    customerName: customerName || 'Cliente',
    searchResults,
    rawText,
    cart: context.cart || [],
  });

  if (typeof localResult === 'string') {
    return {
      text: localResult,
      candidates: allCandidates,
      wantsHuman: false,
      source: 'local_nlp',
    };
  }

  return {
    text: localResult.text,
    candidates: localResult.candidates || allCandidates,
    wantsHuman: false,
    source: 'local_nlp',
  };
}

module.exports = {
  processAiMessage,
  parseProductQueries,
  searchProductsInDb,
};
