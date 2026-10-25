import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, FileText, Check, AlertCircle, UserCheck, Plus, RefreshCw, FileUp } from 'lucide-react';
import { api } from '../api';

export default function CatalogImportModal({ isOpen, onClose, tenantId, onImported }) {
  const [activeTab, setActiveTab] = useState('pdf'); // 'pdf' | 'csv'
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [updateExisting, setUpdateExisting] = useState(true);

  // PDF Import states
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [parsedPdfResult, setParsedPdfResult] = useState(null);
  const [pdfMode, setPdfMode] = useState('auto'); // 'auto' | 'stock' | 'promo'
  const fileInputRef = useRef(null);

  // CSV Import states
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);

  // Quick supplier modal/inline state
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);
  const [newSuppName, setNewSuppName] = useState('');
  const [newSuppPhone, setNewSuppPhone] = useState('');
  const [newSuppCompany, setNewSuppCompany] = useState('');
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  useEffect(() => {
    if (isOpen && tenantId) {
      loadSuppliers();
    }
  }, [isOpen, tenantId]);

  const loadSuppliers = async () => {
    try {
      const list = await api.getSuppliers(tenantId);
      setSuppliers(list || []);
    } catch (err) {
      console.error('Erro ao carregar vendedores:', err);
    }
  };

  const sampleCsv = `nome,principio_ativo,dosagem,apresentacao,preco_venda,estoque,estoque_minimo,fabricante,requer_receita,ean
Dipirona Gotas,Dipirona Sódica,500mg/ml,Frasco 20ml,9.90,30,5,Neo Química,0,7891234567890
Amoxicilina 500mg,Amoxicilina,500mg,Caixa 21 cápsulas,42.50,15,5,EMS,1,7899876543210
Vitamina C 1g,Ácido Ascórbico,1000mg,Tubo 10 comprimidos,18.00,50,10,Cimed,0,7895554443332`;

  const parseCsv = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const items = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(',').map((v) => v.trim());

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });

      if (obj.nome && obj.preco_venda) {
        items.push({
          name: obj.nome,
          active_ingredient: obj.principio_ativo || '',
          dosage: obj.dosagem || '',
          presentation: obj.apresentacao || '',
          manufacturer: obj.fabricante || obj.laboratorio || '',
          sale_price: parseFloat(obj.preco_venda.replace(',', '.')) || 0,
          stock_quantity: parseInt(obj.estoque, 10) || 10,
          min_stock: parseInt(obj.estoque_minimo || obj.min_estoque, 10) || 5,
          requires_prescription: obj.requer_receita === '1' || obj.requer_receita === 'true',
          barcode: obj.ean || '',
          category: 'Medicamentos',
        });
      }
    }
    return items;
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setCsvText(val);
    setParsedRows(parseCsv(val));
  };

  const loadSample = () => {
    setCsvText(sampleCsv);
    setParsedRows(parseCsv(sampleCsv));
  };

  // PDF File Upload Handler com Suporte a Forçar Tipo (Promoções vs Balanço de Estoque)
  const parseFileWithMode = async (file, mode) => {
    if (!file) return;
    setPdfParsing(true);
    setParsedPdfResult(null);

    const formData = new FormData();
    formData.append('file', file);
    if (mode === 'promo') {
      formData.append('force_type', 'promotions');
    } else if (mode === 'stock') {
      formData.append('force_type', 'stock_balance');
    }

    try {
      const res = await api.parsePdfCatalog(formData);
      if (res.success) {
        setParsedPdfResult(res);
        if (res.totalExtracted === 0) {
          alert('O arquivo PDF foi lido, mas nenhum produto com preço reconhecido foi encontrado. Verifique se o PDF contém texto selecionável.');
        }
      } else {
        alert(res.error || 'Erro ao processar PDF');
      }
    } catch (err) {
      alert('Erro na leitura do PDF: ' + err.message);
    } finally {
      setPdfParsing(false);
    }
  };

  const handlePdfFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Por favor, selecione um arquivo no formato PDF.');
      return;
    }

    setPdfFile(file);
    await parseFileWithMode(file, pdfMode);
  };

  const handleModeChange = async (newMode) => {
    setPdfMode(newMode);
    if (pdfFile) {
      await parseFileWithMode(pdfFile, newMode);
    }
  };

  const handleQuickCreateSupplier = async (e) => {
    e.preventDefault();
    if (!newSuppName.trim() || !newSuppPhone.trim()) {
      alert('Preencha pelo menos o nome e WhatsApp do vendedor.');
      return;
    }

    setCreatingSupplier(true);
    try {
      const created = await api.createSupplier({
        tenant_id: tenantId,
        name: newSuppName.trim(),
        phone: newSuppPhone.trim(),
        company: newSuppCompany.trim(),
      });

      await loadSuppliers();
      setSelectedSupplierId(String(created.id));
      setShowQuickAddSupplier(false);
      setNewSuppName('');
      setNewSuppPhone('');
      setNewSuppCompany('');
      alert(`Vendedor ${created.name} cadastrado e selecionado com sucesso!`);
    } catch (err) {
      alert('Erro ao cadastrar vendedor: ' + err.message);
    } finally {
      setCreatingSupplier(false);
    }
  };

  const handleImport = async () => {
    const itemsToImport = activeTab === 'pdf' ? (parsedPdfResult?.items || []) : parsedRows;
    if (itemsToImport.length === 0) return;

    setLoading(true);
    try {
      const supplierIdToSend = selectedSupplierId ? Number(selectedSupplierId) : null;
      let fileType = activeTab === 'pdf' ? (parsedPdfResult?.fileType || 'generic') : 'generic';
      if (pdfMode === 'promo') fileType = 'promotions';
      if (pdfMode === 'stock') fileType = 'stock_balance';
      const res = await api.importProducts(tenantId, itemsToImport, supplierIdToSend, updateExisting, fileType);
      
      const supplierName = suppliers.find(s => s.id === Number(selectedSupplierId))?.name;
      const promoMsg = res.promos_updated > 0 ? `\n• Ofertas Promocionais Ativadas (WhatsApp): ${res.promos_updated}` : '';
      alert(`✅ Processamento Concluído com Sucesso!\n\n• Novos Medicamentos Inseridos: ${res.created || 0}\n• Medicamentos Atualizados: ${res.updated || 0}${promoMsg}\n• Total Processado: ${res.total || res.imported || 0}${supplierName ? `\n• Vendedor Vinculado: ${supplierName}` : ''}`);
      
      onImported();
      onClose();
    } catch (err) {
      alert('Erro na importação: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentSupplier = suppliers.find(s => s.id === Number(selectedSupplierId));
  const currentItems = activeTab === 'pdf' ? (parsedPdfResult?.items || []) : parsedRows;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Upload size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Importação & Atualização de Catálogo</h3>
              <p className="text-xs text-slate-500">Cadastre ou atualize preços e estoque via PDF ou Planilha</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher: PDF vs CSV */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'pdf'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileUp size={15} />
            📄 Subir Catálogo em PDF (Recomendado)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'csv'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={15} />
            📊 Planilha / Texto CSV
          </button>
        </div>

        {/* Supplier / Representative Selector Card */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <UserCheck size={15} className="text-blue-600" />
              <span>Vendedor / Representante Comercial deste Lote:</span>
            </label>
            <button
              type="button"
              onClick={() => setShowQuickAddSupplier(!showQuickAddSupplier)}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs transition-colors"
            >
              <Plus size={12} />
              <span>{showQuickAddSupplier ? 'Fechar' : '+ Novo Vendedor'}</span>
            </button>
          </div>

          {!showQuickAddSupplier ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
              >
                <option value="">Nenhum (importar sem vincular a vendedor específico)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    👤 {s.name} {s.company ? `(${s.company})` : ''} - 📱 {s.phone}
                  </option>
                ))}
              </select>
              {currentSupplier && (
                <span className="text-[11px] font-semibold text-blue-800 bg-blue-100/80 px-3 py-1.5 rounded-xl border border-blue-200 shrink-0">
                  🔔 Alertas em: {currentSupplier.phone}
                </span>
              )}
            </div>
          ) : (
            /* Quick Supplier Register Form */
            <form onSubmit={handleQuickCreateSupplier} className="p-3 bg-white rounded-xl border border-blue-200 space-y-2">
              <p className="text-[11px] font-bold text-blue-900">Novo Vendedor / Representante:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Nome (ex: Carlos Santos)"
                  value={newSuppName}
                  onChange={(e) => setNewSuppName(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
                <input
                  type="text"
                  placeholder="WhatsApp (ex: 62999998888)"
                  value={newSuppPhone}
                  onChange={(e) => setNewSuppPhone(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Distribuidora / Laboratório"
                  value={newSuppCompany}
                  onChange={(e) => setNewSuppCompany(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowQuickAddSupplier(false)}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingSupplier}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  {creatingSupplier ? 'Salvando...' : 'Salvar e Vincular'}
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="updateExistingCheckbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
            />
            <label htmlFor="updateExistingCheckbox" className="text-[11px] font-semibold text-slate-700 cursor-pointer">
              🔄 <b>Modo Atualização:</b> Se o produto já existir no estoque (mesmo código EAN ou nome), atualizar o preço e a quantidade em vez de duplicar.
            </label>
          </div>
        </div>

        {/* Tab 1: PDF Upload Content */}
        {activeTab === 'pdf' && (
          <div className="space-y-3">
            {/* Seletor explícito de tipo de arquivo / promoção */}
            <div className="bg-slate-50 border border-slate-200/90 p-3 rounded-2xl space-y-2">
              <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>🎯 O que você deseja importar neste arquivo?</span>
                <span className="text-[10px] text-slate-400 font-normal">Escolha o tipo ou deixe no Automático</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('auto')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    pdfMode === 'auto'
                      ? 'bg-white border-indigo-400 text-indigo-900 shadow-xs ring-1 ring-indigo-200'
                      : 'bg-white/70 hover:bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <span>🤖</span>
                    <span>Auto-detectar</span>
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    O sistema lê o cabeçalho e identifica sozinho
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('stock')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    pdfMode === 'stock'
                      ? 'bg-white border-emerald-500 text-emerald-900 shadow-xs ring-1 ring-emerald-200'
                      : 'bg-white/70 hover:bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <span>📦</span>
                    <span>Balanço de Estoque</span>
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    Atualiza Estoque Físico e Preço de Venda
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('promo')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    pdfMode === 'promo'
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-1 ring-amber-400'
                      : 'bg-amber-50 hover:bg-amber-100/70 text-amber-900 border-amber-200'
                  }`}
                >
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <span>🔥</span>
                    <span>Subir Promoções</span>
                  </p>
                  <p className={`text-[10px] leading-tight mt-0.5 ${pdfMode === 'promo' ? 'text-amber-100' : 'text-amber-700'}`}>
                    Ativa Preço "De" / "Por" para WhatsApp
                  </p>
                </button>
              </div>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 ${
                pdfMode === 'promo' || parsedPdfResult?.fileType === 'promotions'
                  ? 'border-amber-400 bg-amber-50/40 hover:bg-amber-50/80'
                  : 'border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfFileSelect}
                className="hidden"
              />
              <div className={`w-12 h-12 bg-white rounded-2xl shadow-xs flex items-center justify-center mx-auto border ${
                pdfMode === 'promo' || parsedPdfResult?.fileType === 'promotions'
                  ? 'text-amber-600 border-amber-200'
                  : 'text-emerald-600 border-emerald-100'
              }`}>
                {pdfMode === 'promo' || parsedPdfResult?.fileType === 'promotions' ? (
                  <span className="text-2xl">🔥</span>
                ) : (
                  <FileUp size={24} />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {pdfFile 
                    ? pdfFile.name 
                    : pdfMode === 'promo' 
                    ? 'Clique para selecionar o PDF da Lista de Promoções'
                    : pdfMode === 'stock'
                    ? 'Clique para selecionar o PDF do Balanço de Estoque'
                    : 'Clique para selecionar o PDF (Balanço de Estoque ou Lista de Promoções)'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {pdfMode === 'promo'
                    ? 'Os remédios serão ativados em promoção com desconto no WhatsApp sem alterar a quantidade de estoque.'
                    : pdfMode === 'stock'
                    ? 'O sistema atualizará as quantidades exatas de estoque físico e preços de venda normais.'
                    : 'O sistema reconhece automaticamente se é o Balanço Geral de Estoque ou a Lista de Promoções!'}
                </p>
              </div>
              {pdfParsing && (
                <div className={`flex items-center justify-center gap-2 text-xs font-semibold pt-2 ${
                  pdfMode === 'promo' ? 'text-amber-700' : 'text-emerald-700'
                }`}>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Analisando páginas do PDF e extraindo dados com precisão...</span>
                </div>
              )}
            </div>

            {/* Banner Informativo do Tipo de Arquivo Reconhecido */}
            {parsedPdfResult && (
              <div className={`p-3 rounded-2xl flex items-center gap-3 border transition-all ${
                parsedPdfResult.fileType === 'promotions' || pdfMode === 'promo'
                  ? 'bg-amber-50 border-amber-200 text-amber-900' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-xs ${
                  parsedPdfResult.fileType === 'promotions' || pdfMode === 'promo' ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'
                }`}>
                  {parsedPdfResult.fileType === 'promotions' || pdfMode === 'promo' ? '🔥' : '📦'}
                </div>
                <div className="text-xs flex-1">
                  <p className="font-bold">
                    {parsedPdfResult.fileType === 'promotions' || pdfMode === 'promo'
                      ? 'Lista de Promoções da Semana Identificada!' 
                      : 'Balanço de Estoque Geral Identificado!'}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {parsedPdfResult.fileType === 'promotions' || pdfMode === 'promo'
                      ? `Detectamos ${parsedPdfResult.totalExtracted} produtos em oferta com Preço De / Preço Por. Eles serão ativados nas Ofertas do WhatsApp sem alterar seu estoque físico!` 
                      : `Detectamos ${parsedPdfResult.totalExtracted} medicamentos com as quantidades exatas em estoque e preços de venda.`}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: CSV Textarea Content */}
        {activeTab === 'csv' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Formato: nome,principio_ativo,dosagem,apresentacao,preco_venda,estoque,estoque_minimo,fabricante,requer_receita,ean</span>
              <button
                type="button"
                onClick={loadSample}
                className="text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                Carregar Exemplo
              </button>
            </div>

            <textarea
              rows={4}
              value={csvText}
              onChange={handleTextChange}
              placeholder="Cole aqui os dados separados por vírgula..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-[11px] focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {/* Preview Table */}
        {currentItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Pré-visualização: {currentItems.length} item(ns) identificado(s) no arquivo
              </span>
              {currentSupplier && (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Vendedor atribuído: {currentSupplier.name}
                </span>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                  {parsedPdfResult?.fileType === 'promotions' || pdfMode === 'promo' ? (
                    <tr>
                      <th className="p-2">Nome</th>
                      <th className="p-2">Código</th>
                      <th className="p-2">Preço Tabela (De)</th>
                      <th className="p-2">Preço Promoção (Por)</th>
                      <th className="p-2">Desconto</th>
                      <th className="p-2">Fabricante</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="p-2">Nome</th>
                      <th className="p-2">Código/EAN</th>
                      <th className="p-2">Preço Venda</th>
                      <th className="p-2">Estoque Físico</th>
                      <th className="p-2">Fabricante</th>
                      <th className="p-2">Vendedor</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentItems.slice(0, 100).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2 font-medium text-slate-800">{r.name}</td>
                      <td className="p-2 text-slate-500 font-mono text-[10px]">{r.barcode || r.code || '—'}</td>
                      
                      {parsedPdfResult?.fileType === 'promotions' || pdfMode === 'promo' ? (
                        <>
                          <td className="p-2 text-slate-400 line-through">
                            R$ {Number(r.original_price).toFixed(2)}
                          </td>
                          <td className="p-2 font-bold text-emerald-700">
                            R$ {Number(r.sale_price).toFixed(2)}
                          </td>
                          <td className="p-2">
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              -{r.discount_percent || Math.round(((r.original_price - r.sale_price)/r.original_price)*100)}%
                            </span>
                          </td>
                          <td className="p-2 text-slate-500">{r.manufacturer || '—'}</td>
                        </>
                      ) : (
                        <>
                          <td className="p-2 font-bold text-slate-800">R$ {Number(r.sale_price).toFixed(2)}</td>
                          <td className="p-2 font-semibold text-emerald-700">{r.stock_quantity} un.</td>
                          <td className="p-2 text-slate-500">{r.manufacturer || '—'}</td>
                          <td className="p-2 text-blue-700 font-semibold">{currentSupplier ? currentSupplier.name : '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {currentItems.length > 100 && (
              <p className="text-[10px] text-slate-500 text-right">
                Exibindo primeiros 100 itens de {currentItems.length} detectados.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={currentItems.length === 0 || loading || pdfParsing}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-50 transition-all flex items-center gap-1.5 ${
              parsedPdfResult?.fileType === 'promotions' || pdfMode === 'promo'
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Processando...</span>
              </>
            ) : parsedPdfResult?.fileType === 'promotions' || pdfMode === 'promo' ? (
              `🔥 Ativar ${currentItems.length} Promoções no Bot`
            ) : (
              `📦 Atualizar Estoque de ${currentItems.length} Medicamento(s)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
