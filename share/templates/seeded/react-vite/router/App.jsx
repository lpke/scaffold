import { Route, Routes } from 'react-router';
import Layout from './components/Layout';
import HomePage from './routes/HomePage';
import AboutPage from './routes/AboutPage';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Layout>
  );
}
