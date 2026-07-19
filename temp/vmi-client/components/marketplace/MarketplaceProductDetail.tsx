'use client';

import React, { useState, useMemo } from 'react';
import { 
  mockProducts, 
  mockVendors 
} from './mockData';
import { PublicProduct, PublicVendor } from './types';
import { 
  ArrowLeft, 
  Heart, 
  ShoppingBag, 
  ShieldCheck, 
  Info, 
  ChevronRight, 
  Layers, 
  Box, 
  Building2,
  CheckCircle2,
  Clock,
  HelpCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface MarketplaceProductDetailProps {
  product: PublicProduct;
  vendor: PublicVendor;
  onBack: () => void;
  onGoToVendor: () => void;
  onToggleSave: () => void;
  isSaved: boolean;
  onAddToEnquiry: (productId: string, qty: number, unit: 'szt' | 'paczka') => void;
  onSelectProduct: (slug: string) => void;
  isLoggedIn?: boolean;
  onLoginClick?: () => void;
}

export default function MarketplaceProductDetail({
  product,
  vendor,
  onBack,
  onGoToVendor,
  onToggleSave,
  isSaved,
  onAddToEnquiry,
  onSelectProduct,
  isLoggedIn,
  onLoginClick
}: MarketplaceProductDetailProps) {
  // Package Quantity state
  const [packageQty, setPackageQty] = useState<number>(product.minEnquiryQty > 0 ? Math.max(1, Math.ceil(product.minEnquiryQty / product.packSize)) : 1);
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Total pieces calculated based on package selection
  const calculatedTotalPieces = useMemo(() => {
    return packageQty * product.packSize;
  }, [packageQty, product.packSize]);

  // Related products from the same vendor
  const relatedProducts = useMemo(() => {
    return mockProducts
      .filter(p => p.vendorId === product.vendorId && p.id !== product.id)
      .slice(0, 4);
  }, [product.vendorId, product.id]);

  const handleIncrement = () => {
    setPackageQty(prev => prev + 1);
  };

  const handleDecrement = () => {
    setPackageQty(prev => Math.max(1, prev - 1));
  };

  const handleAddToBasket = () => {
    if (!isLoggedIn) {
      onLoginClick?.();
      return;
    }
    onAddToEnquiry(product.id, packageQty, 'paczka');
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10 animate-fade-in text-left">
      {/* 1. BACK BUTTON */}
      <div className="shrink-0">
        <button 
          onClick={onBack}
          className="py-1.5 px-3 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-850 text-gray-800 dark:text-white rounded-lg text-xs font-black uppercase tracking-wide flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Powrót do wyszukiwarki
        </button>
      </div>

      {/* 2. PRODUCT LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: IMAGE PORTRAIT */}
        <div className="lg:col-span-5 bg-white dark:bg-gray-900 rounded-3xl p-6 relative flex items-center justify-center shadow-md">
          <div className="aspect-square relative w-full overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-950">
            <img 
              src={product.imageUrl} 
              alt={product.name} 
              className="w-full h-full object-cover" 
            />
          </div>

          {/* Save Overlay Button */}
          <button 
            onClick={onToggleSave}
            className={cn(
              "absolute top-10 right-10 p-2.5 rounded-full bg-white/95 dark:bg-gray-900/95 shadow-sm hover:scale-105 cursor-pointer transition-all",
              isSaved ? "text-rose-500 bg-rose-50" : "text-gray-400"
            )}
            title={isSaved ? "Usuń ze schowka" : "Zapisz do schowka"}
          >
            <Heart className={cn("h-4.5 w-4.5", isSaved && "fill-rose-500 text-rose-500")} />
          </button>
        </div>

        {/* RIGHT COLUMN: INFO & PRICING & QUANTITY FORM */}
        <div className="lg:col-span-7 space-y-6">
          {/* Identity & Category info */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-wider font-mono text-gray-500">
              <span className="text-blue-600 dark:text-blue-400">{product.brand}</span>
              <span>•</span>
              <span>SKU: {product.sku}</span>
              <span>•</span>
              <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">{product.category}</span>
            </div>

            <h1 className="text-xl md:text-2xl font-black font-display text-gray-900 dark:text-white uppercase tracking-tight leading-snug">
              {product.name}
            </h1>

            {/* Vendor card connection */}
            <div 
              onClick={onGoToVendor}
              className="inline-flex items-center gap-2 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 px-3.5 py-1.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 cursor-pointer transition-all"
            >
              <Building2 className="h-4 w-4 text-blue-500" />
              <span>Dostawca: <strong className="text-blue-600 dark:text-blue-400">{vendor.name}</strong> ({vendor.city})</span>
              {vendor.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
              <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            </div>
          </div>

          <hr className="" />

          {/* Pricing & Availability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Price Box */}
            <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl p-4 flex flex-col justify-center">
              <span className="text-[10px] font-black tracking-wider uppercase text-gray-400 font-mono mb-1">Cena Hurtowa B2B</span>
              
              {product.priceMode === 'exact' && product.priceValue && (
                <div>
                  <p className="text-2xl font-black text-gray-950 dark:text-white leading-none">
                    {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                  </p>
                  <span className="text-[10px] text-gray-400 font-bold uppercase mt-1 block">Cena netto za 1 {product.unit}</span>
                </div>
              )}

              {product.priceMode === 'from' && product.priceValue && (
                <div>
                  <span className="text-[10px] text-gray-400 font-semibold block leading-none">Cena zaczyna się od:</span>
                  <p className="text-2xl font-black text-gray-950 dark:text-white leading-tight mt-1">
                    {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN <span className="text-xs font-normal">/{product.unit}</span>
                  </p>
                </div>
              )}

              {product.priceMode === 'range' && product.priceValue && product.priceMax && (
                <div>
                  <span className="text-[10px] text-gray-400 font-semibold block leading-none">Orientacyjny przedział:</span>
                  <p className="text-xl font-black text-gray-950 dark:text-white leading-tight mt-1">
                    {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} - {product.priceMax.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                  </p>
                </div>
              )}

              {product.priceMode === 'on_request' && (
                <p className="text-sm font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider font-mono">
                  Cena na zapytanie ofertowe
                </p>
              )}

              {product.priceMode === 'after_login' && (
                <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  Dostępna po uzgodnieniu warunków handlowych
                </p>
              )}
            </div>

            {/* Availability Box */}
            <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl p-4 flex flex-col justify-center">
              <span className="text-[10px] font-black tracking-wider uppercase text-gray-400 font-mono mb-1">Dostępność magazynu</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  product.availability === 'Dostępny' ? "bg-green-500 animate-pulse" :
                  product.availability === 'Ograniczona dostępność' ? "bg-orange-500" : "bg-red-500"
                )} />
                <p className="font-extrabold text-sm">{product.availability}</p>
              </div>
              <p className="text-[9px] text-gray-400 mt-1 leading-normal">
                Czas reakcji dostawcy na zapytanie: {vendor.responseTimeText}. Obszar dostaw: {vendor.serviceArea}.
              </p>
            </div>
          </div>

          {/* PACKAGE ADDER ACCELERATOR (satisfies package detail guidelines) */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-md space-y-4 text-xs text-left">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">Formularz dodawania do zapytania</h3>
                <p className="text-[10px] text-gray-400">Artykuł pakowany i dostarczany wyłącznie w paczkach zbiorczych.</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-mono text-[10px] font-black px-2.5 py-1 rounded-full">
                1 paczka = {product.packSize} {product.unit}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              {/* Counter Input */}
              <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-950 p-1 w-full sm:w-40 shrink-0">
                <button 
                  type="button" 
                  onClick={handleDecrement}
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  -
                </button>
                <div className="text-center font-black text-xs text-gray-800 dark:text-white">
                  {packageQty} pacz.
                </div>
                <button 
                  type="button" 
                  onClick={handleIncrement}
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Add button */}
              <button
                onClick={handleAddToBasket}
                disabled={addedSuccess}
                className={cn(
                  "flex-1 py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5",
                  addedSuccess 
                    ? "bg-green-600 text-white" 
                    : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg active:scale-95"
                )}
              >
                {addedSuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Dodano pomyślnie ✓</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    <span>Dodaj {packageQty} op. do zapytania</span>
                  </>
                )}
              </button>
            </div>

            {/* Calculation summary details */}
            <div className="bg-gray-50/50 dark:bg-gray-850/20 p-3 rounded-xl flex items-center gap-2.5 text-[10px] text-gray-400">
              <Info className="h-4 w-4 text-blue-500 shrink-0" />
              <p className="leading-relaxed">
                Wybrałeś <strong>{packageQty} opakowanie/a</strong>. Dostawca wyśle do Twojego warsztatu łącznie <strong>{calculatedTotalPieces} {product.unit}</strong>. Minimalne zamówienie próbne u tego dostawcy to {product.minEnquiryQty} {product.unit}.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PRODUCT DESCRIPTION & TECHNICAL SPECIFICATION TABS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6">
        {/* Specifications Table Left side */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-sm font-black tracking-widest text-gray-400 uppercase font-mono pb-1">Dane techniczne B2B</h3>
          
          <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-md">
            <table className="w-full text-[11px] text-left border-collapse">
              <tbody>
                <tr className="">
                  <td className="p-3.5 font-bold text-gray-400 uppercase font-mono tracking-wider w-1/3">Marka</td>
                  <td className="p-3.5 font-bold text-gray-800 dark:text-gray-100">{product.brand}</td>
                </tr>
                <tr className="">
                  <td className="p-3.5 font-bold text-gray-400 uppercase font-mono tracking-wider">Kod SKU</td>
                  <td className="p-3.5 font-mono text-gray-800 dark:text-gray-100">{product.sku}</td>
                </tr>
                <tr className="">
                  <td className="p-3.5 font-bold text-gray-400 uppercase font-mono tracking-wider">Jednostka miary</td>
                  <td className="p-3.5 font-bold text-gray-800 dark:text-gray-100">{product.unit}</td>
                </tr>
                <tr className="">
                  <td className="p-3.5 font-bold text-gray-400 uppercase font-mono tracking-wider">Opakowanie zbiorcze</td>
                  <td className="p-3.5 font-bold text-gray-800 dark:text-gray-100">{product.packSize} {product.unit}</td>
                </tr>
                {Object.entries(product.specifications).map(([key, val]) => (
                  <tr key={key} className="last:border-0">
                    <td className="p-3.5 font-bold text-gray-400 uppercase font-mono tracking-wider">{key}</td>
                    <td className="p-3.5 font-medium text-gray-800 dark:text-gray-200">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Description right side */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-sm font-black tracking-widest text-gray-400 uppercase font-mono pb-1">Opis i specyfikacja asortymentu</h3>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-md">
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
              {product.description}
            </p>
          </div>
        </div>
      </div>

      {/* 4. RELATED PRODUCTS IN THE SAME CATEGORY */}
      {relatedProducts.length > 0 && (
        <div className="space-y-4 pt-6">
          <h3 className="text-sm font-black tracking-widest text-gray-400 uppercase font-mono">Inne produkty z oferty {vendor.name}</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedProducts.map(relProduct => (
              <div 
                key={relProduct.id}
                onClick={() => onSelectProduct(relProduct.slug)}
                className="bg-white dark:bg-gray-900 rounded-xl p-3.5 flex flex-col justify-between shadow-md hover:shadow-lg transition-all group cursor-pointer text-left"
              >
                <div>
                  <div className="aspect-square bg-gray-50 dark:bg-gray-950 rounded-lg overflow-hidden mb-3">
                    <img src={relProduct.imageUrl} alt={relProduct.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] font-black tracking-widest text-blue-600 dark:text-blue-400 uppercase font-mono">{relProduct.brand}</span>
                    <h4 className="font-bold text-xs text-gray-900 dark:text-white group-hover:text-blue-600 hover:underline line-clamp-1 leading-tight">{relProduct.name}</h4>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-[10px] text-gray-500 pt-3 mt-3">
                  <span className="font-bold">{relProduct.availability}</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5">Więcej <ChevronRight className="h-3 w-3" /></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
