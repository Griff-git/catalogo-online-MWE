
export enum UserStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  INACTIVE = 'INACTIVE'
}

export enum Role {
  ADMIN = 'ADMIN',
  RETAILER = 'RETAILER',
  RESELLER = 'RESELLER'
}

export interface CompatibilityItem {
  id: string;
  manufacturer: string;
  vehicle: string;
  years?: number[];
}

export interface User {
  id: string;
  storeName: string;
  responsibleName: string;
  cnpj: string;
  phone: string;
  email: string;
  password?: string;
  role: Role;
  permissions?: string[];
  status: UserStatus;
  createdAt: string;
  lastLogin?: string;  // ISO timestamp do último login
}

export interface Product {
  id: string;
  internalCode: string;
  parallelCodes: string;
  name: string;
  description: string;
  manufacturer: string;
  vehicle: string;
  compatibility: CompatibilityItem[];
  application: string;
  kitComponents: string;
  group: string;        // Renomeado no frontend (DB: group_name)
  position: string;     // Renomeado no frontend (DB: position)
  price: number;
  promo_price?: number;
  min_stock_display?: string;
  images: string[];
  stock: number;
  active: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export type OrderStatus = 'ANALYSIS' | 'APPROVED' | 'PENDING' | 'COMPLETED' | 'CANCELED' | 'SHIPPED';

// Cliente da carteira do revendedor
export interface ResellerClient {
  id: string;
  resellerId: string;       // ID do revendedor (users)
  linkedUserId?: string;    // ID de usuário lojista vinculado (se existir)
  companyName: string;      // Razão Social
  tradeName: string;        // Nome Fantasia
  cnpj: string;
  phone: string;
  email: string;
  notes: string;            // Observações
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  userStoreName: string;
  clientName?: string;
  resellerClientId?: string;  // ID do cliente da carteira do revendedor
  paymentMethod?: string;
  observations?: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    discountPercent?: number;   // desconto % do item (0-100)
    discountedPrice?: number;   // preço unitário com desconto aplicado
  }[];
  total: number;
  totalDiscount?: number;        // valor total do desconto em R$
  orderDiscountPercent?: number;  // desconto % geral do pedido
  status: OrderStatus;
  date: string;
}

export interface AppSettings {
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  footerText: string;
  logoUrl: string;
  faviconUrl?: string;
  supportEmail: string;
  supportPhone: string;
  instagramUrl: string;
  linkedinUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  websiteUrl: string;
  customAddress: string;
  promoBannerUrl?: string;
  paymentPolicies?: PaymentPolicy[];
}

export const GROUPS = [
  'Kit de Amortecedor',
  'Coxim de Amortecedor',
  'Rolamento do Coxim',
  'Pivô da Suspensão',
  'Bucha da Bandeja',
  'Bieleta',
  'Coxim de Motor',
  'Calço & Prato'
];

export const POSITIONS = [
  'Dianteiro',
  'Traseiro',
  'Esquerdo',
  'Direito',
  'Ambos os Lados',
  'Superior',
  'Inferior',
  'Central'
];

export const MANUFACTURERS = [
  'Audi',
  'BMW',
  'Chery',
  'Chevrolet',
  'Citroën',
  'Dodge',
  'Fiat',
  'Ford',
  'Honda',
  'Hyundai',
  'JAC',
  'JEEP',
  'Kia',
  'Land Rover',
  'Lifan',
  'Mercedes-Benz',
  'Mini',
  'Mitsubishi',
  'Nissan',
  'Peugeot',
  'SEAT',
  'Suzuki',
  'Toyota',
  'Volvo'
];

export interface PaymentOption {
  label: string;
  days: number[];  // installment due days, e.g. [28, 35, 42]. Empty = à vista
}

export interface PaymentPolicy {
  minValue: number;
  maxValue: number;
  options: PaymentOption[];
}

export const PAYMENT_POLICIES: PaymentPolicy[] = [
  {
    minValue: 0, maxValue: 150, options: [
      { label: 'À vista (PIX ou Dinheiro)', days: [] }
    ]
  },
  {
    minValue: 150.01, maxValue: 300, options: [
      { label: 'Pagamento em 14 dias', days: [14] },
      { label: 'À vista', days: [] }
    ]
  },
  {
    minValue: 300.01, maxValue: 600, options: [
      { label: 'Pagamento em 28/35 dias', days: [28, 35] },
      { label: 'À vista', days: [] }
    ]
  },
  {
    minValue: 600.01, maxValue: 1000, options: [
      { label: 'Pagamento em 28/35/42 dias', days: [28, 35, 42] },
      { label: 'Pagamento em 30/45 dias', days: [30, 45] },
      { label: 'À vista', days: [] }
    ]
  },
  {
    minValue: 1000.01, maxValue: 2000, options: [
      { label: 'Pagamento em 28/35/42/49 dias', days: [28, 35, 42, 49] },
      { label: 'Pagamento em 30/40/50 dias', days: [30, 40, 50] },
      { label: 'À vista', days: [] }
    ]
  },
  {
    minValue: 2000.01, maxValue: 3000, options: [
      { label: 'Pagamento em 28/35/42/49/56 dias', days: [28, 35, 42, 49, 56] },
      { label: 'Pagamento em 30/40/50 dias', days: [30, 40, 50] },
      { label: 'À vista', days: [] }
    ]
  },
  {
    minValue: 3000.01, maxValue: Infinity, options: [
      { label: 'Pagamento em 30/40/50/60/70 dias', days: [30, 40, 50, 60, 70] },
      { label: 'Pagamento em 30/45/60/75 dias', days: [30, 45, 60, 75] },
      { label: 'À vista', days: [] }
    ]
  },
];

export const getPaymentOptions = (total: number, policies?: PaymentPolicy[]): PaymentOption[] => {
  const list = (policies && policies.length > 0) ? policies : PAYMENT_POLICIES;
  const policy = list.find(p => {
    const max = (p.maxValue === null || p.maxValue === undefined || p.maxValue >= 999999) ? Infinity : p.maxValue;
    return total >= p.minValue && total <= max;
  });
  return policy ? policy.options : [{ label: 'À vista', days: [] }];
};

export interface InstallmentInfo {
  count: number;
  value: number;
  days: number[];
  isAvista: boolean;
}

export const getInstallmentInfo = (option: PaymentOption, total: number): InstallmentInfo => {
  if (!option.days || option.days.length === 0) {
    return { count: 1, value: total, days: [], isAvista: true };
  }
  const count = option.days.length;
  return { count, value: total / count, days: option.days, isAvista: false };
};
