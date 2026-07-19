'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  mockVendors, 
  mockProducts, 
  mockCatalogs, 
  mockPromotions, 
  mockFlyers, 
  mockCities, 
  mockCategories 
} from './mockData';
import { 
  PublicVendor, 
  PublicProduct, 
  PublicCatalog, 
  PublicPromotion, 
  PublicFlyer, 
  SavedMarketplaceItem, 
  EnquiryBasketGroup, 
  PublicQuotationRequest, 
  EnquiryLine 
} from './types';
import { 
  Search, 
  MapPin, 
  Heart, 
  User, 
  ShoppingBag, 
  ChevronRight, 
  HelpCircle, 
  Info, 
  Building2, 
  Grid, 
  Tag, 
  BookOpen, 
  FileText, 
  Menu, 
  X, 
  LogIn,
  CheckCircle,
  ArrowLeft,
  Navigation,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  Moon,
  Sun,
  Home
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Subcomponents imports (we will create them next)
import MarketplaceHome from './MarketplaceHome';
import MarketplaceSearch from './MarketplaceSearch';
import MarketplaceVendorProfile from './MarketplaceVendorProfile';
import MarketplaceProductDetail from './MarketplaceProductDetail';
import MarketplaceFlyerViewer from './MarketplaceFlyerViewer';
import MarketplaceInfo from './MarketplaceInfo';

interface MarketplaceContainerProps {
  onLoginClick: () => void;
  isLoggedIn: boolean;
  onGoToPortal: () => void;
  theme?: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
  initialPath?: string;
}

export default function MarketplaceContainer({ 
  onLoginClick, 
  isLoggedIn, 
  onGoToPortal,
  theme = 'light',
  setTheme,
  initialPath
}: MarketplaceContainerProps) {
  // Navigation Path Router State (Client side) - initialize synchronously from current location
  const [activePath, setActivePath] = useState<string>(() => {
    if (initialPath) return initialPath;
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });

  const [selectedVendorSlug, setSelectedVendorSlug] = useState<string | null>(() => {
    if (initialPath && initialPath.startsWith('/dostawcy/')) {
      return initialPath.split('/dostawcy/')[1] || null;
    }
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/dostawcy/')) {
        return path.split('/dostawcy/')[1] || null;
      }
    }
    return null;
  });

  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(() => {
    if (initialPath && initialPath.startsWith('/produkty/')) {
      return initialPath.split('/produkty/')[1] || null;
    }
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/produkty/')) {
        return path.split('/produkty/')[1] || null;
      }
    }
    return null;
  });

  const [selectedFlyerSlug, setSelectedFlyerSlug] = useState<string | null>(() => {
    if (initialPath && initialPath.startsWith('/gazetki/')) {
      return initialPath.split('/gazetki/')[1] || null;
    }
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/gazetki/')) {
        return path.split('/gazetki/')[1] || null;
      }
    }
    return null;
  });

  const parsePathAndSlugs = (path: string) => {
    if (path.startsWith('/dostawcy/')) {
      const slug = path.split('/dostawcy/')[1];
      setSelectedVendorSlug(slug || null);
    } else if (path.startsWith('/produkty/')) {
      const slug = path.split('/produkty/')[1];
      setSelectedProductSlug(slug || null);
    } else if (path.startsWith('/gazetki/')) {
      const slug = path.split('/gazetki/')[1];
      setSelectedFlyerSlug(slug || null);
    } else {
      setSelectedVendorSlug(null);
      setSelectedProductSlug(null);
      setSelectedFlyerSlug(null);
    }
  };

  useEffect(() => {
    if (initialPath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivePath(initialPath);
      parsePathAndSlugs(initialPath);
    }
  }, [initialPath]);

  // Navigation sync with back/forward browser buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setActivePath(path);
      parsePathAndSlugs(path);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    setActivePath(path);
    window.history.pushState({}, '', path);
    parsePathAndSlugs(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // State: Search Queries
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchLocation, setSearchLocation] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('Wszystko');
  
  // State: Saved items (localStorage: ambra-marketplace-saved)
  const [savedItems, setSavedItems] = useState<SavedMarketplaceItem[]>(() => {
    if (typeof window !== 'undefined') {
      const storedSaved = localStorage.getItem('ambra-marketplace-saved');
      return storedSaved ? JSON.parse(storedSaved) : [];
    }
    return [];
  });

  const activeSavedItems = isLoggedIn ? savedItems : [];

  // State: Enquiry Basket (localStorage: ambra-marketplace-enquiry)
  const [basket, setBasket] = useState<EnquiryBasketGroup[]>(() => {
    if (typeof window !== 'undefined') {
      const storedEnquiry = localStorage.getItem('ambra-marketplace-enquiry');
      return storedEnquiry ? JSON.parse(storedEnquiry) : [];
    }
    return [];
  });

  // State: Submitted Quotations (localStorage: ambra-marketplace-rfqs)
  const [submittedRfqs, setSubmittedRfqs] = useState<PublicQuotationRequest[]>(() => {
    if (typeof window !== 'undefined') {
      const storedRfqs = localStorage.getItem('ambra-marketplace-rfqs');
      return storedRfqs ? JSON.parse(storedRfqs) : [];
    }
    return [];
  });

  // State: Recent searches
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const storedRecent = localStorage.getItem('ambra-marketplace-search-history');
      return storedRecent ? JSON.parse(storedRecent) : [];
    }
    return [];
  });

  // Sync state helpers
  const saveSavedItems = (newSaved: SavedMarketplaceItem[]) => {
    setSavedItems(newSaved);
    localStorage.setItem('ambra-marketplace-saved', JSON.stringify(newSaved));
  };

  const saveBasket = (newBasket: EnquiryBasketGroup[]) => {
    setBasket(newBasket);
    localStorage.setItem('ambra-marketplace-enquiry', JSON.stringify(newBasket));
  };

  const saveRfqs = (newRfqs: PublicQuotationRequest[]) => {
    setSubmittedRfqs(newRfqs);
    localStorage.setItem('ambra-marketplace-rfqs', JSON.stringify(newRfqs));
  };

  const saveRecentSearches = (newRecent: string[]) => {
    setRecentSearches(newRecent);
    localStorage.setItem('ambra-marketplace-search-history', JSON.stringify(newRecent));
  };

  // Saved Interaction
  const handleToggleSave = (type: 'vendor' | 'product' | 'catalog' | 'promotion' | 'flyer', id: string) => {
    if (!isLoggedIn) {
      onLoginClick();
      return;
    }
    const exists = savedItems.find(item => item.type === type && item.id === id);
    if (exists) {
      saveSavedItems(savedItems.filter(item => !(item.type === type && item.id === id)));
    } else {
      saveSavedItems([...savedItems, { type, id, savedAt: new Date().toISOString() }]);
    }
  };

  const [toast, setToast] = useState<{ title: string; message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Toast auto-clear
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Enquiry Basket Operations (Refactored to vendor-specific drafts)
  const handleAddToEnquiry = (productId: string, quantity: number, unit: 'szt' | 'paczka') => {
    const product = mockProducts.find(p => p.id === productId);
    if (!product) return;

    const vendorId = product.vendorId;
    const vendor = mockVendors.find(v => v.id === vendorId);
    if (!vendor) return;

    const draftKey = `ambra-marketplace-request-draft-${vendorId}`;
    let existingDraft: any = null;
    
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        try {
          existingDraft = JSON.parse(stored);
        } catch (e) {
          console.error('Error parsing draft in handleAddToEnquiry', e);
        }
      }
    }

    let updatedItems: any[] = [];
    if (existingDraft && existingDraft.items) {
      updatedItems = [...existingDraft.items];
    }

    const itemIndex = updatedItems.findIndex(i => i.productId === productId);
    if (itemIndex > -1) {
      updatedItems[itemIndex].quantity += quantity;
    } else {
      updatedItems.push({
        productId,
        quantity,
        unit,
        allowSubstitutes: true,
        comment: '',
        deliveryDate: ''
      });
    }

    const currentDraft = existingDraft ? {
      ...existingDraft,
      items: updatedItems,
      lastModifiedDate: new Date().toISOString()
    } : {
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorSlug: vendor.slug,
      clientOrganization: 'AutoService Komorniki',
      branchId: 'loc-1',
      branchName: 'Komorniki Warsztat',
      items: updatedItems,
      overallMessage: '',
      deliveryDestination: 'ul. Poznańska 14, 62-052 Komorniki',
      urgency: 'Standardowe',
      partialResponseAllowed: true,
      preferredContactMethod: 'W aplikacji',
      subject: `Zapytanie o cenę i dostępność — ${updatedItems.length} ${updatedItems.length === 1 ? 'produkt' : (updatedItems.length > 1 && updatedItems.length < 5) ? 'produkty' : 'produktów'}`,
      createdDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString()
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(draftKey, JSON.stringify(currentDraft));
      window.dispatchEvent(new Event('storage'));
    }

    setToast({
      title: 'Dodano do zapytania RFQ',
      message: `Pomyślnie dodano produkt "${product.name}" do szkicu zapytania B2B dla dostawcy ${vendor.name}.`,
      type: 'success'
    });
  };

  const handleUpdateEnquiryItem = (vendorId: string, productId: string, fields: Partial<EnquiryLine>) => {
    const updatedBasket = basket.map(g => {
      if (g.vendorId === vendorId) {
        return {
          ...g,
          items: g.items.map(item => {
            if (item.productId === productId) {
              return { ...item, ...fields };
            }
            return item;
          })
        };
      }
      return g;
    });
    saveBasket(updatedBasket);
  };

  const handleRemoveFromEnquiry = (vendorId: string, productId: string) => {
    let updatedBasket = basket.map(g => {
      if (g.vendorId === vendorId) {
        return {
          ...g,
          items: g.items.filter(item => item.productId !== productId)
        };
      }
      return g;
    }).filter(g => g.items.length > 0);

    saveBasket(updatedBasket);
  };

  const handleClearBasketGroup = (vendorId: string) => {
    saveBasket(basket.filter(g => g.vendorId !== vendorId));
  };

  // Total items badge in basket
  const totalBasketItems = useMemo(() => {
    return basket.reduce((acc, group) => acc + group.items.length, 0);
  }, [basket]);

  // Mobile menu control
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Search logic handler from Home Search Form
  const handlePerformSearch = (query: string, loc: string) => {
    setSearchQuery(query);
    setSearchLocation(loc);
    
    // Add to search history
    if (query && !recentSearches.includes(query)) {
      const nextRecent = [query, ...recentSearches.slice(0, 4)];
      saveRecentSearches(nextRecent);
    }
    
    navigateTo('/wyszukiwarka');
  };

  // Rendering Routing Views
  const renderContent = () => {
    const activeSavedItems = isLoggedIn ? savedItems : [];

    if (activePath === '/') {
      return (
        <MarketplaceHome 
          onSearch={handlePerformSearch}
          onSelectVendor={(slug) => navigateTo(`/dostawcy/${slug}`)}
          onSelectCategory={(cat) => {
            setActiveCategory(cat);
            navigateTo('/wyszukiwarka');
          }}
          onSelectProduct={(slug) => navigateTo(`/produkty/${slug}`)}
          onSelectFlyer={(slug) => navigateTo(`/gazetki/${slug}`)}
          onToggleSaveProduct={(id) => handleToggleSave('product', id)}
          savedProductIds={activeSavedItems.filter(i => i.type === 'product').map(i => i.id)}
          onAddToEnquiry={handleAddToEnquiry}
        />
      );
    }

    if (activePath === '/wyszukiwarka' || activePath === '/produkty' || activePath === '/dostawcy') {
      // Determine search default tab based on path
      const defaultTab = activePath === '/dostawcy' ? 'dostawcy' : activePath === '/produkty' ? 'produkty' : 'wszystko';
      return (
        <MarketplaceSearch
          initialTab={defaultTab}
          query={searchQuery}
          location={searchLocation}
          initialCategory={activeCategory}
          recentSearches={recentSearches}
          onSearch={handlePerformSearch}
          onClearQuery={() => setSearchQuery('')}
          onClearLocation={() => setSearchLocation('')}
          onSelectVendor={(slug) => navigateTo(`/dostawcy/${slug}`)}
          onSelectProduct={(slug) => navigateTo(`/produkty/${slug}`)}
          onSelectFlyer={(slug) => navigateTo(`/gazetki/${slug}`)}
          onToggleSaveProduct={(id) => handleToggleSave('product', id)}
          onToggleSaveVendor={(id) => handleToggleSave('vendor', id)}
          savedProductIds={activeSavedItems.filter(i => i.type === 'product').map(i => i.id)}
          savedVendorIds={activeSavedItems.filter(i => i.type === 'vendor').map(i => i.id)}
          onAddToEnquiry={handleAddToEnquiry}
          isLoggedIn={isLoggedIn}
        />
      );
    }

    if (activePath.startsWith('/dostawcy/') && selectedVendorSlug) {
      const vendor = mockVendors.find(v => v.slug === selectedVendorSlug);
      if (!vendor) {
        return (
          <div className="max-w-md mx-auto py-16 text-center space-y-4">
            <h2 className="text-xl font-bold">Dostawca nie został znaleziony</h2>
            <button onClick={() => navigateTo('/')} className="px-4 py-2 bg-[#2A3B4C] text-white rounded-lg">Wróć na główną</button>
          </div>
        );
      }
      return (
        <MarketplaceVendorProfile
          vendor={vendor}
          onBack={() => navigateTo('/wyszukiwarka')}
          onSelectProduct={(slug) => navigateTo(`/produkty/${slug}`)}
          onSelectFlyer={(slug) => navigateTo(`/gazetki/${slug}`)}
          onToggleSaveVendor={() => handleToggleSave('vendor', vendor.id)}
          isSaved={activeSavedItems.some(i => i.type === 'vendor' && i.id === vendor.id)}
          savedProductIds={activeSavedItems.filter(i => i.type === 'product').map(i => i.id)}
          onToggleSaveProduct={(id) => handleToggleSave('product', id)}
          onAddToEnquiry={handleAddToEnquiry}
          basket={basket}
          isLoggedIn={isLoggedIn}
          onLoginClick={onLoginClick}
          onSelectVendor={(slug) => navigateTo(`/dostawcy/${slug}`)}
          onAddSubmittedRfq={(rfq) => {
            const nextRfqs = [rfq, ...submittedRfqs];
            saveRfqs(nextRfqs);
            // Trigger storage sync so all components get it
            window.dispatchEvent(new Event('storage'));
          }}
        />
      );
    }

    if (activePath.startsWith('/produkty/') && selectedProductSlug) {
      const product = mockProducts.find(p => p.slug === selectedProductSlug);
      if (!product) {
        return (
          <div className="max-w-md mx-auto py-16 text-center space-y-4">
            <h2 className="text-xl font-bold">Produkt nie został znaleziony</h2>
            <button onClick={() => navigateTo('/')} className="px-4 py-2 bg-[#2A3B4C] text-white rounded-lg">Wróć na główną</button>
          </div>
        );
      }
      const vendor = mockVendors.find(v => v.id === product.vendorId)!;
      return (
        <MarketplaceProductDetail
          product={product}
          vendor={vendor}
          onBack={() => {
            // go back to search or profile
            navigateTo('/wyszukiwarka');
          }}
          onGoToVendor={() => navigateTo(`/dostawcy/${vendor.slug}`)}
          onToggleSave={() => handleToggleSave('product', product.id)}
          isSaved={activeSavedItems.some(i => i.type === 'product' && i.id === product.id)}
          onAddToEnquiry={handleAddToEnquiry}
          onSelectProduct={(slug) => navigateTo(`/produkty/${slug}`)}
          isLoggedIn={isLoggedIn}
          onLoginClick={onLoginClick}
        />
      );
    }

    if (activePath.startsWith('/gazetki/') && selectedFlyerSlug) {
      const flyer = mockFlyers.find(f => f.slug === selectedFlyerSlug);
      if (!flyer) {
        return (
          <div className="max-w-md mx-auto py-16 text-center space-y-4">
            <h2 className="text-xl font-bold">Gazetka nie została znaleziona</h2>
            <button onClick={() => navigateTo('/')} className="px-4 py-2 bg-[#2A3B4C] text-white rounded-lg">Wróć na główną</button>
          </div>
        );
      }
      const vendor = mockVendors.find(v => v.id === flyer.vendorId)!;
      return (
        <MarketplaceFlyerViewer
          flyer={flyer}
          vendor={vendor}
          onBack={() => navigateTo('/promocje')}
          onSelectProduct={(slug) => navigateTo(`/produkty/${slug}`)}
          onAddToEnquiry={handleAddToEnquiry}
        />
      );
    }

    if (activePath === '/promocje' || activePath === '/gazetki') {
      return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
          <div>
            <h1 className="text-2xl font-black font-display text-gray-900 dark:text-white uppercase tracking-tight">Promocje i Gazetki B2B</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Przeglądaj aktualne oferty rabatowe i gazetki promocyjne certyfikowanych dostawców Ambra.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h2 className="text-lg font-bold pb-2">Aktualne promocje ({mockPromotions.length})</h2>
              <div className="grid grid-cols-1 gap-4">
                {mockPromotions.map(promo => {
                  const vendor = mockVendors.find(v => v.id === promo.vendorId);
                  return (
                    <div key={promo.id} className="bg-white dark:bg-gray-900 rounded-xl p-5 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black tracking-widest text-blue-600 dark:text-blue-400 font-mono uppercase">
                          {vendor?.name}
                        </span>
                        <span className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                          {promo.badgeText}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1.5">{promo.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{promo.description}</p>
                      
                      <div className="flex items-center justify-between pt-3">
                        <span className="text-[10px] text-gray-400">Ważne do: {promo.validTo}</span>
                        {vendor && (
                          <button 
                            onClick={() => navigateTo(`/dostawcy/${vendor.slug}`)} 
                            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            Zobacz katalog <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-lg font-bold pb-2">Gazetki produktowe ({mockFlyers.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mockFlyers.map(flyer => {
                  const vendor = mockVendors.find(v => v.id === flyer.vendorId);
                  return (
                    <div 
                      key={flyer.id} 
                      onClick={() => navigateTo(`/gazetki/${flyer.slug}`)}
                      className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
                    >
                      <div className="aspect-[3/4] relative overflow-hidden bg-gray-50 dark:bg-gray-950">
                        <img 
                          src={flyer.coverUrl} 
                          alt={flyer.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4">
                          <span className="text-[9px] font-black tracking-widest text-blue-400 font-mono uppercase mb-1">
                            {vendor?.name}
                          </span>
                          <h4 className="text-white font-bold text-xs line-clamp-2">{flyer.title}</h4>
                        </div>
                      </div>
                      <div className="p-3.5 flex items-center justify-between text-[11px] text-gray-500">
                        <span>{flyer.pages.length} strony</span>
                        <span className="font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                          Otwórz <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activePath === '/zapisane') {
      return (
        <MarketplaceSavedItems
          savedItems={activeSavedItems}
          onRemoveItem={(type, id) => handleToggleSave(type, id)}
          onSelectVendor={(slug) => navigateTo(`/dostawcy/${slug}`)}
          onSelectProduct={(slug) => navigateTo(`/produkty/${slug}`)}
          onSelectFlyer={(slug) => navigateTo(`/gazetki/${slug}`)}
        />
      );
    }

    if (activePath === '/jak-to-dziala' || activePath === '/dla-dostawcow') {
      return (
        <MarketplaceInfo 
          activeView={activePath === '/jak-to-dziala' ? 'how-it-works' : 'for-vendors'} 
          onGoToSearch={() => navigateTo('/wyszukiwarka')}
        />
      );
    }

    // Default Fallback
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold">Strona nie znaleziona (404)</h2>
        <button onClick={() => navigateTo('/')} className="px-4 py-2 bg-[#2A3B4C] text-white rounded-lg">Wróć na główną</button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0D15] text-gray-900 dark:text-gray-100 font-sans flex flex-col">
      {/* DESKTOP HEADER NAVIGATION */}
      {!isLoggedIn && (
        <header className="hidden lg:block bg-white dark:bg-[#0E1321] sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div onClick={() => navigateTo('/')} className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2A3B4C] to-[#1E2B38] dark:from-blue-600 dark:to-indigo-700 flex items-center justify-center font-black text-white text-base shadow-md">
              A
            </div>
            <div>
              <h1 className="font-extrabold font-display text-sm tracking-tight text-[#2A3B4C] dark:text-white leading-tight uppercase">Ambra VMI</h1>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">Public Marketplace</p>
            </div>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 font-medium text-xs text-gray-600 dark:text-gray-300">
            <button 
              onClick={() => navigateTo('/wyszukiwarka')} 
              className={cn("hover:text-blue-600 dark:hover:text-blue-400 py-2 cursor-pointer transition-colors font-bold", activePath === '/wyszukiwarka' && "text-blue-600 dark:text-blue-400")}
            >
              Szukaj
            </button>
            {/* Hidden for MVP */}
            {false && (
            <button 
              onClick={() => navigateTo('/promocje')} 
              className={cn("hover:text-blue-600 dark:hover:text-blue-400 py-2 cursor-pointer transition-colors font-bold", (activePath === '/promocje' || activePath === '/gazetki') && "text-blue-600 dark:text-blue-400")}
            >
              Promocje & Gazetki
            </button>
            )}
            <button 
              onClick={() => navigateTo('/jak-to-dziala')} 
              className={cn("hover:text-blue-600 dark:hover:text-blue-400 py-2 cursor-pointer transition-colors font-bold", activePath === '/jak-to-dziala' && "text-blue-600 dark:text-blue-400")}
            >
              Jak to działa
            </button>
            <button 
              onClick={() => navigateTo('/dla-dostawcow')} 
              className={cn("hover:text-blue-600 dark:hover:text-blue-400 py-2 cursor-pointer transition-colors font-bold", activePath === '/dla-dostawcow' && "text-blue-600 dark:text-blue-400")}
            >
              Dla dostawców
            </button>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            {/* Saved items */}
            {isLoggedIn && (
              <button 
                onClick={() => navigateTo('/zapisane')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-450 relative cursor-pointer"
                title="Zapisane"
              >
                <Heart className={cn("h-4 w-4", activeSavedItems.length > 0 && "fill-rose-500 text-rose-500")} />
                {activeSavedItems.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
                )}
              </button>
            )}

            {isLoggedIn && <span className="h-4 w-px bg-gray-200 dark:bg-gray-800" />}

            {/* Authenticated redirect portal link */}
            {isLoggedIn ? (
              <button 
                onClick={onGoToPortal}
                className="py-1.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black text-xs cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span>Twój Portal VMI</span>
              </button>
            ) : (
              <button 
                onClick={onLoginClick}
                className="py-1.5 px-4 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 font-black text-xs cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Zaloguj się</span>
              </button>
            )}
          </div>
        </div>
      </header>
      )}

      {/* MOBILE HEADER BAR */}
      {!isLoggedIn && (
        <header className="lg:hidden bg-white dark:bg-[#0E1321] px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-sm">
        <div onClick={() => navigateTo('/')} className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-[#2A3B4C] dark:bg-blue-600 flex items-center justify-center font-black text-white text-xs">
            A
          </div>
          <div>
            <h1 className="font-extrabold font-display text-xs tracking-tight text-[#2A3B4C] dark:text-white uppercase leading-none">Ambra</h1>
            <p className="text-[8px] text-gray-400 uppercase font-bold tracking-wider">Marketplace B2B</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Active portal shortcut */}
          {isLoggedIn && (
            <button 
              onClick={onGoToPortal}
              className="p-1.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              <span>Portal VMI</span>
            </button>
          )}

          {/* Toggle Menu */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>
      )}

      {/* MOBILE SLIDE OVER MENU */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-12 bg-white dark:bg-[#0E1321] z-30 flex flex-col p-6 space-y-6 animate-fade-in overflow-y-auto">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black tracking-widest text-gray-400 uppercase font-mono pb-1">Menu główne</h4>
            <div className="flex flex-col gap-3.5 text-sm font-bold">
              <button 
                onClick={() => { setIsMobileMenuOpen(false); navigateTo('/'); }} 
                className={cn("text-left py-1 hover:text-blue-600 flex items-center gap-2", activePath === '/' && "text-blue-600 dark:text-blue-400")}
              >
                <Home className="h-4 w-4" /> Strona główna
              </button>
              <button 
                onClick={() => { setIsMobileMenuOpen(false); navigateTo('/wyszukiwarka'); }} 
                className={cn("text-left py-1 hover:text-blue-600 flex items-center gap-2", activePath === '/wyszukiwarka' && "text-blue-600 dark:text-blue-400")}
              >
                <Search className="h-4 w-4" /> Wyszukiwarka dostawców
              </button>
              {/* Promocje i gazetki hidden for MVP */}
              <button 
                onClick={() => { setIsMobileMenuOpen(false); navigateTo('/jak-to-dziala'); }} 
                className={cn("text-left py-1 hover:text-blue-600 flex items-center gap-2", activePath === '/jak-to-dziala' && "text-blue-600 dark:text-blue-400")}
              >
                <HelpCircle className="h-4 w-4" /> Jak to działa
              </button>
              <button 
                onClick={() => { setIsMobileMenuOpen(false); navigateTo('/dla-dostawcow'); }} 
                className={cn("text-left py-1 hover:text-blue-600 flex items-center gap-2", activePath === '/dla-dostawcow' && "text-blue-600 dark:text-blue-400")}
              >
                <Building2 className="h-4 w-4" /> Strefa dostawców
              </button>
            </div>
          </div>

          {isLoggedIn && (
            <div className="space-y-4 pt-4">
              <h4 className="text-[10px] font-black tracking-widest text-gray-400 uppercase font-mono pb-1">Konto i schowek</h4>
              <div className="flex flex-col gap-3 text-xs font-bold">
                <button 
                  onClick={() => { setIsMobileMenuOpen(false); navigateTo('/zapisane'); }} 
                  className="flex items-center gap-2 py-1 text-gray-700 dark:text-gray-300"
                >
                  <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
                  <span>Zapisane pozycje ({savedItems.length})</span>
                </button>
              </div>
            </div>
          )}

          <div className="pt-6">
            {isLoggedIn ? (
              <button 
                onClick={() => { setIsMobileMenuOpen(false); onGoToPortal(); }}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black rounded-xl text-center flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Sparkles className="h-4 w-4 animate-pulse" />
                <span>Wejdź do Portalu VMI</span>
              </button>
            ) : (
              <button 
                onClick={() => { setIsMobileMenuOpen(false); onLoginClick(); }}
                className="w-full py-3 text-blue-600 dark:text-blue-400 font-black rounded-xl text-center flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <LogIn className="h-4 w-4" />
                <span>Zaloguj się</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* CORE MARKETPLACE MAIN CONTENT */}
      <main className={cn("flex-1", isLoggedIn ? "pb-4 lg:pb-6" : "pb-16 lg:pb-8")}>
        {renderContent()}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {!isLoggedIn && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-white dark:bg-[#0E1321] z-40 flex items-center justify-around text-[10px] font-bold text-gray-500 dark:text-gray-400 shadow-lg border-t border-gray-100 dark:border-gray-800">
        <button 
          onClick={() => navigateTo('/')}
          className={cn("flex flex-col items-center justify-center gap-1 w-14 h-full cursor-pointer", activePath === '/' && "text-blue-600 dark:text-blue-400")}
        >
          <Home className="h-4 w-4" />
          <span className="text-[9px]">Start</span>
        </button>
        <button 
          onClick={() => navigateTo('/wyszukiwarka')}
          className={cn("flex flex-col items-center justify-center gap-1 w-14 h-full cursor-pointer", activePath === '/wyszukiwarka' && "text-blue-600 dark:text-blue-400")}
        >
          <Search className="h-4 w-4" />
          <span className="text-[9px]">Szukaj</span>
        </button>
        <button 
          onClick={() => navigateTo('/zapisane')}
          className={cn("flex flex-col items-center justify-center gap-1 w-14 h-full cursor-pointer relative", activePath === '/zapisane' && "text-blue-600 dark:text-blue-400")}
        >
          <Heart className="h-4 w-4" />
          <span className="text-[9px]">Zapisane</span>
          {savedItems.length > 0 && (
            <span className="absolute top-2 right-3 w-1.5 h-1.5 bg-rose-500 rounded-full" />
          )}
        </button>
        <button 
          onClick={isLoggedIn ? onGoToPortal : onLoginClick}
          className="flex flex-col items-center justify-center gap-1 w-14 h-full cursor-pointer"
        >
          <User className="h-4 w-4" />
          <span className="text-[9px]">Konto</span>
        </button>
      </nav>
      )}

      {/* FOOTER */}
      <footer className="bg-white dark:bg-[#0E1321] py-8 text-xs text-gray-400 dark:text-gray-500 mt-12 mb-14 lg:mb-0 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <span className="font-extrabold text-[#2A3B4C] dark:text-white uppercase font-display">Ambra VMI Marketplace</span>
            <span className="hidden sm:inline">•</span>
            <span>© 2026 Wszystkie prawa zastrzeżone</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button onClick={() => navigateTo('/jak-to-dziala')} className="hover:underline cursor-pointer">Jak to działa</button>
            <button onClick={() => navigateTo('/dla-dostawcow')} className="hover:underline cursor-pointer">Dla dostawców</button>
            <button onClick={onLoginClick} className="hover:underline font-bold text-blue-600 dark:text-blue-400 cursor-pointer">Portal partnerski</button>
            
            <span className="hidden sm:inline h-4 w-px bg-gray-200 dark:bg-gray-800" />
            
            {/* Theme Toggle Button relocated from Header */}
            <button
              onClick={() => setTheme && setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-1.5 px-2.5 rounded-lg bg-gray-50 dark:bg-gray-850 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center gap-1.5 border border-gray-150 dark:border-gray-800 shadow-sm"
              title={theme === 'light' ? "Przełącz na tryb ciemny" : "Przełącz na tryb jasny"}
            >
              {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5 text-amber-400" />}
              <span>{theme === 'light' ? 'Tryb ciemny' : 'Tryb jasny'}</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-4 shadow-2xl flex items-start gap-3 max-w-sm animate-fade-in ring-1 ring-black/5">
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div className="text-xs text-left">
            <h4 className="font-extrabold text-gray-950 dark:text-white uppercase tracking-wider">{toast.title}</h4>
            <p className="text-gray-400 mt-1 leading-relaxed">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Saved Items Page (placed here for ease of access)
interface MarketplaceSavedItemsProps {
  savedItems: SavedMarketplaceItem[];
  onRemoveItem: (type: 'vendor' | 'product' | 'catalog' | 'promotion' | 'flyer', id: string) => void;
  onSelectVendor: (slug: string) => void;
  onSelectProduct: (slug: string) => void;
  onSelectFlyer: (slug: string) => void;
}

function MarketplaceSavedItems({ savedItems, onRemoveItem, onSelectVendor, onSelectProduct, onSelectFlyer }: MarketplaceSavedItemsProps) {
  const products = useMemo(() => {
    const savedIds = savedItems.filter(i => i.type === 'product').map(i => i.id);
    return mockProducts.filter(p => savedIds.includes(p.id));
  }, [savedItems]);

  const vendors = useMemo(() => {
    const savedIds = savedItems.filter(i => i.type === 'vendor').map(i => i.id);
    return mockVendors.filter(v => savedIds.includes(v.id));
  }, [savedItems]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black font-display text-gray-900 dark:text-white uppercase tracking-tight">Twoje Zapisane Pozycje</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Schowek lokalny na dostawców i produkty, które chcesz mieć pod ręką.</p>
      </div>

      {savedItems.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl py-16 px-4 text-center max-w-lg mx-auto space-y-4">
          <span className="text-4xl">❤️</span>
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">Twój schowek jest pusty</h2>
          <p className="text-xs text-gray-400 leading-relaxed">Przeglądaj katalogi i profile dostawców w naszej wyszukiwarce i klikaj ikonę serca, aby zapisać wybrane pozycje na później.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Saved Vendors */}
          <div className="space-y-4">
            <h2 className="text-base font-bold pb-2">Zapisani dostawcy ({vendors.length})</h2>
            {vendors.length === 0 ? (
              <p className="text-xs text-gray-400">Brak zapisanych dostawców.</p>
            ) : (
              <div className="space-y-3">
                {vendors.map(vendor => (
                  <div key={vendor.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3" onClick={() => onSelectVendor(vendor.slug)}>
                      <img src={vendor.logoUrl} alt={vendor.name} className="w-10 h-10 rounded-lg object-cover bg-gray-50" />
                      <div className="cursor-pointer text-left">
                        <h4 className="font-bold text-xs hover:text-blue-600">{vendor.name}</h4>
                        <p className="text-[10px] text-gray-400">{vendor.city} • {vendor.category}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onRemoveItem('vendor', vendor.id)} 
                      className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-500 hover:text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                      title="Usuń"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saved Products */}
          <div className="space-y-4">
            <h2 className="text-base font-bold pb-2">Zapisane produkty ({products.length})</h2>
            {products.length === 0 ? (
              <p className="text-xs text-gray-400">Brak zapisanych produktów.</p>
            ) : (
              <div className="space-y-3">
                {products.map(product => {
                  const vendor = mockVendors.find(v => v.id === product.vendorId);
                  return (
                    <div key={product.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center gap-3" onClick={() => onSelectProduct(product.slug)}>
                        <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover bg-gray-50" />
                        <div className="cursor-pointer text-left">
                          <h4 className="font-bold text-xs hover:text-blue-600 line-clamp-1">{product.name}</h4>
                          <p className="text-[10px] text-gray-400">{vendor?.name} • {product.brand}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => onRemoveItem('product', product.id)} 
                        className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-500 hover:text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                        title="Usuń"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
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
