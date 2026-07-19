'use client';

import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  ChevronRight, 
  Check, 
  Clock, 
  FileText, 
  HelpCircle, 
  MessageSquare, 
  Package, 
  Search, 
  ShoppingBag, 
  Truck, 
  X 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Order, Product, Vendor, ClientLocation } from '../lib/types';

interface OrdersViewProps {
  orders: Order[];
  products: Product[];
  vendors: Vendor[];
  locations: ClientLocation[];
  activeLocationId: string;
  onOpenOrderChat: (orderId: string, vendorId: string, subject: string) => void;
}

export default function OrdersView({
  orders,
  products,
  vendors,
  locations,
  activeLocationId,
  onOpenOrderChat
}: OrdersViewProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getProduct = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  const getVendor = (vendorId: string) => {
    return vendors.find(v => v.id === vendorId);
  };

  const activeLocationOrders = orders.filter(o => o.locationId === activeLocationId);

  // Status visual mapping
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Złożone':
        return { text: 'Nadesłane', color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' };
      case 'Potwierdzone':
        return { text: 'Zatwierdzone', color: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' };
      case 'Częściowo potwierdzone':
        return { text: 'Częściowe (Brak)', color: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' };
      case 'W transporcie':
        return { text: 'W transporcie', color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse' };
      case 'Dostarczone':
        return { text: 'Odebrane', color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
      case 'Anulowane':
        return { text: 'Anulowane', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' };
      default:
        return { text: status, color: 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300' };
    }
  };

  // Filter orders
  const filteredOrders = activeLocationOrders.filter(o => {
    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchesNum = o.orderNumber.toLowerCase().includes(q);
      const matchesVendor = getVendor(o.vendorId)?.name.toLowerCase().includes(q);
      if (!matchesNum && !matchesVendor) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && ['Dostarczone', 'Anulowane'].includes(o.status)) return false;
      if (statusFilter === 'archived' && !['Dostarczone', 'Anulowane'].includes(o.status)) return false;
    }

    return true;
  });

  const activeOrder = orders.find(o => o.id === selectedOrderId);
  const activeOrderVendor = activeOrder ? getVendor(activeOrder.vendorId) : null;

  // Status timeline tracking steps helper
  const renderTimeline = (status: string) => {
    const steps = [
      { name: 'Złożone', desc: 'Zgłoszenie wysłane do systemu VMI', active: true },
      { name: 'Potwierdzone', desc: 'Zweryfikowane przez dostawcę', active: ['Potwierdzone', 'Częściowo potwierdzone', 'W transporcie', 'Dostarczone'].includes(status) },
      { name: 'W transporcie', desc: 'Przesyłka w drodze kurierskiej', active: ['W transporcie', 'Dostarczone'].includes(status) },
      { name: 'Dostarczone', desc: 'Zapas fizycznie przyjęty na półki', active: status === 'Dostarczone' }
    ];

    if (status === 'Anulowane') {
      return (
        <div className="bg-red-50 dark:bg-red-950/15 rounded-xl p-3 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <span>Zamówienie zostało anulowane przez koordynatora. Skontaktuj się z obsługą w celu wyjaśnienia.</span>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Status realizacji zamówienia</span>
        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-150 dark:before:bg-gray-800">
          {steps.map((step, idx) => {
            const isCompleted = step.active;
            const isCurrent = isCompleted && (idx === steps.length - 1 || !steps[idx + 1].active);

            return (
              <div key={idx} className="relative flex items-start gap-4 text-xs">
                {/* Step circle */}
                <span className={cn(
                  "absolute -left-6 top-1 w-4.5 h-4.5 rounded-full flex items-center justify-center transition-colors",
                  isCompleted 
                    ? isCurrent 
                      ? "bg-blue-600 text-white animate-pulse" 
                      : "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400" 
                    : "bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600"
                )}>
                  {isCompleted && !isCurrent && <Check className="h-2.5 w-2.5" />}
                  {isCurrent && <Clock className="h-2.5 w-2.5" />}
                </span>

                <div className="space-y-0.5">
                  <p className={cn(
                    "font-bold",
                    isCurrent ? "text-blue-600 dark:text-blue-400" : isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500"
                  )}>
                    {step.name} {step.name === 'Potwierdzone' && status === 'Częściowo potwierdzone' && '(Z modyfikacją)'}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full">
      {activeOrder && activeOrderVendor ? (
        
        /* ORDER DETAIL SCREEN */
        <div className="space-y-5">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedOrderId(null)}
                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h3 className="font-bold text-sm text-gray-950 dark:text-white">Zamówienie {activeOrder.orderNumber}</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Źródło: <span className="font-semibold text-gray-750 dark:text-gray-300">{activeOrder.origin}</span> • {activeOrder.date}</p>
              </div>
            </div>

            <span className={cn("text-[10px] px-2.5 py-1 rounded font-extrabold uppercase", getStatusBadge(activeOrder.status).color)}>
              {getStatusBadge(activeOrder.status).text}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left column: Timeline tracker (Span 4) */}
            <div className="lg:col-span-4 bg-white dark:bg-[#0E1321] rounded-xl p-4 h-fit shadow-sm">
              {renderTimeline(activeOrder.status)}
            </div>

            {/* Right column: Lines list & Contact (Span 8) */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Vendor & Delivery info card */}
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs shadow-sm">
                <div className="space-y-1">
                  <span className="text-gray-400 dark:text-gray-500 block">Dostawca VMI</span>
                  <span className="font-bold text-sm text-gray-950 dark:text-white">{activeOrderVendor.name}</span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Opiekun: {activeOrderVendor.accountManager.name}</span>
                </div>
                <div className="space-y-1 sm:text-right">
                  <span className="text-gray-400 dark:text-gray-500 block">Planowany termin dostawy</span>
                  <span className="font-bold text-sm text-blue-600 dark:text-blue-400 block">{activeOrder.requestedDeliveryDate}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 block">Wymagana asysta rozładunkowa</span>
                </div>
              </div>

              {/* Order Lines items */}
              <div className="bg-white dark:bg-[#0E1321] rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-gray-50 dark:bg-[#131A2E] flex justify-between items-center">
                  <span className="font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider">Pozycje zamówienia ({activeOrder.lines.length})</span>
                  <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">Ambra Inventory Code</span>
                </div>

                <div className="divide-y divide-[#E1E3E6] dark:divide-gray-850">
                  {activeOrder.lines.map((line, idx) => {
                    const prod = getProduct(line.productId);
                    if (!prod) return null;

                    return (
                      <div key={idx} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-950 dark:text-white truncate">{prod.name}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                            SKU: {prod.vendorSku} • Opakowanie: {prod.packSize} szt.
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-bold text-gray-950 dark:text-white font-mono">{line.requestedQty} szt.</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{(line.price * line.requestedQty).toFixed(2)} zł</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals footer */}
                <div className="p-4 bg-gray-50/60 dark:bg-gray-950/40 flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-500 dark:text-gray-400">Łączna wartość zamówienia:</span>
                  <div className="text-right">
                    <p className="text-base font-black font-mono text-gray-950 dark:text-white">
                      {activeOrder.lines.reduce((acc, l) => acc + (l.price * l.requestedQty), 0).toFixed(2)} zł
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">Netto (+23% VAT)</p>
                  </div>
                </div>
              </div>

              {/* Bottom instant action button to chat */}
              <button
                onClick={() => onOpenOrderChat(
                  activeOrder.id, 
                  activeOrder.vendorId, 
                  `Pytanie o stan zamówienia ${activeOrder.orderNumber}`
                )}
                className="w-full py-3.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-950 dark:text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Napisz do dostawcy w sprawie tego zamówienia</span>
              </button>
            </div>
          </div>
        </div>
      ) : (

        /* LIST OF ORDERS SCREEN */
        <div className="space-y-4">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-2">
            <div>
              <h2 className="text-base font-bold font-display text-gray-950 dark:text-white">Spis zamówień VMI</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Monitorowane dostawy do oddziału Poznańska</p>
            </div>
            <span className="text-[10px] bg-white dark:bg-gray-900 px-2.5 py-0.5 rounded font-mono text-gray-500 dark:text-gray-400 shadow-sm">
              Łącznie: {filteredOrders.length}
            </span>
          </div>

          {/* Search/Filter tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0E1321] rounded-xl p-3 shadow-sm">
            {/* Search */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Szukaj po numerze zamówienia, dostawcy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-[#0C101A] rounded-lg text-xs focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Status tabs segment */}
            <div className="flex bg-gray-55 dark:bg-gray-950 p-1 rounded-lg text-xs shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={cn(
                  "px-3 py-1 rounded-md font-medium cursor-pointer transition-colors text-xs",
                  statusFilter === 'all' 
                    ? "bg-white dark:bg-gray-800 text-gray-950 dark:text-white shadow-sm font-bold" 
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                )}
              >
                Wszystkie
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={cn(
                  "px-3 py-1 rounded-md font-medium cursor-pointer transition-colors text-xs",
                  statusFilter === 'active' 
                    ? "bg-white dark:bg-gray-800 text-gray-950 dark:text-white shadow-sm font-bold" 
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                )}
              >
                W realizacji
              </button>
              <button
                onClick={() => setStatusFilter('archived')}
                className={cn(
                  "px-3 py-1 rounded-md font-medium cursor-pointer transition-colors text-xs",
                  statusFilter === 'archived' 
                    ? "bg-white dark:bg-gray-800 text-gray-950 dark:text-white shadow-sm font-bold" 
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                )}
              >
                Zakończone
              </button>
            </div>
          </div>

          {/* Orders list loop */}
          <div className="grid grid-cols-1 gap-2.5">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs bg-gray-55 dark:bg-gray-900/10 rounded-xl shadow-sm">
                Brak zamówień w wybranej kategorii.
              </div>
            ) : (
              filteredOrders.map(order => {
                const vendor = getVendor(order.vendorId);
                const badge = getStatusBadge(order.status);
                const totalVal = order.lines.reduce((acc, l) => acc + (l.price * l.requestedQty), 0);

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className="bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-[#111728] dark:hover:border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 cursor-pointer transition-all shadow-sm"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-gray-900 dark:text-white font-mono">{order.orderNumber}</span>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase", badge.color)}>
                          {badge.text}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Dostawca: <strong className="text-gray-800 dark:text-white">{vendor?.name || 'Dostawca'}</strong> • {order.lines.length} pozycji
                      </p>

                      <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Złożone: {order.date}</span>
                        </span>
                        <span>•</span>
                        <span>Dostawa: {order.requestedDeliveryDate}</span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 sm:border-t-0 pt-2 sm:pt-0">
                      <p className="text-sm font-black font-mono text-gray-950 dark:text-white">{totalVal.toFixed(2)} zł</p>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                        <span>Szczegóły</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}
    </div>
  );
}
