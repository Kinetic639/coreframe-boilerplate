'use client';

import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  ChevronRight, 
  Database, 
  Filter, 
  HelpCircle, 
  Package, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  X,
  Settings,
  LayoutGrid,
  List,
  Table,
  Eye,
  EyeOff,
  Check,
  ShoppingBag,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { InventoryBalance, Product, Vendor, ClientLocation, Order } from '../lib/types';

interface InventoryViewProps {
  inventoryBalances: InventoryBalance[];
  products: Product[];
  vendors: Vendor[];
  locations: ClientLocation[];
  activeLocationId: string;
  orders?: Order[];
  onViewProductDetail: (productId: string) => void;
  onOpenStockCountForProduct: (productId: string) => void;
  onAddToCart: (productId: string, qty: number) => void;
}

export default function InventoryView({
  inventoryBalances,
  products,
  vendors,
  locations,
  activeLocationId,
  orders = [],
  onViewProductDetail,
  onOpenStockCountForProduct,
  onAddToCart
}: InventoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  
  // Custom interactive catalog states
  const [viewMode, setViewMode] = useState<'table' | 'tile' | 'list'>('table');
  const [hidePrices, setHidePrices] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<'all' | 'ordered-past' | 'low-stock' | 'incoming'>('all');

  const getProduct = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  const getVendor = (vendorId: string) => {
    return vendors.find(v => v.id === vendorId);
  };

  // Get categories for filter dropdown
  const categories = useMemo(() => {
    const list = new Set(products.map(p => p.category));
    return Array.from(list);
  }, [products]);

  // Compute products ordered in the past from the orders array
  const orderedProductIds = useMemo(() => {
    const ids = new Set<string>();
    orders.forEach(o => {
      o.lines?.forEach(l => {
        ids.add(l.productId);
      });
    });
    return ids;
  }, [orders]);

  // Status mapping to Polish label and colors
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Healthy': return { text: 'Prawidłowy', color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
      case 'Approaching minimum': return { text: 'Blisko minimum', color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' };
      case 'Below minimum': return { text: 'Poniżej minimum', color: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 animate-pulse' };
      case 'Out of stock': return { text: 'Brak zapasu', color: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse' };
      case 'Overstocked': return { text: 'Nadstan', color: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' };
      case 'Count outdated': return { text: 'Przedawniony', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300' };
      case 'Needs verification': return { text: 'Weryfikacja', color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' };
      default: return { text: 'Brak odczytu', color: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' };
    }
  };

  // Filtering logic
  const filteredBalances = useMemo(() => {
    return inventoryBalances.filter(balance => {
      // 1. Location filter
      if (balance.locationId !== activeLocationId) return false;

      const product = getProduct(balance.productId);
      if (!product) return false;

      // 2. Quick filters bar selection
      if (activeQuickFilter === 'ordered-past' && !orderedProductIds.has(balance.productId)) return false;
      if (activeQuickFilter === 'low-stock' && !['Below minimum', 'Out of stock'].includes(balance.stockStatus)) return false;
      if (activeQuickFilter === 'incoming' && balance.incomingQty <= 0) return false;

      // 3. Search query filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(query);
        const matchesSku = product.vendorSku.toLowerCase().includes(query) || product.clientSku.toLowerCase().includes(query);
        if (!matchesName && !matchesSku) return false;
      }

      // 4. Vendor filter
      if (selectedVendorId !== 'all' && product.vendorId !== selectedVendorId) return false;

      // 5. Status filter
      if (selectedStatus !== 'all' && balance.stockStatus !== selectedStatus) return false;

      // 6. Category filter
      if (selectedCategoryId !== 'all' && product.category !== selectedCategoryId) return false;

      return true;
    });
  }, [inventoryBalances, searchQuery, selectedVendorId, selectedStatus, selectedCategoryId, activeLocationId, products, activeQuickFilter, orderedProductIds]);

  const activeLocationName = locations.find(l => l.id === activeLocationId)?.name || 'Wybrany Oddział';

  return (
    <div className="space-y-4">
      
      {/* Upper header with title, settings, and view toggles */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 gap-3">
        <div>
          <h2 className="text-base font-bold font-display text-gray-950 dark:text-white">Zarządzanie zapasami VMI</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Oddział: <span className="text-blue-600 dark:text-blue-400 font-semibold">{activeLocationName}</span></p>
        </div>
        
        {/* VIEW MODE TOGGLES AND CATALOG SETTINGS DROPDOWN */}
        <div className="flex items-center gap-2.5 self-end md:self-auto">
          {/* View Toggles */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-center",
                viewMode === 'table' 
                  ? "bg-white dark:bg-gray-700 shadow-sm text-gray-950 dark:text-white font-bold" 
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-850 dark:hover:text-gray-200"
              )}
              title="Widok tabeli standardowej"
            >
              <Table className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('tile')}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-center",
                viewMode === 'tile' 
                  ? "bg-white dark:bg-gray-700 shadow-sm text-gray-950 dark:text-white font-bold" 
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-850 dark:hover:text-gray-200"
              )}
              title="Kompaktowe kafelki (idealne na tablet)"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-center",
                viewMode === 'list' 
                  ? "bg-white dark:bg-gray-700 shadow-sm text-gray-950 dark:text-white font-bold" 
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-850 dark:hover:text-gray-200"
              )}
              title="Kompaktowa lista wierszy"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Interactive Catalog Settings Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={cn(
                "p-2 px-3.5 bg-white dark:bg-[#131A2E] hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-all cursor-pointer shadow-sm",
                isSettingsOpen ? "" : ""
              )}
            >
              <Settings className={cn("h-4 w-4 text-gray-500", isSettingsOpen && "animate-spin-slow")} />
              <span>Opcje katalogu</span>
            </button>

            {isSettingsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsSettingsOpen(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#131A2E] rounded-xl shadow-lg z-20 p-3.5 space-y-3 animate-fade-in text-xs text-[#1A1C1E] dark:text-white">
                  <div className="font-bold text-gray-400 dark:text-gray-500 uppercase text-[10px] tracking-wider pb-1.5">
                    Konfiguracja katalogu
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer py-1 select-none hover:text-blue-600 dark:hover:text-blue-400">
                    <input
                      type="checkbox"
                      checked={hidePrices}
                      onChange={(e) => setHidePrices(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold">Ukryj ceny towarów</span>
                      <span className="text-[10px] text-gray-500">Testuj tryb bez cennika</span>
                    </div>
                  </label>

                  <div className="text-[10px] text-gray-400 dark:text-gray-500 pt-1 leading-relaxed bg-gray-50 dark:bg-[#0E1321] p-2 rounded-lg">
                    Włącz ten parametr, aby zasymulować wizytę handlowca na tablecie u klienta końcowego, chroniąc marżę hurtową przed wzrokiem osób trzecich.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* QUICK FILTERS BAR ABOVE SEARCHBAR */}
      <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 dark:bg-gray-900/20 p-2 rounded-xl shadow-sm text-xs">
        <span className="font-bold text-gray-400 dark:text-gray-500 px-2 uppercase tracking-wide text-[10px]">Szybkie filtry:</span>
        <button
          onClick={() => setActiveQuickFilter('all')}
          className={cn(
            "px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap",
            activeQuickFilter === 'all'
              ? "bg-[#2A3B4C] dark:bg-blue-600 text-white"
              : "bg-white dark:bg-[#131A2E] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          )}
        >
          Wszystkie asortymenty ({inventoryBalances.filter(b => b.locationId === activeLocationId).length})
        </button>
        <button
          onClick={() => setActiveQuickFilter('ordered-past')}
          className={cn(
            "px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
            activeQuickFilter === 'ordered-past'
              ? "bg-[#2A3B4C] dark:bg-blue-600 text-white"
              : "bg-white dark:bg-[#131A2E] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          )}
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          <span>Zamawiane w przeszłości ({orderedProductIds.size})</span>
        </button>
        <button
          onClick={() => setActiveQuickFilter('low-stock')}
          className={cn(
            "px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
            activeQuickFilter === 'low-stock'
              ? "bg-red-600 text-white"
              : "bg-white dark:bg-[#131A2E] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Niskie stany zapasów ({inventoryBalances.filter(b => b.locationId === activeLocationId && ['Below minimum', 'Out of stock'].includes(b.stockStatus)).length})</span>
        </button>
        <button
          onClick={() => setActiveQuickFilter('incoming')}
          className={cn(
            "px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
            activeQuickFilter === 'incoming'
              ? "bg-emerald-600 text-white"
              : "bg-white dark:bg-[#131A2E] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
          )}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          <span>W drodze / Zamówione ({inventoryBalances.filter(b => b.locationId === activeLocationId && b.incomingQty > 0).length})</span>
        </button>
      </div>

      {/* SEARCH AND ADVANCED SELECTORS BOX */}
      <div className="bg-white dark:bg-[#0E1321] rounded-xl p-4 space-y-3 shadow-sm">
        {/* Search Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Szukaj po nazwie produktu, SKU dostawcy lub indeksie klienta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#0C101A] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        {/* Sliders selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {/* Vendor */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Dostawca</label>
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#0C101A] text-gray-900 dark:text-white py-1.5 px-2 rounded-lg cursor-pointer text-xs focus:outline-none"
            >
              <option value="all">Wszyscy dostawcy</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status zapasu</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#0C101A] text-gray-900 dark:text-white py-1.5 px-2 rounded-lg cursor-pointer text-xs focus:outline-none"
            >
              <option value="all">Wszystkie statusy</option>
              <option value="Healthy">Prawidłowy (Healthy)</option>
              <option value="Approaching minimum">Blisko minimum</option>
              <option value="Below minimum">Poniżej minimum (Pilne!)</option>
              <option value="Out of stock">Brak zapasu (Wyprzedany)</option>
              <option value="Overstocked">Nadstan (Przepełnienie)</option>
              <option value="Count outdated">Wymaga przeliczenia</option>
              <option value="Needs verification">Do weryfikacji</option>
            </select>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Kategoria</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#0C101A] text-gray-900 dark:text-white py-1.5 px-2 rounded-lg cursor-pointer text-xs focus:outline-none"
            >
              <option value="all">Wszystkie kategorie</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* RESULTS SUMMARY BAR */}
      <div className="flex items-center justify-between text-xs px-1 text-gray-500 dark:text-gray-400 font-semibold">
        <span>Filtrowane wyniki: {filteredBalances.length} pozycji</span>
        {activeQuickFilter !== 'all' && (
          <button
            onClick={() => setActiveQuickFilter('all')}
            className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1 font-bold"
          >
            <span>Wyczyść szybki filtr</span>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* RENDER DYNAMIC CATALOG VIEWS */}

      {/* 1. STANDARD TABLE VIEW (Only shown when viewMode === 'table') */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-[#0E1321] rounded-xl overflow-hidden shadow-sm">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#131A2E] text-gray-500 dark:text-gray-400 font-semibold font-bold">
                  <th className="p-3">Produkt / Dostawca</th>
                  <th className="p-3">Kategoria</th>
                  <th className="p-3 text-center">Bieżący stan</th>
                  <th className="p-3 text-center">Próg Min / Cel</th>
                  <th className="p-3 text-center">Status VMI</th>
                  <th className="p-3 text-center">W drodze</th>
                  {!hidePrices && <th className="p-3 text-right">Cena netto</th>}
                  <th className="p-3 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E3E6] dark:divide-gray-800">
                {filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={hidePrices ? 7 : 8} className="p-8 text-center text-gray-500">
                      Brak produktów spełniających wybrane kryteria wyszukiwania.
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map(balance => {
                    const prod = getProduct(balance.productId);
                    const vend = prod ? getVendor(prod.vendorId) : null;
                    if (!prod || !vend) return null;

                    const status = getStatusLabel(balance.stockStatus);

                    return (
                      <tr key={balance.productId} className="hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                        <td className="p-3 min-w-[200px]">
                          <button 
                            onClick={() => onViewProductDetail(prod.id)}
                            className="text-left font-bold text-gray-950 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                          >
                            {prod.name}
                          </button>
                          <div className="flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                              <span>SKU: {prod.vendorSku}</span>
                              <span>•</span>
                              <span className="text-gray-500 dark:text-gray-400 font-semibold">{vend.name}</span>
                            </div>
                            
                            {/* Warehouse Available Qty Display */}
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1.5">
                              <span>Magazyn centralny:</span>
                              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.2 rounded">
                                {prod.warehouseQty} {prod.unitOfMeasure}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-gray-500 dark:text-gray-400">{prod.category}</td>
                        <td className="p-3 text-center font-bold font-mono text-gray-950 dark:text-white text-sm">
                          {balance.currentStock} <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500 font-sans">{prod.unitOfMeasure}</span>
                        </td>
                        <td className="p-3 text-center text-gray-500 dark:text-gray-400 font-mono">
                          {balance.minStock} / {balance.targetStock}
                        </td>
                        <td className="p-3 text-center">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold uppercase", status.color)}>
                            {status.text}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono text-gray-500 dark:text-gray-400">
                          {balance.incomingQty > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{balance.incomingQty}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        {!hidePrices && (
                          <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                            {(prod.promoPrice || prod.price).toFixed(2)} zł
                          </td>
                        )}
                        <td className="p-3 text-right space-x-1.5">
                          <button
                            onClick={() => onOpenStockCountForProduct(prod.id)}
                            className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-semibold text-[10px] cursor-pointer transition-colors"
                          >
                            Przelicz
                          </button>
                          <button
                            onClick={() => onAddToCart(prod.id, prod.packSize)}
                            className="px-2.5 py-1 bg-[#2A3B4C] dark:bg-blue-600 hover:bg-gray-800 dark:hover:bg-blue-500 text-white rounded font-bold text-[10px] cursor-pointer transition-colors"
                          >
                            Zamów (+{prod.packSize})
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Fallback under standard table view */}
          <div className="md:hidden grid grid-cols-1 gap-2.5 p-3 bg-gray-50 dark:bg-gray-950/20">
            {filteredBalances.length === 0 ? (
              <div className="text-center text-gray-500 py-6 text-xs">Brak wyników.</div>
            ) : (
              filteredBalances.map(balance => {
                const prod = getProduct(balance.productId);
                const vend = prod ? getVendor(prod.vendorId) : null;
                if (!prod || !vend) return null;
                const status = getStatusLabel(balance.stockStatus);

                return (
                  <div key={balance.productId} className="bg-white dark:bg-[#0E1321] rounded-xl p-3.5 space-y-3.5 shadow-sm">
                    <div className="flex gap-2.5 items-start justify-between">
                      <div className="min-w-0">
                        <button
                          onClick={() => onViewProductDetail(prod.id)}
                          className="text-xs font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left leading-normal"
                        >
                          {prod.name}
                        </button>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">SKU: {prod.vendorSku} • {vend.name}</p>
                      </div>
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase shrink-0", status.color)}>
                        {status.text}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1.5 px-2 bg-gray-50 dark:bg-gray-950/40 rounded-lg text-center text-[11px]">
                      <div>
                        <span className="text-gray-400 dark:text-gray-500 block text-[10px]">Stan obecny</span>
                        <span className="font-extrabold text-gray-900 dark:text-white text-xs font-mono">{balance.currentStock} {prod.unitOfMeasure}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 dark:text-gray-500 block text-[10px]">Magazyn centralny</span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-xs">{prod.warehouseQty}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 dark:text-gray-500 block text-[10px]">Cel optymalny</span>
                        <span className="font-bold text-gray-700 dark:text-gray-300 font-mono">{balance.targetStock}</span>
                      </div>
                    </div>

                    {!hidePrices && (
                      <div className="flex justify-between items-center text-xs font-mono pt-2 text-gray-600 dark:text-gray-400">
                        <span>Cena netto:</span>
                        <span className="font-black text-gray-900 dark:text-white">{(prod.promoPrice || prod.price).toFixed(2)} zł</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {balance.incomingQty > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">W drodze: +{balance.incomingQty}</span>
                        ) : (
                          'Brak dostaw w toku'
                        )}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => onOpenStockCountForProduct(prod.id)}
                          className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] rounded font-bold cursor-pointer transition-colors"
                        >
                          Przelicz
                        </button>
                        <button
                          onClick={() => onAddToCart(prod.id, prod.packSize)}
                          className="px-2.5 py-1 bg-[#2A3B4C] dark:bg-blue-600 hover:bg-gray-800 dark:hover:bg-blue-500 text-white text-[10px] rounded font-bold cursor-pointer transition-colors"
                        >
                          + Zamów
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 2. COMPACT TILE VIEW (ViewMode === 'tile') */}
      {viewMode === 'tile' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredBalances.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500 text-xs bg-white dark:bg-[#0E1321] rounded-xl shadow-sm">
              Brak produktów pasujących do kryteriów wyszukiwania.
            </div>
          ) : (
            filteredBalances.map(balance => {
              const prod = getProduct(balance.productId);
              const vend = prod ? getVendor(prod.vendorId) : null;
              if (!prod || !vend) return null;
              const status = getStatusLabel(balance.stockStatus);

              return (
                <div
                  key={balance.productId}
                  className="bg-white dark:bg-[#131A2E] rounded-xl p-2.5 flex flex-col justify-between dark:hover:border-gray-700 transition-all text-xs shadow-sm group"
                >
                  <div className="space-y-2">
                    {/* Small thumbnail aspect cover */}
                    <div className="relative w-full aspect-[4/3] bg-gray-50 dark:bg-gray-800/40 rounded-lg overflow-hidden shrink-0">
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* VMI Status Badge layered over image */}
                      <span className={cn("absolute top-1 left-1 text-[8px] font-black uppercase px-1 py-0.5 rounded shadow-sm", status.color)}>
                        {status.text}
                      </span>
                    </div>

                    {/* Meta details */}
                    <div className="space-y-0.5">
                      <button
                        onClick={() => onViewProductDetail(prod.id)}
                        className="font-bold text-xs text-[#1A1C1E] dark:text-white line-clamp-2 leading-tight text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      >
                        {prod.name}
                      </button>
                      <div className="text-[9px] text-gray-400 dark:text-gray-500 font-mono truncate">
                        {prod.vendorSku} • {vend.name}
                      </div>
                    </div>
                  </div>

                  {/* Stock balances and warehouse qty display */}
                  <div className="mt-2.5 pt-2 space-y-1">
                    {/* Warehouse Available Qty */}
                    <div className="flex justify-between items-center text-[9px] text-gray-500 dark:text-gray-400">
                      <span>Magazyn centralny:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {prod.warehouseQty} {prod.unitOfMeasure}
                      </span>
                    </div>

                    {/* Local VMI Balance */}
                    <div className="flex justify-between items-center text-[9px] text-gray-500 dark:text-gray-400">
                      <span>Twój stan zapasu:</span>
                      <span className="font-bold text-gray-700 dark:text-gray-300 font-mono">
                        {balance.currentStock}/{balance.targetStock}
                      </span>
                    </div>

                    {/* Net Price */}
                    {!hidePrices && (
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[9px] text-gray-400">Netto:</span>
                        <span className="font-mono font-black text-[#2A3B4C] dark:text-blue-400 text-xs">
                          {(prod.promoPrice || prod.price).toFixed(2)} zł
                        </span>
                      </div>
                    )}

                    {/* Fast add action */}
                    <div className="pt-2 flex gap-1">
                      <button
                        onClick={() => onOpenStockCountForProduct(prod.id)}
                        className="flex-1 py-1 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-300 text-[9px] font-bold rounded cursor-pointer transition-colors"
                        title="Zgłoś spis"
                      >
                        Spis
                      </button>
                      <button
                        onClick={() => onAddToCart(prod.id, prod.packSize)}
                        className="flex-2 py-1 bg-[#2A3B4C] dark:bg-blue-600 hover:bg-[#1E2B38] dark:hover:bg-blue-500 text-white text-[9px] font-black rounded cursor-pointer transition-all flex items-center justify-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Kup ({prod.packSize})</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. COMPACT LIST VIEW (ViewMode === 'list') */}
      {viewMode === 'list' && (
        <div className="flex flex-col gap-2 bg-white dark:bg-[#0E1321] rounded-xl p-2 shadow-sm">
          {filteredBalances.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">
              Brak produktów pasujących do kryteriów wyszukiwania.
            </div>
          ) : (
            filteredBalances.map(balance => {
              const prod = getProduct(balance.productId);
              const vend = prod ? getVendor(prod.vendorId) : null;
              if (!prod || !vend) return null;
              const status = getStatusLabel(balance.stockStatus);

              return (
                <div
                  key={balance.productId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-white dark:bg-[#131A2E] hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-lg transition-colors text-xs"
                >
                  {/* Left part: image miniature, name, category, SKU */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="w-11 h-11 object-cover rounded bg-gray-100 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <button
                        onClick={() => onViewProductDetail(prod.id)}
                        className="font-bold text-xs text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left leading-snug line-clamp-1"
                      >
                        {prod.name}
                      </button>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-gray-400 mt-0.5 font-mono">
                        <span>SKU: {prod.vendorSku}</span>
                        <span>•</span>
                        <span>Kategoria: {prod.category}</span>
                        <span>•</span>
                        <span className="text-gray-500 dark:text-gray-400 font-semibold">{vend.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle part: stock levels */}
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-between sm:justify-end shrink-0 py-1 sm:py-0 sm:border-0">
                    {/* Warehouse central qty */}
                    <div className="text-left font-sans">
                      <span className="text-[9px] text-gray-400 block sm:text-right">Magazyn centralny</span>
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                        {prod.warehouseQty} <span className="text-[8px] font-sans font-normal text-gray-400">{prod.unitOfMeasure}</span>
                      </span>
                    </div>

                    {/* Current stock status */}
                    <div className="text-left font-sans">
                      <span className="text-[9px] text-gray-400 block sm:text-right">Stan u Ciebie</span>
                      <span className="font-bold font-mono text-gray-700 dark:text-gray-300 flex items-center justify-end gap-1">
                        {balance.currentStock} / {balance.targetStock}
                      </span>
                    </div>

                    {/* VMI Status badge */}
                    <div className="flex items-center">
                      <span className={cn("text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-sm", status.color)}>
                        {status.text}
                      </span>
                    </div>

                    {/* Price netto */}
                    {!hidePrices && (
                      <div className="text-right font-mono min-w-[75px]">
                        <span className="text-[9px] text-gray-450 block">Netto</span>
                        <span className="font-black text-gray-950 dark:text-white text-xs">
                          {(prod.promoPrice || prod.price).toFixed(2)} zł
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right part: Actions */}
                  <div className="flex items-center gap-1.5 justify-end shrink-0">
                    <button
                      onClick={() => onOpenStockCountForProduct(prod.id)}
                      className="px-2.5 py-1 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-bold text-[10px] cursor-pointer transition-colors"
                    >
                      Przelicz
                    </button>
                    <button
                      onClick={() => onAddToCart(prod.id, prod.packSize)}
                      className="px-2.5 py-1 bg-[#2A3B4C] dark:bg-blue-600 hover:bg-[#1E2B38] dark:hover:bg-blue-500 text-white rounded font-extrabold text-[10px] cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Kup (+{prod.packSize})</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* FOOTER TIPS BAR */}
      <div className="bg-blue-50/50 dark:bg-blue-950/10 rounded-xl p-3 flex gap-2.5 items-start text-xs text-blue-800 dark:text-blue-300">
        <Info className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Wskazówka: System VMI stale monitoruje stany magazynowe w Twojej sieci i sugeruje optymalne dostawy. Kliknij <strong className="text-blue-700 dark:text-blue-400">&quot;Kup&quot;</strong> lub <strong className="text-blue-700 dark:text-blue-400">&quot;Zamów&quot;</strong>, aby ręcznie zasilić brakujące zapasy przed planowanym kursem dostawcy.
        </p>
      </div>

    </div>
  );
}
