import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SwapPage from './pages/SwapPage';
import PaymentPage from './pages/PaymentPage';
import OrderStatusPage from './pages/OrderStatusPage';
import ClosedPage from './pages/ClosedPage';
import HowItWorksPage from './pages/HowItWorksPage';
import OrderHistoryPage from './pages/OrderHistoryPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/swap" element={<SwapPage />} />
        <Route path="/pay/:reference" element={<PaymentPage />} />
        <Route path="/order/:reference" element={<OrderStatusPage />} />
        <Route path="/closed" element={<ClosedPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/orders" element={<OrderHistoryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
