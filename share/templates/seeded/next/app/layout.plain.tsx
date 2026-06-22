import type { Metadata } from 'next';
import '@/styles/globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'React + Next',
  description: 'Scaffolded React + Next App',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header>
            <nav className="site-nav">
              <Link href="/">Home</Link>
              <Link href="/about">About</Link>
              <span className="site-label">React + Next</span>
            </nav>
          </header>

          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
