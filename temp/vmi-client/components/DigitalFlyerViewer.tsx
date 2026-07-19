'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ArrowRight, 
  BookOpen, 
  Calendar, 
  Check, 
  MessageSquare, 
  ShoppingCart, 
  Tag, 
  X 
} from 'lucide-react';
import { DigitalFlyer, Product } from '../lib/types';
import { cn } from '../lib/utils';

interface DigitalFlyerViewerProps {
  flyer: DigitalFlyer;
  products: Product[];
  vendorName: string;
  onAddToCart: (productId: string, qty: number) => void;
  onViewProduct: (productId: string) => void;
  onAskVendor: (productId: string, subject: string) => void;
  onClose: () => void;
}

export default function DigitalFlyerViewer({
  flyer,
  products,
  vendorName,
  onAddToCart,
  onViewProduct,
  onAskVendor,
  onClose
}: DigitalFlyerViewerProps) {
  // Page index starts from 0 (Cover is pageIndex 0, page 1 is pageIndex 1, etc.)
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [addedProductIds, setAddedProductIds] = useState<{ [id: string]: boolean }>({});

  const totalPages = flyer.pages.length + 1; // +1 for Cover page

  const handleNextPage = () => {
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  // Trigger temporary checkmark feedback on Add to Cart
  const triggerAddToCart = (productId: string, packSize: number) => {
    onAddToCart(productId, packSize);
    setAddedProductIds(prev => ({ ...prev, [productId]: true }));
    setTimeout(() => {
      setAddedProductIds(prev => ({ ...prev, [productId]: false }));
    }, 2000);
  };

  // Find products belonging to active page
  const getPageProducts = (pageNumber: number): Product[] => {
    const pageConfig = flyer.pages.find(p => p.pageNumber === pageNumber);
    if (!pageConfig) return [];
    return products.filter(p => pageConfig.productIds.includes(p.id));
  };

  const getPageLayoutType = (pageNumber: number): 'grid' | 'hero' | 'duo' => {
    const pageConfig = flyer.pages.find(p => p.pageNumber === pageNumber);
    return pageConfig?.layoutType || 'grid';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1A1C1E]/40 backdrop-blur-sm p-4 md:p-8 items-center justify-center">
      <div className="w-full max-w-4xl bg-white rounded-2xl flex flex-col h-[90vh] md:h-[85vh] overflow-hidden shadow-2xl relative">
        
        {/* Flyer Header */}
        <div className="px-4 py-3 bg-[#F8F9FA] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#2A3B4C]" />
            <div>
              <h4 className="font-bold text-sm text-[#1A1C1E]">{flyer.title}</h4>
              <p className="text-[10px] text-gray-500">Oferta handlowa {vendorName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-600 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-[#2A3B4C]" />
              <span>{flyer.validFrom} do {flyer.validTo}</span>
            </span>
            <button 
              onClick={onClose}
              className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-[#1A1C1E] cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Interactive Page Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F8F9FA] flex items-center justify-center relative">
          
          {/* Navigation Arrows - Desktop */}
          <button
            onClick={handlePrevPage}
            disabled={currentPageIndex === 0}
            className="absolute left-2 md:left-4 z-10 w-10 h-10 rounded-full bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer shadow-md flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <button
            onClick={handleNextPage}
            disabled={currentPageIndex === totalPages - 1}
            className="absolute right-2 md:right-4 z-10 w-10 h-10 rounded-full bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer shadow-md flex items-center justify-center"
          >
            <ArrowRight className="h-5 w-5" />
          </button>

          <AnimatePresence mode="wait">
            {currentPageIndex === 0 ? (
              
              /* COVER PAGE */
              <motion.div
                key="cover"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-sm aspect-[3/4] bg-white rounded-xl overflow-hidden shadow-xl flex flex-col justify-between p-6 relative cursor-pointer"
                onClick={handleNextPage}
              >
                {/* Background graphic */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent pointer-events-none" />
                
                <div className="flex justify-between items-start z-10">
                  <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-extrabold uppercase rounded-full tracking-wider animate-pulse">
                    GAZETKA PROMOCYJNA B2B
                  </span>
                  <Tag className="h-5 w-5 text-[#2A3B4C]" />
                </div>

                <div className="text-center space-y-4 py-8 z-10">
                  <span className="text-xs tracking-widest text-gray-500 uppercase font-bold">Ambra VMI System</span>
                  <h3 className="text-2xl font-extrabold leading-tight tracking-tight text-[#1A1C1E]">
                    {flyer.title}
                  </h3>
                  <div className="w-12 h-1 bg-gradient-to-r from-[#2A3B4C] to-[#1E2B38] mx-auto rounded" />
                </div>

                <div className="space-y-4 z-10">
                  <div className="bg-[#F0F2F5] p-4 rounded-xl text-center text-xs space-y-1">
                    <p className="text-gray-550">Okres ważności oferty:</p>
                    <p className="font-bold text-[#1A1C1E] font-mono">{flyer.validFrom} — {flyer.validTo}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Ceny tylko dla partnerów programu Ambra VMI</p>
                  </div>
                  
                  <button
                    onClick={(e) => { e.stopPropagation(); handleNextPage(); }}
                    className="w-full py-3 bg-[#2A3B4C] hover:bg-[#1E2B38] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <span>Otwórz gazetkę (Przeglądaj)</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>

            ) : (

              /* CONTENT PAGES */
              <motion.div
                key={`page-${currentPageIndex}`}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full flex flex-col justify-between"
              >
                <div className="text-center mb-4 shrink-0">
                  <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
                    Strona {currentPageIndex} z {totalPages - 1}
                  </span>
                </div>

                {/* Products layout on active page */}
                <div className="flex-1 overflow-y-auto px-1">
                  {getPageLayoutType(currentPageIndex) === 'duo' ? (
                    
                    /* DUO LAYOUT: 2 Large Side-by-side Items */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full items-center">
                      {getPageProducts(currentPageIndex).map(prod => (
                        <div 
                          key={prod.id} 
                          className="bg-white rounded-xl p-4 flex flex-col justify-between transition-colors h-full shadow-sm"
                        >
                          <div className="space-y-3">
                            <div className="w-full aspect-[4/3] bg-gray-50 rounded-lg overflow-hidden relative">
                              <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                              <span className="absolute top-2 left-2 px-2.5 py-0.5 bg-red-50 text-red-700 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                                PROMOCJA
                              </span>
                            </div>
                            <div className="space-y-1">
                              <h5 className="font-bold text-sm text-[#1A1C1E] line-clamp-1">{prod.name}</h5>
                              <p className="text-[10px] text-gray-400 font-mono">SKU: {prod.vendorSku}</p>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 space-y-3">
                            {/* Price labels */}
                            <div className="flex items-baseline justify-between">
                              <span className="text-[10px] text-gray-500 font-medium">Cena promocyjna:</span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs text-gray-400 line-through font-mono">{(prod.price).toFixed(2)} zł</span>
                                <span className="text-base font-extrabold text-amber-700 font-mono">{(prod.promoPrice || prod.price * 0.8).toFixed(2)} zł</span>
                              </div>
                            </div>

                            {/* Actions block */}
                            <div className="grid grid-cols-1 gap-1.5">
                              <button
                                onClick={() => triggerAddToCart(prod.id, prod.packSize)}
                                className={cn(
                                  "w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                                  addedProductIds[prod.id]
                                    ? "bg-emerald-700 text-white"
                                    : "bg-[#2A3B4C] hover:bg-[#1E2B38] text-white shadow-sm"
                                )}
                              >
                                {addedProductIds[prod.id] ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Dodano do koszyka!</span>
                                  </>
                                ) : (
                                  <>
                                    <ShoppingCart className="h-3.5 w-3.5" />
                                    <span>Kup opakowanie (+{prod.packSize} szt.)</span>
                                  </>
                                )}
                              </button>

                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  onClick={() => onViewProduct(prod.id)}
                                  className="py-1.5 text-xs text-gray-700 hover:text-[#1A1C1E] bg-[#F0F2F5] hover:bg-gray-200 rounded-lg cursor-pointer transition-all text-center"
                                >
                                  Szczegóły
                                </button>
                                <button
                                  onClick={() => onAskVendor(prod.id, `Pytanie o ofertę z gazetki: ${prod.name}`)}
                                  className="py-1.5 text-xs text-gray-600 hover:text-[#1A1C1E] bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  <span>Zapytaj</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                  ) : (

                    /* GRID LAYOUT: 3-4 Smaller Items on page */
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {getPageProducts(currentPageIndex).map(prod => (
                        <div 
                          key={prod.id} 
                          className="bg-white rounded-xl p-3 flex flex-col justify-between transition-colors shadow-sm"
                        >
                          <div>
                            <div className="w-full aspect-square bg-gray-50 rounded-lg overflow-hidden relative shrink-0">
                              <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                              <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-red-50 text-red-700 text-[8px] font-extrabold rounded uppercase tracking-wider">
                                PROMOCJA
                              </span>
                            </div>
                            <div className="mt-2 space-y-0.5">
                              <h6 className="font-bold text-xs text-[#1A1C1E] line-clamp-1">{prod.name}</h6>
                              <p className="text-[9px] text-gray-400 font-mono">SKU: {prod.vendorSku}</p>
                            </div>
                          </div>

                          <div className="mt-3 pt-2 space-y-2">
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] text-gray-400 line-through font-mono">{(prod.price).toFixed(2)} zł</span>
                              <span className="text-sm font-black text-amber-700 font-mono">{(prod.promoPrice || prod.price * 0.85).toFixed(2)} zł</span>
                            </div>

                            <div className="space-y-1">
                              <button
                                onClick={() => triggerAddToCart(prod.id, prod.packSize)}
                                className={cn(
                                  "w-full py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer",
                                  addedProductIds[prod.id]
                                    ? "bg-emerald-700 text-white"
                                    : "bg-[#2A3B4C] hover:bg-[#1E2B38] text-white"
                                )}
                              >
                                {addedProductIds[prod.id] ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <ShoppingCart className="h-3 w-3" />
                                )}
                                <span>{addedProductIds[prod.id] ? "Dodano" : `Do koszyka (${prod.packSize}szt)`}</span>
                              </button>

                              <button
                                onClick={() => onViewProduct(prod.id)}
                                className="w-full py-1 bg-[#F0F2F5] hover:bg-gray-200 text-gray-700 text-[10px] rounded hover:text-[#1A1C1E] transition-all cursor-pointer text-center"
                              >
                                Szczegóły produktu
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                  )}
                </div>

                {/* Horizontal Swipe Indicator for Mobile */}
                <div className="mt-4 flex justify-between items-center text-xs text-gray-400 shrink-0 pt-3">
                  <span>WSKAZÓWKA: Klikaj strzałki lub pozycje w bocznej nawigacji.</span>
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPageIndex(idx)}
                        className={cn(
                          "w-2.5 h-2.5 rounded-full transition-all cursor-pointer",
                          idx === currentPageIndex ? "bg-[#2A3B4C] w-5" : "bg-gray-200"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>

            )}
          </AnimatePresence>

        </div>

      </div>
    </div>
  );
}
