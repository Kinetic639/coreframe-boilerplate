'use client';

import React, { useState, useMemo } from 'react';
import { 
  mockVendors, 
  mockProducts, 
  mockCatalogs, 
  mockPromotions, 
  mockFlyers, 
  mockCities, 
  mockCategories 
} from './mockData';
import { PublicVendor, PublicProduct, PublicFlyer } from './types';
import { 
  Search, 
  MapPin, 
  Building2, 
  ArrowRight, 
  Star, 
  Heart, 
  Sparkles, 
  ShieldCheck, 
  Truck, 
  Compass,
  Zap,
  ShoppingBag,
  Clock,
  BookOpen,
  Cpu,
  FlaskConical,
  Wrench,
  Hammer,
  Shirt,
  Disc,
  Package,
  Droplet,
  Plug,
  Settings,
  Check
} from 'lucide-react';

const getCategoryIcon = (categoryName: string) => {
  switch (categoryName) {
    case 'Części samochodowe':
      return <Cpu className="h-5 w-5 text-blue-500 mx-auto" />;
    case 'Chemia warsztatowa':
      return <FlaskConical className="h-5 w-5 text-indigo-500 mx-auto" />;
    case 'Narzędzia':
      return <Wrench className="h-5 w-5 text-amber-500 mx-auto" />;
    case 'Wyposażenie warsztatu':
      return <Hammer className="h-5 w-5 text-teal-500 mx-auto" />;
    case 'Odzież robocza':
      return <Shirt className="h-5 w-5 text-orange-500 mx-auto" />;
    case 'Bezpieczeństwo i BHP':
      return <ShieldCheck className="h-5 w-5 text-green-500 mx-auto" />;
    case 'Materiały lakiernicze':
      return <Sparkles className="h-5 w-5 text-pink-500 mx-auto" />;
    case 'Opony i akcesoria':
      return <Disc className="h-5 w-5 text-rose-500 mx-auto" />;
    case 'Materiały eksploatacyjne':
      return <Package className="h-5 w-5 text-purple-500 mx-auto" />;
    case 'Elektryka pojazdowa':
      return <Zap className="h-5 w-5 text-yellow-500 mx-auto" />;
    case 'Kosmetyki samochodowe':
      return <Droplet className="h-5 w-5 text-sky-500 mx-auto" />;
    case 'Łączniki i pneumatyka':
      return <Plug className="h-5 w-5 text-emerald-500 mx-auto" />;
    default:
      return <Settings className="h-5 w-5 text-gray-500 mx-auto" />;
  }
};
import { cn } from '../../lib/utils';

interface MarketplaceHomeProps {
  onSearch: (query: string, location: string) => void;
  onSelectVendor: (slug: string) => void;
  onSelectCategory: (category: string) => void;
  onSelectProduct: (slug: string) => void;
  onSelectFlyer: (slug: string) => void;
  onToggleSaveProduct: (id: string) => void;
  savedProductIds: string[];
  onAddToEnquiry: (productId: string, qty: number, unit: 'szt' | 'paczka') => void;
}

export default function MarketplaceHome({
  onSearch,
  onSelectVendor,
  onSelectCategory,
  onSelectProduct,
  onSelectFlyer,
  onToggleSaveProduct,
  savedProductIds,
  onAddToEnquiry
}: MarketplaceHomeProps) {
  // Input fields state
  const [queryInput, setQueryInput] = useState('');
  const [locationInput, setLocationInput] = useState('');

  // Local add-to-basket success message state
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(queryInput, locationInput);
  };

  // Featured Vendors (e.g. verified or top rating)
  const featuredVendors = useMemo(() => {
    return mockVendors.slice(0, 4);
  }, []);

  // New arrivals products
  const newProducts = useMemo(() => {
    return mockProducts.filter(p => p.isNew).slice(0, 4);
  }, []);

  const handleQuickAdd = (productId: string, packSize: number, minQty: number) => {
    onAddToEnquiry(productId, minQty, 'paczka');
    setAddedProductId(productId);
    setTimeout(() => setAddedProductId(null), 2000);
  };

  return (
    <div className="space-y-12 animate-fade-in">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1E2B38] via-[#2A3B4C] to-[#0E151F] text-white py-16 md:py-24 px-4">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-blue-500/10 px-3.5 py-1 rounded-full text-blue-300 text-xs font-black uppercase tracking-widest">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-blue-400" />
            Otwarte wyszukiwanie dostawców B2B
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black font-display tracking-tight leading-none uppercase">
            Znajdź Certyfikowanych Dostawców <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">Ambra VMI</span>
          </h1>
          
          <p className="text-sm md:text-base text-gray-300 max-w-2xl mx-auto leading-relaxed font-medium">
            Przeglądaj asortyment hurtowy, sprawdzaj lokalizacje w Poznaniu i całej Polsce, pobieraj gazetki promocyjne i składaj zapytania ofertowe (RFQ) w jednym koszyku.
          </p>

          {/* Search Bar Form */}
          <form 
            onSubmit={handleSubmit}
            className="bg-white dark:bg-gray-900 p-2 rounded-2xl shadow-2xl flex flex-col md:flex-row items-stretch gap-2 max-w-3xl mx-auto text-gray-900"
          >
            <div className="flex-1 flex items-center gap-2 px-3 py-2 md:py-0 md:border-b-0 md:border-r">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <input 
                type="text" 
                placeholder="Szukaj produktu, marki lub dostawcy..." 
                value={queryInput}
                onChange={e => setQueryInput(e.target.value)}
                className="w-full text-xs font-bold bg-transparent outline-none dark:text-white"
              />
            </div>

            <div className="w-full md:w-56 flex items-center gap-2 px-3 py-2 md:py-0">
              <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
              <select
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                className="w-full text-xs font-bold bg-transparent outline-none dark:text-white cursor-pointer"
              >
                <option value="">Wszystkie miasta</option>
                {mockCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            <button 
              type="submit"
              className="py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black text-xs rounded-xl hover:shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              Wyszukaj dostawców
            </button>
          </form>

          {/* Popular Search Tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-wider pt-2">
            <span>Popularne:</span>
            {['Części', 'Castrol', 'Wurth', 'Narzędzia', 'Yato', 'BHP'].map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setQueryInput(tag);
                  onSearch(tag, locationInput);
                }}
                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-md transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. CATEGORIES CAROUSEL/SLIDER */}
      <section className="max-w-7xl mx-auto px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black font-display text-gray-900 dark:text-white uppercase tracking-tight">Kategorie B2B</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">Przeglądaj asortyment certyfikowany przez branżę.</p>
          </div>
          <button 
            onClick={() => onSelectCategory('Wszystko')}
            className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
          >
            Wszystkie <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {mockCategories.slice(0, 6).map((cat) => {
            return (
              <div 
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className="bg-white dark:bg-gray-900 rounded-xl p-4 text-center shadow-md hover:shadow-lg cursor-pointer group transition-all"
              >
                <div className="mb-2.5 group-hover:scale-110 transition-transform flex justify-center">
                  {getCategoryIcon(cat)}
                </div>
                <h4 className="font-extrabold text-[11px] text-gray-800 dark:text-gray-200 line-clamp-1 group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                  {cat}
                </h4>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. PROMOTED VENDORS (12 Vendors Available in system) */}
      <section className="max-w-7xl mx-auto px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black font-display text-gray-900 dark:text-white uppercase tracking-tight">Wyróżnieni Dostawcy</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">Certyfikowani producenci i dystrybutorzy o sprawdzonej wydajności logistycznej.</p>
          </div>
          <button 
            onClick={() => onSearch('', '')}
            className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
          >
            Pokaż wszystkich (12) <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredVendors.map(vendor => (
            <div 
              key={vendor.id}
              className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all group flex flex-col h-full"
            >
              {/* Cover photo */}
              <div className="h-28 relative bg-gray-50 dark:bg-gray-950 overflow-hidden">
                <img 
                  src={vendor.coverUrl} 
                  alt={vendor.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute top-3 right-3 bg-white/90 dark:bg-gray-900/90 text-[9px] font-black tracking-wide uppercase px-2.5 py-1 rounded-full text-gray-700 dark:text-white shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                  {vendor.city}
                </div>
              </div>

              {/* Header Info */}
              <div className="p-5 flex-1 flex flex-col space-y-4">
                <div className="flex items-start gap-3 relative -mt-10">
                  <img 
                    src={vendor.logoUrl} 
                    alt={vendor.name} 
                    className="w-12 h-12 rounded-xl object-cover bg-white p-1 shadow-md relative z-10" 
                  />
                  <div className="pt-8">
                    <span className="text-[9px] font-black tracking-widest text-blue-600 dark:text-blue-400 uppercase font-mono bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">
                      {vendor.category}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                      {vendor.name}
                    </h3>
                    {vendor.isVerified && (
                      <span title="Dostawca zweryfikowany">
                        <ShieldCheck className="h-4 w-4 text-blue-500 fill-blue-500/10 shrink-0" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    {vendor.shortDescription}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {vendor.featuredBrands.map(brand => (
                      <span key={brand} className="inline-block bg-gray-50 dark:bg-gray-800 text-[8px] font-bold text-gray-400 dark:text-gray-300 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                        {brand}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-gray-50/50 dark:bg-gray-850/20 flex items-center justify-between gap-2 mt-auto">
                <span className="text-[10px] text-gray-400 font-medium">
                  {vendor.responseTimeText}
                </span>
                <button 
                  onClick={() => onSelectVendor(vendor.slug)}
                  className="py-1.5 px-3.5 bg-[#2A3B4C] dark:bg-blue-600 hover:brightness-110 text-white font-black text-[10px] rounded-lg transition-all flex items-center gap-0.5 cursor-pointer uppercase tracking-wider"
                >
                  Otwórz profil <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. DIGITAL PROMOTIONAL LEAFLETS / FLYERS */}
      <section className="bg-white dark:bg-[#0E1321] py-12">
        <div className="max-w-7xl mx-auto px-4 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black font-display text-gray-900 dark:text-white uppercase tracking-tight">Aktywne Gazetki Produktowe B2B</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">Wygodne, interaktywne gazetki promocyjne dostawców. Zamawiaj bezpośrednio ze stron gazetki.</p>
            </div>
            <button 
              onClick={() => onSelectCategory('Wszystko')} 
              className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
            >
              Wszystkie gazetki <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {mockFlyers.slice(0, 4).map(flyer => {
              const vendor = mockVendors.find(v => v.id === flyer.vendorId);
              return (
                <div 
                  key={flyer.id}
                  onClick={() => onSelectFlyer(flyer.slug)}
                  className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all group cursor-pointer"
                >
                  <div className="aspect-[3/4] relative overflow-hidden bg-gray-50 dark:bg-gray-950">
                    <img 
                      src={flyer.coverUrl} 
                      alt={flyer.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-4">
                      <span className="text-[8px] font-black tracking-widest text-blue-400 font-mono uppercase mb-1 bg-blue-950/40 px-2 py-0.5 rounded w-fit">
                        {vendor?.name}
                      </span>
                      <h4 className="text-white font-bold text-xs line-clamp-2 leading-tight">{flyer.title}</h4>
                    </div>
                  </div>
                  <div className="p-3.5 flex items-center justify-between text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                      {flyer.pages.length} strony
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5 hover:underline">
                      Przeglądaj <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. NEW ARRIVALS PRODUCTS / CARDS - Hidden for MVP */}
      {false && (
      <section className="max-w-7xl mx-auto px-4 space-y-6">
        <div>
          <h2 className="text-base font-black font-display text-gray-900 dark:text-white uppercase tracking-tight">Nowości produktowe</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Najnowszy asortyment hurtowy zgłoszony przez zweryfikowanych partnerów.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {newProducts.map(product => {
            const vendor = mockVendors.find(v => v.id === product.vendorId)!;
            const isSaved = savedProductIds.includes(product.id);
            return (
              <div 
                key={product.id}
                className="bg-white dark:bg-gray-900 rounded-xl p-4 flex flex-col h-full hover:shadow-md transition-all group"
              >
                {/* Image and actions */}
                <div className="aspect-square relative bg-gray-50 dark:bg-gray-950 rounded-lg overflow-hidden mb-3.5">
                  <img 
                    src={product.imageUrl} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                  />
                  
                  {/* Badge */}
                  <span className="absolute top-2.5 left-2.5 bg-blue-600 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                    NOWOŚĆ
                  </span>

                  {/* Save button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSaveProduct(product.id);
                    }}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-white/90 dark:bg-gray-900/90 shadow-sm text-gray-400 dark:text-gray-500 hover:text-rose-500 hover:scale-105 transition-all cursor-pointer"
                  >
                    <Heart className={cn("h-3.5 w-3.5", isSaved && "fill-rose-500 text-rose-500")} />
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1 flex flex-col space-y-2 text-left">
                  <span className="text-[8px] font-black tracking-widest text-blue-600 dark:text-blue-400 uppercase font-mono">
                    {product.brand} • {vendor.name}
                  </span>
                  
                  <h3 
                    onClick={() => onSelectProduct(product.slug)}
                    className="font-bold text-xs text-gray-900 dark:text-white group-hover:text-blue-600 hover:underline transition-colors cursor-pointer line-clamp-2 leading-tight"
                  >
                    {product.name}
                  </h3>

                  {/* Pricing Display */}
                  <div className="pt-1">
                    {product.priceMode === 'exact' && product.priceValue && (
                      <div>
                        <span className="text-gray-400 text-[10px] font-semibold">Cena hurtowa od:</span>
                        <p className="font-extrabold text-xs text-gray-950 dark:text-white">
                          {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN <span className="text-[10px] text-gray-400 font-normal">/{product.unit}</span>
                        </p>
                      </div>
                    )}
                    {product.priceMode === 'from' && product.priceValue && (
                      <div>
                        <span className="text-gray-400 text-[10px] font-semibold">Cena od:</span>
                        <p className="font-extrabold text-xs text-gray-950 dark:text-white">
                          {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN <span className="text-[10px] text-gray-400 font-normal">/{product.unit}</span>
                        </p>
                      </div>
                    )}
                    {product.priceMode === 'range' && product.priceValue && product.priceMax && (
                      <div>
                        <span className="text-gray-400 text-[10px] font-semibold font-mono uppercase">Przedział cenowy:</span>
                        <p className="font-extrabold text-xs text-gray-950 dark:text-white">
                          {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} - {product.priceMax.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                        </p>
                      </div>
                    )}
                    {product.priceMode === 'on_request' && (
                      <div>
                        <span className="text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase tracking-wider font-mono bg-orange-50 dark:bg-orange-950/20 px-2 py-0.5 rounded">
                          Cena na zapytanie
                        </span>
                      </div>
                    )}
                    {product.priceMode === 'after_login' && (
                      <div>
                        <span className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-wider font-mono bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 rounded">
                          Wycena po nawiązaniu współpracy
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA Action */}
                <div className="pt-3.5 mt-auto flex items-center justify-between gap-2">
                  <div className="text-[9px] text-gray-400 font-semibold">
                    Op: {product.packSize} {product.unit}
                  </div>

                  <button
                    onClick={() => handleQuickAdd(product.id, product.packSize, product.minEnquiryQty)}
                    disabled={addedProductId === product.id}
                    className={cn(
                      "py-1.5 px-3 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shrink-0",
                      addedProductId === product.id 
                        ? "bg-green-600 text-white" 
                        : "bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 dark:hover:bg-blue-950/40"
                    )}
                  >
                    {addedProductId === product.id ? (
                      <>Dodano ✓</>
                    ) : (
                      <>Do zapytania +</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* 6. ADVANTAGES BANNER */}
      <section className="bg-gradient-to-br from-[#2A3B4C] to-[#1E2B38] text-white py-12 px-4 rounded-3xl max-w-7xl mx-auto w-full shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px)] bg-[size:16px_16px]" />
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left relative z-10">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 mx-auto md:mx-0">
              <Check className="h-5 w-5" />
            </div>
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-blue-300">Weryfikacja Kontrahentów</h3>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              Wszyscy dostawcy w bazie Ambra przechodzą rygorystyczną weryfikację handlową, gwarantując bezpieczne warunki współpracy i stałą jakość.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 mx-auto md:mx-0">
              <Package className="h-5 w-5" />
            </div>
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-blue-300">Koszyk Wielodostawców</h3>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              Złóż jedno duże zapytanie ofertowe (RFQ) do wielu dostawców jednocześnie. Nasz silnik automatycznie podzieli zapytania i przekaże je do właściwych firm.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 mx-auto md:mx-0">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-blue-300">Integracja VMI (Vendor Managed Inventory)</h3>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              Nawiąż bezpośrednią współpracę i wejdź na wyższy poziom, pozwalając dostawcom zarządzać stanami magazynowymi w Twoim warsztacie w trybie VMI.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
