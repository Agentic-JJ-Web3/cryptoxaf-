import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SwapPage from './pages/SwapPage';
import PaymentPage from './pages/PaymentPage';
import OrderStatusPage from './pages/OrderStatusPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/swap" element={<SwapPage />} />
        <Route path="/pay/:reference" element={<PaymentPage />} />
        <Route path="/order/:reference" element={<OrderStatusPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
