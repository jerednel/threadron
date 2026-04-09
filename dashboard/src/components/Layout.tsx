import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Top nav */}
      <header className="border-b border-[#2a2a2a] bg-[#0a0a0a] flex items-center justify-between px-6 h-12 shrink-0">
        <span className="font-mono text-sm font-bold text-[#f0f0f0] tracking-tight">
          tasksforagents
        </span>
        <div className="flex items-center gap-4">
          <span className="text-[#8a8a8a] text-xs font-mono">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-xs font-mono text-[#8a8a8a] hover:text-[#f0f0f0] transition-colors cursor-pointer border border-[#2a2a2a] px-3 py-1 rounded hover:border-[#4a4a4a]"
          >
            logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <nav className="w-44 border-r border-[#2a2a2a] bg-[#0a0a0a] flex flex-col py-4 px-3 shrink-0">
          <div className="space-y-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm font-mono transition-colors ${
                  isActive
                    ? 'bg-[#1a1a1a] text-[#f0f0f0]'
                    : 'text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#1a1a1a]'
                }`
              }
            >
              Board
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm font-mono transition-colors ${
                  isActive
                    ? 'bg-[#1a1a1a] text-[#f0f0f0]'
                    : 'text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#1a1a1a]'
                }`
              }
            >
              Settings
            </NavLink>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
