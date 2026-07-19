'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useIsMobile } from '../hooks/use-mobile';
import { 
  mockLocations, 
  mockVendors, 
  mockProducts, 
  mockInventoryBalances, 
  mockReplenishmentProposals, 
  mockOrders, 
  mockPromotions, 
  mockDigitalFlyers, 
  mockShowrooms, 
  mockQuotations, 
  mockConversations, 
  mockNotifications, 
  currentUser 
} from '../lib/mockData';
import { mockVendors as publicMockVendors, mockProducts as publicMockProducts } from '../components/marketplace/mockData';
import { SavedMarketplaceItem, PublicProduct } from '../components/marketplace/types';
import { 
  Vendor, 
  Product, 
  InventoryBalance, 
  ReplenishmentProposal, 
  Order, 
  Quotation, 
  DigitalFlyer, 
  Conversation, 
  Notification, 
  UserProfile, 
  OrderLine,
  ReplenishmentProposalLine
} from '../lib/types';

// Importing Custom Screens
import LoginScreen from '../components/LoginScreen';
import StockCountWorkflow from '../components/StockCountWorkflow';
import DigitalFlyerViewer from '../components/DigitalFlyerViewer';
import MessagesCenter from '../components/MessagesCenter';
import ProposalDetail from '../components/ProposalDetail';
import DashboardView from '../components/DashboardView';
import InventoryView from '../components/InventoryView';
import OrdersView from '../components/OrdersView';
import OffersView from '../components/OffersView';
import VendorDashboardView from '../components/VendorDashboardView';
import MarketplaceContainer from '../components/marketplace/MarketplaceContainer';

import { 
  Bell, 
  CheckCircle2, 
  Database, 
  FileText,
  Globe, 
  Globe2, 
  HelpCircle, 
  Home, 
  Layers, 
  LogOut, 
  MessageSquare, 
  Package, 
  Plus,
  RefreshCw, 
  Settings,
  ShieldCheck, 
  ShoppingBag, 
  Sun,
  Moon,
  User, 
  Wifi, 
  WifiOff,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Heart,
  Building2,
  Search,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';

// Static available staff per vendor
const VENDOR_CONTACTS: Record<string, { name: string; role: string; phone: string; email: string; status: 'online' | 'busy' | 'offline' }[]> = {
  'v-1': [
    { name: 'Tomasz Kowalski', role: 'Główny opiekun', phone: '+48 601 234 567', email: 't.kowalski@autopartspro.pl', status: 'online' },
    { name: 'Janusz Nowak', role: 'Wsparcie techniczne', phone: '+48 601 111 222', email: 'j.nowak@autopartspro.pl', status: 'online' }
  ],
  'v-2': [
    { name: 'Andrzej Wiśniewski', role: 'Kluczowy opiekun', phone: '+48 602 987 654', email: 'a.wisniewski@werktools.pl', status: 'online' },
    { name: 'Marcin Zieliński', role: 'Inżynier sprzedaży', phone: '+48 602 333 444', email: 'm.zielinski@werktools.pl', status: 'offline' }
  ],
  'v-3': [
    { name: 'Karolina Nowak', role: 'Opiekun handlowy', phone: '+48 501 111 222', email: 'k.nowak@cleanchem.com.pl', status: 'online' },
    { name: 'Piotr Kaczmarek', role: 'Dyrektor handlowy', phone: '+48 501 555 666', email: 'p.kaczmarek@cleanchem.com.pl', status: 'busy' }
  ],
  'v-4': [
    { name: 'Marek Jankowski', role: 'Konsultant techniczny', phone: '+48 701 444 555', email: 'm.jankowski@safecut.pl', status: 'online' },
    { name: 'Anna Dąbrowska', role: 'Dział logistyki', phone: '+48 701 888 999', email: 'a.dabrowska@safecut.pl', status: 'online' }
  ]
};

const VENDOR_PORTFOLIOS: Record<string, { since: string; about: string; specialties: string[]; certifications: string[] }> = {
  'v-1': {
    since: '2004',
    about: 'AutoParts Pro to wiodący dostawca oryginalnych części zamiennych i akcesoriów samochodowych. Działamy w systemie VMI, dostarczając produkty bezpośrednio do warsztatów w czasie krótszym niż 4 godziny.',
    specialties: ['Układy hamulcowe', 'Filtry i oleje', 'Zawieszenie', 'Elektryka samochodowa'],
    certifications: ['ISO 9001:2015', 'TÜV Rheinland', 'ATE Brake Center']
  },
  'v-2': {
    since: '2011',
    about: 'WerkTools specjalizuje się w dostarczaniu najwyższej jakości narzędzi ręcznych, pneumatycznych i elektronarzędzi dla wymagających profesjonalistów warsztatowych.',
    specialties: ['Narzędzia ręczne', 'Pneumatyka', 'Wózki warsztatowe', 'Elektronarzędzia'],
    certifications: ['Certyfikat ISO 9001', 'Gwarancja WerkLife', 'Atesty bezpieczeństwa CE']
  },
  'v-3': {
    since: '2015',
    about: 'CleanChem to producent innowacyjnych, ekologicznych preparatów czyszczących, odtłuszczaczy i chemii technicznej przeznaczonej dla przemysłu i warsztatów.',
    specialties: ['Zmywacze ekologiczne', 'Płyny eksploatacyjne', 'Środki BHP i czystości', 'Chemia warsztatowa'],
    certifications: ['Normy REACH', 'Atest PZH', 'ISO 14001:2015 (Eco)']
  },
  'v-4': {
    since: '2009',
    about: 'SafetyCore to Twój zaufany partner w dziedzinie bezpieczeństwa i higieny pracy. Projektujemy i dostarczamy profesjonalną odzież roboczą, obuwie i ochronniki.',
    specialties: ['Odzież robocza BHP', 'Obuwie ochronne S3', 'Ochrona dróg oddechowych', 'Automaty vendingowe BHP'],
    certifications: ['EN ISO 20345', 'Certyfikaty OEKO-TEX', 'Standard CE Ochrony']
  }
};

const VENDOR_ANNOUNCEMENTS: Record<string, Array<{
  id: string;
  title: string;
  type: 'announcement' | 'offer' | 'info';
  content: string;
  badgeText: string;
}>> = {
  'v-1': [
    {
      id: 'v1-news-1',
      title: 'Limitowana Oferta: Dodatkowy rabat 15% na wybrane elementy złączne VMI',
      type: 'offer',
      content: 'Specjalny pakiet rabatowy przygotowany dla Twoich oddziałów handlowych. Wszystkie zamówienia na wybrane śruby, nakrętki oraz podkładki ocynkowane złożone do końca tego tygodnia za pośrednictwem portalu VMI zostaną zrabatowane o dodatkowe 15% netto!',
      badgeText: 'PROMOCJA -15%'
    },
    {
      id: 'v1-news-2',
      title: 'Wdrożenie zautomatyzowanych regałów logistycznych VMI Express',
      type: 'info',
      content: 'W przyszłym miesiącu planujemy montaż inteligentnych, zautomatyzowanych regałów magazynowych bezpośrednio w Twoich halach warsztatowych. System będzie zintegrowany ze skanerem kodów kreskowych, dzięki czemu stany inwentaryzacji będą raportowane w czasie rzeczywistym.',
      badgeText: 'NOWOŚĆ TECHNICZNA'
    },
    {
      id: 'v1-news-3',
      title: 'Zasady BHP przy odbiorze dostaw interwencyjnych',
      type: 'announcement',
      content: 'Przypominamy wszystkim kierownikom oddziałów o bezwzględnym obowiązku używania kamizelek odblaskowych oraz obuwia ochronnego podczas rozładunku dostaw realizowanych przez spedycję VMI Express.',
      badgeText: 'BHP I LOGISTYKA'
    }
  ],
  'v-2': [
    {
      id: 'v2-news-1',
      title: 'Wyprzedaż zestawów narzędziowych Beta: do -25% do końca miesiąca!',
      type: 'offer',
      content: 'Uzupełnij wyposażenie stanowisk pracy o legendarne zestawy kluczy i wkrętaków marki Beta. Zamówienia składane przez system VMI automatycznie otrzymują 25% upustu. Oferta ważna do wyczerpania zapasów magazynowych.',
      badgeText: 'WYPRZEDAŻ -25%'
    },
    {
      id: 'v2-news-2',
      title: 'Mobilna kalibracja kluczy dynamometrycznych w Twoim warsztacie',
      type: 'info',
      content: 'Nasz mobilny autobus techniczny odwiedzi Twoje serwisy w przyszły wtorek. Oferujemy bezpłatną kalibrację i certyfikację wszystkich kluczy dynamometrycznych używanych na stanowiskach naprawczych. Zapisz się już dziś!',
      badgeText: 'MOBILNY SERWIS'
    },
    {
      id: 'v2-news-3',
      title: 'Prezentacja nowej serii szaf narzędziowych ToolBox VMI',
      type: 'announcement',
      content: 'Wprowadzamy nową generację inteligentnych szaf warsztatowych ToolBox z wbudowaną wagą RFID. Automatyczna ewidencja wydawania i zwrotu narzędzi pozwoli wyeliminować straty operacyjne o ponad 40%.',
      badgeText: 'INNOWACJA'
    }
  ],
  'v-3': [
    {
      id: 'v3-news-1',
      title: 'Premiera: Ekologiczny zmywacz BioClean-15 wolny od LZO',
      type: 'info',
      content: 'Przedstawiamy w pełni biodegradowalny, bezpieczny dla skóry zmywacz montażowy serii BioClean-15. Wyprodukowany na bazie ekstraktów cytrusowych, nie wydziela szkodliwych oparów i doskonale czyści tarcze hamulcowe.',
      badgeText: 'EKO NOWOŚĆ'
    },
    {
      id: 'v3-news-2',
      title: 'Bezpłatna dzierżawa automatycznych stacji dozujących chemię',
      type: 'offer',
      content: 'Chcesz obniżyć zużycie koncentratów myjących? Zainstaluj bezpłatną, automatyczną stację dozującą CleanChem Eco-Mix. Urządzenie precyzyjnie miesza wodę z preparatem, redukując koszty chemii o 35%.',
      badgeText: 'ZYSKAJ OSZCZĘDNOŚĆ'
    },
    {
      id: 'v3-news-3',
      title: 'Odbiór i utylizacja pustych beczek i opakowań VMI',
      type: 'announcement',
      content: 'W ramach naszej polityki zero waste, kierowcy dostarczający chemię VMI mogą bezpłatnie odebrać zużyte opakowania i beczki plastikowe w celu ich ponownego napełnienia lub ekologicznej utylizacji.',
      badgeText: 'UTYLIZACJA BEZPŁATNA'
    }
  ],
  'v-4': [
    {
      id: 'v4-news-1',
      title: 'Szybka personalizacja odzieży: Haft komputerowy z logo gratis!',
      type: 'offer',
      content: 'Dla wszystkich nowych zamówień na kurtki i spodnie robocze marki SafetyCore oferujemy wykonanie haftu komputerowego z logo Twojego serwisu zupełnie za darmo. Promocja obowiązuje przy zamówieniach powyżej 10 kpl.',
      badgeText: 'HAFT GRATIS'
    },
    {
      id: 'v4-news-2',
      title: 'Nowa norma ochrony EN ISO 20345 S3 dla obuwia roboczego',
      type: 'info',
      content: 'Wszystkie modele butów ochronnych z naszej najnowszej kolekcji posiadają już pełne akredytacje nowej, zaostrzonej normy EN ISO 20345:2022. Wybierz maksymalną stabilność stopy i ochronę antyprzebiciową.',
      badgeText: 'NORMA BHP 2022'
    },
    {
      id: 'v4-news-3',
      title: 'Montaż automatów vendingowych BHP-omat VMI na Twojej hali',
      type: 'announcement',
      content: 'Uruchomiliśmy program pilotażowy montażu automatów BHP-omat. Twoi mechanicy mogą pobierać rękawice robocze, maski i okulary ochronne za pomocą kart pracowniczych. Pełna kontrola zużycia BHP 24/7.',
      badgeText: 'BHP VENDING'
    }
  ]
};

export default function MainPage() {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(handle);
  }, []);
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
      if (savedTheme) return savedTheme;
      const systemPref = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      return systemPref;
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(currentUser);
  const [showLogin, setShowLogin] = useState<boolean>(false);

  // App Navigation Routing State
  const [currentTab, setCurrentTab] = useState<'home' | 'vendors' | 'inventory' | 'orders' | 'offers' | 'messages' | 'settings' | 'marketplace'>('home');
  const [marketplaceInitialPath, setMarketplaceInitialPath] = useState<string | null>(null);
  const [activeLocationId, setActiveLocationId] = useState<string>('loc-1');

  // Saved Marketplace Items State
  const [marketplaceSavedItems, setMarketplaceSavedItems] = useState<SavedMarketplaceItem[]>([]);
  
  useEffect(() => {
    const loadSaved = () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('ambra-marketplace-saved');
        if (stored) {
          try {
            setMarketplaceSavedItems(JSON.parse(stored));
          } catch (e) {
            console.error(e);
          }
        } else {
          setMarketplaceSavedItems([]);
        }
      }
    };
    loadSaved();
    window.addEventListener('storage', loadSaved);
    return () => window.removeEventListener('storage', loadSaved);
  }, [currentTab]);

  // Vendors Tab Sub-Routing & Filtering States
  const [vendorsSubtab, setVendorsSubtab] = useState<'partner' | 'favourite_products' | 'favourite_vendors'>('partner');
  const [vendorFilterId, setVendorFilterId] = useState<string>('all');
  const [dostawcySearch, setDostawcySearch] = useState<string>('');
  
  // Simulated developer features
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineDraftsCount, setOfflineDraftsCount] = useState<number>(0);

  // Domain state layers
  const [inventoryBalances, setInventoryBalances] = useState<InventoryBalance[]>([]);
  const [proposals, setProposals] = useState<ReplenishmentProposal[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Separate Carts by Vendor: { [vendorId: string]: OrderLine[] }
  const [carts, setCarts] = useState<{ [vendorId: string]: OrderLine[] }>({});

  // Active sub-modals or detail-screen overlays
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);
  const [expandedContactsVendorId, setExpandedContactsVendorId] = useState<string | null>(null);
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [partnerActiveSlides, setPartnerActiveSlides] = useState<Record<string, number>>({});

  // Auto-play interval for compact partner announcements sliders
  useEffect(() => {
    const interval = setInterval(() => {
      setPartnerActiveSlides(prev => {
        const next: Record<string, number> = { ...prev };
        mockVendors.forEach(v => {
          const vendorNews = VENDOR_ANNOUNCEMENTS[v.id] || [];
          const totalSlides = 2 + vendorNews.length; // 2 portfolio slides + news
          const current = prev[v.id] || 0;
          next[v.id] = (current + 1) % totalSlides;
        });
        return next;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const [activeFlyer, setActiveFlyer] = useState<DigitalFlyer | null>(null);
  const [isCountWorkflowOpen, setIsCountWorkflowOpen] = useState<boolean>(false);
  
  // Quick deep link variables
  const [messageCenterInitialId, setMessageCenterInitialId] = useState<string | null>(null);
  const [vendorDashboardInitialNewsId, setVendorDashboardInitialNewsId] = useState<string | undefined>(undefined);

  // 1. Synchronize to/from localStorage on Mount & Update
  useEffect(() => {
    const loadPersistedState = () => {
      // Load from local storage or fallback to mock files
      const storedAuth = localStorage.getItem('vmi_is_logged_in');
      if (storedAuth === 'true') {
        setIsLoggedIn(true);
      }

      const storedInventory = localStorage.getItem('vmi_inventory');
      if (storedInventory) {
        setInventoryBalances(JSON.parse(storedInventory));
      } else {
        setInventoryBalances(mockInventoryBalances);
      }

      const storedProposals = localStorage.getItem('vmi_proposals');
      if (storedProposals) {
        setProposals(JSON.parse(storedProposals));
      } else {
        setProposals(mockReplenishmentProposals);
      }

      const storedOrders = localStorage.getItem('vmi_orders');
      if (storedOrders) {
        setOrders(JSON.parse(storedOrders));
      } else {
        setOrders(mockOrders);
      }

      const storedQuotations = localStorage.getItem('vmi_quotations');
      if (storedQuotations) {
        setQuotations(JSON.parse(storedQuotations));
      } else {
        setQuotations(mockQuotations);
      }

      const storedConversations = localStorage.getItem('vmi_conversations');
      if (storedConversations) {
        setConversations(JSON.parse(storedConversations));
      } else {
        setConversations(mockConversations);
      }

      const storedNotifications = localStorage.getItem('vmi_notifications');
      if (storedNotifications) {
        setNotifications(JSON.parse(storedNotifications));
      } else {
        setNotifications(mockNotifications);
      }

      const storedCarts = localStorage.getItem('vmi_carts');
      if (storedCarts) {
        setCarts(JSON.parse(storedCarts));
      }

      const storedOfflineDrafts = localStorage.getItem('vmi_offline_drafts_count');
      if (storedOfflineDrafts) {
        setOfflineDraftsCount(parseInt(storedOfflineDrafts, 10));
      }
    };

    const timer = setTimeout(loadPersistedState, 0);
    return () => clearTimeout(timer);
  }, []);

  // Helpers to update and persist state
  const saveInventoryState = (newBalances: InventoryBalance[]) => {
    setInventoryBalances(newBalances);
    localStorage.setItem('vmi_inventory', JSON.stringify(newBalances));
  };

  const saveProposalsState = (newProposals: ReplenishmentProposal[]) => {
    setProposals(newProposals);
    localStorage.setItem('vmi_proposals', JSON.stringify(newProposals));
  };

  const saveOrdersState = (newOrders: Order[]) => {
    setOrders(newOrders);
    localStorage.setItem('vmi_orders', JSON.stringify(newOrders));
  };

  const saveQuotationsState = (newQuotations: Quotation[]) => {
    setQuotations(newQuotations);
    localStorage.setItem('vmi_quotations', JSON.stringify(newQuotations));
  };

  const saveNotificationsState = (newNotifs: Notification[]) => {
    setNotifications(newNotifs);
    localStorage.setItem('vmi_notifications', JSON.stringify(newNotifs));
  };

  const saveConversationsState = (newConvs: Conversation[]) => {
    setConversations(newConvs);
    localStorage.setItem('vmi_conversations', JSON.stringify(newConvs));
  };

  const saveCartsState = (newCarts: { [vendorId: string]: OrderLine[] }) => {
    setCarts(newCarts);
    localStorage.setItem('vmi_carts', JSON.stringify(newCarts));
  };

  // 2. Action Flow Implementations
  const handleLogin = (profile: UserProfile) => {
    setUserProfile(profile);
    setIsLoggedIn(true);
    localStorage.setItem('vmi_is_logged_in', 'true');
    
    // Auto trigger welcome notification
    triggerLocalNotification('System VMI', 'Zalogowano pomyślnie do platformy Ambra VMI. Witaj, Michał!');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('vmi_is_logged_in');
  };

  const triggerLocalNotification = (title: string, content: string, type: any = 'Low-stock warning') => {
    const newNotif: Notification = {
      id: `n_loc_${Date.now()}`,
      type,
      title,
      content,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      isRead: false
    };
    saveNotificationsState([newNotif, ...notifications]);
  };

  // Add item to cart
  const handleAddToCart = (productId: string, qty: number) => {
    const prod = mockProducts.find(p => p.id === productId);
    if (!prod) return;

    const vendorId = prod.vendorId;
    const price = prod.promoPrice || prod.price;

    const vendorCart = carts[vendorId] || [];
    const idx = vendorCart.findIndex(i => i.productId === productId);
    
    let updatedCart = [...vendorCart];
    if (idx > -1) {
      updatedCart[idx].requestedQty += qty;
      updatedCart[idx].confirmedQty = updatedCart[idx].requestedQty;
    } else {
      updatedCart.push({ 
        productId, 
        requestedQty: qty, 
        confirmedQty: qty,
        shippedQty: 0,
        deliveredQty: 0,
        price 
      });
    }

    const updatedCarts = { ...carts, [vendorId]: updatedCart };
    saveCartsState(updatedCarts);

    triggerLocalNotification(
      'Koszyk zaktualizowany', 
      `Dodano ${qty} szt. produktu "${prod.name}" do koszyka dostawcy "${mockVendors.find(v => v.id === vendorId)?.name}".`
    );
  };

  // Remove from cart
  const handleRemoveFromCart = (vendorId: string, productId: string) => {
    const vendorCart = carts[vendorId] || [];
    const updatedCart = vendorCart.filter(i => i.productId !== productId);
    const updatedCarts = { ...carts, [vendorId]: updatedCart };
    saveCartsState(updatedCarts);
  };

  // Update quantity in cart
  const handleUpdateCartQty = (vendorId: string, productId: string, qty: number) => {
    const vendorCart = carts[vendorId] || [];
    const updatedCart = vendorCart.map(item => {
      if (item.productId === productId) {
        return { ...item, requestedQty: qty };
      }
      return item;
    });
    const updatedCarts = { ...carts, [vendorId]: updatedCart };
    saveCartsState(updatedCarts);
  };

  // Checkout (manual cart submission to VMI Order)
  const handleCheckout = (
    vendorId: string,
    deliveryLocationId: string,
    requestedDeliveryDate: string,
    poReference: string,
    comments: string
  ) => {
    const vendorCart = carts[vendorId] || [];
    if (vendorCart.length === 0) return;

    // Create new order object
    const newOrder: Order = {
      id: `o_loc_${Date.now()}`,
      vendorId,
      locationId: deliveryLocationId,
      orderNumber: `ZAM-202607-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().substring(0, 10),
      requestedDeliveryDate,
      origin: 'Zamówienie ręczne',
      status: 'Wysłane',
      poReference: poReference || `PO-MAN-${Date.now().toString().slice(-4)}`,
      notes: comments,
      hasAttachment: false,
      lines: vendorCart.map(i => ({
        productId: i.productId,
        requestedQty: i.requestedQty,
        confirmedQty: i.requestedQty,
        shippedQty: 0,
        deliveredQty: 0,
        price: i.price
      })),
      timeline: [
        { status: 'Szkic', date: new Date().toISOString().substring(0, 16).replace('T', ' '), description: 'Złożono zamówienie z portalu mobilnego.' }
      ]
    };

    // Save order
    const nextOrders = [newOrder, ...orders];
    saveOrdersState(nextOrders);

    // Empty specific cart
    const nextCarts = { ...carts };
    delete nextCarts[vendorId];
    saveCartsState(nextCarts);

    // Create success notification
    triggerLocalNotification(
      'Nowe zamówienie ręczne',
      `Złożono zamówienie ${newOrder.orderNumber} do dostawcy ${mockVendors.find(v => v.id === vendorId)?.name}.`,
      'Order status changed'
    );
  };

  // Message Sending
  const handleSendMessage = (conversationId: string, text: string) => {
    const updated = conversations.map(c => {
      if (c.id === conversationId) {
        return {
          ...c,
          unreadCount: 0,
          lastUpdated: new Date().toISOString(),
          messages: [
            ...c.messages,
            {
              id: `msg_loc_${Date.now()}`,
              sender: 'client' as const,
              senderName: userProfile.name,
              content: text,
              timestamp: new Date().toISOString()
            }
          ]
        };
      }
      return c;
    });
    saveConversationsState(updated);
  };

  // Initiate message from product detail / quotation / order context
  const handleInitiateContextChat = (
    vendorId: string, 
    subject: string, 
    objectType: 'product' | 'order' | 'quotation' | 'proposal' | 'none', 
    objectId: string
  ) => {
    // Check if duplicate conversation exists
    const existing = conversations.find(c => 
      c.vendorId === vendorId && 
      c.relatedObjectType === objectType && 
      c.relatedObjectId === objectId
    );

    if (existing) {
      setMessageCenterInitialId(existing.id);
      setCurrentTab('messages'); // Messages is placed in 'messages' tab
      return;
    }

    // Create new conversation
    const newConv: Conversation = {
      id: `c_loc_${Date.now()}`,
      vendorId,
      subject,
      relatedObjectType: objectType,
      relatedObjectId: objectId,
      lastUpdated: new Date().toISOString(),
      unreadCount: 0,
      status: 'active',
      messages: [
        {
          id: `msg_init_${Date.now()}`,
          sender: 'client',
          senderName: userProfile.name,
          content: `Cześć, piszę z zapytaniem w temacie: ${subject}.`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    saveConversationsState([newConv, ...conversations]);
    setMessageCenterInitialId(newConv.id);
    setCurrentTab('messages'); // Switch to message tab
    
    triggerLocalNotification('Czat rozpoczęty', `Zainicjowano nową dyskusję kontekstową z dostawcą.`);
  };

  // Submit approved VMI replenishment proposal
  const handleProposalApprovalSubmit = (
    proposalId: string, 
    approvedLines: ReplenishmentProposalLine[], 
    comments?: string
  ) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;

    // Convert approved proposal lines into a new order
    const newOrder: Order = {
      id: `o_prop_${Date.now()}`,
      vendorId: proposal.vendorId,
      locationId: proposal.locationId,
      orderNumber: `ZAM-VMI-${proposal.proposalNumber.substring(8)}`,
      date: new Date().toISOString().substring(0, 10),
      requestedDeliveryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString().substring(0, 10), // +3 days
      origin: 'Propozycja uzupełnienia',
      status: 'Wysłane',
      poReference: `PO-VMI-${proposal.proposalNumber.split('-')[2]}`,
      notes: comments || 'Automatyczna akceptacja propozycji VMI bez dodatkowych modyfikacji.',
      hasAttachment: false,
      lines: approvedLines.map(line => ({
        productId: line.productId,
        requestedQty: line.finalProposedQty,
        confirmedQty: line.finalProposedQty,
        shippedQty: 0,
        deliveredQty: 0,
        price: line.price
      })),
      timeline: [
        { status: 'Szkic', date: new Date().toISOString().replace('T', ' ').substring(0, 16), description: 'Wygenerowano automatycznie z harmonogramu inwentaryzacji VMI.' },
        { status: 'Wysłane', date: new Date().toISOString().replace('T', ' ').substring(0, 16), description: 'Zatwierdzono przez kierownika oddziału.' }
      ]
    };

    // Save order & update proposal status
    const updatedOrders = [newOrder, ...orders];
    saveOrdersState(updatedOrders);

    const updatedProposals: ReplenishmentProposal[] = proposals.map(p => {
      if (p.id === proposalId) {
        return { ...p, status: 'Zatwierdzona' as const };
      }
      return p;
    });
    saveProposalsState(updatedProposals);

    // Update product stock levels based on approved proposal
    const updatedBalances = inventoryBalances.map(bal => {
      const approvedLine = approvedLines.find(l => l.productId === bal.productId);
      if (approvedLine) {
        return {
          ...bal,
          incomingQty: bal.incomingQty + approvedLine.finalProposedQty
        };
      }
      return bal;
    });
    saveInventoryState(updatedBalances);

    setActiveProposalId(null);
    triggerLocalNotification(
      'Propozycja VMI zaakceptowana',
      `Zatwierdzono propozycję ${proposal.proposalNumber}. Wygenerowano zamówienie VMI ${newOrder.orderNumber}.`,
      'Order status changed'
    );
  };

  // Submit physical stock counting
  const handleStockCountSubmit = (countedLines: { [id: string]: number }, comments?: string) => {
    // Check network connectivity
    if (!isOnline) {
      // Simulate offline buffer saving
      setOfflineDraftsCount(prev => {
        const next = prev + 1;
        localStorage.setItem('vmi_offline_drafts_count', next.toString());
        return next;
      });

      // Save counts locally as cached drafts
      const storedDrafts = localStorage.getItem('vmi_offline_drafts_data') || '[]';
      const draftsArray = JSON.parse(storedDrafts);
      draftsArray.push({ countedLines, date: new Date().toISOString() });
      localStorage.setItem('vmi_offline_drafts_data', JSON.stringify(draftsArray));

      setIsCountWorkflowOpen(false);
      triggerLocalNotification(
        'Szkic inwentaryzacji (Offline)',
        'Brak połączenia sieciowego. Spis zapisany bezpiecznie jako szkic lokalny w pamięci urządzenia. Zostanie zsynchronizowany po przywróceniu sieci.'
      );
      return;
    }

    // Online count update
    const updatedBalances = inventoryBalances.map(bal => {
      if (bal.locationId === activeLocationId && countedLines[bal.productId] !== undefined) {
        const counted = countedLines[bal.productId];
        let status: 'Healthy' | 'Approaching minimum' | 'Below minimum' | 'Out of stock' | 'Overstocked' = 'Healthy';
        
        if (counted === 0) status = 'Out of stock';
        else if (counted <= bal.minStock) status = 'Below minimum';
        else if (counted > bal.targetStock * 1.5) status = 'Overstocked';

        return {
          ...bal,
          currentStock: counted,
          stockStatus: status,
          lastUpdated: new Date().toISOString()
        };
      }
      return bal;
    });

    saveInventoryState(updatedBalances);
    setIsCountWorkflowOpen(false);

    triggerLocalNotification(
      'Stan magazynowy zaktualizowany',
      'Pomyślnie zsynchronizowano nową inwentaryzację warsztatową VMI. Stany magazynowe zostały zaktualizowane.',
      'Stock-count request'
    );
  };

  // Force Resync offline drafts when online is turned back on
  const handleSyncOfflineDrafts = () => {
    if (!isOnline) {
      alert('Nie można zsynchronizować w trybie Offline. Włącz sieć komórkową lub Wi-Fi!');
      return;
    }

    const storedDrafts = localStorage.getItem('vmi_offline_drafts_data');
    if (storedDrafts) {
      const draftsArray = JSON.parse(storedDrafts);
      let updatedBalances = [...inventoryBalances];

      draftsArray.forEach((draft: any) => {
        updatedBalances = updatedBalances.map(bal => {
          if (bal.locationId === activeLocationId && draft.countedLines[bal.productId] !== undefined) {
            const counted = draft.countedLines[bal.productId];
            let status: 'Healthy' | 'Approaching minimum' | 'Below minimum' | 'Out of stock' | 'Overstocked' = 'Healthy';
            
            if (counted === 0) status = 'Out of stock';
            else if (counted <= bal.minStock) status = 'Below minimum';

            return {
              ...bal,
              currentStock: counted,
              stockStatus: status,
              lastUpdated: draft.date
            };
          }
          return bal;
        });
      });

      saveInventoryState(updatedBalances);
    }

    // Reset drafts
    setOfflineDraftsCount(0);
    localStorage.removeItem('vmi_offline_drafts_count');
    localStorage.removeItem('vmi_offline_drafts_data');

    triggerLocalNotification(
      'Szkice offline wysłane',
      'Pomyślnie wysłano i zsynchronizowano wszystkie zaległe inwentaryzacje z bufora offline.'
    );
  };

  const handleClearDemoCache = () => {
    localStorage.clear();
    window.location.reload();
  };

  // Filter conversations
  const unreadMessagesCount = useMemo(() => {
    return conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  }, [conversations]);

  // Notifications bell count
  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  // Pending orders count for active location
  const pendingOrdersCount = useMemo(() => {
    return orders.filter(o => o.locationId === activeLocationId && !['Dostarczone', 'Anulowane', 'Szkic'].includes(o.status)).length;
  }, [orders, activeLocationId]);

  // Clear unread badge of notifications
  const handleMarkNotificationsRead = () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    saveNotificationsState(updated);
  };

  // Render Page Content Tabs Router
  const renderTabContent = () => {
    switch (currentTab) {
      case 'home':
        return (
          <DashboardView
            locations={mockLocations}
            activeLocationId={activeLocationId}
            setActiveLocationId={setActiveLocationId}
            inventoryBalances={inventoryBalances}
            proposals={proposals}
            orders={orders}
            quotations={quotations}
            notifications={notifications}
            vendors={mockVendors}
            onNavigateTab={setCurrentTab}
            onOpenProposal={setActiveProposalId}
            onOpenOrder={(id) => { setSelectedOrderViewId(id); setCurrentTab('orders'); }}
            onOpenQuotation={(id) => { setActiveVendorId('v-4'); }} // BHP SafetyCore
            onOpenStockCount={() => setIsCountWorkflowOpen(true)}
            onOpenVendor={(vendorId, subtab) => { setActiveVendorId(vendorId); }}
            onNavigateToMarketplace={(path) => {
              setMarketplaceInitialPath(path);
              setCurrentTab('marketplace');
            }}
          />
        );

      case 'vendors': {
        // Resolve favorite products & vendors
        const savedProducts = marketplaceSavedItems
          .filter(item => item.type === 'product')
          .map(item => publicMockProducts.find(p => p.id === item.id))
          .filter(Boolean) as PublicProduct[];

        const savedVendors = marketplaceSavedItems
          .filter(item => item.type === 'vendor')
          .map(item => publicMockVendors.find(v => v.id === item.id))
          .filter(Boolean) as (typeof publicMockVendors);

        // Filters
        const filteredPartnerVendors = mockVendors.filter(v => {
          if (dostawcySearch) {
            const q = dostawcySearch.toLowerCase();
            return v.name.toLowerCase().includes(q) || v.industry.toLowerCase().includes(q);
          }
          return true;
        });

        const filteredFavProducts = savedProducts.filter(p => {
          if (vendorFilterId !== 'all') {
            const partnerIdMap = vendorFilterId.replace('v-', 'mv-');
            if (p.vendorId !== partnerIdMap) return false;
          }
          if (dostawcySearch) {
            const q = dostawcySearch.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
          }
          return true;
        });

        const filteredFavVendors = savedVendors.filter(v => {
          if (dostawcySearch) {
            const q = dostawcySearch.toLowerCase();
            return v.name.toLowerCase().includes(q) || v.category.toLowerCase().includes(q) || v.city.toLowerCase().includes(q);
          }
          return true;
        });

        const handleRemoveProductFromSaved = (productId: string) => {
          const updated = marketplaceSavedItems.filter(item => !(item.type === 'product' && item.id === productId));
          setMarketplaceSavedItems(updated);
          localStorage.setItem('ambra-marketplace-saved', JSON.stringify(updated));
        };

        const handleRemoveVendorFromSaved = (vendorId: string) => {
          const updated = marketplaceSavedItems.filter(item => !(item.type === 'vendor' && item.id === vendorId));
          setMarketplaceSavedItems(updated);
          localStorage.setItem('ambra-marketplace-saved', JSON.stringify(updated));
        };

        return (
          <div className="space-y-6 text-xs animate-fade-in">
            {/* Header */}
            <div>
              <h2 className="text-base font-bold text-gray-950 dark:text-white font-display">Dostawcy i Baza Produktów</h2>
              <p className="text-gray-500 dark:text-gray-400">Zarządzaj certyfikowanymi partnerami VMI oraz zapisanymi ofertami i dostawcami z rynku B2B</p>
            </div>

            {/* Nice Search Component & Marketplace Link Above Tabs */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-[#0E1321] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-850">
              <div className="relative flex-1 w-full">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                  <Search className="h-4.5 w-4.5" />
                </span>
                <input
                  type="text"
                  placeholder={
                    vendorsSubtab === 'partner' ? "Przeszukaj swoich certyfikowanych dostawców..." :
                    vendorsSubtab === 'favourite_products' ? "Przeszukaj ulubione produkty w bazie..." :
                    "Przeszukaj ulubionych dostawców z rynku..."
                  }
                  value={dostawcySearch}
                  onChange={(e) => setDostawcySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-[#0C101A] border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white placeholder-gray-450 dark:placeholder-gray-500"
                />
                {dostawcySearch && (
                  <button 
                    onClick={() => setDostawcySearch('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-450 hover:text-gray-650 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  setMarketplaceInitialPath('/wyszukiwarka');
                  setCurrentTab('marketplace');
                }}
                className="w-full sm:w-auto shrink-0 py-2.5 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/25 dark:hover:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-blue-150 dark:border-blue-900/40 shadow-sm"
              >
                <Globe className="h-4 w-4" />
                <span>Przejdź do Wyszukiwarki B2B</span>
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-800/80 gap-1 pt-2">
              <button
                onClick={() => { setVendorsSubtab('partner'); setDostawcySearch(''); }}
                className={cn(
                  "px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer -mb-px flex items-center gap-1.5",
                  vendorsSubtab === 'partner'
                    ? "border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-white"
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Partnerzy VMI ({filteredPartnerVendors.length})</span>
              </button>
              
              <button
                onClick={() => { setVendorsSubtab('favourite_products'); setDostawcySearch(''); }}
                className={cn(
                  "px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer -mb-px flex items-center gap-1.5",
                  vendorsSubtab === 'favourite_products'
                    ? "border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-white"
                )}
              >
                <Heart className="h-3.5 w-3.5" />
                <span>Ulubione produkty ({filteredFavProducts.length})</span>
              </button>

              <button
                onClick={() => { setVendorsSubtab('favourite_vendors'); setDostawcySearch(''); }}
                className={cn(
                  "px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer -mb-px flex items-center gap-1.5",
                  vendorsSubtab === 'favourite_vendors'
                    ? "border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-white"
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Ulubieni dostawcy ({filteredFavVendors.length})</span>
              </button>
            </div>

            {/* Tab Contents */}
            {vendorsSubtab === 'partner' && (
              <div className="grid grid-cols-1 gap-6 animate-fade-in">
                {filteredPartnerVendors.map(v => {
                  const vendorProposalsCount = proposals.filter(p => p.vendorId === v.id && p.status === 'Oczekuje na zatwierdzenie').length;

                  return (
                    <div
                      key={v.id}
                      className="bg-white dark:bg-[#0E1321] rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-0 shadow-md dark:shadow-black/25 transition-all group"
                    >
                      {/* Left Column (Vendor standard card contents) */}
                      <div className="flex flex-col justify-between border-r border-gray-100 dark:border-gray-850">
                        {/* Branded card header with custom background, patterns, and mock logo */}
                        <div className={cn(
                          "h-20 relative px-5 py-3 flex items-center justify-between overflow-hidden",
                          v.id === 'v-1' ? "bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-550/20 dark:to-blue-900/10" :
                          v.id === 'v-2' ? "bg-gradient-to-r from-amber-500/10 to-orange-600/5 dark:from-amber-550/20 dark:to-orange-900/10" :
                          v.id === 'v-3' ? "bg-gradient-to-r from-emerald-500/10 to-teal-600/5 dark:from-emerald-550/20 dark:to-teal-900/10" :
                          "bg-gradient-to-r from-rose-500/10 to-red-600/5 dark:from-rose-550/20 dark:to-red-900/10"
                        )}>
                          {/* Decorative background layout watermark */}
                          <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.1] font-mono text-[8px] leading-none select-none tracking-tight p-2 truncate pointer-events-none uppercase">
                            {Array(15).fill("VMI CONNECT • CERTIFIED ").join(" ")}
                          </div>

                          <div className="z-10 flex items-center gap-3">
                            {/* Branded Logo badge with initials */}
                            <div className={cn(
                              "w-11 h-11 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-sm",
                              v.id === 'v-1' ? "bg-gradient-to-br from-blue-600 to-indigo-700" :
                              v.id === 'v-2' ? "bg-gradient-to-br from-amber-500 to-orange-600" :
                              v.id === 'v-3' ? "bg-gradient-to-br from-emerald-500 to-teal-600" :
                              "bg-gradient-to-br from-rose-600 to-red-700"
                            )}>
                              {v.id === 'v-1' ? 'AF' : v.id === 'v-2' ? 'EH' : v.id === 'v-3' ? 'PK' : 'SC'}
                            </div>
                            <div>
                              <h3 className="text-xs font-black text-gray-950 dark:text-white leading-tight">{v.name}</h3>
                              <span className="text-[8px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                {v.connectionStatus}
                              </span>
                            </div>
                          </div>

                          <span className="z-10 text-[8px] font-black text-gray-500 dark:text-gray-400 uppercase font-mono tracking-widest bg-white/80 dark:bg-black/40 px-2 py-1 rounded">
                            {v.industry}
                          </span>
                        </div>

                        {/* Content area */}
                        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                          <div className="space-y-3">
                            {(() => {
                              const contacts = VENDOR_CONTACTS[v.id] || [];
                              const onlineCount = contacts.filter(c => c.status === 'online').length;
                              const busyCount = contacts.filter(c => c.status === 'busy').length;
                              const totalAvailable = onlineCount + busyCount;
                              const isExpanded = expandedContactsVendorId === v.id;
                              const pendingOrdersCount = orders.filter(o => o.vendorId === v.id && o.status !== 'Dostarczone' && o.status !== 'Anulowane').length;
                              const vendorConv = conversations.find(c => c.vendorId === v.id);
                              const unreadMsgs = vendorConv?.unreadCount || 0;

                              return (
                                <>
                                  {/* Interactive contact selector */}
                                  <div 
                                    onClick={() => setExpandedContactsVendorId(isExpanded ? null : v.id)}
                                    className="p-3 bg-[#F8F9FA] dark:bg-[#121729] hover:bg-gray-100 dark:hover:bg-[#181F38] rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-sm"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "w-2.5 h-2.5 rounded-full relative shrink-0",
                                        onlineCount > 0 ? "bg-emerald-500" : busyCount > 0 ? "bg-amber-500" : "bg-gray-400"
                                      )}>
                                        {onlineCount > 0 && (
                                          <span className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75" />
                                        )}
                                      </span>
                                      <div className="text-left">
                                        <p className="text-[10px] font-black text-gray-800 dark:text-gray-200">
                                          {totalAvailable > 0 
                                            ? `Opiekunowie online: ${totalAvailable}` 
                                            : "Opiekunowie offline"}
                                        </p>
                                        <p className="text-[9px] text-gray-400">
                                          Kliknij, aby rozwinąć
                                        </p>
                                      </div>
                                    </div>

                                    <div className="text-right text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                      <span className="font-extrabold text-[9px] text-blue-600 dark:text-blue-400">
                                        {contacts.length} {contacts.length === 1 ? 'osoba' : 'osoby'}
                                      </span>
                                      {isExpanded ? (
                                        <ChevronUp className="h-3 w-3 text-gray-400" />
                                      ) : (
                                        <ChevronDown className="h-3 w-3 text-gray-400" />
                                      )}
                                    </div>
                                  </div>

                                  {/* Expanded staff list */}
                                  {isExpanded && (
                                    <div className="space-y-1.5 pt-1 text-left">
                                      {contacts.map((contact, idx) => (
                                        <div key={idx} className="p-2 bg-white dark:bg-[#0A0D18] rounded-lg flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                            <span className={cn(
                                              "w-1.5 h-1.5 rounded-full shrink-0",
                                              contact.status === 'online' ? "bg-emerald-500" :
                                              contact.status === 'busy' ? "bg-amber-500" : "bg-gray-400"
                                            )} />
                                            <div>
                                              <p className="font-bold text-gray-900 dark:text-gray-200 text-[10px]">{contact.name}</p>
                                              <p className="text-[8px] text-gray-400 font-mono">{contact.role}</p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <a href={`tel:${contact.phone}`} className="p-1 rounded bg-gray-50 hover:bg-gray-150 dark:bg-gray-800 text-gray-650 dark:text-gray-300">
                                              <Phone className="h-3 w-3" />
                                            </a>
                                            <a href={`mailto:${contact.email}`} className="p-1 rounded bg-gray-50 hover:bg-gray-150 dark:bg-gray-800 text-gray-650 dark:text-gray-300">
                                              <Mail className="h-3 w-3" />
                                            </a>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Status indicators board */}
                                  <div className="space-y-1.5">
                                    {vendorProposalsCount > 0 && (
                                      <div className="bg-blue-50 dark:bg-blue-950/20 px-2.5 py-1.5 rounded-lg text-blue-700 dark:text-blue-400 font-bold text-[10px] flex items-center gap-1.5 text-left">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping shrink-0" />
                                        <span>Czeka propozycja dostawy VMI ({vendorProposalsCount})</span>
                                      </div>
                                    )}

                                    {unreadMsgs > 0 && (
                                      <div className="bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5 rounded-lg text-amber-700 dark:text-amber-400 font-bold text-[10px] flex items-center gap-1.5 text-left">
                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shrink-0" />
                                        <span>Masz nieprzeczytaną odpowiedź ({unreadMsgs})</span>
                                      </div>
                                    )}

                                    {pendingOrdersCount > 0 && (
                                      <div className="bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1.5 text-left">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0 animate-pulse" />
                                        <span>Aktywne zamówienie w realizacji ({pendingOrdersCount})</span>
                                      </div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          <button
                            onClick={() => setActiveVendorId(v.id)}
                            className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-white font-bold rounded-lg text-center cursor-pointer transition-colors text-xs"
                          >
                            Otwórz panel partnera
                          </button>
                        </div>
                      </div>

                      {/* Right Column: Compact announcements animated slider gallery */}
                      <div className="relative bg-[#1A2536] dark:bg-[#090D16] text-white flex flex-col justify-between min-h-[300px] md:min-h-full overflow-hidden p-6">
                        {/* Decorative background vectors */}
                        <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-x-6 translate-y-6 pointer-events-none" />

                        {(() => {
                          const vendorNews = VENDOR_ANNOUNCEMENTS[v.id] || [];
                          const portfolio = VENDOR_PORTFOLIOS[v.id];

                          const slides = [
                            {
                              id: 'slide-about',
                              type: 'portfolio_about',
                              title: `O nas: ${v.name}`,
                              badge: 'PORTFOLIO MARKI',
                              badgeText: portfolio ? `Partner od ${portfolio.since}` : undefined,
                              content: portfolio?.about || 'Wiodący dostawca w systemie VMI.',
                              ctaText: 'Szczegóły'
                            },
                            {
                              id: 'slide-specs',
                              type: 'portfolio_specialties',
                              title: 'Nasze specjalizacje i certyfikaty',
                              badge: 'PORTFOLIO MARKI',
                              badgeText: 'STANDARDY JAKOŚCI',
                              content: `Specjalizacje: ${portfolio?.specialties.join(', ') || ''}. Standardy: ${portfolio?.certifications.join(', ') || ''}.`,
                              ctaText: 'Szczegóły'
                            },
                            ...vendorNews.map(item => ({
                              id: item.id,
                              type: item.type,
                              title: item.title,
                              badge: item.type === 'offer' ? 'OFERTA SPECIPALNA' : item.type === 'announcement' ? 'OGŁOSZENIE' : 'KOMUNIKAT',
                              badgeText: item.badgeText,
                              content: item.content,
                              ctaText: 'Szczegóły'
                            }))
                          ];

                          const currentSlideIndex = slides.length > 0 ? ((partnerActiveSlides[v.id] || 0) % slides.length) : 0;
                          const currentSlide = slides[currentSlideIndex];

                          return (
                            <div className="h-full flex flex-col justify-between relative z-10">
                              {/* Slide Header Info */}
                              <div className="flex justify-between items-center gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-white",
                                    currentSlide.type === 'offer' ? "bg-red-500" :
                                    currentSlide.type === 'announcement' ? "bg-orange-500" :
                                    currentSlide.type.startsWith('portfolio') ? "bg-blue-600" : "bg-emerald-600"
                                  )}>
                                    {currentSlide.badge}
                                  </span>
                                  {currentSlide.badgeText && (
                                    <span className="px-2 py-0.5 bg-white/10 text-gray-300 font-bold text-[8px] rounded uppercase font-mono tracking-wider">
                                      {currentSlide.badgeText}
                                    </span>
                                  )}
                                </div>

                                {/* Slide controls */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nextIdx = (currentSlideIndex - 1 + slides.length) % slides.length;
                                      setPartnerActiveSlides(prev => ({ ...prev, [v.id]: nextIdx }));
                                    }}
                                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer transition-colors"
                                    title="Poprzedni"
                                  >
                                    <ChevronLeft className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nextIdx = (currentSlideIndex + 1) % slides.length;
                                      setPartnerActiveSlides(prev => ({ ...prev, [v.id]: nextIdx }));
                                    }}
                                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer transition-colors"
                                    title="Następny"
                                  >
                                    <ChevronRight className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Slide body with smooth motion transitions */}
                              <div className="my-auto py-4 text-left overflow-hidden min-h-[96px] flex flex-col justify-center">
                                <AnimatePresence mode="wait" initial={false}>
                                  <motion.div
                                    key={currentSlide.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -12 }}
                                    transition={{ duration: 0.22, ease: "easeInOut" }}
                                  >
                                    <h4 className="text-xs sm:text-sm font-black text-white leading-snug line-clamp-2 mb-1.5">
                                      {currentSlide.title}
                                    </h4>
                                    <p className="text-[11px] text-slate-300/95 leading-relaxed line-clamp-3">
                                      {currentSlide.content}
                                    </p>
                                  </motion.div>
                                </AnimatePresence>
                              </div>

                              {/* Slide Footer / CTA */}
                              <div className="flex items-center justify-between gap-4 pt-2">
                                <button
                                  onClick={() => {
                                    setActiveVendorId(v.id);
                                    setVendorDashboardInitialNewsId(currentSlide.id);
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-550 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer shadow-md flex items-center gap-1"
                                >
                                  <span>{currentSlide.ctaText}</span>
                                  <ChevronRight className="h-3 w-3" />
                                </button>

                                {/* Pagination Dots */}
                                <div className="flex items-center gap-1">
                                  {slides.map((_, idx) => (
                                    <button
                                      key={idx}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPartnerActiveSlides(prev => ({ ...prev, [v.id]: idx }));
                                      }}
                                      className={cn(
                                        "w-1.5 h-1.5 rounded-full transition-all cursor-pointer",
                                        idx === currentSlideIndex ? "bg-blue-500 w-3" : "bg-white/20 hover:bg-white/40"
                                      )}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab 2: Saved Products */}
            {vendorsSubtab === 'favourite_products' && (
              <div className="space-y-4 animate-fade-in">
                {/* Search Component inside Tab 2 */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#121729] rounded-xl p-3 border border-gray-100 dark:border-gray-800 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-450">Partner handlowy:</span>
                    <select
                      value={vendorFilterId}
                      onChange={(e) => setVendorFilterId(e.target.value)}
                      className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-lg text-xs font-bold px-3 py-1.5 focus:outline-none cursor-pointer"
                    >
                      <option value="all">Wszyscy certyfikowani partnerzy ({savedProducts.length})</option>
                      {mockVendors.map(vendor => {
                        const countForThisVendor = savedProducts.filter(p => p.vendorId === vendor.id.replace('v-', 'mv-')).length;
                        return (
                          <option key={vendor.id} value={vendor.id}>
                            {vendor.name} ({countForThisVendor})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium">Lista produktów zapisana w schowku Wyszukiwarki B2B</p>
                </div>

                {filteredFavProducts.length === 0 ? (
                  <div className="p-12 text-center bg-white dark:bg-[#0E1321] rounded-2xl border border-gray-100 dark:border-gray-850 space-y-3.5">
                    <p className="text-gray-400 italic text-xs">Brak zapisanych produktów w schowku spełniających kryteria.</p>
                    <button 
                      onClick={() => { setMarketplaceInitialPath('/wyszukiwarka'); setCurrentTab('marketplace'); }}
                      className="py-2 px-4 rounded-lg bg-blue-600 text-white font-bold text-[10px] hover:bg-blue-500 shadow transition-all cursor-pointer"
                    >
                      Przeglądaj Wyszukiwarkę B2B
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredFavProducts.map(p => {
                      const vendor = publicMockVendors.find(v => v.id === p.vendorId);
                      return (
                        <div key={p.id} className="bg-white dark:bg-[#0E1321] rounded-xl p-4 flex gap-4 border border-gray-100 dark:border-gray-850 relative group shadow-sm hover:shadow-md transition-all">
                          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-950 rounded-lg overflow-hidden shrink-0">
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black tracking-wider text-blue-600 dark:text-blue-400 uppercase font-mono">
                                  {p.brand} • {vendor?.name || 'Inny'}
                                </span>
                                <button 
                                  onClick={() => handleRemoveProductFromSaved(p.id)}
                                  className="text-gray-350 hover:text-red-500 dark:hover:text-red-400 p-1 cursor-pointer"
                                  title="Usuń z zapisanych"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <h4 className="font-bold text-gray-950 dark:text-white text-xs truncate" title={p.name}>{p.name}</h4>
                              <p className="text-[10px] text-gray-400 font-mono">SKU: {p.sku} • Opak.: {p.packSize} {p.unit}</p>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                              <span className="font-bold text-gray-900 dark:text-white font-mono text-xs">
                                {(p.priceValue ?? 0).toFixed(2)} zł
                              </span>
                              <button 
                                onClick={() => {
                                  setMarketplaceInitialPath(`/produkty/${p.slug}`);
                                  setCurrentTab('marketplace');
                                }}
                                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                Szczegóły oferty →
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Saved Vendors */}
            {vendorsSubtab === 'favourite_vendors' && (
              <div className="space-y-4 animate-fade-in">
                {filteredFavVendors.length === 0 ? (
                  <div className="p-12 text-center bg-white dark:bg-[#0E1321] rounded-2xl border border-gray-100 dark:border-gray-850 space-y-3.5">
                    <p className="text-gray-400 italic text-xs">Brak dostawców zapisanych w Twoim schowku.</p>
                    <button 
                      onClick={() => { setMarketplaceInitialPath('/wyszukiwarka'); setCurrentTab('marketplace'); }}
                      className="py-2 px-4 rounded-lg bg-blue-600 text-white font-bold text-[10px] hover:bg-blue-500 shadow transition-all cursor-pointer"
                    >
                      Szukaj nowych dostawców
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {filteredFavVendors.map(v => (
                      <div key={v.id} className="bg-white dark:bg-[#0E1321] rounded-xl overflow-hidden border border-gray-100 dark:border-gray-850 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src={v.logoUrl} alt={v.name} className="w-8 h-8 rounded-lg object-cover" />
                                <div className="text-left">
                                  <h4 className="font-bold text-gray-900 dark:text-white text-xs">{v.name}</h4>
                                  <span className="text-[9px] text-gray-400 font-mono">{v.city}</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleRemoveVendorFromSaved(v.id)}
                                className="text-gray-350 hover:text-red-500 dark:hover:text-red-400 p-1 cursor-pointer"
                                title="Usuń z zapisanych"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-450 leading-relaxed line-clamp-2">{v.shortDescription}</p>
                          </div>
                          <span className="inline-block text-[9px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-black tracking-wide uppercase px-2 py-0.5 rounded self-start">
                            {v.category}
                          </span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-950/40 px-4 py-2.5 border-t border-gray-100 dark:border-gray-850/80 flex items-center justify-between text-[10px]">
                          <span className="text-gray-400 font-medium">Kompletność profilu: {v.profileCompleteness}%</span>
                          <button 
                            onClick={() => {
                              setMarketplaceInitialPath(`/dostawcy/${v.slug}`);
                              setCurrentTab('marketplace');
                            }}
                            className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            Otwórz profil na rynku →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'inventory':
        return (
          <InventoryView
            inventoryBalances={inventoryBalances}
            products={mockProducts}
            vendors={mockVendors}
            locations={mockLocations}
            activeLocationId={activeLocationId}
            onViewProductDetail={(id) => alert(`Specyfikacja produktu Ambra ID: ${id}. Aby zamówić, dodaj do koszyka w katalogu.`)}
            onOpenStockCountForProduct={(id) => setIsCountWorkflowOpen(true)}
            onAddToCart={handleAddToCart}
          />
        );

      case 'orders':
        return (
          <OrdersView
            orders={orders}
            products={mockProducts}
            vendors={mockVendors}
            locations={mockLocations}
            activeLocationId={activeLocationId}
            onOpenOrderChat={(id, vId, sub) => handleInitiateContextChat(vId, sub, 'order', id)}
          />
        );

      case 'offers':
        return (
          <OffersView
            quotations={quotations}
            onUpdateQuotations={saveQuotationsState}
            orders={orders}
            onUpdateOrders={saveOrdersState}
            products={mockProducts}
            vendors={mockVendors}
            locations={mockLocations}
            activeLocationId={activeLocationId}
            onOpenChat={(vId, sub, objType, objId) => handleInitiateContextChat(vId, sub, objType, objId)}
            triggerNotification={(title, content, type) => triggerLocalNotification(title, content, type)}
            onNavigateToMarketplace={(path) => {
              setMarketplaceInitialPath(path);
              setCurrentTab('marketplace');
            }}
          />
        );

      case 'messages':
        return (
          <div className="space-y-4">
            <div className="pb-2">
              <h2 className="text-base font-bold text-gray-950 dark:text-white font-display">Centrum Wiadomości VMI</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bezpośredni, bezpieczny kanał komunikacji z dedykowanymi opiekunami handlowymi Twoich dostawców</p>
            </div>
            <div className="bg-white dark:bg-[#0E1321] rounded-xl overflow-hidden h-[74vh]">
              <MessagesCenter
                conversations={conversations}
                vendors={mockVendors}
                orders={orders}
                products={mockProducts}
                quotations={quotations}
                proposals={proposals}
                onSendMessage={handleSendMessage}
                initialConversationId={messageCenterInitialId}
              />
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6 text-xs text-gray-600 dark:text-gray-300">
            <div className="pb-2">
              <h2 className="text-base font-bold text-gray-950 dark:text-white font-display">Ustawienia Systemowe i Piaskownica</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Konfiguracja profilu, symulacja warunków sieciowych oraz historia powiadomień</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
              <div className="lg:col-span-4 space-y-4">
                {/* Profile Panel */}
                <div className="bg-white dark:bg-[#0E1321] rounded-xl p-5 space-y-3.5 shadow-sm">
                  <h5 className="font-bold text-gray-950 dark:text-white uppercase tracking-wider text-[10px]">Twój Profil Klienta</h5>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600/10 text-blue-500 dark:text-blue-400 rounded-full">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-950 dark:text-white text-sm">{userProfile.name}</h4>
                      <p className="text-gray-500 dark:text-gray-400 text-[11px]">{userProfile.organization}</p>
                    </div>
                  </div>

                  <div className="pt-3 space-y-1.5 text-[11px]">
                    <p className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Rola w oddziale:</span> <span className="font-bold text-blue-600 dark:text-blue-400">Kierownik Oddziału VMI</span></p>
                    <p className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Uprawnienia:</span> <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Zatwierdzający B2B</span></p>
                    <p className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Klucz szyfrowania:</span> <span className="font-mono text-gray-500 dark:text-gray-600">AMBRA-7821-X</span></p>
                  </div>
                </div>

                {/* Appearance Settings Panel */}
                <div className="bg-white dark:bg-[#0E1321] rounded-xl p-5 space-y-3 shadow-sm text-xs">
                  <h5 className="font-bold text-gray-950 dark:text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    {theme === 'light' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-blue-400" />}
                    <span>Motyw graficzny (Wygląd)</span>
                  </h5>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-[11px]">
                    Dopasuj jasność interfejsu do warunków pracy w Twoim warsztacie lub biurze:
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setTheme('light')}
                      className={cn(
                        "flex-1 py-2 rounded-lg font-bold text-center flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                        theme === 'light' 
                          ? "bg-[#2A3B4C] text-white shadow-sm" 
                          : "bg-gray-100 dark:bg-gray-850 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
                      )}
                    >
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      <span>Jasny motyw</span>
                    </button>
                    
                    <button
                      onClick={() => setTheme('dark')}
                      className={cn(
                        "flex-1 py-2 rounded-lg font-bold text-center flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                        theme === 'dark' 
                          ? "bg-blue-600 text-white shadow-sm" 
                          : "bg-gray-100 dark:bg-gray-850 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
                      )}
                    >
                      <Moon className="h-3.5 w-3.5 text-blue-400" />
                      <span>Ciemny motyw</span>
                    </button>
                  </div>
                </div>

                {/* Logout trigger */}
                <button
                  onClick={handleLogout}
                  className="w-full py-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded-xl font-bold text-center flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Wyloguj się z sesji VMI</span>
                </button>
              </div>

              <div className="lg:col-span-8 space-y-4">
                {/* Developer Network settings (Offline count simulator) */}
                <div className="bg-white dark:bg-[#0E1321] rounded-xl p-5 space-y-3 shadow-sm">
                  <h5 className="font-bold text-gray-950 dark:text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-[#2A3B4C] dark:text-blue-400" />
                    <span>Tryb deweloperski (VMI Sandbox)</span>
                  </h5>
                  
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-[11px]">
                    Zasymuluj brak sieci komórkowej, aby przetestować lokalny bufor inwentaryzacji offline i automatyczną ponowną synchronizację:
                  </p>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setIsOnline(true)}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg font-bold text-center flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                        isOnline 
                          ? "bg-emerald-600 text-white shadow-sm" 
                          : "bg-gray-100 dark:bg-gray-850 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      <Wifi className="h-3.5 w-3.5" />
                      <span>Sieć aktywna (Online)</span>
                    </button>
                    
                    <button
                      onClick={() => setIsOnline(false)}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg font-bold text-center flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                        !isOnline 
                          ? "bg-amber-600 text-white shadow-sm" 
                          : "bg-gray-100 dark:bg-gray-850 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      <WifiOff className="h-3.5 w-3.5" />
                      <span>Brak sieci (Offline)</span>
                    </button>
                  </div>

                  {offlineDraftsCount > 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/15 rounded-xl space-y-2 text-amber-700 dark:text-amber-300">
                      <p className="font-semibold text-[10px]">Masz {offlineDraftsCount} spisów oczekujących na wysyłkę!</p>
                      <button
                        onClick={handleSyncOfflineDrafts}
                        disabled={!isOnline}
                        className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 font-bold text-gray-950 rounded text-[10px] cursor-pointer"
                      >
                        Synchronizuj teraz
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleClearDemoCache}
                    className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] rounded-lg hover:text-gray-800 dark:hover:text-white transition-all cursor-pointer font-bold text-center"
                  >
                    Resetuj całe demo (Wyczyść Cache i przeładuj)
                  </button>
                </div>

                {/* Notifications list trigger */}
                <div className="bg-white dark:bg-[#0E1321] rounded-xl p-5 space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-gray-950 dark:text-white uppercase tracking-wider text-[10px]">Archiwum Powiadomień Systemowych ({unreadNotificationsCount})</h5>
                    {unreadNotificationsCount > 0 && (
                      <button 
                        onClick={handleMarkNotificationsRead}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-bold"
                      >
                        Oznacz wszystkie jako przeczytane
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 divide-y divide-gray-100 dark:divide-gray-850/60 max-h-56 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-gray-400 italic text-center py-4">Brak nowych powiadomień w historii.</p>
                    ) : (
                      notifications.map(notif => (
                        <div key={notif.id} className="pt-2.5 first:pt-0 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <p className={cn("font-bold text-xs", !notif.isRead ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300")}>
                              {notif.title}
                            </p>
                            <span className="text-[9px] font-mono text-gray-400">{notif.date}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-normal">{notif.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'marketplace':
        return (
          <MarketplaceContainer
            onLoginClick={() => {}}
            isLoggedIn={true}
            onGoToPortal={() => {
              setCurrentTab('home');
              setMarketplaceInitialPath(null);
            }}
            theme={theme}
            setTheme={setTheme}
            initialPath={marketplaceInitialPath || undefined}
          />
        );

      default:
        return null;
    }
  };

  // State bypass router for Order detail screens from the aggregated dashboard
  const [selectedOrderViewId, setSelectedOrderViewId] = useState<string | null>(null);

  // Switch vendor details back
  const handleVendorDashboardBack = () => {
    setActiveVendorId(null);
    setVendorDashboardInitialNewsId(undefined);
  };

  // Guard against Next.js hydration mismatches by returning a consistent loading screen on the server & first client render
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0D16] flex items-center justify-center transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium font-sans">Ładowanie...</p>
        </div>
      </div>
    );
  }

  // If not logged in, render the Public Marketplace or LoginScreen
  if (!isLoggedIn) {
    if (showLogin) {
      return (
        <LoginScreen
          preFilledUser={currentUser}
          onLoginSuccess={(profile) => {
            handleLogin(profile);
            setShowLogin(false);
          }}
          onBackToMarketplace={() => setShowLogin(false)}
        />
      );
    }
    return (
      <MarketplaceContainer
        onLoginClick={() => setShowLogin(true)}
        isLoggedIn={false}
        onGoToPortal={() => setShowLogin(true)}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  // Active elements
  const activeVendor = mockVendors.find(v => v.id === activeVendorId);
  const activeProposal = proposals.find(p => p.id === activeProposalId);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0D16] text-[#1A1C1E] dark:text-white font-sans flex flex-col md:flex-row relative transition-colors duration-200">
      
      {/* MOBILE TOP HEADER BAR */}
      <header className="md:hidden bg-white dark:bg-[#0E1321] px-4 py-3 flex items-center justify-between sticky top-0 z-40 transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2A3B4C] dark:bg-blue-600 flex items-center justify-center font-extrabold text-white text-sm shadow-md">
            A
          </div>
          <div>
            <h1 className="font-extrabold font-display text-xs tracking-wide text-[#2A3B4C] dark:text-white leading-tight uppercase">Ambra VMI</h1>
            <p className="text-[8px] text-gray-400 dark:text-gray-500 uppercase font-bold">Portal Klienta</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Active location summary badge */}
          <span className="text-[9px] font-bold bg-[#F0F2F5] dark:bg-[#131A2E] text-[#2A3B4C] dark:text-white py-1 px-2 rounded-lg transition-colors">
            {mockLocations.find(l => l.id === activeLocationId)?.name || 'Oddział'}
          </span>
          
          {/* Mobile Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            title={theme === 'light' ? "Przełącz na tryb ciemny" : "Przełącz na tryb jasny"}
          >
            {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5 text-amber-400" />}
          </button>
        </div>
      </header>

      {/* OFFLINE STATUS HEADER BAR */}
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-amber-500 text-gray-950 px-4 py-1.5 text-center text-xs font-black flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="h-4 w-4 shrink-0 animate-bounce" />
          <span>TRYB OFFLINE (VMI OFFLINE BUFFER): Twoje inwentaryzacje są buforowane lokalnie i zostaną zsynchronizowane po włączeniu sieci.</span>
        </div>
      )}

      {/* 1. DESKTOP NAVIGATION SIDEBAR - Breakpoint 768px */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#0E1321] shrink-0 select-none transition-colors">
        {/* App Title */}
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2A3B4C] dark:bg-blue-600 flex items-center justify-center font-extrabold text-white text-sm shadow-md">
              A
            </div>
            <div>
              <h1 className="font-extrabold font-display text-sm tracking-wide text-[#2A3B4C] dark:text-white leading-tight">Ambra VMI</h1>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold">Portal Klienta</p>
            </div>
          </div>
        </div>

        {/* Location display */}
        <div className="p-4 mx-3 my-4 bg-[#F0F2F5] dark:bg-[#131A2E] rounded-xl flex items-center gap-2.5 transition-colors">
          <div className="p-1.5 rounded-lg bg-[#2A3B4C]/10 dark:bg-white/10 text-[#2A3B4C] dark:text-blue-400">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase font-bold">Monitorowany oddział</p>
            <p className="font-bold text-xs text-[#2A3B4C] dark:text-white truncate">
              {mockLocations.find(l => l.id === activeLocationId)?.name || 'Brak'}
            </p>
          </div>
        </div>

        {/* Tab buttons */}
        <nav className="flex-1 px-3 space-y-1">
          {[
            { id: 'home', name: 'Pulpit główny', icon: Home },
            { id: 'vendors', name: 'Dostawcy', icon: Layers },
            { id: 'inventory', name: 'Zapas magazynowy', icon: Package },
            { id: 'orders', name: 'Zamówienia', icon: ShoppingBag },
            { id: 'offers', name: 'Oferty i zapytania', icon: FileText },
            { id: 'messages', name: 'Wiadomości', icon: MessageSquare },
            { id: 'settings', name: 'Ustawienia i Sandbox', icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            
            // Unread counts indicators
            let count = 0;
            if (tab.id === 'messages') count = unreadMessagesCount;
            if (tab.id === 'settings') count = unreadNotificationsCount;
            if (tab.id === 'orders') count = pendingOrdersCount;

            return (
              <button
                key={tab.id}
                onClick={() => { 
                  setCurrentTab(tab.id as any); 
                  setActiveVendorId(null); 
                  setActiveProposalId(null); 
                  setSelectedOrderViewId(null); 
                }}
                className={cn(
                  "w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer",
                  isActive 
                    ? "bg-[#F0F2F5] dark:bg-[#131A2E] text-[#2A3B4C] dark:text-white" 
                    : "text-gray-500 hover:text-[#2A3B4C] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("h-4 w-4", isActive ? "text-[#2A3B4C] dark:text-blue-400" : "text-gray-400")} />
                  <span>{tab.name}</span>
                </div>
                {count > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center font-mono",
                    tab.id === 'settings' ? "bg-red-500" : "bg-[#2A3B4C] dark:bg-blue-600"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Primary Action Button */}
        <div className="p-4">
          <button
            onClick={() => setIsCountWorkflowOpen(true)}
            className="w-full py-3 bg-[#2A3B4C] dark:bg-blue-600 hover:bg-[#1E2B38] dark:hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <span>Inwentaryzacja VMI</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F8F9FA] dark:bg-[#0A0D16] h-screen overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 transition-colors duration-200">
        
        {/* Dynamic subscreen rendering logic (Master overlays) */}
        {activeProposalId && activeProposal ? (
          
          /* Proposal details overlay override */
          <ProposalDetail
            proposal={activeProposal}
            vendor={mockVendors.find(v => v.id === activeProposal.vendorId)!}
            products={mockProducts}
            onBack={() => setActiveProposalId(null)}
            onSubmitApproval={handleProposalApprovalSubmit}
            onAskQuestion={(pId, subject) => handleInitiateContextChat(activeProposal.vendorId, subject, 'product', pId)}
          />

        ) : activeVendorId && activeVendor ? (

          /* Vendor area branded dashboard overlay */
          <VendorDashboardView
            vendor={activeVendor}
            products={mockProducts}
            orders={orders}
            quotations={quotations}
            flyers={mockDigitalFlyers}
            showrooms={mockShowrooms}
            proposals={proposals}
            locations={mockLocations}
            activeLocationId={activeLocationId}
            cart={carts[activeVendor.id] || []}
            onBack={handleVendorDashboardBack}
            onAddToCart={(productId, qty) => handleAddToCart(productId, qty)}
            onRemoveFromCart={(productId) => handleRemoveFromCart(activeVendor.id, productId)}
            onUpdateCartQty={(productId, qty) => handleUpdateCartQty(activeVendor.id, productId, qty)}
            onCheckout={(locId, date, ref, com) => handleCheckout(activeVendor.id, locId, date, ref, com)}
            onOpenFlyer={setActiveFlyer}
            onAskVendorQuestion={(pId, sub) => handleInitiateContextChat(activeVendor.id, sub, 'product', pId)}
            initialNewsId={vendorDashboardInitialNewsId}
          />

        ) : (

          /* Standard tab list render */
          <div className={cn("space-y-4", !isOnline ? "pt-8" : "")}>
            {renderTabContent()}
          </div>

        )}

      </main>

      {/* 2. MOBILE NAVIGATION BOTTOM BAR - Breakpoint 768px */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0E1321]/95 backdrop-blur-md flex items-center justify-around py-2 shrink-0 select-none transition-colors">
        {[
          { id: 'home', name: 'Pulpit', icon: Home },
          { id: 'vendors', name: 'Dostawcy', icon: Layers },
          { id: 'inventory', name: 'Zapas', icon: Package },
          { id: 'orders', name: 'Zamówienia', icon: ShoppingBag },
          { id: 'offers', name: 'Oferty', icon: FileText },
          { id: 'messages', name: 'Czat', icon: MessageSquare },
          { id: 'settings', name: 'Opcje', icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          // messaging & notification badge
          let count = 0;
          if (tab.id === 'messages') count = unreadMessagesCount;
          if (tab.id === 'settings') count = unreadNotificationsCount;
          if (tab.id === 'orders') count = pendingOrdersCount;

          return (
            <button
              key={tab.id}
              onClick={() => { 
                setCurrentTab(tab.id as any); 
                setActiveVendorId(null); 
                setActiveProposalId(null); 
                setSelectedOrderViewId(null); 
              }}
              className="flex flex-col items-center gap-1 cursor-pointer animate-fade-in"
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5 transition-colors", isActive ? "text-[#2A3B4C] dark:text-blue-400" : "text-gray-400")} />
                {count > 0 && (
                  <span className={cn(
                    "absolute -top-1.5 -right-2 px-1 text-[8px] font-black text-white rounded-full flex items-center justify-center min-w-[14px]",
                    tab.id === 'settings' ? "bg-red-500" : "bg-[#2A3B4C] dark:bg-blue-600"
                  )}>
                    {count}
                  </span>
                )}
              </div>
              <span className={cn("text-[9px] font-bold tracking-tight transition-colors", isActive ? "text-[#2A3B4C] dark:text-blue-400" : "text-gray-400")}>
                {tab.name}
              </span>
            </button>
          );
        })}
        
        {/* Mobile floating fast inwentaryzacja helper trigger */}
        <button
          onClick={() => setIsCountWorkflowOpen(true)}
          className="w-10 h-10 rounded-full bg-[#2A3B4C] dark:bg-blue-600 text-white flex items-center justify-center -translate-y-4 shadow-lg cursor-pointer active:scale-95 transition-all"
          title="Inwentaryzacja VMI"
        >
          <Plus className="h-5 w-5" />
        </button>
      </nav>

      {/* OVERLAY 1: THE COMPLEX INVENTORY STOCK COUNTING WORKFLOW */}
      {isCountWorkflowOpen && (
        <StockCountWorkflow
          vendors={mockVendors}
          locations={mockLocations}
          products={mockProducts}
          inventoryBalances={inventoryBalances}
          isOnline={isOnline}
          onClose={() => setIsCountWorkflowOpen(false)}
          onCompleteCount={(locId, counts) => {
            const countedLines: { [id: string]: number } = {};
            counts.forEach(c => {
              countedLines[c.productId] = c.qty;
            });
            handleStockCountSubmit(countedLines);
          }}
        />
      )}

      {/* OVERLAY 2: THE INTERACTIVE DIGITAL FLYER PROMOTIONAL LEAFLET */}
      {activeFlyer && (
        <DigitalFlyerViewer
          flyer={activeFlyer}
          products={mockProducts}
          vendorName={mockVendors.find(v => v.id === activeFlyer.vendorId)?.name || 'Dostawca'}
          onAddToCart={handleAddToCart}
          onViewProduct={(id) => alert(`Widok szczegółowy produktu ID: ${id}`)}
          onAskVendor={(id, subject) => handleInitiateContextChat(activeFlyer.vendorId, subject, 'product', id)}
          onClose={() => setActiveFlyer(null)}
        />
      )}

    </div>
  );
}
