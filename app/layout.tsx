import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import '@/src/app/globals.css';
import Navbar from '@/components/Navbar';
import PWARegistration from '@/components/PWARegistration';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'ResQNet — Disaster SOS Platform',
  description: 'Real-time disaster SOS and volunteer coordination',
  manifest: '/manifest.json',
  other: {
    'theme-color': '#ef4444',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/auth/login"
      signUpUrl="/auth/signup"
      signInForceRedirectUrl="/user-type"
      signUpForceRedirectUrl="/user-type"
    >
      <html lang="en">
        <head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#ef4444" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        </head>
        <body className={`${inter.className} bg-black text-white min-h-screen`}>
          <PWARegistration />
          <Navbar />
          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
