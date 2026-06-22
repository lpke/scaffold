import { Link, Route, Routes } from 'react-router';

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <main>
            <h1>Hello from scaffold</h1>
            <Link to="/about">About</Link>
          </main>
        }
      />
      <Route
        path="/about"
        element={
          <main>
            <h1>About</h1>
            <Link to="/">Home</Link>
          </main>
        }
      />
    </Routes>
  );
}
