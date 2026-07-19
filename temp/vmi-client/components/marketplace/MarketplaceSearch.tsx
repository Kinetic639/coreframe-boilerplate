'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  mockVendors, 
  mockProducts, 
  mockCatalogs, 
  mockPromotions, 
  mockFlyers, 
  mockCities, 
  mockCategories,
  mockBrands
} from './mockData';
import { PublicVendor, PublicProduct } from './types';
import { 
  Search, 
  MapPin, 
  Filter, 
  Sparkles, 
  ShieldCheck, 
  Truck, 
  Compass, 
  Map, 
  List, 
  SlidersHorizontal, 
  ArrowUpDown, 
  Heart,
  ChevronRight,
  Info,
  Phone,
  Mail,
  Navigation,
  X,
  Building2,
  ShoppingBag
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface MarketplaceSearchProps {
  initialTab: 'wszystko' | 'produkty' | 'dostawcy';
  query: string;
  location: string;
  initialCategory: string;
  recentSearches: string[];
  onSearch: (query: string, location: string) => void;
  onClearQuery: () => void;
  onClearLocation: () => void;
  onSelectVendor: (slug: string) => void;
  onSelectProduct: (slug: string) => void;
  onSelectFlyer: (slug: string) => void;
  onToggleSaveProduct: (id: string) => void;
  onToggleSaveVendor: (id: string) => void;
  savedProductIds: string[];
  savedVendorIds: string[];
  onAddToEnquiry: (productId: string, qty: number, unit: 'szt' | 'paczka') => void;
  isLoggedIn?: boolean;
}

// Fixed coordinate offsets for our vendors on the 2D map
const vendorMapPins: Record<string, { x: number; y: number }> = {
  'mv-1': { x: 50, y: 50 },  // AutoParts Pro - Poznań
  'mv-2': { x: 42, y: 58 },  // WerkTools - Komorniki
  'mv-3': { x: 48, y: 56 },  // CleanChem - Luboń
  'mv-4': { x: 38, y: 46 },  // SafetyCore - Swadzim
  'mv-5': { x: 48, y: 48 },  // LakierTech - Poznań
  'mv-6': { x: 65, y: 32 },  // MotoFiltry - Gniezno
  'mv-7': { x: 75, y: 78 },  // ProfiOpony - Kalisz
  'mv-8': { x: 30, y: 90 },  // Serwis Supply - Wrocław
  'mv-9': { x: 36, y: 43 },  // TruckParts - Sady
  'mv-10': { x: 80, y: 55 }, // Warsztat Plus - Konin
  'mv-11': { x: 56, y: 48 }, // ElectroCar - Swarzędz
  'mv-12': { x: 50, y: 46 }  // FastMover - Poznań
};

export default function MarketplaceSearch({
  initialTab,
  query,
  location,
  initialCategory,
  recentSearches,
  onSearch,
  onClearQuery,
  onClearLocation,
  onSelectVendor,
  onSelectProduct,
  onSelectFlyer,
  onToggleSaveProduct,
  onToggleSaveVendor,
  savedProductIds,
  savedVendorIds,
  onAddToEnquiry,
  isLoggedIn = false
}: MarketplaceSearchProps) {
  // Tabs & Views
  const [activeTab, setActiveTab] = useState<'wszystko' | 'produkty' | 'dostawcy'>(initialTab);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list'); // relevant for mobile

  // Local filter states
  const [searchTerm, setSearchTerm] = useState(query);
  const [selectedCity, setSelectedCity] = useState(location);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedBrand, setSelectedBrand] = useState('Wszystkie');
  
  const [filterVerified, setFilterVerified] = useState(false);
  const [filterDelivery, setFilterDelivery] = useState(false);
  const [filterCollection, setFilterCollection] = useState(false);
  const [maxDistance, setMaxDistance] = useState<number>(200);
  const [sortBy, setSortBy] = useState<'name' | 'distance' | 'completeness'>('name');

  // Map state
  const [hoveredVendorId, setHoveredVendorId] = useState<string | null>(null);
  const [selectedMapVendor, setSelectedMapVendor] = useState<PublicVendor | null>(null);

  // Sync inputs with parent properties using state-from-prop rendering pattern
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setSearchTerm(query);
    setPrevQuery(query);
  }

  const [prevLocation, setPrevLocation] = useState(location);
  if (location !== prevLocation) {
    setSelectedCity(location);
    setPrevLocation(location);
  }

  const [prevInitialCategory, setPrevInitialCategory] = useState(initialCategory);
  if (initialCategory !== prevInitialCategory) {
    setSelectedCategory(initialCategory);
    setPrevInitialCategory(initialCategory);
  }

  const handleApplySearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSearch(searchTerm, selectedCity);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCity('');
    setSelectedCategory('Wszystko');
    setSelectedBrand('Wszystkie');
    setFilterVerified(false);
    setFilterDelivery(false);
    setFilterCollection(false);
    setMaxDistance(200);
    onClearQuery();
    onClearLocation();
  };

  // Filtered Vendors List
  const filteredVendors = useMemo(() => {
    return mockVendors.filter(vendor => {
      // Search text match (Name, short desc, brands)
      const matchesSearch = !searchTerm || 
        vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.shortDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.featuredBrands.some(b => b.toLowerCase().includes(searchTerm.toLowerCase()));

      // City filter
      const matchesCity = !selectedCity || vendor.city === selectedCity;

      // Category filter
      const matchesCategory = selectedCategory === 'Wszystko' || vendor.productCategories.includes(selectedCategory);

      // Verified filter
      const matchesVerified = !filterVerified || vendor.isVerified;

      // Logistics flags
      const matchesDelivery = !filterDelivery || vendor.deliveryAvailable;
      const matchesCollection = !filterCollection || vendor.collectionAvailable;

      // Distance
      const matchesDistance = vendor.distanceKm <= maxDistance;

      return matchesSearch && matchesCity && matchesCategory && matchesVerified && matchesDelivery && matchesCollection && matchesDistance;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'distance') return a.distanceKm - b.distanceKm;
      if (sortBy === 'completeness') return b.profileCompleteness - a.profileCompleteness;
      return 0;
    });
  }, [searchTerm, selectedCity, selectedCategory, filterVerified, filterDelivery, filterCollection, maxDistance, sortBy]);

  // Filtered Products List
  const filteredProducts = useMemo(() => {
    return mockProducts.filter(product => {
      const vendor = mockVendors.find(v => v.id === product.vendorId);
      if (!vendor) return false;

      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCity = !selectedCity || vendor.city === selectedCity;

      const matchesCategory = selectedCategory === 'Wszystko' || product.category === selectedCategory;

      const matchesBrand = selectedBrand === 'Wszystkie' || product.brand === selectedBrand;

      return matchesSearch && matchesCity && matchesCategory && matchesBrand;
    });
  }, [searchTerm, selectedCity, selectedCategory, selectedBrand]);

  // Handle Quick Add to Basket
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const handleQuickAdd = (productId: string, minQty: number) => {
    onAddToEnquiry(productId, minQty, 'paczka');
    setAddedProductId(productId);
    setTimeout(() => setAddedProductId(null), 1500);
  };

  return (
    <div className={cn(
      "max-w-7xl mx-auto space-y-6 animate-fade-in flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-6rem)] overflow-hidden",
      isLoggedIn ? "p-0" : "px-4 py-6"
    )}>
      {/* 1. FILTERING FORM HEADER */}
      <form onSubmit={handleApplySearch} className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm space-y-3 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Text Input */}
          <div className="md:col-span-2 bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input 
              type="text" 
              placeholder="Czego dzisiaj szukasz? (np. Castrol, hamulce, Yato...)"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs font-bold bg-transparent outline-none dark:text-white"
            />
            {searchTerm && (
              <button type="button" onClick={() => { setSearchTerm(''); onClearQuery(); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* City Selector */}
          <div className="bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
            <select
              value={selectedCity}
              onChange={e => { setSelectedCity(e.target.value); onSearch(searchTerm, e.target.value); }}
              className="w-full text-xs font-bold bg-transparent outline-none dark:text-white cursor-pointer"
            >
              <option value="">Wszystkie miasta</option>
              {mockCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {/* Category Selector */}
          <div className="bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full text-xs font-bold bg-transparent outline-none dark:text-white cursor-pointer"
            >
              <option value="Wszystko">Wszystkie kategorie</option>
              {mockCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Extended filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] text-gray-500">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 font-bold cursor-pointer dark:text-gray-300">
              <input 
                type="checkbox" 
                checked={filterVerified} 
                onChange={e => setFilterVerified(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500" 
              />
              <span>Tylko zweryfikowani ✓</span>
            </label>

            <label className="flex items-center gap-1.5 font-bold cursor-pointer dark:text-gray-300">
              <input 
                type="checkbox" 
                checked={filterDelivery} 
                onChange={e => setFilterDelivery(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500" 
              />
              <span>Wysyłka kurierska 🚚</span>
            </label>

            <label className="flex items-center gap-1.5 font-bold cursor-pointer dark:text-gray-300">
              <input 
                type="checkbox" 
                checked={filterCollection} 
                onChange={e => setFilterCollection(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500" 
              />
              <span>Odbiór osobisty 🏢</span>
            </label>

            {activeTab === 'wszystko' && (
              <div className="flex items-center gap-2">
                <span>Dystans do:</span>
                <input 
                  type="range" 
                  min="5" 
                  max="200" 
                  value={maxDistance} 
                  onChange={e => setMaxDistance(parseInt(e.target.value))}
                  className="w-24 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg cursor-pointer accent-blue-600" 
                />
                <span className="font-extrabold">{maxDistance} km</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={handleResetFilters}
              className="text-xs font-extrabold text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Resetuj filtry
            </button>
            <button 
              type="submit"
              className="py-1 px-4 bg-[#2A3B4C] text-white rounded-lg font-black text-[10px] uppercase cursor-pointer"
            >
              Filtruj
            </button>
          </div>
        </div>
      </form>

      {/* TABS SELECTOR & MOBILE VIEW TOGGLE */}
      <div className="flex items-center justify-between shrink-0 pb-2">
        <div className="flex items-center gap-1">
          {(['wszystko', 'produkty', 'dostawcy'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'dostawcy') setViewMode('list');
              }}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                activeTab === tab 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-850"
              )}
            >
              {tab === 'wszystko' ? 'Wszystko' : tab === 'produkty' ? `Produkty (${filteredProducts.length})` : `Dostawcy (${filteredVendors.length})`}
            </button>
          ))}
        </div>

        {/* Mobile View toggler */}
        <div className="lg:hidden">
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
            className="p-1.5 bg-[#2A3B4C] text-white rounded-lg text-xs font-black uppercase tracking-wide flex items-center gap-1"
          >
            {viewMode === 'list' ? (
              <><Map className="h-3.5 w-3.5" /> Mapa</>
            ) : (
              <><List className="h-3.5 w-3.5" /> Lista</>
            )}
          </button>
        </div>

        {/* Sort Select on Desktop */}
        <div className="hidden lg:flex items-center gap-2 text-xs">
          <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-gray-400 font-medium">Sortuj według:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="font-bold bg-transparent outline-none cursor-pointer text-gray-700 dark:text-gray-200"
          >
            <option value="name">Nazwa A-Z</option>
            <option value="distance">Dystans (km)</option>
            <option value="completeness">Kompletność profilu</option>
          </select>
        </div>
      </div>

      {/* CORE SPLIT AREA: LIST ON LEFT, INTERACTIVE MAP ON RIGHT */}
      <div className="flex-1 flex items-stretch gap-6 overflow-hidden min-h-0">
        {/* LEFT COLUMN: RESULT LIST */}
        <div className={cn(
          "flex-1 overflow-y-auto pr-1 space-y-4 h-full",
          viewMode === 'map' ? 'hidden lg:block' : 'block'
        )}>
          {activeTab === 'wszystko' && (
            <div className="space-y-6">
              {/* Vendors Segment */}
              <div className="space-y-3">
                <h3 className="text-xs font-black tracking-widest text-gray-400 uppercase font-mono pb-1">Zweryfikowani Dostawcy ({filteredVendors.length})</h3>
                {filteredVendors.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Brak pasujących dostawców.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredVendors.slice(0, 4).map(vendor => (
                      <VendorResultCard 
                        key={vendor.id} 
                        vendor={vendor} 
                        isSaved={savedVendorIds.includes(vendor.id)}
                        onSave={() => onToggleSaveVendor(vendor.id)}
                        onSelect={() => onSelectVendor(vendor.slug)}
                        onHoverEnter={() => setHoveredVendorId(vendor.id)}
                        onHoverLeave={() => setHoveredVendorId(null)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Products Segment */}
              <div className="space-y-3">
                <h3 className="text-xs font-black tracking-widest text-gray-400 uppercase font-mono pb-1">Pasujące produkty ({filteredProducts.length})</h3>
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Brak pasujących produktów.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredProducts.slice(0, 6).map(product => (
                      <ProductResultCard 
                        key={product.id} 
                        product={product} 
                        isSaved={savedProductIds.includes(product.id)}
                        onSave={() => onToggleSaveProduct(product.id)}
                        onSelect={() => onSelectProduct(product.slug)}
                        onQuickAdd={(id) => handleQuickAdd(id, product.minEnquiryQty)}
                        addedProductId={addedProductId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'dostawcy' && (
            <div className="space-y-4">
              <h3 className="text-xs font-black tracking-widest text-gray-400 uppercase font-mono pb-1">Dostawcy w Twojej okolicy ({filteredVendors.length})</h3>
              {filteredVendors.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl shadow-md space-y-2">
                  <div className="flex justify-center">
                    <Building2 className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 font-bold">Brak dostawców spełniających kryteria wyszukiwania.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredVendors.map(vendor => (
                    <VendorResultCard 
                      key={vendor.id} 
                      vendor={vendor} 
                      isSaved={savedVendorIds.includes(vendor.id)}
                      onSave={() => onToggleSaveVendor(vendor.id)}
                      onSelect={() => onSelectVendor(vendor.slug)}
                      onHoverEnter={() => setHoveredVendorId(vendor.id)}
                      onHoverLeave={() => setHoveredVendorId(null)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'produkty' && (
            <div className="space-y-4">
              <h3 className="text-xs font-black tracking-widest text-gray-400 uppercase font-mono pb-1">Katalog produktów ({filteredProducts.length})</h3>
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl shadow-md space-y-2">
                  <div className="flex justify-center">
                    <ShoppingBag className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 font-bold">Brak produktów spełniających wybrane kryteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map(product => (
                    <ProductResultCard 
                      key={product.id} 
                      product={product} 
                      isSaved={savedProductIds.includes(product.id)}
                      onSave={() => onToggleSaveProduct(product.id)}
                      onSelect={() => onSelectProduct(product.slug)}
                      onQuickAdd={(id) => handleQuickAdd(id, product.minEnquiryQty)}
                      addedProductId={addedProductId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: INTERACTIVE VECTOR MAP */}
        <div className={cn(
          "flex-1 bg-white dark:bg-gray-950 rounded-2xl overflow-hidden flex flex-col relative h-full",
          viewMode === 'list' ? 'hidden lg:flex' : 'flex'
        )}>
          {/* Map Controls */}
          <div className="absolute top-4 left-4 bg-white/95 dark:bg-gray-900/95 p-3 rounded-xl shadow-lg z-10 max-w-xs space-y-1 text-left">
            <h4 className="font-extrabold text-[10px] text-gray-400 uppercase tracking-widest font-mono">Region Wielkopolski</h4>
            <p className="text-[11px] font-bold text-gray-800 dark:text-gray-100 leading-tight">Mapa i odległość logistyczna</p>
            <p className="text-[9px] text-gray-400 leading-normal">Klikaj na pinezki na mapie, aby otworzyć szczegóły i sprawdzić zasięg kurierski danego partnera handlowego.</p>
          </div>

          {/* SVG Map Canvas */}
          <div className="flex-1 w-full bg-blue-50/10 dark:bg-[#080B12] relative overflow-hidden flex items-center justify-center">
            {/* Compass Grid Visual */}
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff04_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff02_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="absolute w-44 h-44 rounded-full opacity-20 pointer-events-none" />

            {/* Simulated Poznań center circle marker */}
            <div className="absolute left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-600/15 flex items-center justify-center pointer-events-none">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
            </div>
            <span className="absolute left-[52%] top-[52%] text-[9px] font-black text-blue-600 dark:text-blue-400 opacity-40 uppercase tracking-wider font-mono pointer-events-none">
              Poznań (Ośrodek)
            </span>

            {/* Interactive map markers */}
            {filteredVendors.map(vendor => {
              const coords = vendorMapPins[vendor.id] || { x: 50, y: 50 };
              const isHovered = hoveredVendorId === vendor.id || (selectedMapVendor?.id === vendor.id);
              return (
                <button
                  key={vendor.id}
                  onClick={() => setSelectedMapVendor(vendor)}
                  onMouseEnter={() => setHoveredVendorId(vendor.id)}
                  onMouseLeave={() => setHoveredVendorId(null)}
                  style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-300 z-10"
                >
                  {/* Ripple Ring */}
                  <span className={cn(
                    "absolute -inset-2.5 rounded-full bg-blue-500/10 dark:bg-blue-400/15 opacity-0 group-hover:opacity-100 transition-all",
                    isHovered && "scale-110 opacity-100 animate-pulse"
                  )} />

                  {/* Marker Pin */}
                  <div className={cn(
                    "w-6 h-6 rounded-full bg-white dark:bg-gray-900 shadow-md flex items-center justify-center relative transition-all cursor-pointer",
                    isHovered ? "scale-125 z-20 shadow-lg" : ""
                  )}>
                    <MapPin className={cn(
                      "h-3 w-3 text-gray-500",
                      isHovered ? "text-blue-600 dark:text-blue-400 scale-110" : "text-gray-400"
                    )} />
                  </div>

                  {/* Quick tooltip banner on hover */}
                  <div className={cn(
                    "absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#2A3B4C] dark:bg-gray-900 text-white font-bold text-[9px] px-2.5 py-1 rounded-md opacity-0 scale-90 pointer-events-none transition-all shadow-md shrink-0 whitespace-nowrap z-30 uppercase tracking-wider",
                    (hoveredVendorId === vendor.id) && "opacity-100 scale-100"
                  )}>
                    {vendor.name} ({vendor.distanceKm}km)
                  </div>
                </button>
              );
            })}
          </div>

          {/* Map Vendor Detail Drawer (when clicked) */}
          {selectedMapVendor && (
            <div className="bg-white dark:bg-gray-900 p-4 animate-slide-up flex items-center justify-between gap-3 shrink-0 text-left">
              <div className="flex items-center gap-3">
                <img src={selectedMapVendor.logoUrl} alt={selectedMapVendor.name} className="w-11 h-11 rounded-lg object-cover bg-gray-50" />
                <div>
                  <div className="flex items-center gap-1">
                    <h4 className="font-extrabold text-xs text-gray-900 dark:text-white uppercase tracking-tight">{selectedMapVendor.name}</h4>
                    {selectedMapVendor.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium">{selectedMapVendor.city} • Odległość: {selectedMapVendor.distanceKm} km</p>
                  <p className="text-[10px] text-gray-500 line-clamp-1 max-w-md mt-0.5">{selectedMapVendor.shortDescription}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => setSelectedMapVendor(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 dark:hover:bg-gray-850"
                  title="Zamknij"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={() => onSelectVendor(selectedMapVendor.slug)}
                  className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] rounded-lg uppercase cursor-pointer"
                >
                  Zobacz profil
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Result Card Component: Vendor
interface VendorResultCardProps {
  vendor: PublicVendor;
  isSaved: boolean;
  onSave: () => void;
  onSelect: () => void;
  onHoverEnter?: () => void;
  onHoverLeave?: () => void;
}

function VendorResultCard({ vendor, isSaved, onSave, onSelect, onHoverEnter, onHoverLeave }: VendorResultCardProps) {
  return (
    <div 
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      className="bg-white dark:bg-gray-900 rounded-xl p-4 flex flex-col justify-between shadow-md hover:shadow-lg transition-all group text-left"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <img src={vendor.logoUrl} alt={vendor.name} className="w-11 h-11 rounded-lg object-cover bg-gray-50 shrink-0" />
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-extrabold text-xs text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors uppercase tracking-tight">{vendor.name}</h4>
              {vendor.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-blue-500 fill-blue-500/10 shrink-0" />}
            </div>
            <span className="text-[9px] font-black tracking-wider text-blue-600 dark:text-blue-400 uppercase font-mono">
              {vendor.category}
            </span>
          </div>
        </div>

        {/* Save */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          className="p-1 text-gray-400 hover:text-rose-500 cursor-pointer"
        >
          <Heart className={cn("h-4 w-4", isSaved && "fill-rose-500 text-rose-500")} />
        </button>
      </div>

      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal line-clamp-2 mb-4">
        {vendor.shortDescription}
      </p>

      <div className="pt-3 flex items-center justify-between text-[10px] text-gray-400 font-semibold uppercase font-mono">
        <div className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-gray-400" />
          <span>{vendor.city} ({vendor.distanceKm} km)</span>
        </div>
        <button 
          onClick={onSelect}
          className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
        >
          Otwórz <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// Result Card Component: Product
interface ProductResultCardProps {
  product: PublicProduct;
  isSaved: boolean;
  onSave: () => void;
  onSelect: () => void;
  onQuickAdd: (productId: string) => void;
  addedProductId: string | null;
}

function ProductResultCard({ product, isSaved, onSave, onSelect, onQuickAdd, addedProductId }: ProductResultCardProps) {
  const vendor = mockVendors.find(v => v.id === product.vendorId);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-3.5 flex flex-col justify-between shadow-md hover:shadow-lg transition-all group text-left">
      <div>
        {/* Photo + badge & save */}
        <div className="aspect-square relative bg-gray-50 dark:bg-gray-950 rounded-lg overflow-hidden mb-3">
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/95 dark:bg-gray-900/95 shadow-sm text-gray-400 hover:text-rose-500 cursor-pointer"
          >
            <Heart className={cn("h-3.5 w-3.5", isSaved && "fill-rose-500 text-rose-500")} />
          </button>
        </div>

        {/* Info */}
        <div className="space-y-1.5">
          <span className="text-[8px] font-black tracking-widest text-blue-600 dark:text-blue-400 uppercase font-mono">
            {product.brand} • {vendor?.name}
          </span>
          <h4 
            onClick={onSelect}
            className="font-bold text-xs text-gray-900 dark:text-white group-hover:text-blue-600 hover:underline cursor-pointer line-clamp-2 leading-snug"
          >
            {product.name}
          </h4>

          {/* Pricing */}
          <div className="pt-0.5">
            {product.priceMode === 'exact' && product.priceValue && (
              <p className="font-extrabold text-xs text-gray-950 dark:text-white">
                {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN <span className="text-[9px] text-gray-400 font-normal">/{product.unit}</span>
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
              <span className="text-orange-600 dark:text-orange-400 text-[9px] font-black uppercase tracking-wider font-mono">
                Cena na zapytanie
              </span>
            )}
            {product.priceMode === 'after_login' && (
              <span className="text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-wider font-mono">
                Cena po zalogowaniu
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="pt-3 mt-3 flex items-center justify-between gap-1.5 text-[9px] text-gray-400">
        <span>Op. zbiorcze: {product.packSize}</span>
        
        <button
          onClick={() => onQuickAdd(product.id)}
          disabled={addedProductId === product.id}
          className={cn(
            "py-1 px-2.5 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer shrink-0",
            addedProductId === product.id 
              ? "bg-green-600 text-white" 
              : "bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400"
          )}
        >
          {addedProductId === product.id ? 'Dodano ✓' : 'Zapytaj +'}
        </button>
      </div>
    </div>
  );
}
