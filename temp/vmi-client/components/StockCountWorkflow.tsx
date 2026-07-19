'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Barcode, 
  Camera, 
  CheckCircle, 
  CheckCircle2, 
  FileText, 
  HelpCircle, 
  Info, 
  Minus, 
  Plus, 
  RefreshCw, 
  Save, 
  Search, 
  Trash2, 
  Wifi, 
  WifiOff 
} from 'lucide-react';
import { Product, InventoryBalance, ClientLocation, Vendor, StockCountSession, StockCountItemSession } from '../lib/types';
import { cn } from '../lib/utils';

interface StockCountWorkflowProps {
  vendors: Vendor[];
  locations: ClientLocation[];
  products: Product[];
  inventoryBalances: InventoryBalance[];
  isOnline: boolean;
  onClose: () => void;
  onCompleteCount: (locationId: string, counts: { productId: string; qty: number; note?: string }[]) => void;
}

export default function StockCountWorkflow({
  vendors,
  locations,
  products,
  inventoryBalances,
  isOnline,
  onClose,
  onCompleteCount
}: StockCountWorkflowProps) {
  // Wizard steps: 1 - Select Vendor, 2 - Select Location, 3 - Select Mode, 4 - Live Count Screen
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('loc-1');
  const [countingMode, setCountingMode] = useState<'requested' | 'low_stock' | 'full_assortment'>('low_stock');
  
  // Active counting state
  const [countingProducts, setCountingProducts] = useState<Product[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [sessionItems, setSessionItems] = useState<StockCountItemSession[]>([]);
  const [photoAdded, setPhotoAdded] = useState<{ [productId: string]: boolean }>({});
  
  // Scanner simulation state
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  // Auto-load drafts from localStorage on start
  useEffect(() => {
    if (selectedVendorId && selectedLocationId && step === 3) {
      const draftKey = `vmi_draft_${selectedVendorId}_${selectedLocationId}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          // Auto-resume if they select the same mode, or just offer later
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [selectedVendorId, selectedLocationId, step]);

  // Set up products to count based on selected options
  const startCounting = () => {
    // Filter vendor products
    const vendorProducts = products.filter(p => p.vendorId === selectedVendorId);
    let selectedList: Product[] = [];

    if (countingMode === 'requested') {
      // simulate counting items requested (p-1, p-2, p-3 for AutoParts or p-21, p-22, p-27 for CleanChem)
      if (selectedVendorId === 'v-1') {
        selectedList = vendorProducts.filter(p => ['p-1', 'p-2', 'p-3'].includes(p.id));
      } else if (selectedVendorId === 'v-3') {
        selectedList = vendorProducts.filter(p => ['p-21', 'p-22', 'p-27'].includes(p.id));
      } else {
        selectedList = vendorProducts.slice(0, 3);
      }
    } else if (countingMode === 'low_stock') {
      // Find low stock products of this vendor in selected location
      const lowStockIds = inventoryBalances
        .filter(b => b.locationId === selectedLocationId && ['Below minimum', 'Out of stock', 'Approaching minimum', 'Needs verification', 'Count outdated'].includes(b.stockStatus))
        .map(b => b.productId);
      
      selectedList = vendorProducts.filter(p => lowStockIds.includes(p.id));
      
      // Fallback if none are low stock
      if (selectedList.length === 0) {
        selectedList = vendorProducts.slice(0, 4);
      }
    } else {
      // Full assortment
      selectedList = vendorProducts;
    }

    setCountingProducts(selectedList);
    setCurrentIndex(0);

    // Initialize session items from localStorage if available, else fresh
    const draftKey = `vmi_draft_${selectedVendorId}_${selectedLocationId}`;
    const savedDraft = localStorage.getItem(draftKey);
    let loadedItems: StockCountItemSession[] = [];
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft) as StockCountSession;
        if (parsed.mode === countingMode) {
          loadedItems = parsed.items;
        }
      } catch (e) {
        console.error("Błąd ładowania szkicu", e);
      }
    }

    const initialItems = selectedList.map(prod => {
      const existing = loadedItems.find(item => item.productId === prod.id);
      if (existing) return existing;

      const balance = inventoryBalances.find(b => b.productId === prod.id && b.locationId === selectedLocationId);
      return {
        productId: prod.id,
        countedQty: null, // not yet counted
        status: 'not_counted' as const,
        note: ''
      };
    });

    setSessionItems(initialItems);
    setStep(4);
  };

  // Save current progress to localStorage
  const saveDraftLocally = () => {
    const draftSession: StockCountSession = {
      id: `session_${selectedVendorId}_${selectedLocationId}`,
      vendorId: selectedVendorId,
      locationId: selectedLocationId,
      mode: countingMode,
      items: sessionItems,
      lastSaved: new Date().toISOString(),
      isSynced: false
    };
    
    localStorage.setItem(
      `vmi_draft_${selectedVendorId}_${selectedLocationId}`, 
      JSON.stringify(draftSession)
    );
    
    // Alert via scan message temporarily or simple custom state
    setScanMessage('Szkic inwentaryzacji zapisany lokalnie!');
    setTimeout(() => setScanMessage(''), 3000);
  };

  // Simulate scanning a barcode
  const simulateBarcodeScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanMessage('Skanowanie kodu kreskowego...');

    setTimeout(() => {
      setIsScanning(false);
      const activeProduct = countingProducts[currentIndex];
      if (activeProduct) {
        // Find current state
        const updated = [...sessionItems];
        const itemIndex = updated.findIndex(i => i.productId === activeProduct.id);
        if (itemIndex !== -1) {
          const currentQty = updated[itemIndex].countedQty || 0;
          updated[itemIndex] = {
            ...updated[itemIndex],
            countedQty: currentQty + activeProduct.packSize, // add one pack size
            status: 'counted'
          };
          setSessionItems(updated);
          setScanMessage(`Zeskanowano kod produktu: ${activeProduct.vendorSku}! Dodano opakowanie zbiorcze (+${activeProduct.packSize} szt.)`);
        }
      }
      setTimeout(() => setScanMessage(''), 4000);
    }, 1200);
  };

  // Handle value change for active item
  const updateCountedQty = (val: number | null) => {
    const updated = [...sessionItems];
    const itemIndex = updated.findIndex(i => i.productId === countingProducts[currentIndex].id);
    if (itemIndex !== -1) {
      const current = updated[itemIndex];
      let newStatus = current.status;
      
      if (val === null) {
        newStatus = 'not_counted';
      } else if (val === 0) {
        newStatus = 'zero_stock';
      } else {
        newStatus = 'counted';
      }

      updated[itemIndex] = {
        ...current,
        countedQty: val !== null ? Math.max(0, val) : null,
        status: newStatus
      };
      setSessionItems(updated);
    }
  };

  // Increment/decrement functions
  const increment = (amount: number) => {
    const currentItem = sessionItems.find(i => i.productId === countingProducts[currentIndex].id);
    const prevVal = currentItem?.countedQty || 0;
    updateCountedQty(prevVal + amount);
  };

  const decrement = (amount: number) => {
    const currentItem = sessionItems.find(i => i.productId === countingProducts[currentIndex].id);
    const prevVal = currentItem?.countedQty || 0;
    if (prevVal - amount >= 0) {
      updateCountedQty(prevVal - amount);
    } else {
      updateCountedQty(0);
    }
  };

  // Set as zero stock
  const handleSetZero = () => {
    const updated = [...sessionItems];
    const itemIndex = updated.findIndex(i => i.productId === countingProducts[currentIndex].id);
    if (itemIndex !== -1) {
      updated[itemIndex] = {
        ...updated[itemIndex],
        countedQty: 0,
        status: 'zero_stock'
      };
      setSessionItems(updated);
    }
  };

  // Mark unable to count
  const handleUnableToCount = () => {
    const updated = [...sessionItems];
    const itemIndex = updated.findIndex(i => i.productId === countingProducts[currentIndex].id);
    if (itemIndex !== -1) {
      updated[itemIndex] = {
        ...updated[itemIndex],
        countedQty: null,
        status: 'unable_to_count'
      };
      setSessionItems(updated);
    }
  };

  // Mark for recount
  const handleMarkRecount = () => {
    const updated = [...sessionItems];
    const itemIndex = updated.findIndex(i => i.productId === countingProducts[currentIndex].id);
    if (itemIndex !== -1) {
      updated[itemIndex] = {
        ...updated[itemIndex],
        status: 'recount'
      };
      setSessionItems(updated);
    }
  };

  // Update note for active item
  const updateNote = (noteText: string) => {
    const updated = [...sessionItems];
    const itemIndex = updated.findIndex(i => i.productId === countingProducts[currentIndex].id);
    if (itemIndex !== -1) {
      updated[itemIndex] = {
        ...updated[itemIndex],
        note: noteText,
        // If they add a note to a counted item, preserve status, but if not counted mark as note added
        status: updated[itemIndex].status === 'not_counted' && noteText ? 'note_added' : updated[itemIndex].status
      };
      setSessionItems(updated);
    }
  };

  // Toggle fake photo attachment
  const togglePhoto = (prodId: string) => {
    setPhotoAdded(prev => ({
      ...prev,
      [prodId]: !prev[prodId]
    }));
  };

  // Finalize and submit
  const handleSubmitSession = () => {
    // Extract only counted or finalized quantities
    const submittedData = sessionItems
      .filter(item => item.status !== 'not_counted' && item.countedQty !== null)
      .map(item => ({
        productId: item.productId,
        qty: item.countedQty as number,
        note: item.note
      }));

    // Clear local draft upon successful submit
    localStorage.removeItem(`vmi_draft_${selectedVendorId}_${selectedLocationId}`);
    
    // Callback
    onCompleteCount(selectedLocationId, submittedData);
  };

  // Info helpers
  const selectedVendor = vendors.find(v => v.id === selectedVendorId);
  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const activeProduct = countingProducts[currentIndex];
  const activeSessionItem = sessionItems.find(i => i.productId === activeProduct?.id);

  // Stats for the position progress tracker
  const totalItems = countingProducts.length;
  const countedCount = sessionItems.filter(i => i.status !== 'not_counted').length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-[#0A0D16] text-[#1A1C1E] dark:text-white md:bg-[#1E2B38]/60 md:dark:bg-black/70 md:backdrop-blur-sm md:p-6 items-center justify-center">
      <div className="w-full h-full md:max-w-5xl md:h-[90vh] md:rounded-2xl md:border md:border-[#E1E3E6] md:dark:border-gray-800 bg-white dark:bg-[#0E1321] flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* Header with active states */}
        <div className="px-4 py-3 bg-white dark:bg-[#131A2E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (step > 1 && step < 4) setStep((step - 1) as any);
                else if (step === 4) {
                  saveDraftLocally();
                  setStep(3);
                } else onClose();
              }}
              className="p-1.5 rounded-lg bg-[#F0F2F5] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-[#2A3B4C] dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h3 className="font-semibold font-display text-sm tracking-wide text-[#2A3B4C] dark:text-white">Szybki Stan & Inwentaryzacja VMI</h3>
              {step === 4 && selectedVendor && (
                <p className="text-xs text-gray-550 dark:text-gray-400">
                  {selectedVendor.name} • {selectedLocation?.name}
                </p>
              )}
            </div>
          </div>

          {/* Sync status indicator */}
          <div className="flex items-center gap-3">
            {step === 4 && (
              <button 
                onClick={saveDraftLocally}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer"
                title="Zapisz szkic lokalnie"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Zapisz szkic</span>
              </button>
            )}

            {isOnline ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                <Wifi className="h-3 w-3 animate-pulse" />
                <span>ONLINE</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450 animate-pulse">
                <WifiOff className="h-3 w-3" />
                <span>OFFLINE (SZKIC)</span>
              </span>
            )}

            <button 
              onClick={() => {
                if (step === 4) {
                  onClose();
                } else if (step < 4) {
                  onClose();
                }
              }}
              className="text-gray-600 dark:text-gray-400 hover:text-[#2A3B4C] dark:hover:text-white text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
            >
              Zamknij
            </button>
          </div>
        </div>

        {/* Wizard Main Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white dark:bg-[#0E1321]">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: SELECT VENDOR */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-xl mx-auto space-y-6 py-4"
              >
                <div className="text-center space-y-2">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">Krok 1 z 3</span>
                  <h4 className="text-xl font-bold font-display text-gray-950 dark:text-white">Wybierz dostawcę asortymentu</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Skanowanie i aktualizacja stanów magazynowych dotyczy zawsze konkretnego partnera handlowego.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {vendors.map(vendor => {
                    const colorMap: { [key: string]: string } = {
                      blue: 'bg-white dark:bg-[#0E1321]/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 shadow-sm',
                      orange: 'bg-white dark:bg-[#0E1321]/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 shadow-sm',
                      green: 'bg-white dark:bg-[#0E1321]/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 shadow-sm',
                      red: 'bg-white dark:bg-[#0E1321]/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 shadow-sm'
                    };

                    return (
                      <button
                        key={vendor.id}
                        onClick={() => {
                          setSelectedVendorId(vendor.id);
                          setStep(2);
                        }}
                        className={cn(
                          "w-full text-left p-4 rounded-xl transition-all hover:scale-[1.01] flex items-center justify-between cursor-pointer",
                          colorMap[vendor.accentColor] || "bg-white dark:bg-[#0E1321]/50"
                        )}
                      >
                        <div>
                          <h5 className="font-bold text-[#1A1C1E] dark:text-white text-base">{vendor.name}</h5>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{vendor.industry}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <ArrowRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
                {/* STEP 2: SELECT LOCATION */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-xl mx-auto space-y-6 py-4"
              >
                <div className="text-center space-y-2">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">Krok 2 z 3</span>
                  <h4 className="text-xl font-bold font-display text-gray-950 dark:text-white">Wybierz lokalizację warsztatu</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Wskaż oddział, w którym fizycznie liczysz produkty.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {locations.map(loc => {
                    const isSelected = selectedLocationId === loc.id;
                    return (
                      <button
                        key={loc.id}
                        onClick={() => {
                          setSelectedLocationId(loc.id);
                          setStep(3);
                        }}
                        className={cn(
                          "w-full text-left p-4 rounded-xl transition-all flex items-start justify-between cursor-pointer",
                          isSelected 
                            ? "bg-blue-50/50 dark:bg-blue-950/20" 
                            : "bg-white dark:bg-[#0E1321]/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 shadow-sm"
                        )}
                      >
                        <div>
                          <h5 className={cn("font-bold text-sm", isSelected ? "text-blue-600 dark:text-blue-400" : "text-[#1A1C1E] dark:text-white")}>
                            {loc.name}
                          </h5>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{loc.address}</p>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                          isSelected ? "bg-blue-500 text-white" : ""
                        )}>
                          {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                  >
                    Wstecz
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: SELECT COUNTING MODE */}
            {step === 3 && selectedVendor && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-xl mx-auto space-y-6 py-4"
              >
                <div className="text-center space-y-2">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">Krok 3 z 3</span>
                  <h4 className="text-xl font-bold font-display text-gray-950 dark:text-white">Wybierz tryb inwentaryzacji</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Dla dostawcy <strong className="text-blue-600 dark:text-blue-400 font-bold">{selectedVendor.name}</strong> w lokalizacji <strong className="text-blue-600 dark:text-blue-400 font-bold">{selectedLocation?.name}</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {/* Mode 1: Requested count */}
                  <button
                    onClick={() => setCountingMode('requested')}
                    className={cn(
                      "w-full text-left p-4 rounded-xl transition-all flex items-start gap-4 cursor-pointer",
                      countingMode === 'requested' ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-[#0E1321]/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 shadow-sm"
                    )}
                  >
                    <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 shrink-0">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-gray-900 dark:text-white">Zlecone produkty (Inwentaryzacja VMI)</h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Skanuj tylko pozycje wskazane przez dostawcę w oficjalnym wezwaniu do spisu (zalecane do szybkiej korekty zamówień VMI).
                      </p>
                    </div>
                  </button>

                  {/* Mode 2: Low-stock counts */}
                  <button
                    onClick={() => setCountingMode('low_stock')}
                    className={cn(
                      "w-full text-left p-4 rounded-xl transition-all flex items-start gap-4 cursor-pointer",
                      countingMode === 'low_stock' ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-[#0E1321]/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 shadow-sm"
                    )}
                  >
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 shrink-0">
                      <Info className="h-6 w-6" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-gray-900 dark:text-white">Produkty o niskim stanie / Alarmy</h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Skup się na pozycjach poniżej minimum, wyprzedanych lub wymagających pilnej weryfikacji w wybranym oddziale.
                      </p>
                    </div>
                  </button>

                  {/* Mode 3: Full assortment */}
                  <button
                    onClick={() => setCountingMode('full_assortment')}
                    className={cn(
                      "w-full text-left p-4 rounded-xl transition-all flex items-start gap-4 cursor-pointer",
                      countingMode === 'full_assortment' ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-[#0E1321]/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 shadow-sm"
                    )}
                  >
                    <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 shrink-0">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-gray-900 dark:text-white">Pełny przypisany katalog dostawcy</h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Pełna, gruntowna inwentaryzacja wszystkich produktów tego dostawcy powiązanych z Twoim warsztatem.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Check for existing draft */}
                {localStorage.getItem(`vmi_draft_${selectedVendorId}_${selectedLocationId}`) && (
                  <div className="bg-amber-50 dark:bg-amber-950/15 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-400 flex items-center justify-between">
                    <span>Zintegrowany moduł offline wykrył zapisany lokalnie szkic dla tego dostawcy!</span>
                    <span className="font-semibold text-amber-700 dark:text-amber-400 underline decoration-dotted">Zostanie automatycznie wczytany</span>
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setStep(2)}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                  >
                    Wstecz
                  </button>
                  <button
                    onClick={startCounting}
                    className="px-6 py-2 bg-[#2A3B4C] dark:bg-blue-600 hover:bg-[#1E2B38] dark:hover:bg-blue-500 text-white font-medium rounded-lg text-sm flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>Rozpocznij spis</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: ACTIVE LIVE COUNTING SCREEN */}
            {step === 4 && activeProduct && (
              <motion.div
                key="step4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col md:grid md:grid-cols-12 gap-6"
              >
                {/* Progress bar and index tracker - Desktop (Left column, span 4) */}
                <div className="hidden md:col-span-4 md:flex flex-col pr-6 h-full overflow-y-auto space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold tracking-wider text-gray-500 dark:text-gray-400 uppercase">Lista produktów ({countedCount}/{totalItems})</h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Kliknij element, aby przejść bezpośrednio.</p>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto pr-2">
                    {countingProducts.map((prod, idx) => {
                      const sessItem = sessionItems.find(i => i.productId === prod.id);
                      const isCurrent = idx === currentIndex;
                      
                      let statusBg = "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
                      let label = "Brak odczytu";
                      if (sessItem?.status === 'counted') {
                        statusBg = "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-450";
                        label = `${sessItem.countedQty} ${prod.unitOfMeasure}`;
                      } else if (sessItem?.status === 'zero_stock') {
                        statusBg = "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400";
                        label = "STAN: 0";
                      } else if (sessItem?.status === 'unable_to_count') {
                        statusBg = "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400";
                        label = "Nieliczony";
                      } else if (sessItem?.status === 'recount') {
                        statusBg = "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400";
                        label = "Ponowne liczenie";
                      } else if (sessItem?.status === 'note_added') {
                        statusBg = "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400";
                        label = "Notatka";
                      }

                      return (
                        <button
                          key={prod.id}
                          onClick={() => setCurrentIndex(idx)}
                          className={cn(
                            "w-full text-left p-3 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer",
                            isCurrent 
                              ? "bg-blue-50/30 dark:bg-blue-950/10 font-medium" 
                              : "bg-white dark:bg-[#0E1321]/50 hover:bg-gray-50 dark:hover:bg-gray-800/10 shadow-sm"
                          )}
                        >
                          <div className="min-w-0">
                            <h5 className="text-xs font-semibold text-[#1A1C1E] dark:text-white truncate">{prod.name}</h5>
                            <p className="text-[10px] text-gray-400 dark:text-gray-505 mt-0.5 font-mono truncate">{prod.vendorSku}</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5">
                            {sessItem?.note && (
                              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" title="Dodano notatkę" />
                            )}
                            {photoAdded[prod.id] && (
                              <Camera className="h-3 w-3 text-emerald-600 dark:text-emerald-450" />
                            )}
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", statusBg)}>
                              {label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={saveDraftLocally}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#F0F2F5] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium cursor-pointer"
                    >
                      <Save className="h-4 w-4" />
                      <span>Zapisz szkic lokalnie</span>
                    </button>
                  </div>
                </div>

                {/* Main active item counting workspace - Span 8 on desktop */}
                <div className="col-span-12 md:col-span-8 flex flex-col justify-between h-full space-y-4">
                  <div className="md:hidden">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <span>Postęp inwentaryzacji</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{currentIndex + 1} / {totalItems}</span>
                    </div>
                    {/* Horizontal scroll of positions */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                      {countingProducts.map((prod, idx) => {
                        const sessItem = sessionItems.find(i => i.productId === prod.id);
                        const isCurrent = idx === currentIndex;
                        
                        let dotColor = "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400";
                        if (isCurrent) {
                          dotColor = "bg-blue-600 dark:bg-blue-500 text-white ring-2 ring-blue-500/20";
                        } else if (sessItem?.status === 'counted') {
                          dotColor = "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400";
                        } else if (sessItem?.status === 'zero_stock') {
                          dotColor = "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400";
                        } else if (sessItem?.status === 'unable_to_count') {
                          dotColor = "bg-gray-100 dark:bg-gray-850 text-gray-400 dark:text-gray-500";
                        } else if (sessItem?.status === 'recount') {
                          dotColor = "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400";
                        } else if (sessItem?.status === 'note_added') {
                          dotColor = "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400";
                        }

                        return (
                          <button
                            key={prod.id}
                            onClick={() => setCurrentIndex(idx)}
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 relative transition-all cursor-pointer",
                              dotColor
                            )}
                          >
                            <span>{idx + 1}</span>
                            {sessItem?.note && (
                              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-500" />
                            )}
                            {photoAdded[prod.id] && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full flex items-center justify-center">
                                <Camera className="h-1.5 w-1.5 text-white" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SCANNER SIMULATOR ALERTS BANNER */}
                  {scanMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-400 text-center font-medium animate-pulse"
                    >
                      {scanMessage}
                    </motion.div>
                  )}

                  {/* ACTIVE ITEM DISPLAY CARD */}
                  <div className="bg-white dark:bg-[#0E1321]/30 rounded-2xl p-4 flex-1 flex flex-col justify-between space-y-4 shadow-sm">
                    
                    {/* Item header */}
                    <div className="flex gap-4 items-start">
                      <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden relative shrink-0">
                        <img 
                          src={activeProduct.imageUrl} 
                          alt={activeProduct.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <span className="text-[10px] px-2 py-0.5 font-bold uppercase rounded bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400">
                          {activeProduct.category}
                        </span>
                        <h4 className="font-bold text-sm text-[#1A1C1E] dark:text-white leading-snug">{activeProduct.name}</h4>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-550 dark:text-gray-405 font-mono">
                          <span>SKU: {activeProduct.vendorSku}</span>
                          <span>Op. zbiorcze: {activeProduct.packSize} {activeProduct.unitOfMeasure}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stock comparison info */}
                    <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-[#F0F2F5] dark:bg-gray-800/55 rounded-xl text-center text-xs">
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 text-[11px]">Ostatni stan</div>
                        <div className="font-bold text-gray-800 dark:text-gray-200 mt-1 font-mono">
                          {inventoryBalances.find(b => b.productId === activeProduct.id && b.locationId === selectedLocationId)?.currentStock ?? 0} szt.
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 text-[11px]">Minimum</div>
                        <div className="font-bold text-amber-700 dark:text-amber-450 mt-1 font-mono">
                          {inventoryBalances.find(b => b.productId === activeProduct.id && b.locationId === selectedLocationId)?.minStock ?? 0} szt.
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 text-[11px]">Cel optymalny</div>
                        <div className="font-bold text-emerald-700 dark:text-emerald-450 mt-1 font-mono">
                          {inventoryBalances.find(b => b.productId === activeProduct.id && b.locationId === selectedLocationId)?.targetStock ?? 0} szt.
                        </div>
                      </div>
                    </div>

                    {/* QUANTITY COUNT PANEL - Main operational zone */}
                    <div className="space-y-3">
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Fizyczna ilość na półce</label>
                      </div>

                      <div className="flex items-center justify-center gap-4">
                        {/* Minus buttons */}
                        <div className="flex gap-1.5">
                          <button 
                            onClick={() => decrement(activeProduct.packSize)}
                            className="w-12 h-12 rounded-xl bg-[#F0F2F5] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 font-bold active:scale-95 transition-all cursor-pointer"
                            title={`Odejmij opakowanie (-${activeProduct.packSize})`}
                          >
                            <span className="text-[10px] absolute -mt-7 text-gray-400 dark:text-gray-500">-{activeProduct.packSize}</span>
                            <Minus className="h-5 w-5" />
                          </button>
                          <button 
                            onClick={() => decrement(1)}
                            className="w-10 h-10 rounded-lg bg-[#F0F2F5]/60 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 active:scale-95 transition-all cursor-pointer"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Quantity input */}
                        <div className="w-24 text-center">
                          <input
                            type="number"
                            placeholder="?"
                            value={activeSessionItem?.countedQty !== null ? activeSessionItem?.countedQty : ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : parseInt(e.target.value);
                              updateCountedQty(val);
                            }}
                            className="w-full text-center py-2 bg-white dark:bg-[#0E1321] rounded-xl text-xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                          />
                          <span className="text-[10px] text-gray-400 block mt-1 uppercase font-mono">{activeProduct.unitOfMeasure}</span>
                        </div>

                        {/* Plus buttons */}
                        <div className="flex gap-1.5">
                          <button 
                            onClick={() => increment(1)}
                            className="w-10 h-10 rounded-lg bg-[#F0F2F5]/60 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 active:scale-95 transition-all cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => increment(activeProduct.packSize)}
                            className="w-12 h-12 rounded-xl bg-[#2A3B4C] dark:bg-blue-600 hover:bg-[#1E2B38] dark:hover:bg-blue-500 text-white flex items-center justify-center font-bold active:scale-95 transition-all cursor-pointer"
                            title={`Dodaj opakowanie (+${activeProduct.packSize})`}
                          >
                            <span className="text-[10px] absolute -mt-7 text-blue-200 dark:text-blue-300">+{activeProduct.packSize}</span>
                            <Plus className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {/* Fast states: Zero, Unable to count, Recount */}
                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <button
                          onClick={handleSetZero}
                          className={cn(
                            "py-2 px-1 text-center rounded-xl text-[11px] font-medium transition-colors cursor-pointer",
                            activeSessionItem?.status === 'zero_stock'
                              ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                              : "bg-[#F0F2F5] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                          )}
                        >
                          Wyzeruj (Brak)
                        </button>
                        <button
                          onClick={handleUnableToCount}
                          className={cn(
                            "py-2 px-1 text-center rounded-xl text-[11px] font-medium transition-colors cursor-pointer",
                            activeSessionItem?.status === 'unable_to_count'
                              ? "bg-gray-600 dark:bg-gray-700 text-white"
                              : "bg-[#F0F2F5] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                          )}
                        >
                          Brak dostępu
                        </button>
                        <button
                          onClick={handleMarkRecount}
                          className={cn(
                            "py-2 px-1 text-center rounded-xl text-[11px] font-medium transition-colors cursor-pointer",
                            activeSessionItem?.status === 'recount'
                              ? "bg-amber-500 dark:bg-amber-600 text-white font-semibold"
                              : "bg-[#F0F2F5] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                          )}
                        >
                          Do weryfikacji
                        </button>
                      </div>
                    </div>

                    {/* Operational controls: Note & Camera mock */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                          <FileText className="h-4 w-4" />
                        </span>
                        <input
                          type="text"
                          placeholder="Dodaj notatkę (np. uszkodzone op.)..."
                          value={activeSessionItem?.note || ''}
                          onChange={(e) => updateNote(e.target.value)}
                          className="w-full pl-9 pr-2.5 py-2 bg-white dark:bg-[#0E1321]/60 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400"
                        />
                      </div>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => togglePhoto(activeProduct.id)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium cursor-pointer transition-colors",
                            photoAdded[activeProduct.id]
                              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                              : "bg-[#F0F2F5] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                          )}
                        >
                          <Camera className="h-4 w-4" />
                          <span>{photoAdded[activeProduct.id] ? "Zdjęcie dodane" : "Załącz zdjęcie"}</span>
                        </button>

                        <button
                          onClick={simulateBarcodeScan}
                          disabled={isScanning}
                          className="px-3 py-2 rounded-xl bg-blue-700 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer transition-colors"
                          title="Skanuj kod kreskowy (Symulacja)"
                        >
                          <Barcode className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Navigation controls */}
                  <div className="flex items-center justify-between shrink-0 pt-4">
                    <button
                      onClick={() => {
                        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
                      }}
                      disabled={currentIndex === 0}
                      className="px-4 py-2 text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:hover:bg-gray-100 disabled:dark:hover:bg-gray-800 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Poprzedni</span>
                    </button>

                    {currentIndex < totalItems - 1 ? (
                      <button
                        onClick={() => {
                          setCurrentIndex(currentIndex + 1);
                        }}
                        className="px-4 py-2 text-xs font-semibold bg-[#2A3B4C] dark:bg-blue-600 hover:bg-[#1E2B38] dark:hover:bg-blue-500 text-white rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>Następny</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmitSession}
                        className="px-5 py-2.5 bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Zakończ i wyślij</span>
                      </button>
                    )}
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
