import { Routes, Route, useNavigate, useLocation, Navigate, Outlet } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { LayoutDashboard, Link, FileSearch, Shield, UserCog, FileText, TrendingUp, Database, Key } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import RpcPool from './pages/RpcPool';
import Events from './pages/Events';
import System from './pages/System';
import Users from './pages/Users';
import Audit from './pages/Audit';
import OkxAccounts from './pages/OkxAccounts';
import MarketData from './pages/MarketData';
import ApiKeys from './pages/ApiKeys';
import Login from './Login';
import { api } from './lib';

interface AuthCtxType { authed: boolean; setAuthed: (v: boolean) => void; }
export const AuthCtx = createContext<AuthCtxType>({ authed: false, setAuthed: () => {} });
export const useAuth = () => useContext(AuthCtx);

const NAV = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/rpc', label: 'RPC Pool', icon: Link },
  { path: '/events', label: 'Events', icon: FileSearch },
  { path: '/users', label: 'Users', icon: UserCog },
  { path: '/audit', label: 'Audit Log', icon: FileText },
  { path: '/system', label: 'System', icon: Shield },
  { path: '/okx', label: 'OKX Accounts', icon: Database },
  { path: '/market', label: 'Market Data', icon: TrendingUp },
  { path: '/api-keys', label: 'API Keys', icon: Key },
];

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthed } = useAuth();

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const logout = async () => {
    await fetch('/api/v2/admin/logout', { method: 'POST', credentials: 'same-origin' });
    setAuthed(false);
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⛓️</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e5e7eb' }}>PocketX</div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>Collector Admin</div>
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(item => (
          <button key={item.path} className={`sidebar-item ${isActive(item.path, item.exact) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}>
            <item.icon size={18} />{item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 500 }}>Admin</div>
        <div style={{ fontSize: 11, color: 'var(--dim)' }}>admin@pocketx.io</div>
        <button onClick={logout} style={{ marginTop: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--dim)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Logout</button>
      </div>
    </aside>
  );
}

function AuthedLayout() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/rpc" element={<RpcPool />} />
          <Route path="/events" element={<Events />} />
          <Route path="/users" element={<Users />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/system" element={<System />} />
          <Route path="/okx" element={<OkxAccounts />} />
          <Route path="/market" element={<MarketData />} />
          <Route path="/api-keys" element={<ApiKeys />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authed, setAuthed } = useAuth();
  const [loading, setLoading] = useState(!authed);

  useEffect(() => {
    if (authed) { setLoading(false); return; }
    api('/admin/dashboard')
      .then(() => { setAuthed(true); setLoading(false); })
      .catch(() => { setAuthed(false); setLoading(false); });
  }, []);

  if (loading) return <div className="loading"><span className="spin" />Loading...</div>;
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const [authed, setAuthed] = useState(false);

  return (
    <AuthCtx.Provider value={{ authed, setAuthed }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<RequireAuth><AuthedLayout /></RequireAuth>} />
      </Routes>
    </AuthCtx.Provider>
  );
}
