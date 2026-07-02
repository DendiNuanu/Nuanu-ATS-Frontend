"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";

type ToastVariant = "success" | "info" | "error";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, { icon: typeof CheckCircle2; accent: string }> = {
  success: { icon: CheckCircle2, accent: "text-green-400" },
  info: { icon: CheckCircle2, accent: "text-blue-400" },
  error: { icon: CheckCircle2, accent: "text-red-400" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    // Auto-dismiss after 2.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast viewport — fixed bottom-right */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const { icon: Icon, accent } = variantStyles[toast.variant];
          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 shadow-lg animate-toast-slide-in max-w-sm"
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${accent}`} />
              <p className="text-sm font-medium text-white">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="ml-2 text-slate-400 hover:text-white transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
