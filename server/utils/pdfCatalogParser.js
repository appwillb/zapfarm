/**
 * pdfCatalogParser.js
 * Extrator e normalizador inteligente de catálogos e listas de preços de farmácias / distribuidoras em formato PDF
 */

const { PDFParse } = require('pdf-parse');

/**
 * Limpa e converte strings monetárias brasileiras (ex: "1.234,50" ou "23,90") para Number float
 */
function parsePrice(str) {
  if (!str) return 0;
  const clean = String(str).replace(/[R$\s]/g, '').trim();
  if (clean.includes(',') && clean.includes('.')) {
    // Ex: 1.250,90
    return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.')) || 0;
  }
  return parseFloat(clean) || 0;
}

/**
 * Extrai texto completo de um Buffer de PDF
 */
async function extractTextFromPdf(pdfBuffer) {
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const result = await parser.getText();
    return result && result.text ? result.text : '';
  } finally {
    try {
      await parser.destroy();
    } catch (e) {}
  }
}

/**
 * Analisa as linhas do PDF e extrai os itens (nome, ean, fabricante, preco, estoque)
 */
function parseCatalogLines(text) {
  if (!text || typeof text !== 'string') return [];

  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];

  // Padrões de cabeçalho comuns para ignorar
  const headerRegex = /^(página|pagina|page|relatório|relatorio|tabela|emissão|emissao|data|hora|descrição|descricao|produto|medicamento|código|codigo|ean|laboratório|laboratorio|fabr|preco|preço|estoque|qtde|qtd|valor|total|subtotal|filtro)/i;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (headerRegex.test(line) && line.length < 50) continue;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) continue; // Separadores do PDF

    // 1. Procurar código de barras ou código interno (sequência de 7 a 14 dígitos)
    const barcodeMatch = line.match(/\b(\d{7,14})\b/);

    // 2. Procurar por valores em R$ ou padrão monetário com vírgula ou ponto (ex: 25,90 ou 9.90 ou R$ 12,50)
    // Usamos regex mais específica para não confundir com números inteiros
    const priceMatches = [...line.matchAll(/(?:R\$\s*)?(\d{1,5}[,\.]\d{2})\b/g)];

    if (priceMatches.length > 0) {
      // Pelo menos um preço foi identificado nesta linha
      const lastPriceMatch = priceMatches[priceMatches.length - 1];
      const priceVal = parsePrice(lastPriceMatch[1]);

      let costPriceVal = 0;
      if (priceMatches.length >= 2) {
        costPriceVal = parsePrice(priceMatches[0][1]);
      }

      // 3. Procurar estoque explícito (ex: "30un", "15 cx", "qtd: 50" ou número isolado após o preço)
      let stockVal = 10;
      const stockExplicit = line.match(/(?:qtd|qtde|estoque|quant)?\s*[:=]?\s*(\d{1,4})\s*(?:un|cx|fr|unidades?|cxs?|latas?|potes?)\b/i);
      if (stockExplicit && (!barcodeMatch || stockExplicit[1] !== barcodeMatch[1])) {
        const parsed = parseInt(stockExplicit[1], 10);
        if (parsed > 0) stockVal = parsed;
      }

      // Limpar a linha para extrair o Nome do Produto
      let namePart = line;

      // Remover o código de barras
      if (barcodeMatch) {
        namePart = namePart.replace(barcodeMatch[0], ' ');
      }

      // Remover todos os preços identificados
      priceMatches.forEach(pm => {
        namePart = namePart.replace(pm[0], ' ');
      });

      // Remover a menção de estoque explícita se houver
      if (stockExplicit) {
        namePart = namePart.replace(stockExplicit[0], ' ');
      }

      // Limpar termos residuais e pontuações no início/fim
      namePart = namePart
        .replace(/R\$/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[\s\-–;:\.,|]+|[\s\-–;:\.,|]+$/g, '')
        .trim();

      // Se o nome tiver mais de 3 caracteres, temos um item válido
      if (namePart.length >= 3 && priceVal > 0) {
        // Tentar identificar dosagem e apresentação
        const dosageMatch = namePart.match(/(\d+(?:[,\.]\d+)?\s*(?:mg|g|mcg|ml|ui|%))/i);
        const dosage = dosageMatch ? dosageMatch[0] : '';

        // Tentar identificar laboratório famoso se presente no texto
        let manufacturer = '';
        const labs = ['EMS', 'NEO QUIMICA', 'MEDLEY', 'ACHE', 'EUROFARMA', 'SANDOZ', 'TEVA', 'GERMED', 'LEGRAND', 'CIMED', 'PRATI', 'HIPOLABOR', 'GLAXO', 'PFIZER', 'BAYER', 'NOVARTIS', 'TAKEDA', 'BIOLAB', 'MANTECORP', 'MOMENTA', 'KLEY HERTZ', 'PROBIOTICA', 'MAX TITANIUM'];
        for (const lab of labs) {
          const labRegex = new RegExp(`\\b${lab}\\b`, 'i');
          if (labRegex.test(namePart)) {
            manufacturer = lab;
            namePart = namePart.replace(labRegex, ' ').replace(/\s+/g, ' ').trim();
            break;
          }
        }

        items.push({
          name: namePart.toUpperCase(),
          barcode: barcodeMatch ? barcodeMatch[1] : '',
          dosage: dosage,
          manufacturer: manufacturer,
          cost_price: costPriceVal > 0 ? Number(costPriceVal.toFixed(2)) : Number((priceVal * 0.7).toFixed(2)),
          sale_price: Number(priceVal.toFixed(2)),
          stock_quantity: stockVal,
          min_stock: 5,
          category: 'Medicamentos'
        });
      }
    }
  }

  return items;
}

/**
 * Função principal para analisar um arquivo PDF
 */
async function parsePdfCatalog(pdfBuffer) {
  const fullText = await extractTextFromPdf(pdfBuffer);
  const items = parseCatalogLines(fullText);
  return {
    totalExtracted: items.length,
    items,
    rawTextPreview: fullText.slice(0, 1000)
  };
}

module.exports = {
  extractTextFromPdf,
  parseCatalogLines,
  parsePdfCatalog,
  parsePrice
};
