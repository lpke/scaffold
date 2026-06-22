import { Link } from 'react-router';

export default function Layout({ children }) {
  return (
    <>
      <header>
        <nav className="site-nav">
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <span className="site-label">React + Vite</span>
        </nav>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
