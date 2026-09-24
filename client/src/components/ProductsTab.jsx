import React, { useState } from 'react';
import { Plus, Upload, Search, Pill, ShieldAlert, Edit, Trash2, CheckCircle2 } from 'lucide-react';

export default function ProductsTab({
  products,
  onOpenAddProduct,
  onOpenEditProduct,
  onOpenImportCsv,
  onDeleteProduct,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const categories = [
    'Todos',
    'Medicamentos',
    'Analgésicos e Antitérmicos',
    'Antibióticos',
    'Anti-inflamatórios',
    'Cardiovascular',
    'Gastroenterologia',
    'Relaxante Muscular',
  ];

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.active_ingredient && p.active_ingredient.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.barcode && p.barcode.includes(searchTerm));

    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-5">
      {/* Top Header Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, princípio ativo ou código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={onOpenImportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            <Upload size={14} />
            Importar Planilha CSV
          </button>
          <button
            onClick={onOpenAddProduct}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs"
          >
            <Plus size={14} />
            Novo Medicamento
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Medicamento / Apresentação</th>
                <th className="py-3 px-4">Princípio Ativo & Lab</th>
                <th className="py-3 px-4">Preço Venda</th>
                <th className="py-3 px-4">Estoque Físico</th>
                <th className="py-3 px-4">Reservado</th>
                <th className="py-3 px-4">Disponível Bot</th>
                <th className="py-3 px-4">Receita Médica</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Nenhum medicamento encontrado para essa busca.
                  </td>
                </tr>
              ) : (
                filtered.map((prod) => {
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
                        <p className="text-[10px] text-slate-400">{prod.manufacturer || '—'}</p>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 text-sm">
                        R$ {Number(prod.sale_price).toFixed(2)}
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
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
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
      </div>
    </div>
  );
}
