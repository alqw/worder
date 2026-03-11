import { Toaster as SonnerToaster } from 'sonner';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
        <SonnerToaster richColors position="top-center" />
      </body>
    </html>
  );
}
