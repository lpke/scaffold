import { Link } from 'react-router';

export default function Layout({ children }) {
  return (
    <>
      <header>
        <nav className="flex gap-5 bg-blue-100 p-5">
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <span className="ml-auto font-bold">React + Vite</span>
        </nav>
      </header>
      <main className="p-5">{children}</main>
    </>
  );
}
