import { toast, ToastOptions } from "react-toastify";
import { CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";

/**
 * Toast Patterns - Consistent toast notifications using react-toastify
 * IMPORTANT: Always use react-toastify, NEVER use sonner
 */

const defaultOptions: ToastOptions = {
  position: "top-right",
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

export const toastPatterns = {
  // Success notifications
  success: (message: string, options?: ToastOptions) => {
    toast.success(message, {
      ...defaultOptions,
      ...options,
      icon: <CheckCircle2 className="h-5 w-5" />,
    });
  },

  // Error notifications
  error: (message: string, options?: ToastOptions) => {
    toast.error(message, {
      ...defaultOptions,
      autoClose: 5000, // Errors stay longer
      ...options,
      icon: <XCircle className="h-5 w-5" />,
    });
  },

  // Warning notifications
  warning: (message: string, options?: ToastOptions) => {
    toast.warning(message, {
      ...defaultOptions,
      ...options,
      icon: <AlertCircle className="h-5 w-5" />,
    });
  },

  // Info notifications
  info: (message: string, options?: ToastOptions) => {
    toast.info(message, {
      ...defaultOptions,
      ...options,
      icon: <Info className="h-5 w-5" />,
    });
  },

  // Promise-based notifications (for async operations)
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      pending: string;
      success: string;
      error: string;
    },
    options?: ToastOptions
  ) => {
    return toast.promise(promise, messages, {
      ...defaultOptions,
      ...options,
    });
  },

  // Loading notification (persistent until dismissed)
  loading: (message: string, options?: ToastOptions) => {
    return toast.loading(message, {
      ...defaultOptions,
      autoClose: false,
      ...options,
    });
  },

  // Update existing toast
  update: (toastId: string | number, options: ToastOptions) => {
    toast.update(toastId, options);
  },

  // Dismiss toast
  dismiss: (toastId?: string | number) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  },

  // Common patterns
  saved: (itemName?: string) => {
    toast.success(`${itemName || "Item"} saved successfully`);
  },

  deleted: (itemName?: string) => {
    toast.success(`${itemName || "Item"} deleted successfully`);
  },

  created: (itemName?: string) => {
    toast.success(`${itemName || "Item"} created successfully`);
  },

  updated: (itemName?: string) => {
    toast.success(`${itemName || "Item"} updated successfully`);
  },

  copied: () => {
    toast.success("Copied to clipboard");
  },

  networkError: () => {
    toast.error("Network error. Please check your connection and try again.");
  },

  permissionDenied: () => {
    toast.error("You don't have permission to perform this action.");
  },

  validationError: (message?: string) => {
    toast.error(message || "Please check your input and try again.");
  },
};

// Export both the patterns and the raw toast object for advanced use
export { toast };
