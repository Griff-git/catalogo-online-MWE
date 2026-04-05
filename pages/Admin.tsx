
import { Check, X, Trash2, Edit, Plus, Copy, Search, Archive, Eye, ShieldAlert, ShieldCheck, User as UserIcon, Calendar, Phone, Mail, Building2, FileText, Download, PackageOpen, LayoutDashboard, Settings, Package, ArrowRight, Ban, Power, UserCircle, AlertCircle, FileDown, FileUp, Loader2, ShoppingBag, Info, CarFront, ClipboardList, ImagePlus, Palette, Globe, Share2, MessageCircle, Instagram, Linkedin, CheckCircle2, Save, Facebook, Youtube, Play, ExternalLink, TrendingUp, BarChart3, PieChart, Users2, Clock, DollarSign, AlertTriangle, MoreHorizontal, UserCheck, UserMinus, Truck, CheckCircle, FileSearch, Tag, Folder, Car, ChevronDown } from 'lucide-react';
import React, { useState, useEffect, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/db';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { User, Product, UserStatus, Role, Order, OrderStatus, ResellerClient, GROUPS, POSITIONS, MANUFACTURERS, AppSettings as AppSettingsType, CompatibilityItem, PaymentPolicy, PAYMENT_POLICIES } from '../types';
import { AppContext } from '../App';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useNavigate, useSearchParams } from 'react-router-dom';

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
};

const formatPrice = (price: number) => {
  return price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Remove acentos/diacríticos para pesquisa tolerante a erros de digitação
const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const statusLabels: Record<OrderStatus, string> = {
  ANALYSIS: 'Em Análise',
  APPROVED: 'Aprovado',
  PENDING: 'Pendente',
  SHIPPED: 'Enviado',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado'
};

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => createPortal(children, document.body);

const FeedbackToast: React.FC<{ message: string; visible: boolean; primaryColor: string }> = ({ message, visible, primaryColor }) => (
  <div
    className="fixed bottom-8 right-8 z-[300] pointer-events-none transition-all duration-300"
    style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateX(0)' : 'translateX(120%)', }}
  >
    <div className="bg-white border border-gray-100 shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-4 min-w-[300px]">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: primaryColor }}>
        <Check size={20} />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Sistema</p>
        <p className="text-sm font-bold text-gray-900">{message}</p>
      </div>
    </div>
  </div>
);

const ProductInfoModal: React.FC<{ product: Product; onClose: () => void; primaryColor: string; zIndex?: number }> = ({ product, onClose, primaryColor, zIndex = 250 }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 w-full h-full bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-300" style={{ zIndex }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-[1rem] md:rounded-[1.25rem] shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 md:px-10 md:py-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
          <div>
            <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: primaryColor }}>Dados Técnicos do Produto</p>
            <h2 className="font-black text-gray-900 text-xl md:text-2xl line-clamp-1">{product.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 md:p-3 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"><X size={20} className="md:w-6 md:h-6" /></button>
        </div>
        <div className="p-6 md:p-10 space-y-6 overflow-y-auto">
          <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-start md:items-center bg-gray-50 p-4 md:p-6 rounded-[1rem] border border-gray-100">
            <div className="w-full md:w-32 h-40 md:h-32 bg-white rounded-2xl shadow-sm overflow-hidden flex-shrink-0">
              <img src={product.images[0]} className="w-full h-full object-cover" alt={product.name} />
            </div>
            <div className="space-y-2 w-full">
              <span className="bg-white px-3 py-1 rounded-lg text-[10px] font-bold text-gray-400 border border-gray-200 shadow-sm uppercase tracking-widest block w-fit">SKU: {product.internalCode}</span>
              <p className="text-2xl font-black" style={{ color: primaryColor }}>R$ {formatPrice(product.price)}</p>
              <p className="text-sm font-bold text-gray-500 flex items-center gap-2"><Package size={14} /> Estoque: {product.stock} un.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-gray-100 bg-white">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Aplicações</p>
              <p className="text-sm font-bold text-gray-800">{product.application}</p>
            </div>
            <div className="p-4 rounded-2xl border border-gray-100 bg-white">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Posição / Lado</p>
              <p className="text-sm font-bold text-gray-800">{product.position}</p>
            </div>
            <div className="p-4 rounded-2xl border border-gray-100 bg-white">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Grupo</p>
              <p className="text-sm font-bold text-gray-800">{product.group}</p>
            </div>
            <div className="p-4 rounded-2xl border border-gray-100 bg-white">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Componentes do Kit</p>
              <p className="text-xs font-mono font-bold text-gray-500">{product.kitComponents || 'Individual'}</p>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50/50">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Descrição</p>
            <p className="text-sm text-gray-600 leading-relaxed italic">"{product.description}"</p>
          </div>
        </div>
      </div>
    </div>, document.body
  );
};

const OrderDetailsModal: React.FC<{
  order: Order;
  onClose: () => void;
  onStatusChange: (s: OrderStatus) => void;
  onDownload: () => void;
  onViewRetailer?: (userId: string) => void;
  zIndex?: number;
}> = ({ order, onClose, onStatusChange, onDownload, onViewRetailer, zIndex = 150 }) => {
  const { settings } = useContext(AppContext);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const handleProductClick = async (productId: string) => {
    const products = await db.getProducts();
    const product = products.find(p => p.id === productId);
    if (product) setViewingProduct(product);
  };

  return createPortal(
    <div className="fixed inset-0 w-full h-full bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-300" style={{ zIndex }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-[1rem] md:rounded-[1.25rem] shadow-2xl max-w-3xl w-full overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-black text-lg" style={{ color: settings.primaryColor }}>Pedido #{order.id.slice(0, 8).toUpperCase()}</h2>
              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-gray-50 text-gray-600 border-gray-200">{statusLabels[order.status]}</span>
            </div>
            <p className="text-xs text-gray-400 font-medium mt-0.5">{new Date(order.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"><X size={20} /></button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Info grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              disabled={!onViewRetailer}
              onClick={() => onViewRetailer && onViewRetailer(order.userId)}
              className={`col-span-2 p-3 rounded-xl border border-gray-100 text-left group transition-all ${onViewRetailer ? 'hover:border-gray-300 cursor-pointer' : 'cursor-default'}`}
            >
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Lojista / Revendedor</p>
              <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                {order.userStoreName}
                {onViewRetailer && <ExternalLink size={12} className="text-gray-300" />}
              </p>
              {order.clientName && (
                <p className="text-xs text-gray-500 font-medium mt-1">Cliente: <span className="font-bold text-gray-700">{order.clientName}</span></p>
              )}
            </button>
            <div className="p-3 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Pagamento</p>
              <p className="text-sm font-bold text-gray-900">{order.paymentMethod || 'Não informado'}</p>
            </div>
            <div className="p-3 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total</p>
              <p className="text-sm font-black text-gray-900">R$ {formatPrice(order.total)}</p>
            </div>
            {order.observations && (
              <div className="p-3 rounded-xl border border-gray-100 col-span-2 md:col-span-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Observações</p>
                <p className="text-sm font-medium text-gray-700 whitespace-pre-wrap">{order.observations}</p>
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Produto</th>
                  <th className="px-4 py-3 text-center w-14">Qtd</th>
                  <th className="px-4 py-3 text-right w-28">Unit.</th>
                  <th className="px-4 py-3 text-right w-32">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.items.map((i: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0">
                          <img src={i.image || 'https://placehold.co/80x80/f8fafc/94a3b8?text=...'} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <button onClick={() => handleProductClick(i.productId)} className="text-sm font-bold text-gray-900 hover:underline text-left truncate block max-w-[280px]">
                            {i.name || i.productName}
                          </button>
                          <div className="flex items-center gap-2 mt-0.5">
                            {i.internalCode && <span className="text-[10px] font-bold text-gray-400">{i.internalCode}</span>}
                            {i.application && <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{i.application}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-600">{i.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">R$ {formatPrice(i.price || 0)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">R$ {formatPrice((i.price || 0) * (i.quantity || 1))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Total</td>
                  <td className="px-4 py-3 text-right text-base font-black text-gray-900 whitespace-nowrap">R$ {formatPrice(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Status change */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Alterar Status</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(statusLabels) as OrderStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className={`px-4 py-2 rounded-lg text-[11px] font-bold border transition-all ${order.status === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'}`}
                >
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Fechar</button>
          <button onClick={onDownload} className="flex items-center gap-2 px-5 py-2.5 text-white rounded-lg text-sm font-bold transition-colors hover:opacity-90" style={{ backgroundColor: settings.primaryColor }}><Download size={16} /> Baixar PDF</button>
        </div>
      </div>
      {viewingProduct && <ProductInfoModal product={viewingProduct} onClose={() => setViewingProduct(null)} primaryColor={settings.primaryColor} zIndex={zIndex + 100} />}
    </div>, document.body
  );
};

const UserDetailsModal: React.FC<{ user: User; onClose: () => void; onStatusUpdate: (s: UserStatus) => void; onRoleUpdate?: (newRole: Role) => void; onPermissionToggle?: (permission: string) => void; zIndex?: number }> = ({ user, onClose, onStatusUpdate, onRoleUpdate, onPermissionToggle, zIndex = 120 }) => {
  const { settings } = useContext(AppContext);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  // Vinculation state
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allClients, setAllClients] = useState<ResellerClient[]>([]);
  const [selectedResellerId, setSelectedResellerId] = useState('');
  const [linkedReseller, setLinkedReseller] = useState<{ reseller: User; client: ResellerClient } | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  // Corrected: loadOrders is now async to handle promise from db.getOrders()
  const loadOrders = async () => {
    const orders = await db.getOrders();
    setUserOrders(orders.filter(o => o.userId === user.id));
  };

  useEffect(() => {
    loadOrders();
    // Load vinculation data
    const loadVinc = async () => {
      const [users, clients] = await Promise.all([db.getUsers(), db.getAllResellerClients()]);
      setAllUsers(users.filter(u => u.role === Role.RESELLER));
      setAllClients(clients);
      // Check if this user is linked to a reseller
      if (user.role === Role.RETAILER) {
        const link = clients.find(c => c.linkedUserId === user.id);
        if (link) {
          const reseller = users.find(u => u.id === link.resellerId);
          if (reseller) setLinkedReseller({ reseller, client: link });
        }
      }
    };
    loadVinc();
  }, [user.id]);

  const handleOrderStatusUpdate = async (status: OrderStatus) => {
    if (!viewingOrder) return;
    const updated = { ...viewingOrder, status };
    await db.updateOrder(updated);
    setViewingOrder(updated);
    loadOrders();
  };

  const handleDownloadPDF = (order: Order) => {
    try {
      const doc = new jsPDF();
      const rgb = hexToRgb(settings.primaryColor);
      doc.setFontSize(22); doc.setTextColor(rgb[0], rgb[1], rgb[2]); doc.text(settings.companyName, 15, 20);
      autoTable(doc, {
        startY: 35,
        head: [['Item', 'Qtd', 'Total']],
        body: order.items.map(i => [i.productName, i.quantity, `R$ ${formatPrice(i.price * i.quantity)}`]),
        theme: 'grid',
        headStyles: { fillColor: rgb as any }
      });
      doc.save(`Pedido_${order.id.slice(0, 8)}.pdf`);
    } catch (e) { alert('Erro ao gerar PDF.'); }
  };

  const statusConfig = {
    [UserStatus.APPROVED]: { label: 'Aprovado', color: 'text-green-600 bg-green-50 border-green-100', icon: ShieldCheck },
    [UserStatus.PENDING]: { label: 'Pendente', color: 'text-yellow-600 bg-yellow-50 border-yellow-100', icon: AlertCircle },
    [UserStatus.REJECTED]: { label: 'Rejeitado', color: 'text-red-600 bg-red-50 border-red-100', icon: Ban },
    [UserStatus.INACTIVE]: { label: 'Inativo', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: Power },
  };

  const Config = statusConfig[user.status];

  return createPortal(
    <div className="fixed inset-0 w-full h-full bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-300" style={{ zIndex }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-[1rem] md:rounded-[1.25rem] shadow-2xl max-w-5xl w-full overflow-hidden animate-in zoom-in duration-300 flex flex-col md:flex-row max-h-[90vh]">
        <div className="w-full md:w-1/2 p-6 md:p-10 border-b md:border-b-0 md:border-r border-gray-100 overflow-y-auto">
          <div className="flex justify-between items-start mb-6 md:mb-8">
            <div className="flex items-center gap-4 md:gap-5">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-900 text-white rounded-[0.75rem] md:rounded-[1rem] flex items-center justify-center text-2xl md:text-3xl font-black flex-shrink-0">
                {user.storeName.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <h2 className="text-xl md:text-3xl font-black text-gray-900 truncate">{user.storeName}</h2>
                <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border ${Config.color}`}>
                  <Config.icon size={12} /> {Config.label}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition-colors md:hidden flex-shrink-0"><X size={20} /></button>
          </div>
          {/* Dados do usuário */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <Building2 size={16} className="text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">CNPJ</p>
                <p className="text-sm font-bold text-gray-800 truncate">{user.cnpj || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <UserIcon size={16} className="text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Responsável</p>
                <p className="text-sm font-bold text-gray-800 truncate">{user.responsibleName || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <Mail size={16} className="text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">E-mail</p>
                <p className="text-sm font-bold text-gray-800 truncate">{user.email}</p>
              </div>
            </div>
            {user.phone && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Phone size={16} className="text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Telefone</p>
                  <p className="text-sm font-bold text-gray-800">{user.phone}</p>
                </div>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="pt-5 border-t border-gray-100 flex flex-col gap-2.5">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Ações</p>

            {user.status === UserStatus.PENDING ? (
              <div className="flex gap-2.5">
                <button onClick={() => onStatusUpdate(UserStatus.APPROVED)} className="flex-1 py-3 bg-gray-900 text-white rounded-xl text-xs font-black hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                  <ShieldCheck size={15} /> Aprovar
                </button>
                <button onClick={() => onStatusUpdate(UserStatus.REJECTED)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-xs font-black border border-gray-200 hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                  <X size={15} /> Rejeitar
                </button>
              </div>
            ) : user.status === UserStatus.APPROVED ? (
              <button onClick={() => onStatusUpdate(UserStatus.INACTIVE)} className="w-full py-3 bg-gray-100 text-red-500 rounded-xl text-xs font-black border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center gap-2">
                <Ban size={15} /> Revogar Acesso
              </button>
            ) : (
              <button onClick={() => onStatusUpdate(UserStatus.APPROVED)} className="w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-black hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                <Power size={15} /> Reativar Acesso
              </button>
            )}

            {onRoleUpdate && user.role !== Role.ADMIN && (
              <button
                onClick={() => {
                  const newRole = user.role === Role.RETAILER ? Role.RESELLER : Role.RETAILER;
                  const label = newRole === Role.RESELLER ? 'REVENDEDOR' : 'LOJISTA';
                  if (confirm(`Deseja alterar o cargo de "${user.storeName}" para ${label}?`)) {
                    onRoleUpdate(newRole);
                  }
                }}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl text-xs font-black border border-gray-200 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
              >
                <ArrowRight size={15} />
                {user.role === Role.RETAILER ? 'Promover a Revendedor' : 'Converter em Lojista'}
              </button>
            )}

            {onPermissionToggle && user.role !== Role.ADMIN && (
              <button
                onClick={() => onPermissionToggle('admin_panel')}
                className={`w-full py-3 px-4 rounded-xl text-xs font-black border transition-all flex items-center gap-2 ${
                  user.permissions?.includes('admin_panel')
                    ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                }`}
              >
                <ShieldCheck size={15} />
                Acesso ao Painel Admin
                <span className={`ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                  user.permissions?.includes('admin_panel')
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  {user.permissions?.includes('admin_panel') ? 'Ativo' : 'Inativo'}
                </span>
              </button>
            )}

            {/* Vinculation: Link RETAILER to RESELLER */}
            {user.role === Role.RETAILER && (
              <div className="bg-gray-100 p-4 rounded-xl border border-gray-200">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2.5">Vínculo com Revendedor</p>
                {linkedReseller ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-gray-800 truncate">{linkedReseller.reseller.storeName}</p>
                      <p className="text-[9px] text-gray-500 font-medium truncate">Vinculado como: {linkedReseller.client.tradeName || linkedReseller.client.companyName}</p>
                    </div>
                    <button onClick={async () => {
                      if (!confirm('Remover vínculo deste lojista com o revendedor?')) return;
                      const updated = { ...linkedReseller.client, linkedUserId: undefined };
                      await db.saveResellerClient(updated as any);
                      setLinkedReseller(null);
                    }} className="px-3 py-1.5 bg-white text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-all flex-shrink-0">Desvincular</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select value={selectedResellerId} onChange={e => setSelectedResellerId(e.target.value)}
                      className="flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 outline-none focus:border-gray-400">
                      <option value="">Selecionar revendedor...</option>
                      {allUsers.map(r => <option key={r.id} value={r.id}>{r.storeName}</option>)}
                    </select>
                    <button disabled={!selectedResellerId} onClick={async () => {
                      const existing = allClients.find(c => c.linkedUserId === user.id);
                      if (existing) { alert('Este lojista j\u00e1 est\u00e1 vinculado a outro revendedor.'); return; }
                      const newClient: ResellerClient = {
                        id: crypto.randomUUID(), resellerId: selectedResellerId, linkedUserId: user.id,
                        companyName: user.storeName, tradeName: user.storeName, cnpj: user.cnpj,
                        phone: user.phone, email: user.email, notes: 'Vinculado pelo admin', status: 'ACTIVE',
                        createdAt: new Date().toISOString()
                      };
                      await db.saveResellerClient(newClient);
                      const reseller = allUsers.find(u => u.id === selectedResellerId);
                      if (reseller) setLinkedReseller({ reseller, client: newClient });
                      setSelectedResellerId('');
                    }} className="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50 flex-shrink-0">Vincular</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-full md:w-1/2 bg-gray-50/30 p-6 md:p-10 overflow-y-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-gray-400">Atividade Comercial</p>
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2"><ShoppingBag size={20} style={{ color: settings.primaryColor }} /> Histórico de Pedidos</h3>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-gray-200 rounded-full text-gray-400 transition-colors hidden md:block"><X size={24} /></button>
          </div>
          <div className="space-y-4">
            {userOrders.length > 0 ? (
              userOrders.map((order) => (
                <div key={order.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-gray-300 transition-all">
                  <div>
                    <p className="text-xs font-black text-gray-900 mb-0.5">#{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(order.date).toLocaleDateString()}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${order.status === 'COMPLETED' ? 'bg-green-500' : order.status === 'CANCELED' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                      <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">{statusLabels[order.status]}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right mr-2">
                      <p className="font-black text-lg" style={{ color: settings.primaryColor }}>R$ {formatPrice(order.total)}</p>
                    </div>
                    <button
                      onClick={() => setViewingOrder(order)}
                      className="p-2.5 bg-gray-50 text-gray-400 hover:bg-gray-900 hover:text-white rounded-xl transition-all shadow-sm"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white/50 rounded-[1rem] border-2 border-dashed border-gray-100">
                <Package className="mx-auto text-gray-200 mb-3" size={48} />
                <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Nenhum pedido</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {
        viewingOrder && (
          <OrderDetailsModal
            order={viewingOrder}
            onClose={() => setViewingOrder(null)}
            onStatusChange={handleOrderStatusUpdate}
            onDownload={() => handleDownloadPDF(viewingOrder)}
            zIndex={zIndex + 50}
          />
        )
      }
    </div >, document.body
  );
};

export const AdminDashboard: React.FC = () => {
  const { settings } = useContext(AppContext);
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [stats, setStats] = useState({
    totalFaturamento: 0,
    faturamentoPendente: 0,
    totalPedidos: 0,
    ticketMedio: 0,
    lojistasAtivos: 0,
    produtosCatalogo: 0,
    itensBaixoEstoque: 0,
    lojistasPendentes: 0,
    pedidosAbertos: 0,
    statusDistribution: {
      ANALYSIS: 0,
      APPROVED: 0,
      PENDING: 0,
      SHIPPED: 0,
      COMPLETED: 0,
      CANCELED: 0
    } as Record<string, number>
  });

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  const showFeedback = (message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 3000);
  };

  useEffect(() => {
    // Corrected: loadStats is now async to handle promises from db methods
    const loadStats = async () => {
      const [orders, users, products] = await Promise.all([
        db.getOrders(),
        db.getUsers(),
        db.getProducts()
      ]);

      const completedOrders = orders.filter(o => o.status === 'COMPLETED');
      const pendingOrders = orders.filter(o => o.status === 'PENDING');
      const activeRetailers = users.filter(u => u.role === Role.RETAILER && u.status === UserStatus.APPROVED);
      const pendingRetailersList = users.filter(u => u.role === Role.RETAILER && u.status === UserStatus.PENDING);
      const lowStock = products.filter(p => p.stock < 10);

      const faturamentoTotal = completedOrders.reduce((acc, o) => acc + o.total, 0);
      const fatPendente = pendingOrders.reduce((acc, o) => acc + o.total, 0);

      // Calculating status distribution for the pie chart area
      const distribution = (Object.keys(statusLabels) as OrderStatus[]).reduce((acc, status) => {
        acc[status] = orders.filter(o => o.status === status).length;
        return acc;
      }, {} as Record<OrderStatus, number>);

      setStats({
        totalFaturamento: faturamentoTotal,
        faturamentoPendente: fatPendente,
        totalPedidos: orders.length,
        ticketMedio: completedOrders.length > 0 ? faturamentoTotal / completedOrders.length : 0,
        lojistasAtivos: activeRetailers.length,
        produtosCatalogo: products.length,
        itensBaixoEstoque: lowStock.length,
        lojistasPendentes: pendingRetailersList.length,
        pedidosAbertos: pendingOrders.length,
        statusDistribution: distribution
      });

      setRecentOrders(orders.slice(0, 5));
    };

    loadStats();
  }, []);

  const handleExportAll = async () => {
    try {
      showFeedback('Gerando relatório consolidado...');
      const [users, products, orders] = await Promise.all([
        db.getUsers(),
        db.getProducts(),
        db.getOrders()
      ]);

      const workbook = XLSX.utils.book_new();

      // Aba Lojistas
      const usersWS = XLSX.utils.json_to_sheet(users.map(u => ({
        'Nome/Loja': u.storeName,
        'Responsável': u.responsibleName,
        'CNPJ': u.cnpj,
        'E-mail': u.email,
        'Telefone': u.phone,
        'Status': u.status,
        'Data Cadastro': new Date(u.createdAt).toLocaleDateString()
      })));
      XLSX.utils.book_append_sheet(workbook, usersWS, "Lojistas");

      // Aba Produtos
      const productsWS = XLSX.utils.json_to_sheet(products.map(p => ({
        'SKU': p.internalCode,
        'Nome': p.name,
        'Grupo': p.group,
        'Montadora': p.manufacturer,
        'Preço': p.price,
        'Estoque': p.stock,
        'Ativo': p.active ? 'Sim' : 'Não'
      })));
      XLSX.utils.book_append_sheet(workbook, productsWS, "Produtos");

      // Aba Pedidos
      const ordersWS = XLSX.utils.json_to_sheet(orders.map(o => ({
        'ID': o.id.toUpperCase(),
        'Cliente': o.userStoreName,
        'Total': o.total,
        'Status': statusLabels[o.status],
        'Data': new Date(o.date).toLocaleDateString()
      })));
      XLSX.utils.book_append_sheet(workbook, ordersWS, "Pedidos");

      XLSX.writeFile(workbook, `Relatorio_Consolidado_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    } catch (e) {
      alert('Erro ao exportar relatório.');
    }
  };

  return (
    <>
    <FeedbackToast message={toast.message} visible={toast.visible} primaryColor={settings.primaryColor} />
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Painel Executivo</p>
          <h1 className="text-3xl font-black text-gray-900">Visão Analítica</h1>
        </div>
        <div className="flex gap-2 bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
          <button className="px-4 py-2 bg-gray-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest">Tempo Real</button>
          <button onClick={handleExportAll} className="px-4 py-2 text-gray-400 hover:bg-gray-50 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">Relatórios</button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-8 rounded-[1.25rem] bg-gray-900 text-white shadow-2xl shadow-gray-200 flex flex-col justify-between group overflow-hidden relative">
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform z-0">
            <DollarSign size={120} />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Faturamento (Concluídos)</p>
            <p className="text-3xl font-black">R$ {formatPrice(stats.totalFaturamento)}</p>
          </div>
          <div className="mt-8 flex items-center gap-2 text-green-400 text-xs font-bold relative z-10">
            <TrendingUp size={14} /> +12% vs mês anterior
          </div>
        </div>

        <div className="p-8 rounded-[1.25rem] bg-white border border-gray-100 shadow-sm flex flex-col justify-between group overflow-hidden relative">
          <div className="absolute -right-4 -top-4 text-gray-50 group-hover:scale-110 transition-transform z-0">
            <Clock size={120} />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Projeção (Pendentes)</p>
            <p className="text-3xl font-black text-gray-900">R$ {formatPrice(stats.faturamentoPendente)}</p>
          </div>
          <div className="mt-8 flex items-center gap-2 text-gray-500 text-xs font-bold relative z-10">
            <BarChart3 size={14} /> {stats.pedidosAbertos} orçamentos ativos
          </div>
        </div>

        <div className="p-8 rounded-[1.25rem] bg-white border border-gray-100 shadow-sm flex flex-col justify-between group overflow-hidden relative">
          <div className="absolute -right-4 -top-4 text-gray-50 group-hover:scale-110 transition-transform z-0">
            <Users2 size={120} />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Ticket Médio</p>
            <p className="text-3xl font-black text-gray-900">R$ {formatPrice(stats.ticketMedio)}</p>
          </div>
          <div className="mt-8 flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest relative z-10">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div> Valor Unit. Médio
          </div>
        </div>

        <div className={`p-8 rounded-[1.25rem] shadow-sm flex flex-col justify-between group overflow-hidden relative border ${stats.itensBaixoEstoque > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
          <div className="absolute -right-4 -top-4 text-gray-900/5 group-hover:scale-110 transition-transform z-0">
            <AlertTriangle size={120} />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Saúde do Estoque</p>
            <p className={`text-3xl font-black ${stats.itensBaixoEstoque > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.itensBaixoEstoque}
            </p>
          </div>
          <div className={`mt-8 flex items-center gap-2 text-xs font-bold relative z-10 ${stats.itensBaixoEstoque > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.itensBaixoEstoque > 0 ? 'Itens com baixo estoque' : 'Estoque saudável'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lado Esquerdo: Ações Pendentes */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[1.25rem] border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-gray-900 flex items-center gap-2"><ShieldAlert size={18} className="text-gray-400" /> Pendências</h3>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">Ação Necessária</span>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => navigate('/admin/users?status=PENDING')}
                className="w-full p-5 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between group hover:border-primary transition-all"
              >
                <div className="text-left">
                  <p className="text-xs font-black text-gray-900 mb-0.5">{stats.lojistasPendentes} Lojistas</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Aguardando Aprovação</p>
                </div>
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-300 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                  <ArrowRight size={18} />
                </div>
              </button>

              <button
                onClick={() => navigate('/admin/orders?status=PENDING')}
                className="w-full p-5 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between group hover:border-primary transition-all"
              >
                <div className="text-left">
                  <p className="text-xs font-black text-gray-900 mb-0.5">{stats.pedidosAbertos} Pedidos</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Novos Orçamentos</p>
                </div>
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-300 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                  <ArrowRight size={18} />
                </div>
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[1.25rem] border border-gray-100 shadow-sm">
            <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2"><PieChart size={18} className="text-primary" /> Fluxo de Status</h3>
            <div className="space-y-5">
              {(Object.keys(statusLabels) as OrderStatus[]).map(status => {
                // Corrected: use distribution from stats state calculated in useEffect
                const count = stats.statusDistribution[status];
                const percentage = stats.totalPedidos > 0 ? (count / stats.totalPedidos) * 100 : 0;
                return (
                  <div key={status} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-gray-500">{statusLabels[status]}</span>
                      <span className="text-gray-900">{count} un.</span>
                    </div>
                    <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%`, backgroundColor: settings.primaryColor }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Lado Direito: Atividade Recente */}
        <div className="lg:col-span-2 bg-white rounded-[1.25rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-8 py-8 border-b border-gray-50 flex justify-between items-center">
            <div>
              <h3 className="font-black text-gray-900 flex items-center gap-2"><Clock size={18} className="text-gray-400" /> Atividade Recente</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Últimos 5 pedidos processados</p>
            </div>
            <button onClick={() => navigate('/admin/orders')} className="p-3 text-gray-400 hover:text-gray-900 transition-colors"><ExternalLink size={20} /></button>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Pedido</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <p className="text-xs font-black text-gray-900">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-[10px] text-gray-400 font-bold">{new Date(order.date).toLocaleDateString()}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-extrabold text-gray-900 group-hover:text-primary transition-colors">{order.userStoreName}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-black" style={{ color: settings.primaryColor }}>R$ {formatPrice(order.total)}</p>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="px-3 py-1 rounded-full text-[9px] font-black border border-gray-100 bg-gray-50 text-gray-500 uppercase tracking-widest">
                        {statusLabels[order.status]}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                      <Package className="mx-auto text-gray-200 mb-4" size={48} />
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Nenhuma atividade registrada</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-6 bg-gray-50/50 border-t border-gray-50 text-center">
            <button
              onClick={() => navigate('/admin/orders')}
              className="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:opacity-80 transition-opacity"
            >
              Ver histórico completo de operações
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export const AdminProducts: React.FC = () => {
  const { settings } = useContext(AppContext);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ identification: true });
  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'relevance' | 'code-asc' | 'code-desc' | 'price-asc' | 'price-desc'>('relevance');
  const itemsPerPage = 20;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = (message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 3000);
  };


  // State for upload process
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  // Corrected: load is now async to handle promise from db.getProducts()
  const load = async () => {
    const data = await db.getProducts();
    setProducts([...data]);
  };
  useEffect(() => { load(); }, []);

  const openModal = (p?: Product) => {
    setFormData(p || {
      id: crypto.randomUUID(),
      internalCode: '',
      parallelCodes: '',
      kitComponents: '',
      name: '',
      description: '',
      manufacturer: '',
      vehicle: '',
      application: '',
      group: GROUPS[0],
      position: POSITIONS[0],
      price: 0,
      images: [],
      compatibility: [], // Garante inicialização
      stock: 10,
      active: true
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.images || formData.images.length === 0) {
      formData.images = ['https://picsum.photos/400/400?random=' + Math.random()];
    }
    await db.saveProduct(formData as Product);
    setIsModalOpen(false);
    load();
    showFeedback('Produto salvo com sucesso!');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir permanentemente este item?')) {
      await db.deleteProduct(id);
      load();
      showFeedback('Produto excluído.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await db.uploadImage(file);
      setFormData(prev => ({
        ...prev,
        images: [...(prev.images || []), base64]
      }));
      showFeedback('Imagem adicionada!');
    } catch (err) {
      console.error(err);
      alert('Erro ao processar imagem.');
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    }));
  };

  const exportToExcel = () => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(products.map(p => {
        const img = p.images?.[0] || '';
        const imageToExport = img.startsWith('data:') ? '[IMAGEM LOCAL / BASE64]' : img;

        // Format compatibility to string with years
        // Group compatibility by manufacturer for cleaner export
        const compMap: Record<string, string[]> = {};
        (p.compatibility || []).forEach(c => {
          if (!compMap[c.manufacturer]) compMap[c.manufacturer] = [];
          const yearsStr = (c.years && c.years.length > 0) ? `(${c.years.join(',')})` : '';
          compMap[c.manufacturer].push(c.vehicle + yearsStr);
        });

        const compatibilityStr = Object.entries(compMap)
          .map(([m, vs]) => `${m}: ${vs.join(', ')}`)
          .join('; ');

        return {
          'Código Interno': p.internalCode,
          'Conversão': p.parallelCodes,
          'Componentes do Kit': p.kitComponents,
          'Nome': p.name,
          'Descrição': p.description,
          'Compatibilidade': compatibilityStr, // Legacy: Montadora/Veículo removed
          'Aplicação': p.application,
          'Grupo': p.group,
          'Posição': p.position,
          'Preço': p.price,
          'Preço Promocional': p.promo_price || 0,
          'Estoque': p.stock,
          'Texto Estoque': p.min_stock_display || '',
          'Ativo': p.active ? 'Sim' : 'Não',
          'Imagem URL': imageToExport
        };
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos");
      XLSX.writeFile(workbook, "catalogo_produtos.xlsx");
      showFeedback('Catálogo exportado!');
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar Excel. Verifique se os dados não excedem os limites do Excel.');
    }
  };

  const downloadTemplate = () => {
    const template = [{
      'internalCode': 'CÓDIGO-01',
      'parallelCodes': '93300, 4423-B',
      'kitComponents': 'COX-123 (Coxim), ROL-456 (Rolamento)',
      'name': 'Nome da Peça',
      'description': 'Breve descrição técnica',
      'application': 'Veículo Ano Motor',
      // 'manufacturer': 'Volkswagen', // Removido
      // 'vehicle': 'Gol G5',          // Removido
      'compatibility': 'Volkswagen: Gol G5(2010-2015); Ford: Fiesta(2014,2015,2016)', // Exemplo formato com anos
      'group': 'Suspensão',
      'position': 'Dianteiro Direito',
      'price': 150.00,
      'promo_price': 0.00,
      'stock': 10,
      'min_stock_display': 'Mais de 100', // Opcional
      'Imagem URL': 'https://link-da-imagem.com/foto.jpg'
    }];
    const worksheet = XLSX.utils.json_to_sheet(template);
    // Rename headers to be user friendly (optional, but good for template)
    XLSX.utils.sheet_add_aoa(worksheet, [[
      "Código Interno", "Conversão", "Componentes do Kit", "Nome", "Descrição", "Aplicação",
      "Compatibilidade", "Grupo", "Posição", "Preço", "Preço Promocional", "Estoque", "Texto Estoque", "Imagem URL"
    ]], { origin: "A1" });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
    XLSX.writeFile(workbook, "modelo_importacao_produtos.xlsx");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const newProducts: Product[] = [];

        for (const row of data as any[]) {
          // Parse compatibility logic
          let compatibilityItems: CompatibilityItem[] = [];
          const compRaw = row['Compatibilidade'] || row['Compatibilidade (Montadora: Veículo)'] || '';

          if (compRaw) {
            const compStr = String(compRaw);
            // Format: "VW: Gol(2010-2015); Fiat: Palio(2000,2001)" OR "VW: Gol, Saveiro; Fiat: Uno"
            compatibilityItems = compStr.split(';').flatMap(pair => {
              const [m, vStr] = pair.split(':').map(s => s.trim());
              if (m && vStr) {
                // Support multiple vehicles separated by comma for the same manufacturer
                // Split by comma but not commas inside parentheses
                const vehicleParts: string[] = [];
                let depth = 0;
                let current = '';
                for (const ch of vStr) {
                  if (ch === '(') depth++;
                  if (ch === ')') depth--;
                  if (ch === ',' && depth === 0) {
                    vehicleParts.push(current.trim());
                    current = '';
                  } else {
                    current += ch;
                  }
                }
                if (current.trim()) vehicleParts.push(current.trim());

                return vehicleParts.map(vRaw => {
                  // Parse years from parentheses: "Ecosport(2020-2025)" or "Fit(2018,2019,2020)"
                  const yearMatch = vRaw.match(/^(.+?)\(([^)]+)\)$/);
                  let vehicleName = vRaw;
                  let years: number[] = [];
                  if (yearMatch) {
                    vehicleName = yearMatch[1].trim();
                    const yearStr = yearMatch[2];
                    years = yearStr.split(',').flatMap(part => {
                      const trimmed = part.trim();
                      const rangeMatch = trimmed.match(/^(\d{4})\s*-\s*(\d{4})$/);
                      if (rangeMatch) {
                        const start = parseInt(rangeMatch[1]);
                        const end = parseInt(rangeMatch[2]);
                        const range: number[] = [];
                        for (let y = Math.min(start, end); y <= Math.max(start, end); y++) range.push(y);
                        return range;
                      }
                      const num = parseInt(trimmed);
                      return isNaN(num) ? [] : [num];
                    });
                  }
                  return {
                    id: crypto.randomUUID(),
                    manufacturer: m,
                    vehicle: vehicleName,
                    ...(years.length > 0 ? { years } : {})
                  };
                }).filter(item => item.vehicle);
              }
              return [];
            });
          }

          const product: Product = {
            id: row['ID (Não alterar)'] || crypto.randomUUID(),
            internalCode: String(row['Código Interno'] || row['SKU'] || ''),
            name: String(row['Nome'] || ''),
            price: parseFloat(row['Preço'] || '0'),
            promo_price: parseFloat(row['Preço Promocional'] || '0'),
            stock: parseInt(row['Estoque'] || '0'),
            min_stock_display: row['Texto Estoque'] ? String(row['Texto Estoque']) : undefined,
            description: String(row['Descrição'] || row.description || ''),
            group: String(row['Grupo'] || ''),
            position: String(row['Posição'] || ''),
            manufacturer: String(row['Montadora'] || row.manufacturer || ''), // Mantém fallback para leitura se existir
            vehicle: String(row['Veículo'] || row.vehicle || ''),             // Mantém fallback para leitura se existir
            compatibility: compatibilityItems,
            application: String(row['Aplicação'] || row.application || ''),
            parallelCodes: String(row['Conversão'] || row['Códigos Paralelos'] || ''),
            kitComponents: String(row['Componentes do Kit'] || row.kitComponents || ''),
            images: row['Imagem URL'] ? String(row['Imagem URL']).split(',').map(s => s.trim()) : (row['Imagens'] ? String(row['Imagens']).split(',') : []),
            active: row['Ativo'] === undefined || row['Ativo'] === null || row['Ativo'] === ''
              ? true  // Se não tem coluna "Ativo", produto é ativo por padrão
              : String(row['Ativo']).toUpperCase() === 'SIM' || String(row['Ativo']).toUpperCase() === 'TRUE' || row['Ativo'] === true || row['Ativo'] === 1
          };

          if (product.internalCode) { // Basic validation
            newProducts.push(product);
          }
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadComplete(false);

        if (confirm(`Encontrados ${newProducts.length} produtos. Deseja importar/atualizar? Isso substituirá dados existentes com mesmos IDs.`)) {
          await db.replaceProducts(newProducts, (percent) => {
            setUploadProgress(percent);
          });

          // Mostrar animação de sucesso
          setUploadComplete(true);
          setUploadedCount(newProducts.length);
          setUploadProgress(100);

          load();

          // Esperar 2.5s para o usuário ver a animação de sucesso
          await new Promise(r => setTimeout(r, 2500));

          setIsUploading(false);
          setUploadProgress(0);
          setUploadComplete(false);
          showFeedback(`${data.length} produtos importados com sucesso!`);
        } else {
          setIsUploading(false);
          setUploadProgress(0);
        }
      } catch (err) {
        console.error(err);
        setIsUploading(false);
        setUploadProgress(0);
        setUploadComplete(false);
        alert(`Erro ao importar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const filteredProducts = products.filter(p => {
    const term = normalize(searchTerm);
    const name = p.name || '';
    const internal = p.internalCode || '';
    const app = p.application || '';
    const parallel = p.parallelCodes || '';

    return normalize(name).includes(term) ||
      normalize(internal).includes(term) ||
      normalize(app).includes(term) ||
      normalize(parallel).includes(term);
  }).sort((a, b) => {
    switch (sortBy) {
      case 'code-asc':
        return (a.internalCode || '').localeCompare(b.internalCode || '');
      case 'code-desc':
        return (b.internalCode || '').localeCompare(a.internalCode || '');
      case 'price-asc':
        return (a.price || 0) - (b.price || 0);
      case 'price-desc':
        return (b.price || 0) - (a.price || 0);
      case 'relevance':
      default:
        return 0;
    }
  });

  return (
    <>
    <FeedbackToast message={toast.message} visible={toast.visible} primaryColor={settings.primaryColor} />

    {/* Upload Overlay - fora do space-y */}
    {isUploading && createPortal(
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center space-y-6 animate-in zoom-in duration-300">
            {!uploadComplete ? (
              <>
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <Loader2 className="animate-spin" size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">Atualizando Catálogo</h3>
                  <p className="text-sm text-gray-500 font-medium mt-1">Enviando produtos em lotes...</p>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-right">{uploadProgress}% Concluído</p>
                </div>
              </>
            ) : (
              <>
                {/* Partículas de celebração */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-3xl">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6],
                        left: `${10 + Math.random() * 80}%`,
                        top: `${10 + Math.random() * 80}%`,
                        animation: `confetti-pop 0.6s ease-out ${i * 0.05}s forwards`,
                        opacity: 0,
                        transform: 'scale(0)'
                      }}
                    />
                  ))}
                </div>

                {/* Ícone de sucesso com animação */}
                <div className="relative mx-auto mb-2" style={{ width: 80, height: 80 }}>
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundColor: '#22c55e20',
                      animation: 'success-ring 0.5s ease-out forwards'
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ animation: 'success-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards', opacity: 0, transform: 'scale(0)' }}
                  >
                    <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-200">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path
                          d="M5 13l4 4L19 7"
                          style={{
                            strokeDasharray: 24,
                            strokeDashoffset: 24,
                            animation: 'checkmark-draw 0.4s ease-out 0.5s forwards'
                          }}
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div style={{ animation: 'success-bounce 0.5s ease-out 0.4s forwards', opacity: 0, transform: 'translateY(10px)' }}>
                  <h3 className="text-xl font-black text-green-600">Importação Concluída!</h3>
                  <p className="text-sm text-gray-500 font-medium mt-1">
                    <span className="font-black text-gray-900">{uploadedCount}</span> produtos importados com sucesso
                  </p>
                </div>

                <div className="space-y-2" style={{ animation: 'success-bounce 0.5s ease-out 0.5s forwards', opacity: 0 }}>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-full transition-all duration-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]"></div>
                  </div>
                  <p className="text-xs font-bold text-green-600 uppercase tracking-widest text-right">100% Concluído ✓</p>
                </div>
              </>
            )}
          </div>
        </div>, document.body
    )}

    {/* Keyframes para animações de sucesso */}
    <style>{`
      @keyframes checkmark-draw {
        to { stroke-dashoffset: 0; }
      }
      @keyframes success-bounce {
        0% { opacity: 0; transform: scale(0) translateY(10px); }
        60% { transform: scale(1.1) translateY(-2px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes success-ring {
        0% { transform: scale(0); opacity: 0; }
        50% { transform: scale(1.3); opacity: 0.5; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes confetti-pop {
        0% { opacity: 0; transform: scale(0) translateY(0); }
        50% { opacity: 1; transform: scale(1.5); }
        100% { opacity: 0; transform: scale(0.5) translateY(-30px); }
      }
    `}</style>

    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header Visual Revitalizado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Gestão de Inventário</p>
          <h1 className="text-3xl font-black text-gray-900">Catálogo de Peças</h1>
        </div>

        <div className="flex gap-4">
          <div className="bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Cadastrados</p>
            <p className="text-lg font-black text-gray-900">{products.length}</p>
          </div>
          <div className="bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Baixo Estoque</p>
            <p className="text-lg font-black text-red-600">{products.filter(p => p.stock < 10).length}</p>
          </div>
        </div>
      </div>

      {/* Barra de Ações Revitalizada com Barra de Pesquisa */}
      <div className="bg-white p-6 rounded-[1rem] border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none px-5 py-3 bg-gray-50 text-gray-600 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-gray-900 hover:text-white">
              <FileUp size={16} /> Importar
            </button>
            <button onClick={exportToExcel} className="flex-1 md:flex-none px-5 py-3 bg-gray-50 text-gray-600 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-gray-900 hover:text-white">
              <FileDown size={16} /> Exportar
            </button>
            <button onClick={downloadTemplate} className="flex-1 md:flex-none px-5 py-3 bg-gray-50 text-gray-600 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-gray-900 hover:text-white">
              <Download size={16} /> Modelo
            </button>
          </div>

          <button
            onClick={() => openModal()}
            className="w-full md:w-auto px-6 py-4 text-white rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] shrink-0"
            style={{ backgroundColor: settings.primaryColor, boxShadow: `0 10px 25px -5px ${settings.primaryColor}50` }}
          >
            <Plus size={20} /> Cadastrar Peça
          </button>
        </div>

        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Pesquisar por Nome, SKU, Aplicação ou Conversão..."
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all text-sm"
            style={{ '--tw-ring-color': `${settings.primaryColor}20` } as any}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 shrink-0">Ordenar por</span>
          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value as any); setCurrentPage(1); }}
            className="bg-white border border-gray-200 rounded-xl py-2 px-3 font-bold text-sm text-gray-700 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 w-full sm:w-auto"
          >
            <option value="relevance">Relevância</option>
            <option value="code-asc">Código (A-Z)</option>
            <option value="code-desc">Código (Z-A)</option>
            <option value="price-asc">Menor Preço</option>
            <option value="price-desc">Maior Preço</option>
          </select>
        </div>
      </div>

      {/* Tabela Revitalizada */}
      <div className="bg-white rounded-[1.25rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <ErrorBoundary scope="lista de produtos">
            <table className="min-w-full divide-y divide-gray-50">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Produto / SKU</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Grupo</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor</th>
                  <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Estoque</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shadow-sm flex-shrink-0">
                          <img loading="lazy" src={p.images[0] || 'https://via.placeholder.com/150?text=Sem+Img'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div>
                          <p className="font-extrabold text-sm text-gray-900 leading-tight group-hover:text-primary transition-colors line-clamp-2">{p.name}</p>
                          <p className="text-[10px] uppercase font-black tracking-widest mt-0.5 text-gray-400">SKU: {p.internalCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-gray-100 text-gray-500 rounded-full border border-gray-200">
                        {p.group}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      {p.promo_price && p.promo_price > 0 && p.promo_price < (p.price || 0) ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-400 line-through font-bold">R$ {formatPrice(p.price || 0)}</span>
                          <span className="text-sm font-black text-red-600">R$ {formatPrice(p.promo_price)}</span>
                        </div>
                      ) : (
                        <p className="text-sm font-black text-gray-900">R$ {formatPrice(p.price || 0)}</p>
                      )}
                    </td>
                    <td className="px-8 py-5 text-center">
                      {p.min_stock_display ? (
                        <span className="px-3 py-1 rounded-full text-[10px] font-black border border-blue-100 bg-blue-50 text-blue-600 uppercase tracking-widest">
                          {p.min_stock_display}
                        </span>
                      ) : (
                        <div className="flex flex-col items-center">
                          <p className={`text-sm font-black ${p.stock < 10 ? 'text-red-600' : 'text-gray-700'}`}>{p.stock}</p>
                          <div className="w-12 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${p.stock < 10 ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(100, (p.stock / 50) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openModal(p)} className="p-3 text-gray-300 hover:text-gray-900 hover:bg-white rounded-xl transition-all shadow-sm"><Edit size={18} /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-3 text-gray-300 hover:text-red-600 hover:bg-white rounded-xl transition-all shadow-sm"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErrorBoundary>
        </div>

        {filteredProducts.length === 0 && (
          <div className="py-20 text-center">
            <PackageOpen size={60} className="mx-auto text-gray-100 mb-6" />
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Nenhum produto encontrado</p>
          </div>
        )}

        {/* Paginação */}
        {filteredProducts.length > 0 && (
          <div className="px-8 py-6 border-t border-gray-50 flex items-center justify-between bg-gray-50/30">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Mostrando <span className="text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="text-gray-900">{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</span> de <span className="text-gray-900">{filteredProducts.length}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Anterior
              </button>
              <div className="flex items-center px-4 bg-white border border-gray-200 rounded-xl">
                <span className="text-xs font-black text-gray-900">{currentPage}</span>
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredProducts.length / itemsPerPage), p + 1))}
                disabled={currentPage >= Math.ceil(filteredProducts.length / itemsPerPage)}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 w-full h-full bg-black/50 flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
          <form onSubmit={handleSave} className="bg-gray-100 rounded-[1rem] md:rounded-[1.25rem] shadow-2xl max-w-7xl w-full h-[90vh] flex overflow-hidden animate-in zoom-in duration-300 border border-gray-200">

            {/* LEFT SIDEBAR - VISUALS & KEY METRICS */}
            <div className="w-1/3 min-w-[350px] bg-white p-6 flex flex-col border-r border-gray-200 overflow-y-auto relative">
              <div className="mb-4 flex justify-between items-start">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-gray-400">
                    {formData.id ? 'Editando Produto' : 'Novo Produto'}
                  </p>
                  <h2 className="font-black text-gray-900 text-xl leading-tight">
                    {formData.name || 'Sem Nome'}
                  </h2>
                </div>
              </div>

              {/* IMAGES SECTION */}
              <div className="mb-4">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 block mb-2">Galeria de Imagens</label>
                <div className="grid grid-cols-2 gap-3">
                  {(formData.images || []).map((img, idx) => (
                    <div key={idx} className="relative group aspect-square">
                      <img src={img} className="w-full h-full rounded-2xl object-cover border border-gray-100 bg-gray-50" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-2 right-2 bg-white/90 text-red-500 p-1.5 rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                  >
                    <ImagePlus size={28} />
                    <span className="text-[9px] font-black uppercase tracking-wider">Adicionar</span>
                  </button>
                  <input type="file" ref={imageInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                </div>
              </div>

              {/* KEY METRICS SECTION */}
              <div className="space-y-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Preço (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">R$</span>
                      <input
                        required
                        type="number"
                        step="0.01"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 focus:border-gray-400 rounded-xl outline-none font-black text-base text-gray-800 transition-all"
                        value={formData.price || 0}
                        onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Promo (Opcional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400 font-bold text-sm">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 focus:border-gray-400 rounded-xl outline-none font-black text-base text-red-600 transition-all placeholder:text-gray-300"
                        value={formData.promo_price || ''}
                        onChange={e => setFormData({ ...formData, promo_price: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Estoque</label>
                    <input
                      required
                      type="number"
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 focus:border-gray-400 rounded-xl outline-none font-black text-base text-gray-800 transition-all"
                      value={formData.stock || 0}
                      onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Texto Estoque</label>
                    <input
                      type="text"
                      placeholder="Ex: 100+..."
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 focus:border-gray-400 rounded-xl outline-none font-bold text-sm text-gray-600 transition-all"
                      value={formData.min_stock_display || ''}
                      onChange={e => setFormData({ ...formData, min_stock_display: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1"></div>

              {/* ACTIONS FOOTER */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white pb-1">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="flex-[2] py-3.5 text-white rounded-xl font-bold shadow-lg shadow-gray-200 transition-all hover:scale-[1.02] active:scale-95" style={{ backgroundColor: settings.primaryColor }}>Salvar Alterações</button>
              </div>
            </div>

            {/* RIGHT MAIN CONTENT - ORGANIZED FIELDS */}
            <div className="flex-1 bg-gray-50/50 flex flex-col overflow-hidden">
              {/* Header fixo */}
              <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-white flex-shrink-0">
                <h3 className="font-bold text-gray-800">Detalhes do Produto</h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-3xl mx-auto space-y-8 pb-20">

                {/* SECTION: IDENTIFICATION */}
                <div className="bg-white rounded-[1rem] shadow-sm border border-gray-100 overflow-hidden">
                  <button type="button" onClick={() => toggleSection('identification')} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Tag size={18} style={{ color: settings.primaryColor }} />
                      <div className="text-left">
                        <h3 className="font-bold text-gray-800">Identificação</h3>
                        <p className="text-xs text-gray-400">Nome, código interno e códigos paralelos</p>
                      </div>
                    </div>
                    <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${expandedSections.identification ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSections.identification && <div className="border-t border-gray-100 mx-5"></div>}
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 px-5 py-5 ${expandedSections.identification ? '' : 'hidden'}`}>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide ml-1">Nome Completo do Produto</label>
                      <input required className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:bg-white focus:border-gray-400 font-bold text-gray-700 transition-all" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide ml-1">Código Interno / SKU</label>
                      <input required className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:bg-white focus:border-gray-400 font-mono font-bold text-gray-700 uppercase transition-all" value={formData.internalCode || ''} onChange={e => setFormData({ ...formData, internalCode: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide ml-1">Códigos Paralelos</label>
                      <input className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:bg-white focus:border-gray-400 font-mono text-sm text-gray-600 transition-all" placeholder="Ex: 93301, AM-55..." value={formData.parallelCodes || ''} onChange={e => setFormData({ ...formData, parallelCodes: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* SECTION: CLASSIFICATION */}
                <div className="bg-white rounded-[1rem] shadow-sm border border-gray-100 overflow-hidden">
                  <button type="button" onClick={() => toggleSection('classification')} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Folder size={18} style={{ color: settings.primaryColor }} />
                      <div className="text-left">
                        <h3 className="font-bold text-gray-800">Classificação</h3>
                        <p className="text-xs text-gray-400">Grupo, posição e aplicação do produto</p>
                      </div>
                    </div>
                    <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${expandedSections.classification ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSections.classification && <div className="border-t border-gray-100 mx-5"></div>}
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 px-5 py-5 ${expandedSections.classification ? '' : 'hidden'}`}>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide ml-1">Grupo</label>
                      <select className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:bg-white focus:border-gray-400 font-bold text-gray-700 transition-all appearance-none" value={formData.group || ''} onChange={e => setFormData({ ...formData, group: e.target.value })}>
                        <option value="">Selecione...</option>
                        {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide ml-1">Posição</label>
                      <select className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:bg-white focus:border-gray-400 font-bold text-gray-700 transition-all appearance-none" value={formData.position || ''} onChange={e => setFormData({ ...formData, position: e.target.value })}>
                        <option value="">Selecione...</option>
                        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide ml-1">Aplicação (Descrição Completa)</label>
                      <textarea required className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:bg-white focus:border-gray-400 font-medium text-gray-600 transition-all h-24 resize-none" value={formData.application || ''} onChange={e => setFormData({ ...formData, application: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* SECTION: COMPATIBILITY */}
                <div className="bg-white rounded-[1rem] shadow-sm border border-gray-100 overflow-hidden">
                  <button type="button" onClick={() => toggleSection('compatibility')} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Car size={18} style={{ color: settings.primaryColor }} />
                      <div className="text-left">
                        <h3 className="font-bold text-gray-800">Compatibilidade</h3>
                        <p className="text-xs text-gray-400">Montadora, Veículo e Anos</p>
                      </div>
                    </div>
                    <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${expandedSections.compatibility ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSections.compatibility && <div className="border-t border-gray-100 mx-5"></div>}
                  <div className={`bg-gray-50 rounded-xl mx-5 my-5 p-4 space-y-4 ${expandedSections.compatibility ? '' : 'hidden'}`}>
                    <div className="flex gap-3">
                      <select
                        className="w-1/4 p-3 rounded-xl border border-gray-200 outline-none focus:border-green-500 font-bold text-sm bg-white"
                        id="comp-manufacturer"
                      >
                        <option value="">Montadora</option>
                        {MANUFACTURERS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input
                        className="flex-1 p-3 rounded-xl border border-gray-200 outline-none focus:border-green-500 font-medium text-sm bg-white"
                        placeholder="Veículo (Ex: Gol G5, Fox)"
                        id="comp-vehicle"
                      />
                      <input
                        className="w-1/4 p-3 rounded-xl border border-gray-200 outline-none focus:border-green-500 font-medium text-sm bg-white"
                        placeholder="Anos (Ex: 2020-2025)"
                        id="comp-years"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const mSelect = document.getElementById('comp-manufacturer') as HTMLSelectElement;
                            const vInput = document.getElementById('comp-vehicle') as HTMLInputElement;
                            const yInput = document.getElementById('comp-years') as HTMLInputElement;
                            const m = mSelect.value;
                            const v = vInput.value;
                            const yRaw = yInput.value.trim();
                            if (m && v) {
                              let years: number[] = [];
                              if (yRaw) {
                                years = yRaw.split(',').flatMap(part => {
                                  const trimmed = part.trim();
                                  const rangeMatch = trimmed.match(/^(\d{4})\s*-\s*(\d{4})$/);
                                  if (rangeMatch) {
                                    const start = parseInt(rangeMatch[1]);
                                    const end = parseInt(rangeMatch[2]);
                                    const range: number[] = [];
                                    for (let y = Math.min(start, end); y <= Math.max(start, end); y++) range.push(y);
                                    return range;
                                  }
                                  const num = parseInt(trimmed);
                                  return isNaN(num) ? [] : [num];
                                });
                              }
                              const newComp = { id: crypto.randomUUID(), manufacturer: m, vehicle: v, ...(years.length > 0 ? { years } : {}) };
                              setFormData(prev => ({
                                ...prev,
                                compatibility: [...(prev.compatibility || []), newComp]
                              }));
                              vInput.value = '';
                              yInput.value = '';
                              mSelect.focus();
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="bg-green-600 text-white px-5 rounded-xl font-bold hover:bg-green-700 transition-all shadow-md shadow-green-100 hover:shadow-lg"
                        onClick={() => {
                          const mSelect = document.getElementById('comp-manufacturer') as HTMLSelectElement;
                          const vInput = document.getElementById('comp-vehicle') as HTMLInputElement;
                          const yInput = document.getElementById('comp-years') as HTMLInputElement;
                          const m = mSelect.value;
                          const v = vInput.value;
                          const yRaw = yInput.value.trim();
                          if (m && v) {
                            let years: number[] = [];
                            if (yRaw) {
                              years = yRaw.split(',').flatMap(part => {
                                const trimmed = part.trim();
                                const rangeMatch = trimmed.match(/^(\d{4})\s*-\s*(\d{4})$/);
                                if (rangeMatch) {
                                  const start = parseInt(rangeMatch[1]);
                                  const end = parseInt(rangeMatch[2]);
                                  const range: number[] = [];
                                  for (let y = Math.min(start, end); y <= Math.max(start, end); y++) range.push(y);
                                  return range;
                                }
                                const num = parseInt(trimmed);
                                return isNaN(num) ? [] : [num];
                              });
                            }
                            const newComp = { id: crypto.randomUUID(), manufacturer: m, vehicle: v, ...(years.length > 0 ? { years } : {}) };
                            setFormData(prev => ({
                              ...prev,
                              compatibility: [...(prev.compatibility || []), newComp]
                            }));
                            vInput.value = '';
                            yInput.value = '';
                            mSelect.focus();
                          }
                        }}
                      >
                        +
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 min-h-[40px]">
                      {(formData.compatibility || []).map(item => (
                        <div key={item.id} className="bg-white border border-gray-200 pl-3 pr-2 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold text-gray-700 shadow-sm animate-in zoom-in duration-200">
                          <span className="text-green-600 uppercase">{item.manufacturer}</span>
                          <span className="text-gray-300">|</span>
                          <span className="uppercase">{item.vehicle}</span>
                          {item.years && item.years.length > 0 && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span className="text-blue-600 text-[10px]">{item.years[0]}-{item.years[item.years.length - 1]}</span>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              compatibility: (prev.compatibility || []).filter(c => c.id !== item.id)
                            }))}
                            className="ml-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full w-5 h-5 flex items-center justify-center transition-all"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {(formData.compatibility || []).length === 0 && (
                        <span className="text-gray-400 text-xs italic flex items-center h-full pl-2">Nenhuma compatibilidade adicionada.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* SECTION: DETAILS */}
                <div className="bg-white rounded-[1rem] shadow-sm border border-gray-100 overflow-hidden">
                  <button type="button" onClick={() => toggleSection('details')} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Package size={18} style={{ color: settings.primaryColor }} />
                      <div className="text-left">
                        <h3 className="font-bold text-gray-800">Detalhes Adicionais</h3>
                        <p className="text-xs text-gray-400">Componentes do kit e informações extras</p>
                      </div>
                    </div>
                    <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${expandedSections.details ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSections.details && <div className="border-t border-gray-100 mx-5"></div>}
                  <div className={`space-y-5 px-5 py-5 ${expandedSections.details ? '' : 'hidden'}`}>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide ml-1">Componentes do Kit (Opcional)</label>
                      <textarea className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:bg-white focus:border-gray-400 font-medium text-gray-600 transition-all h-20 resize-none" placeholder="Ex: COX-123 (Coxim), ROL-456 (Rolamento)..." value={formData.kitComponents || ''} onChange={e => setFormData({ ...formData, kitComponents: e.target.value })} />
                    </div>
                  </div>
                </div>

              </div>
              </div>
            </div>

          </form>
        </div>, document.body
      )}
    </div>
    </>
  );
};

export const AdminOrders: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { settings } = useContext(AppContext);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const initialFilter = (searchParams.get('status') as OrderStatus) || 'ALL';
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>(initialFilter);

  // Corrected: load is now async to handle promise from db.getOrders()
  const load = async () => {
    const data = await db.getOrders();
    setOrders(data);
  };

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) setFilter(statusParam as any);
  }, [searchParams]);

  useEffect(() => { load(); }, []);

  const handleStatus = async (status: OrderStatus) => {
    if (!selected) return;
    const upd = { ...selected, status };
    await db.updateOrder(upd);
    setSelected(upd);
    load();
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.')) return;
    await db.deleteOrder(orderId);
    if (selected?.id === orderId) setSelected(null);
    load();
  };

  const filteredOrders = orders.filter(o => {
    const matchesFilter = filter === 'ALL' ? true : o.status === filter;
    const q = normalize(searchQuery);
    const matchesSearch = normalize(o.id).includes(q) ||
      normalize(o.userStoreName).includes(q) ||
      normalize(o.clientName || '').includes(q);
    return matchesFilter && matchesSearch;
  });

  const generatePDF = async (order: Order) => {
    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const companyName = settings.companyName || 'MWE';

      // ====== HEADER COM LOGO ======
      let headerH = 38;
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageW, headerH, 'F');

      const logoUrl = settings.logoUrl;
      if (logoUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = logoUrl;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          const ratio = img.naturalWidth / img.naturalHeight;
          const logoH = 16;
          const logoW = logoH * ratio;
          doc.addImage(dataUrl, 'PNG', 14, (headerH - logoH) / 2, logoW, logoH);
        } catch {
          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text(companyName, 14, 24);
        }
      } else {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(companyName, 14, 24);
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 200, 200);
      doc.text('COMPROVANTE DE PEDIDO', pageW - 14, 16, { align: 'right' });
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(`#${order.id.slice(0, 8).toUpperCase()}`, pageW - 14, 26, { align: 'right' });

      // ====== INFORMAÇÕES DO PEDIDO ======
      let y = headerH + 12;
      const infoBoxH = order.clientName ? 42 : 30;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, y - 4, pageW - 28, infoBoxH, 3, 3, 'F');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(150);
      doc.text('DATA', 20, y + 2);
      doc.text('STATUS', 65, y + 2);
      doc.text('LOJISTA / REVENDEDOR', 115, y + 2);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(new Date(order.date).toLocaleDateString('pt-BR'), 20, y + 9);
      doc.text(statusLabels[order.status] || '', 65, y + 9);
      doc.text(order.userStoreName || '-', 115, y + 9);

      if (order.clientName) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(150);
        doc.text('CLIENTE FINAL', 20, y + 26);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(order.clientName, 20, y + 33);
      }

      y += infoBoxH + 12;

      // ====== TABELA DE ITENS ======
      const tableData = order.items.map((item: any) => [
        item.internalCode || '-',
        item.name || item.productName || '-',
        item.application || '-',
        String(item.quantity),
        `R$ ${formatPrice(item.price || 0)}`,
        `R$ ${formatPrice((item.price || 0) * (item.quantity || 1))}`
      ]);

      autoTable(doc, {
        startY: y,
        head: [['CÓDIGO', 'PRODUTO', 'APLICAÇÃO', 'QTD', 'UNIT.', 'SUBTOTAL']],
        body: tableData,
        theme: 'plain',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
          cellPadding: 5,
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 5,
          textColor: [50, 50, 50],
          lineColor: [230, 230, 230],
          lineWidth: 0.3
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 24, fontStyle: 'bold' },
          1: { cellWidth: 48 },
          2: { cellWidth: 44 },
          3: { halign: 'center', cellWidth: 16 },
          4: { halign: 'right', cellWidth: 26 },
          5: { halign: 'right', cellWidth: 26, fontStyle: 'bold' }
        },
        margin: { left: 14, right: 14 }
      });

      // ====== TOTAL DESTACADO ======
      const finalY = (doc as any).lastAutoTable.finalY + 8;
      const totalBoxW = 70;
      const totalBoxX = pageW - 14 - totalBoxW;

      doc.setFillColor(30, 41, 59);
      doc.roundedRect(totalBoxX, finalY, totalBoxW, 18, 3, 3, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 180, 180);
      doc.text('TOTAL GERAL', totalBoxX + 6, finalY + 7);
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(`R$ ${formatPrice(order.total)}`, totalBoxX + totalBoxW - 6, finalY + 13, { align: 'right' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      doc.text(`${order.items.length} ${order.items.length === 1 ? 'item' : 'itens'} no pedido`, 14, finalY + 12);

      if (order.paymentMethod) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80);
        doc.text(`Condição de Pagamento: ${order.paymentMethod}`, 14, finalY + 20);
      }

      let obsY = finalY + (order.paymentMethod ? 28 : 20);
      if (order.observations) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80);
        doc.text('Observações:', 14, obsY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        const obsLines = doc.splitTextToSize(order.observations, pageW - 28);
        doc.text(obsLines, 14, obsY + 6);
      }

      // ====== RODAPÉ ======
      const footerY = doc.internal.pageSize.getHeight() - 12;
      doc.setDrawColor(220);
      doc.line(14, footerY - 6, pageW - 14, footerY - 6);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160);
      doc.text(settings.footerText || `${companyName} - Catálogo B2B`, 14, footerY);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, pageW - 14, footerY, { align: 'right' });

      doc.save(`Pedido_${order.id.slice(0, 8)}.pdf`);
    } catch (e) { alert('Erro ao gerar PDF.'); }
  };

  // Corrected: handleViewRetailer is now async to handle promise from db.getUsers()
  const handleViewRetailer = async (userId: string) => {
    const users = await db.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) setSelectedUser(user);
  };

  const stats = {
    pending: orders.filter(o => o.status === 'PENDING').length,
    shipped: orders.filter(o => o.status === 'SHIPPED').length,
    completedTotal: orders.filter(o => o.status === 'COMPLETED').reduce((acc, o) => acc + o.total, 0)
  };

  const StatusBadge = ({ status }: { status: OrderStatus }) => {
    const config: Record<OrderStatus, { label: string; color: string; icon: any }> = {
      ANALYSIS: { label: 'Em Análise', color: 'bg-gray-50 text-gray-600 border-gray-200', icon: Clock },
      APPROVED: { label: 'Aprovado', color: 'bg-green-50 text-green-700 border-green-100', icon: CheckCircle },
      PENDING: { label: 'Pendente', color: 'bg-gray-50 text-gray-600 border-gray-200', icon: Clock },
      SHIPPED: { label: 'Enviado', color: 'bg-gray-50 text-gray-600 border-gray-200', icon: Truck },
      COMPLETED: { label: 'Concluído', color: 'bg-green-50 text-green-700 border-green-100', icon: CheckCircle },
      CANCELED: { label: 'Cancelado', color: 'bg-red-50 text-red-700 border-red-100', icon: Ban },
    };
    const c = config[status];
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${c.color}`}>
        <c.icon size={10} /> {c.label}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Gestão de Pedidos</p>
          <h1 className="text-3xl font-black text-gray-900">Faturamento e Logística</h1>
        </div>

        <div className="flex gap-4">
          <div className="bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Novos</p>
            <p className="text-lg font-black text-gray-900">{stats.pending}</p>
          </div>
          <div className="bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Enviados</p>
            <p className="text-lg font-black text-gray-900">{stats.shipped}</p>
          </div>
          <div className="bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Faturado</p>
            <p className="text-lg font-black text-gray-900">R$ {formatPrice(stats.completedTotal)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[1rem] border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por REF #ID ou Nome da Loja..."
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex bg-gray-50 p-1.5 rounded-2xl gap-1 overflow-x-auto max-w-full">
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'PENDING', label: 'Pendentes' },
              { id: 'SHIPPED', label: 'Enviados' },
              { id: 'COMPLETED', label: 'Concluídos' },
              { id: 'CANCELED', label: 'Cancelados' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${filter === f.id ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[1.25rem] shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-50">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Pedido</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Lojista</th>
              <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Itens</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
              <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredOrders.map(o => (
              <tr key={o.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-all">
                      <FileText size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900">#{o.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-[10px] text-gray-400 font-bold">{new Date(o.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <p className="text-xs font-extrabold text-gray-900 group-hover:text-primary transition-colors">{o.userStoreName}</p>
                  {o.clientName && (
                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">Cliente: {o.clientName}</p>
                  )}
                  {o.paymentMethod && (
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">{o.paymentMethod}</p>
                  )}
                </td>
                <td className="px-8 py-5 text-center font-bold text-gray-500 text-xs">
                  {o.items.reduce((acc, i) => acc + i.quantity, 0)} un.
                </td>
                <td className="px-8 py-5">
                  <p className="text-sm font-black" style={{ color: settings.primaryColor }}>R$ {formatPrice(o.total)}</p>
                </td>
                <td className="px-8 py-5 flex justify-center mt-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-8 py-5 text-right space-x-1">
                  <button onClick={() => setSelected(o)} className="p-3 text-gray-300 hover:text-gray-900 transition-all rounded-xl hover:bg-white shadow-sm"><Eye size={18} /></button>
                  <button onClick={() => generatePDF(o)} className="p-3 text-gray-300 hover:text-green-600 transition-all rounded-xl hover:bg-white shadow-sm"><Download size={18} /></button>
                  <button onClick={() => handleDeleteOrder(o.id)} className="p-3 text-gray-300 hover:text-red-600 transition-all rounded-xl hover:bg-white shadow-sm"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredOrders.length === 0 && (
          <div className="py-20 text-center">
            <FileSearch size={60} className="mx-auto text-gray-100 mb-6" />
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Nenhum pedido encontrado</p>
          </div>
        )}
      </div>

      {selected && (
        <OrderDetailsModal
          order={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatus}
          onDownload={() => generatePDF(selected)}
          onViewRetailer={handleViewRetailer}
        />
      )}
      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onStatusUpdate={async (s) => {
            const updated = { ...selectedUser, status: s };
            await db.saveUser(updated);
            setSelectedUser(updated);
          }}
          zIndex={200}
        />
      )}
    </div>
  );
};

export const AdminUsers: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { settings } = useContext(AppContext);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateReseller, setShowCreateReseller] = useState(false);

  const initialFilter = (searchParams.get('status') as UserStatus) || 'ALL';
  const [filter, setFilter] = useState<UserStatus | 'ALL'>(initialFilter);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'RETAILER' | 'RESELLER'>('ALL');

  // Form state para criação de revendedor
  const [resellerForm, setResellerForm] = useState({
    storeName: '',
    responsibleName: '',
    cnpj: '',
    phone: '',
    email: '',
    password: '',
    permissions: ['catalog'] as string[]
  });
  const [isCreating, setIsCreating] = useState(false);

  // Corrected: load is now async to handle promise from db.getUsers()
  const load = async () => {
    const data = await db.getUsers();
    // Mostrar todos exceto ADMIN
    setUsers(data.filter(u => u.role !== Role.ADMIN));
  };

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) setFilter(statusParam as any);
  }, [searchParams]);

  useEffect(() => { load(); }, []);

  const handleStatusUpdate = async (u: User, status: UserStatus) => {
    const updated = { ...u, status };
    await db.saveUser(updated);
    load();
    if (selectedUser?.id === u.id) setSelectedUser(updated);
  };

  const handleRoleUpdate = async (u: User, newRole: Role) => {
    const permissions = newRole === Role.RESELLER ? ['catalog'] : [];
    const updated = { ...u, role: newRole, permissions };
    await db.saveUser(updated);
    load();
    if (selectedUser?.id === u.id) setSelectedUser(updated);
  };

  const handlePermissionToggle = async (u: User, permission: string) => {
    const currentPerms = u.permissions || [];
    const newPerms = currentPerms.includes(permission)
      ? currentPerms.filter(p => p !== permission)
      : [...currentPerms, permission];
    const updated = { ...u, permissions: newPerms };
    await db.saveUser(updated);
    load();
    if (selectedUser?.id === u.id) setSelectedUser(updated);
  };

  const handleCreateReseller = async () => {
    if (!resellerForm.storeName || !resellerForm.email || !resellerForm.password) return;
    setIsCreating(true);
    try {
      const newUser: User = {
        id: crypto.randomUUID(),
        storeName: resellerForm.storeName,
        responsibleName: resellerForm.responsibleName,
        cnpj: resellerForm.cnpj,
        phone: resellerForm.phone,
        email: resellerForm.email,
        password: resellerForm.password,
        role: Role.RESELLER,
        permissions: resellerForm.permissions,
        status: UserStatus.APPROVED, // Revendedor já entra aprovado
        createdAt: new Date().toISOString()
      };
      await db.saveUser(newUser);
      setShowCreateReseller(false);
      setResellerForm({ storeName: '', responsibleName: '', cnpj: '', phone: '', email: '', password: '', permissions: ['catalog'] });
      load();
    } catch (err) {
      alert('Erro ao criar revendedor.');
    } finally {
      setIsCreating(false);
    }
  };

  const togglePermission = (perm: string) => {
    setResellerForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  const filteredUsers = users.filter(u => {
    const matchesFilter = filter === 'ALL' ? true : u.status === filter;
    const matchesRole = roleFilter === 'ALL' ? true : u.role === roleFilter;
    const q = normalize(searchQuery);
    const matchesSearch = normalize(u.storeName).includes(q) ||
      normalize(u.cnpj).includes(q) ||
      normalize(u.email).includes(q);
    return matchesFilter && matchesRole && matchesSearch;
  });

  const counts = {
    total: users.length,
    retailers: users.filter(u => u.role === Role.RETAILER).length,
    resellers: users.filter(u => u.role === Role.RESELLER).length,
    pending: users.filter(u => u.status === UserStatus.PENDING).length,
    approved: users.filter(u => u.status === UserStatus.APPROVED).length,
    inactive: users.filter(u => u.status === UserStatus.INACTIVE).length,
  };

  const StatusBadge = ({ status }: { status: UserStatus }) => {
    const config = {
      [UserStatus.APPROVED]: { label: 'Ativo', color: 'bg-green-50 text-green-700 border-green-100', icon: ShieldCheck },
      [UserStatus.PENDING]: { label: 'Análise', color: 'bg-gray-50 text-gray-600 border-gray-200', icon: Clock },
      [UserStatus.REJECTED]: { label: 'Recusado', color: 'bg-red-50 text-red-700 border-red-100', icon: UserMinus },
      [UserStatus.INACTIVE]: { label: 'Inativo', color: 'bg-gray-50 text-gray-500 border-gray-200', icon: Power },
    };
    const c = config[status];
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${c.color}`}>
        <c.icon size={10} /> {c.label}
      </div>
    );
  };

  const RoleBadge = ({ role }: { role: Role }) => {
    if (role === Role.RESELLER) {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-purple-50 text-purple-700 border border-purple-100">
          <ShieldAlert size={8} /> Revendedor
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100">
        <Building2 size={8} /> Lojista
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Gestão de Parceiros</p>
          <h1 className="text-3xl font-black text-gray-900">Lojistas e Revendedores</h1>
        </div>

        {/* Métricas Rápidas */}
        <div className="flex gap-4 flex-wrap">
          <div className="bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total</p>
            <p className="text-lg font-black text-gray-900">{counts.total}</p>
          </div>
          <div className="bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Pendentes</p>
            <p className="text-lg font-black text-gray-900">{counts.pending}</p>
          </div>
          <div className="bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Ativos</p>
            <p className="text-lg font-black text-green-700">{counts.approved}</p>
          </div>
        </div>
      </div>

      {/* Barra de Ferramentas */}
      <div className="bg-white p-6 rounded-[1rem] border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por loja, CNPJ ou e-mail..."
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowCreateReseller(true)}
            className="px-6 py-4 text-white font-black rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] text-[10px] uppercase tracking-widest flex items-center gap-2 shrink-0"
            style={{ backgroundColor: settings.primaryColor }}
          >
            <Plus size={16} /> Novo Revendedor
          </button>
        </div>

        {/* Filtro por Tipo */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex bg-gray-50 p-1.5 rounded-2xl gap-1">
            {[
              { id: 'ALL', label: 'Todos', count: counts.total },
              { id: 'RETAILER', label: 'Lojistas', count: counts.retailers },
              { id: 'RESELLER', label: 'Revendedores', count: counts.resellers }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setRoleFilter(f.id as any)}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${roleFilter === f.id ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {f.label} <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${roleFilter === f.id ? 'bg-primary/10' : 'bg-gray-200 text-gray-500'}`}>{f.count}</span>
              </button>
            ))}
          </div>
          <div className="flex bg-gray-50 p-1.5 rounded-2xl gap-1 overflow-x-auto">
            {[
              { id: 'ALL', label: 'Todos' },
              { id: UserStatus.PENDING, label: 'Pendentes' },
              { id: UserStatus.APPROVED, label: 'Ativos' },
              { id: UserStatus.INACTIVE, label: 'Inativos' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${filter === f.id ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map(u => (
          <div key={u.id} onClick={() => setSelectedUser(u)} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-gray-200 transition-all cursor-pointer group overflow-hidden">
            {/* Header */}
            <div className="p-5 pb-4 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-gray-900 text-white flex items-center justify-center text-lg font-black flex-shrink-0">
                {u.storeName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-gray-900 group-hover:text-primary transition-colors truncate">{u.storeName}</h3>
                <p className="text-[10px] text-gray-400 font-bold truncate">{u.cnpj || 'Sem CNPJ'}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <StatusBadge status={u.status} />
              </div>
            </div>

            {/* Info */}
            <div className="px-5 pb-4 space-y-1.5">
              <div className="flex items-center gap-2 text-gray-500">
                <UserCircle size={13} className="flex-shrink-0" />
                <span className="text-xs font-medium truncate">{u.responsibleName || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Mail size={13} className="flex-shrink-0" />
                <span className="text-xs font-medium truncate">{u.email}</span>
              </div>
              {u.phone && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Phone size={13} className="flex-shrink-0" />
                  <span className="text-xs font-medium">{u.phone}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
              {u.permissions?.includes('admin_panel') && (
                <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-gray-900 text-white rounded-md">Admin</span>
              )}
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${u.role === 'RESELLER' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                {u.role === 'RESELLER' ? 'Revendedor' : 'Cliente'}
              </span>
              <div className="flex-1" />
              {u.phone && (
                <a
                  href={`https://wa.me/${u.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener"
                  onClick={e => e.stopPropagation()}
                  className="w-8 h-8 bg-[#25D366] text-white rounded-lg flex items-center justify-center hover:scale-105 transition-all"
                  title="WhatsApp"
                >
                  <MessageCircle size={14} />
                </a>
              )}
            </div>
          </div>
        ))}

        {filteredUsers.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-[1.25rem] border-2 border-dashed border-gray-100">
            <UserCircle size={60} className="mx-auto text-gray-100 mb-6" />
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Nenhum usuário encontrado</p>
            <button onClick={() => { setSearchQuery(''); setFilter('ALL'); setRoleFilter('ALL'); }} className="mt-4 text-xs font-black text-primary underline">Limpar filtros</button>
          </div>
        )}
      </div>

      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onStatusUpdate={(s) => handleStatusUpdate(selectedUser, s)}
          onRoleUpdate={(newRole) => handleRoleUpdate(selectedUser, newRole)}
          onPermissionToggle={(perm) => handlePermissionToggle(selectedUser, perm)}
        />
      )}

      {/* Modal: Criar Revendedor */}
      {showCreateReseller && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[1rem] md:rounded-[1.25rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 md:p-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Novo Revendedor</h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Cadastro manual com permissões</p>
                </div>
                <button
                  onClick={() => setShowCreateReseller(false)}
                  className="p-2 bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-900 transition-all hover:rotate-90 duration-300"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome da Empresa *</label>
                    <input
                      required
                      value={resellerForm.storeName}
                      onChange={e => setResellerForm({ ...resellerForm, storeName: e.target.value })}
                      className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:bg-white focus:border-gray-100 focus:ring-4 transition-all"
                      placeholder="Nome da empresa"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Responsável</label>
                    <input
                      value={resellerForm.responsibleName}
                      onChange={e => setResellerForm({ ...resellerForm, responsibleName: e.target.value })}
                      className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:bg-white focus:border-gray-100 focus:ring-4 transition-all"
                      placeholder="Nome do responsável"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">CNPJ</label>
                    <input
                      value={resellerForm.cnpj}
                      onChange={e => setResellerForm({ ...resellerForm, cnpj: e.target.value })}
                      className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:bg-white focus:border-gray-100 focus:ring-4 transition-all"
                      placeholder="00.000.000/0001-00"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                    <input
                      value={resellerForm.phone}
                      onChange={e => setResellerForm({ ...resellerForm, phone: e.target.value })}
                      className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:bg-white focus:border-gray-100 focus:ring-4 transition-all"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail *</label>
                    <input
                      type="email"
                      required
                      value={resellerForm.email}
                      onChange={e => setResellerForm({ ...resellerForm, email: e.target.value })}
                      className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:bg-white focus:border-gray-100 focus:ring-4 transition-all"
                      placeholder="revendedor@empresa.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Senha *</label>
                    <input
                      type="password"
                      required
                      value={resellerForm.password}
                      onChange={e => setResellerForm({ ...resellerForm, password: e.target.value })}
                      className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:bg-white focus:border-gray-100 focus:ring-4 transition-all"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                </div>

                {/* Permissões */}
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Permissões de Acesso</p>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${resellerForm.permissions.includes('catalog')
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 bg-white'
                          }`}
                        onClick={() => togglePermission('catalog')}
                      >
                        {resellerForm.permissions.includes('catalog') && <Check size={14} />}
                      </div>
                      <div onClick={() => togglePermission('catalog')}>
                        <p className="text-sm font-bold text-gray-700 group-hover:text-gray-900">Acesso ao Catálogo</p>
                        <p className="text-[10px] text-gray-400 font-medium">Navegar produtos, fazer pedidos, acessar carrinho</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${resellerForm.permissions.includes('admin_panel')
                          ? 'border-purple-500 bg-purple-500 text-white'
                          : 'border-gray-300 bg-white'
                          }`}
                        onClick={() => togglePermission('admin_panel')}
                      >
                        {resellerForm.permissions.includes('admin_panel') && <Check size={14} />}
                      </div>
                      <div onClick={() => togglePermission('admin_panel')}>
                        <p className="text-sm font-bold text-gray-700 group-hover:text-gray-900">Acesso ao Painel Admin</p>
                        <p className="text-[10px] text-gray-400 font-medium">Gerenciar produtos, pedidos, usuários e configurações</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowCreateReseller(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateReseller}
                  disabled={isCreating || !resellerForm.storeName || !resellerForm.email || !resellerForm.password}
                  className="flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  {isCreating ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                  {isCreating ? 'Criando...' : 'Criar Revendedor'}
                </button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export const AdminSettings: React.FC = () => {
  const { settings, updateSettings } = useContext(AppContext);
  const [temp, setTemp] = useState<AppSettingsType>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'visual' | 'institutional' | 'support' | 'social' | 'payments'>('visual');
  const [expandedPolicies, setExpandedPolicies] = useState<Record<number, boolean>>({});

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(temp);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar configurações. Verifique o console.");
    } finally {
      setIsSaving(false);
    }
  };

  const SectionTitle = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
    <div className="flex items-start gap-4 mb-8">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 shadow-sm">
        <Icon size={24} />
      </div>
      <div>
        <h3 className="text-lg font-black text-gray-900 leading-none mb-2">{title}</h3>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{desc}</p>
      </div>
    </div>
  );

  const InputLabel = ({ label }: { label: string }) => (
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 block mb-2">{label}</label>
  );

  const inputClass = "w-full border-2 border-gray-50 bg-gray-50/50 p-4 rounded-2xl font-bold outline-none focus:bg-white focus:border-gray-100 transition-all";

  const tabs = [
    { id: 'visual' as const, label: 'Identidade Visual', icon: Palette },
    { id: 'institutional' as const, label: 'Institucional', icon: Globe },
    { id: 'support' as const, label: 'Atendimento', icon: MessageCircle },
    { id: 'social' as const, label: 'Redes Sociais', icon: Share2 },
    { id: 'payments' as const, label: 'Pagamentos', icon: DollarSign },
  ];

  return (
    <>
    <FeedbackToast message="Configurações atualizadas!" visible={showToast} primaryColor={settings.primaryColor} />
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Painel Administrativo</p>
          <h1 className="text-3xl font-black text-gray-900">Configurações</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-3 md:px-10 md:py-4 text-white rounded-xl md:rounded-2xl font-black transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50 text-xs md:text-base w-full md:w-auto"
          style={{ backgroundColor: settings.primaryColor, boxShadow: `0 10px 25px -5px ${settings.primaryColor}50` }}
        >
          {isSaving ? <Loader2 size={16} className="animate-spin md:w-5 md:h-5" /> : <Save size={16} className="md:w-5 md:h-5" />}
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {tabs.map(tab => {
          const isActive = settingsTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all flex-shrink-0 ${isActive
                ? 'text-white shadow-lg scale-[1.02]'
                : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50 hover:text-gray-900'
                }`}
              style={isActive ? { backgroundColor: settings.primaryColor, boxShadow: `0 6px 20px -4px ${settings.primaryColor}60` } : {}}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">

        {settingsTab === 'visual' && (
          <div className="bg-white rounded-[1.25rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 flex items-center gap-4 border-b border-gray-100">
              <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0">
                <Palette size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 leading-tight">Identidade Visual</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cores e logomarca do catálogo</p>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <InputLabel label="URL da Logomarca (PNG/SVG)" />
                  <input className={inputClass} placeholder="https://exemplo.com/logo.png" value={temp.logoUrl} onChange={e => setTemp({ ...temp, logoUrl: e.target.value })} />
                </div>
                <div>
                  <InputLabel label="URL do Favicon (Opcional)" />
                  <input className={inputClass} placeholder="https://exemplo.com/favicon.png" value={temp.faviconUrl || ''} onChange={e => setTemp({ ...temp, faviconUrl: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <InputLabel label="Cor Primária" />
                  <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-2xl border border-gray-100">
                    <input type="color" className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent" value={temp.primaryColor} onChange={e => setTemp({ ...temp, primaryColor: e.target.value })} />
                    <span className="text-xs font-mono font-bold text-gray-500 uppercase">{temp.primaryColor}</span>
                  </div>
                </div>
                <div>
                  <InputLabel label="Cor Secundária" />
                  <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-2xl border border-gray-100">
                    <input type="color" className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent" value={temp.secondaryColor} onChange={e => setTemp({ ...temp, secondaryColor: e.target.value })} />
                    <span className="text-xs font-mono font-bold text-gray-500 uppercase">{temp.secondaryColor}</span>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-gray-50/50 border border-dashed border-gray-200">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center mb-2">Prévia das Cores</p>
                <div className="flex gap-2">
                  <div className="flex-1 h-8 rounded-lg shadow-sm" style={{ backgroundColor: temp.primaryColor }}></div>
                  <div className="flex-1 h-8 rounded-lg shadow-sm" style={{ backgroundColor: temp.secondaryColor }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {settingsTab === 'institutional' && (
          <div className="bg-white rounded-[1.25rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 flex items-center gap-4 border-b border-gray-100">
              <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0">
                <Globe size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 leading-tight">Institucional</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dados da empresa e textos do catálogo</p>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <InputLabel label="Nome da Empresa / Catálogo" />
                <input className={inputClass} value={temp.companyName} onChange={e => setTemp({ ...temp, companyName: e.target.value })} />
              </div>
              <div>
                <InputLabel label="Texto da Empresa (Abaixo do Nome)" />
                <textarea className={`${inputClass} h-20 resize-none`} value={temp.customAddress} onChange={e => setTemp({ ...temp, customAddress: e.target.value })} />
              </div>
              <div>
                <InputLabel label="Texto do Rodapé (Copyright)" />
                <textarea className={`${inputClass} h-24 resize-none`} value={temp.footerText} onChange={e => setTemp({ ...temp, footerText: e.target.value })} />
              </div>
              <div>
                <InputLabel label="Banner Promocional (URL da Imagem)" />
                <input className={inputClass} placeholder="https://exemplo.com/banner-promo.jpg" value={temp.promoBannerUrl || ''} onChange={e => setTemp({ ...temp, promoBannerUrl: e.target.value })} />
                <p className="text-[9px] text-gray-400 font-medium mt-2 ml-1">Exibido no topo do catálogo. Deixe vazio para desativar. Recomendado: <span className="font-bold text-gray-500">1920 × 480px</span></p>
                {temp.promoBannerUrl && (
                  <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                    <img src={temp.promoBannerUrl} alt="Preview do banner" className="w-full h-auto object-cover max-h-[160px]" onError={e => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {settingsTab === 'support' && (
          <div className="bg-white rounded-[1.25rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 flex items-center gap-4 border-b border-gray-100">
              <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0">
                <MessageCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 leading-tight">Canais de Atendimento</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Suporte e contato com o lojista</p>
              </div>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <InputLabel label="E-mail de Suporte" />
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input className={`${inputClass} pl-12`} placeholder="sac@empresa.com" value={temp.supportEmail} onChange={e => setTemp({ ...temp, supportEmail: e.target.value })} />
                  </div>
                </div>
                <div>
                  <InputLabel label="WhatsApp Comercial" />
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input className={`${inputClass} pl-12`} placeholder="(11) 99999-9999" value={temp.supportPhone} onChange={e => setTemp({ ...temp, supportPhone: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {settingsTab === 'social' && (
          <div className="bg-white rounded-[1.25rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 flex items-center gap-4 border-b border-gray-100">
              <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0">
                <Share2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 leading-tight">Redes Sociais</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Links públicos exibidos no rodapé</p>
              </div>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <InputLabel label="Instagram" />
                  <div className="relative">
                    <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input className={`${inputClass} pl-12 text-xs`} placeholder="https://instagram.com/..." value={temp.instagramUrl} onChange={e => setTemp({ ...temp, instagramUrl: e.target.value })} />
                  </div>
                </div>
                <div>
                  <InputLabel label="Facebook" />
                  <div className="relative">
                    <Facebook className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input className={`${inputClass} pl-12 text-xs`} placeholder="https://facebook.com/..." value={temp.facebookUrl} onChange={e => setTemp({ ...temp, facebookUrl: e.target.value })} />
                  </div>
                </div>
                <div>
                  <InputLabel label="YouTube" />
                  <div className="relative">
                    <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input className={`${inputClass} pl-12 text-xs`} placeholder="https://youtube.com/..." value={temp.youtubeUrl} onChange={e => setTemp({ ...temp, youtubeUrl: e.target.value })} />
                  </div>
                </div>
                <div>
                  <InputLabel label="TikTok" />
                  <div className="relative">
                    <Play className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input className={`${inputClass} pl-12 text-xs`} placeholder="https://tiktok.com/@..." value={temp.tiktokUrl} onChange={e => setTemp({ ...temp, tiktokUrl: e.target.value })} />
                  </div>
                </div>
                <div>
                  <InputLabel label="LinkedIn" />
                  <div className="relative">
                    <Linkedin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input className={`${inputClass} pl-12 text-xs`} placeholder="https://linkedin.com/company/..." value={temp.linkedinUrl} onChange={e => setTemp({ ...temp, linkedinUrl: e.target.value })} />
                  </div>
                </div>
                <div>
                  <InputLabel label="Site Institucional" />
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input className={`${inputClass} pl-12 text-xs`} placeholder="https://www.meusite.com.br" value={temp.websiteUrl} onChange={e => setTemp({ ...temp, websiteUrl: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {settingsTab === 'payments' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-white px-8 py-5 rounded-[1.25rem] border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shadow-sm flex-shrink-0">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900 leading-tight">Política Comercial</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Condições de pagamento por faixa de valor</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const policies = (temp.paymentPolicies && temp.paymentPolicies.length > 0) ? temp.paymentPolicies : PAYMENT_POLICIES;
                      const allExpanded = policies.every((_, i) => expandedPolicies[i] === true);
                      const newState: Record<number, boolean> = {};
                      policies.forEach((_, i) => { newState[i] = !allExpanded; });
                      setExpandedPolicies(newState);
                    }}
                    className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center gap-1.5"
                  >
                    <ChevronDown size={14} className={`transition-transform ${((temp.paymentPolicies && temp.paymentPolicies.length > 0) ? temp.paymentPolicies : PAYMENT_POLICIES).every((_, i) => expandedPolicies[i] === true) ? '' : 'rotate-180'}`} />
                    {((temp.paymentPolicies && temp.paymentPolicies.length > 0) ? temp.paymentPolicies : PAYMENT_POLICIES).every((_, i) => expandedPolicies[i] === true) ? 'Contrair Todas' : 'Expandir Todas'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Deseja restaurar as condições de pagamento para o padrão?')) {
                        setTemp({ ...temp, paymentPolicies: [...PAYMENT_POLICIES] });
                      }
                    }}
                    className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-gray-100 transition-all"
                  >
                    Restaurar Padrão
                  </button>
                </div>
              </div>
            </div>

            {/* Faixas de Valor */}
            {((temp.paymentPolicies && temp.paymentPolicies.length > 0) ? temp.paymentPolicies : PAYMENT_POLICIES).map((policy, pIdx) => {
              const getPolicies = () => [...((temp.paymentPolicies && temp.paymentPolicies.length > 0) ? temp.paymentPolicies : PAYMENT_POLICIES)];
              const isUnlimited = policy.maxValue === Infinity || policy.maxValue === null || (policy.maxValue as number) >= 999999;
              const maxLabel = isUnlimited ? 'Sem Limite' : `R$ ${Number(policy.maxValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
              const isExpanded = expandedPolicies[pIdx] === true; // contraído por padrão

              return (
                <div key={pIdx} className="bg-white rounded-[1.25rem] border border-gray-100 shadow-sm overflow-hidden">
                  {/* Header da faixa - clicável para expandir/contrair */}
                  <div
                    className="px-8 py-5 flex items-center justify-between cursor-pointer select-none"
                    style={{ backgroundColor: `${settings.primaryColor}08`, borderBottom: isExpanded ? `2px solid ${settings.primaryColor}15` : 'none' }}
                    onClick={() => setExpandedPolicies(prev => ({ ...prev, [pIdx]: !isExpanded }))}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-black shadow-lg" style={{ backgroundColor: settings.primaryColor }}>
                        {pIdx + 1}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: settings.primaryColor }}>Faixa {pIdx + 1}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <input
                              type="number"
                              step="0.01"
                              className="w-28 px-3 py-1.5 text-sm font-black text-gray-800 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:outline-none transition-all"
                              style={{ '--tw-ring-color': `${settings.primaryColor}30` } as any}
                              value={policy.minValue}
                              onChange={e => {
                                const current = getPolicies();
                                current[pIdx] = { ...current[pIdx], minValue: parseFloat(e.target.value) || 0 };
                                setTemp({ ...temp, paymentPolicies: current });
                              }}
                            />
                            <span className="text-gray-400 font-black">até</span>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                className="w-28 px-3 py-1.5 text-sm font-black text-gray-800 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:outline-none transition-all"
                                style={{ '--tw-ring-color': `${settings.primaryColor}30` } as any}
                                value={isUnlimited ? 999999 : policy.maxValue}
                                onChange={e => {
                                  const current = getPolicies();
                                  const val = parseFloat(e.target.value) || 0;
                                  current[pIdx] = { ...current[pIdx], maxValue: val >= 999999 ? Infinity : val };
                                  setTemp({ ...temp, paymentPolicies: current });
                                }}
                              />
                            </div>
                            {isUnlimited && (
                              <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100">Sem Limite</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isExpanded && (
                        <span className="text-[9px] font-bold text-gray-400 mr-2">{policy.options.length} {policy.options.length === 1 ? 'condição' : 'condições'}</span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const current = getPolicies();
                          current.splice(pIdx, 1);
                          setTemp({ ...temp, paymentPolicies: current });
                        }}
                        className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Remover faixa"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ChevronDown size={18} className={`text-gray-400 transition-transform duration-300 ${isExpanded ? '' : '-rotate-90'}`} />
                    </div>
                  </div>

                  {/* Opções de pagamento - colapsável */}
                  <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-8 py-6">
                    <div className="space-y-3">
                      {policy.options.map((opt: any, oIdx: number) => {
                        const optObj = (typeof opt === 'string') ? { label: opt, days: [] } : opt;
                        const hasDiscount = (optObj.discountPercent || 0) > 0;
                        const isAvista = !optObj.days || optObj.days.length === 0;

                        return (
                          <div key={oIdx} className={`group relative rounded-2xl border transition-all ${hasDiscount ? 'bg-green-50/50 border-green-100' : 'bg-gray-50/80 border-gray-100'} hover:shadow-md`}>
                            <div className="p-5">
                              <div className="flex items-start gap-4">
                                {/* Ícone tipo de pagamento */}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isAvista ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                  {isAvista ? <DollarSign size={18} /> : <Clock size={18} />}
                                </div>

                                {/* Conteúdo principal */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <input
                                      className="flex-1 min-w-[200px] px-0 py-0 text-sm font-black text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-gray-300"
                                      value={optObj.label}
                                      placeholder="Nome da condição (ex: À vista PIX, 28/35/42 dias...)"
                                      onChange={e => {
                                        const current = getPolicies();
                                        const opts = [...current[pIdx].options] as any[];
                                        opts[oIdx] = { ...optObj, label: e.target.value };
                                        current[pIdx] = { ...current[pIdx], options: opts };
                                        setTemp({ ...temp, paymentPolicies: current });
                                      }}
                                    />
                                    {hasDiscount && (
                                      <span className="text-[9px] font-black text-green-700 bg-green-100 px-2.5 py-1 rounded-lg border border-green-200 whitespace-nowrap">
                                        {optObj.discountPercent}% OFF
                                      </span>
                                    )}
                                    {isAvista && (
                                      <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">À VISTA</span>
                                    )}
                                    {!isAvista && optObj.days && (
                                      <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">{optObj.days.length}x PARCELAS</span>
                                    )}
                                  </div>

                                  {/* Linha de detalhes editáveis */}
                                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <Clock size={12} className="text-gray-400" />
                                      <input
                                        className="w-40 px-2.5 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:outline-none transition-all"
                                        style={{ '--tw-ring-color': `${settings.primaryColor}30` } as any}
                                        defaultValue={optObj.days && optObj.days.length > 0 ? optObj.days.join(', ') : ''}
                                        key={`${pIdx}-${oIdx}-${optObj.days?.length || 0}`}
                                        placeholder="Vazio = à vista"
                                        onBlur={e => {
                                          const current = getPolicies();
                                          const opts = [...current[pIdx].options] as any[];
                                          const daysStr = e.target.value;
                                          const days = daysStr.trim() === '' ? [] : daysStr.split(/[,\/\s]+/).map(Number).filter(n => !isNaN(n) && n > 0);
                                          opts[oIdx] = { ...optObj, days };
                                          current[pIdx] = { ...current[pIdx], options: opts };
                                          setTemp({ ...temp, paymentPolicies: current });
                                        }}
                                      />
                                      <span className="text-[9px] text-gray-400 font-medium">dias</span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <Tag size={12} className="text-gray-400" />
                                      <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        max="100"
                                        className="w-20 px-2.5 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:outline-none transition-all"
                                        style={{ '--tw-ring-color': `${settings.primaryColor}30` } as any}
                                        value={optObj.discountPercent || ''}
                                        placeholder="0"
                                        onChange={e => {
                                          const current = getPolicies();
                                          const opts = [...current[pIdx].options] as any[];
                                          const val = parseFloat(e.target.value) || 0;
                                          opts[oIdx] = { ...optObj, discountPercent: val > 0 ? val : undefined };
                                          current[pIdx] = { ...current[pIdx], options: opts };
                                          setTemp({ ...temp, paymentPolicies: current });
                                        }}
                                      />
                                      <span className="text-[9px] text-gray-400 font-medium">% desc.</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Botão remover */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = getPolicies();
                                    const opts = [...current[pIdx].options];
                                    opts.splice(oIdx, 1);
                                    current[pIdx] = { ...current[pIdx], options: opts };
                                    setTemp({ ...temp, paymentPolicies: current });
                                  }}
                                  className="p-2 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Adicionar opção */}
                      <button
                        type="button"
                        onClick={() => {
                          const current = getPolicies();
                          const opts = [...current[pIdx].options, { label: '', days: [] }] as any[];
                          current[pIdx] = { ...current[pIdx], options: opts };
                          setTemp({ ...temp, paymentPolicies: current });
                        }}
                        className="w-full py-3.5 border-2 border-dashed border-gray-200 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:border-gray-400 hover:text-gray-600 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus size={14} /> Adicionar Condição
                      </button>
                    </div>
                  </div>
                  </div>{/* fim colapsável */}
                </div>
              );
            })}

            {/* Adicionar faixa */}
            <button
              type="button"
              onClick={() => {
                const current = [...((temp.paymentPolicies && temp.paymentPolicies.length > 0) ? temp.paymentPolicies : PAYMENT_POLICIES)];
                const lastMax = current.length > 0 ? ((current[current.length - 1].maxValue === Infinity || (current[current.length - 1].maxValue as number) >= 999999) ? 5000 : current[current.length - 1].maxValue) : 0;
                current.push({ minValue: (lastMax as number) + 0.01, maxValue: Infinity, options: [{ label: 'À vista', days: [] }] });
                setTemp({ ...temp, paymentPolicies: current });
              }}
              className="w-full py-5 bg-white border-2 border-dashed border-gray-200 rounded-[1rem] text-xs font-black text-gray-400 uppercase tracking-widest hover:border-gray-400 hover:text-gray-600 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={16} /> Adicionar Nova Faixa de Valor
            </button>
          </div>
        )}

      </div>
    </div>
    </>
  );
};
