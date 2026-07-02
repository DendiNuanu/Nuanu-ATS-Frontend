"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { AlertTriangle } from "lucide-react";

export default function Error({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
        <AlertTriangle className="h-7 w-7 text-red-600" />
      </div>
      <h2 className="font-heading text-xl font-bold text-slate-900">
        Something went wrong
      </h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        An unexpected error occurred while rendering this page. You can try
        again or return to the dashboard.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button variant="secondary" size="md" onClick={() => reset()}>
          Try again
        </Button>
        <a href="/">
          <Button variant="primary" size="md">
            Back to Dashboard
          </Button>
        </a>
      </div>
    </div>
  );
}
