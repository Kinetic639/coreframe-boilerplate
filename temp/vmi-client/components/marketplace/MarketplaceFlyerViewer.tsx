'use client';

import React, { useState, useMemo } from 'react';
import { 
  mockProducts 
} from './mockData';
import { PublicFlyer, PublicVendor, PublicProduct } from './types';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft, 
  ShoppingBag, 
  BookOpen, 
  Building2, 
  ShieldCheck,
  CheckCircle2,
  Info
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface MarketplaceFlyerViewerProps {
  flyer: PublicFlyer;
  vendor: PublicVendor;
  onBack: () => void;
  onSelectProduct: (slug: string) => void;
  onAddToEnquiry: (productId: string, qty: number, unit: 'szt' | 'paczka') => void;
}

export default function MarketplaceFlyerViewer({
  flyer,
  vendor,
  onBack,
  onSelectProduct,
  onAddToEnquiry
}: MarketplaceFlyerViewerProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // Active products tagged in the current leaflet page
  const pageProducts = useMemo(() => {
    const page = flyer.pages[currentPageIndex];
    if (!page) return [];
    return mockProducts.filter(p => page.productIds.includes(p.id));
  }, [flyer, currentPageIndex]);

  const handleNextPage = () => {
    setCurrentPageIndex(prev => (prev + 1) % flyer.pages.length);
  };

  const handlePrevPage = () => {
    setCurrentPageIndex(prev => (prev - 1 + flyer.pages.length) % flyer.pages.length);
  };

  const activePage = flyer.pages[currentPageIndex];

  // Quick add success states
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const handleQuickAdd = (productId: string, minQty: number) => {
    onAddToEnquiry(productId, minQty, 'paczka');
    setAddedProductId(productId);
    setTimeout(() => setAddedProductId(null), 1500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in text-left">
      {/* Back button & Title header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 text-left">
          <button 
            onClick={onBack}
            className="py-1.5 px-3 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-850 text-gray-800 dark:text-white rounded-lg text-xs font-black uppercase tracking-wide flex items-center gap-1 cursor-pointer mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Powrót do gazetek
          </button>
          
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black font-display text-gray-900 dark:text-white uppercase tracking-tight">{flyer.title}</h1>
            <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-mono text-[9px] font-black px-2 py-0.5 rounded">
              GAZETKA INTERAKTYWNA
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Dostawca: <strong>{vendor.name}</strong> • Oferta ważna do: {flyer.validTo}
          </p>
        </div>
      </div>

      {/* FLYER SLIDER GALLERY PANEL WITH CONSISTENT DIMENSIONS TO PREVENT LAYOUT SHIFTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Flyer Canvas Page Container - Fixed consistent dimension */}
        <div className="lg:col-span-7 bg-[#1A1F2E] rounded-3xl p-6 shadow-2xl relative flex flex-col items-center justify-center w-full h-[480px] md:h-[560px] overflow-hidden select-none">
          {/* Cover/Leaflet Backdrop page layout */}
          <div className="absolute inset-0 bg-radial-gradient-cover opacity-10 pointer-events-none" />

          {/* Core Flyer Page Content - Uniformly restricted aspect ratio container to prevent layout shifting */}
          <div className="relative w-full max-w-[360px] h-full flex flex-col justify-between py-4 animate-scale-up text-center">
            {/* Page Header info */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-black tracking-widest text-blue-400 uppercase font-mono">
                Strona {currentPageIndex + 1} z {flyer.pages.length}
              </span>
              <h3 className="text-white font-extrabold text-sm uppercase tracking-tight line-clamp-1 px-4">
                {activePage?.title}
              </h3>
            </div>

            {/* Visual Feature: Big graphic of the hero product on this page (if layout is hero) */}
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              {activePage?.layoutType === 'hero' && pageProducts[0] ? (
                <div className="space-y-4">
                  <div className="w-40 h-40 rounded-2xl bg-white/5 p-3 overflow-hidden shadow-2xl mx-auto flex items-center justify-center">
                    <img 
                      src={pageProducts[0].imageUrl} 
                      alt={pageProducts[0].name} 
                      className="max-h-full max-w-full object-contain rounded-lg" 
                    />
                  </div>
                  <div className="space-y-1 text-center">
                    <h4 className="text-blue-300 font-extrabold text-xs uppercase tracking-wide">{activePage.headline}</h4>
                    <p className="text-gray-300 text-[11px] leading-relaxed max-w-xs mx-auto">
                      {activePage.description}
                    </p>
                  </div>
                </div>
              ) : activePage?.layoutType === 'cta' ? (
                <div className="space-y-4 max-w-xs text-center py-6">
                  <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center text-xl mx-auto">
                    ✉
                  </div>
                  <h4 className="text-blue-300 font-black text-xs uppercase tracking-tight">{activePage.headline}</h4>
                  <p className="text-gray-300 text-[10px] leading-relaxed">
                    {activePage.description}
                  </p>
                </div>
              ) : (
                // Grid or duo - multi-image presentation
                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                  {pageProducts.slice(0, 4).map(product => (
                    <div key={product.id} className="bg-white/5 rounded-xl p-2 flex flex-col items-center text-center">
                      <img src={product.imageUrl} alt={product.name} className="w-16 h-16 object-cover rounded-lg mb-1.5" />
                      <span className="text-[8px] text-gray-400 font-bold truncate w-24">{product.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DOT NAVIGATION AT BOTTOM CENTER */}
            <div className="flex items-center justify-center gap-1.5 pt-4">
              {flyer.pages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentPageIndex(idx)}
                  className={cn(
                    "h-2 rounded-full transition-all cursor-pointer",
                    currentPageIndex === idx ? "w-5 bg-blue-500" : "w-2 bg-white/20 hover:bg-white/45"
                  )}
                  title={`Strona ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Left Navigation Arrow */}
          <button 
            type="button" 
            onClick={handlePrevPage}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
            title="Poprzednia strona"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Right Navigation Arrow */}
          <button 
            type="button" 
            onClick={handleNextPage}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
            title="Następna strona"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* RIGHT COLUMN: LIST OF PRODUCTS ADVERTISED ON THE SELECTED PAGE */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-xs font-black tracking-widest text-gray-400 uppercase font-mono pb-1">
            Artykuły na tej stronie ({pageProducts.length})
          </h3>

          {pageProducts.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl text-center flex items-center gap-2.5 text-xs text-gray-400">
              <Info className="h-4.5 w-4.5 text-gray-400 shrink-0" />
              <span>Na tej stronie brak bezpośrednio oznaczonych produktów. Skorzystaj z formularza kontaktu.</span>
            </div>
          ) : (
            <div className="space-y-3.5">
              {pageProducts.map(product => {
                const isAdded = addedProductId === product.id;
                return (
                  <div 
                    key={product.id} 
                    className="bg-white dark:bg-gray-900 rounded-2xl p-4 flex items-center justify-between gap-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0" onClick={() => onSelectProduct(product.slug)}>
                      <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded-xl object-cover bg-gray-50 shrink-0" />
                      <div className="min-w-0 text-left">
                        <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase font-mono">{product.brand}</span>
                        <h4 className="font-extrabold text-xs text-gray-900 dark:text-white hover:underline cursor-pointer truncate leading-tight">{product.name}</h4>
                        
                        {/* Pricing */}
                        <div className="pt-0.5 text-xs">
                          {product.priceMode === 'exact' && product.priceValue && (
                            <p className="font-extrabold text-xs text-gray-950 dark:text-white">
                              {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                            </p>
                          )}
                          {product.priceMode === 'from' && product.priceValue && (
                            <p className="font-extrabold text-xs text-gray-950 dark:text-white">
                              od {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                            </p>
                          )}
                          {product.priceMode === 'range' && product.priceValue && product.priceMax && (
                            <p className="font-extrabold text-xs text-gray-950 dark:text-white">
                              {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} - {product.priceMax.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                            </p>
                          )}
                          {product.priceMode === 'on_request' && (
                            <span className="text-orange-600 dark:text-orange-400 text-[9px] font-black uppercase tracking-wider font-mono">Cena na zapytanie</span>
                          )}
                          {product.priceMode === 'after_login' && (
                            <span className="text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-wider font-mono">Cena po zalogowaniu</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleQuickAdd(product.id, product.minEnquiryQty)}
                      disabled={isAdded}
                      className={cn(
                        "py-1.5 px-3 rounded-lg font-black text-[9px] uppercase tracking-wider cursor-pointer shrink-0",
                        isAdded 
                          ? "bg-green-600 text-white" 
                          : "bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400"
                      )}
                    >
                      {isAdded ? 'Dodano ✓' : 'Zapytaj +'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
