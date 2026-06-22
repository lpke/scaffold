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
          <nav className="flex gap-5 bg-gray-200 p-5">
            <Link href="/">Home</Link>
            <Link href="/about">About</Link>
            <span className="ml-auto font-bold">React + Next</span>
          </nav>
        </header>

        <main className="p-5">{children}</main>
      </body>
    </html>
  );
}
