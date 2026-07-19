'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Check, 
  HelpCircle, 
  Info, 
  MessageSquare, 
  Minus, 
  Plus, 
  ShieldAlert, 
  ShoppingCart, 
  ThumbsDown, 
  ThumbsUp, 
  Trash2, 
  User 
} from 'lucide-react';
import { ReplenishmentProposal, Product, Vendor, ReplenishmentProposalLine } from '../lib/types';
import { cn } from '../lib/utils';

interface ProposalDetailProps {
  proposal: ReplenishmentProposal;
  vendor: Vendor;
  products: Product[];
  onBack: () => void;
  onSubmitApproval: (proposalId: string, approvedLines: ReplenishmentProposalLine[], comments?: string) => void;
  onAskQuestion: (productId: string, subject: string) => void;
}

export default function ProposalDetail({
  proposal,
  vendor,
  products,
  onBack,
  onSubmitApproval,
  onAskQuestion
}: ProposalDetailProps) {
  // Line item overrides
  const [lines, setLines] = useState<ReplenishmentProposalLine[]>(
    proposal.lines.map(line => ({ ...line }))
  );
  const [generalComment, setGeneralComment] = useState('');

  const getProduct = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  // Adjust line quantities in multiples of pack size
  const handleAdjustQty = (productId: string, amount: number) => {
    const updated = lines.map(line => {
      if (line.productId === productId) {
        const prod = getProduct(productId);
        const pack = prod?.packSize || 1;
        const currentQty = line.finalProposedQty;
        const nextQty = Math.max(0, currentQty + amount);
        
        return {
          ...line,
          finalProposedQty: nextQty,
          status: nextQty === 0 
            ? 'rejected' as const 
            : nextQty !== line.suggestedQty ? 'modified' as const : 'approved' as const
        };
      }
      return line;
    });
    setLines(updated);
  };

  // Toggle approve / reject state for a line
  const handleToggleStatus = (productId: string, action: 'approve' | 'reject') => {
    const updated = lines.map(line => {
      if (line.productId === productId) {
        if (action === 'reject') {
          return {
            ...line,
            finalProposedQty: 0,
            status: 'rejected' as const
          };
        } else {
          return {
            ...line,
            finalProposedQty: line.suggestedQty === 0 ? (getProduct(productId)?.packSize || 4) : line.suggestedQty,
            status: 'approved' as const
          };
        }
      }
      return line;
    });
    setLines(updated);
  };

  // Update line level comments
  const handleLineComment = (productId: string, commentText: string) => {
    const updated = lines.map(line => {
      if (line.productId === productId) {
        return {
          ...line,
          clientComment: commentText
        };
      }
      return line;
    });
    setLines(updated);
  };

  // Mass action: approve all lines
  const handleApproveAll = () => {
    const updated = lines.map(line => ({
      ...line,
      finalProposedQty: line.suggestedQty,
      status: 'approved' as const
    }));
    setLines(updated);
  };

  // Mass action: reject all lines
  const handleRejectAll = () => {
    const updated = lines.map(line => ({
      ...line,
      finalProposedQty: 0,
      status: 'rejected' as const
    }));
    setLines(updated);
  };

  // Calculate stats for sticky footer
  const totalApprovedLines = lines.filter(l => l.status === 'approved' || l.status === 'suggested').length;
  const totalModifiedLines = lines.filter(l => l.status === 'modified').length;
  const totalRejectedLines = lines.filter(l => l.status === 'rejected' || l.finalProposedQty === 0).length;

  const totalOrderValue = lines.reduce((acc, l) => {
    if (l.status === 'rejected') return acc;
    return acc + (l.price * l.finalProposedQty);
  }, 0);

  // Submit back to main VMI order system
  const handleFormSubmit = () => {
    const approvedLines = lines.filter(l => l.finalProposedQty > 0);
    onSubmitApproval(proposal.id, approvedLines, generalComment);
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA] dark:bg-[#0A0D16] text-[#1A1C1E] dark:text-white">
      
      {/* Detail Header */}
      <div className="px-4 py-3 bg-white dark:bg-[#131A2E] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1.5 rounded-lg bg-[#F0F2F5] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-[#2A3B4C] dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="font-semibold text-sm text-[#2A3B4C] dark:text-white">Szczegóły Propozycji VMI</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">ID: {proposal.proposalNumber} ({proposal.date})</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 font-bold font-mono">
            {proposal.status}
          </span>
        </div>
      </div>

      {/* Info Warning Bar */}
      <div className="bg-amber-50 dark:bg-amber-950/15 px-4 py-2.5 shrink-0 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-400">
        <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 animate-pulse" />
        <p className="leading-normal">
          Algorytm VMI Ambra wyliczył zapotrzebowanie na podstawie progów minimalnych. Możesz zmodyfikować ilości lub uzupełnić komentarze dla handlowca.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 bg-[#F8F9FA] dark:bg-[#0A0D16]">
        {/* Vendor Contact details & Expiry Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-[#0E1321]/60 rounded-xl p-4 shadow-sm">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Odpowiedzialny Dostawca</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                "w-2 h-2 rounded-full",
                vendor.accentColor === 'blue' ? 'bg-blue-500' :
                vendor.accentColor === 'orange' ? 'bg-orange-500' :
                vendor.accentColor === 'green' ? 'bg-green-500' : 'bg-red-500'
              )} />
              <span className="font-bold text-sm text-[#2A3B4C] dark:text-white">{vendor.name}</span>
            </div>
            <p className="text-xs text-gray-550 dark:text-gray-400 flex items-center gap-1 mt-0.5">
              <User className="h-3.5 w-3.5 text-gray-400" />
              <span>Opiekun: {vendor.accountManager.name} ({vendor.accountManager.phone})</span>
            </p>
          </div>

          <div className="space-y-1 sm:text-right">
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ważność propozycji</h4>
            <p className="text-sm font-bold text-red-650 dark:text-red-400 mt-1">Wygasa dnia: {proposal.expiryDate}</p>
            <p className="text-[10px] text-gray-450 dark:text-gray-500">Po tej dacie propozycja wygaśnie i zostanie wygenerowana nowa.</p>
          </div>
        </div>

        {/* Global actions block */}
        <div className="flex items-center justify-between pb-2">
          <h4 className="font-bold text-sm text-[#2A3B4C] dark:text-white">Pozycje w propozycji ({lines.length})</h4>
          <div className="flex gap-2">
            <button
              onClick={handleApproveAll}
              className="px-3 py-1.5 bg-white dark:bg-[#0E1321]/50 hover:bg-gray-50 dark:hover:bg-gray-800 text-[#2A3B4C] dark:text-gray-300 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
            >
              <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" />
              <span>Zatwierdź wszystkie</span>
            </button>
            <button
              onClick={handleRejectAll}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-400 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ThumbsDown className="h-3.5 w-3.5 text-red-600" />
              <span>Odrzuć wszystkie</span>
            </button>
          </div>
        </div>

        {/* Lines loop */}
        <div className="space-y-4">
          {lines.map(line => {
            const prod = getProduct(line.productId);
            if (!prod) return null;

            const isRejected = line.status === 'rejected' || line.finalProposedQty === 0;
            const isModified = line.status === 'modified';
            const pack = prod.packSize || 1;

            return (
              <div 
                key={line.productId}
                className={cn(
                  "p-4 rounded-xl transition-all flex flex-col gap-4 relative",
                  isRejected 
                    ? "bg-red-50/40 dark:bg-red-950/10 opacity-60" 
                    : isModified 
                      ? "bg-amber-50/40 dark:bg-amber-950/10" 
                      : "bg-white dark:bg-[#0E1321]/50 shadow-sm"
                )}
              >
                {/* Line Header */}
                <div className="flex gap-3 items-start justify-between">
                  <div className="flex gap-3 items-center min-w-0">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden shrink-0">
                      <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="font-bold text-xs text-[#1A1C1E] dark:text-white truncate leading-snug">{prod.name}</h5>
                      <div className="flex items-center gap-2 text-[10px] text-gray-550 dark:text-gray-450 mt-1 font-mono">
                        <span>SKU: {prod.vendorSku}</span>
                        <span>•</span>
                        <span>Cena: {line.price.toFixed(2)} zł</span>
                      </div>
                    </div>
                  </div>

                  {/* Reject/Approve fast toggle buttons */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isRejected ? (
                      <button
                        onClick={() => handleToggleStatus(line.productId, 'approve')}
                        className="p-1 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Przywróć</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(line.productId, 'reject')}
                        className="p-1.5 text-gray-500 dark:text-gray-450 hover:bg-red-50 hover:text-red-650 rounded-lg cursor-pointer"
                        title="Odrzuć pozycję z dostawy"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* VMI Formulas & Math logic behind suggestion */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 py-2 px-3 bg-[#F0F2F5] dark:bg-gray-800/50 rounded-xl text-center text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Stan obecny</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">{line.currentStock} szt.</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Min / Cel</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">{line.minStock} / {line.targetStock}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Paczka zbiorcza</span>
                    <span className="font-bold text-amber-700 dark:text-amber-450 font-mono">{pack} {prod.unitOfMeasure}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Zasugerowano</span>
                    <span className="font-bold text-blue-700 dark:text-blue-400 font-mono">{line.suggestedQty} szt.</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Wartość linii</span>
                    <span className="font-bold text-[#2A3B4C] dark:text-white font-mono">{(line.price * line.finalProposedQty).toFixed(2)} zł</span>
                  </div>
                </div>

                {/* VMI AI reason text explaining WHY */}
                <div className="bg-[#F8F9FA] dark:bg-[#0E1321]/45 p-2.5 rounded-lg text-[11px] text-gray-600 dark:text-gray-400 leading-normal">
                  <span className="font-semibold text-[#2A3B4C] dark:text-white">Algorytm VMI: </span>
                  {line.reason}
                </div>

                {/* Manual override of quantities */}
                {!isRejected && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Dostosuj ilość:</span>
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleAdjustQty(line.productId, -pack)}
                          disabled={line.finalProposedQty <= pack}
                          className="w-8 h-8 rounded bg-[#F0F2F5] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-30 flex items-center justify-center cursor-pointer font-bold"
                          title={`Odejmij opakowanie zbiorcze (-${pack})`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>

                        <div className="px-3 py-1 bg-white dark:bg-[#0E1321] rounded text-sm font-bold font-mono text-[#2A3B4C] dark:text-white text-center min-w-[50px]">
                          {line.finalProposedQty}
                        </div>

                        <button
                          onClick={() => handleAdjustQty(line.productId, pack)}
                          className="w-8 h-8 rounded bg-[#F0F2F5] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center cursor-pointer font-bold"
                          title={`Dodaj opakowanie zbiorcze (+${pack})`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-mono mt-1">{prod.unitOfMeasure}</span>
                    </div>

                    {/* Fast comments and consult */}
                    <div className="flex gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Komentarz klienta (np. nadmiar)..."
                        value={line.clientComment || ''}
                        onChange={(e) => handleLineComment(line.productId, e.target.value)}
                        className="flex-1 sm:w-60 bg-white dark:bg-[#0E1321] rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-405 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />

                      <button
                        onClick={() => onAskQuestion(line.productId, `Zapytanie o pozycję VMI: ${prod.name} (Propozycja ${proposal.proposalNumber})`)}
                        className="p-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-[#2A3B4C] dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Skonsultuj tę pozycję z opiekunem dostawcy"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className="hidden md:inline">Zadaj pytanie</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* General remarks from customer */}
        <div className="bg-white dark:bg-[#0E1321]/60 rounded-xl p-4 space-y-2 shadow-sm">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block uppercase tracking-wider">Komentarz ogólny do dostawy</label>
          <textarea
            placeholder="Dodaj opcjonalne uwagi dla doradcy, np. godziny przyjmowania dostaw lub numer PO..."
            value={generalComment}
            onChange={(e) => setGeneralComment(e.target.value)}
            className="w-full bg-white dark:bg-[#0E1321] rounded-xl p-3 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]"
          />
        </div>
      </div>

      {/* STICKY BOTTOM SUMMARY PANEL */}
      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#131A2E] px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0 z-10 shadow-md">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400">Podsumowanie propozycji:</span>
            <div className="flex items-center gap-1.5 font-semibold text-gray-750 dark:text-gray-300">
              <span className="text-emerald-600 dark:text-emerald-400">{totalApprovedLines} zatwierdzonych</span>
              {totalModifiedLines > 0 && <span className="text-amber-600 dark:text-amber-400">• {totalModifiedLines} zmienionych</span>}
              {totalRejectedLines > 0 && <span className="text-red-650 dark:text-red-400">• {totalRejectedLines} odrzuconych</span>}
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-gray-500 dark:text-gray-400 text-xs">Wartość netto:</span>
            <span className="text-xl font-black font-mono text-[#2A3B4C] dark:text-white">{(totalOrderValue).toFixed(2)} zł</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{(totalOrderValue * 1.23).toFixed(2)} zł z VAT</span>
          </div>
        </div>

        <button
          onClick={handleFormSubmit}
          className="w-full sm:w-auto px-6 py-3 bg-[#2A3B4C] dark:bg-blue-600 hover:bg-[#1E2B38] dark:hover:bg-blue-500 font-bold text-sm text-white rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-sm"
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Zatwierdź i wygeneruj zamówienie</span>
        </button>
      </div>

    </div>
  );
}
