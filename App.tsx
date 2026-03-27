
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/Auth';
import { AdminDashboard, AdminUsers, AdminProducts, AdminSettings, AdminOrders } from './pages/Admin';
import { Catalog, Cart, MyOrders, MyClients, Profile } from './pages/Shop';
import { AdminLayout, ShopLayout } from './components/Layout';
import { User, Product, CartItem, AppSettings, Role } from './types';
import { db, getToken, removeToken } from './services/db';

interface AppContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
  isLoading: boolean;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);

// Helper: verifica se o usuário tem acesso a uma área
const hasAccess = (user: User | null, area: 'admin' | 'catalog'): boolean => {
  if (!user) return false;
  if (user.role === Role.ADMIN) return true;
  if (area === 'catalog') return true;
  if (area === 'admin') {
    return user.role === Role.RESELLER && (user.permissions || []).includes('admin_panel');
  }
  return false;
};

const ProtectedRoute = ({ children, area }: { children?: ReactNode; area?: 'admin' | 'catalog' }) => {
  const { user, isLoading } = React.useContext(AppContext);
  const location = useLocation();

  if (isLoading) return null;

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (area && !hasAccess(user, area)) {
    const defaultRoute = hasAccess(user, 'admin') ? '/admin/dashboard' : '/catalogo';
    return <Navigate to={defaultRoute} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>({
    primaryColor: '#fc5200',
    secondaryColor: '#1e293b',
    companyName: 'MWE',
    footerText: 'MWE Comércio e Distribuidora de Autopeças © 2026. Todos os direitos reservados.',
    logoUrl: 'https://mwedistribuidora.com.br/wp-content/uploads/2024/03/mwe-preto.png',
    faviconUrl: '',
    supportEmail: 'contato@mwedistribuidora.com.br',
    supportPhone: '+55 11 93923-6169',
    instagramUrl: 'https://www.instagram.com/qualykits/',
    linkedinUrl: '',
    facebookUrl: 'https://www.facebook.com/profile.php?id=61583188140686',
    youtubeUrl: '',
    tiktokUrl: '',
    websiteUrl: '',
    customAddress: ''
  });

  useEffect(() => {
    const initApp = async () => {
      try {
        // Verificar se há token salvo
        const token = getToken();
        const savedUserJson = localStorage.getItem('session_user');

        if (token && savedUserJson) {
          const parsedUser = JSON.parse(savedUserJson);
          setUser(parsedUser);
          // Restaurar carrinho do usuário
          try {
            const savedCart = localStorage.getItem(`cart_${parsedUser.id}`);
            if (savedCart) setCart(JSON.parse(savedCart));
          } catch (e) { /* ignore */ }
        }

        // Carregar settings (endpoint público - branding na tela de login)
        try {
          const savedSettings = await db.getSettings();
          setSettings(savedSettings);
        } catch (e) {
          console.warn('Erro ao carregar configurações, usando defaults');
        }
      } catch (e) {
        console.error("Erro ao inicializar app:", e);
      } finally {
        setIsLoading(false);
      }
    };
    initApp();
  }, []);

  // Verificação periódica: deslogar se acesso revogado (a cada 60 segundos)
  useEffect(() => {
    if (!user || isLoading) return;
    if (user.role === Role.ADMIN) return;

    const checkSession = async () => {
      try {
        const result = await db.checkUserSession(user.id);
        if (!result.valid) {
          logout();
        }
      } catch (e) {
        console.warn('Erro ao verificar sessão:', e);
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 60000); // 60 segundos (era 30)
    return () => clearInterval(interval);
  }, [user, isLoading]);

  const login = (userData: User) => {
    setUser(userData);
    // Salvar apenas dados não sensíveis
    const safeUser = { ...userData };
    delete safeUser.password;
    localStorage.setItem('session_user', JSON.stringify(safeUser));
    // Restaurar carrinho
    try {
      const savedCart = localStorage.getItem(`cart_${userData.id}`);
      if (savedCart) setCart(JSON.parse(savedCart));
    } catch (e) { /* ignore */ }

    // Carregar settings após login
    db.getSettings().then(s => setSettings(s)).catch(() => {});
  };

  const logout = () => {
    if (user && cart.length > 0) {
      localStorage.setItem(`cart_${user.id}`, JSON.stringify(cart));
    }
    setUser(null);
    setCart([]);
    removeToken();
    localStorage.removeItem('session_user');
    sessionStorage.removeItem('dismissedBannerUrl');
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i);
      return [...prev, { ...product, quantity }];
    });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));
  const updateQuantity = (id: string, qty: number) => setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, qty) } : i));
  const clearCart = () => {
    setCart([]);
    if (user) localStorage.removeItem(`cart_${user.id}`);
  };

  // Persistir carrinho sempre que mudar
  useEffect(() => {
    if (user && cart.length > 0) {
      localStorage.setItem(`cart_${user.id}`, JSON.stringify(cart));
    }
  }, [cart, user]);

  const updateSettings = async (newSettings: AppSettings) => {
    const saved = await db.saveSettings(newSettings);
    setSettings(saved);
  };

  useEffect(() => {
    if (!isLoading) {
      document.documentElement.style.setProperty('--color-primary', settings.primaryColor);
      document.documentElement.style.setProperty('--color-secondary', settings.secondaryColor);
      document.title = settings.companyName || 'Catálogo Online';

      const iconToUse = settings.faviconUrl || settings.logoUrl;
      if (iconToUse) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = iconToUse;
      }
    }
  }, [settings, isLoading]);

  return (
    <AppContext.Provider value={{ user, login, logout, cart, addToCart, removeFromCart, updateQuantity, clearCart, settings, updateSettings, isLoading }}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin/*" element={<ProtectedRoute area="admin"><AdminLayout><Routes><Route path="dashboard" element={<AdminDashboard />} /><Route path="users" element={<AdminUsers />} /><Route path="products" element={<AdminProducts />} /><Route path="orders" element={<AdminOrders />} /><Route path="settings" element={<AdminSettings />} /><Route path="*" element={<Navigate to="dashboard" />} /></Routes></AdminLayout></ProtectedRoute>} />
          <Route path="/*" element={<ProtectedRoute area="catalog"><ShopLayout><Routes><Route path="catalogo" element={<Catalog />} /><Route path="carrinho" element={<Cart />} /><Route path="pedidos" element={<MyOrders />} /><Route path="clientes" element={<MyClients />} /><Route path="perfil" element={<Profile />} /><Route path="*" element={<Navigate to="catalogo" />} /></Routes></ShopLayout></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
};
export default App;
