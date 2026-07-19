'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  mockProducts, 
  mockCatalogs, 
  mockPromotions, 
  mockFlyers 
} from './mockData';
import { currentUser, mockLocations } from '../../lib/mockData';
import { PublicVendor, PublicProduct, EnquiryBasketGroup } from './types';
import { 
  MapPin, 
  ShieldCheck, 
  Phone, 
  Mail, 
  Clock, 
  Truck, 
  Compass, 
  Heart, 
  ChevronRight, 
  BookOpen, 
  Search, 
  Tag, 
  ArrowLeft,
  FileText,
  User,
  ExternalLink,
  Info,
  ShoppingBag,
  Check,
  Grid,
  List,
  Table,
  Settings,
  AlertCircle,
  Trash2,
  Calendar,
  ArrowRight,
  MessageSquare,
  Plus,
  Minus,
  Send,
  Inbox,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface RequestProductLine {
  productId: string;
  quantity: number;
  unit: 'szt' | 'paczka';
  comment?: string;
  allowSubstitutes?: boolean;
  deliveryDate?: string;
}

export interface RequestDraft {
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  clientOrganization: string;
  branchId: string;
  branchName: string;
  items: RequestProductLine[];
  overallMessage: string;
  deliveryDestination: string;
  deliveryDate?: string;
  urgency: 'Standardowe' | 'Pilne';
  partialResponseAllowed: boolean;
  preferredContactMethod: 'W aplikacji' | 'E-mail' | 'Telefon';
  subject: string;
  createdDate: string;
  lastModifiedDate: string;
}

interface MarketplaceVendorProfileProps {
  vendor: PublicVendor;
  onBack: () => void;
  onSelectProduct: (slug: string) => void;
  onSelectFlyer: (slug: string) => void;
  onToggleSaveVendor: () => void;
  isSaved: boolean;
  savedProductIds: string[];
  onToggleSaveProduct: (id: string) => void;
  onAddToEnquiry: (productId: string, qty: number, unit: 'szt' | 'paczka') => void;
  basket: EnquiryBasketGroup[];
  isLoggedIn?: boolean;
  onLoginClick?: () => void;
  onSelectVendor?: (slug: string) => void;
  onAddSubmittedRfq?: (rfq: any) => void;
}

export default function MarketplaceVendorProfile({
  vendor,
  onBack,
  onSelectProduct,
  onSelectFlyer,
  onToggleSaveVendor,
  isSaved,
  savedProductIds,
  onToggleSaveProduct,
  onAddToEnquiry,
  basket,
  isLoggedIn,
  onLoginClick,
  onSelectVendor,
  onAddSubmittedRfq
}: MarketplaceVendorProfileProps) {
  // Vendor accent style resolver
  const getVendorAccentClass = (type: 'text' | 'bg' | 'hoverBg' | 'border' | 'lightBg' | 'ring') => {
    const slug = vendor.slug || '';
    if (slug.includes('autoparts-pro')) {
      if (type === 'text') return 'text-blue-600 dark:text-blue-400';
      if (type === 'bg') return 'bg-blue-600';
      if (type === 'hoverBg') return 'hover:bg-blue-700';
      if (type === 'border') return 'border-blue-200 dark:border-blue-900/50';
      if (type === 'lightBg') return 'bg-blue-50/60 dark:bg-blue-950/20';
      if (type === 'ring') return 'ring-blue-400/30';
    } else if (slug.includes('werktools')) {
      if (type === 'text') return 'text-red-600 dark:text-red-400';
      if (type === 'bg') return 'bg-red-600';
      if (type === 'hoverBg') return 'hover:bg-red-700';
      if (type === 'border') return 'border-red-200 dark:border-red-900/50';
      if (type === 'lightBg') return 'bg-red-50/60 dark:bg-red-950/20';
      if (type === 'ring') return 'ring-red-400/30';
    } else if (slug.includes('cleanchem')) {
      if (type === 'text') return 'text-emerald-600 dark:text-emerald-400';
      if (type === 'bg') return 'bg-emerald-600';
      if (type === 'hoverBg') return 'hover:bg-emerald-700';
      if (type === 'border') return 'border-emerald-200 dark:border-emerald-900/50';
      if (type === 'lightBg') return 'bg-emerald-50/60 dark:bg-emerald-950/20';
      if (type === 'ring') return 'ring-emerald-400/30';
    } else if (slug.includes('safetycore')) {
      if (type === 'text') return 'text-amber-600 dark:text-amber-400';
      if (type === 'bg') return 'bg-amber-600';
      if (type === 'hoverBg') return 'hover:bg-amber-700';
      if (type === 'border') return 'border-amber-200 dark:border-amber-900/50';
      if (type === 'lightBg') return 'bg-amber-50/60 dark:bg-amber-950/20';
      if (type === 'ring') return 'ring-amber-400/30';
    } else if (slug.includes('fastmover-logistics') || slug.includes('fastmover')) {
      if (type === 'text') return 'text-indigo-600 dark:text-indigo-400';
      if (type === 'bg') return 'bg-indigo-600';
      if (type === 'hoverBg') return 'hover:bg-indigo-700';
      if (type === 'border') return 'border-indigo-200 dark:border-indigo-900/50';
      if (type === 'lightBg') return 'bg-indigo-50/60 dark:bg-indigo-950/20';
      if (type === 'ring') return 'ring-indigo-400/30';
    }
    // Fallback: Blue
    if (type === 'text') return 'text-blue-600 dark:text-blue-400';
    if (type === 'bg') return 'bg-blue-600';
    if (type === 'hoverBg') return 'hover:bg-blue-700';
    if (type === 'border') return 'border-blue-200 dark:border-blue-900/50';
    if (type === 'lightBg') return 'bg-blue-50/60 dark:bg-blue-950/20';
    if (type === 'ring') return 'ring-blue-400/30';
  };

  const [deliveryDateType, setDeliveryDateType] = useState<'asap' | 'specific'>('asap');

  // Tabs: 'info' | 'catalog' | 'promotions' | 'contact'
  const [activeTab, setActiveTab] = useState<'info' | 'catalog' | 'promotions' | 'contact'>('info');

  // Custom states for request building
  const [isRequestMode, setIsRequestMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(`ambra-marketplace-request-draft-${vendor.id}`);
  });
  const [activeDraft, setActiveDraft] = useState<RequestDraft | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(`ambra-marketplace-request-draft-${vendor.id}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState<boolean>(false);
  const [submittedRfqNumber, setSubmittedRfqNumber] = useState<string>('');
  const [expandedDetailsProductIds, setExpandedDetailsProductIds] = useState<string[]>([]);
  const [otherVendorDraft, setOtherVendorDraft] = useState<{ vendorId: string; vendorName: string; vendorSlug: string } | null>(null);
  const [toast, setToast] = useState<{ title: string; message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Load draft and check for other vendor drafts on mount and vendor change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Scan other vendor drafts
    let otherDraftFound: typeof otherVendorDraft = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ambra-marketplace-request-draft-')) {
        const draftVendorId = key.replace('ambra-marketplace-request-draft-', '');
        if (draftVendorId !== vendor.id) {
          try {
            const draftValue = localStorage.getItem(key);
            if (draftValue) {
              const draft = JSON.parse(draftValue);
              if (draft && draft.items && draft.items.length > 0) {
                otherDraftFound = {
                  vendorId: draftVendorId,
                  vendorName: draft.vendorName || 'Innego dostawcy',
                  vendorSlug: draft.vendorSlug || ''
                };
                break; // find first one
              }
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }

    // Defer state updates to next tick to avoid synchronous cascading renders warning
    const timer = setTimeout(() => {
      const storedDraft = localStorage.getItem(`ambra-marketplace-request-draft-${vendor.id}`);
      if (storedDraft) {
        try {
          const parsed = JSON.parse(storedDraft);
          setActiveDraft(parsed);
          setIsRequestMode(true);
        } catch (e) {
          console.error('Error loading draft', e);
        }
      } else {
        setActiveDraft(null);
        setIsRequestMode(false);
      }
      setOtherVendorDraft(otherDraftFound);
    }, 0);

    return () => clearTimeout(timer);
  }, [vendor.id, vendor.name, vendor.slug]);

  // Toast auto-clear
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Save draft helper
  const saveDraft = useCallback((updatedItems: RequestProductLine[], otherFields: Partial<RequestDraft> = {}) => {
    if (typeof window === 'undefined') return;

    const currentDraft: RequestDraft = activeDraft ? {
      ...activeDraft,
      items: updatedItems,
      ...otherFields,
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
      lastModifiedDate: new Date().toISOString(),
      ...otherFields
    };

    setActiveDraft(currentDraft);
    localStorage.setItem(`ambra-marketplace-request-draft-${vendor.id}`, JSON.stringify(currentDraft));
  }, [activeDraft, vendor.id, vendor.name, vendor.slug]);

  const toggleProductSelection = (productId: string) => {
    if (!isLoggedIn) {
      onLoginClick?.();
      return;
    }
    
    let updatedItems = activeDraft ? [...activeDraft.items] : [];
    const existingIndex = updatedItems.findIndex(item => item.productId === productId);
    
    if (existingIndex > -1) {
      // Remove
      updatedItems.splice(existingIndex, 1);
    } else {
      // Add
      const prod = mockProducts.find(p => p.id === productId);
      const defaultUnit = prod?.sellMode === 'piece' ? 'szt' : 'paczka';
      updatedItems.push({
        productId,
        quantity: prod?.minEnquiryQty || 1,
        unit: defaultUnit,
        allowSubstitutes: true,
        comment: '',
        deliveryDate: ''
      });
    }

    // Automatically enable request mode if there's at least 1 item
    if (updatedItems.length > 0 && !isRequestMode) {
      setIsRequestMode(true);
    }

    saveDraft(updatedItems);
  };

  const updateDraftItem = (productId: string, fields: Partial<RequestProductLine>) => {
    if (!activeDraft) return;
    const updatedItems = activeDraft.items.map(item => {
      if (item.productId === productId) {
        return { ...item, ...fields };
      }
      return item;
    });
    saveDraft(updatedItems);
  };

  const removeDraftItem = (productId: string) => {
    if (!activeDraft) return;
    const updatedItems = activeDraft.items.filter(item => item.productId !== productId);
    saveDraft(updatedItems);
  };

  const clearCurrentDraft = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`ambra-marketplace-request-draft-${vendor.id}`);
    setActiveDraft(null);
    setIsRequestMode(false);
    setIsDrawerOpen(false);
    setSubmittedRfq(null);
    setIsSubmittedSuccess(false);
  };

  // RFQ Submission state inside Drawer
  const [submittedRfq, setSubmittedRfq] = useState<any | null>(null);
  const [simulationSecondsRemaining, setSimulationSecondsRemaining] = useState<number>(5);
  const [rfqForm, setRfqForm] = useState(() => {
    const defaultBranchId = currentUser?.currentLocationId || 'loc-1';
    const branch = mockLocations.find(l => l.id === defaultBranchId) || mockLocations[0];
    const isKomorniki = defaultBranchId === 'loc-1';
    
    return {
      selectedBranchId: defaultBranchId,
      clientName: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Michał Stępień (Branch Manager)',
      companyName: currentUser?.organization || 'AutoService Komorniki',
      email: 'm.stepien@autoservicekomorniki.pl',
      phone: '+48 501 502 503',
      nip: '7771234567',
      city: isKomorniki ? 'Komorniki' : 'Poznań',
      postalCode: isKomorniki ? '62-052' : '60-205',
      deliveryAddress: branch?.address || 'ul. Poznańska 14, 62-052 Komorniki',
      businessType: 'Warsztat niezależny',
      contactPreference: 'W aplikacji',
      expectedDeliveryDate: new Date(Date.now() + 3*24*60*60*1000).toISOString().split('T')[0],
      message: ''
    };
  });

  const triggerSimulationResponse = useCallback((customRfq?: any) => {
    const targetRfq = customRfq || submittedRfq;
    if (!targetRfq) return;

    // Build position-by-position response
    const responseItems = targetRfq.items.map((item: any, index: number) => {
      const prod = mockProducts.find(p => p.id === item.productId);
      const basePrice = prod?.priceValue || 50;
      // Provide a sweet discount
      const offeredPrice = basePrice * 0.88; // 12% discount!
      
      // Realistically accept or replace with substitute
      let decision: 'accepted' | 'substitute' | 'rejected' = 'accepted';
      let comment = 'Dostępne na magazynie, cena z rabatem handlowym.';
      let substituteProductId = '';
      let substituteProductName = '';

      // If item allows substitutes and index === 1, propose a premium substitute to show off capabilities
      if (item.allowSubstitutes && index === 1) {
        decision = 'substitute';
        const sibling = mockProducts.find(p => p.vendorId === vendor.id && p.id !== item.productId && p.category === prod?.category);
        if (sibling) {
          substituteProductId = sibling.id;
          substituteProductName = sibling.name;
          comment = `Brak podstawowej wersji. Proponujemy zamiennik premium: ${sibling.name} w specjalnej cenie.`;
        } else {
          substituteProductId = 'sub-sim-1';
          substituteProductName = `${prod?.name} (Zamiennik Premium)`;
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

    // Save in local storage
    if (typeof window !== 'undefined') {
      const storedRfqsStr = localStorage.getItem('ambra-marketplace-rfqs');
      let rfqs: any[] = [];
      if (storedRfqsStr) {
        try {
          rfqs = JSON.parse(storedRfqsStr);
        } catch (e) {}
      }
      rfqs = rfqs.map(r => r.id === targetRfq.id ? updatedRfq : r);
      localStorage.setItem('ambra-marketplace-rfqs', JSON.stringify(rfqs));
      window.dispatchEvent(new Event('storage'));
    }

    setSubmittedRfq(updatedRfq);
    setToast({
      title: 'Otrzymano odpowiedź!',
      message: `Dostawca ${vendor.name} przesłał kompletną wycenę dla zapytania ${targetRfq.enquiryNumber}.`,
      type: 'success'
    });
  }, [submittedRfq, vendor.id, vendor.name]);

  // Countdown timer for automatic vendor response simulation
  useEffect(() => {
    if (!submittedRfq || submittedRfq.status !== 'Wysłane') return;

    if (simulationSecondsRemaining <= 0) {
      const timerAsync = setTimeout(() => {
        triggerSimulationResponse();
      }, 0);
      return () => clearTimeout(timerAsync);
    }

    const timer = setTimeout(() => {
      setSimulationSecondsRemaining(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [submittedRfq, simulationSecondsRemaining, triggerSimulationResponse]);

  const submitDraftRfq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      onLoginClick?.();
      return;
    }
    if (!activeDraft) return;

    const rfqNumber = `AMB-RFQ-${Math.floor(100000 + Math.random() * 900000)}`;
    const rfqObj: any = {
      id: `rfq-${Date.now()}`,
      enquiryNumber: rfqNumber,
      vendorId: vendor.id,
      date: new Date().toISOString().split('T')[0],
      status: 'Wysłane',
      clientName: rfqForm.clientName,
      companyName: rfqForm.companyName,
      email: rfqForm.email,
      phone: rfqForm.phone,
      nip: rfqForm.nip,
      city: rfqForm.city,
      postalCode: rfqForm.postalCode,
      deliveryAddress: rfqForm.deliveryAddress,
      businessType: rfqForm.businessType,
      contactPreference: rfqForm.contactPreference,
      expectedDeliveryDate: rfqForm.expectedDeliveryDate,
      message: rfqForm.message,
      items: activeDraft.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
        note: item.comment || '',
        allowSubstitutes: item.allowSubstitutes ?? true
      }))
    };

    // Save to local storage list
    if (typeof window !== 'undefined') {
      const storedRfqsStr = localStorage.getItem('ambra-marketplace-rfqs');
      let rfqs: any[] = [];
      if (storedRfqsStr) {
        try {
          rfqs = JSON.parse(storedRfqsStr);
        } catch (e) {}
      }
      rfqs = [rfqObj, ...rfqs];
      localStorage.setItem('ambra-marketplace-rfqs', JSON.stringify(rfqs));
      window.dispatchEvent(new Event('storage'));
    }

    // Call callback if provided
    onAddSubmittedRfq?.(rfqObj);

    // Set submitted RFQ and reset countdown
    setSubmittedRfq(rfqObj);
    setSimulationSecondsRemaining(5);
    setIsSubmittedSuccess(true);
  };

  const handleAcceptSimulatedOffer = () => {
    if (!submittedRfq) return;

    const orderNumber = `ZAM-RFQ-${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Create new VMI Order
    const orderLines = submittedRfq.items.map((item: any) => {
      const responseItem = submittedRfq.responseItems?.find((ri: any) => ri.productId === item.productId);
      const prod = mockProducts.find(p => p.id === item.productId);
      
      return {
        productId: responseItem?.decision === 'substitute' && responseItem.substituteProductId ? responseItem.substituteProductId : item.productId,
        requestedQty: item.quantity,
        confirmedQty: responseItem?.availableQty || item.quantity,
        shippedQty: 0,
        deliveredQty: 0,
        price: responseItem?.offeredPrice || prod?.priceValue || 50
      };
    });

    const newOrder = {
      id: `o-rfq-${Date.now()}`,
      vendorId: vendor.id,
      locationId: 'loc-1',
      orderNumber,
      date: new Date().toISOString().substring(0, 10),
      requestedDeliveryDate: submittedRfq.expectedDeliveryDate,
      confirmedDeliveryDate: submittedRfq.expectedDeliveryDate,
      origin: 'Zapytanie RFQ',
      status: 'Wysłane',
      lines: orderLines,
      poReference: submittedRfq.enquiryNumber,
      hasAttachment: false,
      notes: `Zamówienie wygenerowane z zaakceptowanego zapytania ofertowego ${submittedRfq.enquiryNumber}. Uwagi handlowe dostawcy: ${submittedRfq.responseComment || ''}`,
      timeline: [
        { status: 'Szkic', date: new Date().toISOString().substring(0, 16).replace('T', ' '), description: 'Utworzono automatycznie z oferty RFQ.' },
        { status: 'Wysłane', date: new Date().toISOString().substring(0, 16).replace('T', ' '), description: 'Zaakceptowano wycenę i wysłano zamówienie.' }
      ]
    };

    // Save order in local storage
    if (typeof window !== 'undefined') {
      const storedOrdersStr = localStorage.getItem('ambra-vmi-orders');
      let orders: any[] = [];
      if (storedOrdersStr) {
        try {
          orders = JSON.parse(storedOrdersStr);
        } catch (e) {}
      }
      orders = [newOrder, ...orders];
      localStorage.setItem('ambra-vmi-orders', JSON.stringify(orders));

      // Also update RFQ status to 'Zrealizowane'
      const storedRfqsStr = localStorage.getItem('ambra-marketplace-rfqs');
      let rfqs: any[] = [];
      if (storedRfqsStr) {
        try {
          rfqs = JSON.parse(storedRfqsStr);
        } catch (e) {}
      }
      rfqs = rfqs.map(r => r.id === submittedRfq.id ? { ...r, status: 'Zrealizowane' } : r);
      localStorage.setItem('ambra-marketplace-rfqs', JSON.stringify(rfqs));

      window.dispatchEvent(new Event('storage'));
    }

    setToast({
      title: 'Zamówienie wysłane!',
      message: `Pomyślnie utworzono i wysłano zamówienie ${orderNumber} o wartości wycenionej przez dostawcę.`,
      type: 'success'
    });

    // Close and reset everything
    setIsDrawerOpen(false);
    setSubmittedRfq(null);
    clearCurrentDraft();
  };

  const toggleDetailsExpand = (productId: string) => {
    setExpandedDetailsProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId) 
        : [...prev, productId]
    );
  };

  // Search inside vendor's catalog state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('Wszystko');

  // Interactive B2B catalog view and price settings
  const [viewMode, setViewMode] = useState<'tile' | 'list' | 'table'>('tile');
  const [tileSize, setTileSize] = useState<number>(200);
  const [hidePrices, setHidePrices] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    company: '',
    email: '',
    message: '',
    urgency: 'Średni'
  });
  const [contactSuccess, setContactSuccess] = useState(false);

  // Vendor Specific Products
  const vendorProducts = useMemo(() => {
    return mockProducts.filter(p => p.vendorId === vendor.id);
  }, [vendor.id]);

  // Categories present in this vendor's catalog
  const vendorCategories = useMemo(() => {
    const cats = new Set(vendorProducts.map(p => p.category));
    return ['Wszystko', ...Array.from(cats)];
  }, [vendorProducts]);

  // Catalog filtered items
  const filteredVendorProducts = useMemo(() => {
    return vendorProducts.filter(p => {
      const matchesSearch = !catalogSearch || 
        p.name.toLowerCase().includes(catalogSearch.toLowerCase()) || 
        p.brand.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(catalogSearch.toLowerCase());

      const matchesCat = catalogCategory === 'Wszystko' || p.category === catalogCategory;

      return matchesSearch && matchesCat;
    });
  }, [vendorProducts, catalogSearch, catalogCategory]);

  // Vendor promotions
  const vendorPromotions = useMemo(() => {
    return mockPromotions.filter(p => p.vendorId === vendor.id);
  }, [vendor.id]);

  // Vendor flyers
  const vendorFlyers = useMemo(() => {
    return mockFlyers.filter(f => f.vendorId === vendor.id);
  }, [vendor.id]);

  // Vendor catalogs
  const vendorCatalogs = useMemo(() => {
    return mockCatalogs.filter(c => c.vendorId === vendor.id);
  }, [vendor.id]);

  // Quick add animation success indicator
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const handleQuickAdd = (productId: string, minQty: number) => {
    if (!isLoggedIn) {
      onLoginClick?.();
      return;
    }
    const prod = mockProducts.find(p => p.id === productId);
    const defaultUnit = prod?.sellMode === 'piece' ? 'szt' : 'paczka';
    onAddToEnquiry(productId, minQty, defaultUnit);
    setAddedProductId(productId);
    setTimeout(() => setAddedProductId(null), 1500);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      onLoginClick?.();
      return;
    }

    try {
      const newQuestion = {
        id: `Q-${Date.now()}`,
        vendorId: vendor.id,
        vendorName: vendor.name,
        name: contactForm.name,
        company: contactForm.company,
        email: contactForm.email,
        message: contactForm.message,
        urgency: contactForm.urgency,
        date: new Date().toLocaleDateString('pl-PL')
      };
      const existing = localStorage.getItem('ambra-marketplace-questions');
      const questionsList = existing ? JSON.parse(existing) : [];
      localStorage.setItem('ambra-marketplace-questions', JSON.stringify([newQuestion, ...questionsList]));
    } catch (err) {
      console.error('Error saving question to localStorage', err);
    }

    // Simulate API request send
    setContactSuccess(true);
    setTimeout(() => {
      setContactSuccess(false);
      setContactForm({ name: '', company: '', email: '', message: '', urgency: 'Średni' });
    }, 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8 animate-fade-in text-left">
      {/* 1. PROFILE BANNER HERO */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-md relative">
        <div className="h-44 md:h-60 relative overflow-hidden bg-gray-100 dark:bg-gray-950">
          <img src={vendor.coverUrl} alt={vendor.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          <button 
            onClick={onBack}
            className="absolute top-4 left-4 py-1.5 px-3 bg-white/90 dark:bg-gray-900/90 text-gray-800 dark:text-white rounded-lg text-xs font-black uppercase tracking-wide flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Powrót do wyszukiwania
          </button>
        </div>

        {/* Profile Identity Details Row */}
        <div className="p-6 pt-0 relative flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-12 md:-mt-16 z-10">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 text-left">
            <img 
              src={vendor.logoUrl} 
              alt={vendor.name} 
              className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover bg-white p-1 shadow-lg shrink-0" 
            />
            
            <div className="space-y-1.5 pt-4 md:pt-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-3xl font-black font-display text-gray-900 dark:text-white uppercase tracking-tight">
                  {vendor.name}
                </h1>
                {vendor.isVerified && (
                  <span title="Dostawca certyfikowany">
                    <ShieldCheck className="h-6 w-6 text-blue-500 fill-blue-500/10 shrink-0" />
                  </span>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider font-mono">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-blue-500" />
                  {vendor.city} ({vendor.distanceKm} km od Ciebie)
                </span>
                <span>•</span>
                <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-0.5 rounded">
                  {vendor.category}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={onToggleSaveVendor}
              className={cn(
                "p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 cursor-pointer transition-all",
                isSaved ? "bg-rose-50 dark:bg-rose-950/20 text-rose-500" : "text-gray-400"
              )}
              title={isSaved ? "Usuń ze schowka" : "Zapisz dostawcę"}
            >
              <Heart className={cn("h-5 w-5", isSaved && "fill-rose-500 text-rose-500")} />
            </button>
            <button 
              onClick={() => {
                if (!isLoggedIn) {
                  onLoginClick?.();
                  return;
                }
                setActiveTab('catalog');
                setIsRequestMode(true);
                if (!activeDraft) {
                  saveDraft([]);
                }
              }}
              className={cn(
                "py-2.5 px-4 text-xs font-black rounded-xl uppercase tracking-wider cursor-pointer transition-all border",
                isRequestMode
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white hover:bg-gray-50 text-gray-700 border-gray-250 dark:bg-gray-900 dark:hover:bg-gray-850 dark:border-gray-800 dark:text-gray-200"
              )}
            >
              {isRequestMode ? "RFQ Mode: Active ✓" : "Request Custom Quote"}
            </button>
            <button 
              onClick={() => setActiveTab('contact')}
              className="py-2.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black text-xs rounded-xl shadow-md uppercase tracking-wider cursor-pointer"
            >
              Zapytaj o współpracę
            </button>
          </div>
        </div>
      </div>

      {/* 2. PROFILE GRID BODY */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* SIDEBAR COLUMNS: QUICK INFORMATION */}
        <div className="space-y-6">
          {/* Quick Contact Box */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 space-y-4 shadow-md">
            <h3 className="font-extrabold text-[10px] text-gray-400 uppercase tracking-widest font-mono pb-1">Kontakt B2B</h3>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center gap-2.5">
                <User className="h-4 w-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 leading-none mb-0.5">Opiekun handlowy:</p>
                  <p className="font-bold text-gray-800 dark:text-gray-100">Dział Współpracy B2B</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 leading-none mb-0.5">Telefon bezpośredni:</p>
                  <a href={`tel:${vendor.contactPhone}`} className="font-extrabold text-blue-600 dark:text-blue-400 hover:underline">{vendor.contactPhone}</a>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 leading-none mb-0.5">Adres E-mail:</p>
                  <a href={`mailto:${vendor.contactEmail}`} className="font-extrabold text-blue-600 dark:text-blue-400 hover:underline">{vendor.contactEmail}</a>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 leading-none mb-0.5">Godziny otwarcia:</p>
                  <p className="font-bold text-gray-800 dark:text-gray-200">{vendor.openingHours}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Logistics Terms */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 space-y-4 shadow-md text-xs leading-relaxed">
            <h3 className="font-extrabold text-[10px] text-gray-400 uppercase tracking-widest font-mono pb-1">Zasady logistyki</h3>
            <div className="space-y-3">
              <div>
                <span className="font-bold text-gray-800 dark:text-gray-200 block mb-0.5">🚚 Dostawa:</span>
                <span className="text-gray-500 dark:text-gray-400">{vendor.deliveryAvailable ? 'Dostępna (własna flota / kurier B2B)' : 'Brak dostawy'}</span>
              </div>
              <div>
                <span className="font-bold text-gray-800 dark:text-gray-200 block mb-0.5">🏢 Odbiór osobisty:</span>
                <span className="text-gray-500 dark:text-gray-400">{vendor.collectionAvailable ? 'Możliwy w punkcie handlowym' : 'Brak możliwości odbioru'}</span>
              </div>
              <div>
                <span className="font-bold text-gray-800 dark:text-gray-200 block mb-0.5">📍 Obszar dostaw:</span>
                <span className="text-gray-500 dark:text-gray-400">{vendor.serviceArea}</span>
              </div>
              <div>
                <span className="font-bold text-gray-800 dark:text-gray-200 block mb-0.5">⌛ Czas reakcji:</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">{vendor.responseTimeText}</span>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN BODY AREA: TAB SWITCHER & VIEWS */}
        <div className="lg:col-span-3 space-y-6">
          {/* Tabs header list */}
          <div className="flex">
            {(['info', 'catalog', 'promotions', 'contact'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-5 py-3 text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                  activeTab === tab 
                    ? "text-blue-600 dark:text-blue-400" 
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                {tab === 'info' ? 'O firmie & Warunki' : tab === 'catalog' ? `Katalog B2B (${vendorProducts.length})` : tab === 'promotions' ? 'Promocje & Gazetki' : 'Kontakt / Zapytaj'}
              </button>
            ))}
          </div>

          {/* TAB 1: INFORMACJE & REGULAMINY */}
          {activeTab === 'info' && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 space-y-6 shadow-md">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Opis dystrybutora</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                  {vendor.longDescription}
                </p>
              </div>

              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-xs">
                  <h4 className="font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">Warunki dostawy & Minimum logistyczne</h4>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                    {vendor.deliveryTerms}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <h4 className="font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">Wiodące marki asortymentowe</h4>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {vendor.featuredBrands.map(b => (
                      <span key={b} className="px-3 py-1 bg-gray-50 dark:bg-gray-850 text-[10px] font-black text-gray-600 dark:text-gray-300 rounded-lg uppercase tracking-wider">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Vendor Catalogs list (PDF format / dynamic download) */}
              {vendorCatalogs.length > 0 && (
                <div className="pt-6 space-y-3">
                  <h4 className="font-black text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide">Dostępne Katalogi Produktowe ({vendorCatalogs.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {vendorCatalogs.map(catalog => (
                      <div key={catalog.id} className="p-4 bg-gray-50 dark:bg-gray-950 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <BookOpen className="h-6 w-6 text-blue-500" />
                          <div className="text-left">
                            <h5 className="font-bold text-xs">{catalog.title}</h5>
                            <p className="text-[10px] text-gray-400 font-medium">{catalog.category} • {catalog.productCount} produktów</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => { setActiveTab('catalog'); setCatalogCategory(catalog.category); }}
                          className="py-1 px-3 bg-[#2A3B4C] text-white rounded-lg text-[9px] uppercase font-black cursor-pointer"
                        >
                          Zobacz
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INTERACTIVE B2B CATALOG */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              {/* Interactive RFQ Mode Activation Banner */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all duration-300 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                isRequestMode 
                  ? "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50" 
                  : "bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800"
              )}>
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isRequestMode ? "bg-blue-500" : "bg-gray-400")}></span>
                      <span className={cn("relative inline-flex rounded-full h-2 w-2", isRequestMode ? "bg-blue-600" : "bg-gray-400")}></span>
                    </span>
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                      <span>Interactive RFQ Mode</span>
                      {isRequestMode && <span className="bg-blue-600 text-white text-[8px] font-black font-mono px-1.5 py-0.5 rounded uppercase">Active</span>}
                    </h4>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-2xl leading-normal">
                    {isRequestMode 
                      ? "You are in Request for Quote (RFQ) mode! Select items from the catalog, set custom quantities, specify delivery dates, allow substitutes, and click 'Review Request' below to trigger an immediate, automated distributor quotation simulation with trade discounts."
                      : "Want a custom price quote with trade discounts? Turn on RFQ Mode to select multiple products, adjust quantities/dates, and simulate a direct quotation from this distributor."
                    }
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => {
                      if (!isLoggedIn) {
                        onLoginClick?.();
                        return;
                      }
                      const nextMode = !isRequestMode;
                      setIsRequestMode(nextMode);
                      if (!nextMode) {
                        clearCurrentDraft();
                      } else {
                        saveDraft([]);
                      }
                    }}
                    className={cn(
                      "py-2 px-4 rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer transition-all border",
                      isRequestMode 
                        ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50" 
                        : "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-md hover:shadow-lg"
                    )}
                  >
                    {isRequestMode ? "Disable RFQ Mode" : "Enable RFQ Mode"}
                  </button>
                </div>
              </div>

              {/* Search, filters & interactive layout controls */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex flex-col md:flex-row items-stretch gap-3">
                  <div className="flex-1 bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 flex items-center gap-2">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Wyszukaj w katalogu tego dostawcy..."
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                      className="w-full text-xs font-bold bg-transparent outline-none dark:text-white"
                    />
                  </div>

                  <div className="w-full md:w-56 bg-gray-50 dark:bg-gray-950 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span className="text-gray-400 text-xs font-semibold shrink-0">Kategoria:</span>
                    <select
                      value={catalogCategory}
                      onChange={e => setCatalogCategory(e.target.value)}
                      className="w-full text-xs font-bold bg-transparent outline-none dark:text-white cursor-pointer"
                    >
                      {vendorCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sub-bar for scaling, view modes, and settings */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    {/* Settings Dropdown for hiding prices */}
                    <div className="relative">
                      <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 hover:text-gray-750 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors border border-gray-200/50 dark:border-gray-800/50 text-[11px] font-extrabold"
                        )}
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span>Opcje</span>
                      </button>
                      {isSettingsOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)} />
                          <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl p-3.5 z-50 space-y-2.5 text-xs text-left">
                            <p className="font-bold text-[9px] uppercase tracking-wider text-gray-400 font-mono">Parametry katalogu</p>
                            <label className="flex items-center gap-2.5 cursor-pointer text-gray-750 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white font-bold">
                              <input 
                                type="checkbox" 
                                checked={hidePrices} 
                                onChange={(e) => setHidePrices(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                              />
                              <span>Ukryj ceny netto</span>
                            </label>
                            <p className="text-[9px] text-gray-400 dark:text-gray-550 leading-normal pt-2">
                              Aktywuj tę funkcję, aby zasymulować prezentację oferty bezpośrednio u klienta bez zdradzania cen bazowych.
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Separator */}
                    {viewMode === 'tile' && (
                      <div className="h-5 w-px bg-gray-200 dark:bg-gray-800 hidden sm:block" />
                    )}

                    {/* Scale Slider */}
                    {viewMode === 'tile' && (
                      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-950 px-2.5 py-1.5 rounded-lg text-[10px]">
                        <span className="text-gray-450 dark:text-gray-500 font-mono font-bold">Kafle:</span>
                        <input 
                          type="range" 
                          min="120" 
                          max="300" 
                          value={tileSize} 
                          onChange={(e) => setTileSize(Number(e.target.value))}
                          className="w-16 sm:w-24 accent-blue-600 h-1 bg-gray-200 dark:bg-gray-850 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="font-mono text-gray-600 dark:text-gray-300 whitespace-nowrap font-bold">{tileSize}px</span>
                      </div>
                    )}
                  </div>

                  {/* View Toggles */}
                  <div className="flex bg-gray-50 dark:bg-gray-950 rounded-lg p-0.5 border border-gray-200/50 dark:border-gray-800">
                    {[
                      { id: 'tile', label: 'Małe kafelki', icon: Grid },
                      { id: 'list', label: 'Lista', icon: List },
                      { id: 'table', label: 'Tabela', icon: Table }
                    ].map(v => {
                      const Icon = v.icon;
                      const isActive = viewMode === v.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setViewMode(v.id as any)}
                          className={cn(
                            "p-1.5 rounded-md transition-all cursor-pointer",
                            isActive 
                              ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm" 
                              : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                          )}
                          title={v.label}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Product Displays */}
              {filteredVendorProducts.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl shadow-md space-y-2">
                  <div className="flex justify-center">
                    <ShoppingBag className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-400 font-bold">Brak pasujących artykułów w katalogu tego dostawcy.</p>
                </div>
              ) : (
                <>
                  {/* Mode A: tile (Grid with scalable Tile sizes) */}
                  {viewMode === 'tile' && (
                    <div 
                      className="grid gap-4"
                      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}
                    >
                      {filteredVendorProducts.map(product => {
                        const isSaved = savedProductIds.includes(product.id);
                        const draftItem = activeDraft?.items.find(item => item.productId === product.id);
                        const isSelected = isRequestMode && !!draftItem;

                        return (
                          <div 
                            key={product.id}
                            className={cn(
                              "bg-white dark:bg-gray-900 rounded-xl p-3.5 flex flex-col justify-between shadow-md hover:shadow-lg group transition-all relative border text-left",
                              isSelected 
                                ? "border-blue-500 shadow-md bg-blue-50/5 dark:bg-blue-950/5 ring-1 ring-blue-400/30" 
                                : "border-gray-150/50 dark:border-gray-800"
                            )}
                          >
                            <div>
                              {/* Image and Checkbox Overlay */}
                              <div className="aspect-[4/3] bg-gray-50 dark:bg-gray-950 rounded-lg overflow-hidden relative shrink-0 mb-3">
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                
                                {/* Try request checkbox */}
                                {isRequestMode && (
                                  <button
                                    onClick={() => toggleProductSelection(product.id)}
                                    className={cn(
                                      "absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center border shadow-sm transition-all cursor-pointer z-20",
                                      isSelected 
                                        ? "bg-blue-600 border-blue-600 text-white" 
                                        : "bg-white/90 dark:bg-gray-900/90 border-gray-300 text-transparent"
                                    )}
                                  >
                                    <Check className="h-4 w-4 stroke-[3]" />
                                  </button>
                                )}

                                {/* New Badge */}
                                {product.isNew && !isSelected && (
                                  <span className="absolute top-2 left-2 bg-blue-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full z-10">
                                    NOWOŚĆ
                                  </span>
                                )}

                                {/* Save (hidden in selected request mode for clarity) */}
                                {!isSelected && (
                                  <button
                                    onClick={() => onToggleSaveProduct(product.id)}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-white/95 dark:bg-gray-900/95 shadow-sm text-gray-400 hover:text-rose-500 cursor-pointer"
                                  >
                                    <Heart className={cn("h-3.5 w-3.5", isSaved && "fill-rose-500 text-rose-500")} />
                                  </button>
                                )}
                              </div>

                              {/* Details */}
                              <div className="space-y-1.5">
                                <span className="text-[8px] font-black tracking-widest text-blue-600 dark:text-blue-400 uppercase font-mono">{product.brand}</span>
                                <h4 
                                  onClick={() => onSelectProduct(product.slug)}
                                  className="font-bold text-xs text-gray-900 dark:text-white group-hover:text-blue-600 hover:underline cursor-pointer line-clamp-2 leading-snug"
                                >
                                  {product.name}
                                </h4>

                                <p className="text-[9px] text-gray-400 dark:text-gray-500 font-mono">SKU: {product.sku}</p>

                                {/* Warehouse and package info - exactly like partners catalog */}
                                <div className="space-y-1 pt-1 mt-1 border-t border-gray-100 dark:border-gray-800">
                                  <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                                    <span>W magazynie:</span>
                                    <span className={cn(
                                      "font-extrabold font-mono",
                                      ((product.id.charCodeAt(product.id.length - 1) * 7) % 180 + 35) <= 45 
                                        ? "text-amber-600 dark:text-amber-400 animate-pulse" 
                                        : "text-emerald-600 dark:text-emerald-400"
                                    )}>
                                      {(product.id.charCodeAt(product.id.length - 1) * 7) % 180 + 35} szt.
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                                    <span>Opakowanie:</span>
                                    <span className="font-extrabold font-mono text-blue-600 dark:text-blue-400">
                                      1 paczka = {product.packSize || 10} {product.unit || 'szt.'}
                                    </span>
                                  </div>
                                </div>

                                {/* Pricing */}
                                {!hidePrices && (
                                  <div className="pt-1 text-xs text-left">
                                    {product.priceMode === 'exact' && product.priceValue && (
                                      <p className="font-extrabold text-xs text-gray-950 dark:text-white">
                                        {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN <span className="text-[10px] text-gray-400 font-normal">/{product.unit}</span>
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
                                )}
                              </div>
                            </div>

                            {/* CTA / Request selection controls */}
                            <div className="pt-3 mt-3 border-t border-gray-100/50 dark:border-gray-800 flex flex-col gap-2">
                              {isSelected && draftItem ? (
                                <div className="space-y-2">
                                  {/* Compact selection/unit indicator above input */}
                                  <div className="flex justify-center mb-1">
                                    {product.sellMode === 'both' ? (
                                      <div className="inline-flex rounded-lg p-0.5 bg-gray-100 dark:bg-gray-850 text-[9px] font-black uppercase tracking-wide border border-gray-200/50 dark:border-gray-800">
                                        <button
                                          type="button"
                                          onClick={() => updateDraftItem(product.id, { unit: 'paczka' })}
                                          className={cn(
                                            "px-2.5 py-0.5 rounded transition-all cursor-pointer",
                                            draftItem.unit === 'paczka' 
                                              ? "bg-white dark:bg-gray-750 text-gray-900 dark:text-white shadow-sm font-bold" 
                                              : "text-gray-450 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                          )}
                                        >
                                          Opakowanie
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateDraftItem(product.id, { unit: 'szt' })}
                                          className={cn(
                                            "px-2.5 py-0.5 rounded transition-all cursor-pointer",
                                            draftItem.unit === 'szt' 
                                              ? "bg-white dark:bg-gray-750 text-gray-900 dark:text-white shadow-sm font-bold" 
                                              : "text-gray-450 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                          )}
                                        >
                                          Sztuka
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-950/40 px-2 py-0.5 rounded border border-gray-150 dark:border-gray-850">
                                        {product.sellMode === 'piece' ? 'Tylko na sztuki' : 'Tylko całe opakowania'}
                                      </span>
                                    )}
                                  </div>

                                  {/* Qty and unit controller */}
                                  <div className="flex items-center gap-1.5 w-full">
                                    <button
                                      type="button"
                                      onClick={() => updateDraftItem(product.id, { quantity: Math.max(1, draftItem.quantity - 1) })}
                                      className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-250 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center cursor-pointer font-bold select-none shrink-0 border border-gray-200/40 dark:border-gray-750"
                                    >
                                      <Minus className="h-3.5 w-3.5" />
                                    </button>

                                    <div className="flex-1 text-center font-bold text-gray-800 dark:text-white font-mono text-[10px] bg-gray-50 dark:bg-gray-950 py-1 rounded-lg leading-tight border border-gray-150 dark:border-gray-800">
                                      <div className="font-extrabold text-xs">{draftItem.quantity} {draftItem.unit === 'paczka' ? 'op.' : 'szt.'}</div>
                                      <div className="text-[9px] text-gray-450 font-normal">
                                        ({draftItem.unit === 'paczka' ? draftItem.quantity * product.packSize : draftItem.quantity} szt.)
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => updateDraftItem(product.id, { quantity: draftItem.quantity + 1 })}
                                      className={cn(
                                        "w-8 h-8 rounded-lg text-white flex items-center justify-center cursor-pointer font-bold select-none shrink-0 border border-transparent transition-colors",
                                        getVendorAccentClass('bg'),
                                        getVendorAccentClass('hoverBg')
                                      )}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </button>
                                  </div>

                                  {/* Comments straight at the bottom - no accordion! */}
                                  <div className="space-y-1 mt-1">
                                    <label className="text-[8px] uppercase tracking-wider font-extrabold text-gray-450">Uwagi do pozycji:</label>
                                    <input
                                      type="text"
                                      placeholder="np. tylko kolor czarny, dostawa rano"
                                      value={draftItem.comment || ''}
                                      onChange={(e) => updateDraftItem(product.id, { comment: e.target.value })}
                                      className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-xl px-2.5 py-1.5 text-xs outline-none text-gray-850 dark:text-white"
                                    />
                                  </div>

                                  {/* Delete button moved to the bottom */}
                                  <button
                                    type="button"
                                    onClick={() => removeDraftItem(product.id)}
                                    className="w-full mt-1.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[10px] font-black uppercase tracking-wider rounded-xl border border-rose-200/50 dark:border-rose-900/30 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Usuń pozycję</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {isRequestMode ? (
                                    <button
                                      onClick={() => toggleProductSelection(product.id)}
                                      className={cn(
                                        "w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-sm border flex items-center justify-center gap-1.5 transition-all text-white border-transparent",
                                        getVendorAccentClass('bg'),
                                        getVendorAccentClass('hoverBg')
                                      )}
                                    >
                                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                                      <span>Wybierz</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleQuickAdd(product.id, product.minEnquiryQty)}
                                      disabled={addedProductId === product.id}
                                      className={cn(
                                        "w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all border flex items-center justify-center",
                                        addedProductId === product.id 
                                          ? "bg-green-600 text-white border-green-600" 
                                          : cn(getVendorAccentClass('bg'), "text-white border-transparent", getVendorAccentClass('hoverBg'))
                                      )}
                                    >
                                      {addedProductId === product.id ? 'Dodano ✓' : 'Zapytaj +'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Mode B: list (Compact Row/List View) */}
                  {viewMode === 'list' && (
                    <div className="flex flex-col gap-2">
                      {filteredVendorProducts.map(product => {
                        const isSaved = savedProductIds.includes(product.id);
                        const draftItem = activeDraft?.items.find(item => item.productId === product.id);
                        const isSelected = isRequestMode && !!draftItem;

                        return (
                          <div 
                            key={product.id} 
                            className={cn(
                              "bg-white dark:bg-gray-900 rounded-xl p-3 flex flex-col shadow-md hover:shadow-lg group transition-all text-xs border text-left",
                              isSelected 
                                ? "border-blue-500 bg-blue-50/5 dark:bg-blue-950/5 ring-1 ring-blue-400/30" 
                                : "border-gray-150/50 dark:border-gray-800"
                            )}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {/* Try request checkbox */}
                                {isRequestMode && (
                                  <button
                                    onClick={() => toggleProductSelection(product.id)}
                                    className={cn(
                                      "w-6 h-6 rounded-md flex items-center justify-center border shadow-sm transition-all cursor-pointer z-10 shrink-0",
                                      isSelected 
                                        ? "bg-blue-600 border-blue-600 text-white" 
                                        : "bg-white/95 dark:bg-gray-900/95 border-gray-300 text-transparent"
                                    )}
                                  >
                                    <Check className="h-4 w-4 stroke-[3]" />
                                  </button>
                                )}

                                <div className="w-14 h-14 bg-gray-50 dark:bg-gray-950 rounded-lg overflow-hidden shrink-0 relative">
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                  {!isSelected && (
                                    <button
                                      onClick={() => onToggleSaveProduct(product.id)}
                                      className="absolute top-1 right-1 p-1 rounded-full bg-white/90 dark:bg-gray-900/90 shadow-sm text-gray-400 hover:text-rose-500 cursor-pointer"
                                    >
                                      <Heart className={cn("h-2.5 w-2.5", isSaved && "fill-rose-500 text-rose-500")} />
                                    </button>
                                  )}
                                </div>
                                
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[8px] font-black tracking-widest text-blue-600 dark:text-blue-400 uppercase font-mono">
                                      {product.brand}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase font-mono">
                                      {product.category}
                                    </span>
                                    {product.isNew && !isSelected && (
                                      <span className="bg-blue-600 text-white text-[7px] font-black uppercase px-1.5 py-0.2 rounded-full">
                                        NOWOŚĆ
                                      </span>
                                    )}
                                  </div>
                                  
                                  <h4 
                                    onClick={() => onSelectProduct(product.slug)}
                                    className="font-bold text-xs text-gray-900 dark:text-white hover:text-blue-600 hover:underline cursor-pointer truncate"
                                  >
                                    {product.name}
                                  </h4>
                                  <div className="flex flex-wrap items-center gap-x-2.5 text-[9px] text-gray-450 font-mono">
                                    <span>SKU: {product.sku}</span>
                                    <span>•</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      W magazynie: {(product.id.charCodeAt(product.id.length - 1) * 7) % 180 + 35} szt.
                                    </span>
                                    <span>•</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">
                                      Opakowanie: 1 paczka = {product.packSize || 10} {product.unit || 'szt.'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-gray-800">
                                {/* Pricing */}
                                {!hidePrices && !isSelected && (
                                  <div className="text-left sm:text-right font-mono shrink-0">
                                    <p className="text-[9px] text-gray-400">Cena</p>
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
                                      <span className="text-orange-600 dark:text-orange-400 text-[9px] font-black uppercase font-mono">Zapytanie</span>
                                    )}
                                    {product.priceMode === 'after_login' && (
                                      <span className="text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase font-mono">Po zalogowaniu</span>
                                    )}
                                  </div>
                                )}

                                {isSelected && draftItem ? (
                                  <div className="flex flex-col items-center gap-1.5">
                                    {/* Compact selection/unit indicator above input */}
                                    <div className="flex justify-center">
                                      {product.sellMode === 'both' ? (
                                        <div className="inline-flex rounded-lg p-0.5 bg-gray-105 dark:bg-gray-850 text-[9px] font-black uppercase tracking-wide border border-gray-200/50 dark:border-gray-800">
                                          <button
                                            type="button"
                                            onClick={() => updateDraftItem(product.id, { unit: 'paczka' })}
                                            className={cn(
                                              "px-2 py-0.5 rounded transition-all cursor-pointer",
                                              draftItem.unit === 'paczka' 
                                                ? "bg-white dark:bg-gray-750 text-gray-900 dark:text-white shadow-sm font-bold" 
                                                : "text-gray-450 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                            )}
                                          >
                                            Opakowanie
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => updateDraftItem(product.id, { unit: 'szt' })}
                                            className={cn(
                                              "px-2 py-0.5 rounded transition-all cursor-pointer",
                                              draftItem.unit === 'szt' 
                                                ? "bg-white dark:bg-gray-750 text-gray-900 dark:text-white shadow-sm font-bold" 
                                                : "text-gray-450 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                            )}
                                          >
                                            Sztuka
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-950/40 px-2 py-0.5 rounded border border-gray-150 dark:border-gray-850">
                                          {product.sellMode === 'piece' ? 'Tylko na sztuki' : 'Tylko całe opakowania'}
                                        </span>
                                      )}
                                    </div>

                                    {/* Qty controller */}
                                    <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-lg p-0.5">
                                      <button 
                                        type="button"
                                        onClick={() => updateDraftItem(product.id, { quantity: Math.max(1, draftItem.quantity - 1) })}
                                        className="w-7 h-7 flex items-center justify-center text-xs font-black text-gray-400 hover:text-gray-850 dark:hover:text-white cursor-pointer"
                                      >
                                        -
                                      </button>
                                      <div className="w-16 text-center leading-tight">
                                        <div className="font-extrabold text-[11px] text-gray-800 dark:text-white">
                                          {draftItem.quantity} {draftItem.unit === 'paczka' ? 'op.' : 'szt.'}
                                        </div>
                                        <div className="text-[8px] text-gray-450 font-normal">
                                          ({draftItem.unit === 'paczka' ? draftItem.quantity * product.packSize : draftItem.quantity} szt.)
                                        </div>
                                      </div>
                                      <button 
                                        type="button"
                                        onClick={() => updateDraftItem(product.id, { quantity: draftItem.quantity + 1 })}
                                        className={cn(
                                          "w-7 h-7 rounded-lg text-white flex items-center justify-center cursor-pointer font-bold select-none shrink-0 border border-transparent transition-colors",
                                          getVendorAccentClass('bg'),
                                          getVendorAccentClass('hoverBg')
                                        )}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  isRequestMode ? (
                                    <button
                                      onClick={() => toggleProductSelection(product.id)}
                                      className={cn(
                                        "py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-sm border flex items-center justify-center gap-1.5 transition-all text-white border-transparent h-9 min-w-[100px]",
                                        getVendorAccentClass('bg'),
                                        getVendorAccentClass('hoverBg')
                                      )}
                                    >
                                      Wybierz
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleQuickAdd(product.id, product.minEnquiryQty)}
                                      disabled={addedProductId === product.id}
                                      className={cn(
                                        "py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all border flex items-center justify-center h-9 min-w-[100px]",
                                        addedProductId === product.id 
                                          ? "bg-green-600 text-white border-green-600" 
                                          : cn(getVendorAccentClass('bg'), "text-white border-transparent", getVendorAccentClass('hoverBg'))
                                      )}
                                    >
                                      {addedProductId === product.id ? 'Dodano ✓' : 'Zapytaj +'}
                                    </button>
                                  )
                                )}
                              </div>
                            </div>

                            {/* Comments straight at the bottom - no accordion! */}
                            {isSelected && draftItem && (
                              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-stretch sm:items-end gap-3 text-left">
                                <div className="flex-1 space-y-1">
                                  <label className="text-[8px] uppercase tracking-wider font-extrabold text-gray-450">Uwagi i doprecyzowanie pożądanego produktu:</label>
                                  <input
                                    type="text"
                                    placeholder="np. preferowane opakowania po 10szt, konkretna marka zamienna"
                                    value={draftItem.comment || ''}
                                    onChange={(e) => updateDraftItem(product.id, { comment: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-xl px-3 py-1.5 text-xs outline-none text-gray-850 dark:text-white"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeDraftItem(product.id)}
                                  className="py-1.5 px-4 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[10px] font-black uppercase tracking-wider rounded-xl border border-rose-200/50 dark:border-rose-900/30 flex items-center justify-center gap-1.5 cursor-pointer h-8 transition-colors shrink-0"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Usuń</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Mode C: table (Table View) */}
                  {viewMode === 'table' && (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-x-auto shadow-md border border-gray-150 dark:border-gray-800">
                      <table className="w-full border-collapse text-left text-xs text-gray-700 dark:text-gray-300">
                        <thead>
                          <tr className="bg-gray-50/50 dark:bg-gray-950 font-extrabold text-gray-400 uppercase tracking-widest text-[8px] font-mono border-b border-gray-150 dark:border-gray-800">
                            {isRequestMode && <th className="p-3 pl-4 text-center w-12">Wybierz</th>}
                            <th className="p-3 pl-4">Foto</th>
                            <th className="p-3">Produkt i Marka</th>
                            <th className="p-3">Kategoria</th>
                            <th className="p-3 font-mono">SKU</th>
                            {!hidePrices && <th className="p-3 font-mono text-right">Cena</th>}
                            <th className="p-3 font-mono text-center">Op. zbiorcze</th>
                            <th className="p-3 text-right pr-4">Akcja</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {filteredVendorProducts.map(product => {
                            const isSaved = savedProductIds.includes(product.id);
                            const draftItem = activeDraft?.items.find(item => item.productId === product.id);
                            const isSelected = isRequestMode && !!draftItem;
                            const isExpanded = expandedDetailsProductIds.includes(product.id);

                            return (
                              <React.Fragment key={product.id}>
                                <tr className={cn(
                                  "hover:bg-gray-50/30 dark:hover:bg-gray-950/30 transition-colors",
                                  isSelected && "bg-blue-50/10 dark:bg-blue-950/5 font-semibold"
                                )}>
                                  {isRequestMode && (
                                    <td className="p-3 pl-4 text-center">
                                      <button
                                        onClick={() => toggleProductSelection(product.id)}
                                        className={cn(
                                          "w-5.5 h-5.5 mx-auto rounded flex items-center justify-center border shadow-sm transition-all cursor-pointer",
                                          isSelected 
                                            ? "bg-blue-600 border-blue-600 text-white" 
                                            : "bg-white dark:bg-gray-950 border-gray-300 text-transparent"
                                        )}
                                      >
                                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                                      </button>
                                    </td>
                                  )}
                                  <td className="p-3 pl-4 shrink-0">
                                    <div className="w-10 h-10 bg-gray-50 dark:bg-gray-950 rounded overflow-hidden relative">
                                      <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                                      {!isSelected && (
                                        <button
                                          onClick={() => onToggleSaveProduct(product.id)}
                                          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-white/95 dark:bg-gray-900/95 shadow-sm text-gray-400 hover:text-rose-500 cursor-pointer"
                                        >
                                          <Heart className={cn("h-2.5 w-2.5", isSaved && "fill-rose-500 text-rose-500")} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 font-medium">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[8px] font-black tracking-widest text-blue-600 dark:text-blue-400 uppercase font-mono">
                                        {product.brand}
                                      </span>
                                      {product.isNew && !isSelected && (
                                        <span className="bg-blue-600 text-white text-[7px] font-black uppercase px-1 py-0.2 rounded-full">
                                          NOWOŚĆ
                                        </span>
                                      )}
                                    </div>
                                    <p 
                                      onClick={() => onSelectProduct(product.slug)}
                                      className="font-extrabold text-gray-900 dark:text-white leading-tight hover:text-blue-600 hover:underline cursor-pointer"
                                    >
                                      {product.name}
                                    </p>
                                  </td>
                                  <td className="p-3">
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase font-mono font-mono">
                                      {product.category}
                                    </span>
                                  </td>
                                  <td className="p-3 font-mono text-gray-500 dark:text-gray-400 font-mono">
                                    {product.sku}
                                  </td>
                                  {!hidePrices && (
                                    <td className="p-3 text-right font-mono font-bold">
                                      {product.priceMode === 'exact' && product.priceValue && (
                                        <span className="text-gray-900 dark:text-white">
                                          {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                                        </span>
                                      )}
                                      {product.priceMode === 'from' && product.priceValue && (
                                        <span className="text-gray-900 dark:text-white text-[11px]">
                                          od {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                                        </span>
                                      )}
                                      {product.priceMode === 'range' && product.priceValue && product.priceMax && (
                                        <span className="text-gray-900 dark:text-white text-[10px]">
                                          {product.priceValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} - {product.priceMax.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                                        </span>
                                      )}
                                      {product.priceMode === 'on_request' && (
                                        <span className="text-orange-600 dark:text-orange-400 text-[8px] uppercase tracking-wider font-mono">Na zapytanie</span>
                                      )}
                                      {product.priceMode === 'after_login' && (
                                        <span className="text-blue-600 dark:text-blue-400 text-[8px] uppercase tracking-wider font-mono">Po zalogowaniu</span>
                                      )}
                                    </td>
                                  )}
                                  <td className="p-3 text-center font-mono">
                                    <div className="font-extrabold text-[#2A3B4C] dark:text-blue-400">{product.packSize}</div>
                                    <div className="text-[9px] text-gray-400">({product.unit})</div>
                                  </td>
                                  <td className="p-3 text-right pr-4">
                                    {isSelected && draftItem ? (
                                      <div className="flex flex-col items-end gap-1.5 justify-center">
                                        {/* Compact selection/unit indicator above input */}
                                        <div className="flex justify-end">
                                          {product.sellMode === 'both' ? (
                                            <div className="inline-flex rounded-lg p-0.5 bg-gray-105 dark:bg-gray-850 text-[9px] font-black uppercase tracking-wide border border-gray-200/50 dark:border-gray-800">
                                              <button
                                                type="button"
                                                onClick={() => updateDraftItem(product.id, { unit: 'paczka' })}
                                                className={cn(
                                                  "px-2 py-0.5 rounded transition-all cursor-pointer",
                                                  draftItem.unit === 'paczka' 
                                                    ? "bg-white dark:bg-gray-750 text-gray-900 dark:text-white shadow-sm font-bold" 
                                                    : "text-gray-450 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                )}
                                              >
                                                Opakowanie
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => updateDraftItem(product.id, { unit: 'szt' })}
                                                className={cn(
                                                  "px-2 py-0.5 rounded transition-all cursor-pointer",
                                                  draftItem.unit === 'szt' 
                                                    ? "bg-white dark:bg-gray-750 text-gray-900 dark:text-white shadow-sm font-bold" 
                                                    : "text-gray-450 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                )}
                                              >
                                                Sztuka
                                              </button>
                                            </div>
                                          ) : (
                                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-950/40 px-2 py-0.5 rounded border border-gray-150 dark:border-gray-850">
                                              {product.sellMode === 'piece' ? 'Tylko na sztuki' : 'Tylko całe opakowania'}
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                          {/* Compact qty tuner */}
                                          <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-lg p-0.5">
                                            <button
                                              type="button"
                                              onClick={() => updateDraftItem(product.id, { quantity: Math.max(1, draftItem.quantity - 1) })}
                                              className="w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-gray-800 dark:hover:text-white cursor-pointer font-bold"
                                            >
                                              -
                                            </button>
                                            <div className="w-16 text-center leading-tight">
                                              <div className="font-extrabold text-[11px] text-gray-800 dark:text-white">
                                                {draftItem.quantity} {draftItem.unit === 'paczka' ? 'op.' : 'szt.'}
                                              </div>
                                              <div className="text-[8px] text-gray-450 font-normal">
                                                ({draftItem.unit === 'paczka' ? draftItem.quantity * product.packSize : draftItem.quantity} szt.)
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => updateDraftItem(product.id, { quantity: draftItem.quantity + 1 })}
                                              className={cn(
                                                "w-6 h-6 rounded text-white flex items-center justify-center cursor-pointer font-bold select-none shrink-0 border border-transparent transition-colors",
                                                getVendorAccentClass('bg'),
                                                getVendorAccentClass('hoverBg')
                                              )}
                                            >
                                              +
                                            </button>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() => removeDraftItem(product.id)}
                                            className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded cursor-pointer transition-colors"
                                            title="Usuń pozycję"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      isRequestMode ? (
                                        <button
                                          onClick={() => toggleProductSelection(product.id)}
                                          className={cn(
                                            "py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-sm border text-white border-transparent",
                                            getVendorAccentClass('bg'),
                                            getVendorAccentClass('hoverBg')
                                          )}
                                        >
                                          Wybierz
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleQuickAdd(product.id, product.minEnquiryQty)}
                                          disabled={addedProductId === product.id}
                                          className={cn(
                                            "py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all border",
                                            addedProductId === product.id 
                                              ? "bg-green-600 text-white border-green-600" 
                                              : cn(getVendorAccentClass('bg'), "text-white border-transparent", getVendorAccentClass('hoverBg'))
                                          )}
                                        >
                                          {addedProductId === product.id ? 'Dodano ✓' : 'Zapytaj +'}
                                        </button>
                                      )
                                    )}
                                  </td>
                                </tr>

                                {/* Inline comments row for Selected Table Items */}
                                {isSelected && draftItem && (
                                  <tr className="bg-blue-50/10 dark:bg-blue-950/2 bg-opacity-20 border-b border-gray-100 dark:border-gray-800">
                                    <td colSpan={isRequestMode ? 9 : 8} className="p-3 pl-8 pb-3.5 pt-1.5">
                                      <div className="flex items-center gap-3 text-xs text-left">
                                        <span className="text-[9px] uppercase font-bold text-gray-450 shrink-0">Uwagi dla dystrybutora:</span>
                                        <input
                                          type="text"
                                          placeholder="np. preferowana data dostawy rano, produkt w opakowaniu alternatywnym"
                                          value={draftItem.comment || ''}
                                          onChange={(e) => updateDraftItem(product.id, { comment: e.target.value })}
                                          className="flex-1 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-xl px-3 py-1.5 text-xs outline-none text-gray-850 dark:text-white"
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: PROMOTIONS & DIGITAL FLYERS */}
          {activeTab === 'promotions' && (
            <div className="space-y-6">
              {/* Dynamic flyers list */}
              {vendorFlyers.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-black text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide">Dostępne Gazetki Produktowe ({vendorFlyers.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {vendorFlyers.map(flyer => (
                      <div 
                        key={flyer.id}
                        onClick={() => onSelectFlyer(flyer.slug)}
                        className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-md hover:shadow-lg cursor-pointer group"
                      >
                        <div className="aspect-[3/4] overflow-hidden relative bg-gray-50 dark:bg-gray-950">
                          <img src={flyer.coverUrl} alt={flyer.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-3">
                            <h5 className="text-white font-bold text-xs line-clamp-2">{flyer.title}</h5>
                          </div>
                        </div>
                        <div className="p-3 flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase">
                          <span>{flyer.pages.length} strony</span>
                          <span className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5">Otwórz <ChevronRight className="h-3 w-3" /></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Promotions list */}
              <div className="space-y-3">
                <h4 className="font-black text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide">Promocje i Rabaty ilościowe ({vendorPromotions.length})</h4>
                {vendorPromotions.length === 0 ? (
                  <p className="text-xs text-gray-400">Brak aktywnych promocji u tego dostawcy.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {vendorPromotions.map(promo => (
                      <div key={promo.id} className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-md hover:shadow-lg transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-extrabold text-sm text-gray-900 dark:text-white leading-tight">{promo.title}</h5>
                          <span className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[10px] font-black px-2.5 py-1 rounded-full">
                            {promo.badgeText}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">{promo.description}</p>
                        <div className="text-[10px] text-gray-400 font-bold uppercase font-mono pt-3">
                          Okres ważności oferty: {promo.validFrom} do {promo.validTo}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DIRECT COOPERATION FORM */}
          {activeTab === 'contact' && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-md">
              <div className="space-y-1 text-left mb-6">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Zapytaj o warunki handlowe lub współpracę</h3>
                <p className="text-xs text-gray-400">Wypełnij krótki formularz B2B. Twoje zgłoszenie trafi bezpośrednio do zespołu opiekunów dystrybutora.</p>
              </div>

              {contactSuccess ? (
                <div className="bg-green-50 dark:bg-green-950/20 p-8 rounded-xl text-center space-y-4 max-w-md mx-auto">
                  <div className="flex justify-center">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400">
                      <Check className="h-5 w-5" />
                    </div>
                  </div>
                  <h4 className="font-bold text-sm text-green-800 dark:text-green-300">Zapytanie zostało wysłane!</h4>
                  <p className="text-xs text-green-600 dark:text-green-400 leading-relaxed">Dziękujemy za kontakt. Opiekun handlowy dostawcy AutoParts Pro skontaktuje się z Tobą na podany adres e-mail w ciągu deklarowanego czasu reakcji (zwykle {vendor.responseTimeText}).</p>
                </div>
              ) : !isLoggedIn ? (
                <div className="bg-gray-50 dark:bg-gray-950 p-8 rounded-2xl text-center space-y-4 max-w-md mx-auto">
                  <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <User className="h-6 w-6" />
                    </div>
                  </div>
                  <h4 className="font-extrabold text-sm text-gray-800 dark:text-gray-200">Wymagane logowanie</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                    Aby nawiązać bezpośredni kontakt B2B, zapytać o warunki handlowe lub przesłać wiadomość do dostawcy, musisz być zalogowany na swoim koncie handlowym.
                  </p>
                  <button 
                    onClick={onLoginClick}
                    className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md uppercase tracking-wide cursor-pointer"
                  >
                    Zaloguj się do konta B2B
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4 max-w-xl text-left text-xs font-bold text-gray-700 dark:text-gray-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label>Imię i nazwisko nadawcy *</label>
                      <input 
                        type="text" 
                        required
                        value={contactForm.name}
                        onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3.5 py-2.5 outline-none dark:text-white text-xs font-bold"
                        placeholder="np. Jan Kowalski" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label>Nazwa firmy (NIP opcjonalnie)</label>
                      <input 
                        type="text" 
                        value={contactForm.company}
                        onChange={e => setContactForm({ ...contactForm, company: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3.5 py-2.5 outline-none dark:text-white text-xs font-bold"
                        placeholder="np. Warsztat Auto-Klinika" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label>Adres e-mail do kontaktu *</label>
                    <input 
                      type="email" 
                      required
                      value={contactForm.email}
                      onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3.5 py-2.5 outline-none dark:text-white text-xs font-bold"
                      placeholder="np. kontakt@twojwarsztat.pl" 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label>Wybierz stopień pilności kontaktu</label>
                    <div className="flex items-center gap-3">
                      {['Niski', 'Średni', 'Wysoki'].map(urg => (
                        <button
                          key={urg}
                          type="button"
                          onClick={() => setContactForm({ ...contactForm, urgency: urg })}
                          className={cn(
                            "py-2 px-4 rounded-xl font-black text-[10px] uppercase transition-all cursor-pointer",
                            contactForm.urgency === urg 
                              ? "bg-blue-600 text-white" 
                              : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-850"
                          )}
                        >
                          {urg}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label>Treść zapytania / szczegóły współpracy *</label>
                    <textarea 
                      rows={5}
                      required
                      value={contactForm.message}
                      onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-950 rounded-xl px-3.5 py-2.5 outline-none dark:text-white text-xs font-bold resize-none"
                      placeholder="Napisz, jakich produktów potrzebujesz, jakie wolumeny planujesz zamawiać miesięcznie, lub zadaj pytanie o dostawę..."
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="py-3 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md uppercase tracking-wider cursor-pointer"
                    >
                      Wyślij zapytanie handlowe
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Floating Request Summary */}
      {activeDraft && activeDraft.items.length > 0 && !isDrawerOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl bg-blue-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 z-50 border border-blue-800 ring-1 ring-white/10 animate-fade-in">
          <div className="flex items-center gap-4.5 text-center md:text-left">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center text-blue-200 shrink-0">
              <ShoppingBag className="h-5.5 w-5.5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <span className="bg-blue-600 text-white font-bold text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">Tryb zapytania</span>
                <span className="text-blue-200 text-xs font-semibold">Dostawca: {vendor.name}</span>
              </div>
              <h4 className="text-sm font-black mt-0.5">
                {activeDraft.items.length} {activeDraft.items.length === 1 ? 'pozycja' : activeDraft.items.length < 5 ? 'pozycje' : 'pozycji'}{' '}
                <span className="text-blue-200 font-normal">
                  ({activeDraft.items.reduce((acc, item) => acc + item.quantity, 0)} op.) w wersji roboczej
                </span>
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={clearCurrentDraft}
              className="py-2 px-3.5 hover:bg-white/15 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all border border-white/20"
            >
              Wyczyść
            </button>
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="py-2.5 px-6 bg-white hover:bg-blue-50 text-blue-900 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-2"
            >
              <span>Przejrzyj zapytanie ({activeDraft.items.length})</span>
              <ArrowRight className="h-4 w-4 text-blue-900" />
            </button>
          </div>
        </div>
      )}

      {/* Drawer Overlay Backdrop */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 w-screen h-screen bg-black/60 backdrop-blur-sm z-[9999] transition-opacity animate-fade-in"
          onClick={() => {
            if (!isSubmittedSuccess) setIsDrawerOpen(false);
          }}
        />
      )}

      {/* Interactive Request Builder Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] md:w-[650px] bg-white dark:bg-gray-900 shadow-2xl z-[10000] flex flex-col transition-transform duration-300 ease-in-out border-l border-gray-200 dark:border-gray-800">
          
          {/* Drawer Header */}
          <div className="p-5 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-950/40">
            <div>
              <span className="text-[9px] uppercase font-bold tracking-widest text-blue-600 dark:text-blue-400">Podgląd zapytania B2B</span>
              <h3 className="text-sm font-black text-gray-900 dark:text-white mt-0.5 uppercase tracking-tight">Kreator Zapytania (RFQ)</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Dostawca: {vendor.name} • Email: {vendor.contactEmail}</p>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 rounded-lg hover:bg-gray-150 dark:hover:bg-gray-800 text-gray-500 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Body (Two States: Form Editor or Submission Success Simulation) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
            {!isSubmittedSuccess ? (
              // STATE 1: RFQ BUILDER / FORM EDITOR
              <form onSubmit={submitDraftRfq} className="space-y-6">
                
                {/* 1. Chosen Positions list */}
                <div className="space-y-3">
                  <h4 className="font-black text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b pb-1">Dodany asortyment ({activeDraft?.items.length || 0})</h4>
                  
                  {activeDraft?.items.length === 0 ? (
                    <p className="text-center py-6 text-gray-400">Twój szkic zapytania jest pusty.</p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {activeDraft?.items.map(item => {
                        const product = mockProducts.find(p => p.id === item.productId);
                        if (!product) return null;

                        return (
                          <div 
                            key={item.productId}
                            className="p-3 bg-gray-50 dark:bg-gray-950/30 rounded-xl border border-gray-150 dark:border-gray-850 space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0" />
                                <div className="min-w-0 text-left">
                                  <span className="text-[8px] font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase font-mono">{product.brand}</span>
                                  <h5 className="font-extrabold text-gray-900 dark:text-white truncate leading-tight">{product.name}</h5>
                                  <p className="text-[9px] text-gray-400 font-semibold uppercase mt-0.5">Op. zbiorcze: {product.packSize} {product.unit}</p>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                {/* Compact selection/unit indicator above input */}
                                <div className="flex justify-end">
                                  {product.sellMode === 'both' ? (
                                    <div className="inline-flex rounded-lg p-0.5 bg-gray-105 dark:bg-gray-850 text-[9px] font-black uppercase tracking-wide border border-gray-200/50 dark:border-gray-800">
                                      <button
                                        type="button"
                                        onClick={() => updateDraftItem(product.id, { unit: 'paczka' })}
                                        className={cn(
                                          "px-2 py-0.5 rounded transition-all cursor-pointer",
                                          item.unit === 'paczka' 
                                            ? "bg-white dark:bg-gray-750 text-gray-900 dark:text-white shadow-sm font-bold" 
                                            : "text-gray-450 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                        )}
                                      >
                                        Opakowanie
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateDraftItem(product.id, { unit: 'szt' })}
                                        className={cn(
                                          "px-2 py-0.5 rounded transition-all cursor-pointer",
                                          item.unit === 'szt' 
                                            ? "bg-white dark:bg-gray-750 text-gray-900 dark:text-white shadow-sm font-bold" 
                                            : "text-gray-450 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                        )}
                                      >
                                        Sztuka
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-950/40 px-2 py-0.5 rounded border border-gray-150 dark:border-gray-850">
                                      {product.sellMode === 'piece' ? 'Tylko na sztuki' : 'Tylko całe opakowania'}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Qty controller */}
                                  <div className="flex items-center gap-1 bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-lg p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => updateDraftItem(product.id, { quantity: Math.max(1, item.quantity - 1) })}
                                      className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-400 hover:text-gray-850 dark:hover:text-white cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <div className="w-16 text-center leading-tight">
                                      <div className="font-extrabold text-[11px] text-gray-800 dark:text-white">
                                        {item.quantity} {item.unit === 'paczka' ? 'op.' : 'szt.'}
                                      </div>
                                      <div className="text-[8px] text-gray-450 font-normal">
                                        ({item.unit === 'paczka' ? item.quantity * product.packSize : item.quantity} szt.)
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => updateDraftItem(product.id, { quantity: item.quantity + 1 })}
                                      className={cn(
                                        "w-6 h-6 rounded text-white flex items-center justify-center cursor-pointer font-bold select-none shrink-0 border border-transparent transition-colors",
                                        getVendorAccentClass('bg'),
                                        getVendorAccentClass('hoverBg')
                                      )}
                                    >
                                      +
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => removeDraftItem(product.id)}
                                    className="p-1 text-gray-400 hover:text-rose-500 cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Position Details Expand Form */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] bg-white dark:bg-gray-950/60 p-2.5 rounded-lg border border-gray-100 dark:border-gray-900">
                              <div className="space-y-0.5 text-left">
                                <span className="text-[8px] font-bold text-gray-400 uppercase">Uwagi dla dystrybutora:</span>
                                <input
                                  type="text"
                                  placeholder="np. tylko czarne, szybka dostawa"
                                  value={item.comment || ''}
                                  onChange={(e) => updateDraftItem(product.id, { comment: e.target.value })}
                                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded px-2 py-0.5 outline-none font-bold text-gray-800 dark:text-white"
                                />
                              </div>

                              <div className="space-y-0.5 text-left">
                                <span className="text-[8px] font-bold text-gray-400 uppercase">Wymagana data dostawy:</span>
                                <input
                                  type="date"
                                  value={item.deliveryDate || ''}
                                  onChange={(e) => updateDraftItem(product.id, { deliveryDate: e.target.value })}
                                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded px-2 py-0.5 outline-none font-bold text-gray-800 dark:text-white font-mono"
                                />
                              </div>

                              <div className="col-span-2 flex items-center pt-1 border-t border-gray-100 dark:border-gray-850 mt-1">
                                <label className="flex items-center gap-1.5 font-bold text-gray-500 dark:text-gray-400 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={item.allowSubstitutes ?? true}
                                    onChange={(e) => updateDraftItem(product.id, { allowSubstitutes: e.target.checked })}
                                    className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5 cursor-pointer"
                                  />
                                  <span>Zezwalaj dostawcy na zamienniki przy braku stanów</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Client Company Information form */}
                <div className="space-y-3.5 pt-2">
                  <h4 className="font-black text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b pb-1">Dane zamawiającego B2B</h4>
                  
                  <div className="grid grid-cols-2 gap-3.5 text-left font-bold text-gray-600 dark:text-gray-400">
                    <div className="col-span-2 space-y-1">
                      <label className="text-gray-500 dark:text-gray-400">Wybierz oddział docelowy dostawy *</label>
                      <select
                        value={rfqForm.selectedBranchId || 'loc-1'}
                        onChange={e => {
                          const branchId = e.target.value;
                          const branch = mockLocations.find(l => l.id === branchId);
                          if (branch) {
                            const isKomorniki = branchId === 'loc-1';
                            setRfqForm({
                              ...rfqForm,
                              selectedBranchId: branchId,
                              city: isKomorniki ? 'Komorniki' : 'Poznań',
                              postalCode: isKomorniki ? '62-052' : '60-205',
                              deliveryAddress: branch.address,
                            });
                          }
                        }}
                        className="w-full bg-blue-50/50 dark:bg-blue-950/10 border border-blue-150 dark:border-blue-900/30 rounded-xl px-3 py-2.5 outline-none text-blue-900 dark:text-blue-350 text-xs font-bold cursor-pointer"
                      >
                        {mockLocations.map(loc => (
                          <option key={loc.id} value={loc.id} className="dark:bg-gray-900 text-gray-800 dark:text-gray-200">{loc.name} — {loc.address}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label>Nazwisko nadawcy *</label>
                      <input
                        type="text"
                        required
                        value={rfqForm.clientName}
                        onChange={e => setRfqForm({ ...rfqForm, clientName: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl px-3 py-2 outline-none dark:text-white text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label>Nazwa warsztatu / firmy *</label>
                      <input
                        type="text"
                        required
                        value={rfqForm.companyName}
                        onChange={e => setRfqForm({ ...rfqForm, companyName: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl px-3 py-2 outline-none dark:text-white text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label>E-mail kontaktowy *</label>
                      <input
                        type="email"
                        required
                        value={rfqForm.email}
                        onChange={e => setRfqForm({ ...rfqForm, email: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl px-3 py-2 outline-none dark:text-white text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label>Telefon komórkowy</label>
                      <input
                        type="text"
                        value={rfqForm.phone}
                        onChange={e => setRfqForm({ ...rfqForm, phone: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl px-3 py-2 outline-none dark:text-white text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label>NIP firmy</label>
                      <input
                        type="text"
                        value={rfqForm.nip}
                        onChange={e => setRfqForm({ ...rfqForm, nip: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl px-3 py-2 outline-none dark:text-white text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label>Wymagana data dostawy (ogólna)</label>
                      <input
                        type="date"
                        value={rfqForm.expectedDeliveryDate}
                        onChange={e => setRfqForm({ ...rfqForm, expectedDeliveryDate: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl px-3 py-2 outline-none dark:text-white text-xs font-bold cursor-pointer font-mono"
                      />
                    </div>

                    <div className="col-span-2 space-y-1">
                      <label>Dokładny adres dostawy</label>
                      <input
                        type="text"
                        value={rfqForm.deliveryAddress}
                        onChange={e => setRfqForm({ ...rfqForm, deliveryAddress: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl px-3 py-2 outline-none dark:text-white text-xs font-bold"
                      />
                    </div>

                    <div className="col-span-2 space-y-1">
                      <label>Dodatkowe uwagi dla opiekuna handlowego (ogólne)</label>
                      <textarea
                        rows={3}
                        value={rfqForm.message}
                        onChange={e => setRfqForm({ ...rfqForm, message: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl px-3 py-2 outline-none dark:text-white text-xs font-bold resize-none"
                        placeholder="Napisz, jeśli zależy Ci na darmowym transporcie lub specyficznej godzinie rozładunku..."
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Panel */}
                <div className="pt-4 border-t border-gray-150 dark:border-gray-850 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={clearCurrentDraft}
                    className="py-3 px-5 text-gray-500 hover:text-rose-500 font-bold uppercase cursor-pointer"
                  >
                    Wyczyść szkic
                  </button>
                  <button
                    type="submit"
                    disabled={!activeDraft || activeDraft.items.length === 0}
                    className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-lg uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>Wyślij oficjalne zapytanie RFQ</span>
                  </button>
                </div>
              </form>
            ) : (
              // STATE 2: SUCCESS SUBMISSION & SIMULATION OF RESPONSES
              submittedRfq && (
                <div className="space-y-6 py-4">
                  
                  {/* Status Box */}
                  {submittedRfq.status === 'Wysłane' ? (
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-6 rounded-2xl text-center space-y-4 border border-blue-100/30">
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto animate-pulse">
                        <Clock className="h-6 w-6 stroke-[2]" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase tracking-tight">Zapytanie wysłane do dystrybutora</h4>
                        <p className="text-gray-400">Wygenerowany numer RFQ: <strong className="text-blue-600 dark:text-blue-400 font-mono text-xs">{submittedRfq.enquiryNumber}</strong></p>
                      </div>
                      
                      <div className="pt-3 border-t border-gray-150 dark:border-gray-850 space-y-3">
                        <p className="text-gray-500 font-medium leading-relaxed">
                          Dystrybutor <strong className="text-gray-700 dark:text-gray-300">{vendor.name}</strong> został powiadomiony. 
                          Wycena pozycji asortymentowych jest w toku.
                        </p>
                        
                        <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-250/20 text-[11px] space-y-2 text-left">
                          <span className="font-extrabold text-amber-800 dark:text-amber-400 block uppercase tracking-wider">⚡ Symulator odpowiedzi B2B:</span>
                          <span className="text-gray-650 dark:text-gray-400 leading-relaxed block">
                            W środowisku demonstracyjnym automatycznie zasymulujemy odpowiedź i szczegółową wycenę opiekuna handlowego za: 
                            <strong className="text-amber-800 dark:text-amber-400 font-mono font-bold text-xs mx-1">{simulationSecondsRemaining}s</strong>
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => triggerSimulationResponse()}
                            className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-[9px] uppercase tracking-wider rounded shadow-sm cursor-pointer mt-1"
                          >
                            Przyśpiesz odpowiedź dostawcy (Symulator)
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // STATUS: ODPOWIEDZIANE (OFFER RECEIVED!)
                    <div className="space-y-6">
                      
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 p-5 rounded-2xl text-center space-y-3.5 border border-emerald-100/30">
                        <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                          <Check className="h-5.5 w-5.5 stroke-[3]" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-sm text-emerald-800 dark:text-emerald-300 uppercase tracking-tight">Otrzymano odpowiedź od dostawcy!</h4>
                          <p className="text-gray-400">Oferta dla zapytania: <strong className="text-blue-600 dark:text-blue-400 font-mono">{submittedRfq.enquiryNumber}</strong></p>
                        </div>
                      </div>

                      {/* Vendor message */}
                      {submittedRfq.responseComment && (
                        <div className="p-4 bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/30 rounded-2xl flex gap-3 text-left">
                          <Info className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Komentarz handlowy dostawcy:</span>
                            <p className="text-gray-650 dark:text-gray-300 font-medium leading-relaxed mt-0.5">{submittedRfq.responseComment}</p>
                          </div>
                        </div>
                      )}

                      {/* Position-by-position list details */}
                      <div className="space-y-3">
                        <h4 className="font-black text-[10px] text-gray-400 uppercase tracking-widest font-mono border-b pb-1">Wynik wyceny pozycji ({submittedRfq.items.length})</h4>
                        
                        <div className="space-y-3">
                          {submittedRfq.responseItems?.map((ri: any) => {
                            const originalProduct = mockProducts.find(p => p.id === ri.productId);
                            const hasSubstitute = ri.decision === 'substitute' && ri.substituteProductId;
                            
                            return (
                              <div 
                                key={ri.productId}
                                className={cn(
                                  "p-3 rounded-xl border flex flex-col gap-2.5 text-left text-[11px]",
                                  hasSubstitute 
                                    ? "bg-amber-50/10 dark:bg-amber-950/5 border-amber-300/30" 
                                    : "bg-gray-50 dark:bg-gray-950/20 border-gray-150 dark:border-gray-850"
                                )}
                              >
                                {/* Row Top */}
                                <div className="flex justify-between items-start gap-2">
                                  <div className="min-w-0">
                                    <span className="text-[8px] font-bold text-gray-400 uppercase">Wnioskowano:</span>
                                    <h5 className="font-extrabold text-gray-900 dark:text-white truncate">{originalProduct?.name}</h5>
                                    <p className="text-[9px] text-gray-400 font-mono">Ilość: {ri.availableQty} op.</p>
                                  </div>

                                  {/* Decision status badge */}
                                  {ri.decision === 'accepted' && (
                                    <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded font-mono">
                                      Wyceniono ✓
                                    </span>
                                  )}
                                  {ri.decision === 'substitute' && (
                                    <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded font-mono">
                                      Zaproponowano zamiennik ⚡
                                    </span>
                                  )}
                                </div>

                                {/* Substitute view if applicable */}
                                {hasSubstitute && (
                                  <div className="bg-amber-50/30 dark:bg-amber-950/10 p-2.5 rounded-lg border border-amber-200/20 space-y-1">
                                    <span className="text-[8px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest block">Zamiennik Premium:</span>
                                    <p className="font-extrabold text-amber-900 dark:text-amber-300">{ri.substituteProductName}</p>
                                    <p className="text-[10px] text-gray-550 dark:text-gray-450 italic font-medium">&ldquo;{ri.comment}&rdquo;</p>
                                  </div>
                                )}

                                {/* Price breakdown */}
                                <div className="grid grid-cols-3 gap-2 border-t border-dashed border-gray-200 dark:border-gray-850 pt-2 font-mono text-[10px]">
                                  <div>
                                    <p className="text-[8px] font-sans text-gray-450 uppercase font-bold">Cena kat.</p>
                                    <p className="text-gray-400 line-through">{(originalProduct?.priceValue || 50).toFixed(2)} PLN</p>
                                  </div>
                                  <div>
                                    <p className="text-[8px] font-sans text-emerald-600 uppercase font-bold">Cena spec.</p>
                                    <p className="font-extrabold text-emerald-650 dark:text-emerald-400">{ri.offeredPrice.toFixed(2)} PLN</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[8px] font-sans text-gray-450 uppercase font-bold">Wartość netto</p>
                                    <p className="font-black text-gray-900 dark:text-white">{(ri.offeredPrice * ri.availableQty).toFixed(2)} PLN</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Total Calculation */}
                      <div className="bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-850 rounded-2xl p-4 space-y-2.5 text-left text-xs font-bold font-sans">
                        <div className="flex justify-between text-gray-400 text-[10px]">
                          <span>Suma katalogowa:</span>
                          <span className="font-mono line-through">
                            {submittedRfq.items.reduce((acc: number, item: any) => {
                              const prod = mockProducts.find(p => p.id === item.productId);
                              return acc + (prod?.priceValue || 50) * item.quantity;
                            }, 0).toFixed(2)} PLN
                          </span>
                        </div>
                        <div className="flex justify-between text-emerald-600 text-[10px]">
                          <span>Udzielony rabat specjalny:</span>
                          <span>-12.00%</span>
                        </div>
                        <div className="flex justify-between text-gray-400 text-[10px]">
                          <span>Koszt dostawy (B2B):</span>
                          <span className="text-emerald-500 uppercase font-mono font-bold">DARMOWA ✓</span>
                        </div>
                        <div className="border-t border-gray-250 dark:border-gray-800 pt-2 flex justify-between text-gray-900 dark:text-white">
                          <span className="font-black">SUMA OFERTY NETTO:</span>
                          <span className="font-black font-mono text-sm text-blue-600 dark:text-blue-400">
                            {submittedRfq.responseItems?.reduce((acc: number, ri: any) => acc + (ri.offeredPrice * ri.availableQty), 0).toFixed(2)} PLN
                          </span>
                        </div>
                      </div>

                      {/* Final accept simulated offer */}
                      <div className="pt-2 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={handleAcceptSimulatedOffer}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Check className="h-4.5 w-4.5" />
                          <span>Zaakceptuj wycenę i wyślij zamówienie</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            clearCurrentDraft();
                            setIsDrawerOpen(false);
                            setToast({
                              title: 'Zapytanie zamknięte',
                              message: 'Zapytanie pozostało w historii jako odpowiedziane.',
                              type: 'info'
                            });
                          }}
                          className="w-full py-2.5 text-gray-500 hover:text-gray-800 dark:hover:text-white font-bold uppercase cursor-pointer text-center"
                        >
                          Zamknij podgląd
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Custom Toast Alerts */}
      {toast && (
        <div className="fixed top-6 right-6 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 border border-gray-800 dark:border-gray-200 animate-slide-left">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
            ✓
          </div>
          <div>
            <h4 className="font-extrabold text-xs">{toast.title}</h4>
            <p className="text-[10px] text-gray-450 dark:text-gray-500 mt-0.5">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Custom Icons needed */}
      <XIconStyle />
    </div>
  );
}

// Inline support component for styling or quick layout support
function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function XIconStyle() {
  return (
    <style jsx global>{`
      @keyframes slideLeft {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      .animate-slide-left {
        animation: slideLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
    `}</style>
  );
}
