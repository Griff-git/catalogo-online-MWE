import { User, Product, Order, AppSettings, Role, UserStatus, ResellerClient } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

interface IDatabase {
  getUsers(): Promise<User[]>;
  saveUser(user: User): Promise<User>;
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
  // Reseller Clients
  getResellerClients(resellerId: string): Promise<ResellerClient[]>;
  getAllResellerClients(): Promise<ResellerClient[]>;
  saveResellerClient(client: ResellerClient): Promise<ResellerClient>;
  deleteResellerClient(id: string): Promise<void>;
}

class ApiDB implements IDatabase {
  private baseUrl = '/api.php'; // Caminho absoluto para a raiz do subdomínio

  private async request<T>(action: string, method: string = 'GET', body?: any): Promise<T> {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const url = `${this.baseUrl}?action=${action}&_=${Date.now()}`;
    const res = await fetch(url, options);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API Error: ${res.status} ${res.statusText} - ${text}`);
    }

    return res.json();
  }

  async getUsers(): Promise<User[]> {
    return this.request<User[]>('getUsers');
  }

  async saveUser(user: User): Promise<User> {
    return this.request<User>('saveUser', 'POST', user);
  }

  async getProducts(): Promise<Product[]> {
    const products = await this.request<any[]>('getProducts');
    // Sanitização rigorosa com Casting explícito de tipos
    // Sanitização rigorosa com Casting explícito e construção manual de objeto (sem spread)
    return products.map(p => ({
      id: String(p.id || ''), // Garante ID string
      name: String(p.name || ''),
      internalCode: String(p.internalCode || ''),
      parallelCodes: String(p.parallelCodes || ''),
      description: String(p.description || ''),
      manufacturer: String(p.manufacturer || ''),
      vehicle: String(p.vehicle || ''),
      application: String(p.application || ''),
      // side removido
      kitComponents: String(p.kitComponents || ''),
      group: String(p.group || p.group_name || ''), // API sends 'group', DB row has 'group_name'
      position: String(p.position || ''), // API sends 'position'
      price: Number(p.price || 0),
      promo_price: Number(p.promo_price || 0),
      min_stock_display: p.min_stock_display ? String(p.min_stock_display) : undefined,
      images: Array.isArray(p.images) ? p.images : [],
      stock: Number(p.stock || 0),
      active: Boolean(p.active),
      compatibility: p.compatibility || []
    }));
  }

  async saveProduct(product: Product): Promise<Product> {
    return this.request<Product>('saveProduct', 'POST', product);
  }

  async deleteProduct(id: string): Promise<void> {
    await fetch(`${this.baseUrl}?action=deleteProduct&id=${id}`, { method: 'DELETE' });
  }

  async replaceProducts(products: Product[], onProgress?: (percent: number) => void): Promise<void> {
    const CHUNK_SIZE = 25; // Tamanho reduzido para evitar bloqueio WAF/ModSecurity (403 Forbidden)
    const MAX_RETRIES = 3;

    // Se lista vazia, apenas limpa
    if (products.length === 0) {
      await this.request('saveProductsBulk?clean=true', 'POST', []);
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

          // Sucesso - sair do loop de retry
          lastError = null;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < MAX_RETRIES) {
            // Espera progressiva: 1s, 2s, 3s...
            await new Promise(r => setTimeout(r, attempt * 1000));
          }
        }
      }

      if (lastError) {
        throw new Error(`Erro ao enviar lote ${chunkIndex}/${totalChunks} após ${MAX_RETRIES} tentativas: ${lastError.message}`);
      }

      // Reportar progresso
      if (onProgress) {
        onProgress(Math.round((chunkIndex / totalChunks) * 100));
      }
    }
  }

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

  async getSettings(): Promise<AppSettings> {
    return this.request<AppSettings>('getSettings');
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    try {
      return await this.request<AppSettings>('saveSettings', 'POST', settings);
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      throw error;
    }
  }

  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${this.baseUrl}?action=uploadImage`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Upload falhou');
    const data = await res.json() as string; // Retorna URL string
    return data;
  }

  async checkUserSession(userId: string): Promise<{ valid: boolean, status: string }> {
    return this.request<{ valid: boolean, status: string }>(`checkUserSession&id=${encodeURIComponent(userId)}`);
  }

  // --- Reseller Clients ---
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
    await fetch(`${this.baseUrl}?action=deleteResellerClient&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

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

  async getUsers(): Promise<User[]> {
    await delay(200);
    const users = this.getStorage<User[]>('users', []);

    // Garantir Admin
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
      footerText: 'MWE Distribuidora © 2025 - Catálogo Online',
      logoUrl: '',
      supportEmail: 'contato@mwe.com.br',
      supportPhone: '(11) 99999-9999',
      instagramUrl: '',
      linkedinUrl: '',
      facebookUrl: '',
      youtubeUrl: '',
      tiktokUrl: '',
      websiteUrl: '',
      customAddress: 'Somos o seu parceiro em autopeças de quality, fornecendo soluções rápidas para o lojista moderno.'
    });
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    this.setStorage('settings', settings);
    return settings;
  }

  async uploadImage(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
    });
  }

  async checkUserSession(_userId: string): Promise<{ valid: boolean, status: string }> {
    return { valid: true, status: 'APPROVED' };
  }

  // --- Reseller Clients ---
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
}

// Em desenvolvimento local não usamos 'import.meta.env.PROD' sozinho
// pois às vezes queremos testar a API.
// Mas para o pedido do usuário: "tudo pronto para subir".
// Quando ele subir na hostinger, será PROD.
export const db = import.meta.env.PROD || window.location.hostname.includes('mwedistribuidora.com.br')
  ? new ApiDB()
  : new LocalDB();