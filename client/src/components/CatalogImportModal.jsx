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

  // PDF File Upload Handler
  const handlePdfFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Por favor, selecione um arquivo no formato PDF.');
      return;
    }

    setPdfFile(file);
    setPdfParsing(true);
    setParsedPdfResult(null);

    const formData = new FormData();
    formData.append('file', file);

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
      const res = await api.importProducts(tenantId, itemsToImport, supplierIdToSend, updateExisting);
      
      const supplierName = suppliers.find(s => s.id === Number(selectedSupplierId))?.name;
      alert(`✅ Processamento Concluído com Sucesso!\n\n• Novos Medicamentos Inseridos: ${res.created || 0}\n• Medicamentos Atualizados (Preço/Estoque): ${res.updated || 0}\n• Total Processado: ${res.total || res.imported || 0}${supplierName ? `\n• Vendedor Vinculado: ${supplierName}` : ''}`);
      
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
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/80 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfFileSelect}
                className="hidden"
              />
              <div className="w-12 h-12 bg-white rounded-2xl text-emerald-600 shadow-xs flex items-center justify-center mx-auto border border-emerald-100">
                <FileUp size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {pdfFile ? pdfFile.name : 'Clique para selecionar o PDF do Catálogo / Tabela de Preços'}
                </p>
                <p className="text-[11px] text-slate-500">
                  O sistema reconhece automaticamente nomes, dosagens, códigos de barras e preços!
                </p>
              </div>
              {pdfParsing && (
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 pt-2">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Analisando páginas do PDF e extraindo produtos...</span>
                </div>
              )}
            </div>
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
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-2">Nome</th>
                    <th className="p-2">EAN</th>
                    <th className="p-2">Preço</th>
                    <th className="p-2">Estoque</th>
                    <th className="p-2">Fabricante</th>
                    <th className="p-2">Vendedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentItems.slice(0, 100).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2 font-medium text-slate-800">{r.name}</td>
                      <td className="p-2 text-slate-500 font-mono text-[10px]">{r.barcode || '—'}</td>
                      <td className="p-2 font-bold text-slate-800">R$ {Number(r.sale_price).toFixed(2)}</td>
                      <td className="p-2 text-slate-600">{r.stock_quantity} un.</td>
                      <td className="p-2 text-slate-500">{r.manufacturer || '—'}</td>
                      <td className="p-2 text-blue-700 font-semibold">{currentSupplier ? currentSupplier.name : '—'}</td>
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
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              `Processar ${currentItems.length} Medicamento(s)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
