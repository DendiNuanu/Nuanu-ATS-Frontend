import type { Metadata } from "next";
import "./globals.css";
import { CandidateProvider } from "@/lib/candidate-store";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui";
import { SidebarProvider } from "@/lib/sidebar-context";

export const metadata: Metadata = {
  title: "Nuanu HR Recruitment ATS",
  description: "Recruitment applicant tracking system — UI/UX prototype preview.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      style={
        {
          "--font-inter":
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          "--font-plus-jakarta":
            '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        } as React.CSSProperties
      }
    >
      <body className="antialiased">
        <AuthProvider>
          <CandidateProvider>
            <ToastProvider>
              <SidebarProvider>{children}</SidebarProvider>
            </ToastProvider>
          </CandidateProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
