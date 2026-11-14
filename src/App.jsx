import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ui/ProtectedRoute.jsx';
import { NotFoundState } from './components/ui/LockedState.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import { shopNavigation, adminNavigation } from './config/navigation.js';
import PageLoader from './components/ui/PageLoader.jsx';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';

// Public pages
const LandingPage = lazy(() => import('./pages/public/LandingPage.jsx'));
const LoginPage = lazy(() => import('./pages/public/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/public/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/public/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/public/ResetPasswordPage.jsx'));
const AboutPage = lazy(() => import('./pages/public/AboutPage.jsx'));
const ContactPage = lazy(() => import('./pages/public/ContactPage.jsx'));
const TermsPage = lazy(() => import('./pages/public/TermsPage.jsx'));
const PrivacyPage = lazy(() => import('./pages/public/PrivacyPage.jsx'));
const RefundPolicyPage = lazy(() => import('./pages/public/RefundPolicyPage.jsx'));
const CookiePolicyPage = lazy(() => import('./pages/public/CookiePolicyPage.jsx'));

// Customer pages
const PrintPortal = lazy(() => import('./pages/customer/PrintPortal.jsx'));
const OrderTracking = lazy(() => import('./pages/customer/OrderTracking.jsx'));

// Shop pages
const ShopOverview = lazy(() => import('./pages/shop/ShopOverview.jsx'));
const ShopOrders = lazy(() => import('./pages/shop/ShopOrders.jsx'));
const ShopOrderDetail = lazy(() => import('./pages/shop/ShopOrderDetail.jsx'));
const ShopMachines = lazy(() => import('./pages/shop/ShopMachines.jsx'));
const ShopPricing = lazy(() => import('./pages/shop/ShopPricing.jsx'));
const ShopPayments = lazy(() => import('./pages/shop/ShopPayments.jsx'));
const ShopSubscription = lazy(() => import('./pages/shop/ShopSubscription.jsx'));
const ShopSettings = lazy(() => import('./pages/shop/ShopSettings.jsx'));
const ShopStaff = lazy(() => import('./pages/shop/ShopStaff.jsx'));
const ShopQrCodes = lazy(() => import('./pages/shop/ShopQrCodes.jsx'));
const ShopPrintQueue = lazy(() => import('./pages/shop/ShopPrintQueue.jsx'));
const ShopRevenue = lazy(() => import('./pages/shop/ShopRevenue.jsx'));
const ShopNotifications = lazy(() => import('./pages/shop/ShopNotifications.jsx'));

// Admin pages
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview.jsx'));
const AdminShops = lazy(() => import('./pages/admin/AdminShops.jsx'));
const AdminMachines = lazy(() => import('./pages/admin/AdminMachines.jsx'));
const AdminMachineDetail = lazy(() => import('./pages/admin/AdminMachineDetail.jsx'));
const AdminJobs = lazy(() => import('./pages/admin/AdminJobs.jsx'));
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions.jsx'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics.jsx'));
const AdminApprovals = lazy(() => import('./pages/admin/AdminApprovals.jsx'));
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAuditLogs.jsx'));
const AdminSupport = lazy(() => import('./pages/admin/AdminSupport.jsx'));
const AdminPlatformSettings = lazy(() => import('./pages/admin/AdminPlatformSettings.jsx'));

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />
          <Route path="/cookie-policy" element={<CookiePolicyPage />} />

          {/* Customer QR portal — public by design */}
          <Route path="/print/:machineId" element={<PrintPortal />} />
          <Route path="/order/:orderId" element={<OrderTracking />} />

          {/* Shop owner console */}
          <Route
            path="/shop"
            element={
              <ProtectedRoute role="shop">
                <DashboardLayout navigation={shopNavigation} title="orders" accent="Shop console" />
              </ProtectedRoute>
            }
          >
            <Route index element={<ShopOverview />} />
            <Route path="orders" element={<ShopOrders />} />
            <Route path="orders/:orderId" element={<ShopOrderDetail />} />
            <Route path="machines" element={<ShopMachines />} />
            <Route path="qr-codes" element={<ShopQrCodes />} />
            <Route path="print-queue" element={<ShopPrintQueue />} />
            <Route path="pricing" element={<ShopPricing />} />
            <Route path="revenue" element={<ShopRevenue />} />
            <Route path="payments" element={<ShopPayments />} />
            <Route path="subscription" element={<ShopSubscription />} />
            <Route path="staff" element={<ShopStaff />} />
            <Route path="notifications" element={<ShopNotifications />} />
            <Route path="settings" element={<ShopSettings />} />
          </Route>

          {/* Super admin console */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <DashboardLayout
                  navigation={adminNavigation}
                  title="platform"
                  accent="Admin console"
                />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="shops" element={<AdminShops />} />
            <Route path="approvals" element={<AdminApprovals />} />
            <Route path="machines" element={<AdminMachines />} />
            <Route path="machines/:machineId" element={<AdminMachineDetail />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="settings" element={<AdminPlatformSettings />} />
          </Route>

          <Route path="*" element={<NotFoundState />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
