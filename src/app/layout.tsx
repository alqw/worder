import './globals.css';
import { Toaster as SonnerToaster } from 'sonner';
import { Poppins } from 'next/font/google';

const poppins = Poppins({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-sans',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} antialiased min-h-screen font-sans`}>
        {children}
        <SonnerToaster richColors position="top-center" />
      </body>
    </html>
  );
}
