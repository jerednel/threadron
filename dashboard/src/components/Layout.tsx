import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded text-sm font-mono transition-colors ${
      isActive
        ? 'bg-[#1a1a1a] text-[#f0f0f0]'
        : 'text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#1a1a1a]'
    }`;

  const sidebarLinks = (
    <div className="space-y-1">
      <NavLink to="/" end className={navLinkClass} onClick={closeSidebar}>
        Board
      </NavLink>
      <NavLink to="/settings" className={navLinkClass} onClick={closeSidebar}>
        Settings
      </NavLink>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Top nav */}
      <header className="border-b border-[#2a2a2a] bg-[#0a0a0a] flex items-center justify-between px-4 md:px-6 h-12 shrink-0">
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="md:hidden text-[#8a8a8a] hover:text-[#f0f0f0] transition-colors cursor-pointer p-1 -ml-1"
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <rect y="2" width="18" height="2" rx="1"/>
              <rect y="8" width="18" height="2" rx="1"/>
              <rect y="14" width="18" height="2" rx="1"/>
            </svg>
          </button>
          <span className="font-mono text-sm font-bold text-[#f0f0f0] tracking-tight">
            threadron
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#8a8a8a] text-xs font-mono hidden sm:block">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-xs font-mono text-[#8a8a8a] hover:text-[#f0f0f0] transition-colors cursor-pointer border border-[#2a2a2a] px-3 py-1 rounded hover:border-[#4a4a4a]"
          >
            logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={closeSidebar}
          />
        )}

        {/* Mobile sidebar overlay */}
        <nav
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0a0a] border-r border-[#2a2a2a] flex flex-col py-4 px-3 transform transition-transform duration-200 md:hidden ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="font-mono text-xs text-[#4a4a4a] uppercase tracking-widest">Menu</span>
            <button
              onClick={closeSidebar}
              className="text-[#4a4a4a] hover:text-[#f0f0f0] transition-colors cursor-pointer text-lg leading-none"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          {sidebarLinks}
        </nav>

        {/* Desktop sidebar — always visible */}
        <nav className="hidden md:flex md:flex-col w-44 border-r border-[#2a2a2a] bg-[#0a0a0a] py-4 px-3 shrink-0">
          {sidebarLinks}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
