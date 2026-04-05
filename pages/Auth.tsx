
import React, { useState, useContext, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { Role } from '../types';
import { Building2, Phone, Mail, Lock, User as UserIcon, FileText, ArrowRight, ArrowLeft, Check, Eye, EyeOff, ShieldCheck, AlertCircle, KeyRound } from 'lucide-react';
import { db } from '../services/db';

export const Login: React.FC = () => {
  const { login, settings } = useContext(AppContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    try {
      // Login agora é feito via API com JWT
      const result = await db.login(email, password);
      const user = result.user;

      login(user);

      if (user.role === Role.ADMIN) {
        navigate('/admin/dashboard');
      } else if (user.role === Role.RESELLER && (user.permissions || []).includes('admin_panel')) {
        navigate('/admin/dashboard');
      } else {
        navigate('/catalogo');
      }
    } catch (err: any) {
      const msg = err?.message || 'Erro ao conectar com o servidor.';
      setError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const getErrorStyle = () => {
    if (error.includes('análise')) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', icon: <AlertCircle size={16} className="text-amber-500 shrink-0" /> };
    if (error.includes('recusada')) return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100', icon: <AlertCircle size={16} className="text-red-500 shrink-0" /> };
    if (error.includes('Senha')) return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100', icon: <Lock size={16} className="text-red-500 shrink-0" /> };
    return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100', icon: <AlertCircle size={16} className="text-red-500 shrink-0" /> };
  };

  const errStyle = getErrorStyle();
  const inputBase = "w-full pl-12 pr-5 py-4 bg-gray-50 text-gray-900 border-2 rounded-2xl outline-none focus:bg-white focus:ring-4 font-bold transition-all placeholder:text-gray-300 disabled:opacity-50";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-[1rem] md:rounded-[1.25rem] shadow-2xl p-10 border border-gray-100 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} className="h-12 mx-auto mb-4" alt="Logo" />
          ) : (
            <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white text-3xl font-black shadow-lg" style={{ backgroundColor: settings.primaryColor }}>
              {settings.companyName.charAt(0)}
            </div>
          )}
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">{settings.companyName}</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Catálogo Online • Acesso Restrito</p>
        </div>

        {error && (
          <div className={`mb-6 p-4 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-300 flex items-center gap-3 ${errStyle.bg} ${errStyle.text} ${errStyle.border}`}>
            {errStyle.icon}
            <p className="text-xs font-bold leading-snug">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="email"
                id="login-email"
                name="email"
                autoComplete="email"
                required
                value={email}
                disabled={isLoggingIn}
                placeholder="exemplo@loja.com.br"
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setTouchedEmail(true)}
                className={`${inputBase} pr-12 ${touchedEmail ? (isEmailValid ? 'border-green-300 ring-green-100' : 'border-red-300 ring-red-100') : 'border-transparent'}`}
                style={{ '--tw-ring-color': touchedEmail ? (isEmailValid ? '#dcfce7' : '#fee2e2') : `${settings.primaryColor}15` } as React.CSSProperties}
              />
              {touchedEmail && email && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {isEmailValid ? <Check size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-400" />}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Senha de Acesso</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                disabled={isLoggingIn}
                placeholder="••••••••"
                onChange={e => setPassword(e.target.value)}
                className={`${inputBase} pr-12 border-transparent`}
                style={{ '--tw-ring-color': `${settings.primaryColor}15` } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-4 text-white font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase text-xs tracking-widest disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ backgroundColor: settings.primaryColor, boxShadow: `0 10px 25px -5px ${settings.primaryColor}50` }}
          >
            {isLoggingIn ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Autenticando...
              </>
            ) : 'Entrar no Catálogo'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/forgot-password" className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest">
            Esqueceu sua senha?
          </Link>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Não tem acesso?{' '}
            <Link to="/register" className="font-black transition-colors hover:underline" style={{ color: settings.primaryColor }}>
              Solicite seu cadastro
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-8 text-center space-y-2 animate-in fade-in duration-1000">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
          Catálogo Online v2.0.2
        </p>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Desenvolvido por <a href="https://www.instagram.com/o__guii/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-gray-900 underline decoration-gray-200">Guilherme Mendonça</a>
        </p>
      </div>
    </div>
  );
};

export const Register: React.FC = () => {
  const { settings } = useContext(AppContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    storeName: '',
    cnpj: '',
    phone: '',
    responsibleName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const maskCNPJ = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const maskPhone = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    }
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target;
    if (name === 'cnpj') value = maskCNPJ(value);
    if (name === 'phone') value = maskPhone(value);
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const validations = useMemo(() => ({
    storeName: formData.storeName.length >= 3,
    cnpj: formData.cnpj.replace(/\D/g, '').length === 14,
    phone: formData.phone.replace(/\D/g, '').length >= 10,
    responsibleName: formData.responsibleName.length >= 3,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email),
    password: formData.password.length >= 6,
    confirmPassword: formData.confirmPassword === formData.password && formData.confirmPassword.length > 0
  }), [formData]);

  const step1Valid = validations.storeName && validations.cnpj && validations.phone;
  const step2Valid = validations.responsibleName && validations.email && validations.password && validations.confirmPassword;

  const passwordStrength = useMemo(() => {
    const p = formData.password;
    if (!p) return { score: 0, label: '', color: '' };
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    if (score <= 2) return { score: 1, label: 'Fraca', color: '#ef4444' };
    if (score <= 3) return { score: 2, label: 'Média', color: '#f59e0b' };
    return { score: 3, label: 'Forte', color: '#22c55e' };
  }, [formData.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step2Valid) return;
    setIsSubmitting(true);
    setError('');

    try {
      await db.register({
        id: crypto.randomUUID(),
        storeName: formData.storeName,
        responsibleName: formData.responsibleName,
        cnpj: formData.cnpj,
        phone: formData.phone,
        email: formData.email,
        password: formData.password,
        role: Role.RETAILER
      });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar cadastro. Verifique sua conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldStyle = (field: keyof typeof validations) => {
    if (!touched[field]) return 'border-transparent';
    return validations[field] ? 'border-green-300 ring-green-100' : 'border-red-300 ring-red-100';
  };

  const inputBase = "w-full pl-12 pr-5 py-4 bg-gray-50 text-gray-900 border-2 rounded-2xl outline-none focus:bg-white focus:ring-4 font-bold transition-all disabled:opacity-50 placeholder:text-gray-300";

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center shadow-2xl" style={{ backgroundColor: '#22c55e', boxShadow: '0 20px 40px -10px rgba(34,197,94,0.4)' }}>
            <Check size={48} className="text-white" strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-3">Cadastro Enviado!</h2>
          <p className="text-gray-500 font-medium leading-relaxed mb-2">
            Sua solicitação foi recebida com sucesso.
          </p>
          <p className="text-gray-400 text-sm font-medium leading-relaxed mb-10">
            Nossa equipe comercial analisará seu cadastro e entrará em contato em breve para liberar o acesso ao catálogo.
          </p>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-8">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-black text-gray-900">Prazo de análise</p>
                <p className="text-[11px] text-gray-400 font-medium">Geralmente em até 24 horas úteis</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="px-10 py-4 text-white font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase text-xs tracking-widest"
            style={{ backgroundColor: settings.primaryColor, boxShadow: `0 15px 35px -10px ${settings.primaryColor}50` }}
          >
            Ir para o Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-2xl w-full bg-white rounded-[1rem] md:rounded-[1.25rem] shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">

        <div className="p-10 pb-0">
          <div className="text-center mb-8">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} className="h-10 mx-auto mb-4" alt="Logo" />
            ) : (
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-black shadow-lg" style={{ backgroundColor: settings.primaryColor }}>
                {settings.companyName.charAt(0)}
              </div>
            )}
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Solicitar Acesso</h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Cadastro de novo parceiro</p>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2 flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 shrink-0"
                style={step >= 1 ? { backgroundColor: settings.primaryColor, color: 'white' } : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}
              >
                {step > 1 ? <Check size={14} /> : '1'}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 hidden sm:inline">Empresa</span>
            </div>
            <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: step >= 2 ? '100%' : '0%', backgroundColor: settings.primaryColor }}
              />
            </div>
            <div className="flex items-center gap-2 flex-1 justify-end">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 hidden sm:inline">Acesso</span>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 shrink-0"
                style={step >= 2 ? { backgroundColor: settings.primaryColor, color: 'white' } : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}
              >
                2
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-10 pt-6">
          {error && (
            <div className="mb-6 p-4 rounded-2xl border bg-red-50 text-red-700 border-red-100 flex items-center gap-3">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <p className="text-xs font-bold leading-snug">{error}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Dados da Empresa</p>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Razão Social / Nome Fantasia *</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input name="storeName" required value={formData.storeName} onChange={handleChange} onBlur={() => handleBlur('storeName')} disabled={isSubmitting} placeholder="Nome da empresa"
                    className={`${inputBase} ${getFieldStyle('storeName')}`}
                    style={{ '--tw-ring-color': validations.storeName && touched.storeName ? '#dcfce7' : touched.storeName ? '#fee2e2' : `${settings.primaryColor}15` } as any}
                  />
                  {touched.storeName && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {validations.storeName ? <Check size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-400" />}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">CNPJ *</label>
                <div className="relative">
                  <FileText size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input name="cnpj" required value={formData.cnpj} onChange={handleChange} onBlur={() => handleBlur('cnpj')} disabled={isSubmitting} placeholder="00.000.000/0001-00"
                    className={`${inputBase} ${getFieldStyle('cnpj')}`}
                    style={{ '--tw-ring-color': validations.cnpj && touched.cnpj ? '#dcfce7' : touched.cnpj ? '#fee2e2' : `${settings.primaryColor}15` } as any}
                  />
                  {touched.cnpj && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {validations.cnpj ? <Check size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-400" />}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Telefone / WhatsApp *</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input name="phone" required value={formData.phone} onChange={handleChange} onBlur={() => handleBlur('phone')} disabled={isSubmitting} placeholder="(00) 00000-0000"
                    className={`${inputBase} ${getFieldStyle('phone')}`}
                    style={{ '--tw-ring-color': validations.phone && touched.phone ? '#dcfce7' : touched.phone ? '#fee2e2' : `${settings.primaryColor}15` } as any}
                  />
                  {touched.phone && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {validations.phone ? <Check size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-400" />}
                    </div>
                  )}
                </div>
              </div>

              <button type="button" onClick={() => setStep(2)} disabled={!step1Valid}
                className="w-full py-4 text-white font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase text-xs tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                style={{ backgroundColor: settings.primaryColor, boxShadow: step1Valid ? `0 15px 35px -10px ${settings.primaryColor}50` : 'none' }}
              >
                Continuar <ArrowRight size={16} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dados de Acesso</p>
                <button type="button" onClick={() => setStep(1)}
                  className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:opacity-70 transition-opacity"
                  style={{ color: settings.primaryColor }}
                >
                  <ArrowLeft size={12} /> Voltar
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome do Responsável *</label>
                <div className="relative">
                  <UserIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input name="responsibleName" required value={formData.responsibleName} onChange={handleChange} onBlur={() => handleBlur('responsibleName')} disabled={isSubmitting} placeholder="Nome completo"
                    className={`${inputBase} ${getFieldStyle('responsibleName')}`}
                    style={{ '--tw-ring-color': validations.responsibleName && touched.responsibleName ? '#dcfce7' : touched.responsibleName ? '#fee2e2' : `${settings.primaryColor}15` } as any}
                  />
                  {touched.responsibleName && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {validations.responsibleName ? <Check size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-400" />}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail Corporativo *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input name="email" type="email" required value={formData.email} onChange={handleChange} onBlur={() => handleBlur('email')} disabled={isSubmitting} placeholder="vendas@empresa.com.br" autoComplete="email"
                    className={`${inputBase} ${getFieldStyle('email')}`}
                    style={{ '--tw-ring-color': validations.email && touched.email ? '#dcfce7' : touched.email ? '#fee2e2' : `${settings.primaryColor}15` } as any}
                  />
                  {touched.email && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {validations.email ? <Check size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-400" />}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Crie uma Senha *</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input name="password" type={showPassword ? 'text' : 'password'} required value={formData.password} onChange={handleChange} onBlur={() => handleBlur('password')} disabled={isSubmitting} placeholder="Mínimo 6 caracteres" autoComplete="new-password"
                    className={`${inputBase} pr-12 ${getFieldStyle('password')}`}
                    style={{ '--tw-ring-color': validations.password && touched.password ? '#dcfce7' : touched.password ? '#fee2e2' : `${settings.primaryColor}15` } as any}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {formData.password && (
                  <div className="flex items-center gap-2 mt-1 ml-1">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-1.5 rounded-full flex-1 transition-all duration-300"
                          style={{ backgroundColor: i <= passwordStrength.score ? passwordStrength.color : '#e5e7eb' }}
                        />
                      ))}
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: passwordStrength.color }}>
                      {passwordStrength.label}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Confirmar Senha *</label>
                <div className="relative">
                  <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input name="confirmPassword" type={showConfirm ? 'text' : 'password'} required value={formData.confirmPassword} onChange={handleChange} onBlur={() => handleBlur('confirmPassword')} disabled={isSubmitting} placeholder="Repita a senha" autoComplete="new-password"
                    className={`${inputBase} pr-12 ${getFieldStyle('confirmPassword')}`}
                    style={{ '--tw-ring-color': validations.confirmPassword && touched.confirmPassword ? '#dcfce7' : touched.confirmPassword ? '#fee2e2' : `${settings.primaryColor}15` } as any}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {touched.confirmPassword && formData.confirmPassword && !validations.confirmPassword && (
                  <p className="text-[10px] font-bold text-red-400 ml-1">As senhas não coincidem</p>
                )}
              </div>

              <button type="submit" disabled={isSubmitting || !step2Valid}
                className="w-full py-5 text-white font-black rounded-2xl shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] uppercase text-xs tracking-widest mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: settings.primaryColor, boxShadow: step2Valid ? `0 15px 35px -10px ${settings.primaryColor}50` : 'none' }}
              >
                {isSubmitting ? 'Enviando Dados...' : 'Enviar Solicitação de Cadastro'}
              </button>
            </div>
          )}
        </form>

        <div className="px-10 pb-10 pt-0">
          <div className="text-center border-t border-gray-50 pt-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Já possui uma conta ativa?{' '}
              <Link to="/login" className="font-black transition-colors" style={{ color: settings.primaryColor }}>
                Fazer Login agora
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ESQUECI MINHA SENHA
// ============================================================
export const ForgotPassword: React.FC = () => {
  const { settings } = useContext(AppContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const inputBase = "w-full pl-12 pr-5 py-4 bg-gray-50 text-gray-900 border-2 rounded-2xl outline-none focus:bg-white focus:ring-4 font-bold transition-all placeholder:text-gray-300 disabled:opacity-50 border-transparent";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await db.requestPasswordReset(email);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Erro ao processar solicitação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl" style={{ backgroundColor: settings.primaryColor }}>
            <Mail size={36} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3">Solicitação Enviada</h2>
          <p className="text-gray-500 text-sm font-medium leading-relaxed mb-8">
            Se o e-mail informado estiver cadastrado, entre em contato com nosso suporte informando seu e-mail para receber o código de recuperação.
          </p>
          {settings.supportPhone && (
            <a href={`https://wa.me/${settings.supportPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-green-700 transition-colors mb-4"
            >
              Contatar Suporte via WhatsApp
            </a>
          )}
          <div className="mt-4">
            <Link to="/login" className="text-xs font-bold uppercase tracking-widest hover:underline" style={{ color: settings.primaryColor }}>
              Voltar ao Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-[1rem] md:rounded-[1.25rem] shadow-2xl p-10 border border-gray-100 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white text-3xl font-black shadow-lg" style={{ backgroundColor: settings.primaryColor }}>
            <KeyRound size={28} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Recuperar Senha</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Informe seu e-mail cadastrado</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border bg-red-50 text-red-700 border-red-100 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <p className="text-xs font-bold leading-snug">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={isSubmitting} placeholder="seu@email.com.br"
              className={inputBase}
              style={{ '--tw-ring-color': `${settings.primaryColor}15` } as React.CSSProperties}
            />
          </div>

          <button type="submit" disabled={isSubmitting || !email}
            className="w-full py-4 text-white font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase text-xs tracking-widest disabled:opacity-70"
            style={{ backgroundColor: settings.primaryColor }}
          >
            {isSubmitting ? 'Enviando...' : 'Solicitar Recuperação'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">
            <ArrowLeft size={12} className="inline mr-1" /> Voltar ao Login
          </Link>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// RESET DE SENHA (com token)
// ============================================================
export const ResetPassword: React.FC = () => {
  const { settings } = useContext(AppContext);
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const inputBase = "w-full pl-12 pr-5 py-4 bg-gray-50 text-gray-900 border-2 rounded-2xl outline-none focus:bg-white focus:ring-4 font-bold transition-all placeholder:text-gray-300 disabled:opacity-50 border-transparent";
  const isValid = token.length > 0 && newPassword.length >= 6 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsSubmitting(true);
    setError('');

    try {
      await db.resetPassword(token, newPassword);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Erro ao redefinir senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl bg-green-500">
            <Check size={36} className="text-white" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3">Senha Alterada!</h2>
          <p className="text-gray-500 text-sm font-medium mb-8">Sua nova senha foi definida com sucesso.</p>
          <button onClick={() => navigate('/login')}
            className="px-10 py-4 text-white font-black rounded-2xl shadow-xl uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
            style={{ backgroundColor: settings.primaryColor }}
          >
            Ir para o Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-[1rem] md:rounded-[1.25rem] shadow-2xl p-10 border border-gray-100 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white text-3xl font-black shadow-lg" style={{ backgroundColor: settings.primaryColor }}>
            <Lock size={28} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Redefinir Senha</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Cole o token recebido e defina a nova senha</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border bg-red-50 text-red-700 border-red-100 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <p className="text-xs font-bold leading-snug">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Token de Recuperação</label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input value={token} onChange={e => setToken(e.target.value.trim())} disabled={isSubmitting} placeholder="Cole o token aqui"
                className={inputBase}
                style={{ '--tw-ring-color': `${settings.primaryColor}15` } as React.CSSProperties}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nova Senha</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={isSubmitting} placeholder="Mínimo 6 caracteres" autoComplete="new-password"
                className={`${inputBase} pr-12`}
                style={{ '--tw-ring-color': `${settings.primaryColor}15` } as React.CSSProperties}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
            <div className="relative">
              <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isSubmitting} placeholder="Repita a senha" autoComplete="new-password"
                className={inputBase}
                style={{ '--tw-ring-color': `${settings.primaryColor}15` } as React.CSSProperties}
              />
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-[10px] font-bold text-red-400 ml-1">As senhas não coincidem</p>
            )}
          </div>

          <button type="submit" disabled={isSubmitting || !isValid}
            className="w-full py-4 text-white font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase text-xs tracking-widest disabled:opacity-70"
            style={{ backgroundColor: settings.primaryColor }}
          >
            {isSubmitting ? 'Alterando...' : 'Redefinir Senha'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">
            <ArrowLeft size={12} className="inline mr-1" /> Voltar ao Login
          </Link>
        </div>
      </div>
    </div>
  );
};
