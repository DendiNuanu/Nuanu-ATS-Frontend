import Link from "next/link";
import { Button } from "@/components/ui";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#e6f5f3]">
        <FileQuestion className="h-7 w-7 text-[#006b5f]" />
      </div>
      <p className="font-heading text-5xl font-bold text-slate-900">404</p>
      <h2 className="mt-2 font-heading text-xl font-bold text-slate-900">
        Page not found
      </h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className="mt-6">
        <Button variant="primary" size="md">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}
