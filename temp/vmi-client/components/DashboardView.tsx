'use client';

import React from 'react';
import { 
  AlertTriangle, 
  ArrowRight, 
  Bell, 
  ChevronRight, 
  Clock, 
  Database, 
  FileCheck, 
  HelpCircle, 
  Layers, 
  MapPin, 
  Package, 
  Percent, 
  ShoppingBag, 
  TrendingUp, 
  Truck, 
  User,
  Heart,
  Globe,
  MessageSquare,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  InventoryBalance, 
  ReplenishmentProposal, 
  Order, 
  Quotation, 
  Notification, 
  ClientLocation, 
  Vendor 
} from '../lib/types';
import { mockProducts as publicMockProducts, mockVendors as publicMockVendors } from './marketplace/mockData';

interface DashboardViewProps {
  locations: ClientLocation[];
  activeLocationId: string;
  setActiveLocationId: (id: string) => void;
  inventoryBalances: InventoryBalance[];
  proposals: ReplenishmentProposal[];
  orders: Order[];
  quotations: Quotation[];
  notifications: Notification[];
  vendors: Vendor[];
  
  // Navigation helpers to open specific panels
  onNavigateTab: (tab: 'vendors' | 'inventory' | 'orders' | 'messages' | 'settings' | 'marketplace') => void;
  onOpenProposal: (id: string) => void;
  onOpenOrder: (id: string) => void;
  onOpenQuotation: (id: string) => void;
  onOpenStockCount: () => void;
  onOpenVendor: (vendorId: string, tab?: any) => void;
  onNavigateToMarketplace?: (path: string) => void;
}

export default function DashboardView({
  locations,
  activeLocationId,
  setActiveLocationId,
  inventoryBalances,
  proposals,
  orders,
  quotations,
  notifications,
  vendors,
  onNavigateTab,
  onOpenProposal,
  onOpenOrder,
  onOpenQuotation,
  onOpenStockCount,
  onOpenVendor,
  onNavigateToMarketplace
}: DashboardViewProps) {
  
  // Load Marketplace Activity from localStorage
  const [savedItems, setSavedItems] = React.useState<any[]>([]);
  const [rfqs, setRfqs] = React.useState<any[]>([]);
  const [questions, setQuestions] = React.useState<any[]>([]);
  const [activeMarketplaceTab, setActiveMarketplaceTab] = React.useState<'rfqs' | 'questions' | 'products' | 'vendors'>('rfqs');

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('ambra-marketplace-saved');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setSavedItems(JSON.parse(saved));

      const rfqList = localStorage.getItem('ambra-marketplace-rfqs');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (rfqList) setRfqs(JSON.parse(rfqList));

      const questionList = localStorage.getItem('ambra-marketplace-questions');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (questionList) setQuestions(JSON.parse(questionList));
    } catch (e) {
      console.error('Error reading localStorage for dashboard', e);
    }
  }, []);

  const favoriteProducts = React.useMemo(() => {
    return savedItems
      .filter(i => i.type === 'product')
      .map(i => publicMockProducts.find(p => p.id === i.id))
      .filter(Boolean);
  }, [savedItems]);

  const favoriteVendors = React.useMemo(() => {
    return savedItems
      .filter(i => i.type === 'vendor')
      .map(i => publicMockVendors.find(v => v.id === i.id))
      .filter(Boolean);
  }, [savedItems]);

  // Calculate specific figures for active location
  const activeLocation = locations.find(l => l.id === activeLocationId);
  
  const locationBalances = inventoryBalances.filter(b => b.locationId === activeLocationId);
  const monitoredCount = locationBalances.length || 186; // Fallback
  
  const lowStockCount = locationBalances.filter(b => 
    ['Below minimum', 'Out of stock', 'Approaching minimum'].includes(b.stockStatus)
  ).length;

  const pendingProposalsCount = proposals.filter(p => 
    p.locationId === activeLocationId && p.status === 'Oczekuje na zatwierdzenie'
  ).length;

  const activeOrdersCount = orders.filter(o => 
    o.locationId === activeLocationId && 
    !['Dostarczone', 'Anulowane', 'Szkic'].includes(o.status)
  ).length;

  const activeQuotation = quotations.find(q => q.status === 'Oczekująca');

  // Filter unread notifications
  const unreadNotifications = notifications.filter(n => !n.isRead).slice(0, 3);

  return (
    <div className="space-y-6">
      
      {/* Upper banner: Greeting & Location Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-[#2A3B4C] rounded-2xl shadow-sm relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] uppercase font-bold text-gray-300 tracking-wider font-mono">Dostęp VMI Aktywny</span>
          </div>
          <h2 className="text-xl font-bold font-display text-white">Witaj, Michał Stępień</h2>
          <p className="text-xs text-gray-300">
            Firma: <strong className="text-white">AutoService Komorniki</strong> • Rola: <span className="text-blue-200 font-semibold">Kierownik Oddziału</span>
          </p>
        </div>

        {/* Location selector */}
        <div className="flex items-center gap-2.5 shrink-0 relative z-10 bg-[#1E2B38] p-2 rounded-xl">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-300">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wide">Aktywny oddział</label>
            <select
              value={activeLocationId}
              onChange={(e) => setActiveLocationId(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none pr-6 cursor-pointer"
            >
              {locations.map(loc => (
                <option key={loc.id} value={loc.id} className="bg-[#2A3B4C] text-white">
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Metric 1 */}
        <div 
          onClick={() => onNavigateTab('vendors')}
          className="bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-[#111728] rounded-xl p-4 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Dostawcy</span>
            <Layers className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-[#2A3B4C] dark:text-white font-mono">{vendors.length}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold font-sans">aktywne</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div 
          onClick={() => onNavigateTab('inventory')}
          className="bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-[#111728] rounded-xl p-4 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Monitowane</span>
            <Package className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-[#2A3B4C] dark:text-white font-mono">{monitoredCount}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">pozycji</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div 
          onClick={() => onNavigateTab('inventory')}
          className="bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-[#111728] rounded-xl p-4 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Niski stan</span>
            <AlertTriangle className={cn("h-4 w-4", lowStockCount > 0 ? "text-red-500 animate-pulse" : "text-gray-400 dark:text-gray-500")} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={cn("text-xl font-bold font-mono", lowStockCount > 0 ? "text-red-500 dark:text-red-400" : "text-[#2A3B4C] dark:text-white")}>
              {lowStockCount}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">do uzupełnienia</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div 
          className="bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-[#111728] rounded-xl p-4 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Dostawy VMI</span>
            <FileCheck className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={cn("text-xl font-bold font-mono", pendingProposalsCount > 0 ? "text-blue-600 dark:text-blue-400" : "text-[#2A3B4C] dark:text-white")}>
              {pendingProposalsCount}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">propozycje</span>
          </div>
        </div>

        {/* Metric 5 */}
        <div 
          onClick={() => onNavigateTab('orders')}
          className="bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-[#111728] rounded-xl p-4 transition-all cursor-pointer group col-span-2 lg:col-span-1 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">W realizacji</span>
            <Truck className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-[#2A3B4C] dark:text-white font-mono">{activeOrdersCount}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">zamówień</span>
          </div>
        </div>
      </div>

      {/* TWO COLUMN MASTER LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: ATTENTION REQUIRED (Span 7) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold font-display text-xs uppercase tracking-wider text-gray-500 dark:text-gray-450 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span>Wymaga uwagi (Pilne akcje)</span>
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-bold">
              Krytyczne
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            
            {/* 1. Low chemical stocks */}
            {lowStockCount > 0 && (
              <div 
                onClick={() => onNavigateTab('inventory')}
                className="bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-[#111728] rounded-xl p-3.5 transition-all flex items-start justify-between gap-3 cursor-pointer shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/25 text-red-600 dark:text-red-400 shrink-0 mt-0.5">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#1A1C1E] dark:text-white">Niski zapas chemii i części</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      W lokalizacji <span className="text-[#1A1C1E] dark:text-gray-250 font-semibold">{activeLocation?.name}</span> wykryto <strong className="text-red-500 dark:text-red-400">{lowStockCount} produktów</strong> poniżej bezpiecznego poziomu VMI.
                    </p>
                    <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded uppercase font-mono mt-2 inline-block font-bold">
                      CleanChem / AutoParts
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-550 mt-2" />
              </div>
            )}

            {/* 2. AutoParts replenishment proposal */}
            {proposals.find(p => p.vendorId === 'v-1' && p.status === 'Oczekuje na zatwierdzenie') && (
              <div 
                onClick={() => onOpenProposal('rp-1')}
                className="bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-[#111728] rounded-xl p-3.5 transition-all flex items-start justify-between gap-3 cursor-pointer shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/25 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#1A1C1E] dark:text-white">Propozycja uzupełnienia AutoParts Pro</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      Nowa kalkulacja dostawy klocków i filtrów <strong className="text-[#1A1C1E] dark:text-gray-250">PROP-V1-202607-003</strong> czeka na Twoje zatwierdzenie.
                    </p>
                    <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded uppercase font-mono mt-2 inline-block font-bold">
                      Wygasa za 2 dni
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-550 mt-2" />
              </div>
            )}

            {/* 3. SafetyCore quote */}
            {activeQuotation && (
              <div 
                onClick={() => onOpenQuotation('q-1')}
                className="bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-[#111728] rounded-xl p-3.5 transition-all flex items-start justify-between gap-3 cursor-pointer shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/25 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <Percent className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#1A1C1E] dark:text-white">Wycena specjalna SafetyCore BHP</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      Dedykowana oferta na buty i spodnie robocze <strong className="text-[#1A1C1E] dark:text-gray-250">OFE-202607-0841</strong> ze specjalnym rabatem partnera wygaśnie niedługo.
                    </p>
                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded uppercase font-mono mt-2 inline-block font-bold">
                      Ważna do 16 lipca (3 dni!)
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-550 mt-2" />
              </div>
            )}

            {/* 4. WerkTools Order Partially Confirmed */}
            {orders.find(o => o.id === 'o-2') && (
              <div 
                onClick={() => onOpenOrder('o-2')}
                className="bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-[#111728] rounded-xl p-3.5 transition-all flex items-start justify-between gap-3 cursor-pointer shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/25 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#1A1C1E] dark:text-white">Zamówienie WerkTools częściowo potwierdzone</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      Brak suwmiarki Mitutoyo na magazynie. Kliknij, aby przejść do czatu i zaakceptować wysyłkę częściową lub dobrać zamiennik.
                    </p>
                    <span className="text-[9px] px-1.5 py-0.5 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 rounded uppercase font-mono mt-2 inline-block font-bold">
                      Wymaga kontaktu
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-550 mt-2" />
              </div>
            )}

            {/* 5. Stock count requested */}
            <div 
              onClick={onOpenStockCount}
              className="bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-[#111728] rounded-xl p-3.5 transition-all flex items-start justify-between gap-3 cursor-pointer shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/25 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#1A1C1E] dark:text-white">Zlecone inwentaryzacje VMI</h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    Dostawca AutoParts Pro prosi o aktualizację stanu klocków i tarczy w celu optymalizacji kolejnych dostaw.
                  </p>
                  <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 rounded uppercase font-mono mt-2 inline-block font-bold">
                    Inwentaryzacja VMI
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-550 mt-2" />
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: RECENT NOTIFICATIONS & ACTIVITIES (Span 5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Notifications Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold font-display text-xs uppercase tracking-wider text-gray-500 dark:text-gray-450 flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-500" />
                <span>Ostatnie powiadomienia</span>
              </h3>
              <button 
                onClick={() => onNavigateTab('settings')} 
                className="text-xs text-[#2A3B4C] dark:text-blue-400 hover:underline font-bold transition-colors cursor-pointer"
              >
                Pokaż wszystkie
              </button>
            </div>

            <div className="bg-white dark:bg-[#0E1321] rounded-xl shadow-sm divide-y divide-[#E1E3E6] dark:divide-gray-850">
              {unreadNotifications.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">
                  Brak nieprzeczytanych powiadomień.
                </div>
              ) : (
                unreadNotifications.map(notif => {
                  let badgeColor = "bg-blue-600";
                  if (notif.type === 'Low-stock warning') badgeColor = "bg-red-500";
                  if (notif.type === 'Quotation expiring') badgeColor = "bg-amber-500";
                  if (notif.type === 'New vendor message') badgeColor = "bg-indigo-500";

                  return (
                    <div key={notif.id} className="p-3.5 space-y-1 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", badgeColor)} />
                          <span className="font-bold text-[11px] text-gray-800 dark:text-white truncate">{notif.title}</span>
                        </div>
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 font-mono shrink-0">{notif.date.split(' ')[1]}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal line-clamp-2">
                        {notif.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick stats / Activity */}
          <div className="space-y-4">
            <h3 className="font-bold font-display text-xs uppercase tracking-wider text-gray-500 dark:text-gray-450 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span>Ostatnia aktywność VMI</span>
            </h3>

            <div className="bg-white dark:bg-[#0E1321] shadow-sm rounded-xl p-4 space-y-4 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex gap-3">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-1.5" />
                <div className="space-y-0.5">
                  <p className="text-[#1A1C1E] dark:text-white font-medium">Uruchomiono inwentaryzację (Komorniki)</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-550">Przed chwilą przez Michał Stępień</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0 mt-1.5" />
                <div className="space-y-0.5">
                  <p className="text-[#1A1C1E] dark:text-white font-medium">Dostarczono zamówienie ZAM-202607-9520</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-550">Wczoraj, 10:30 • CleanChem</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0 mt-1.5" />
                <div className="space-y-0.5">
                  <p className="text-[#1A1C1E] dark:text-white font-medium">Wygenerowano nową propozycję uzupełnienia</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-550">12 lipca, 10:15 • AutoParts Pro</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 3. B2B MARKETPLACE ACTIVITY SECTION */}
      <div className="bg-white dark:bg-[#0E1321] rounded-2xl p-6 shadow-sm shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6 text-xs text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-base font-black font-display uppercase tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Twoja aktywność w Marketplace B2B</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Przeglądaj swoje zapytania ofertowe, pytania do dostawców oraz zapisane produkty i firmy z katalogu publicznego.
            </p>
          </div>
          
          <button
            onClick={() => onNavigateTab('marketplace')}
            className="self-start sm:self-center py-2 px-4 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold text-xs uppercase tracking-wide rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Otwórz Marketplace</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-50 dark:border-gray-850 pb-3">
          {[
            { id: 'rfqs', name: `Zapytania ofertowe (${rfqs.length})`, icon: FileText },
            { id: 'questions', name: `Wysłane pytania (${questions.length})`, icon: MessageSquare },
            { id: 'products', name: `Ulubione produkty (${favoriteProducts.length})`, icon: Heart },
            { id: 'vendors', name: `Ulubieni dostawcy (${favoriteVendors.length})`, icon: Layers }
          ].map(tab => {
            const IconComponent = tab.icon;
            const isActive = activeMarketplaceTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMarketplaceTab(tab.id as any)}
                className={cn(
                  "py-2 px-3.5 rounded-xl font-bold text-xs uppercase transition-all flex items-center gap-1.5 cursor-pointer",
                  isActive 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850"
                )}
              >
                <IconComponent className="h-3.5 w-3.5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels */}
        <div className="min-h-40 text-xs">
          {activeMarketplaceTab === 'rfqs' && (
            <div className="space-y-3">
              {rfqs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 text-gray-400">
                  <FileText className="h-10 w-10 text-gray-300 dark:text-gray-700" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-xs text-gray-700 dark:text-gray-350">Brak wysłanych zapytań ofertowych</p>
                    <p className="text-[10px] text-gray-400">Dodaj wybrane towary dostawców do zapytania w Marketplace i wyślij je w kilka chwil.</p>
                  </div>
                  <button 
                    onClick={() => onNavigateTab('marketplace')}
                    className="py-1.5 px-4 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    Szukaj produktów i stwórz RFQ
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rfqs.map(rfq => {
                    const vendor = publicMockVendors.find(v => v.id === rfq.vendorId);
                    return (
                      <div 
                        key={rfq.id} 
                        className="bg-gray-50/50 dark:bg-gray-950/20 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-black text-blue-600 dark:text-blue-400">
                              {rfq.enquiryNumber}
                            </span>
                            <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                              {rfq.status}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-extrabold text-xs text-gray-900 dark:text-white">
                              Zapytanie do: {vendor?.name || 'Zweryfikowany Dystrybutor'}
                            </h4>
                            <p className="text-[10px] text-gray-400">Wysłano dnia: {rfq.date} • Wybrany kontakt: {rfq.contactPreference}</p>
                          </div>
                          
                          <div className="bg-white dark:bg-gray-900/60 p-2.5 rounded-lg border border-gray-100 dark:border-gray-850">
                            <p className="text-[10px] font-extrabold text-gray-600 dark:text-gray-400 mb-1 font-sans">Pozycje asortymentowe ({rfq.items.length}):</p>
                            <div className="space-y-1 max-h-24 overflow-y-auto">
                              {rfq.items.map((line: any, idx: number) => {
                                const prod = publicMockProducts.find(p => p.id === line.productId);
                                return (
                                  <div key={idx} className="flex justify-between text-[10px] text-gray-500">
                                    <span className="truncate max-w-[70%] font-medium">{prod?.name || 'Produkt'}</span>
                                    <span className="font-bold shrink-0">{line.quantity} {line.unit}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 flex justify-end">
                          <button
                            onClick={() => onNavigateToMarketplace?.('/zapytanie-ofertowe')}
                            className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>Otwórz podgląd RFQ</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeMarketplaceTab === 'questions' && (
            <div className="space-y-3 text-xs text-left">
              {questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 text-gray-400">
                  <MessageSquare className="h-10 w-10 text-gray-300 dark:text-gray-700" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-xs text-gray-700 dark:text-gray-350">Brak wysłanych pytań lub zgłoszeń</p>
                    <p className="text-[10px] text-gray-400">Wyślij zapytanie handlowe z poziomu profilu dowolnego dostawcy, aby nawiązać współpracę.</p>
                  </div>
                  <button 
                    onClick={() => onNavigateTab('marketplace')}
                    className="py-1.5 px-4 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    Przeglądaj Dostawców
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((quest, index) => {
                    const vendor = publicMockVendors.find(v => v.id === quest.vendorId);
                    return (
                      <div 
                        key={quest.id || index} 
                        className="bg-gray-50/50 dark:bg-gray-950/20 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5 text-left">
                            <h4 className="font-extrabold text-xs text-gray-900 dark:text-white">
                              Zapytanie o współpracę do: {quest.vendorName || vendor?.name}
                            </h4>
                            <p className="text-[10px] text-gray-400">Niewiążący kontakt B2B • Wysłano: {quest.date}</p>
                          </div>
                          <span className={cn(
                            "text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider",
                            quest.urgency === 'Wysoki' ? "bg-red-50 dark:bg-red-950/25 text-red-600 dark:text-red-400" :
                            quest.urgency === 'Średni' ? "bg-amber-50 dark:bg-amber-950/25 text-amber-600 dark:text-amber-400" :
                            "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                          )}>
                            Pilność: {quest.urgency}
                          </span>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-900/60 p-3 rounded-lg border border-gray-100 dark:border-gray-850 text-left">
                          <p className="text-[11px] italic text-gray-600 dark:text-gray-400 leading-relaxed font-sans font-semibold">
                            &quot;{quest.message}&quot;
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between text-[10px] text-gray-400">
                          <p>Osoba kontaktowa: <strong>{quest.name}</strong> ({quest.email})</p>
                          {vendor && (
                            <button
                              onClick={() => onNavigateToMarketplace?.(`/dostawcy/${vendor.slug}`)}
                              className="text-blue-600 dark:text-blue-400 font-extrabold hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>Otwórz profil dostawcy</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeMarketplaceTab === 'products' && (
            <div>
              {favoriteProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 text-gray-400">
                  <Heart className="h-10 w-10 text-gray-300 dark:text-gray-700" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-xs text-gray-700 dark:text-gray-350">Brak ulubionych produktów</p>
                    <p className="text-[10px] text-gray-400">Kliknij ikonę serca na dowolnej karcie produktu w Marketplace, aby dodać go do szybkiej listy.</p>
                  </div>
                  <button 
                    onClick={() => onNavigateTab('marketplace')}
                    className="py-1.5 px-4 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    Otwórz katalog produktów
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {favoriteProducts.map(prod => {
                    if (!prod) return null;
                    const vendor = publicMockVendors.find(v => v.id === prod.vendorId);
                    return (
                      <div 
                        key={prod.id} 
                        className="bg-gray-50/50 dark:bg-gray-950/20 rounded-xl p-3.5 hover:shadow-sm transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-2.5">
                          <div className="aspect-video relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-950">
                            <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                            <div className="absolute top-2 left-2 bg-white/90 dark:bg-gray-900/95 px-2 py-0.5 rounded text-[9px] font-black text-gray-500 font-mono">
                              SKU: {prod.sku}
                            </div>
                          </div>
                          
                          <div className="space-y-1 text-left">
                            <span className="text-[9px] font-black tracking-widest text-blue-600 dark:text-blue-400 uppercase font-mono">
                              {prod.brand}
                            </span>
                            <h4 className="font-extrabold text-xs text-gray-900 dark:text-white line-clamp-1">
                              {prod.name}
                            </h4>
                            <p className="text-[10px] text-gray-400">Dostawca: {vendor?.name}</p>
                          </div>
                        </div>

                        <div className="pt-3.5 border-t border-gray-100 dark:border-gray-850/50 mt-3 flex items-center justify-between">
                          <span className="text-[10px] font-mono font-black text-gray-700 dark:text-gray-300">
                            {prod.priceValue ? `${prod.priceValue} PLN / {prod.unit}` : 'Zapytaj o cenę'}
                          </span>
                          
                          <button
                            onClick={() => onNavigateToMarketplace?.(`/produkty/${prod.slug}`)}
                            className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>Szczegóły</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeMarketplaceTab === 'vendors' && (
            <div>
              {favoriteVendors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 text-gray-400">
                  <Layers className="h-10 w-10 text-gray-300 dark:text-gray-700" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-xs text-gray-700 dark:text-gray-350">Brak zapisanych dostawców</p>
                    <p className="text-[10px] text-gray-400">Oznacz sercem wybrane hurtownie regionalne w wyszukiwarce B2B, by mieć do nich natychmiastowy dostęp.</p>
                  </div>
                  <button 
                    onClick={() => onNavigateTab('marketplace')}
                    className="py-1.5 px-4 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    Wyszukaj Dostawców
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {favoriteVendors.map(vend => {
                    if (!vend) return null;
                    return (
                      <div 
                        key={vend.id} 
                        className="bg-gray-50/50 dark:bg-gray-950/20 rounded-xl p-3.5 hover:shadow-sm transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-sm border border-gray-100 dark:border-gray-850 shrink-0">
                              <img src={vend.logoUrl} alt={vend.name} className="w-full h-full object-contain rounded-lg" />
                            </div>
                            <div className="text-left min-w-0">
                              <h4 className="font-extrabold text-xs text-gray-900 dark:text-white truncate">
                                {vend.name}
                              </h4>
                              <p className="text-[10px] text-gray-400">{vend.city} • {vend.distanceKm} km</p>
                            </div>
                          </div>
                          
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed text-left">
                            {vend.shortDescription}
                          </p>
                        </div>

                        <div className="pt-3.5 border-t border-gray-100 dark:border-gray-850/50 mt-3 flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase text-gray-400 font-sans">
                            {vend.category}
                          </span>
                          
                          <button
                            onClick={() => onNavigateToMarketplace?.(`/dostawcy/${vend.slug}`)}
                            className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>Otwórz Profil</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
