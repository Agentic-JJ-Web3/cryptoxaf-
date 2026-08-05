import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminAuthProvider, RequireAdminAuth } from './AdminAuthContext';
import AdminLayout from '../components/AdminLayout';
import AdminLoginPage from '../pages/admin/AdminLoginPage';
import AdminQueuePage from '../pages/admin/AdminQueuePage';
import AdminOrderDetailPage from '../pages/admin/AdminOrderDetailPage';
import AdminSettingsPage from '../pages/admin/AdminSettingsPage';
import AdminNotifyPage from '../pages/admin/AdminNotifyPage';
import AdminReviewsPage from '../pages/admin/AdminReviewsPage';

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLoginPage />} />
        <Route
          element={
            <RequireAdminAuth>
              <AdminLayout />
            </RequireAdminAuth>
          }
        >
          <Route path="queue" element={<AdminQueuePage />} />
          <Route path="orders/:reference" element={<AdminOrderDetailPage />} />
          <Route path="notify-requests" element={<AdminNotifyPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route index element={<Navigate to="queue" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="queue" replace />} />
      </Routes>
    </AdminAuthProvider>
  );
}
