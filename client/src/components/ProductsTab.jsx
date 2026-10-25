import React, { useState, useEffect } from 'react';
import { Plus, Upload, Search, Pill, ShieldAlert, Edit, Trash2, CheckCircle2, RefreshCw, Bell, User, Phone, Download, Factory } from 'lucide-react';
import { api } from '../api';
import BulkManufacturerModal from './BulkManufacturerModal';

export default function ProductsTab({
  products,
  tenantId,
  currentUser,
  onOpenAddProduct,
  onOpenEditProduct,
  onOpenImportCsv,
  onDeleteProduct,
  onRefresh,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedSupplier, setSelectedSupplier] = useState('Todos');
  const [onlyPromotions, setOnlyPromotions] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifyingId, setNotifyingId] = useState(null);
  const [isBulkMfrOpen, setIsBulkMfrOpen] = useState(false);
  const [bulkMfrTarget, setBulkMfrTarget] = useState(null);

  const handleOpenBulkMfr = (mfrName = null) => {
    setBulkMfrTarget(mfrName);
    setIsBulkMfrOpen(true);
  };

  useEffect(() => {
    if (!tenantId) return;
    api.getSuppliers(tenantId)
      .then((data) => {
        if (Array.isArray(data)) setSuppliers(data);
      })
      .catch((err) => console.error('Erro ao carregar vendedores em ProductsTab:', err));
  }, [tenantId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (tenantId) {
        api.getSuppliers(tenantId).then((data) => {
          if (Array.isArray(data)) setSuppliers(data);
        }).catch(console.error);
      }
      if (onRefresh) await onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleExportCsv = () => {
    if (!products || products.length === 0) {
      alert('Nenhum produto cadastrado para exportar.');
      return;
    }

    const headers = [
      'Código/EAN',
      'Nome do Medicamento',
      'Laboratório/Fabricante',
      'Estoque Físico',
      'Preço Venda (R$)',
      'Preço Original (R$)',
      'Em Promoção',
      'Vendedor Atribuído',
      'Categoria'
    ];

    const rows = products.map((p) => [
      `"${p.barcode || ''}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.manufacturer || '').replace(/"/g, '""')}"`,
      p.stock_quantity ?? 0,
      (Number(p.sale_price) || 0).toFixed(2).replace('.', ','),
      (Number(p.original_price) || Number(p.sale_price) || 0).toFixed(2).replace('.', ','),
      p.is_promotion ? 'SIM' : 'NÃO',
      `"${(p.supplier_name || 'Sem Vendedor').replace(/"/g, '""')}"`,
      `"${(p.category || 'Medicamentos').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `conferencia_estoque_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNotifySupplier = async (product, forceMulti = false) => {
    try {
      setNotifyingId(product.id);

      // If multi-vendor was requested or product has multiple suppliers
      if (forceMulti || (product.suppliers_count && product.suppliers_count > 1)) {
        const res = await api.quoteMultivendor(product.id, currentUser?.name || 'Farmacêutico');
        if (res.success) {
          alert(`✅ Cotação multivendedor enviada com sucesso para ${res.sentCount} vendedor(es) via WhatsApp!`);
          if (onRefresh) onRefresh();
          return;
        } else if (res.error && res.whatsappConnected === false) {
          alert(res.error);
          return;
        }
      }

      if (!product.supplier_id) {
        // Try checking if manufacturer has assigned suppliers
        const multiRes = await api.quoteMultivendor(product.id, currentUser?.name || 'Farmacêutico');
        if (multiRes.success && multiRes.sentCount > 0) {
          alert(`✅ Cotação disparada para os representantes do fabricante (${multiRes.sentCount} contatados) via WhatsApp!`);
          if (onRefresh) onRefresh();
          return;
        }

        if (window.confirm(`O produto "${product.name}" ainda não possui um vendedor vinculado.\n\nDeseja abrir a edição para vincular um vendedor agora?`)) {
          onOpenEditProduct(product);
        }
        return;
      }

      const res = await api.notifySupplierLowStock(product.id, currentUser?.name || 'Farmacêutico');
      if (res.success) {
        alert(`✅ Notificação de reposição enviada com sucesso via WhatsApp!`);
        if (onRefresh) onRefresh();
      } else {
        alert(res.error || 'Erro ao avisar vendedor');
      }
    } catch (err) {
      alert('Erro ao enviar alerta ao vendedor: ' + err.message);
    } finally {
      setNotifyingId(null);
    }
  };

  const categories = [
    'Todos',
    'Medicamentos',
    'Antibióticos',
    'Anti-inflamatórios',
    'Analgésicos e Antitérmicos',
    'Cardiovascular',
    'Gastroenterologia',
    'Perfumaria e Cosméticos',
    'Higiene Pessoal',
    'Bebê e Infantil',
    'Suplementos e Vitaminas',
    'Primeiros Socorros',
    'Conveniência',
  ];

  const promoCount = products.filter(
    (p) => p.is_promotion && p.original_price && Number(p.original_price) > Number(p.sale_price)
  ).length;

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.active_ingredient && p.active_ingredient.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.barcode && p.barcode.includes(searchTerm)) ||
      (p.supplier_name && p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.supplier_company && p.supplier_company.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;

    const matchesSupplier =
      selectedSupplier === 'Todos' ||
      (selectedSupplier === 'sem_vendedor' && !p.supplier_id) ||
      (selectedSupplier === 'com_vendedor' && p.supplier_id) ||
      p.supplier_id === Number(selectedSupplier) ||
      String(p.supplier_id) === String(selectedSupplier);

    const matchesPromo = !onlyPromotions || (p.is_promotion && p.original_price && Number(p.original_price) > Number(p.sale_price));

    return matchesSearch && matchesCategory && matchesSupplier && matchesPromo;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Resetar para página 1 se mudar filtros de busca
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedSupplier, onlyPromotions]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedProducts = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5">
      {/* Top Header Controls */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Left Side: Search & Filter Chips */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative w-full sm:w-64 lg:w-72 shrink-0">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, princípio, EAN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none shrink-0"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none font-medium max-w-[180px] truncate shrink-0"
          >
            <option value="Todos">👤 Vendedores</option>
            <option value="com_vendedor">✅ Com Vendedor</option>
            <option value="sem_vendedor">⚠️ Sem Vendedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                👤 {s.name} {s.company ? `(${s.company})` : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyPromotions(!onlyPromotions)}
            className={`p-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border shrink-0 whitespace-nowrap ${
              onlyPromotions
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-1 ring-amber-300'
                : 'bg-amber-50/80 text-amber-800 hover:bg-amber-100 border-amber-200'
            }`}
            title="Filtrar apenas produtos com preço promocional ativo"
          >
            <span>🔥</span>
            <span>Promoções {promoCount > 0 ? `(${promoCount})` : ''}</span>
          </button>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 justify-end shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100">
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-xs shrink-0 flex items-center gap-1.5 whitespace-nowrap"
              title="Atualizar catálogo de medicamentos"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-emerald-600' : 'text-slate-500'} />
              <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenBulkMfr(null)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs shrink-0 whitespace-nowrap"
            title="Vincular múltiplos fabricantes/laboratórios de uma vez aos vendedores ou distribuidoras"
          >
            <Factory size={14} className="text-indigo-600" />
            <span>🏭 Vincular Fabricantes em Massa</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-2xs shrink-0 whitespace-nowrap"
            title="Baixar planilha completa em Excel/CSV com todos os medicamentos, estoques e preços para conferência"
          >
            <Download size={14} className="text-slate-500" />
            <span>Baixar Planilha (Excel)</span>
          </button>

          <button
            onClick={onOpenImportCsv}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs shrink-0 whitespace-nowrap"
            title="Importar catálogo em lote via PDF ou CSV"
          >
            <Upload size={14} className="text-emerald-600" />
            <span>Importar PDF / Planilha</span>
          </button>

          <button
            onClick={onOpenAddProduct}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs shrink-0 whitespace-nowrap"
          >
            <Plus size={14} />
            <span>Novo Remédio</span>
          </button>
        </div>
      </div>

      {/* Products Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Mobile Product Cards View (sm:hidden) */}
        <div className="sm:hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Nenhum medicamento encontrado para essa busca.
            </div>
          ) : (
            paginatedProducts.map((prod) => {
              const available = prod.stock_quantity - (prod.reserved_quantity || 0);
              const isLow = prod.stock_quantity <= prod.min_stock;

              return (
                <div key={prod.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Pill size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-xs leading-tight">{prod.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {prod.dosage} &bull; {prod.presentation || prod.form}
                        </p>
                        {prod.active_ingredient && (
                          <p className="text-[10px] text-slate-600 mt-0.5">
                            🔬 {prod.active_ingredient} {prod.manufacturer ? `(${prod.manufacturer})` : ''}
                          </p>
                        )}
                        {prod.barcode && (
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5">EAN: {prod.barcode}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {prod.is_promotion && prod.original_price && Number(prod.original_price) > Number(prod.sale_price) ? (
                        <div>
                          <span className="text-[10px] text-slate-400 line-through block">
                            R$ {Number(prod.original_price).toFixed(2)}
                          </span>
                          <p className="font-bold text-sm text-emerald-700 flex items-center justify-end gap-1">
                            R$ {Number(prod.sale_price).toFixed(2)}
                            <span className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                              PROMO
                            </span>
                          </p>
                        </div>
                      ) : (
                        <p className="font-bold text-sm text-emerald-700">
                          R$ {Number(prod.sale_price).toFixed(2)}
                        </p>
                      )}
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-bold text-[9px] mt-1 ${
                          available > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {available > 0 ? `${available} disponíveis` : 'Esgotado'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">
                        Estoque: <strong className={isLow ? 'text-rose-600' : 'text-slate-700'}>{prod.stock_quantity} un.</strong>
                      </span>
                      {prod.reserved_quantity > 0 && (
                        <span className="text-amber-600 font-medium">({prod.reserved_quantity} reserv.)</span>
                      )}
                    </div>

                    {prod.requires_prescription ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <ShieldAlert size={10} />
                        Exige Receita
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                        <CheckCircle2 size={11} className="text-emerald-500" />
                        Venda Livre
                      </span>
                    )}
                  </div>

                  {/* Supplier info row in mobile */}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                    {prod.supplier_name ? (
                      <div className="flex items-center gap-1 text-slate-700 min-w-0">
                        <span className="font-semibold truncate">👤 {prod.supplier_name}</span>
                        {prod.supplier_company && (
                          <span className="text-[10px] text-slate-400 truncate">({prod.supplier_company})</span>
                        )}
                        {prod.suppliers_count > 1 && (
                          <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-bold shrink-0">
                            +{prod.suppliers_count - 1} rep(s)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Sem vendedor vinculado</span>
                    )}

                    {prod.supplier_phone ? (
                      <span className="text-[10px] text-emerald-600 font-mono shrink-0">
                        📱 {prod.supplier_phone}
                      </span>
                    ) : (
                      !prod.supplier_id && (
                        <button
                          type="button"
                          onClick={() => {
                            if (prod.manufacturer) {
                              handleOpenBulkMfr(prod.manufacturer);
                            } else {
                              onOpenEditProduct(prod);
                            }
                          }}
                          className="text-[10px] text-indigo-600 font-semibold hover:underline"
                        >
                          + Vincular {prod.manufacturer ? `(${prod.manufacturer})` : ''}
                        </button>
                      )
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    {isLow && (
                      <button
                        type="button"
                        onClick={() => handleNotifySupplier(prod, prod.suppliers_count > 1)}
                        disabled={notifyingId === prod.id}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          prod.suppliers_count > 1
                            ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-300'
                            : prod.supplier_id
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                        title={
                          prod.suppliers_count > 1
                            ? `Disparar cotação para ${prod.suppliers_count} vendedores via WhatsApp`
                            : prod.supplier_id
                            ? `Avisar representante ${prod.supplier_name} via WhatsApp`
                            : 'Vincular e avisar vendedor'
                        }
                      >
                        <Bell size={13} className={notifyingId === prod.id ? 'animate-bounce text-amber-700' : 'text-amber-600'} />
                        {notifyingId === prod.id
                          ? 'Cotando...'
                          : prod.suppliers_count > 1
                          ? `Cotar (${prod.suppliers_count})`
                          : 'Avisar Rep.'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenEditProduct(prod)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Edit size={13} />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProduct(prod.id)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 size={13} />
                      Desativar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (hidden sm:block) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Medicamento / Apresentação</th>
                <th className="py-3 px-4">Princípio Ativo & Lab</th>
                <th className="py-3 px-4">Vendedor / Rep.</th>
                <th className="py-3 px-4">Preço Venda</th>
                <th className="py-3 px-4">Estoque Físico</th>
                <th className="py-3 px-4">Reservado</th>
                <th className="py-3 px-4">Disponível Bot</th>
                <th className="py-3 px-4">Receita Médica</th>
                <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 shadow-[-5px_0_10px_rgba(0,0,0,0.03)] z-10">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Nenhum medicamento encontrado para essa busca.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((prod) => {
                  const available = prod.stock_quantity - (prod.reserved_quantity || 0);
                  const isLow = prod.stock_quantity <= prod.min_stock;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <Pill size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{prod.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {prod.dosage} &bull; {prod.presentation || prod.form}
                            </p>
                            {prod.barcode && (
                              <p className="text-[9px] text-slate-400 font-mono">EAN: {prod.barcode}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-700">{prod.active_ingredient || '—'}</p>
                        {prod.manufacturer ? (
                          <button
                            type="button"
                            onClick={() => handleOpenBulkMfr(prod.manufacturer)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 transition-colors mt-0.5 group/mfr text-left"
                            title={`Vincular todos os produtos da ${prod.manufacturer} a um vendedor em 1 clique`}
                          >
                            <span>🏭 {prod.manufacturer}</span>
                            <span className="text-[9px] text-indigo-400 group-hover/mfr:text-indigo-600 underline">em massa</span>
                          </button>
                        ) : (
                          <p className="text-[10px] text-slate-400">—</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {prod.supplier_name ? (
                          <div>
                            <p className="font-semibold text-slate-800 flex items-center gap-1">
                              👤 {prod.supplier_name}
                            </p>
                            {prod.supplier_company && (
                              <p className="text-[10px] text-slate-500">{prod.supplier_company}</p>
                            )}
                            {prod.suppliers_count > 1 && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-bold">
                                +{prod.suppliers_count - 1} outro(s) rep(s)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (prod.manufacturer) {
                                  handleOpenBulkMfr(prod.manufacturer);
                                } else {
                                  onOpenEditProduct(prod);
                                }
                              }}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-semibold"
                              title={
                                prod.manufacturer
                                  ? `Clique para vincular todos os produtos do laboratório ${prod.manufacturer} a um vendedor`
                                  : 'Clique para vincular um vendedor'
                              }
                            >
                              + Vincular vendedor
                            </button>
                            {prod.manufacturer && (
                              <span className="text-[9px] text-slate-400">
                                Lab: {prod.manufacturer}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 text-sm">
                        {prod.is_promotion && prod.original_price && Number(prod.original_price) > Number(prod.sale_price) ? (
                          <div>
                            <span className="text-[10px] text-slate-400 line-through block font-normal">
                              R$ {Number(prod.original_price).toFixed(2)}
                            </span>
                            <span className="text-emerald-700 flex items-center gap-1.5">
                              R$ {Number(prod.sale_price).toFixed(2)}
                              <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                Promo
                              </span>
                            </span>
                          </div>
                        ) : (
                          <span>R$ {Number(prod.sale_price).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-semibold ${
                            isLow ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full' : 'text-slate-700'
                          }`}
                        >
                          {prod.stock_quantity} un.
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {prod.reserved_quantity > 0 ? (
                          <span className="text-amber-600 font-semibold">{prod.reserved_quantity} un.</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            available > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {available > 0 ? `${available} disponíveis` : 'Esgotado'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {prod.requires_prescription ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <ShieldAlert size={11} />
                            Exige Receita
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                            <CheckCircle2 size={11} className="text-emerald-500" />
                            Venda Livre
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right sticky right-0 bg-white group-hover:bg-slate-50 shadow-[-5px_0_10px_rgba(0,0,0,0.03)] z-10">
                        <div className="flex items-center justify-end gap-1.5">
                          {isLow && (
                            <button
                              type="button"
                              onClick={() => handleNotifySupplier(prod, prod.suppliers_count > 1)}
                              disabled={notifyingId === prod.id}
                              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold ${
                                prod.suppliers_count > 1
                                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : prod.supplier_id
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                              }`}
                              title={
                                prod.suppliers_count > 1
                                  ? `Disparar cotação para ${prod.suppliers_count} vendedores via WhatsApp`
                                  : prod.supplier_name
                                  ? `Disparar pedido de reposição via WhatsApp para ${prod.supplier_name} (${prod.supplier_phone})`
                                  : 'Vincular e avisar vendedor'
                              }
                            >
                              <Bell size={14} className={notifyingId === prod.id ? 'animate-bounce text-indigo-600' : prod.suppliers_count > 1 ? 'text-indigo-600' : 'text-amber-600'} />
                              <span className="hidden xl:inline">
                                {notifyingId === prod.id
                                  ? 'Enviando...'
                                  : prod.suppliers_count > 1
                                  ? `Cotar (${prod.suppliers_count})`
                                  : 'Avisar Rep.'}
                              </span>
                            </button>
                          )}
                          <button
                            onClick={() => onOpenEditProduct(prod)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => onDeleteProduct(prod.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Desativar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Barra de Paginação e Totalizador Inteligente */}
        {filtered.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>
                Mostrando <b>{(currentPage - 1) * pageSize + 1}</b> a <b>{Math.min(currentPage * pageSize, filtered.length)}</b> de <b>{filtered.length}</b> medicamentos
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-medium ml-2"
              >
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-colors"
              >
                Anterior
              </button>

              <span className="px-3 py-1 font-bold text-slate-800">
                Página {currentPage} de {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      <BulkManufacturerModal
        isOpen={isBulkMfrOpen}
        onClose={() => {
          setIsBulkMfrOpen(false);
          setBulkMfrTarget(null);
        }}
        tenantId={tenantId}
        suppliers={suppliers}
        initialManufacturer={bulkMfrTarget}
        onSaved={async () => {
          await handleRefresh();
        }}
      />
    </div>
  );
}
