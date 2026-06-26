import { Link } from 'react-router';

export default function Layout({ children }) {
  return (
    <>
      <header>
        <nav className="flex gap-page bg-header p-page">
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <span className="ml-auto font-bold">React + Vite</span>
        </nav>
      </header>
      <main className="p-page">{children}</main>
    </>
  );
}
