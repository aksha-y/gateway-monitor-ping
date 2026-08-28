"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from 'next/link';
import { LayoutDashboard, Server, Settings, UploadCloud, Clock, AlertTriangle, Bell, LogOut, Shield } from 'lucide-react';

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const isLoginPage = pathname === '/login';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch(e) {}
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <Shield size={24} style={{ color: 'var(--primary)' }} />
          <span>UniFi Monitor</span>
        </div>
        <nav className="nav">
          <Link href="/" className="nav-item">
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link href="/properties" className="nav-item">
            <Server size={20} />
            Properties
          </Link>
          <Link href="/import" className="nav-item">
            <UploadCloud size={20} />
            Bulk Import
          </Link>
          <Link href="/history" className="nav-item">
            <Clock size={20} />
            History
          </Link>
          <Link href="/outages" className="nav-item">
            <AlertTriangle size={20} />
            Outages
          </Link>
          <Link href="/audit" className="nav-item">
            <Shield size={20} />
            Audit Log
          </Link>
          <div className="nav-item" style={{ opacity: 0.5, cursor: 'not-allowed' }} title="Coming in a future phase">
            <Bell size={20} />
            Notifications
          </div>
          <Link href="/settings" className="nav-item">
            <Settings size={20} />
            Settings
          </Link>
        </nav>
        
        <div style={{ marginTop: 'auto', padding: '16px' }}>
          <button onClick={handleLogout} className="btn btn-outline" style={{ width: '100%', borderColor: 'transparent', color: 'var(--muted)' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
