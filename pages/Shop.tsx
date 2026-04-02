
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, ShoppingCart, Info, CarFront, Tag, Package, Trash2,
  Minus, Plus, ChevronRight, FileText, Eye, CheckCircle2,
  MessageCircle, Mail, ExternalLink, ArrowLeft, ClipboardList, User as UserIcon, X, Filter, ChevronDown, PackageOpen, AlertCircle, Download, Percent
} from 'lucide-react';
import { db } from '../services/db';
import { Product, CartItem, Order, OrderStatus, Role, ResellerClient, GROUPS, POSITIONS, MANUFACTURERS, getPaymentOptions, getInstallmentInfo } from '../types';
import { AppContext } from '../App';
import { useNavigate, Link } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatPrice = (p: number) => p.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Remove acentos/diacríticos para pesquisa tolerante a erros de digitação
const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const ProductCard: React.FC<{ product: Product, onClick: () => void }> = ({ product, onClick }) => {
  const { settings } = useContext(AppContext);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const hasDiscount = (product.promo_price || 0) > 0 && (product.promo_price || 0) < product.price;
  const discountPercent = hasDiscount ? Math.round(((product.price - (product.promo_price || 0)) / product.price) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-[2rem] border border-gray-100 p-4 cursor-pointer hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative flex flex-col h-full overflow-hidden"
    >
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        {hasDiscount && (
          <div className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-sm shadow-red-200 animate-pulse">
            {discountPercent}% OFF
          </div>
        )}
        {product.stock <= 0 && (
          <div className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded-lg shadow-sm">
            ESGOTADO
          </div>
        )}
      </div>

      <div className="relative aspect-square mb-4 bg-gray-50 rounded-2xl overflow-hidden">
        {product.images.length > 0 ? (
          <img
            src={product.images[0]}
            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700"
            alt={product.name}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <PackageOpen size={48} />
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1">
        <h3 className="font-bold text-gray-900 leading-tight mb-1 line-clamp-2 min-h-[2.5rem] group-hover:text-[#3483FA] transition-colors">
          {product.name}
        </h3>
        <p className="text-xs font-bold text-gray-400 mb-1">{product.internalCode}</p>
        <p className="text-[10px] text-gray-500 font-medium leading-tight mb-2 line-clamp-2 h-[2rem] flex items-start gap-1">
          <CarFront size={12} className="shrink-0 mt-0.5" />
          {product.application}
        </p>

        <div className="mt-auto border-t border-gray-50 pt-2 flex items-end justify-between">
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Un.</p>
            {hasDiscount ? (
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 line-through font-bold">{formatPrice(product.price)}</span>
                <p className="text-xl font-black text-red-600 tracking-tight">{formatPrice(product.promo_price || 0)}</p>
              </div>
            ) : (
              <p className="text-xl font-black text-gray-900 tracking-tight">{formatPrice(product.price)}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Disponível</p>
            <p className={`text-sm font-black ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {product.min_stock_display ? product.min_stock_display : (product.stock > 0 ? `${product.stock} un` : '0 un')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Catalog: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const dragRef = useRef<{ startY: number; currentY: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const closeProduct = useCallback(() => setSelectedProduct(null), []);

  // ESC to close + body scroll lock + browser back button
  useEffect(() => {
    if (!selectedProduct) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeProduct(); };
    window.addEventListener('keydown', onKey);
    // Push a history entry so the back button closes the popup
    window.history.pushState({ productPopup: true }, '');
    const onPop = () => closeProduct();
    window.addEventListener('popstate', onPop);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
    };
  }, [selectedProduct, closeProduct]);

  // Drag handlers for mobile bottom sheet
  const onTouchStart = (e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY, currentY: e.touches[0].clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current || !sheetRef.current) return;
    dragRef.current.currentY = e.touches[0].clientY;
    const delta = Math.max(0, dragRef.current.currentY - dragRef.current.startY);
    sheetRef.current.style.transform = `translateY(${delta}px)`;
    sheetRef.current.style.transition = 'none';
  };
  const onTouchEnd = () => {
    if (!dragRef.current || !sheetRef.current) return;
    const delta = dragRef.current.currentY - dragRef.current.startY;
    sheetRef.current.style.transition = 'transform 0.3s ease';
    if (delta > 120) {
      sheetRef.current.style.transform = 'translateY(100%)';
      setTimeout(closeProduct, 300);
    } else {
      sheetRef.current.style.transform = 'translateY(0)';
    }
    dragRef.current = null;
  };
  const { addToCart, settings } = useContext(AppContext);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 25;

  // Funnel Filters State
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'code-asc' | 'code-desc' | 'price-asc' | 'price-desc'>('relevance');

  useEffect(() => {
    const loadProducts = async () => {
      const data = await db.getProducts();
      setProducts(data.filter(p => p.active));
    };
    loadProducts();
  }, []);

  const filtered = products.filter(p => {
    // Smart search: split query into words, ALL words must match somewhere
    // Searches across: name, internalCode, parallelCodes, application, group, position,
    // AND compatibility data (manufacturer, vehicle, years)
    const searchWords = normalize(search).split(/\s+/).filter(Boolean);

    const matchesSearch = searchWords.length === 0 ? true : (() => {
      // Build a single searchable text from all product fields + compatibility
      const compTexts = (p.compatibility || []).map(c => {
        const yearsStr = (c.years || []).join(' ');
        return `${c.manufacturer} ${c.vehicle} ${yearsStr}`;
      }).join(' ');

      const fullText = normalize([
        p.name || '', p.internalCode || '', p.parallelCodes || '', p.application || '',
        p.group || '', p.position || '',
        p.manufacturer || '', p.vehicle || '',
        p.description || '', p.kitComponents || '',
        compTexts
      ].join(' '));

      return searchWords.every(word => fullText.includes(word));
    })();

    const matchesGroup = selectedGroup ? (p.group || '') === selectedGroup : true;

    // Compatibility Logic
    const hasCompatibility = (p.compatibility || []).length > 0;

    const matchesManufacturer = selectedManufacturer
      ? hasCompatibility
        ? p.compatibility.some(c => c.manufacturer === selectedManufacturer)
        : (p.manufacturer || '').includes(selectedManufacturer)
      : true;

    const matchesVehicle = selectedVehicle
      ? hasCompatibility
        ? p.compatibility.some(c =>
          (!selectedManufacturer || c.manufacturer === selectedManufacturer) &&
          normalize(c.vehicle).includes(normalize(selectedVehicle))
        )
        : normalize(p.vehicle || '').includes(normalize(selectedVehicle))
      : true;

    const matchesYear = selectedYear
      ? hasCompatibility
        ? p.compatibility.some(c =>
          (!selectedManufacturer || c.manufacturer === selectedManufacturer) &&
          (!selectedVehicle || normalize(c.vehicle).includes(normalize(selectedVehicle))) &&
          (c.years || []).includes(Number(selectedYear))
        )
        : false
      : true;

    const matchesPosition = selectedPosition ? (p.position || '') === selectedPosition : true;

    return matchesSearch && matchesGroup && matchesManufacturer && matchesVehicle && matchesYear && matchesPosition;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'code-asc':
        return a.internalCode.localeCompare(b.internalCode);
      case 'code-desc':
        return b.internalCode.localeCompare(a.internalCode);
      case 'price-asc':
        return a.price - b.price;
      case 'price-desc':
        return b.price - a.price;
      case 'relevance':
      default:
        return 0;
    }
  });

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, selectedGroup, selectedManufacturer, selectedVehicle, selectedYear, selectedPosition, sortBy]);

  const uniqueManufacturers = Array.from(new Set(products
    .filter(p => !selectedGroup || p.group === selectedGroup)
    .flatMap(p => {
      if (p.compatibility && p.compatibility.length > 0) {
        return p.compatibility.map(c => c.manufacturer);
      }
      return (p.manufacturer || '').split(',').map(s => s.trim());
    })
  )).filter(Boolean).sort();

  const uniqueVehicles = Array.from(new Set(products
    .filter(p =>
      (!selectedGroup || p.group === selectedGroup) &&
      (!selectedManufacturer || (
        p.compatibility && p.compatibility.length > 0
          ? p.compatibility.some(c => c.manufacturer === selectedManufacturer)
          : (p.manufacturer || '').includes(selectedManufacturer)
      ))
    )
    .flatMap(p => {
      if (p.compatibility && p.compatibility.length > 0) {
        return p.compatibility
          .filter(c => !selectedManufacturer || c.manufacturer === selectedManufacturer)
          .map(c => c.vehicle);
      }
      return (p.vehicle || '').split(',').map(s => s.trim());
    })
  )).filter(Boolean).sort();

  const uniqueYears = Array.from(new Set(products
    .filter(p =>
      (!selectedGroup || (p.group || '') === selectedGroup)
      && (!selectedManufacturer || (
        p.compatibility && p.compatibility.length > 0
          ? p.compatibility.some(c => c.manufacturer === selectedManufacturer)
          : (p.manufacturer || '').includes(selectedManufacturer)
      ))
      && (!selectedVehicle || (
        p.compatibility && p.compatibility.length > 0
          ? p.compatibility.some(c => normalize(c.vehicle).includes(normalize(selectedVehicle)) && (!selectedManufacturer || c.manufacturer === selectedManufacturer))
          : normalize(p.vehicle || '').includes(normalize(selectedVehicle))
      ))
    )
    .flatMap(p =>
      (p.compatibility || [])
        .filter(c =>
          (!selectedManufacturer || c.manufacturer === selectedManufacturer) &&
          (!selectedVehicle || normalize(c.vehicle).includes(normalize(selectedVehicle)))
        )
        .flatMap(c => c.years || [])
    )
  )).sort((a: number, b: number) => a - b);

  const uniquePositions = Array.from(new Set(products
    .filter(p =>
      (!selectedGroup || (p.group || '') === selectedGroup)
      && (!selectedManufacturer || (
        p.compatibility && p.compatibility.length > 0
          ? p.compatibility.some(c => c.manufacturer === selectedManufacturer)
          : (p.manufacturer || '').includes(selectedManufacturer)
      ))
      && (!selectedVehicle || (
        p.compatibility && p.compatibility.length > 0
          ? p.compatibility.some(c => c.vehicle.toLowerCase().includes(selectedVehicle.toLowerCase()) && (!selectedManufacturer || c.manufacturer === selectedManufacturer))
          : (p.vehicle || '').toLowerCase().includes(selectedVehicle.toLowerCase())
      ))
      && (!selectedYear || (
        p.compatibility && p.compatibility.length > 0
          ? p.compatibility.some(c =>
            (!selectedManufacturer || c.manufacturer === selectedManufacturer) &&
            (!selectedVehicle || normalize(c.vehicle).includes(normalize(selectedVehicle))) &&
            (c.years || []).includes(Number(selectedYear))
          )
          : false
      ))
    )
    .flatMap(p => (p.position || '').split(',').map(s => s.trim()))
  )).filter(Boolean).sort();


  const handleAddToCart = () => {
    if (selectedProduct) {
      addToCart(selectedProduct, quantity);
      setSelectedProduct(null);
      setQuantity(1);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedGroup('');
    setSelectedManufacturer('');
    setSelectedVehicle('');
    setSelectedYear('');
    setSelectedPosition('');
  };

  const bannerUrl = settings.promoBannerUrl || '';
  const [bannerDismissed, setBannerDismissed] = useState(() => sessionStorage.getItem('dismissedBannerUrl') === bannerUrl && bannerUrl !== '');
  const dismissBanner = () => { setBannerDismissed(true); sessionStorage.setItem('dismissedBannerUrl', bannerUrl); };

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500 pb-4 md:pb-10">
      {/* Promotional Banner */}
      {settings.promoBannerUrl && !bannerDismissed && (
        <div className="relative rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-lg border border-gray-100 animate-in slide-in-from-top-4 duration-500">
          <img
            src={settings.promoBannerUrl}
            alt="Promoção"
            className="w-full h-auto object-cover max-h-[200px] md:max-h-[320px]"
          />
          <button
            onClick={dismissBanner}
            className="absolute top-3 right-3 md:top-4 md:right-4 p-2 bg-black/40 backdrop-blur-sm rounded-full text-white/80 hover:bg-black/60 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col gap-4 md:gap-6">
        <div className="relative w-full">
          <Search className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={18} />
          <input
            className="w-full pl-11 md:pl-16 pr-4 md:pr-8 py-3.5 md:py-5 border-none rounded-xl md:rounded-[1.75rem] bg-slate-50 outline-none focus:ring-4 focus:ring-primary/10 text-sm md:text-base font-semibold transition-all shadow-inner placeholder:text-gray-300 overflow-hidden"
            placeholder="Pesquisar peças..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex md:hidden items-center justify-between w-full py-3 px-4 bg-slate-50 rounded-xl text-sm font-bold text-gray-600 active:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <span>Filtros</span>
            {(selectedGroup || selectedManufacturer || selectedVehicle || selectedYear || selectedPosition) && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-[9px] font-black text-white rounded-full" style={{ backgroundColor: settings.primaryColor }}>
                {[selectedGroup, selectedManufacturer, selectedVehicle, selectedYear, selectedPosition].filter(Boolean).length}
              </span>
            )}
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {/* Filters - always visible on desktop, collapsible on mobile */}
        <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            {/* 1. Group */}
            <div className="space-y-1 col-span-2 md:col-span-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Grupo</label>
              <select
                value={selectedGroup}
                onChange={e => { setSelectedGroup(e.target.value); setSelectedManufacturer(''); setSelectedVehicle(''); setSelectedYear(''); setSelectedPosition(''); }}
                className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-3 px-3 md:px-4 font-bold text-sm text-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value="">Todos os Grupos</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* 2. Manufacturer */}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Montadora</label>
              <select
                value={selectedManufacturer}
                onChange={e => { setSelectedManufacturer(e.target.value); setSelectedVehicle(''); setSelectedYear(''); setSelectedPosition(''); }}
                disabled={!selectedGroup && !search}
                className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-3 px-3 md:px-4 font-bold text-sm text-gray-700 focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50"
              >
                <option value="">Todas</option>
                {uniqueManufacturers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* 3. Vehicle */}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Veículo</label>
              <input
                list="vehicles-list"
                value={selectedVehicle}
                onChange={e => { setSelectedVehicle(e.target.value); setSelectedYear(''); setSelectedPosition(''); }}
                placeholder="Todos"
                disabled={!selectedManufacturer && !search}
                className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-3 px-3 md:px-4 font-bold text-sm text-gray-700 focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50"
              />
              <datalist id="vehicles-list">
                {uniqueVehicles.map(v => <option key={v} value={v} />)}
              </datalist>
            </div>

            {/* 4. Year */}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Ano</label>
              <select
                value={selectedYear}
                onChange={e => { setSelectedYear(e.target.value); setSelectedPosition(''); }}
                disabled={!selectedVehicle && !search}
                className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-3 px-3 md:px-4 font-bold text-sm text-gray-700 focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50"
              >
                <option value="">Todos</option>
                {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* 5. Position */}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Posição</label>
              <select
                value={selectedPosition}
                onChange={e => setSelectedPosition(e.target.value)}
                disabled={!selectedVehicle && !search}
                className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-3 px-3 md:px-4 font-bold text-sm text-gray-700 focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50"
              >
                <option value="">Todas</option>
                {uniquePositions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {(selectedGroup || selectedManufacturer || selectedVehicle || selectedYear || selectedPosition) && (
            <div className="flex justify-end mt-3">
              <button onClick={clearFilters} className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-lg">
                <Trash2 size={12} /> Limpar Filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top Bar: Results count, Sorting, and Top Pagination */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
        <p className="text-sm font-bold text-gray-500">
          Exibindo <span className="text-gray-900 font-black">{filtered.length}</span> {filtered.length === 1 ? 'produto' : 'produtos'}
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
          {/* Ordenação */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 shrink-0">Ordenar por</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-white border border-gray-200 rounded-xl py-2 px-3 font-bold text-sm text-gray-700 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 w-full sm:w-auto"
            >
              <option value="relevance">Relevância</option>
<option value="code-asc">Código (A-Z)</option>
              <option value="code-desc">Código (Z-A)</option>
              <option value="price-asc">Menor Preço</option>
              <option value="price-desc">Maior Preço</option>
            </select>
          </div>

          {/* Top Pagination (compact) */}
          {filtered.length > itemsPerPage && (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-600 disabled:opacity-50 transition-colors hover:bg-gray-50 shadow-sm"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-xs font-bold text-gray-600 bg-white px-3 py-2 border border-gray-200 rounded-xl shadow-sm">
                {currentPage} / {Math.ceil(filtered.length / itemsPerPage)}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filtered.length / itemsPerPage), p + 1))}
                disabled={currentPage >= Math.ceil(filtered.length / itemsPerPage)}
                className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-600 disabled:opacity-50 transition-colors hover:bg-gray-50 shadow-sm"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <ErrorBoundary scope="tabela de produtos">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-6">
          {filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(p => (
            <ProductCard key={p.id} product={p} onClick={() => setSelectedProduct(p)} />
          ))}
        </div>
      </ErrorBoundary>

      {filtered.length > 0 && (
        <div className="flex items-center justify-center gap-4 pt-10">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-2xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="bg-white px-6 py-3 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-sm font-black text-gray-900">Página {currentPage}</span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">de {Math.ceil(filtered.length / itemsPerPage)}</span>
          </div>
          <button
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(filtered.length / itemsPerPage), p + 1))}
            disabled={currentPage >= Math.ceil(filtered.length / itemsPerPage)}
            className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-2xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="py-20 text-center">
          <Package size={64} className="mx-auto text-gray-200 mb-4" />
          <h3 className="text-xl font-bold text-gray-400">Nenhum item encontrado</h3>
          <p className="text-gray-400">Tente ajustar seus filtros de busca.</p>
        </div>
      )}

      {selectedProduct && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" onClick={e => { if (e.target === e.currentTarget) closeProduct(); }}>
          <div ref={sheetRef} className="bg-white w-full max-w-5xl rounded-t-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[92vh] md:max-h-[90vh] animate-in slide-in-from-bottom-4 md:zoom-in duration-300">
            {/* Drag handle mobile */}
            <div
              className="flex justify-center py-3 md:hidden cursor-grab active:cursor-grabbing touch-none"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div className="w-12 h-1.5 rounded-full bg-gray-300"></div>
            </div>
            <div className="w-full md:w-1/2 bg-slate-50 p-4 md:p-8 flex items-center justify-center aspect-square md:aspect-auto max-h-[35vh] md:max-h-none" onContextMenu={e => e.preventDefault()}>
              <img src={selectedProduct.images[0] || 'https://placehold.co/400x400/f1f5f9/64748b?text=Imagem+Em+Breve'} className="max-w-full max-h-full object-contain mix-blend-multiply select-none pointer-events-none" draggable={false} />
            </div>
            {/* Modal Right Side */}
            <div className="w-full md:w-1/2 p-5 md:p-8 pt-3 md:pt-6 overflow-y-auto flex flex-col relative">
              <button
                onClick={closeProduct}
                className="hidden md:flex absolute top-6 right-6 p-2 bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-900 transition-all hover:rotate-90 duration-300"
              >
                <X size={20} />
              </button>

              <div className="mt-2 md:mt-8">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 md:px-3 py-1 rounded-full">Disponível em Estoque</span>
                <h2 className="text-xl md:text-3xl font-black text-gray-900 mt-3 md:mt-4 leading-tight">{selectedProduct.name}</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">REF: {selectedProduct.internalCode}</p>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Aplicação</p>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm font-bold text-gray-700 leading-relaxed">{selectedProduct.application}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Grupo</p>
                    <p className="text-xs font-bold text-gray-700">{selectedProduct.group}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Posição</p>
                    <p className="text-xs font-bold text-gray-700">{selectedProduct.position}</p>
                  </div>
                </div>

                {selectedProduct.kitComponents && (
                  <div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Componentes do Kit</p>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs font-bold text-gray-700 leading-relaxed">{selectedProduct.kitComponents}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-6 md:pt-10">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subtotal do Item</p>
                    <p className="text-2xl md:text-4xl font-black text-gray-900">{formatPrice(selectedProduct.price * quantity)}</p>
                    {quantity > 1 && (
                      <p className="text-xs font-bold text-gray-400 mt-1">Unitário: {formatPrice(selectedProduct.price)}</p>
                    )}
                  </div>
                  <div className="flex items-center bg-slate-100 p-2 rounded-2xl">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900"><Minus size={18} /></button>
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        setQuantity(isNaN(val) || val < 1 ? 1 : val);
                      }}
                      className="w-14 text-center font-black text-lg bg-transparent border-none outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                    />
                    <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900"><Plus size={18} /></button>
                  </div>
                </div>
                <button
                  onClick={handleAddToCart}
                  className="w-full py-5 text-white font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase text-xs tracking-widest flex items-center justify-center gap-3"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  <ShoppingCart size={20} /> Adicionar ao Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export const Cart: React.FC = () => {
  const { cart, removeFromCart, updateQuantity, clearCart, user, settings } = useContext(AppContext);
  const navigate = useNavigate();
  const [clientName, setClientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [observations, setObservations] = useState('');

  // Discount state (reseller only)
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, number>>({});
  const [orderDiscountPercent, setOrderDiscountPercent] = useState(0);

  const isReseller = user?.role === Role.RESELLER;

  // Discount helpers
  const getItemDiscount = (id: string) => itemDiscounts[id] || 0;
  const setItemDiscount = (id: string, pct: number) => {
    const clamped = Math.min(100, Math.max(0, isNaN(pct) ? 0 : pct));
    setItemDiscounts(prev => ({ ...prev, [id]: clamped }));
  };
  const getItemDiscountedPrice = (item: CartItem) => {
    const disc = getItemDiscount(item.id);
    return Math.round(item.price * (1 - disc / 100) * 100) / 100;
  };

  // Calculation
  const subtotalOriginal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const subtotalWithItemDiscounts = cart.reduce((acc, item) => acc + getItemDiscountedPrice(item) * item.quantity, 0);
  const clampedOrderDiscount = Math.min(100, Math.max(0, isNaN(orderDiscountPercent) ? 0 : orderDiscountPercent));
  const orderDiscountValue = Math.round(subtotalWithItemDiscounts * (clampedOrderDiscount / 100) * 100) / 100;
  const total = Math.round((subtotalWithItemDiscounts - orderDiscountValue) * 100) / 100;
  const totalDiscount = Math.round((subtotalOriginal - total) * 100) / 100;

  // Reseller: client portfolio selector
  const [resellerClients, setResellerClients] = useState<ResellerClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickClient, setQuickClient] = useState({ companyName: '', tradeName: '', cnpj: '', phone: '', email: '' });
  const clientDropdownRef = useRef<HTMLDivElement>(null);


  // Load reseller clients
  useEffect(() => {
    if (isReseller && user) {
      db.getResellerClients(user.id).then(setResellerClients);
    }
  }, [isReseller, user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) setShowClientDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredClients = resellerClients.filter(c =>
    c.companyName.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.tradeName.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.cnpj.includes(clientSearch)
  );

  const selectedClient = resellerClients.find(c => c.id === selectedClientId);
  const paymentOptions = getPaymentOptions(total, settings.paymentPolicies);

  // Reset payment method when total changes and current selection is no longer valid
  useEffect(() => {
    if (paymentMethod && !paymentOptions.some(o => o.label === paymentMethod)) {
      setPaymentMethod('');
    }
  }, [total, paymentOptions]);

  const handleCheckout = async () => {
    if (!user) return;
    if (isReseller && !selectedClientId) {
      alert('Por favor, selecione um cliente da sua carteira para finalizar o pedido.');
      return;
    }
    if (!paymentMethod) {
      alert('Por favor, selecione uma condição de pagamento para finalizar o pedido.');
      return;
    }
    const clientForOrder = selectedClient;
    const newOrder: Order = {
      id: crypto.randomUUID(),
      userId: user.id,
      userStoreName: user.storeName,
      ...(isReseller && clientForOrder ? { clientName: clientForOrder.tradeName || clientForOrder.companyName, resellerClientId: clientForOrder.id } : {}),
      paymentMethod,
      ...(observations.trim() ? { observations: observations.trim() } : {}),
      items: cart.map(i => {
        const disc = isReseller ? getItemDiscount(i.id) : 0;
        const discPrice = isReseller ? getItemDiscountedPrice(i) : i.price;
        return {
          productId: i.id,
          productName: i.name,
          name: i.name,
          internalCode: i.internalCode || '',
          application: i.application || '',
          image: i.images?.[0] || '',
          quantity: i.quantity,
          price: i.price,
          ...(disc > 0 ? { discountPercent: disc, discountedPrice: discPrice } : {})
        };
      }),
      total,
      ...(isReseller && totalDiscount > 0 ? { totalDiscount, orderDiscountPercent: clampedOrderDiscount } : {}),
      status: 'ANALYSIS',
      date: new Date().toISOString()
    };
    await db.createOrder(newOrder);
    clearCart();
    alert('Pedido enviado com sucesso! Aguarde a conferência financeira.');
    navigate('/pedidos');
  };

  // Quick add client from cart
  const handleQuickAddClient = async () => {
    if (!user || !quickClient.companyName.trim()) return;
    const newClient: ResellerClient = {
      id: crypto.randomUUID(),
      resellerId: user.id,
      companyName: quickClient.companyName.trim(),
      tradeName: quickClient.tradeName.trim(),
      cnpj: quickClient.cnpj.trim(),
      phone: quickClient.phone.trim(),
      email: quickClient.email.trim(),
      notes: '',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    await db.saveResellerClient(newClient);
    setResellerClients(prev => [...prev, newClient]);
    setSelectedClientId(newClient.id);
    setShowQuickAdd(false);
    setQuickClient({ companyName: '', tradeName: '', cnpj: '', phone: '', email: '' });
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-gray-200 mb-6">
          <ShoppingCart size={48} />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Seu carrinho está vazio</h2>
        <p className="text-gray-500 font-medium mb-8">Navegue pelo catálogo para selecionar as peças de reposição.</p>
        <button onClick={() => navigate('/catalogo')} className="px-8 py-4 bg-gray-900 text-white font-black rounded-2xl hover:scale-105 transition-all text-sm uppercase tracking-widest shadow-xl">Voltar ao Catálogo</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-500">
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-3xl font-black text-gray-900 mb-8">Itens no Pedido</h1>
        {cart.map(item => {
          const disc = isReseller ? getItemDiscount(item.id) : 0;
          const discPrice = getItemDiscountedPrice(item);
          const itemTotal = (disc > 0 ? discPrice : item.price) * item.quantity;
          return (
            <div key={item.id} className="bg-white p-4 md:p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-3 md:gap-6 group hover:border-gray-200 transition-all">
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl bg-slate-50 overflow-hidden flex-shrink-0" onContextMenu={e => e.preventDefault()}>
                <img src={item.images[0] || 'https://placehold.co/400x400/f1f5f9/64748b?text=Imagem+Em+Breve'} className="w-full h-full object-cover select-none pointer-events-none" draggable={false} />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="font-extrabold text-gray-900 leading-tight mb-1 truncate">{item.name}</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">SKU: {item.internalCode}</p>
                <div className="mt-3 md:mt-4 flex items-center gap-2 flex-wrap">
                  <div className="flex items-center bg-slate-50 p-1 md:p-1.5 rounded-xl flex-shrink-0 h-8 md:h-9">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 md:p-1.5 text-gray-400 hover:text-gray-900 transition-colors"><Minus size={14} /></button>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        updateQuantity(item.id, isNaN(val) || val < 1 ? 1 : val);
                      }}
                      className="w-10 md:w-12 text-center font-black text-xs bg-transparent border-none outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] cursor-text hover:bg-white hover:rounded-lg transition-colors"
                    />
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 md:p-1.5 text-gray-400 hover:text-gray-900 transition-colors"><Plus size={14} /></button>
                  </div>
                  {/* Per-item discount (reseller only) */}
                  {isReseller && (
                    <div className="flex items-center bg-slate-50 p-1 md:p-1.5 rounded-xl flex-shrink-0 h-8 md:h-9">
                      <span className="px-1.5 text-gray-400"><Percent size={12} /></span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={disc || ''}
                        placeholder="0"
                        onChange={e => setItemDiscount(item.id, parseFloat(e.target.value))}
                        className="w-10 md:w-12 text-center font-black text-xs text-gray-700 bg-transparent border-none outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] cursor-text hover:bg-white hover:rounded-lg transition-colors"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0 self-center">
                {disc > 0 ? (
                  <>
                    <p className="text-[10px] text-gray-400 line-through font-bold">{formatPrice(item.price * item.quantity)}</p>
                    <p className="font-black text-emerald-700 text-sm md:text-base">{formatPrice(itemTotal)}</p>
                  </>
                ) : (
                  <p className="font-black text-gray-900 text-sm md:text-base whitespace-nowrap">{formatPrice(itemTotal)}</p>
                )}
              </div>
              <button onClick={() => removeFromCart(item.id)} className="p-2 md:p-3 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"><Trash2 size={18} /></button>
            </div>
          );
        })}
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl sticky top-28">
          <h2 className="text-xl font-black text-gray-900 mb-6">Resumo do Faturamento</h2>

          {/* Campo de nome do cliente para revendedores */}
          {isReseller && (
            <div className="mb-6" ref={clientDropdownRef}>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Cliente *</label>
              {/* Selected client display */}
              {selectedClient ? (
                <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border-2 border-emerald-200 rounded-2xl">
                  <div>
                    <p className="text-sm font-bold text-emerald-800">{selectedClient.tradeName || selectedClient.companyName}</p>
                    {selectedClient.cnpj && <p className="text-[10px] text-emerald-600 font-medium">CNPJ: {selectedClient.cnpj}</p>}
                  </div>
                  <button onClick={() => { setSelectedClientId(''); setClientSearch(''); }} className="text-emerald-500 hover:text-red-500 transition-colors"><X size={16} /></button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                    onFocus={() => setShowClientDropdown(true)}
                    placeholder="Buscar cliente por nome, fantasia ou CNPJ..."
                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300"
                  />
                  <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                  {showClientDropdown && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-56 overflow-y-auto">
                      {filteredClients.length > 0 ? filteredClients.map(c => (
                        <button key={c.id} onClick={() => { setSelectedClientId(c.id); setShowClientDropdown(false); setClientSearch(''); }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl border-b border-gray-50 last:border-0">
                          <p className="text-sm font-bold text-gray-900">{c.tradeName || c.companyName}</p>
                          <p className="text-[10px] text-gray-400 font-medium">{c.companyName}{c.cnpj ? ` • ${c.cnpj}` : ''}</p>
                        </button>
                      )) : (
                        <div className="px-4 py-4 text-center">
                          <p className="text-xs text-gray-400 font-medium">Nenhum cliente encontrado.</p>
                        </div>
                      )}
                      <button onClick={() => { setShowQuickAdd(true); setShowClientDropdown(false); }}
                        className="w-full px-4 py-3 text-left font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-colors rounded-b-2xl border-t border-gray-100 flex items-center gap-2"
                        style={{ color: settings.primaryColor }}>
                        <Plus size={14} /> Cadastrar Novo Cliente
                      </button>
                    </div>
                  )}
                </div>
              )}
              <p className="text-[10px] text-gray-400 font-medium mt-1.5 ml-1">Selecione o cliente vinculado a este pedido.</p>
            </div>
          )}

          {/* Quick Add Client Modal */}
          {showQuickAdd && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md" onClick={e => { if (e.target === e.currentTarget) setShowQuickAdd(false); }}>
              <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in duration-300">
                <h3 className="text-xl font-black text-gray-900 mb-6">Cadastro Rápido de Cliente</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Razão Social *</label>
                    <input type="text" value={quickClient.companyName} onChange={e => setQuickClient(p => ({ ...p, companyName: e.target.value }))}
                      placeholder="Razão Social da empresa" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Nome Fantasia</label>
                    <input type="text" value={quickClient.tradeName} onChange={e => setQuickClient(p => ({ ...p, tradeName: e.target.value }))}
                      placeholder="Nome Fantasia" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">CNPJ</label>
                      <input type="text" value={quickClient.cnpj} onChange={e => setQuickClient(p => ({ ...p, cnpj: e.target.value }))}
                        placeholder="00.000.000/0001-00" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Telefone</label>
                      <input type="text" value={quickClient.phone} onChange={e => setQuickClient(p => ({ ...p, phone: e.target.value }))}
                        placeholder="(00) 00000-0000" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">E-mail</label>
                    <input type="text" value={quickClient.email} onChange={e => setQuickClient(p => ({ ...p, email: e.target.value }))}
                      placeholder="email@empresa.com" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300" />
                  </div>
                </div>
                <div className="flex gap-3 mt-8">
                  <button onClick={handleQuickAddClient} disabled={!quickClient.companyName.trim()}
                    className="flex-1 py-3.5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    style={{ backgroundColor: settings.primaryColor }}>Cadastrar e Selecionar</button>
                  <button onClick={() => setShowQuickAdd(false)}
                    className="px-6 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>
                </div>
              </div>
            </div>
          , document.body)}

          <div className="space-y-4 mb-8">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-bold">Subtotal ({cart.length} itens)</span>
              <span className="text-gray-900 font-black">{formatPrice(subtotalOriginal)}</span>
            </div>
            {/* Item discounts summary */}
            {isReseller && subtotalOriginal !== subtotalWithItemDiscounts && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-bold">Descontos por item</span>
                <span className="text-red-500 font-black">-{formatPrice(subtotalOriginal - subtotalWithItemDiscounts)}</span>
              </div>
            )}
            {/* Order-level discount (reseller only) */}
            {isReseller && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-500 font-bold shrink-0">Desconto geral</span>
                {clampedOrderDiscount > 0 && (
                  <span className="text-sm text-red-500 font-black ml-auto mr-1">-{formatPrice(orderDiscountValue)}</span>
                )}
                <div className="flex items-center bg-slate-50 p-1 md:p-1.5 rounded-xl">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={orderDiscountPercent || ''}
                    placeholder="0"
                    onChange={e => setOrderDiscountPercent(parseFloat(e.target.value) || 0)}
                    className="w-12 text-center font-black text-xs text-gray-700 bg-transparent border-none outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] cursor-text hover:bg-white hover:rounded-lg transition-colors"
                  />
                  <span className="text-xs font-black text-gray-400 pr-1">%</span>
                </div>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-bold">Frete</span>
              <span className="text-green-600 font-black uppercase text-[10px] bg-green-50 px-2 py-0.5 rounded-md">A combinar</span>
            </div>
          </div>
          <div className="pt-6 border-t border-gray-100 mb-6">
            <div className="flex justify-between items-end">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Geral</span>
              <span className="text-3xl font-black text-gray-900">{formatPrice(total)}</span>
            </div>
          </div>

          {/* Condição de Pagamento */}
          <div className="mb-6">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Condição de Pagamento *</label>
            <div className="space-y-2">
              {paymentOptions.map((option) => {
                const inst = getInstallmentInfo(option, total);
                const isSelected = paymentMethod === option.label;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setPaymentMethod(option.label)}
                    className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all font-bold text-sm flex items-start gap-3 ${isSelected
                      ? 'border-primary/50 bg-primary/5 text-gray-900 shadow-sm'
                      : 'border-transparent bg-slate-50 text-gray-600 hover:border-gray-200'
                      }`}
                    style={isSelected ? { borderColor: `${settings.primaryColor}50`, backgroundColor: `${settings.primaryColor}08` } : {}}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all mt-0.5 ${isSelected ? 'border-primary' : 'border-gray-300'
                        }`}
                      style={isSelected ? { borderColor: settings.primaryColor } : {}}
                    >
                      {isSelected && (
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: settings.primaryColor }}></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span>{option.label}</span>
                        {inst.discountPercent > 0 && (
                          <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                            {inst.discountPercent}% OFF
                          </span>
                        )}
                      </div>
                      {inst.isAvista ? (
                        <p className="text-[11px] font-bold text-gray-400 mt-1">
                          {inst.discountPercent > 0 ? (
                            <>
                              <span className="line-through text-gray-300 mr-1">{formatPrice(total)}</span>
                              <span className="text-green-600 font-black">{formatPrice(inst.discountedTotal)}</span>
                              <span className="text-green-500 ml-1">(economize {formatPrice(total - inst.discountedTotal)})</span>
                            </>
                          ) : (
                            <>Valor total: {formatPrice(total)}</>
                          )}
                        </p>
                      ) : (
                        <p className="text-[11px] font-bold text-gray-400 mt-1">
                          {inst.count}x de {formatPrice(inst.value)}
                          {inst.discountPercent > 0 && (
                            <span className="text-green-600 ml-1">(total: {formatPrice(inst.discountedTotal)})</span>
                          )}
                          {inst.days.length > 0 && (
                            <span className="text-gray-300"> — vencimentos em {inst.days.length > 1 ? inst.days.slice(0, -1).join(', ') + ' e ' + inst.days[inst.days.length - 1] : inst.days[0]} dias</span>
                          )}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 font-medium mt-2 ml-1">Selecione a forma de pagamento conforme a política comercial.</p>
          </div>

          {/* Observações */}
          <div className="mb-6">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Observações (Opcional)</label>
            <textarea
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Adicione observações ao pedido, se necessário..."
              className="w-full px-4 py-3.5 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300 resize-none h-24"
            />
          </div>

          <button
            onClick={handleCheckout}
            disabled={isReseller ? !selectedClientId || !paymentMethod : !paymentMethod}
            className="w-full py-5 text-white font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase text-xs tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ backgroundColor: settings.primaryColor }}
          >
            Finalizar Orçamento
          </button>
          <button onClick={() => navigate('/catalogo')} className="w-full mt-4 py-4 text-gray-400 font-bold text-xs uppercase tracking-widest hover:text-gray-900 transition-colors">Continuar Comprando</button>
        </div>
      </div>
    </div>
  );
};

export const MyOrders: React.FC = () => {
  const { user, settings } = useContext(AppContext);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const navigate = useNavigate();

  // ESC to close + body scroll lock for order detail modal
  useEffect(() => {
    if (!selectedOrder) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedOrder(null); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedOrder]);

  useEffect(() => {
    const loadOrders = async () => {
      if (user) {
        const data = await db.getOrders();
        setOrders(data.filter(o => o.userId === user.id));
      }
    };
    loadOrders();
  }, [user]);

  const getStatusStyle = (status: OrderStatus) => {
    switch (status) {
      case 'ANALYSIS': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'APPROVED': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'PENDING': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'SHIPPED': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'COMPLETED': return 'bg-green-50 text-green-700 border-green-100';
      case 'CANCELED': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const statusLabel = (status: OrderStatus) => {
    switch (status) {
      case 'ANALYSIS': return 'Em Análise';
      case 'APPROVED': return 'Aprovado';
      case 'PENDING': return 'Pendente';
      case 'SHIPPED': return 'Enviado';
      case 'COMPLETED': return 'Faturado / Concluído';
      case 'CANCELED': return 'Cancelado';
    }
  };

  const handleOrderStatus = async (order: Order, newStatus: OrderStatus) => {
    const updated = { ...order, status: newStatus };
    await db.updateOrder(updated);
    setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
    if (selectedOrder?.id === order.id) setSelectedOrder(updated);
  };

  const generatePDF = async (order: Order) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const companyName = settings.companyName || 'MWE';

    // ====== HEADER COM LOGO ======
    let headerH = 38;
    // Fundo do header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, headerH, 'F');

    // Tentar carregar logo
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
        // Fallback: texto
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

    // Texto direito do header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 200, 200);
    doc.text('COMPROVANTE DE PEDIDO', pageW - 14, 16, { align: 'right' });
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(`#${order.id.slice(0, 8).toUpperCase()}`, pageW - 14, 26, { align: 'right' });

    // ====== INFORMAÇÕES DO PEDIDO E CLIENTE ======
    let y = headerH + 12;

    // Caixa de info
    doc.setFillColor(248, 250, 252);
    const infoBoxH = order.clientName ? 42 : 30;
    doc.roundedRect(14, y - 4, pageW - 28, infoBoxH, 3, 3, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(150);
    doc.text('DATA', 20, y + 2);
    doc.text('STATUS', 65, y + 2);
    doc.text('REVENDEDOR', 115, y + 2);
    doc.text('CNPJ', 115, y + 14);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(new Date(order.date).toLocaleDateString('pt-BR'), 20, y + 9);
    doc.text(statusLabel(order.status) || '', 65, y + 9);
    doc.text(user?.storeName || order.userStoreName || '-', 115, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(user?.cnpj || '-', 115, y + 21);

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
      item.name || item.productName || item.productId || '-',
      item.application || '-',
      String(item.quantity),
      formatPrice(item.price || 0),
      formatPrice((item.price || 0) * (item.quantity || 1))
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
    doc.text(formatPrice(order.total), totalBoxX + totalBoxW - 6, finalY + 13, { align: 'right' });

    // Quantidade de itens
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`${order.items.length} ${order.items.length === 1 ? 'item' : 'itens'} no pedido`, 14, finalY + 12);

    // Condição de Pagamento
    if (order.paymentMethod) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80);
      doc.text(`Condição de Pagamento: ${order.paymentMethod}`, 14, finalY + 20);
    }

    // Observações
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

    doc.save(`pedido-${order.id.slice(0, 8)}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Meus Pedidos</h1>
          <p className="text-gray-500 font-medium">Acompanhe o status e histórico das suas compras.</p>
        </div>
        <button onClick={() => navigate('/catalogo')} className="px-6 py-3 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2" style={{ backgroundColor: settings.primaryColor }}><Plus size={14} /> Novo Pedido</button>
      </div>

      <div className="space-y-4">
        {orders.length > 0 ? (
          orders.map(order => (
            <div key={order.id} className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm hover:border-gray-300 transition-all flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1 w-full">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-black text-gray-900 uppercase tracking-widest">#{order.id.slice(0, 8).toUpperCase()}</span>
                  <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyle(order.status)}`}>
                    {statusLabel(order.status)}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data</p>
                    <p className="text-sm font-bold text-gray-900">{new Date(order.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Itens</p>
                    <p className="text-sm font-bold text-gray-900">{order.items.length} un.</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Valor Total</p>
                    <p className="text-sm font-black text-primary" style={{ color: settings.primaryColor }}>{formatPrice(order.total)}</p>
                  </div>
                  {order.clientName && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cliente</p>
                      <p className="text-sm font-bold text-gray-900">{order.clientName}</p>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(order)}
                className="w-full md:w-auto px-8 py-4 bg-gray-50 text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-900 hover:text-white transition-all"
              >
                Ver Detalhes
              </button>
            </div>
          ))
        ) : (
          <div className="py-20 text-center bg-white rounded-[3rem] border border-gray-100 border-dashed">
            <ClipboardList size={64} className="mx-auto text-gray-100 mb-6" />
            <h3 className="text-xl font-black text-gray-400">Você ainda não realizou pedidos</h3>
            <button onClick={() => navigate('/catalogo')} className="mt-6 px-8 py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">Ir para o Catálogo</button>
          </div>
        )}
      </div>

      {/* Modal Detalhes do Pedido */}
      {selectedOrder && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" onClick={e => { if (e.target === e.currentTarget) setSelectedOrder(null); }}>
          <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col">
            {/* Header */}
            <div className="p-8 pb-0 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Detalhes do Pedido</h2>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">#{selectedOrder.id.slice(0, 8).toUpperCase()}</p>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(selectedOrder.status)}`}>
                    {statusLabel(selectedOrder.status)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-900 transition-all hover:rotate-90 duration-300"
              >
                <X size={20} />
              </button>
            </div>

            {/* Info */}
            <div className="px-8 pt-6 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Data</p>
                  <p className="text-sm font-bold text-gray-900">{new Date(selectedOrder.date).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Itens</p>
                  <p className="text-sm font-bold text-gray-900">{selectedOrder.items.length}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-sm font-black" style={{ color: settings.primaryColor }}>{formatPrice(selectedOrder.total)}</p>
                </div>
              </div>
              {selectedOrder.clientName && (
                <div className="mt-4 bg-purple-50 p-4 rounded-2xl border border-purple-100">
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1">Cliente Final</p>
                  <p className="text-sm font-bold text-purple-800">{selectedOrder.clientName}</p>
                </div>
              )}
              {selectedOrder.paymentMethod && (
                <div className="mt-4 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Condição de Pagamento</p>
                  <p className="text-sm font-bold text-emerald-800">{selectedOrder.paymentMethod}</p>
                </div>
              )}
              {selectedOrder.observations && (
                <div className="mt-4 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Observações</p>
                  <p className="text-sm font-bold text-amber-800 whitespace-pre-wrap">{selectedOrder.observations}</p>
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="px-8 flex-1 overflow-y-auto">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Itens do Pedido</p>
              <div className="space-y-3">
                {selectedOrder.items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-xl bg-white border border-gray-100 overflow-hidden flex-shrink-0">
                      <img
                        src={item.image || 'https://placehold.co/100x100/f1f5f9/94a3b8?text=...'}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{item.name || item.productName || item.productId}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {item.internalCode && (
                          <p className="text-[10px] text-gray-400 font-medium">Cód: <span className="font-bold text-gray-600">{item.internalCode}</span></p>
                        )}
                        <p className="text-[10px] text-gray-400 font-medium">Qtd: <span className="font-bold text-gray-600">{item.quantity}</span></p>
                      </div>
                      {item.application && (
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5 truncate">Aplicação: <span className="text-gray-500">{item.application}</span></p>
                      )}
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-xs font-bold text-gray-900">{formatPrice((item.price || 0) * (item.quantity || 1))}</p>
                      <p className="text-[10px] text-gray-400">{formatPrice(item.price || 0)} /un</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 pt-6 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Total</p>
                <p className="text-2xl font-black" style={{ color: settings.primaryColor }}>{formatPrice(selectedOrder.total)}</p>
              </div>
              <div className="flex gap-3">
                {/* Reseller: approve order */}
                {user?.role === 'RESELLER' && selectedOrder.status === 'ANALYSIS' && (
                  <button
                    onClick={() => handleOrderStatus(selectedOrder, 'APPROVED')}
                    className="px-6 py-3.5 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 size={14} /> Aprovar Pedido
                  </button>
                )}
                <button
                  onClick={() => generatePDF(selectedOrder)}
                  className="px-6 py-3.5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  <Download size={14} /> Baixar PDF
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-6 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

// ====== MEUS CLIENTES (Reseller Only) ======
export const MyClients: React.FC = () => {
  const { user, settings } = useContext(AppContext);
  const navigate = useNavigate();
  const [clients, setClients] = useState<ResellerClient[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allUsers, setAllUsers] = useState<import('../types').User[]>([]);
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState<ResellerClient | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<ResellerClient | null>(null);
  const [form, setForm] = useState({ companyName: '', tradeName: '', cnpj: '', phone: '', email: '', notes: '' });

  const isReseller = user?.role === Role.RESELLER;

  useEffect(() => {
    if (!user || !isReseller) return;
    db.getResellerClients(user.id).then(setClients);
    db.getOrders().then(setOrders);
    db.getUsers().then(setAllUsers);
  }, [user, isReseller]);

  // ESC to close modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowForm(false); setSelectedDetail(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const formatPrice = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const DAYS_ACTIVE = 30;
  const now = Date.now();

  // Activity helpers — show orders linked via resellerClientId OR from the linked user themselves
  const getClientOrders = (client: ResellerClient) => {
    const byClientId = orders.filter(o => o.resellerClientId === client.id);
    if (client.linkedUserId) {
      // Include ALL orders from the linked user (their own orders)
      const byUserId = orders.filter(o =>
        o.userId === client.linkedUserId &&
        o.resellerClientId !== client.id  // avoid duplicates
      );
      return [...byClientId, ...byUserId];
    }
    return byClientId;
  };
  const getLastOrderDate = (client: ResellerClient) => {
    const co = getClientOrders(client);
    if (co.length === 0) return null;
    return co.reduce((latest, o) => new Date(o.date) > new Date(latest.date) ? o : latest, co[0]);
  };
  // Active = linked user has APPROVED status (or no linked user = based on client.status)
  const isActive = (client: ResellerClient) => {
    if (client.linkedUserId) {
      const linkedUser = allUsers.find(u => u.id === client.linkedUserId);
      return linkedUser?.status === 'APPROVED';
    }
    return client.status === 'ACTIVE';
  };
  // Last login for linked users
  const getLastLogin = (client: ResellerClient) => {
    if (!client.linkedUserId) return null;
    const linkedUser = allUsers.find(u => u.id === client.linkedUserId);
    return linkedUser?.lastLogin || null;
  };

  const filtered = clients.filter(c =>
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.tradeName.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj.includes(search)
  );

  const openNew = () => {
    setEditingClient(null);
    setForm({ companyName: '', tradeName: '', cnpj: '', phone: '', email: '', notes: '' });
    setShowForm(true);
  };

  const openEdit = (c: ResellerClient) => {
    setEditingClient(c);
    setForm({ companyName: c.companyName, tradeName: c.tradeName, cnpj: c.cnpj, phone: c.phone, email: c.email, notes: c.notes });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user || !form.companyName.trim()) return;
    const client: ResellerClient = {
      id: editingClient?.id || crypto.randomUUID(),
      resellerId: user.id,
      linkedUserId: editingClient?.linkedUserId,
      companyName: form.companyName.trim(),
      tradeName: form.tradeName.trim(),
      cnpj: form.cnpj.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      notes: form.notes.trim(),
      status: editingClient?.status || 'ACTIVE',
      createdAt: editingClient?.createdAt || new Date().toISOString()
    };
    await db.saveResellerClient(client);
    if (editingClient) {
      setClients(prev => prev.map(c => c.id === client.id ? client : c));
    } else {
      setClients(prev => [...prev, client]);
    }
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este cliente da sua carteira?')) return;
    await db.deleteResellerClient(id);
    setClients(prev => prev.filter(c => c.id !== id));
    if (selectedDetail?.id === id) setSelectedDetail(null);
  };

  if (!isReseller) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <p className="text-gray-400 font-bold">Área exclusiva para revendedores.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Meus Clientes</h1>
          <p className="text-gray-500 font-medium">Gerencie sua carteira de clientes e acompanhe a atividade.</p>
        </div>
        <button onClick={openNew} className="px-6 py-3 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2" style={{ backgroundColor: settings.primaryColor }}>
          <Plus size={14} /> Novo Cliente
        </button>
      </div>

      {/* Search + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
        <div className="md:col-span-2 relative flex items-center">
          <Search size={18} className="absolute left-4 text-gray-300 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, fantasia ou CNPJ..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-sm text-gray-700 focus:border-gray-400 transition-all placeholder:text-gray-300" />
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center flex flex-col items-center justify-center">
          <p className="text-2xl font-black text-gray-900">{clients.length}</p>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total de Clientes</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center flex flex-col items-center justify-center">
          <p className="text-2xl font-black text-emerald-600">{clients.filter(c => isActive(c)).length}</p>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Clientes Ativos</p>
        </div>
      </div>

      {/* Client Cards */}
      <div className="space-y-3">
        {filtered.length > 0 ? filtered.map(client => {
          const co = getClientOrders(client);
          const lastOrder = getLastOrderDate(client);
          const active = isActive(client);
          const lastLogin = getLastLogin(client);
          return (
            <div key={client.id} className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm hover:border-gray-300 transition-all">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                {/* Avatar + Name */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0"
                    style={{ backgroundColor: `${settings.primaryColor}15`, color: settings.primaryColor }}>
                    {(client.tradeName || client.companyName).charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-gray-900 truncate">{client.tradeName || client.companyName}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                        {active ? 'Ativo' : 'Inativo'}
                      </span>
                      {client.linkedUserId && (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100">Login Vinculado</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium truncate">{client.companyName}{client.cnpj ? ` • ${client.cnpj}` : ''}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-center">
                    <p className="text-sm font-black text-gray-900">{co.length}</p>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Pedidos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-gray-900">{lastOrder ? new Date(lastOrder.date).toLocaleDateString('pt-BR') : '—'}</p>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Último Pedido</p>
                  </div>
                  {lastLogin && (
                    <div className="text-center">
                      <p className="text-sm font-black text-gray-900">{new Date(lastLogin).toLocaleDateString('pt-BR')}</p>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Último Login</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedDetail(client)} className="px-4 py-2 bg-gray-50 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all">Detalhes</button>
                    {!client.linkedUserId && (
                      <button onClick={() => openEdit(client)} className="px-4 py-2 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all" style={{ backgroundColor: settings.primaryColor }}>Editar</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 p-16 text-center">
            <UserIcon size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-lg font-black text-gray-300 mb-1">Nenhum cliente cadastrado</p>
            <p className="text-sm text-gray-400 font-medium mb-6">Comece adicionando clientes à sua carteira.</p>
            <button onClick={openNew} className="px-6 py-3 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all" style={{ backgroundColor: settings.primaryColor }}>Cadastrar Primeiro Cliente</button>
          </div>
        )}
      </div>

      {/* Modal: Create/Edit Client */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-gray-900 mb-6">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Razão Social *</label>
                <input type="text" value={form.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))}
                  placeholder="Razão Social" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Nome Fantasia</label>
                <input type="text" value={form.tradeName} onChange={e => setForm(p => ({ ...p, tradeName: e.target.value }))}
                  placeholder="Nome Fantasia" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">CNPJ</label>
                  <input type="text" value={form.cnpj} onChange={e => setForm(p => ({ ...p, cnpj: e.target.value }))}
                    placeholder="00.000.000/0001-00" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Telefone</label>
                  <input type="text" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="(00) 00000-0000" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">E-mail</label>
                <input type="text" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="email@empresa.com" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Observações</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Notas sobre o cliente..." className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold text-sm text-gray-700 transition-all placeholder:text-gray-300 resize-none h-20" />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={handleSave} disabled={!form.companyName.trim()}
                className="flex-1 py-3.5 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                style={{ backgroundColor: settings.primaryColor }}>{editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}</button>
              <button onClick={() => setShowForm(false)}
                className="px-6 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Modal: Client Details */}
      {selectedDetail && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md" onClick={e => { if (e.target === e.currentTarget) setSelectedDetail(null); }}>
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col">
            {/* Header */}
            <div className="p-8 pb-0 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900">{selectedDetail.tradeName || selectedDetail.companyName}</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{selectedDetail.companyName}</p>
              </div>
              <button onClick={() => setSelectedDetail(null)} className="p-2 bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-900 transition-all hover:rotate-90 duration-300"><X size={20} /></button>
            </div>

            {/* Info */}
            <div className="px-8 pt-6 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {selectedDetail.cnpj && <div className="bg-gray-50 p-3 rounded-2xl"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">CNPJ</p><p className="text-xs font-bold text-gray-900">{selectedDetail.cnpj}</p></div>}
                {selectedDetail.phone && <div className="bg-gray-50 p-3 rounded-2xl"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Telefone</p><p className="text-xs font-bold text-gray-900">{selectedDetail.phone}</p></div>}
                {selectedDetail.email && <div className="bg-gray-50 p-3 rounded-2xl"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">E-mail</p><p className="text-xs font-bold text-gray-900">{selectedDetail.email}</p></div>}
                <div className="bg-gray-50 p-3 rounded-2xl"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Cadastro</p><p className="text-xs font-bold text-gray-900">{new Date(selectedDetail.createdAt).toLocaleDateString('pt-BR')}</p></div>
              </div>
              {selectedDetail.notes && (
                <div className="mt-3 bg-amber-50 p-3 rounded-2xl border border-amber-100">
                  <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Observações</p>
                  <p className="text-xs text-amber-800 font-medium">{selectedDetail.notes}</p>
                </div>
              )}
              {selectedDetail.linkedUserId && (
                <div className="mt-3 bg-blue-50 p-3 rounded-2xl border border-blue-100">
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Login Vinculado</p>
                  <p className="text-xs text-blue-800 font-medium">Este cliente possui conta própria no catálogo.{(() => { const ll = getLastLogin(selectedDetail); return ll ? ` Último login: ${new Date(ll).toLocaleString('pt-BR')}` : ''; })()}</p>
                </div>
              )}
            </div>

            {/* Recent Orders */}
            <div className="px-8 pb-4 flex-1 overflow-y-auto">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Pedidos Recentes</p>
              {(() => {
                const co = getClientOrders(selectedDetail);
                if (co.length === 0) return <p className="text-xs text-gray-400 font-medium py-4 text-center">Nenhum pedido registrado para este cliente.</p>;
                return (
                  <div className="space-y-2">
                    {co.slice(0, 10).map(order => (
                      <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                          <p className="text-xs font-bold text-gray-900">#{order.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-[10px] text-gray-400 font-medium">{new Date(order.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <p className="text-sm font-black" style={{ color: settings.primaryColor }}>{formatPrice(order.total)}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-8 pt-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => handleDelete(selectedDetail.id)} className="px-5 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all">Remover</button>
              {!selectedDetail.linkedUserId && (
                <button onClick={() => { openEdit(selectedDetail); setSelectedDetail(null); }} className="px-5 py-3 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all" style={{ backgroundColor: settings.primaryColor }}>Editar</button>
              )}
              <button onClick={() => setSelectedDetail(null)} className="px-5 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all">Fechar</button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export const Profile: React.FC = () => {
  const { user, settings } = useContext(AppContext);
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-xl overflow-hidden">
        <div className="h-40 bg-slate-900 relative">
          <div className="absolute -bottom-12 left-12 w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center text-4xl font-black text-slate-900 border-4 border-white">
            {user.storeName.charAt(0)}
          </div>
        </div>
        <div className="px-12 pt-20 pb-12">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h1 className="text-3xl font-black text-gray-900">{user.storeName}</h1>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">CNPJ: {user.cnpj}</p>
            </div>
            <div className="bg-green-50 text-green-700 px-4 py-2 rounded-2xl border border-green-100 flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Conta Verificada</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-8">
              <div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Informações de Contato</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-gray-400"><Mail size={18} /></div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">E-mail Corporativo</p>
                      <p className="text-sm font-bold text-gray-900">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-gray-400"><MessageCircle size={18} /></div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">WhatsApp de Compras</p>
                      <p className="text-sm font-bold text-gray-900">{user.phone}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Dados Administrativos</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-gray-400"><UserIcon size={18} /></div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Responsável pela Loja</p>
                      <p className="text-sm font-bold text-gray-900">{user.responsibleName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-gray-400"><Tag size={18} /></div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Tipo de Parceiro</p>
                      <p className="text-sm font-bold text-gray-900">Lojista Revendedor</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 pt-10 border-t border-gray-50">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center">Para alterar dados cadastrais, entre em contato com seu consultor de vendas.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
