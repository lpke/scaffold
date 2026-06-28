import { Route, Routes } from 'react-router';
import Layout from '@/components/Layout';
import AboutPage from '@/routes/AboutPage';
import HomePage from '@/routes/HomePage';

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
