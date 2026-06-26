import '@/styles/globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'React + Next',
  description: 'Scaffolded React + Next App',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header>
          <nav className="flex gap-page bg-header p-page">
            <Link href="/">Home</Link>
            <Link href="/about">About</Link>
            <span className="ml-auto font-bold">React + Next</span>
          </nav>
        </header>

        <main className="p-page">{children}</main>
      </body>
    </html>
  );
}
