import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { JetBrains_Mono, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const geist = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Ingenio Cloud · Panel de Monitoreo',
    template: '%s · Ingenio Cloud',
  },
  description: 'Plataforma Inteligente de Monitoreo, Producción y Asistencia Operativa Industrial',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/logo-ingenio-cloud.png', sizes: 'any' },
    ],
    apple: '/logo-ingenio-cloud.png',
  },
  openGraph: {
    title: 'Ingenio Cloud',
    description: 'Plataforma Inteligente de Monitoreo, Producción y Asistencia Operativa Industrial',
    images: ['/portada-ingenio-cloud.png'],
    type: 'website',
    locale: 'es_AR',
  },
  applicationName: 'Ingenio Cloud',
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0a1018',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" suppressHydrationWarning data-theme="dark">
      <body
        className={`${geist.variable} ${geistMono.variable} ${jetbrainsMono.variable} ${bricolage.variable} antialiased font-body`}
        style={{
          ['--font-display' as never]: 'var(--font-bricolage)',
          ['--font-body' as never]: 'var(--font-geist-sans)',
          ['--font-mono' as never]: 'var(--font-jetbrains-mono)',
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
