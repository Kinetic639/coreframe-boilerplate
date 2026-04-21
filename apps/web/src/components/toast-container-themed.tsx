"use client";

import { Check, Copy, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function ToastCloseButton({ closeToast }: { closeToast?: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    // react-toastify v11: the message is rendered directly as a React text node
    // (a DOM TEXT_NODE), not wrapped in any element. Walk childNodes to collect it.
    const toastEl = (e.currentTarget as HTMLElement).closest(".Toastify__toast");
    let text = "";
    toastEl?.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent ?? "";
      }
    });
    text = text.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard not available (non-HTTPS, permissions denied, etc.)
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
      <button
        onClick={handleCopy}
        title="Copy message"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 4px",
          opacity: 0.6,
          display: "flex",
          alignItems: "center",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.6")}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <button
        onClick={closeToast}
        title="Close"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 4px",
          opacity: 0.6,
          display: "flex",
          alignItems: "center",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.6")}
      >
        <X size={13} />
      </button>
    </div>
  );
}

/**
 * Theme-aware ToastContainer that automatically adapts to the user's selected theme
 */
export function ToastContainerThemed() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine the actual theme to use
  const activeTheme = theme === "system" ? resolvedTheme : theme;

  return (
    <ToastContainer
      position="bottom-right"
      autoClose={2500}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick={false}
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={mounted ? (activeTheme === "dark" ? "dark" : "light") : "light"}
      closeButton={ToastCloseButton}
      style={{
        padding: "10px 14px",
        minHeight: "auto",
        fontSize: "14px",
        borderRadius: "8px",
      }}
    />
  );
}
