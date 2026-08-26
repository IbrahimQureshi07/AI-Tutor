import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: BRAND.siteTitle,
    template: `%s · ${BRAND.shortName}`,
  },
  description: BRAND.siteDescription,
  applicationName: BRAND.shortName,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: BRAND.siteTitle,
    description: BRAND.siteDescription,
    siteName: BRAND.legalName,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: BRAND.siteTitle,
    description: BRAND.siteDescription,
  },
  icons: {
    icon: [{ url: "/brand/fa-mark.png", type: "image/png" }],
    apple: [{ url: "/brand/fa-mark.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              className: "!bg-surface !text-ink !border-border !shadow-soft",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
