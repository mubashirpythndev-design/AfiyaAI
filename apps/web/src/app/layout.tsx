import CabinetReminders from "@/components/medicine/CabinetReminders";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import MarketplaceProvider from "@/components/marketplace/MarketplaceProvider";
import ScrollProgress from "@/components/shared/ScrollProgress";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoNastaliq = Noto_Nastaliq_Urdu({
  variable: "--font-urdu",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Afiya — Medicine Information & Price Comparison",
  description:
    "Medicine information, reference price comparisons, AI-assisted prescription scanning, and personal medicine cabinets and reminder schedules. Available in English, Urdu, and Roman Urdu.",
  keywords: ["medicine", "prescription", "OCR", "DRAP MRP", "price comparison", "Pakistan", "health", "Afiya AI"],
  icons: {
    icon: {url:"/afiya-favicon-6dad2394.ico",type:"image/x-icon"},
    shortcut: "/afiya-favicon-6dad2394.ico",
    apple: {url:"/afiya-apple-touch-icon-6dad2394.png",sizes:"180x180",type:"image/png"},
  },
};

import ClerkAuthSync from "@/components/auth/ClerkAuthSync";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${notoNastaliq.variable} h-full antialiased`}
      >
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    function isExtensionError(event) {
                      if (!event) return false;
                      var file = event.filename || '';
                      var stack = (event.error && event.error.stack) || '';
                      var msg = event.message || '';
                      return (
                        file.indexOf('chrome-extension://') !== -1 ||
                        file.indexOf('moz-extension://') !== -1 ||
                        file.indexOf('safari-extension://') !== -1 ||
                        stack.indexOf('chrome-extension://') !== -1 ||
                        stack.indexOf('moz-extension://') !== -1 ||
                        msg.indexOf('M_ID') !== -1 ||
                        msg.indexOf('bis_skin_checked') !== -1 ||
                        stack.indexOf('eppiocemhmnlbhjplcgkofciiegomcon') !== -1
                      );
                    }

                    window.addEventListener('error', function(event) {
                      if (isExtensionError(event)) {
                        event.stopImmediatePropagation();
                        event.preventDefault();
                        return true;
                      }
                    }, true);

                    window.addEventListener('unhandledrejection', function(event) {
                      var reason = event.reason || {};
                      var stack = reason.stack || '';
                      var msg = reason.message || '';
                      if (stack.indexOf('chrome-extension://') !== -1 || msg.indexOf('M_ID') !== -1) {
                        event.stopImmediatePropagation();
                        event.preventDefault();
                      }
                    }, true);

                    // Neutralize Bitdefender & extension injected attributes before React hydration
                    var observer = new MutationObserver(function(mutations) {
                      for (var i = 0; i < mutations.length; i++) {
                        var m = mutations[i];
                        if (m.type === 'attributes' && m.attributeName && m.attributeName.indexOf('bis_') === 0 && m.target) {
                          m.target.removeAttribute(m.attributeName);
                        }
                      }
                    });
                    observer.observe(document.documentElement, {
                      attributes: true,
                      subtree: true,
                    });
                  } catch (e) {}
                })();
              `,
            }}
          />
        </head>
        <body className="min-h-full flex flex-col" suppressHydrationWarning>
          <ScrollProgress/>
          <ClerkAuthSync /><CabinetReminders />
          <MarketplaceProvider>{children}</MarketplaceProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
