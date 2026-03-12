import './globals.css';
import { Toaster as SonnerToaster } from 'sonner';
import { Poppins } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/ThemeToggle';

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} antialiased min-h-screen font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeToggle />
          {children}
          <SonnerToaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
