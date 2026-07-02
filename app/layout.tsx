import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { CandidateProvider } from "@/lib/candidate-store";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui";
import { SidebarProvider } from "@/lib/sidebar-context";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

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
    <html lang="en" className={`${plusJakarta.variable} ${inter.variable}`}>
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
