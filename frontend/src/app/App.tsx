import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Home } from '../modules/dashboard/Home';
import { CategoryView } from '../modules/services/CategoryView';
import { Admin } from '../modules/admin/Admin';
import PrintsModule from '../pages/index';
import { CustomerUploadPortal } from '../pages/upload/CustomerUploadPortal';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App render caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070b14] text-white p-6 flex flex-col items-center justify-center text-center space-y-4 font-sans">
          <h2 className="text-2xl font-black text-emerald-400">⚡ ಕಲ್ಪನ ಎಂಟರ್ಪ್ರೈಸಸ್ • Express Upload</h2>
          <p className="text-sm text-slate-300 max-w-md">The document upload portal encountered an error. Tap below to refresh.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl uppercase tracking-wider cursor-pointer shadow-lg"
          >
            🔄 Reload Upload Portal
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

  // Walk-in customers accessing via QR code see strictly ONLY the upload screen
  if (isCustomerKiosk) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans py-4 px-2 md:py-8" style={{ backgroundImage: 'radial-gradient(at 50% 10%, #171c35 0%, #070b14 85%)' }}>
          <CustomerUploadPortal isCustomerKiosk={true} />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="prints/*" element={<PrintsModule />} />
          <Route path="category/:categoryId" element={<CategoryView />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;

