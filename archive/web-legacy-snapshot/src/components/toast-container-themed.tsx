"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={mounted ? (activeTheme === "dark" ? "dark" : "light") : "light"}
      style={{
        padding: "10px 14px",
        minHeight: "auto",
        fontSize: "14px",
        borderRadius: "8px",
      }}
    />
  );
}
