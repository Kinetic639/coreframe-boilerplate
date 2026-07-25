"use client";

import * as React from "react";
import {
  ArrowLeft,
  CheckCheck,
  FileCheck,
  MessageSquare,
  Package,
  Paperclip,
  Send,
  ShoppingBag,
  Tag,
  User,
} from "lucide-react";
import type {
  VmiPortalInventoryItemDto,
  VmiPortalMessageThreadDto,
  VmiPortalOrderDto,
  VmiPortalProposalDto,
  VmiPortalVendorDto,
} from "@/lib/vmi-portal/types";
import { cn } from "@/utils/cn";

interface MessagesExperienceProps {
  threads: VmiPortalMessageThreadDto[];
  vendors: VmiPortalVendorDto[];
  orders: VmiPortalOrderDto[];
  inventory: VmiPortalInventoryItemDto[];
  proposals: VmiPortalProposalDto[];
}

export function MessagesExperience({
  threads,
  vendors,
  orders,
  inventory,
  proposals,
}: MessagesExperienceProps) {
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(threads[0]?.id ?? null);
  const [newMessageText, setNewMessageText] = React.useState("");
  const [localThreads, setLocalThreads] = React.useState(threads);

  const activeThread = localThreads.find((thread) => thread.id === activeThreadId);
  const activeVendor = activeThread ? vendors.find((vendor) => vendor.id === activeThread.vendorId) : undefined;

  const sendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMessageText.trim() || !activeThreadId) return;

    setLocalThreads((current) =>
      current.map((thread) =>
        thread.id === activeThreadId
          ? {
              ...thread,
              unreadCount: 0,
              lastUpdated: new Date().toISOString(),
              messages: [
                ...thread.messages,
                {
                  id: `message-local-${Date.now()}`,
                  sender: "client",
                  senderName: "Michał Stępień",
                  content: newMessageText.trim(),
                  timestamp: new Date().toISOString(),
                },
              ],
            }
          : thread,
      ),
    );
    setNewMessageText("");
  };

  const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });

  const renderContextCard = () => {
    if (!activeThread) return null;

    if (activeThread.relatedObjectType === "order" && activeThread.relatedObjectId) {
      const order = orders.find((item) => item.id === activeThread.relatedObjectId);
      if (!order) return null;
      return (
        <ContextCard icon={ShoppingBag} tone="blue" title={`Zamówienie: ${order.orderNumber}`} meta={`Stan: ${order.status} • Źródło: ${order.origin}`} value={`${order.totalValue.toFixed(2)} zł`} detail={`Dostawa: ${order.requestedDeliveryDate}`} />
      );
    }

    if (activeThread.relatedObjectType === "product" && activeThread.relatedObjectId) {
      const product = inventory.find((item) => item.id === activeThread.relatedObjectId);
      if (!product) return null;
      return (
        <ContextCard icon={Package} tone="orange" title={product.productName} meta={`Kod dostawcy: ${product.vendorSku}`} value={`${product.price.toFixed(2)} zł`} detail={`Opakowanie: ${product.packSize} ${product.unit}`} />
      );
    }

    if (activeThread.relatedObjectType === "proposal" && activeThread.relatedObjectId) {
      const proposal = proposals.find((item) => item.id === activeThread.relatedObjectId);
      if (!proposal) return null;
      return (
        <ContextCard icon={FileCheck} tone="indigo" title={`Propozycja VMI: ${proposal.proposalNumber}`} meta={`Wygaśnięcie: ${proposal.expiryDate}`} value={`${proposal.lines.length} pozycji`} detail={`Stan: ${proposal.status}`} />
      );
    }

    return <ContextCard icon={Tag} tone="emerald" title="Rozmowa ogólna" meta="Brak powiązanego obiektu biznesowego" />;
  };

  return (
    <section className="h-[calc(100vh-9rem)] min-h-[620px] overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#0A0D16]">
      <div className="flex h-full flex-col md:grid md:grid-cols-12">
        <aside
          className={cn(
            "col-span-12 flex h-full min-w-0 flex-col bg-gray-50 dark:bg-[#0E1321] md:col-span-4",
            activeThreadId ? "hidden md:flex" : "flex",
          )}
        >
          <div className="flex items-center justify-between bg-white px-4 py-3 dark:bg-[#131A2E]">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <h1 className="font-display text-sm font-bold tracking-wide text-gray-950 dark:text-white">
                Komunikacja B2B
              </h1>
            </div>
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
            {localThreads.map((thread) => {
              const vendor = vendors.find((item) => item.id === thread.vendorId);
              const isSelected = thread.id === activeThreadId;
              const lastMessage = thread.messages.at(-1);
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={cn(
                    "flex w-full flex-col gap-1.5 rounded-xl p-3.5 text-left shadow-sm transition-all",
                    isSelected
                      ? "bg-blue-50/50 dark:bg-blue-950/20"
                      : "bg-white hover:bg-gray-100 dark:bg-gray-900/30 dark:hover:bg-gray-900/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold text-gray-950 dark:text-white">
                      {vendor?.name ?? "Dostawca"}
                    </span>
                    <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">
                      {formatDate(thread.lastUpdated)}
                    </span>
                  </div>
                  <h2 className="line-clamp-1 text-xs font-semibold text-gray-800 dark:text-gray-300">
                    {thread.subject}
                  </h2>
                  <p className="mt-0.5 truncate text-[11px] leading-normal text-gray-500 dark:text-gray-450">
                    {lastMessage ? `${lastMessage.sender === "client" ? "Ja" : "Opiekun"}: ${lastMessage.content}` : ""}
                  </p>
                  <div className="mt-1 flex items-center justify-between pt-1.5">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {objectLabel(thread.relatedObjectType)}
                    </span>
                    {thread.unreadCount > 0 ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                        {thread.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div
          className={cn(
            "col-span-12 flex h-full min-w-0 flex-col bg-white dark:bg-[#0A0D16] md:col-span-8",
            !activeThreadId ? "hidden md:flex" : "flex",
          )}
        >
          {activeThread && activeVendor ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 bg-white px-4 py-3 dark:bg-[#131A2E]">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveThreadId(null)}
                    className="rounded-lg bg-gray-150 p-1 text-gray-500 hover:text-gray-950 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white md:hidden"
                    aria-label="Wróć do wątków"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h2 className="text-sm font-bold text-gray-950 dark:text-white">{activeVendor.name}</h2>
                    <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <User className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                      Opiekun: {activeVendor.accountManager.name} ({activeVendor.accountManager.email})
                    </p>
                  </div>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Aktywny</span>
                </div>
              </div>

              <div className="shrink-0 bg-gray-50 p-3 dark:bg-gray-950/40">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Połączony kontekst biznesowy
                  </span>
                  <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">Ambra Link</span>
                </div>
                {renderContextCard()}
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-gray-55/30 p-4 dark:bg-gradient-to-b dark:from-[#0A0D16] dark:to-[#070A11]">
                <div className="py-2 text-center">
                  <span className="rounded bg-white px-2 py-1 text-[10px] text-gray-500 shadow-sm dark:bg-gray-900/60">
                    Rozpoczęto szyfrowany czat handlowy • {formatDate(activeThread.messages[0]?.timestamp ?? activeThread.lastUpdated)}
                  </span>
                </div>

                {activeThread.messages.map((message, index) => {
                  const isMe = message.sender === "client";
                  return (
                    <div
                      key={message.id}
                      className={cn("flex max-w-[85%] flex-col space-y-1", isMe ? "ml-auto items-end" : "mr-auto items-start")}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                        <span className="font-semibold text-gray-500 dark:text-gray-450">{message.senderName}</span>
                        <span>•</span>
                        <span>{formatTime(message.timestamp)}</span>
                      </div>
                      <div
                        className={cn(
                          "rounded-2xl p-3 text-xs leading-relaxed shadow-sm",
                          isMe
                            ? "rounded-tr-none bg-blue-600 text-white shadow-md shadow-blue-600/5"
                            : "rounded-tl-none bg-white text-gray-950 dark:bg-gray-850 dark:text-gray-300",
                        )}
                      >
                        {message.content}
                      </div>
                      {isMe && index === activeThread.messages.length - 1 ? (
                        <span className="mt-0.5 flex items-center gap-0.5 font-mono text-[9px] text-gray-400 dark:text-gray-500">
                          <CheckCheck className="h-3 w-3 text-blue-500" />
                          Dostarczono
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendMessage} className="shrink-0 bg-white p-3 dark:bg-[#0E1321]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-gray-100 p-2.5 text-gray-500 transition-colors hover:text-gray-900 dark:bg-gray-800/80 dark:text-gray-400 dark:hover:text-white"
                    aria-label="Dołącz dokument"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    type="text"
                    placeholder="Wpisz oficjalną wiadomość handlową..."
                    value={newMessageText}
                    onChange={(event) => setNewMessageText(event.target.value)}
                    className="flex-1 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
                  />
                  <button
                    type="submit"
                    disabled={!newMessageText.trim()}
                    className="rounded-xl bg-blue-600 p-2.5 text-white shadow-md shadow-blue-500/10 transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600"
                    aria-label="Wyślij wiadomość"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center space-y-3 bg-gray-50/50 p-8 text-center dark:bg-[#0A0D16]">
              <div className="rounded-full bg-white p-4 text-gray-400 shadow-sm dark:bg-gray-900 dark:text-gray-550">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h2 className="text-sm font-bold text-gray-950 dark:text-white">Wybierz wątek z dostawcą</h2>
              <p className="max-w-xs text-xs leading-normal text-gray-500 dark:text-gray-450">
                Aby omówić parametry inwentaryzacji VMI, zamówienia lub wycenę, kliknij aktywną dyskusję na liście.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function objectLabel(type: VmiPortalMessageThreadDto["relatedObjectType"]) {
  switch (type) {
    case "product":
      return "Katalog";
    case "order":
      return "Zamówienie";
    case "proposal":
      return "Uzupełnienie";
    case "quotation":
      return "Oferta";
    case "delivery":
      return "Dostawa";
    default:
      return "Ogólne";
  }
}

function ContextCard({
  icon: Icon,
  tone,
  title,
  meta,
  value,
  detail,
}: {
  icon: typeof ShoppingBag;
  tone: "blue" | "orange" | "indigo" | "emerald";
  title: string;
  meta: string;
  value?: string;
  detail?: string;
}) {
  const toneClass = {
    blue: "bg-blue-50/50 dark:bg-[#111625] text-blue-600 dark:text-blue-400",
    orange: "bg-orange-50/50 dark:bg-[#111625] text-orange-600 dark:text-orange-400",
    indigo: "bg-indigo-50/50 dark:bg-[#111625] text-indigo-600 dark:text-indigo-400",
    emerald: "bg-emerald-50/50 dark:bg-[#111625] text-emerald-600 dark:text-emerald-400",
  }[tone];

  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-xl p-3 text-xs", toneClass)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="rounded-lg bg-current/10 p-2">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold text-gray-950 dark:text-white">{title}</p>
          <p className="mt-0.5 truncate text-gray-500 dark:text-gray-400">{meta}</p>
        </div>
      </div>
      {value ? (
        <div className="shrink-0 text-right">
          <p className="font-mono font-bold text-gray-950 dark:text-white">{value}</p>
          {detail ? <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">{detail}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
