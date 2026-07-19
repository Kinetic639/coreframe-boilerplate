'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowRight, 
  Calendar, 
  Check, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  FileText, 
  HelpCircle, 
  Info, 
  Layers, 
  MessageSquare, 
  Package, 
  Search, 
  ShoppingBag, 
  Trash2, 
  X, 
  Building2, 
  Sparkles, 
  AlertCircle 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Quotation, Order, Product, Vendor, ClientLocation, OrderLine } from '../lib/types';

interface OffersViewProps {
  quotations: Quotation[];
  onUpdateQuotations: (newQuotations: Quotation[]) => void;
  orders: Order[];
  onUpdateOrders: (newOrders: Order[]) => void;
  products: Product[];
  vendors: Vendor[];
  locations: ClientLocation[];
  activeLocationId: string;
  onOpenChat: (vendorId: string, subject: string, objectType: 'quotation' | 'product' | 'none', objectId: string) => void;
  triggerNotification: (title: string, content: string, type: string) => void;
  onNavigateToMarketplace?: (path: string) => void;
}

export default function OffersView({
  quotations,
  onUpdateQuotations,
  orders,
  onUpdateOrders,
  products,
  vendors,
  locations,
  activeLocationId,
  onOpenChat,
  triggerNotification,
  onNavigateToMarketplace
}: OffersViewProps) {
  const [activeTab, setActiveTab] = useState<'quotations' | 'rfqs'>('quotations');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);

  // RFQ States loaded from local storage
  const [rfqBasket, setRfqBasket] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedBasket = localStorage.getItem('ambra-marketplace-enquiry');
        return storedBasket ? JSON.parse(storedBasket) : [];
      } catch (e) {
        console.error('Error loading RFQ basket', e);
      }
    }
    return [];
  });

  const [submittedRfqs, setSubmittedRfqs] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedRfqs = localStorage.getItem('ambra-marketplace-rfqs');
        return storedRfqs ? JSON.parse(storedRfqs) : [];
      } catch (e) {
        console.error('Error loading RFQs', e);
      }
    }
    return [];
  });

  const [drafts, setDrafts] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    const foundDrafts: any[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ambra-marketplace-request-draft-')) {
          const draft = JSON.parse(localStorage.getItem(key) || '');
          if (draft && draft.items && draft.items.length > 0) {
            foundDrafts.push(draft);
          }
        }
      }
    } catch (e) {}
    return foundDrafts;
  });

  // Function to load drafts and RFQs
  const loadDraftsAndRfqs = () => {
    if (typeof window === 'undefined') return;
    
    // Load drafts from all vendor keys
    const foundDrafts: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ambra-marketplace-request-draft-')) {
        try {
          const draft = JSON.parse(localStorage.getItem(key) || '');
          if (draft && draft.items && draft.items.length > 0) {
            foundDrafts.push(draft);
          }
        } catch (e) {}
      }
    }
    setDrafts(foundDrafts);

    // Sync RFQs
    const storedRfqs = localStorage.getItem('ambra-marketplace-rfqs');
    if (storedRfqs) {
      try {
        setSubmittedRfqs(JSON.parse(storedRfqs));
      } catch (e) {}
    }

    // Sync basket
    const storedBasket = localStorage.getItem('ambra-marketplace-enquiry');
    if (storedBasket) {
      try {
        setRfqBasket(JSON.parse(storedBasket));
      } catch (e) {}
    }
  };

  useEffect(() => {
    window.addEventListener('storage', loadDraftsAndRfqs);
    return () => window.removeEventListener('storage', loadDraftsAndRfqs);
  }, []);

  // Save RFQ basket helper
  const saveRfqBasket = (newBasket: any[]) => {
    setRfqBasket(newBasket);
    localStorage.setItem('ambra-marketplace-enquiry', JSON.stringify(newBasket));
    window.dispatchEvent(new Event('storage'));
  };

  // Save submitted RFQs helper
  const saveSubmittedRfqs = (newRfqs: any[]) => {
    setSubmittedRfqs(newRfqs);
    localStorage.setItem('ambra-marketplace-rfqs', JSON.stringify(newRfqs));
    window.dispatchEvent(new Event('storage'));
  };

  const getProduct = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  const getVendor = (vendorId: string) => {
    return vendors.find(v => v.id === vendorId);
  };

  // Dynamify responded RFQs to Quotations
  const dynamicQuotations = useMemo(() => {
    return submittedRfqs
      .filter((rfq: any) => rfq.status === 'Odpowiedziane')
      .map((rfq: any) => {
        const rfqLines = rfq.responseItems ? rfq.responseItems.map((item: any) => {
          const originalProd = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            qty: item.availableQty || item.quantity,
            originalPrice: originalProd?.price || 50,
            offeredPrice: item.offeredPrice || (originalProd?.price || 50) * 0.88,
            decision: item.decision || 'accepted',
            comment: item.comment || '',
            substituteProductId: item.substituteProductId || '',
            substituteProductName: item.substituteProductName || ''
          };
        }) : rfq.items.map((item: any) => {
          const originalProd = products.find(p => p.id === item.productId);
          const basePrice = originalProd?.price || 50;
          return {
            productId: item.productId,
            qty: item.quantity,
            originalPrice: basePrice,
            offeredPrice: basePrice * 0.88,
            decision: 'accepted',
            comment: ''
          };
        });

        // Calculate total value
        const totalValue = rfqLines.reduce((acc: number, line: any) => acc + (line.offeredPrice * line.qty), 0);

        return {
          id: rfq.id,
          vendorId: rfq.vendorId,
          status: 'Oczekująca' as const, // Treat as pending in UI so user can accept/order it
          quotationNumber: rfq.enquiryNumber,
          validTo: new Date(new Date(rfq.date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          lines: rfqLines,
          deliveryConditions: 'Dostawa darmowa (VMI Express)',
          notes: rfq.responseComment || 'Wycena przygotowana na podstawie zapytania RFQ.',
          totalValue,
          isFromRfq: true
        };
      });
  }, [submittedRfqs, products]);

  // Merge static and dynamic quotations
  const allQuotations = useMemo(() => {
    const resolvedDynamic = dynamicQuotations.map((dq: any) => {
      const realRfq = submittedRfqs.find((r: any) => r.id === dq.id);
      if (realRfq && (realRfq.status === 'Zaakceptowana' || realRfq.status === 'Przekształcona w zamówienie')) {
        return {
          ...dq,
          status: 'Zaakceptowana' as const
        };
      }
      return dq;
    });
    return [...resolvedDynamic, ...quotations];
  }, [dynamicQuotations, quotations, submittedRfqs]);

  // Filter VMI Quotations for active location or vendor
  const activeLocationQuotations = useMemo(() => {
    return allQuotations;
  }, [allQuotations]);

  // Convert Quotation to real VMI Order
  const handleAcceptQuotation = (quotation: Quotation) => {
    const orderNumber = `ZAM-OFE-${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Create new order lines from quotation lines
    const orderLines: OrderLine[] = quotation.lines.map(line => ({
      productId: line.productId,
      requestedQty: line.qty,
      confirmedQty: line.qty,
      shippedQty: 0,
      deliveredQty: 0,
      price: line.offeredPrice
    }));

    const newOrder: Order = {
      id: `o-loc-${Date.now()}`,
      vendorId: quotation.vendorId,
      locationId: activeLocationId,
      orderNumber: orderNumber,
      date: new Date().toISOString().substring(0, 10),
      requestedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10), // 3 days lead
      confirmedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      origin: 'Zaakceptowana oferta',
      status: 'Wysłane',
      lines: orderLines,
      poReference: `OFE-${quotation.quotationNumber}`,
      hasAttachment: false,
      notes: `Zamówienie wygenerowane z zaakceptowanej oferty handlowej ${quotation.quotationNumber}. Warunki dostawy: ${quotation.deliveryConditions}`,
      timeline: [
        { status: 'Szkic', date: new Date().toISOString().substring(0, 16).replace('T', ' '), description: 'Utworzono automatycznie z oferty handlowej.' },
        { status: 'Wysłane', date: new Date().toISOString().substring(0, 16).replace('T', ' '), description: 'Zaakceptowano wycenę i przesłano zamówienie do realizacji.' }
      ]
    };

    // If it is a dynamic RFQ quotation
    if ((quotation as any).isFromRfq) {
      const nextRfqs = submittedRfqs.map(r => r.id === quotation.id ? { ...r, status: 'Zaakceptowana' } : r);
      saveSubmittedRfqs(nextRfqs);
    } else {
      // Update quotation status for static ones
      const updatedQuotations = quotations.map(q => {
        if (q.id === quotation.id) {
          return { ...q, status: 'Zaakceptowana' as const };
        }
        return q;
      });
      onUpdateQuotations(updatedQuotations);
    }

    // Save order
    const nextOrders = [newOrder, ...orders];
    onUpdateOrders(nextOrders);

    // Close view details
    setSelectedQuotationId(null);

    // Trigger notification
    triggerNotification(
      'Zaakceptowano ofertę',
      `Oferta ${quotation.quotationNumber} została pomyślnie zaakceptowana i przekształcona w zamówienie ${orderNumber}.`,
      'success'
    );
  };

  const handleTriggerSimulation = (rfqId: string) => {
    const targetRfq = submittedRfqs.find(r => r.id === rfqId);
    if (!targetRfq) return;
    
    // Build position-by-position response
    const responseItems = targetRfq.items.map((item: any, idx: number) => {
      const prod = products.find(p => p.id === item.productId);
      const basePrice = prod?.price || 50;
      const offeredPrice = basePrice * 0.88; // 12% discount
      
      let decision = 'accepted';
      let comment = 'Dostępne na magazynie, cena z rabatem handlowym.';
      let substituteProductId = '';
      let substituteProductName = '';
      
      if (item.allowSubstitutes && idx === 1) {
        decision = 'substitute';
        const sibling = products.find(p => p.vendorId === targetRfq.vendorId && p.id !== item.productId);
        if (sibling) {
          substituteProductId = sibling.id;
          substituteProductName = sibling.name;
          comment = `Brak podstawowej wersji. Proponujemy zamiennik premium: ${sibling.name} w specjalnej cenie.`;
        } else {
          substituteProductId = 'sub-sim-1';
          substituteProductName = 'Zamiennik Premium (Sugerowany)';
          comment = 'Brak towaru. Proponujemy zamiennik o tożsamych parametrach.';
        }
      }
      
      return {
        productId: item.productId,
        decision,
        availableQty: item.quantity,
        offeredPrice: parseFloat(offeredPrice.toFixed(2)),
        comment,
        substituteProductId,
        substituteProductName
      };
    });
    
    const updatedRfq = {
      ...targetRfq,
      status: 'Odpowiedziane',
      responseComment: 'Wycena przygotowana. Udzieliliśmy dodatkowego rabatu 12% na wszystkie pozycje z zapytania. Dostawa darmowa, realizacja w 24h od potwierdzenia zamówienia.',
      responseDate: new Date().toISOString().split('T')[0],
      responseItems
    };
    
    const nextRfqs = submittedRfqs.map(r => r.id === rfqId ? updatedRfq : r);
    saveSubmittedRfqs(nextRfqs);
    triggerNotification('Otrzymano odpowiedź!', `Dostawca przesłał kompletną wycenę dla zapytania ${targetRfq.enquiryNumber}.`, 'success');
  };

  const selectedQuotation = allQuotations.find(q => q.id === selectedQuotationId);
  const selectedQuotationVendor = selectedQuotation ? getVendor(selectedQuotation.vendorId) : null;

  return (
    <div className="space-y-6 text-left">
      
      {/* Title block */}
      <div>
        <h2 className="text-xl font-black text-gray-950 dark:text-white font-display uppercase tracking-tight">Oferty i zapytania</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Zarządzaj otrzymanymi wycenami handlowymi od stałych dostawców oraz składaj nowe zapytania ofertowe (RFQ).
        </p>
      </div>

      {/* Tabs list switch */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 pb-px">
        <button
          onClick={() => { setActiveTab('quotations'); setSelectedQuotationId(null); }}
          className={cn(
            "py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer",
            activeTab === 'quotations'
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-gray-450 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          Otrzymane oferty i wyceny ({activeLocationQuotations.length})
        </button>
        <button
          onClick={() => { setActiveTab('rfqs'); setSelectedQuotationId(null); }}
          className={cn(
            "py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer",
            activeTab === 'rfqs'
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-gray-450 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          Twoje Zapytania RFQ ({submittedRfqs.length + (rfqBasket.length > 0 ? 1 : 0)})
        </button>
      </div>

      {activeTab === 'quotations' && (
        <div className="space-y-6">
          {!selectedQuotationId ? (
            // LIST VIEW
            activeLocationQuotations.length === 0 ? (
              <div className="bg-white dark:bg-[#0E1321] rounded-2xl py-12 px-4 text-center max-w-lg mx-auto space-y-4 shadow-sm">
                <FileText className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Brak ofert handlowych</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Gdy dostawcy prześlą dedykowane warunki cenowe lub wyceny specjalne, pojawią się one w tym miejscu z opcją natychmiastowego zamówienia.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeLocationQuotations.map(quot => {
                  const vendor = getVendor(quot.vendorId);
                  const totalItems = quot.lines.length;
                  const totalValue = (quot as any).totalValue || quot.lines.reduce((acc: number, line: any) => acc + (line.offeredPrice * line.qty), 0);

                  let statusBadge = 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400';
                  if (quot.status === 'Zaakceptowana' || quot.status === 'Przekształcona w zamówienie') {
                    statusBadge = 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
                  } else if (quot.status === 'Odrzucona') {
                    statusBadge = 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400';
                  } else if (quot.status === 'Wymaga zmian') {
                    statusBadge = 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400';
                  }

                  return (
                    <div 
                      key={quot.id}
                      className="bg-white dark:bg-[#0E1321] border border-gray-150 dark:border-gray-850 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-black text-blue-600 dark:text-blue-400 uppercase">
                            {quot.quotationNumber}
                          </span>
                          <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide", statusBadge)}>
                            {quot.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {vendor?.logoUrl ? (
                            <img src={vendor.logoUrl} alt={vendor.name} className="w-8 h-8 rounded-lg object-cover bg-gray-50 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-xs shrink-0">
                              {vendor?.name?.charAt(0) || 'D'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate">{vendor?.name || 'Dostawca'}</h4>
                            <p className="text-[10px] text-gray-450">Wycena asortymentowa</p>
                          </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-950/40 p-2.5 rounded-lg text-[10px] space-y-1.5 font-sans">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Liczba pozycji:</span>
                            <span className="font-bold">{totalItems}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400 font-medium">Ważność oferty do:</span>
                            <span className="font-bold font-mono text-gray-700 dark:text-gray-300">{quot.validTo}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <div className="text-left">
                          <p className="text-[9px] text-gray-450 uppercase font-semibold">Suma oferty</p>
                          <p className="text-xs font-black text-gray-900 dark:text-white font-mono">
                            {totalValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedQuotationId(quot.id)}
                          className="py-1.5 px-3 bg-[#2A3B4C] hover:bg-[#1E2B38] dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>Szczegóły</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            // DETAIL VIEW
            selectedQuotation && (
              <div className="bg-white dark:bg-[#0E1321] border border-gray-150 dark:border-gray-850 rounded-2xl p-6 shadow-sm space-y-6">
                {/* Detail header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-850 pb-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setSelectedQuotationId(null)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400">
                          OFERTA {selectedQuotation.quotationNumber}
                        </span>
                        <span className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                          {selectedQuotation.status}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
                        Wycena od {selectedQuotationVendor?.name}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenChat(selectedQuotation.vendorId, `Pytanie dot. oferty ${selectedQuotation.quotationNumber}`, 'quotation', selectedQuotation.id)}
                      className="py-2 px-3.5 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850 font-bold text-[11px] uppercase tracking-wide rounded-xl flex items-center gap-1.5 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                      <span>Zapytaj dostawcę</span>
                    </button>

                    {selectedQuotation.status === 'Oczekująca' && (
                      <button
                        onClick={() => handleAcceptQuotation(selectedQuotation)}
                        className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white font-extrabold text-[11px] uppercase tracking-wide rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Akceptuj i Zamów</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Info block columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-950/40 p-4 rounded-xl text-xs font-sans">
                  <div className="space-y-1">
                    <p className="text-gray-400">Warunki dostawy:</p>
                    <p className="font-bold text-gray-800 dark:text-gray-200">{selectedQuotation.deliveryConditions}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400">Termin ważności oferty:</p>
                    <p className="font-bold text-gray-800 dark:text-gray-200">{selectedQuotation.validTo}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400">Suma netto wyceny:</p>
                    <p className="font-bold text-blue-600 dark:text-blue-400">{selectedQuotation.totalValue.toFixed(2)} PLN</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">Pozycje wycenione ({selectedQuotation.lines.length})</h4>
                  
                  <div className="overflow-x-auto border border-gray-100 dark:border-gray-850 rounded-xl divide-y divide-gray-100 dark:divide-gray-850/60 font-sans">
                    {selectedQuotation.lines.map((line: any, idx: number) => {
                      const prod = getProduct(line.productId);
                      const isSubstitute = (line as any).decision === 'substitute';
                      const subName = (line as any).substituteProductName;
                      const lineComment = (line as any).comment;

                      const originalTotal = line.originalPrice * line.qty;
                      const offeredTotal = line.offeredPrice * line.qty;
                      const savings = originalTotal - offeredTotal;

                      return (
                        <div key={idx} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition-colors text-xs">
                          <div className="flex gap-3 min-w-0 w-full sm:w-auto">
                            {prod?.imageUrl ? (
                              <img src={prod.imageUrl} alt={prod.name} className="w-10 h-10 rounded-lg object-cover bg-gray-50 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-xs text-gray-400 shrink-0">
                                <Package className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0 text-left flex-1">
                              <h5 className="font-bold text-gray-900 dark:text-white truncate">{prod?.name || 'Produkt'}</h5>
                              <p className="text-[10px] text-gray-400 font-mono">SKU: {prod?.vendorSku || 'BRAK'} • Jedn: {prod?.unitOfMeasure || 'szt.'}</p>
                              
                              {isSubstitute && subName && (
                                <div className="mt-1.5 p-2 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl text-[10px] text-amber-800 dark:text-amber-400 font-sans">
                                  <span className="font-black uppercase text-[8px] tracking-wider bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-md mr-1.5">Zamiennik sugerowany przez dostawcę</span>
                                  <p className="font-bold mt-1 text-gray-800 dark:text-gray-200">{subName}</p>
                                  {lineComment && <p className="text-[9px] text-gray-500 dark:text-gray-450 mt-1 italic">„{lineComment}”</p>}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-6 sm:gap-10 font-mono self-stretch sm:self-auto justify-between sm:justify-start">
                            <div className="text-center">
                              <p className="text-[9px] text-gray-400 font-sans">Ilość</p>
                              <p className="font-bold text-gray-800 dark:text-gray-200">{line.qty}</p>
                            </div>

                            <div className="text-center">
                              <p className="text-[9px] text-gray-400 font-sans">Cena katalogowa</p>
                              <p className="text-gray-400 line-through">{line.originalPrice.toFixed(2)} PLN</p>
                            </div>

                            <div className="text-center">
                              <p className="text-[9px] text-blue-600 font-sans font-bold">Cena oferty</p>
                              <p className="font-bold text-blue-600 dark:text-blue-400">{line.offeredPrice.toFixed(2)} PLN</p>
                            </div>

                            <div className="text-right">
                              <p className="text-[9px] text-gray-400 font-sans">Suma netto</p>
                              <p className="font-black text-gray-900 dark:text-white">{offeredTotal.toFixed(2)} PLN</p>
                              {savings > 0 && (
                                <p className="text-[9px] text-emerald-500 font-bold font-sans">Oszczędność: -{savings.toFixed(2)} PLN</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Additional notes */}
                {selectedQuotation.notes && (
                  <div className="p-3.5 bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/20 rounded-xl flex gap-3 text-xs text-gray-600 dark:text-gray-400 font-sans">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Uwagi dostawcy:</p>
                      <p className="mt-0.5 leading-relaxed">{selectedQuotation.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {activeTab === 'rfqs' && (
        <div className="space-y-8 font-sans">
          
          {/* Section 1: Active Drafts */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Szkice i przygotowywane zapytania ({drafts.length})</span>
            </h3>
            
            {drafts.length === 0 ? (
              <div className="bg-gray-50/50 dark:bg-gray-950/20 rounded-2xl p-6 text-center border border-dashed border-gray-150 dark:border-gray-850">
                <p className="text-xs text-gray-400">Brak aktywnych szkiców. Dodaj produkty u dostawców w Marketplace, aby rozpocząć tworzenie zapytania B2B.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {drafts.map((draft, idx) => {
                  const vendor = getVendor(draft.vendorId);
                  return (
                    <div 
                      key={draft.vendorId || idx}
                      className="bg-amber-50/20 dark:bg-amber-950/5 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all gap-4 text-xs text-left"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400">
                            Wersja robocza (RFQ)
                          </span>
                          <button
                            onClick={() => {
                              localStorage.removeItem(`ambra-marketplace-request-draft-${draft.vendorId}`);
                              loadDraftsAndRfqs();
                              triggerNotification('Usunięto szkic', 'Szkic zapytania ofertowego został pomyślnie skasowany.', 'info');
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
                            title="Usuń szkic"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2.5">
                          {vendor?.logoUrl ? (
                            <img src={vendor.logoUrl} alt={vendor.name} className="w-7 h-7 rounded-lg object-cover bg-gray-50 shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold shrink-0">
                              {draft.vendorName?.charAt(0) || 'D'}
                            </div>
                          )}
                          <div>
                            <h4 className="font-extrabold text-xs text-gray-900 dark:text-white leading-tight">{draft.vendorName}</h4>
                            <p className="text-[10px] text-gray-400">Modyfikowano: {new Date(draft.lastModifiedDate).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</p>
                          </div>
                        </div>

                        <div className="p-2.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-850/60 font-sans space-y-1 text-[10px]">
                          <p className="font-bold text-gray-600 dark:text-gray-400">Pozycje asortymentowe: <span className="text-gray-900 dark:text-white">{draft.items?.length || 0} linii</span></p>
                          <p className="truncate text-gray-450">{draft.items?.map((item: any) => getProduct(item.productId)?.name || 'Produkt').join(', ')}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (onNavigateToMarketplace) {
                            onNavigateToMarketplace(`/dostawcy/${draft.vendorSlug}`);
                          }
                        }}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-colors text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <span>Kontynuuj tworzenie w Kreatorze</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Sent RFQs */}
          <div className="space-y-4 pt-2">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Wysłane zapytania i historia wycen ({submittedRfqs.length})</span>
            </h3>

            {submittedRfqs.length === 0 ? (
              <div className="bg-white dark:bg-[#0E1321] border border-gray-150 dark:border-gray-850 rounded-2xl py-12 px-4 text-center max-w-lg mx-auto space-y-4 shadow-sm">
                <FileText className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 font-sans">Brak wysłanych zapytań</h3>
                <p className="text-xs text-gray-400 leading-relaxed max-w-md mx-auto">
                  Historia wszystkich złożonych zapytań ofertowych oraz nadesłanych przez dostawców wycen specjalnych będzie gromadzona w tym panelu.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {submittedRfqs.map((rfq, idx) => {
                  const vendor = getVendor(rfq.vendorId);
                  
                  let statusBadge = 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100/30';
                  let statusText = 'Wysłane (Oczekiwanie)';
                  if (rfq.status === 'Odpowiedziane') {
                    statusBadge = 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100/30';
                    statusText = 'Wycenione (Odbierz)';
                  } else if (rfq.status === 'Zaakceptowana' || rfq.status === 'Przekształcona w zamówienie') {
                    statusBadge = 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100/30';
                    statusText = 'Przekształcone w zamówienie';
                  }

                  return (
                    <div 
                      key={rfq.id || idx}
                      className="bg-white dark:bg-[#0E1321] border border-gray-150 dark:border-gray-850 rounded-2xl p-5 hover:shadow-md transition-all flex flex-col md:flex-row justify-between gap-6 text-left"
                    >
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 dark:border-gray-850 pb-2.5">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400">
                              {rfq.enquiryNumber}
                            </span>
                            <span className={cn("text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wide", statusBadge)}>
                              {statusText}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">
                            Złożono: {new Date(rfq.date).toLocaleDateString('pl-PL')}
                          </span>
                        </div>

                        <div className="flex items-start gap-3">
                          {vendor?.logoUrl ? (
                            <img src={vendor.logoUrl} alt={vendor.name} className="w-9 h-9 rounded-xl object-cover bg-gray-50 shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-sm shrink-0">
                              {rfq.vendorName?.charAt(0) || 'D'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-xs text-gray-900 dark:text-white">{rfq.vendorName}</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5">Nadawca: {rfq.clientName || 'Michał Stępień (Branch Manager)'}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Oddział docelowy: {rfq.branchName || 'Komorniki Warsztat'}</p>
                          </div>
                        </div>

                        {/* Items list preview */}
                        <div className="p-3 bg-gray-50/60 dark:bg-gray-950/40 rounded-xl space-y-1.5 border border-gray-100 dark:border-gray-850/40 text-[10px]">
                          <p className="font-extrabold text-[9px] uppercase tracking-wider text-gray-400">Specyfikacja zapytania ({rfq.items?.length || 0} linii)</p>
                          <div className="divide-y divide-gray-100/50 dark:divide-gray-800/40 max-h-[140px] overflow-y-auto pr-1">
                            {rfq.items?.map((item: any, lineIdx: number) => {
                              const prod = getProduct(item.productId);
                              return (
                                <div key={lineIdx} className="py-1 flex items-center justify-between text-gray-600 dark:text-gray-300">
                                  <span className="font-semibold truncate pr-4">{prod?.name || 'Produkt'}</span>
                                  <span className="font-bold shrink-0 font-mono text-gray-800 dark:text-gray-200">{item.quantity} {item.unit || 'szt.'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {rfq.message && (
                          <div className="text-[10px] text-gray-400 bg-blue-50/10 p-2.5 rounded-lg italic">
                            „{rfq.message}”
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col justify-between md:items-end w-full md:w-[200px] gap-4 shrink-0">
                        <div className="md:text-right font-sans space-y-1 text-[11px]">
                          <p className="text-gray-400 font-semibold">Preferowany kontakt:</p>
                          <p className="font-black text-gray-700 dark:text-gray-300">{rfq.preferredContactMethod || 'W aplikacji'}</p>
                        </div>

                        <div className="space-y-2 w-full">
                          {rfq.status === 'Wysłane' && (
                            <button
                              onClick={() => handleTriggerSimulation(rfq.id)}
                              className="w-full py-2 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm hover:scale-[1.01]"
                            >
                              <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-100" />
                              <span>Przyspiesz odpowiedź (Symulator)</span>
                            </button>
                          )}

                          {rfq.status === 'Odpowiedziane' && (
                            <button
                              onClick={() => {
                                setActiveTab('quotations');
                                setSelectedQuotationId(rfq.id);
                              }}
                              className="w-full py-2.5 bg-[#2A3B4C] hover:bg-[#1E2B38] dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Zobacz wycenę i zamów</span>
                            </button>
                          )}

                          {rfq.status === 'Zaakceptowana' && (
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-center text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                              ✓ Zaakceptowano i zamówiono
                            </div>
                          )}

                          <button
                            onClick={() => onOpenChat(rfq.vendorId, `Zapytanie B2B RFQ ${rfq.enquiryNumber}`, 'none', rfq.id)}
                            className="w-full py-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850 font-extrabold text-[10px] uppercase tracking-wider rounded-xl text-center flex items-center justify-center gap-1.5 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                            <span>Czat z opiekunem</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
