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
    const toastEl = (e.currentTarget as HTMLElement).closest(".Toastify__toast");
    const bodyEl = toastEl?.querySelector(".Toastify__toast-body");
    // The message text lives in a plain div inside the body.
    // The icon div contains an SVG — skip it by finding the child with no SVG descendant.
    const children = bodyEl ? Array.from(bodyEl.children) : [];
    const textEl = children.find((el) => !el.querySelector("svg")) ?? bodyEl;
    const text = textEl?.textContent?.trim() ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-HTTPS / restricted contexts
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
