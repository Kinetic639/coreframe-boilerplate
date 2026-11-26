"use client";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/** react-toastify in the portal's colors (follows the theme through CSS variables). */
export function Toaster() {
  return (
    <ToastContainer
      position="bottom-center"
      autoClose={4000}
      hideProgressBar
      closeOnClick
      newestOnTop
      style={{ zIndex: "var(--z-toast)" as unknown as number }}
      toastStyle={{
        background: "var(--popover)",
        color: "var(--popover-foreground)",
        border: "1px solid var(--border)",
        borderRadius: "calc(var(--radius) + 2px)",
        boxShadow: "var(--shadow-lg)",
        fontSize: 14,
      }}
    />
  );
}
