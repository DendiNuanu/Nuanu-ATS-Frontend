"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <h2 className="font-heading text-xl font-bold text-slate-900">
            Application error
          </h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            A critical error occurred. Please try reloading the page.
          </p>
          <button
            onClick={() => reset()}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#006b5f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#005a4f]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
