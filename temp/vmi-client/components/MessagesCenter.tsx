'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ChevronRight, 
  ExternalLink, 
  FileCheck, 
  FileText, 
  MessageSquare, 
  Paperclip, 
  Send, 
  ShoppingBag, 
  Tag, 
  User, 
  CheckCheck, 
  Image as ImageIcon 
} from 'lucide-react';
import { Conversation, Vendor, Order, Product, Quotation, ReplenishmentProposal } from '../lib/types';
import { cn } from '../lib/utils';

interface MessagesCenterProps {
  conversations: Conversation[];
  vendors: Vendor[];
  orders: Order[];
  products: Product[];
  quotations: Quotation[];
  proposals: ReplenishmentProposal[];
  onSendMessage: (conversationId: string, text: string) => void;
  onClose?: () => void;
  initialConversationId?: string | null;
}

export default function MessagesCenter({
  conversations: initialConversations,
  vendors,
  orders,
  products,
  quotations,
  proposals,
  onSendMessage,
  onClose,
  initialConversationId
}: MessagesCenterProps) {
  // Mobile navigation state
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId || null);
  const [newMessageText, setNewMessageText] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);

  // Sync state if initial list updates
  React.useEffect(() => {
    const syncState = () => {
      setConversations(initialConversations);
      if (initialConversationId) {
        setActiveConvId(initialConversationId);
      }
    };
    const timer = setTimeout(syncState, 0);
    return () => clearTimeout(timer);
  }, [initialConversations, initialConversationId]);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const activeVendor = activeConv ? vendors.find(v => v.id === activeConv.vendorId) : null;

  // Format timestamp helper
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  };

  // Send message simulation
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !activeConvId) return;

    onSendMessage(activeConvId, newMessageText);
    
    // Optimistic local update
    const updated = conversations.map(c => {
      if (c.id === activeConvId) {
        return {
          ...c,
          unreadCount: 0,
          lastUpdated: new Date().toISOString(),
          messages: [
            ...c.messages,
            {
              id: `m_new_${Date.now()}`,
              sender: 'client' as const,
              senderName: 'Michał Stępień',
              content: newMessageText,
              timestamp: new Date().toISOString()
            }
          ]
        };
      }
      return c;
    });
    setConversations(updated);
    setNewMessageText('');
  };

  // Context card renderer depending on object link
  const renderContextCard = () => {
    if (!activeConv) return null;
    const { relatedObjectType, relatedObjectId } = activeConv;

    if (relatedObjectType === 'order' && relatedObjectId) {
      const order = orders.find(o => o.id === relatedObjectId);
      if (!order) return null;
      return (
        <div className="bg-blue-50/50 dark:bg-[#111625] rounded-xl p-3 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-gray-950 dark:text-white">Zamówienie: {order.orderNumber}</p>
              <p className="text-gray-500 dark:text-gray-400 mt-0.5">Stan: <span className="text-blue-600 dark:text-blue-300 font-semibold">{order.status}</span> • Źródło: {order.origin}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-950 dark:text-white font-mono">
              {order.lines.reduce((acc, l) => acc + (l.price * l.requestedQty), 0).toFixed(2)} zł
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Dostawa: {order.requestedDeliveryDate}</p>
          </div>
        </div>
      );
    }

    if (relatedObjectType === 'product' && relatedObjectId) {
      const product = products.find(p => p.id === relatedObjectId);
      if (!product) return null;
      return (
        <div className="bg-orange-50/50 dark:bg-[#111625] rounded-xl p-3 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden shrink-0">
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-950 dark:text-white truncate">{product.name}</p>
              <p className="text-gray-500 dark:text-gray-400 mt-0.5 font-mono truncate">Kod dostawcy: {product.vendorSku}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-orange-600 dark:text-orange-400 font-mono">{product.price.toFixed(2)} zł</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Opakowanie: {product.packSize} {product.unitOfMeasure}</p>
          </div>
        </div>
      );
    }

    if (relatedObjectType === 'quotation' && relatedObjectId) {
      const quote = quotations.find(q => q.id === relatedObjectId);
      if (!quote) return null;
      return (
        <div className="bg-emerald-50/50 dark:bg-[#111625] rounded-xl p-3 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-gray-950 dark:text-white">Oferta cenowa: {quote.quotationNumber}</p>
              <p className="text-gray-500 dark:text-gray-400 mt-0.5">Ważna do: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{quote.validTo}</span></p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{quote.totalValue.toFixed(2)} zł</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-550 mt-0.5 font-medium">{quote.status}</p>
          </div>
        </div>
      );
    }

    if (relatedObjectType === 'proposal' && relatedObjectId) {
      const prop = proposals.find(p => p.id === relatedObjectId);
      if (!prop) return null;
      return (
        <div className="bg-indigo-50/50 dark:bg-[#111625] rounded-xl p-3 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FileCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-gray-950 dark:text-white">Propozycja VMI: {prop.proposalNumber}</p>
              <p className="text-gray-500 dark:text-gray-400 mt-0.5">Wygaśnięcie: <span className="text-amber-600 dark:text-amber-400 font-semibold">{prop.expiryDate}</span></p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-950 dark:text-white">{prop.lines.length} pozycji</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Stan: {prop.status}</p>
          </div>
        </div>
      );
    }

    return null;
  };

  const getObjectTypeLabel = (type: string) => {
    switch (type) {
      case 'product': return 'Katalog';
      case 'order': return 'Zamówienie';
      case 'proposal': return 'Uzupełnienie';
      case 'quotation': return 'Oferta';
      case 'delivery': return 'Dostawa';
      default: return 'Ogólne';
    }
  };

  return (
    <div className="h-full flex flex-col md:grid md:grid-cols-12 bg-white dark:bg-[#0A0D16]">
      
      {/* LEFT COLUMN: LIST OF CONVERSATIONS - Span 4 on desktop, hidden on mobile if conversation is active */}
      <div className={cn(
        "col-span-12 md:col-span-4 flex flex-col h-full bg-gray-50 dark:bg-[#0E1321] min-w-0",
        activeConvId ? "hidden md:flex" : "flex"
      )}>
        <div className="px-4 py-3 bg-white dark:bg-[#131A2E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            <h4 className="font-bold font-display text-sm tracking-wide text-gray-950 dark:text-white">Komunikacja B2B</h4>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white text-xs px-2 py-1 bg-gray-100 dark:bg-gray-850 rounded"
            >
              Zamknij
            </button>
          )}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {conversations.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">
              Brak aktywnych dyskusji z dostawcami.
            </div>
          ) : (
            conversations.map(conv => {
              const vendor = vendors.find(v => v.id === conv.vendorId);
              const isSelected = conv.id === activeConvId;
              const lastMsg = conv.messages[conv.messages.length - 1];

              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl transition-all flex flex-col gap-1.5 cursor-pointer shadow-sm",
                    isSelected 
                      ? "bg-blue-50/50 dark:bg-blue-950/20" 
                      : "bg-white dark:bg-gray-900/30 hover:bg-gray-100 dark:hover:bg-gray-900/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-gray-950 dark:text-white truncate">
                      {vendor?.name || 'Dostawca'}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                      {formatDate(conv.lastUpdated)}
                    </span>
                  </div>

                  <h5 className="text-xs font-semibold text-gray-800 dark:text-gray-300 line-clamp-1">
                    {conv.subject}
                  </h5>

                  <p className="text-[11px] text-gray-500 dark:text-gray-450 truncate mt-0.5 leading-normal">
                    {lastMsg ? `${lastMsg.sender === 'client' ? 'Ja' : 'Opiekun'}: ${lastMsg.content}` : ''}
                  </p>

                  <div className="flex items-center justify-between mt-1 pt-1.5">
                    <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded uppercase tracking-wide font-medium font-mono">
                      {getObjectTypeLabel(conv.relatedObjectType)}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center animate-bounce">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: CHUT CHAT - Span 8 on desktop, hidden on mobile if no active conversation */}
      <div className={cn(
        "col-span-12 md:col-span-8 flex flex-col h-full bg-white dark:bg-[#0A0D16] min-w-0",
        !activeConvId ? "hidden md:flex" : "flex"
      )}>
        {activeConv && activeVendor ? (
          <>
            {/* Context view header */}
            <div className="px-4 py-3 bg-white dark:bg-[#131A2E] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveConvId(null)}
                  className="md:hidden p-1 rounded-lg bg-gray-150 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h4 className="font-bold text-sm text-gray-950 dark:text-white">{activeVendor.name}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                    <span>Opiekun: {activeVendor.accountManager.name} ({activeVendor.accountManager.email})</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Dostawca dostępny online" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Aktywny</span>
              </div>
            </div>

            {/* Business Context Above Thread */}
            <div className="p-3 bg-gray-50 dark:bg-gray-950/40 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 tracking-wider uppercase">Połączony kontekst biznesowy</span>
                <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">Ambra Link™</span>
              </div>
              {renderContextCard()}
            </div>

            {/* Conversation Messages Flow */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-55/30 dark:bg-gradient-to-b dark:from-[#0A0D16] dark:to-[#070A11]">
              <div className="text-center py-2 shrink-0">
                <span className="text-[10px] bg-white dark:bg-gray-900/60 text-gray-500 px-2 py-1 rounded shadow-sm">
                  Rozpoczęto szyfrowany czat handlowy • {formatDate(activeConv.messages[0]?.timestamp || '')}
                </span>
              </div>

              {activeConv.messages.map((msg, idx) => {
                const isMe = msg.sender === 'client';

                return (
                  <div
                    key={msg.id || idx}
                    className={cn(
                      "flex flex-col max-w-[85%] space-y-1",
                      isMe ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                      <span className="font-semibold text-gray-500 dark:text-gray-450">{msg.senderName}</span>
                      <span>•</span>
                      <span>{formatTime(msg.timestamp)}</span>
                    </div>

                    <div className={cn(
                      "p-3 rounded-2xl text-xs leading-relaxed shadow-sm",
                      isMe 
                        ? "bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-600/5" 
                        : "bg-white dark:bg-gray-850 text-gray-950 dark:text-gray-300 rounded-tl-none"
                    )}>
                      {msg.content}
                    </div>

                    {isMe && idx === activeConv.messages.length - 1 && (
                      <span className="text-[9px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5 mt-0.5 font-mono">
                        <CheckCheck className="h-3 w-3 text-blue-500" />
                        <span>Dostarczono</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Context Message Composer */}
            <form onSubmit={handleSend} className="p-3 bg-white dark:bg-[#0E1321] shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alert('Wybór załącznika: Ta funkcja jest ograniczona w wersji demonstracyjnej. Dozwolone tylko opcjonalne miniatury zdjęć w spisie.')}
                  className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer transition-colors"
                  title="Dołącz dokument lub zdjęcie PDF/JPG"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  placeholder="Wpisz oficjalną wiadomość handlową..."
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  type="submit"
                  disabled={!newMessageText.trim()}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white cursor-pointer transition-colors shadow-md shadow-blue-500/10"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Empty state when no conversation is selected on desktop */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-gray-50/50 dark:bg-[#0A0D16]">
            <div className="p-4 rounded-full bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-550 shadow-sm">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h5 className="font-bold text-gray-950 dark:text-white text-sm">Wybierz wątek z dostawcą</h5>
            <p className="text-xs text-gray-500 dark:text-gray-450 max-w-xs leading-normal">
              Aby omówić parametry inwentaryzacji VMI, zamówienia lub wycenę, kliknij aktywną dyskusję na liście po lewej stronie.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
