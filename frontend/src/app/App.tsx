import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Home } from '../modules/dashboard/Home';
import { CategoryView } from '../modules/services/CategoryView';
import { Admin } from '../modules/admin/Admin';
import PrintsModule from '../pages/index';
import { CustomerUploadPortal } from '../pages/upload/CustomerUploadPortal';

function App() {
  const checkIsCustomerKiosk = () => {
    if (typeof window !== 'undefined') {
      const href = window.location.href.toLowerCase();
      const hostname = window.location.hostname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      return (
        hostname.includes('trycloudflare.com') ||
        hostname.includes('loca.lt') ||
        hostname.includes('tunnel') ||
        href.includes('kiosk=true') ||
        href.includes('mode=customer') ||
        hash === '#upload' ||
        hash === '#customer-scan' ||
        hash === '#customer-kiosk'
      );
    }
    return false;
  };

  const [isCustomerKiosk, setIsCustomerKiosk] = useState(checkIsCustomerKiosk);

  useEffect(() => {
    const handleNavigationChange = () => {
      setIsCustomerKiosk(checkIsCustomerKiosk());
    };
    window.addEventListener('hashchange', handleNavigationChange);
    window.addEventListener('popstate', handleNavigationChange);
    return () => {
      window.removeEventListener('hashchange', handleNavigationChange);
      window.removeEventListener('popstate', handleNavigationChange);
    };
  }, []);

  // PRODUCTION DEFECT FIX: Walk-in customers accessing via QR code on Shop Wi-Fi OR Mobile Data Tunnel see strictly ONLY the upload screen! All other pages and layout controls are completely removed.
  if (isCustomerKiosk) {
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans py-4 px-2 md:py-8" style={{ backgroundImage: 'radial-gradient(at 50% 10%, #171c35 0%, #070b14 85%)' }}>
        <CustomerUploadPortal isCustomerKiosk={true} />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="prints/*" element={<PrintsModule />} />
        <Route path="category/:categoryId" element={<CategoryView />} />
        <Route path="admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}

export default App;

