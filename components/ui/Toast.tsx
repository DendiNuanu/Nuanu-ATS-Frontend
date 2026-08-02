"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";

type ToastVariant = "success" | "info" | "error";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  actions?: ToastAction[];
};

type ToastContextValue = {
  showToast: (
    message: string,
    variant?: ToastVariant,
    actions?: ToastAction[],
  ) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, { icon: typeof CheckCircle2; accent: string }> = {
  success: { icon: CheckCircle2, accent: "text-green-400" },
  info: { icon: CheckCircle2, accent: "text-blue-400" },
  error: { icon: CheckCircle2, accent: "text-red-400" },
};

export type ToastAction = {
  label: string;
  href: string;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (
      message: string,
      variant: ToastVariant = "success",
      actions?: ToastAction[],
    ) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, variant, actions }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((toast) => toast.id !== id)),
        actions?.length ? 7000 : 2500,
      );
    },
    [],
  );

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
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{toast.message}</p>
                {toast.actions && toast.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {toast.actions.map((action) => (
                      <a
                        key={`${toast.id}-${action.href}`}
                        href={action.href}
                        className="text-xs font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                      >
                        {action.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
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
