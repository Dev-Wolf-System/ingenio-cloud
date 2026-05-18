import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { JetBrains_Mono, Familjen_Grotesk, Onest } from 'next/font/google';
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

// Display — Familjen Grotesk (geométrica nórdica, alto carácter industrial)
const familjen = Familjen_Grotesk({
  subsets: ['latin'],
  variable: '--font-familjen',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Body — Onest (humanista moderna, excelente legibilidad pantalla)
const onest = Onest({
  subsets: ['latin'],
  variable: '--font-onest',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://ingcloud.srv878399.hstgr.cloud'),
  title: {
    default: 'Ingenio Cloud · Panel de Monitoreo de Turno',
    template: '%s · Ingenio Cloud',
  },
  description: 'Plataforma Inteligente de Monitoreo, Producción y Asistencia Operativa Industrial',
  icons: {
    icon: [{ url: '/logo-ingenio-cloud.png', sizes: 'any' }],
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
  themeColor: '#0d1218',
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
        className={`${geist.variable} ${geistMono.variable} ${jetbrainsMono.variable} ${familjen.variable} ${onest.variable} antialiased font-body`}
        style={{
          ['--font-display' as never]: 'var(--font-familjen)',
          ['--font-body' as never]: 'var(--font-onest)',
          ['--font-mono' as never]: 'var(--font-jetbrains-mono)',
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
