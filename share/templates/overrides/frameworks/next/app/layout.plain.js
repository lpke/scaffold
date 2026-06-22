import '@/styles/globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'React + Next',
  description: 'Scaffolded React + Next App',
};

export default function RootLayout({ children }) {
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
