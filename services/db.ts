import { User, Product, Order, AppSettings, Role, UserStatus, ResellerClient } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// ============================================================
// TOKEN MANAGEMENT
// ============================================================
const TOKEN_KEY = 'auth_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export { getToken, setToken, removeToken };

// ============================================================
// INTERFACES
// ============================================================
interface LoginResponse {
  token: string;
  user: User;
}

interface IDatabase {
  login(email: string, password: string): Promise<LoginResponse>;
  register(user: Partial<User> & { password: string }): Promise<{ success: boolean; message: string }>;
  requestPasswordReset(email: string): Promise<{ success: boolean; message: string }>;
  resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }>;
  getUsers(): Promise<User[]>;
  saveUser(user: User): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getProducts(): Promise<Product[]>;
  saveProduct(product: Product): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  replaceProducts(products: Product[], onProgress?: (percent: number) => void): Promise<void>;
  getOrders(): Promise<Order[]>;
  createOrder(order: Order): Promise<Order>;
  updateOrder(order: Order): Promise<Order>;
  deleteOrder(id: string): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
  uploadImage(file: File): Promise<string>;
  checkUserSession(userId: string): Promise<{ valid: boolean, status: string }>;
  getResellerClients(resellerId: string): Promise<ResellerClient[]>;
  getAllResellerClients(): Promise<ResellerClient[]>;
  saveResellerClient(client: ResellerClient): Promise<ResellerClient>;
  deleteResellerClient(id: string): Promise<void>;
  getAuditLogs(page?: number, limit?: number): Promise<{ data: any[], total: number, page: number, totalPages: number }>;
  adminGenerateResetToken(email: string): Promise<{ success: boolean; token: string; expiresAt: string }>;
  getNotifications(): Promise<any[]>;
  markNotificationsRead(): Promise<{ success: boolean }>;
  markNotificationRead(id: number): Promise<{ success: boolean }>;
  getBrands(): Promise<any[]>;
  saveBrand(brand: any): Promise<any>;
  deleteBrand(id: string): Promise<void>;
}

// ============================================================
// API DATABASE (Produção)
// ============================================================
class ApiDB implements IDatabase {
  private baseUrl = '/api.php';

  private async request<T>(action: string, method: string = 'GET', body?: any, includeAuth: boolean = true): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (includeAuth) {
      const token = getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const options: RequestInit = { method, headers };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const url = `${this.baseUrl}?action=${action}&_=${Date.now()}`;
    const res = await fetch(url, options);

    if (res.status === 401) {
      // Token expirado ou inválido - limpar sessão
      removeToken();
      localStorage.removeItem('session_user');
      // Redirecionar para login se não estiver já na página de login
      if (!window.location.hash.includes('login')) {
        window.location.hash = '#/login';
        window.location.reload();
      }
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(data.error || `API Error: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  // Auth
  async login(email: string, password: string): Promise<LoginResponse> {
    const result = await this.request<LoginResponse>('login', 'POST', { email, password }, false);
    setToken(result.token);
    return result;
  }

  async register(user: Partial<User> & { password: string }): Promise<{ success: boolean; message: string }> {
    return this.request('register', 'POST', user, false);
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    return this.request('requestPasswordReset', 'POST', { email }, false);
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.request('resetPassword', 'POST', { token, newPassword }, false);
  }

  // Users
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('getUsers');
  }

  async saveUser(user: User): Promise<User> {
    return this.request<User>('saveUser', 'POST', user);
  }

  async deleteUser(id: string): Promise<void> {
    await this.request<void>('deleteUser', 'POST', { id });
  }

  // Products
  async getProducts(): Promise<Product[]> {
    const products = await this.request<any[]>('getProducts');
    // Se veio com paginação (objeto com .data), extrair
    if (!Array.isArray(products) && (products as any).data) {
      return (products as any).data.map(mapProduct);
    }
    return products.map(mapProduct);
  }

  async saveProduct(product: Product): Promise<Product> {
    return this.request<Product>('saveProduct', 'POST', product);
  }

  async deleteProduct(id: string): Promise<void> {
    const token = getToken();
    await fetch(`${this.baseUrl}?action=deleteProduct&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
  }

  async replaceProducts(products: Product[], onProgress?: (percent: number) => void): Promise<void> {
    const CHUNK_SIZE = 25;
    const MAX_RETRIES = 3;

    if (products.length === 0) {
      await this.request('saveProductsBulk&clean=true', 'POST', []);
      if (onProgress) onProgress(100);
      return;
    }

    const totalChunks = Math.ceil(products.length / CHUNK_SIZE);

    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
      const chunk = products.slice(i, i + CHUNK_SIZE);
      const isFirstChunk = i === 0;
      const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;

      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const res = await this.request<any>(`saveProductsBulk&clean=${isFirstChunk}`, 'POST', chunk);

          if (!res || !res.success) {
            throw new Error(`Resposta inválida do servidor no lote ${chunkIndex}.`);
          }

          // Reportar erros de validação do lote
          if (res.errors && res.errors.length > 0) {
            console.warn(`Lote ${chunkIndex}: ${res.errors.length} produtos com erro:`, res.errors);
          }

          lastError = null;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, attempt * 1000));
          }
        }
      }

      if (lastError) {
        throw new Error(`Erro ao enviar lote ${chunkIndex}/${totalChunks} após ${MAX_RETRIES} tentativas: ${lastError.message}`);
      }

      if (onProgress) {
        onProgress(Math.round((chunkIndex / totalChunks) * 100));
      }
    }
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    return this.request<Order[]>('getOrders');
  }

  async createOrder(order: Order): Promise<Order> {
    return this.request<Order>('createOrder', 'POST', order);
  }

  async updateOrder(order: Order): Promise<Order> {
    return this.request<Order>('updateOrder', 'POST', order);
  }

  async deleteOrder(id: string): Promise<void> {
    await this.request<void>('deleteOrder', 'POST', { id });
  }

  // Settings
  async getSettings(): Promise<AppSettings> {
    return this.request<AppSettings>('getSettings');
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    return this.request<AppSettings>('saveSettings', 'POST', settings);
  }

  // Upload
  async uploadImage(file: File): Promise<string> {
    // Validação client-side
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. Máximo: 5MB.');
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de arquivo não permitido. Use: JPG, PNG, GIF ou WebP.');
    }

    const formData = new FormData();
    formData.append('file', file);

    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${this.baseUrl}?action=uploadImage`, {
      method: 'POST',
      body: formData,
      headers
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Upload falhou' }));
      throw new Error(data.error || 'Upload falhou');
    }
    return res.json() as Promise<string>;
  }

  async checkUserSession(userId: string): Promise<{ valid: boolean, status: string }> {
    return this.request<{ valid: boolean, status: string }>(`checkUserSession&id=${encodeURIComponent(userId)}`);
  }

  // Reseller Clients
  async getResellerClients(resellerId: string): Promise<ResellerClient[]> {
    return this.request<ResellerClient[]>(`getResellerClients&resellerId=${encodeURIComponent(resellerId)}`);
  }

  async getAllResellerClients(): Promise<ResellerClient[]> {
    return this.request<ResellerClient[]>('getAllResellerClients');
  }

  async saveResellerClient(client: ResellerClient): Promise<ResellerClient> {
    return this.request<ResellerClient>('saveResellerClient', 'POST', client);
  }

  async deleteResellerClient(id: string): Promise<void> {
    const token = getToken();
    await fetch(`${this.baseUrl}?action=deleteResellerClient&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
  }

  // Audit Logs
  async getAuditLogs(page: number = 1, limit: number = 50): Promise<{ data: any[], total: number, page: number, totalPages: number }> {
    return this.request(`getAuditLogs&page=${page}&limit=${limit}`);
  }

  // Admin password reset
  async adminGenerateResetToken(email: string): Promise<{ success: boolean; token: string; expiresAt: string }> {
    return this.request('adminGenerateResetToken', 'POST', { email });
  }

  // Notifications
  async getNotifications(): Promise<any[]> {
    return this.request('getNotifications');
  }

  async markNotificationsRead(): Promise<{ success: boolean }> {
    return this.request('markNotificationsRead', 'POST');
  }

  async markNotificationRead(id: number): Promise<{ success: boolean }> {
    return this.request('markNotificationRead', 'POST', { id });
  }

  // Brands
  async getBrands(): Promise<any[]> {
    return this.request('getBrands');
  }

  async saveBrand(brand: any): Promise<any> {
    return this.request('saveBrand', 'POST', brand);
  }

  async deleteBrand(id: string): Promise<void> {
    return this.request(`deleteBrand&id=${id}`, 'DELETE');
  }
}

// ============================================================
// LOCAL DATABASE (Desenvolvimento)
// ============================================================
class LocalDB implements IDatabase {
  private getStorage<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(`mwe_b2b_v2_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  private setStorage(key: string, data: any) {
    localStorage.setItem(`mwe_b2b_v2_${key}`, JSON.stringify(data));
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    await delay(300);
    const users = await this.getUsers();
    const user = users.find(u => u.email === email);

    if (!user) throw new Error('E-mail não cadastrado.');
    if (!user.password || user.password !== password) throw new Error('Senha incorreta.');
    if (user.status !== UserStatus.APPROVED) {
      if (user.status === UserStatus.PENDING) throw new Error('Sua conta está em fase de análise pela nossa equipe.');
      if (user.status === UserStatus.REJECTED) throw new Error('Sua solicitação de acesso foi recusada.');
      throw new Error('Sua conta está inativa. Entre em contato com o suporte.');
    }

    const updatedUser = { ...user, lastLogin: new Date().toISOString() };
    await this.saveUser(updatedUser);

    const token = 'local_dev_token_' + Date.now();
    setToken(token);

    return { token, user: updatedUser };
  }

  async register(user: Partial<User> & { password: string }): Promise<{ success: boolean; message: string }> {
    await delay(300);
    const users = await this.getUsers();
    if (users.find(u => u.email === user.email)) {
      throw new Error('Este e-mail já está cadastrado.');
    }

    const newUser: User = {
      id: user.id || crypto.randomUUID(),
      storeName: user.storeName || '',
      responsibleName: user.responsibleName || '',
      cnpj: user.cnpj || '',
      phone: user.phone || '',
      email: user.email || '',
      password: user.password,
      role: (user.role as Role) || Role.RETAILER,
      status: UserStatus.PENDING,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    this.setStorage('users', users);
    return { success: true, message: 'Cadastro enviado com sucesso.' };
  }

  async requestPasswordReset(_email: string): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Se o e-mail existir, um código de recuperação será gerado.' };
  }

  async resetPassword(_token: string, _newPassword: string): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Senha alterada com sucesso.' };
  }

  async getUsers(): Promise<User[]> {
    await delay(100);
    const users = this.getStorage<User[]>('users', []);

    if (!users.find(u => u.email === 'admin@admin.com')) {
      const admin: User = {
        id: 'admin-1',
        storeName: 'MWE Administrador',
        responsibleName: 'Admin',
        cnpj: '00.000.000/0001-00',
        phone: '(11) 99999-9999',
        email: 'admin@admin.com',
        password: 'admin123',
        role: Role.ADMIN,
        permissions: ['catalog', 'admin_panel'],
        status: UserStatus.APPROVED,
        createdAt: new Date().toISOString()
      };
      users.push(admin);
      this.setStorage('users', users);
    }

    if (!users.find(u => u.email === 'revendedor@teste.com')) {
      const reseller: User = {
        id: 'reseller-1',
        storeName: 'Revendedor Teste',
        responsibleName: 'Revendedor',
        cnpj: '11.111.111/0001-11',
        phone: '(11) 98888-8888',
        email: 'revendedor@teste.com',
        password: 'teste123',
        role: Role.RESELLER,
        permissions: ['catalog'],
        status: UserStatus.APPROVED,
        createdAt: new Date().toISOString()
      };
      users.push(reseller);
      this.setStorage('users', users);
    }
    return users;
  }

  async saveUser(user: User): Promise<User> {
    const users = await this.getUsers();
    const index = users.findIndex(u => u.id === user.id || u.email === user.email);
    if (index >= 0) {
      users[index] = { ...users[index], ...user };
    } else {
      users.push(user);
    }
    this.setStorage('users', users);
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const users = await this.getUsers();
    this.setStorage('users', users.filter(u => u.id !== id));
    const orders = await this.getOrders();
    this.setStorage('orders', orders.filter(o => o.userId !== id));
  }

  async getProducts(): Promise<Product[]> {
    return this.getStorage<Product[]>('products', []);
  }

  async saveProduct(product: Product): Promise<Product> {
    const products = await this.getProducts();
    const index = products.findIndex(p => p.id === product.id);
    if (index >= 0) {
      products[index] = product;
    } else {
      products.push(product);
    }
    this.setStorage('products', products);
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    const products = await this.getProducts();
    this.setStorage('products', products.filter(p => p.id !== id));
  }

  async replaceProducts(products: Product[], onProgress?: (percent: number) => void): Promise<void> {
    this.setStorage('products', products);
    if (onProgress) onProgress(100);
  }

  async getOrders(): Promise<Order[]> {
    return this.getStorage<Order[]>('orders', []);
  }

  async createOrder(order: Order): Promise<Order> {
    const orders = await this.getOrders();
    orders.unshift(order);
    this.setStorage('orders', orders);
    return order;
  }

  async updateOrder(order: Order): Promise<Order> {
    const orders = await this.getOrders();
    const index = orders.findIndex(o => o.id === order.id);
    if (index >= 0) {
      orders[index] = order;
      this.setStorage('orders', orders);
    }
    return order;
  }

  async deleteOrder(id: string): Promise<void> {
    const orders = await this.getOrders();
    this.setStorage('orders', orders.filter(o => o.id !== id));
  }

  async getSettings(): Promise<AppSettings> {
    return this.getStorage<AppSettings>('settings', {
      primaryColor: '#fc5200',
      secondaryColor: '#1e293b',
      companyName: 'MWE Autopeças',
      footerText: 'MWE Distribuidora © 2026 - Catálogo Online',
      logoUrl: '',
      supportEmail: 'contato@mwe.com.br',
      supportPhone: '(11) 99999-9999',
      instagramUrl: '',
      linkedinUrl: '',
      facebookUrl: '',
      youtubeUrl: '',
      tiktokUrl: '',
      websiteUrl: '',
      customAddress: 'Somos o seu parceiro em autopeças de qualidade.'
    });
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    this.setStorage('settings', settings);
    return settings;
  }

  async uploadImage(file: File): Promise<string> {
    // Validação client-side
    if (file.size > 5 * 1024 * 1024) throw new Error('Arquivo muito grande. Máximo: 5MB.');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) throw new Error('Tipo de arquivo não permitido.');

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
    });
  }

  async checkUserSession(_userId: string): Promise<{ valid: boolean, status: string }> {
    return { valid: true, status: 'APPROVED' };
  }

  async getResellerClients(resellerId: string): Promise<ResellerClient[]> {
    const all = this.getStorage<ResellerClient[]>('reseller_clients', []);
    return all.filter(c => c.resellerId === resellerId);
  }

  async getAllResellerClients(): Promise<ResellerClient[]> {
    return this.getStorage<ResellerClient[]>('reseller_clients', []);
  }

  async saveResellerClient(client: ResellerClient): Promise<ResellerClient> {
    const all = this.getStorage<ResellerClient[]>('reseller_clients', []);
    const idx = all.findIndex(c => c.id === client.id);
    if (idx >= 0) { all[idx] = client; } else { all.push(client); }
    this.setStorage('reseller_clients', all);
    return client;
  }

  async deleteResellerClient(id: string): Promise<void> {
    const all = this.getStorage<ResellerClient[]>('reseller_clients', []);
    this.setStorage('reseller_clients', all.filter(c => c.id !== id));
  }

  async getAuditLogs(_page?: number, _limit?: number): Promise<{ data: any[], total: number, page: number, totalPages: number }> {
    return { data: [], total: 0, page: 1, totalPages: 0 };
  }

  async adminGenerateResetToken(_email: string): Promise<{ success: boolean; token: string; expiresAt: string }> {
    return { success: true, token: 'dev_reset_' + Date.now(), expiresAt: new Date(Date.now() + 86400000).toISOString() };
  }

  async getNotifications(): Promise<any[]> {
    let notifs = this.getStorage<any[]>('notifications', []);
    // Recriar se vazio ou se são notificações antigas sem campo link
    if (notifs.length === 0 || (notifs.length > 0 && !('link' in notifs[0]))) {
      const now = Date.now();
      notifs = [
        { id: 1, title: 'Novo Cadastro Pendente', message: 'Auto Peças Silva solicitou acesso ao sistema.', type: 'info', readAt: null, createdAt: new Date(now - 5 * 60000).toISOString(), link: '#/admin/usuarios' },
        { id: 2, title: 'Novo Pedido Recebido', message: 'Pedido #CDA4EA8B de Revendedor Teste - R$ 41,40', type: 'info', readAt: null, createdAt: new Date(now - 30 * 60000).toISOString(), link: '#/admin/pedidos' },
        { id: 3, title: 'Pedido Aprovado', message: 'Seu pedido #2E1B9F03 foi aprovado!', type: 'success', readAt: null, createdAt: new Date(now - 2 * 3600000).toISOString(), link: '#/pedidos' },
        { id: 4, title: 'Novo Pedido Recebido', message: 'Pedido #39F7A21C de Auto Center Souza - R$ 237,80', type: 'info', readAt: null, createdAt: new Date(now - 5 * 3600000).toISOString(), link: '#/admin/pedidos' },
        { id: 5, title: 'Pedido Enviado', message: 'Seu pedido #A8C3E012 foi enviado!', type: 'success', readAt: new Date(now - 8 * 3600000).toISOString(), createdAt: new Date(now - 24 * 3600000).toISOString(), link: '#/pedidos' },
        { id: 6, title: 'Atualização da Conta', message: 'Sua conta foi aprovada! Agora você pode acessar o catálogo.', type: 'success', readAt: new Date(now - 26 * 3600000).toISOString(), createdAt: new Date(now - 26 * 3600000).toISOString(), link: '#/catalogo' },
        { id: 7, title: 'Pedido Cancelado', message: 'Seu pedido #F1D2B340 foi cancelado.', type: 'error', readAt: new Date(now - 50 * 3600000).toISOString(), createdAt: new Date(now - 50 * 3600000).toISOString(), link: '#/pedidos' },
        { id: 8, title: 'Novo Cadastro Pendente', message: 'Distribuidora Central LTDA solicitou acesso ao sistema.', type: 'info', readAt: new Date(now - 72 * 3600000).toISOString(), createdAt: new Date(now - 72 * 3600000).toISOString(), link: '#/admin/usuarios' },
      ];
      this.setStorage('notifications', notifs);
    }
    return notifs;
  }

  async markNotificationsRead(): Promise<{ success: boolean }> {
    const notifs = this.getStorage<any[]>('notifications', []);
    const now = new Date().toISOString();
    this.setStorage('notifications', notifs.map(n => n.readAt ? n : { ...n, readAt: now }));
    return { success: true };
  }

  async markNotificationRead(id: number): Promise<{ success: boolean }> {
    const notifs = this.getStorage<any[]>('notifications', []);
    this.setStorage('notifications', notifs.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    return { success: true };
  }
  async getBrands(): Promise<any[]> { return this.getStorage('brands', []); }
  async saveBrand(brand: any): Promise<any> {
    const all = this.getStorage<any[]>('brands', []);
    const idx = all.findIndex(b => b.id === brand.id);
    if (idx >= 0) { all[idx] = brand; } else { all.push(brand); }
    this.setStorage('brands', all);
    return brand;
  }
  async deleteBrand(id: string): Promise<void> {
    this.setStorage('brands', this.getStorage<any[]>('brands', []).filter(b => b.id !== id));
  }
}

// ============================================================
// HELPERS
// ============================================================
function mapProduct(p: any): Product {
  return {
    id: String(p.id || ''),
    name: String(p.name || ''),
    internalCode: String(p.internalCode || ''),
    parallelCodes: String(p.parallelCodes || ''),
    description: String(p.description || ''),
    manufacturer: String(p.manufacturer || ''),
    vehicle: String(p.vehicle || ''),
    application: String(p.application || ''),
    kitComponents: String(p.kitComponents || ''),
    group: String(p.group || p.group_name || ''),
    position: String(p.position || ''),
    price: Number(p.price || 0),
    promo_price: Number(p.promo_price || 0),
    min_stock_display: p.min_stock_display ? String(p.min_stock_display) : undefined,
    images: Array.isArray(p.images) ? p.images : [],
    stock: Number(p.stock || 0),
    active: Boolean(p.active),
    compatibility: p.compatibility || [],
    brand: String(p.brand || '')
  };
}

// ============================================================
// EXPORT
// ============================================================
export const db = import.meta.env.PROD || window.location.hostname.includes('mwedistribuidora.com.br')
  ? new ApiDB()
  : new LocalDB();
