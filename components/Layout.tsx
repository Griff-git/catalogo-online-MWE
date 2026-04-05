
import React, { useContext, useState, useRef, useEffect, useCallback } from 'react';
import { AppContext } from '../App';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Users, Package, Settings, ShoppingCart, User, ChevronDown, ClipboardList, UserCircle, Instagram, Linkedin, MessageCircle, Mail, Phone, Facebook, Youtube, Play, Menu, X, Globe, Store, Shield, Briefcase, Moon, Sun } from 'lucide-react';
import { createPortal } from 'react-dom';
import { db } from '../services/db';
import { UserStatus, Role } from '../types';

// Transição simples entre Admin e Catálogo
const usePageTransition = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionIcon, setTransitionIcon] = useState<React.ReactNode>(null);
  const navigate = useNavigate();

  const navigateWithTransition = useCallback((to: string, icon?: React.ReactNode) => {
    setTransitionIcon(icon || null);
    setIsTransitioning(true);
    setTimeout(() => {
      navigate(to);
      setTimeout(() => setIsTransitioning(false), 600);
    }, 700);
  }, [navigate]);

  const TransitionOverlay = () => createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-white pointer-events-none flex items-center justify-center"
      style={{
        opacity: isTransitioning ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}
    >
      {transitionIcon && (
        <div
          className="text-gray-200"
          style={{
            opacity: isTransitioning ? 1 : 0,
            transform: isTransitioning ? 'scale(1)' : 'scale(0.8)',
            transition: 'all 0.6s ease 0.1s',
          }}
        >
          {transitionIcon}
        </div>
      )}
    </div>,
    document.body
  );

  return { navigateWithTransition, TransitionOverlay };
};

interface LayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<LayoutProps> = ({ children }) => {
  const { logout, settings, user } = useContext(AppContext);
  const location = useLocation();
  const [pendingCounts, setPendingCounts] = useState({ users: 0, orders: 0 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { navigateWithTransition, TransitionOverlay } = usePageTransition();

  // Atualiza as contagens de pendências
  useEffect(() => {
    const updateCounts = async () => {
      const users = await db.getUsers();
      const pendingUsersCount = users.filter(u => u.status === UserStatus.PENDING).length;

      const orders = await db.getOrders();
      const pendingOrdersCount = orders.filter(o => o.status === 'PENDING').length;

      setPendingCounts({ users: pendingUsersCount, orders: pendingOrdersCount });
    };

    updateCounts();
    const interval = setInterval(updateCounts, 60000); // Verifica a cada 60 segundos
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Usuários', path: '/admin/users', icon: Users, hasNotification: pendingCounts.users > 0 },
    { label: 'Produtos', path: '/admin/products', icon: Package },
    { label: 'Pedidos', path: '/admin/orders', icon: ClipboardList, hasNotification: pendingCounts.orders > 0 },
    { label: 'Configurações', path: '/admin/settings', icon: Settings },
  ];

  return (
    <>
    <TransitionOverlay />
    <div className="flex bg-gray-50 min-h-screen">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200
        transform transition-transform duration-300 ease-in-out md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-8 object-contain" />
          ) : (
            <span className="text-xl font-bold" style={{ color: settings.primaryColor }}>{settings.companyName.split(' ')[0]} Admin</span>
          )}
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400">
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${isActive ? 'bg-gray-50' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                style={isActive ? { color: settings.primaryColor, backgroundColor: `${settings.primaryColor}10` } : {}}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} /> {item.label}
                </div>
                {item.hasNotification && (
                  <span className="flex h-2 w-2 rounded-full bg-red-500 ring-4 ring-red-50"></span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-100 space-y-1">
          <button
            onClick={() => { setIsSidebarOpen(false); navigateWithTransition('/catalogo', <Store size={48} />); }}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 w-full transition-colors"
          >
            <Store size={18} /> Ir para o Catálogo
          </button>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 w-full transition-colors"><LogOut size={18} /> Sair</button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64 min-h-screen w-full max-w-[100vw]">
        {/* Mobile Header for Sidebar Toggle */}
        <header className="md:hidden bg-white h-16 border-b border-gray-200 flex items-center px-4 sticky top-0 z-30 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-600">
            <Menu size={24} />
          </button>
          <span className="ml-3 font-bold text-gray-900">Menu</span>
        </header>

        <main className="flex-1 p-4 md:p-8 w-full">
          {children}
        </main>
      </div>
    </div>
    </>
  );
};

export const ShopLayout: React.FC<LayoutProps> = ({ children }) => {
  const { logout, cart, settings, user } = useContext(AppContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasPendingOrders, setHasPendingOrders] = useState(false);
  const { navigateWithTransition, TransitionOverlay } = usePageTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  // Dark mode
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const checkPending = async () => {
      if (user) {
        const orders = await db.getOrders();
        const pending = orders.some(o => o.userId === user.id && o.status === 'PENDING');
        setHasPendingOrders(pending);
      }
    };
    checkPending();
    const interval = setInterval(checkPending, 10000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
    <TransitionOverlay />
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
          <Link to="/catalogo" className="flex items-center gap-2 group flex-shrink-0">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-8 md:h-10 object-contain" />
            ) : (
              <div className="flex flex-col">
                <span className="text-lg md:text-xl font-black tracking-tighter uppercase leading-none" style={{ color: settings.primaryColor }}>
                  {settings.companyName}
                </span>
                <span className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Acesso Exclusivo</span>
              </div>
            )}
          </Link>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 md:p-3 text-gray-500 hover:bg-gray-100 rounded-2xl transition-all active:scale-95"
              title={isDark ? 'Modo Claro' : 'Modo Escuro'}
            >
              {isDark ? <Sun size={22} className="md:w-6 md:h-6 text-amber-400" /> : <Moon size={22} className="md:w-6 md:h-6" />}
            </button>

            {/* Ícone do Carrinho */}
            <Link
              to="/carrinho"
              className="relative p-2 md:p-3 text-gray-500 hover:bg-gray-100 rounded-2xl transition-all active:scale-95"
            >
              <ShoppingCart size={22} className="md:w-6 md:h-6" />
              {cart.length > 0 && (
                <span className="absolute top-1 md:top-1.5 right-1 md:right-1.5 inline-flex items-center justify-center w-4 h-4 md:w-5 md:h-5 text-[9px] md:text-[10px] font-black text-white transform rounded-full ring-2 ring-white animate-in fade-in zoom-in" style={{ backgroundColor: settings.primaryColor }}>
                  {cart.length}
                </span>
              )}
            </Link>

            {/* Ícone Minha Conta com Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`flex items-center gap-3 p-1 md:p-1.5 pr-2 md:pr-4 pl-1 md:pl-1.5 border border-gray-200 rounded-full md:rounded-2xl transition-all active:scale-[0.98] ${isMenuOpen ? 'bg-gray-50 border-gray-300 ring-4 ring-gray-100' : 'bg-white hover:border-gray-300 shadow-sm'}`}
              >
                <div className="relative">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-900 rounded-full md:rounded-xl flex items-center justify-center text-white shadow-lg shadow-gray-200">
                    <User size={18} className="md:w-5 md:h-5" />
                  </div>
                  {hasPendingOrders && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3 rounded-full bg-yellow-500 ring-2 ring-white"></span>
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{user?.role === 'RESELLER' ? 'Revendedor' : 'Minha Conta'}</p>
                  <p className="text-xs font-bold text-gray-900 truncate max-w-[120px]">{user?.storeName}</p>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform duration-300 hidden sm:block ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-4 w-72 bg-white rounded-[1rem] shadow-2xl border border-gray-100 py-4 z-[60] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <div className="px-6 py-4 border-b border-gray-50 mb-2">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl" style={{ backgroundColor: `${settings.primaryColor}15`, color: settings.primaryColor }}>
                        {user?.storeName.charAt(0)}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-black text-gray-900 text-sm leading-none mb-1 truncate">{user?.storeName}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{user?.cnpj}</p>
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-2 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-black text-green-700 uppercase">Acesso Liberado</span>
                    </div>
                  </div>

                  <div className="px-2 space-y-1">
                    {/* Link para Painel Admin (visível apenas para Admin e Revendedores com permissão) */}
                    {user && (user.role === Role.ADMIN || (user.role === Role.RESELLER && (user.permissions || []).includes('admin_panel'))) && (
                      <button
                        onClick={() => { setIsMenuOpen(false); navigateWithTransition('/admin/dashboard', <Shield size={48} />); }}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-xl transition-all group w-full"
                        style={{ '--hover-color': settings.primaryColor } as any}
                      >
                        <Shield size={18} className="text-gray-400 group-hover:text-[var(--hover-color)]" />
                        <span className="group-hover:text-[var(--hover-color)]">Painel Admin</span>
                      </button>
                    )}

                    <Link
                      to="/perfil"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-xl transition-all group"
                      style={{ '--hover-color': settings.primaryColor } as any}
                    >
                      <UserCircle size={18} className="text-gray-400 group-hover:text-[var(--hover-color)]" />
                      <span className="group-hover:text-[var(--hover-color)]">Minhas Informações</span>
                    </Link>

                    <Link
                      to="/pedidos"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-xl transition-all group"
                      style={{ '--hover-color': settings.primaryColor } as any}
                    >
                      <div className="flex items-center gap-3">
                        <ClipboardList size={18} className="text-gray-400 group-hover:text-[var(--hover-color)]" />
                        <span className="group-hover:text-[var(--hover-color)]">Meus Pedidos</span>
                      </div>
                      {hasPendingOrders && (
                        <span className="flex h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></span>
                      )}
                    </Link>

                    {/* Link Meus Clientes (visível apenas para Revendedores) */}
                    {user && user.role === Role.RESELLER && (
                      <Link
                        to="/clientes"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-xl transition-all group"
                        style={{ '--hover-color': settings.primaryColor } as any}
                      >
                        <Briefcase size={18} className="text-gray-400 group-hover:text-[var(--hover-color)]" />
                        <span className="group-hover:text-[var(--hover-color)]">Meus Clientes</span>
                      </Link>
                    )}
                  </div>

                  <div className="my-3 border-t border-gray-50 mx-4"></div>

                  <div className="px-2">
                    <button
                      onClick={() => { setIsMenuOpen(false); logout(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <LogOut size={18} /> Sair da Conta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 pb-24 md:pb-10">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-100 pt-10 md:pt-16 pb-8 md:pb-12 mt-auto hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-8 md:mb-12 text-center md:text-left">
            {/* Coluna 1: Empresa */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Institucional</h4>
              <p className="text-sm font-bold text-gray-900">{settings.companyName}</p>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">{settings.customAddress || 'Endereço não configurado'}</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
                {settings.websiteUrl && (
                  <a href={settings.websiteUrl} target="_blank" rel="noopener" className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-white transition-all hover:bg-[var(--primary)]" style={{ '--primary': settings.primaryColor } as any}>
                    <Globe size={18} />
                  </a>
                )}
                {settings.instagramUrl && (
                  <a href={settings.instagramUrl} target="_blank" rel="noopener" className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-white transition-all hover:bg-[var(--primary)]" style={{ '--primary': settings.primaryColor } as any}>
                    <Instagram size={18} />
                  </a>
                )}
                {settings.facebookUrl && (
                  <a href={settings.facebookUrl} target="_blank" rel="noopener" className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-white transition-all hover:bg-[var(--primary)]" style={{ '--primary': settings.primaryColor } as any}>
                    <Facebook size={18} />
                  </a>
                )}
                {settings.youtubeUrl && (
                  <a href={settings.youtubeUrl} target="_blank" rel="noopener" className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-white transition-all hover:bg-[var(--primary)]" style={{ '--primary': settings.primaryColor } as any}>
                    <Youtube size={18} />
                  </a>
                )}
                {settings.tiktokUrl && (
                  <a href={settings.tiktokUrl} target="_blank" rel="noopener" className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-white transition-all hover:bg-[var(--primary)]" style={{ '--primary': settings.primaryColor } as any}>
                    <Play size={18} />
                  </a>
                )}
                {settings.linkedinUrl && (
                  <a href={settings.linkedinUrl} target="_blank" rel="noopener" className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-white transition-all hover:bg-[var(--primary)]" style={{ '--primary': settings.primaryColor } as any}>
                    <Linkedin size={18} />
                  </a>
                )}
              </div>
            </div>

            {/* Coluna 2: Atendimento */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Canais de Suporte</h4>
              <div className="space-y-3 flex flex-col items-center md:items-start">
                {settings.supportPhone && (
                  <a href={`https://wa.me/${settings.supportPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="flex items-center gap-3 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-all">
                      <MessageCircle size={16} />
                    </div>
                    {settings.supportPhone}
                  </a>
                )}
                {settings.supportEmail && (
                  <a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-3 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <Mail size={16} />
                    </div>
                    {settings.supportEmail}
                  </a>
                )}
              </div>
            </div>

            {/* Coluna 3: Atalhos */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Links Úteis</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/catalogo" className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">Catálogo de Peças</Link>
                <Link to="/pedidos" className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">Meus Pedidos</Link>
                <Link to="/perfil" className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">Dados Cadastrais</Link>
              </nav>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-50 text-center">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em]">{settings.footerText}</p>
          </div>
        </div>
      </footer>
      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 md:hidden safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          <Link
            to="/catalogo"
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${location.pathname === '/catalogo' ? '' : 'text-gray-400'}`}
            style={location.pathname === '/catalogo' ? { color: settings.primaryColor } : {}}
          >
            <Package size={20} />
            <span className="text-[9px] font-black uppercase tracking-wider">Catálogo</span>
          </Link>
          <Link
            to="/pedidos"
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors relative ${location.pathname === '/pedidos' ? '' : 'text-gray-400'}`}
            style={location.pathname === '/pedidos' ? { color: settings.primaryColor } : {}}
          >
            <ClipboardList size={20} />
            <span className="text-[9px] font-black uppercase tracking-wider">Pedidos</span>
            {hasPendingOrders && (
              <span className="absolute top-1.5 right-1/2 translate-x-4 flex h-2 w-2 rounded-full bg-amber-500"></span>
            )}
          </Link>
          {/* Meus Clientes (Reseller only) */}
          {user?.role === Role.RESELLER && (
            <Link
              to="/clientes"
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${location.pathname === '/clientes' ? '' : 'text-gray-400'}`}
              style={location.pathname === '/clientes' ? { color: settings.primaryColor } : {}}
            >
              <Briefcase size={20} />
              <span className="text-[9px] font-black uppercase tracking-wider">Clientes</span>
            </Link>
          )}
          <Link
            to="/carrinho"
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors relative ${location.pathname === '/carrinho' ? '' : 'text-gray-400'}`}
            style={location.pathname === '/carrinho' ? { color: settings.primaryColor } : {}}
          >
            <ShoppingCart size={20} />
            <span className="text-[9px] font-black uppercase tracking-wider">Carrinho</span>
            {cart.length > 0 && (
              <span className="absolute top-1 right-1/2 translate-x-5 inline-flex items-center justify-center w-4 h-4 text-[8px] font-black text-white rounded-full" style={{ backgroundColor: settings.primaryColor }}>
                {cart.length}
              </span>
            )}
          </Link>
          <Link
            to="/perfil"
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${location.pathname === '/perfil' ? '' : 'text-gray-400'}`}
            style={location.pathname === '/perfil' ? { color: settings.primaryColor } : {}}
          >
            <User size={20} />
            <span className="text-[9px] font-black uppercase tracking-wider">Perfil</span>
          </Link>
        </div>
      </nav>
    </div>
    </>
  );
};
