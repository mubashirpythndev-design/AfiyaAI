import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";

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
  title: "Afiya AI - Your Intelligent Medicine Assistant",
  description:
    "AI-powered medicine assistant that extracts medicine names from prescriptions, provides verified information, and compares prices. Available in English, Urdu, and Roman Urdu.",
  keywords: ["medicine", "prescription", "OCR", "price comparison", "Pakistan", "health"],
  icons: {
    icon: "/Afiya_icon.ico",
    shortcut: "/Afiya_icon.ico",
    apple: "/Afiya_icon.ico",
  },
};

import CustomCursor from "@/components/shared/CustomCursor";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
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
                  // Suppress third-party Chrome/browser extension script errors from triggering Next.js dev overlay
                  window.addEventListener('error', function(event) {
                    if (event.filename && (event.filename.indexOf('chrome-extension://') !== -1 || event.filename.indexOf('moz-extension://') !== -1)) {
                      event.stopImmediatePropagation();
                      event.preventDefault();
                    }
                  }, true);

                  // Neutralize Bitdefender & extension injected attributes before React hydration
                  var observer = new MutationObserver(function(mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                      var m = mutations[i];
                      if (m.type === 'attributes' && m.attributeName === 'bis_skin_checked' && m.target) {
                        m.target.removeAttribute('bis_skin_checked');
                      }
                    }
                  });
                  observer.observe(document.documentElement, {
                    attributes: true,
                    subtree: true,
                    attributeFilter: ['bis_skin_checked']
                  });
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
