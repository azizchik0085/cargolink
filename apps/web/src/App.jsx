import React, { useState, useEffect } from 'react';
import { 
  Truck, Package, Search, PlusCircle, CreditCard, ShieldCheck, 
  MapPin, Calendar, ArrowRight, User, Phone, CheckCircle2, 
  DollarSign, Activity, Sparkles, LogOut, Lock, MessageSquare, AlertCircle,
  Filter, Globe, SlidersHorizontal, ChevronRight, X, Info, Check, Eye,
  BarChart3, Navigation, Star, FileText, CheckCircle, Clock, Pause, Play
} from 'lucide-react';
import { useLanguage } from './LanguageContext';

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:8000/api/v1' 
  : 'https://uzcargo.onrender.com/api/v1';

export default function App() {
  const { lang, switchLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('loads'); // 'loads', 'vehicles', 'matching', 'dashboard', 'pricing', 'publish_truck', 'publish_load'
  const [loads, setLoads] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [plans, setPlans] = useState([]);
  const [mySubscription, setMySubscription] = useState(null);
  const [matchedLoads, setMatchedLoads] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('cargolink_token') || '');
  const [user, setUser] = useState(null);

  // Dashboards Data State
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Admin Dashboard State
  const [adminMetrics, setAdminMetrics] = useState(null);
  const [adminLogistics, setAdminLogistics] = useState([]);
  const [adminDrivers, setAdminDrivers] = useState([]);
  const [adminApplications, setAdminApplications] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminFilter, setAdminFilter] = useState('ALL'); // 'ALL', 'PAID', 'UNPAID', 'ACTIVE', 'INACTIVE'

  // Logistic Subscription Application State
  const [myApplication, setMyApplication] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    company_name: '',
    contact_phone: '',
    extra_phone: '',
    plan_code: 'STANDARD',
    payment_method: 'BANK_TRANSFER',
    comment: ''
  });
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);

  // Search & Filters
  const [searchOrigin, setSearchOrigin] = useState('');
  const [searchDest, setSearchDest] = useState('');
  const [selectedVehicleType, setSelectedVehicleType] = useState('');
  const [minWeight, setMinWeight] = useState('');
  const [maxWeight, setMaxWeight] = useState('');
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Modals
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerComment, setOfferComment] = useState('');

  // Payment Checkout Modal State
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState('CLICK'); // 'CLICK', 'PAYME', 'BANK_TRANSFER'
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Auth Form State
  const [authForm, setAuthForm] = useState({
    phone: '',
    password: '',
    full_name: '',
    role: 'DRIVER', // 'DRIVER', 'LOGISTIC', 'VEHICLE_OWNER', 'TRANSPORT_COMPANY'
    company_name: '',
    city: 'Tashkent',
    plate_number: '',
    tech_passport_number: '',
    vehicle_type: 'Curtain-sided truck (Tent)',
    vehicle_make: 'Volvo',
    vehicle_model: 'FH 500',
    max_weight_tons: 22,
    max_volume_m3: 92
  });

  // Post Load Form State
  const [postLoadForm, setPostLoadForm] = useState({
    origin_country: 'Uzbekistan',
    origin_city: 'Tashkent',
    destination_country: 'Kazakhstan',
    destination_city: 'Almaty',
    cargo_title: '',
    cargo_category: 'General Cargo',
    weight_kg: 20000,
    volume_m3: 86,
    required_vehicle_type: 'Curtain-sided truck (Tent)',
    price: 1800,
    currency: 'USD',
    is_negotiable: true,
    contact_name: user?.full_name || '',
    contact_phone: user?.phone || '',
    description: ''
  });

  // Post Truck Form State
  const [postTruckForm, setPostTruckForm] = useState({
    vehicle_type: 'Curtain-sided truck (Tent)',
    make: 'Volvo',
    model: 'FH 500',
    plate_number: '',
    max_weight_tons: 22,
    max_volume_m3: 92,
    current_country: 'Uzbekistan',
    current_city: 'Tashkent',
    preferred_destinations: 'Kazakhstan, Russia, Turkey'
  });

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchLoads();
    fetchVehicles();
    fetchPlans();
    if (token) {
      fetchUserProfile();
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        fetchMyApplication();
        if (data.role === 'SUPER_ADMIN' || data.role === 'ADMIN') {
          fetchAdminData();
        } else {
          fetchRoleDashboard(data.role);
        }
      } else {
        logout();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminData = async () => {
    setAdminLoading(true);
    try {
      const [mRes, lRes, dRes, aRes] = await Promise.all([
        fetch(`${API_BASE}/admin/metrics`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/logistics-clients`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/drivers-list`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/applications`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (mRes.ok) setAdminMetrics(await mRes.json());
      if (lRes.ok) setAdminLogistics(await lRes.json());
      if (dRes.ok) setAdminDrivers(await dRes.json());
      if (aRes.ok) setAdminApplications(await aRes.json());
    } catch (e) {
      console.error("Admin data fetch error:", e);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleReviewApplication = async (appId, action) => {
    try {
      const res = await fetch(`${API_BASE}/admin/applications/${appId}/review?action=${action}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Ariza ko'rib chiqildi");
        fetchAdminData();
      } else {
        showToast(data.detail || 'Xatolik', 'error');
      }
    } catch (e) {
      showToast('Tarmoq xatosi', 'error');
    }
  };

  const fetchMyApplication = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/subscriptions/my-application`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyApplication(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitApplication = async (e) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmittingApp(true);
    try {
      const res = await fetch(`${API_BASE}/subscriptions/application`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(applyForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        setShowApplyModal(false);
        fetchMyApplication();
        if (user) fetchRoleDashboard(user.role);
      } else {
        showToast(data.detail || 'Xatolik yuz berdi', 'error');
      }
    } catch (err) {
      showToast('Tarmoq xatosi', 'error');
    } finally {
      setIsSubmittingApp(false);
    }
  };

  const handleToggleUserStatus = async (userId, action) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/status?action=${action}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Status yangilandi');
        fetchAdminData();
      } else {
        showToast(data.detail || 'Xatolik', 'error');
      }
    } catch (e) {
      showToast('Tarmoq xatosi', 'error');
    }
  };

  const fetchRoleDashboard = async (role) => {
    setDashboardLoading(true);
    try {
      let endpoint = '/dashboard/driver';
      if (role === 'LOGISTIC' || role === 'LOGISTICS_COMPANY_OWNER') {
        endpoint = '/dashboard/logistic';
      } else if (role === 'TRANSPORT_COMPANY' || role === 'VEHICLE_OWNER') {
        endpoint = '/dashboard/fleet';
      }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDashboardLoading(false);
    }
  };

  const fetchLoads = async () => {
    try {
      let url = `${API_BASE}/loads/?limit=100`;
      if (searchOrigin) url += `&origin_city=${encodeURIComponent(searchOrigin)}`;
      if (searchDest) url += `&destination_city=${encodeURIComponent(searchDest)}`;
      if (selectedVehicleType) url += `&vehicle_type=${encodeURIComponent(selectedVehicleType)}`;
      if (minWeight) url += `&min_weight=${encodeURIComponent(parseFloat(minWeight) * 1000)}`;
      if (maxWeight) url += `&max_weight=${encodeURIComponent(parseFloat(maxWeight) * 1000)}`;

      const res = await fetch(url);
      const data = await res.json();
      setLoads(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await fetch(`${API_BASE}/vehicles/`);
      const data = await res.json();
      setVehicles(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_BASE}/subscriptions/plans`);
      const data = await res.json();
      setPlans(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMySubscription = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/subscriptions/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMySubscription(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubscribe = async (plan) => {
    if (!user) {
      showToast("Obuna bo'lish uchun tizimga kiring", 'error');
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }
    if (user.role === 'DRIVER') {
      showToast("Haydovchilar uchun barcha xizmatlar 100% bepul!", 'success');
      return;
    }
    setSelectedPlanForPayment(plan);
    setShowPaymentModal(true);
  };

  const executePayment = async () => {
    if (!selectedPlanForPayment) return;
    setIsProcessingPayment(true);
    try {
      const res = await fetch(`${API_BASE}/subscriptions/subscribe`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plan_code: selectedPlanForPayment.code,
          payment_method: paymentProvider
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Tabriklaymiz! ${selectedPlanForPayment.name} tarifi 30 kunga faollashtirildi!`);
        setShowPaymentModal(false);
        fetchMySubscription();
        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
          fetchAdminData();
        } else {
          fetchRoleDashboard(user.role);
        }
      } else {
        showToast(data.detail || "To'lovda xatolik yuz berdi", 'error');
      }
    } catch (err) {
      showToast('Tarmoq xatosi', 'error');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const normalizePhone = (phone) => {
    if (!phone) return '';
    let cleaned = phone.toString().replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('998')) {
        cleaned = '+' + cleaned;
      } else if (cleaned.length === 9) {
        cleaned = '+998' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }
    return cleaned;
  };

  const loginAs = async (phone, password) => {
    try {
      const cleanPhone = normalizePhone(phone);
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.access_token);
        localStorage.setItem('cargolink_token', data.access_token);
        setUser(data.user);
        showToast(`Xush kelibsiz, ${data.user.full_name}!`);
        setShowAuthModal(false);
        if (data.user.role === 'SUPER_ADMIN' || data.user.role === 'ADMIN') {
          setActiveTab('admin');
          fetchAdminData();
        } else {
          fetchRoleDashboard(data.user.role);
        }
      } else {
        showToast(data.detail || 'Kirishda xatolik', 'error');
      }
    } catch (err) {
      showToast('Tarmoq xatosi', 'error');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const cleanPhone = normalizePhone(authForm.phone);
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authForm, phone: cleanPhone })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.access_token);
        localStorage.setItem('cargolink_token', data.access_token);
        setUser(data.user);
        showToast('Muvaffaqiyatli ro\'yxatdan o\'tdingiz!');
        setShowAuthModal(false);
        fetchRoleDashboard(data.user.role);
      } else {
        showToast(data.detail || 'Ro\'yxatdan o\'tishda xatolik', 'error');
      }
    } catch (err) {
      showToast('Tarmoq xatosi', 'error');
    }
  };

  const logout = () => {
    setToken('');
    setUser(null);
    setDashboardData(null);
    localStorage.removeItem('cargolink_token');
    showToast('Tizimdan chiqildi');
  };

  const runSmartMatching = async (vehicleId) => {
    try {
      const res = await fetch(`${API_BASE}/search/match-for-vehicle/${vehicleId}`);
      const data = await res.json();
      setMatchedLoads(data);
      setActiveTab('matching');
      showToast(`${data.length} ta mos yuk topildi!`);
    } catch (err) {
      showToast('Yuklarni tahlil qilishda xatolik', 'error');
    }
  };

  const handleOfferSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      showToast('Iltimos, avval haydovchi sifatida kiring', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/offers/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          load_id: selectedLoad.id,
          proposed_price: parseFloat(offerPrice),
          currency: selectedLoad.currency || 'USD',
          pickup_date: new Date().toISOString(),
          comment: offerComment
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Narx taklifi yuborildi! 0% komissiya.');
        setShowOfferModal(false);
        setOfferPrice('');
        setOfferComment('');
        if (user) fetchRoleDashboard(user.role);
      } else {
        showToast(data.detail || 'Xatolik', 'error');
      }
    } catch (err) {
      showToast('Xatolik', 'error');
    }
  };

  const handleCreateLoad = async (e) => {
    e.preventDefault();
    if (!token) {
      showToast('Yuk joylashtirish uchun avval tizimga kiring', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/loads/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...postLoadForm,
          contact_name: postLoadForm.contact_name || user?.full_name || 'Dispetcher',
          contact_phone: postLoadForm.contact_phone || user?.phone || '+998901234567',
          loading_date: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Yuk muvaffaqiyatli chop etildi!');
        setActiveTab('loads');
        fetchLoads();
        if (user) fetchRoleDashboard(user.role);
      } else {
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : (Array.isArray(data.detail) ? data.detail.map(d => d.msg || d).join(', ') : 'Yuk chop etishda xatolik yuz berdi');
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      showToast('Server bilan bog\'lanishda xatolik', 'error');
    }
  };

  const handleCreateTruck = async (e) => {
    e.preventDefault();
    if (!token) {
      showToast('Avval tizimga kiring (Haydovchilarga 100% Bepul)', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/vehicles/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postTruckForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Transport muvaffaqiyatli e\'lon qilindi (100% BEPUL)!');
        setActiveTab('vehicles');
        fetchVehicles();
        if (user) fetchRoleDashboard(user.role);
      } else {
        showToast(data.detail || 'Xatolik', 'error');
      }
    } catch (err) {
      showToast('Xatolik', 'error');
    }
  };

  const handleTogglePause = async (loadId) => {
    try {
      const res = await fetch(`${API_BASE}/dashboard/loads/${loadId}/pause`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        if (user) fetchRoleDashboard(user.role);
      }
    } catch (e) {
      showToast('Xatolik', 'error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 text-white text-sm font-semibold transition-all transform animate-bounce ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
          <Sparkles className="w-5 h-5 flex-shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Main Global Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('loads')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center font-extrabold text-xl shadow-lg shadow-blue-500/25">
              CL
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-extrabold tracking-tight">CARGO<span className="text-blue-500">LINK</span></span>
                <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 font-bold rounded-full border border-emerald-500/30">
                  {t('zero_commission')}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:block">Xalqaro Freight & Transport Birjasi</span>
            </div>
          </div>

          {/* Language & Profile */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700 text-xs font-bold">
              <button onClick={() => switchLanguage('uz')} className={`px-2 py-1 rounded transition ${lang === 'uz' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>UZ</button>
              <button onClick={() => switchLanguage('ru')} className={`px-2 py-1 rounded transition ${lang === 'ru' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>RU</button>
              <button onClick={() => switchLanguage('en')} className={`px-2 py-1 rounded transition ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>EN</button>
            </div>

            {/* Admin Boshqaruv Paneli (Platforma Egasi) */}
            {user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
              <button 
                onClick={() => {
                  fetchAdminData();
                  setActiveTab('admin');
                }}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center space-x-1.5 ${activeTab === 'admin' ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-800 hover:bg-slate-700 text-rose-300'}`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                <span>Admin Panel</span>
              </button>
            )}

            {user ? (
              <div className="flex items-center space-x-3">
                {user.role !== 'SUPER_ADMIN' && (
                  <button 
                    onClick={() => {
                      fetchRoleDashboard(user.role);
                      setActiveTab('dashboard');
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center space-x-1.5 ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Kabinet</span>
                  </button>
                )}
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-white">{user.full_name}</div>
                  <div className="text-[11px] text-emerald-400 flex items-center justify-end space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{user.role}</span>
                  </div>
                </div>
                <button 
                  onClick={logout}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title={t('logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => {
                    setAuthMode('login');
                    setShowAuthModal(true);
                  }} 
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 font-bold text-xs rounded-xl text-slate-300 transition"
                >
                  {t('nav_login')}
                </button>
                <button 
                  onClick={() => {
                    setAuthMode('register');
                    setShowAuthModal(true);
                  }} 
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 transition"
                >
                  {t('nav_register')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs - Role-Separated */}
        <div className="max-w-7xl mx-auto px-4 flex items-center space-x-2 border-t border-slate-800/80 text-sm overflow-x-auto scrollbar-none py-2.5">
          {/* Universal: Yuklar Birjasi */}
          <button 
            onClick={() => setActiveTab('loads')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-2 transition ${activeTab === 'loads' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Package className="w-4 h-4" />
            <span>{t('nav_loads')} ({loads.length})</span>
          </button>
          
          {/* Universal: Transportlar Birjasi */}
          <button 
            onClick={() => setActiveTab('vehicles')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-2 transition ${activeTab === 'vehicles' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Truck className="w-4 h-4" />
            <span>{t('nav_vehicles')} ({vehicles.length})</span>
          </button>

          {/* Admin Boshqaruv Paneli (Platforma Egasi) */}
          {user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
            <button 
              onClick={() => {
                fetchAdminData();
                setActiveTab('admin');
              }}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-2 transition ${activeTab === 'admin' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' : 'text-rose-400 hover:text-white'}`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>👑 Admin Boshqaruv</span>
            </button>
          )}

          {/* Shaxsiy Kabinet - Kirgan foydalanuvchiga */}
          {user && user.role !== 'SUPER_ADMIN' && (
            <button 
              onClick={() => {
                fetchRoleDashboard(user.role);
                setActiveTab('dashboard');
              }}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-2 transition ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-400 hover:text-white'}`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Shaxsiy Kabinet</span>
            </button>
          )}

          {/* FAQAT TIZIMGA KIRGAN HAYDOVCHI / TRANSPORT EGASI UCHUN KO'RINADIGAN MENYULAR */}
          {user && (user.role === 'DRIVER' || user.role === 'VEHICLE_OWNER') && (
            <button 
              onClick={() => runSmartMatching(vehicles[0]?.id)}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-2 transition ${activeTab === 'matching' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-400 hover:text-white'}`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{t('nav_matching')}</span>
            </button>
          )}

          {/* FAQAT TIZIMGA KIRGAN LOGISTIKA KOMPANIYASI / SHIPPERS UCHUN KO'RINADIGAN MENYULAR */}
          {user && (user.role === 'LOGISTIC' || user.role === 'LOGISTICS_COMPANY_OWNER' || user.role === 'SUPER_ADMIN') && (
            <>
              <button 
                onClick={() => setActiveTab('publish_load')}
                className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-2 transition ${activeTab === 'publish_load' ? 'bg-blue-700 text-white shadow-md' : 'text-blue-400 hover:text-white'}`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('nav_publish_load')}</span>
              </button>

              <button 
                onClick={() => setActiveTab('subscriptions')}
                className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-2 transition ${activeTab === 'subscriptions' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <CreditCard className="w-4 h-4" />
                <span>{t('nav_pricing')}</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        
        {/* TAB: PERSONAL ROLE-BASED DASHBOARD */}
        {activeTab === 'dashboard' && dashboardData && (
          <div className="space-y-8 animate-fadeIn">
            {/* Dashboard Header Bar */}
            <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl border border-slate-800">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <span className="px-3.5 py-1 bg-emerald-500/20 text-emerald-400 font-extrabold text-xs rounded-full border border-emerald-500/30">
                    {dashboardData.profile?.role} KABINETI
                  </span>
                  <span className="text-xs text-slate-400">
                    A'zolik: {new Date(dashboardData.profile?.registration_date || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black">{dashboardData.profile?.full_name}</h1>
                <p className="text-xs text-slate-400 mt-1 flex items-center space-x-2">
                  <span>{dashboardData.profile?.company_name || dashboardData.profile?.current_city}</span>
                  <span>•</span>
                  <span>{dashboardData.profile?.phone}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold">✓ {dashboardData.profile?.verification_status}</span>
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                {user?.role === 'DRIVER' && (
                  <button 
                    onClick={() => setActiveTab('publish_truck')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition shadow-md flex items-center space-x-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Yangi Mashina Qo'shish</span>
                  </button>
                )}
                {(user?.role === 'LOGISTIC' || user?.role === 'LOGISTICS_COMPANY_OWNER') && (
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => {
                        setApplyForm({
                          company_name: dashboardData.profile?.company_name || user?.full_name || '',
                          contact_phone: dashboardData.profile?.phone || user?.phone || '',
                          extra_phone: '',
                          plan_code: 'STANDARD',
                          payment_method: 'BANK_TRANSFER',
                          comment: ''
                        });
                        setShowApplyModal(true);
                      }}
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl text-xs transition shadow-md flex items-center space-x-1.5 animate-pulse"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Obunaga Ariza Jo'natish</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('publish_load')}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition shadow-md flex items-center space-x-1.5"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Yangi Yuk E'lon Qilish</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Ariza Holati Kartasi (Agar ariza yuborilgan bo'lsa) */}
            {myApplication && myApplication.has_application && (
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                    myApplication.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                    myApplication.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Arizangiz Holati:</span>
                      {myApplication.status === 'PENDING' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 animate-pulse">
                          ⏳ Kutilmoqda (Admin ko'rib chiqmoqda)
                        </span>
                      )}
                      {myApplication.status === 'APPROVED' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                          ✓ Tasdiqlangan va Faollashtirilgan
                        </span>
                      )}
                      {myApplication.status === 'REJECTED' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800">
                          ✕ Rad etilgan
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 space-x-3">
                      <span>Kompaniya: <strong>{myApplication.company_name}</strong></span>
                      <span>•</span>
                      <span>Tanlangan tarif: <strong className="text-blue-600">{myApplication.plan_code}</strong></span>
                      <span>•</span>
                      <span>Sana: {new Date(myApplication.created_at).toLocaleDateString()}</span>
                    </div>
                    {myApplication.status === 'PENDING' && (
                      <p className="text-[11px] text-amber-700 mt-1">
                        Sizning arizangiz adminga yetib borgan. To'lov tasdiqlangach barcha imkoniyatlar avtomatik ochiladi.
                      </p>
                    )}
                  </div>
                </div>

                {myApplication.status !== 'APPROVED' && (
                  <button
                    onClick={() => {
                      setApplyForm({
                        company_name: myApplication.company_name || dashboardData?.profile?.company_name || '',
                        contact_phone: myApplication.contact_phone || dashboardData?.profile?.phone || '',
                        extra_phone: '',
                        plan_code: myApplication.plan_code || 'STANDARD',
                        payment_method: 'BANK_TRANSFER',
                        comment: ''
                      });
                      setShowApplyModal(true);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                  >
                    Qayta Ariza Yuborish
                  </button>
                )}
              </div>
            )}

            {/* Alert: Obuna to'lanmagan yoki kutilayotgan logist uchun ogohlantirish */}
            {(user?.role === 'LOGISTIC' || user?.role === 'LOGISTICS_COMPANY_OWNER') && (!myApplication || !myApplication.has_application) && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-amber-900">
                      Yuk joylashtirish va Haydovchilar bilan bog'lanish uchun Obuna lozim!
                    </h4>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Ariza yuboring va to'lov admin tomonidan tasdiqlanishi bilan profilingiz to'liq aktivlashtiriladi.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setApplyForm({
                      company_name: dashboardData.profile?.company_name || user?.full_name || '',
                      contact_phone: dashboardData.profile?.phone || user?.phone || '',
                      extra_phone: '',
                      plan_code: 'STANDARD',
                      payment_method: 'BANK_TRANSFER',
                      comment: ''
                    });
                    setShowApplyModal(true);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs transition shadow-sm self-start sm:self-auto"
                >
                  Ariza Yuborish
                </button>
              </div>
            )}

            {/* KPI Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(dashboardData.statistics || {}).map(([key, val], idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 block">
                    {typeof val === 'number' ? val.toLocaleString() : val}
                  </span>
                </div>
              ))}
            </div>

            {/* LOGISTIC DASHBOARD: My Loads Management Table */}
            {dashboardData.my_loads && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Mening Yuklarim ({dashboardData.my_loads.length})</h2>
                    <p className="text-xs text-slate-500">Faol, muzokaradagi va biriktirilgan yuklar boshqaruvi</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase">
                        <th className="py-3 px-3">Yuk Nomi</th>
                        <th className="py-3 px-3">Marshrut</th>
                        <th className="py-3 px-3">Vazn / Hajm</th>
                        <th className="py-3 px-3">Narx</th>
                        <th className="py-3 px-3">Holat</th>
                        <th className="py-3 px-3">Takliflar</th>
                        <th className="py-3 px-3">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {dashboardData.my_loads.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-3 font-bold text-slate-900">{l.cargo_title}</td>
                          <td className="py-3 px-3 text-slate-600">{l.origin} ➔ {l.destination}</td>
                          <td className="py-3 px-3">{(l.weight_kg / 1000).toFixed(1)} t / {l.volume_m3} m³</td>
                          <td className="py-3 px-3 font-bold text-slate-900">${l.price}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${l.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : l.status === 'NEGOTIATION' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-blue-600">{l.offers_count} ta</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-1.5">
                              <button 
                                onClick={() => handleTogglePause(l.id)}
                                className={`p-1.5 rounded-lg text-xs font-bold transition ${l.is_paused ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                title={l.is_paused ? 'Faollashtirish' : 'To\'xtatib turish'}
                              >
                                {l.is_paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DRIVER DASHBOARD: My Registered Trucks & Orders */}
            {dashboardData.vehicles && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
                  <h3 className="text-base font-black text-slate-900 mb-3">Mening Transportlarim ({dashboardData.vehicles.length})</h3>
                  <div className="space-y-3">
                    {dashboardData.vehicles.map((v) => (
                      <div key={v.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded">{v.plate_number}</span>
                          <h4 className="font-extrabold text-sm text-slate-900 mt-1">{v.make} {v.model}</h4>
                          <span className="text-xs text-slate-500">{v.vehicle_type} • {v.max_weight_tons}t</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                          ✓ {v.is_available ? 'Yukka tayyor' : 'Band'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
                  <h3 className="text-base font-black text-slate-900 mb-3">Yuborilgan Takliflar ({dashboardData.my_orders?.length || 0})</h3>
                  <div className="space-y-3">
                    {(dashboardData.my_orders || []).map((o) => (
                      <div key={o.offer_id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">{o.cargo_title}</h4>
                          <span className="text-xs text-slate-500">{o.route}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-sm text-slate-900">${o.proposed_price}</span>
                          <span className="block text-[10px] uppercase font-bold text-emerald-600 mt-0.5">{o.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: LOADS MARKETPLACE */}
        {activeTab === 'loads' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">{t('cargo_list_title')}</h2>
                <p className="text-xs text-slate-500 mt-1">{t('cargo_list_sub')}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500">Jami: <strong>{loads.length}</strong> ta yuk</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loads.map((load) => (
                <div key={load.id} className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-200 p-6 flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 font-extrabold text-xs rounded-xl border border-blue-100">
                        {load.company_name || 'Silk Road Global Logistics'}
                      </span>
                      <span className="text-xs text-slate-400 font-medium flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(load.loading_date).toLocaleDateString()}</span>
                      </span>
                    </div>

                    <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Ortish joyi</span>
                          <div className="text-base font-black text-slate-900 mt-0.5">{load.origin_city}</div>
                          <div className="text-xs text-slate-500">{load.origin_country}</div>
                        </div>
                        <div className="px-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex-1 text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Yetkazish joyi</span>
                          <div className="text-base font-black text-slate-900 mt-0.5">{load.destination_city}</div>
                          <div className="text-xs text-slate-500">{load.destination_country}</div>
                        </div>
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base mt-4 group-hover:text-blue-600 transition">
                      {load.cargo_title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {load.description || "Xalqaro standartdagi yuk. Barcha rasmiy hujjatlar tayyorlangan."}
                    </p>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">{t('weight')}</span>
                        <span className="font-extrabold text-slate-800 mt-0.5 block">{(load.weight_kg / 1000).toFixed(1)} t</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">{t('volume')}</span>
                        <span className="font-extrabold text-slate-800 mt-0.5 block">{load.volume_m3} m³</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">{t('body_type')}</span>
                        <span className="font-extrabold text-slate-800 mt-0.5 block truncate">{load.required_vehicle_type.split(' ')[0]}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('price_offer')}</span>
                      <span className="text-2xl font-black text-slate-900">
                        ${load.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => {
                          setSelectedLoad(load);
                          setShowDetailModal(true);
                        }}
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedLoad(load);
                          setOfferPrice(load.price.toString());
                          setShowOfferModal(true);
                        }}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20"
                      >
                        {t('btn_submit_offer')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: VEHICLES MARKETPLACE */}
        {activeTab === 'vehicles' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">{t('truck_list_title')}</h2>
                <p className="text-xs text-slate-500 mt-1">{t('truck_list_sub')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vehicles.map((v) => (
                <div key={v.id} className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-200 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-xs rounded-xl border border-emerald-100">
                        {v.vehicle_type}
                      </span>
                      <span className="font-mono text-xs font-black bg-slate-900 text-white px-2.5 py-1 rounded-lg">
                        {v.plate_number}
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-slate-900 mt-2">{v.make} {v.model}</h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
                      <span>Haydovchi:</span>
                      <strong className="text-slate-800">{v.owner_name}</strong>
                      <span className="text-emerald-500 font-bold ml-1">✓ Tasdiqlangan</span>
                    </p>

                    <div className="bg-slate-50 rounded-2xl p-4 mt-4 text-xs space-y-2 border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Hozirgi joylashuvi:</span>
                        <span className="font-bold text-slate-800 flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-blue-500" />
                          <span>{v.current_city}, {v.current_country}</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Yuk sig'imi:</span>
                        <span className="font-extrabold text-slate-900">{v.max_weight_tons} t / {v.max_volume_m3} m³</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-emerald-600 font-bold flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t('status_ready')}</span>
                    </span>
                    <button 
                      onClick={() => runSmartMatching(v.id)}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition flex items-center space-x-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Mos yuklar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SMART MATCHING */}
        {activeTab === 'matching' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 flex items-center space-x-2">
                  <Sparkles className="w-6 h-6 text-emerald-600" />
                  <span>Avtomobilingizga 100% Mos Yuklar</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Yo'nalish, hajm, vazn va ruxsatnomalar asosida hisoblangan aniq moslik darajasi.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {matchedLoads.map((m) => (
                <div key={m.load_id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:border-emerald-400 hover:shadow-lg transition flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 font-black text-xs rounded-xl">
                        {m.relevance_score}% Moslik
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-lg">{m.cargo_title}</h3>
                    </div>

                    <div className="text-sm text-slate-700 font-semibold mt-1">
                      Marshrut: <span className="text-blue-600">{m.origin}</span> ➔ <span className="text-emerald-600">{m.destination}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {m.reasons.map((r, idx) => (
                        <span key={idx} className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-medium">
                          ✓ {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-right flex flex-col md:items-end w-full md:w-auto">
                    <span className="text-xs text-slate-400 font-bold">Narxi:</span>
                    <div className="text-3xl font-black text-slate-900">{m.price}</div>
                    <button 
                      onClick={() => {
                        const load = loads.find(l => l.id === m.load_id);
                        if (load) {
                          setSelectedLoad(load);
                          setOfferPrice(load.price.toString());
                          setShowOfferModal(true);
                        }
                      }}
                      className="mt-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition shadow-lg shadow-emerald-500/25"
                    >
                      Darhol Taklif Yuborish
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PUBLISH TRUCK (FREE FOR AUTHENTICATED DRIVERS ONLY) */}
        {activeTab === 'publish_truck' && user && (user.role === 'DRIVER' || user.role === 'VEHICLE_OWNER') && (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="mb-6">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full">
                Haydovchilar Uchun 100% Bepul
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">Bo'sh Avtomobilni E'lon Qilish</h2>
              <p className="text-xs text-slate-500 mt-1">
                E'loningiz barcha logistika kompaniyalariga ko'rinadi. Hech qanday komissiya olinmaydi.
              </p>
            </div>

            <form onSubmit={handleCreateTruck} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Kuzov turi:</label>
                  <select 
                    value={postTruckForm.vehicle_type}
                    onChange={(e) => setPostTruckForm({...postTruckForm, vehicle_type: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="Curtain-sided truck (Tent)">Tent (Curtain-sided)</option>
                    <option value="Refrigerated truck (Ref)">Refrijerator (Muzlatgich)</option>
                    <option value="Box truck (Izoterm)">Izoterm (Box)</option>
                    <option value="Flatbed truck">Ochiq burt (Flatbed)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Davlat raqami:</label>
                  <input 
                    type="text" 
                    required
                    placeholder="01 A 777 GA"
                    value={postTruckForm.plate_number}
                    onChange={(e) => setPostTruckForm({...postTruckForm, plate_number: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Markasi:</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Volvo, MAN, Scania, DAF, KamAZ"
                    value={postTruckForm.make}
                    onChange={(e) => setPostTruckForm({...postTruckForm, make: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Modeli:</label>
                  <input 
                    type="text" 
                    placeholder="FH 500, TGX, Actros"
                    value={postTruckForm.model}
                    onChange={(e) => setPostTruckForm({...postTruckForm, model: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Sig'imi (tonna):</label>
                  <input 
                    type="number" 
                    required
                    value={postTruckForm.max_weight_tons}
                    onChange={(e) => setPostTruckForm({...postTruckForm, max_weight_tons: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Hajmi (m³):</label>
                  <input 
                    type="number" 
                    required
                    value={postTruckForm.max_volume_m3}
                    onChange={(e) => setPostTruckForm({...postTruckForm, max_volume_m3: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs transition shadow-lg shadow-emerald-600/25"
              >
                Transportni Bepul E'lon Qilish
              </button>
            </form>
          </div>
        )}

        {/* TAB 5: PUBLISH LOAD (LOGISTICS SHIPPERS ONLY) */}
        {activeTab === 'publish_load' && user && (user.role === 'LOGISTIC' || user.role === 'LOGISTICS_COMPANY_OWNER' || user.role === 'SUPER_ADMIN') && (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="mb-6">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 font-bold text-xs rounded-full">
                Logistika Kompaniyalari Uchun
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">Yangi Xalqaro Yuk Chop Etish</h2>
              <p className="text-xs text-slate-500 mt-1">
                E'lon chop etilgach, haydovchilar to'g'ridan-to'g'ri narx taklif qilishadi.
              </p>
            </div>

            <form onSubmit={handleCreateLoad} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Yuk nomi:</label>
                <input 
                  type="text" 
                  required
                  placeholder="Meva va Sabzavotlar / Qurilish materiallari"
                  value={postLoadForm.cargo_title}
                  onChange={(e) => setPostLoadForm({...postLoadForm, cargo_title: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Yuk ortish shahri:</label>
                  <input 
                    type="text" 
                    required
                    value={postLoadForm.origin_city}
                    onChange={(e) => setPostLoadForm({...postLoadForm, origin_city: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Yetkazish shahri:</label>
                  <input 
                    type="text" 
                    required
                    value={postLoadForm.destination_city}
                    onChange={(e) => setPostLoadForm({...postLoadForm, destination_city: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Vazn (kg):</label>
                  <input 
                    type="number" 
                    required
                    value={postLoadForm.weight_kg}
                    onChange={(e) => setPostLoadForm({...postLoadForm, weight_kg: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Hajm (m³):</label>
                  <input 
                    type="number" 
                    required
                    value={postLoadForm.volume_m3}
                    onChange={(e) => setPostLoadForm({...postLoadForm, volume_m3: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Narxi ($):</label>
                  <input 
                    type="number" 
                    required
                    value={postLoadForm.price}
                    onChange={(e) => setPostLoadForm({...postLoadForm, price: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-black text-slate-800"
                  />
                </div>
              </div>

              {/* Aloqa / Dispetcher Ma'lumotlari */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Mas'ul shaxs (Dispetcher): <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Masalan: Jamshid Haydarov"
                    value={postLoadForm.contact_name}
                    onChange={(e) => setPostLoadForm({...postLoadForm, contact_name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Telefon raqam: <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="+998901234567"
                    value={postLoadForm.contact_phone}
                    onChange={(e) => setPostLoadForm({...postLoadForm, contact_phone: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-xs transition shadow-lg shadow-blue-600/25"
              >
                Yukni Chop Etish
              </button>
            </form>
          </div>
        )}

        {/* TAB 6: SUBSCRIPTION PRICING (LOGISTICS ONLY) */}
        {activeTab === 'subscriptions' && (!user || user.role === 'LOGISTIC' || user.role === 'LOGISTICS_COMPANY_OWNER' || user.role === 'SUPER_ADMIN') && (
          <div>
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="px-3.5 py-1.5 bg-blue-100 text-blue-700 font-extrabold text-xs rounded-full">
                Logistika Kompaniyalari Uchun
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
                Shaffof va Qulay Oylik Obuna
              </h2>
              <p className="text-slate-500 text-sm mt-2">
                Hech qanday foiz yoki tranzaksiya komissiyasi yo'q. 
                <strong className="text-emerald-600 ml-1">Haydovchilar har doim 100% bepul foydalanishadi.</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((p) => (
                <div key={p.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-2xl hover:border-blue-500 transition-all flex flex-col justify-between">
                  <div>
                    <h3 className="font-extrabold text-xl text-slate-900">{p.name}</h3>
                    <div className="mt-4 mb-6">
                      <span className="text-3xl font-black text-slate-900">{(p.price_uzs / 1000).toLocaleString()} ming</span>
                      <span className="text-xs text-slate-400 font-medium"> so'm / oy</span>
                    </div>

                    <div className="space-y-3 text-xs text-slate-600 border-t border-slate-100 pt-5">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span><strong>{p.active_loads_limit} tagacha</strong> faol yuk e'loni</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span><strong>{p.max_team_members} nafar</strong> logist a'zosi</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Kengaytirilgan furalar qidiruvi</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleSubscribe(p)}
                    className="mt-8 w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold rounded-2xl text-xs transition shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Obuna Bo'lish</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* TAB 7: SUPER ADMIN / PLATFORM OWNER PANEL */}
        {activeTab === 'admin' && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header banner */}
            <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-rose-500/30 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="px-3.5 py-1 bg-rose-500/20 text-rose-400 font-extrabold text-xs rounded-full border border-rose-500/40 flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>PLATFORMA EGASI BOSHQARUV PANELI</span>
                    </span>
                    <span className="text-xs text-slate-300">
                      Foydalanuvchi: <strong className="text-white">{user?.full_name}</strong>
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                    Moliya, Logistika va Haydovchilar Monitoringi
                  </h1>
                  <p className="text-xs text-slate-300 mt-1">
                    Qaysi logist pul to'lagan, qaysilari aktiv yoki muddati o'tgan, qancha haydovchi faol va jami tushum haqiqiy vaqtda (real-time).
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={fetchAdminData}
                    disabled={adminLoading}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-rose-600/30"
                  >
                    <Activity className={`w-4 h-4 ${adminLoading ? 'animate-spin' : ''}`} />
                    <span>Yangilash</span>
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            {adminMetrics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. Logistika To'lovlari */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider">Logistika To'lovlari</span>
                    <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <CreditCard className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline space-x-2">
                    <span className="text-3xl font-black text-slate-900">{adminMetrics.active_paid_subscriptions}</span>
                    <span className="text-xs text-slate-500 font-bold">/ {adminMetrics.total_logistics} jami</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                    <span className="text-emerald-600 font-bold">✓ {adminMetrics.active_paid_subscriptions} to'lagan (Aktiv)</span>
                    <span className="text-rose-600 font-bold">✕ {adminMetrics.unpaid_or_expired_logistics} to'lamagan</span>
                  </div>
                </div>

                {/* 2. Haydovchilar Holati */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider">Haydovchilar</span>
                    <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Truck className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline space-x-2">
                    <span className="text-3xl font-black text-slate-900">{adminMetrics.active_drivers}</span>
                    <span className="text-xs text-slate-500 font-bold">faol haydovchi</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                    <span className="text-slate-600 font-semibold">{adminMetrics.active_trucks_available} ta fura bo'sh</span>
                    <span className="text-rose-600 font-bold">{adminMetrics.inactive_drivers} nofaol</span>
                  </div>
                </div>

                {/* 3. Jami Tushum (Obunalar) */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-purple-600 uppercase tracking-wider">Jami Obuna Tushumi</span>
                    <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <DollarSign className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline space-x-1">
                    <span className="text-2xl font-black text-slate-900">
                      {(adminMetrics.total_revenue_uzs / 1000000).toFixed(2)}
                    </span>
                    <span className="text-xs font-bold text-slate-500">mln so'm</span>
                  </div>
                  <div className="mt-3 text-xs pt-3 border-t border-slate-100 text-slate-500">
                    Logistlar oylik tarif to'lovlari
                  </div>
                </div>

                {/* 4. Komissiya Siyosati */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider">Komissiya</span>
                    <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline space-x-1">
                    <span className="text-3xl font-black text-emerald-600">0.0%</span>
                    <span className="text-xs font-bold text-slate-500">qat'iy 0 foiz</span>
                  </div>
                  <div className="mt-3 text-xs pt-3 border-t border-slate-100 text-emerald-700 font-bold">
                    Haydovchilar: 100% Bepul
                  </div>
                </div>
              </div>
            )}

            {/* TAB SECTION: LOGISTICS SUBSCRIPTION APPLICATIONS (YANGI ARIZALAR) */}
            <div className="bg-white rounded-3xl border border-amber-300 shadow-md p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                      Yangi Arizalar
                    </span>
                    <h3 className="text-lg font-black text-slate-900">
                      📝 Logistlardan Kelgan Obuna va To'lov Arizalari
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Logistika kompaniyasi obunani tanlab ariza yuborgan. To'lov amalga oshirilgach, "Tasdiqlash" tugmasini bosing — logist darhol aktivlashadi!
                  </p>
                </div>
                <span className="text-xs font-bold text-amber-900 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                  Kutilayotgan: {adminApplications.filter(a => a.status === 'PENDING').length} ta
                </span>
              </div>

              {adminApplications.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Hozircha yangi arizalar mavjud emas.
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-amber-50/60 text-amber-950 uppercase tracking-wider font-bold">
                      <tr>
                        <th className="py-3 px-4 rounded-l-xl">Kompaniya & Mas'ul</th>
                        <th className="py-3 px-4">Telefon</th>
                        <th className="py-3 px-4">Tanlangan Tarif</th>
                        <th className="py-3 px-4">To'lov Usuli</th>
                        <th className="py-3 px-4">Ariza Holati</th>
                        <th className="py-3 px-4">Sana</th>
                        <th className="py-3 px-4 rounded-r-xl text-right">Admin Qarori</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {adminApplications.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50 transition">
                          <td className="py-3.5 px-4">
                            <strong className="text-slate-900 text-sm block">{app.company_name}</strong>
                            <span className="text-slate-400 text-[11px]">{app.user_name}</span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            {app.contact_phone}
                            {app.extra_phone && <span className="block text-[10px] text-slate-400">{app.extra_phone}</span>}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                              {app.plan_code}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-700">
                            {app.payment_method}
                          </td>
                          <td className="py-3.5 px-4">
                            {app.status === 'PENDING' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                                ⏳ Kutilmoqda
                              </span>
                            )}
                            {app.status === 'APPROVED' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                ✓ Tasdiqlangan (Aktiv)
                              </span>
                            )}
                            {app.status === 'REJECTED' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                                ✕ Rad etilgan
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {new Date(app.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {app.status === 'PENDING' ? (
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleReviewApplication(app.id, 'APPROVE')}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition shadow-sm"
                                >
                                  ✓ Tasdiqlash & Faollashtirish
                                </button>
                                <button
                                  onClick={() => handleReviewApplication(app.id, 'REJECT')}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition"
                                >
                                  Rad etish
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Ko'rib chiqilgan</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* TAB SECTION: LOGISTICS COMPANIES (PAID / UNPAID) */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center space-x-2">
                    <span>🏢 Logistika Kompaniyalari (To'lagan / To'lamagan)</span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                      {adminLogistics.length} ta
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Qaysi logistika kompaniyasi oylik obuna to'laganini va tarif muddatini to'liq ko'rish
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setAdminFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${adminFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Hammasi ({adminLogistics.length})
                  </button>
                  <button 
                    onClick={() => setAdminFilter('PAID')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${adminFilter === 'PAID' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                  >
                    ✓ Pul to'lagan ({adminLogistics.filter(l => l.has_paid_subscription).length})
                  </button>
                  <button 
                    onClick={() => setAdminFilter('UNPAID')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${adminFilter === 'UNPAID' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}
                  >
                    ✕ To'lamagan ({adminLogistics.filter(l => !l.has_paid_subscription).length})
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4 rounded-l-xl">Kompaniya & Mas'ul</th>
                      <th className="py-3 px-4">Telefon & Manzil</th>
                      <th className="py-3 px-4">Obuna Holati</th>
                      <th className="py-3 px-4">Tarif Rejasi</th>
                      <th className="py-3 px-4">Muddati</th>
                      <th className="py-3 px-4">Yuklar soni</th>
                      <th className="py-3 px-4">Jami To'langan</th>
                      <th className="py-3 px-4 rounded-r-xl text-right">Harakat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {adminLogistics
                      .filter(l => {
                        if (adminFilter === 'PAID') return l.has_paid_subscription;
                        if (adminFilter === 'UNPAID') return !l.has_paid_subscription;
                        return true;
                      })
                      .map((logist) => (
                        <tr key={logist.company_id} className="hover:bg-slate-50/70 transition">
                          <td className="py-4 px-4">
                            <div className="font-extrabold text-slate-900 text-sm">{logist.company_name}</div>
                            <div className="text-slate-500 text-[11px] mt-0.5">{logist.owner_name}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-bold text-slate-800">{logist.owner_phone}</div>
                            <div className="text-slate-400 text-[11px]">{logist.city}</div>
                          </td>
                          <td className="py-4 px-4">
                            {logist.has_paid_subscription ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle className="w-3 h-3 mr-1" /> To'lagan (Aktiv)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                                <AlertCircle className="w-3 h-3 mr-1" /> To'lamagan / Muddati o'tgan
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                              {logist.plan_name}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-600">
                            {logist.subscription_expires_at ? (
                              <div>
                                <span className="font-bold">{new Date(logist.subscription_expires_at).toLocaleDateString()}</span>
                                <span className="text-[10px] text-slate-400 block">gacha amal qiladi</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                              {logist.total_loads_posted} ta
                            </span>
                          </td>
                          <td className="py-4 px-4 font-black text-slate-900">
                            {logist.total_amount_paid_uzs > 0 ? (
                              <span className="text-emerald-600">
                                {(logist.total_amount_paid_uzs / 1000).toLocaleString()} so'm
                              </span>
                            ) : (
                              <span className="text-slate-400">0 so'm</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {logist.owner_id && (
                              <div className="flex items-center justify-end space-x-1.5">
                                {logist.is_active ? (
                                  <button
                                    onClick={() => handleToggleUserStatus(logist.owner_id, 'DEACTIVATE')}
                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[11px] transition"
                                  >
                                    Bloklash
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleToggleUserStatus(logist.owner_id, 'ACTIVATE')}
                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px] transition"
                                  >
                                    Faollashtirish
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TAB SECTION: DRIVERS LIST (ACTIVE / INACTIVE) */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center space-x-2">
                    <span>🚛 Haydovchilar Boshqaruvi (Faol / Nofaol)</span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                      {adminDrivers.length} nafar
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Haydovchilar 100% bepul foydalanishadi. Bu yerda ularning faolligi, mashinalari va safarlari nazorat qilinadi.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    Faol: {adminDrivers.filter(d => d.is_active).length}
                  </span>
                  <span className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                    Nofaol: {adminDrivers.filter(d => !d.is_active).length}
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4 rounded-l-xl">Haydovchi</th>
                      <th className="py-3 px-4">Telefon</th>
                      <th className="py-3 px-4">Viloyat / Shahar</th>
                      <th className="py-3 px-4">Holati</th>
                      <th className="py-3 px-4">Avtomobillari</th>
                      <th className="py-3 px-4">Safarlar</th>
                      <th className="py-3 px-4">Reyting</th>
                      <th className="py-3 px-4 rounded-r-xl text-right">Boshqaruv</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {adminDrivers.map((driver) => (
                      <tr key={driver.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-4 px-4">
                          <div className="font-extrabold text-slate-900 text-sm">{driver.full_name}</div>
                          <div className="text-[10px] text-slate-400">
                            Ro'yxat: {new Date(driver.registered_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-800">
                          {driver.phone}
                        </td>
                        <td className="py-4 px-4 text-slate-600">
                          {driver.city}
                        </td>
                        <td className="py-4 px-4">
                          {driver.is_active ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle className="w-3 h-3 mr-1" /> Faol
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertCircle className="w-3 h-3 mr-1" /> Nofaol / Bloklangan
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {driver.vehicles_count} ta fura
                          </span>
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-700">
                          {driver.completed_trips} ta
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-1 text-amber-500 font-black">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            <span>{driver.rating}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {driver.is_active ? (
                              <button
                                onClick={() => handleToggleUserStatus(driver.id, 'DEACTIVATE')}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[11px] transition"
                              >
                                Bloklash
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleUserStatus(driver.id, 'ACTIVATE')}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px] transition"
                              >
                                Faollashtirish
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Payment Checkout Modal for Logistics Subscriptions */}
      {showPaymentModal && selectedPlanForPayment && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Obunani Faollashtirish</h3>
                  <span className="text-xs text-slate-400">Xavfsiz to'lov va 30 kunlik to'liq a'zolik</span>
                </div>
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Plan Summary Card */}
            <div className="mt-5 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                    Tanlangan Tarif
                  </span>
                  <h4 className="text-xl font-black text-slate-900 mt-1">{selectedPlanForPayment.name}</h4>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-blue-700">
                    {(selectedPlanForPayment.price_uzs / 1000).toLocaleString()} ming
                  </span>
                  <span className="text-xs text-slate-500 block">so'm / oy</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-semibold text-slate-700 border-t border-blue-100/80 pt-3">
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{selectedPlanForPayment.active_loads_limit} ta faol yuk</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{selectedPlanForPayment.max_team_members} ta dispetcher</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Furalar qidiruvi</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>0% komissiya</span>
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="mt-6">
              <label className="text-xs font-bold text-slate-700 block mb-2">To'lov usulini tanlang:</label>
              <div className="grid grid-cols-3 gap-3">
                {/* Click */}
                <button
                  type="button"
                  onClick={() => setPaymentProvider('CLICK')}
                  className={`p-3.5 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-1 ${
                    paymentProvider === 'CLICK'
                      ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <span className="font-black text-base text-blue-600">CLICK</span>
                  <span className="text-[10px] text-slate-500 font-bold">Avtomatik</span>
                </button>

                {/* Payme */}
                <button
                  type="button"
                  onClick={() => setPaymentProvider('PAYME')}
                  className={`p-3.5 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-1 ${
                    paymentProvider === 'PAYME'
                      ? 'border-teal-500 bg-teal-50/50 shadow-md ring-2 ring-teal-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <span className="font-black text-base text-teal-600">payme</span>
                  <span className="text-[10px] text-slate-500 font-bold">Hamyon / Karta</span>
                </button>

                {/* Bank / Hisob-faktura */}
                <button
                  type="button"
                  onClick={() => setPaymentProvider('BANK_TRANSFER')}
                  className={`p-3.5 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-1 ${
                    paymentProvider === 'BANK_TRANSFER'
                      ? 'border-slate-900 bg-slate-100 shadow-md ring-2 ring-slate-900/10'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <span className="font-black text-xs text-slate-900">HISOB-RAQAM</span>
                  <span className="text-[10px] text-slate-500 font-bold">Yuridik shaxs</span>
                </button>
              </div>
            </div>

            {/* Terms and guarantees */}
            <div className="mt-5 p-3 rounded-xl bg-slate-50 text-[11px] text-slate-500 space-y-1 border border-slate-100">
              <div className="flex items-center space-x-1.5 font-bold text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>100% Rasmiy Shartnoma va Elektron Chek</span>
              </div>
              <p>To'lov amalga oshirilishi bilan sizning kompaniyangiz tizimda "Pul to'lagan (Aktiv)" statusiga o'tadi va barcha yuk e'lonlari darhol faollashadi.</p>
            </div>

            {/* Actions */}
            <div className="mt-6 flex space-x-3">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={isProcessingPayment}
                onClick={executePayment}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold rounded-2xl text-xs transition shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2"
              >
                {isProcessingPayment ? (
                  <span>To'lov qilinmoqda...</span>
                ) : (
                  <>
                    <span>To'lash ({selectedPlanForPayment.price_uzs.toLocaleString()} so'm)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal (Login & Register) */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">
                {authMode === 'login' ? 'Tizimga Kirish' : 'Yangi Hisob Ochish'}
              </h3>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {authMode === 'login' ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Telefon raqam:</label>
                  <input 
                    type="text" 
                    placeholder="+998901234567"
                    value={authForm.phone}
                    onChange={(e) => setAuthForm({...authForm, phone: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Parol:</label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <button 
                  onClick={() => loginAs(authForm.phone, authForm.password)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md"
                >
                  Kirish
                </button>
                <div className="text-center pt-2">
                  <button onClick={() => setAuthMode('register')} className="text-xs text-blue-600 font-bold hover:underline">
                    Hisobingiz yo'qmi? Ro'yxatdan o'ting
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Hisob turi (Rol):</label>
                  <select 
                    value={authForm.role}
                    onChange={(e) => setAuthForm({...authForm, role: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="DRIVER">🚛 Haydovchi (100% Bepul)</option>
                    <option value="LOGISTIC">🏢 Logist (Kompaniya xodimi)</option>
                    <option value="LOGISTICS_COMPANY_OWNER">🏢 Logistika Kompaniyasi Egasi</option>
                    <option value="TRANSPORT_COMPANY">🚚 Transport Kompaniyasi (Fleet)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">To'liq ism / Kompaniya nomi:</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Alisher Navoiy"
                    value={authForm.full_name}
                    onChange={(e) => setAuthForm({...authForm, full_name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Telefon raqam:</label>
                  <input 
                    type="text" 
                    required
                    placeholder="+998901234567"
                    value={authForm.phone}
                    onChange={(e) => setAuthForm({...authForm, phone: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Parol:</label>
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>

                {/* Haydovchi uchun Mashina va Texpasport raqami majburiy */}
                {(authForm.role === 'DRIVER' || authForm.role === 'VEHICLE_OWNER') && (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3">
                    <div className="flex items-center space-x-1.5 text-xs font-extrabold text-emerald-800">
                      <Truck className="w-4 h-4 text-emerald-600" />
                      <span>Avtomobil va Texpasport Ma'lumotlari (1 marta ro'yxatdan o'tish)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Davlat Raqami: <span className="text-rose-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder="01 A 777 AA"
                          value={authForm.plate_number}
                          onChange={(e) => setAuthForm({...authForm, plate_number: e.target.value.toUpperCase()})}
                          className="w-full bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs font-black text-slate-900 uppercase"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Texpasport Raqami: <span className="text-rose-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder="AAF 1234567"
                          value={authForm.tech_passport_number}
                          onChange={(e) => setAuthForm({...authForm, tech_passport_number: e.target.value.toUpperCase()})}
                          className="w-full bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs font-black text-slate-900 uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Marka & Model:</label>
                        <input 
                          type="text" 
                          placeholder="Volvo FH 500"
                          value={`${authForm.vehicle_make} ${authForm.vehicle_model}`}
                          onChange={(e) => {
                            const parts = e.target.value.split(' ');
                            setAuthForm({
                              ...authForm, 
                              vehicle_make: parts[0] || 'Volvo',
                              vehicle_model: parts.slice(1).join(' ') || 'Truck'
                            });
                          }}
                          className="w-full bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Kuzov turi:</label>
                        <select 
                          value={authForm.vehicle_type}
                          onChange={(e) => setAuthForm({...authForm, vehicle_type: e.target.value})}
                          className="w-full bg-white border border-slate-300 px-2 py-2 rounded-xl text-xs font-bold text-slate-800"
                        >
                          <option value="Curtain-sided truck (Tent)">Tent (Parda)</option>
                          <option value="Refrigerated truck (Ref)">Refrijerator</option>
                          <option value="Flatbed truck">Ochiq bortli</option>
                          <option value="Tanker">Sitserna (Bak)</option>
                          <option value="Tipper truck">Samosval</option>
                          <option value="Container carrier">Konteynerovoz</option>
                        </select>
                      </div>
                    </div>

                    <p className="text-[10px] text-emerald-700 font-medium">
                      🔒 Xavfsizlik: Bitta mashina va texpasport faqat bitta haydovchiga biriktiriladi.
                    </p>
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md"
                >
                  Ro'yxatdan O'tish
                </button>
                <div className="text-center pt-2">
                  <button type="button" onClick={() => setAuthMode('login')} className="text-xs text-blue-600 font-bold hover:underline">
                    Hisobingiz bormi? Kirish
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {showOfferModal && selectedLoad && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100">
            <h3 className="text-lg font-black text-slate-900">{t('modal_offer_title')}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Yuk: <strong>{selectedLoad.cargo_title}</strong> ({selectedLoad.origin_city} ➔ {selectedLoad.destination_city})
            </p>

            <form onSubmit={handleOfferSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">{t('modal_proposed_price')}:</label>
                <input 
                  type="number" 
                  required
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">{t('modal_comment')}:</label>
                <textarea 
                  rows="3"
                  value={offerComment}
                  onChange={(e) => setOfferComment(e.target.value)}
                  placeholder="Yuk ortish vaqti, mashina holati haqida..."
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="bg-emerald-50 text-emerald-800 text-xs p-3.5 rounded-xl flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                <span><strong>0% Komissiya:</strong> {t('modal_offer_sub')}</span>
              </div>

              <div className="flex space-x-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowOfferModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 rounded-xl"
                >
                  {t('btn_cancel')}
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  {t('btn_send')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logistika Kompaniyasi Obuna Ariza Jo'natish Modali */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Obunaga Ariza Jo'natish</h3>
                  <span className="text-xs text-slate-400">Admin tasdiqlagach to'liq imkoniyatlar ochiladi</span>
                </div>
              </div>
              <button 
                onClick={() => setShowApplyModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitApplication} className="mt-5 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Kompaniya nomi: <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Silk Road Logistics LLC"
                  value={applyForm.company_name}
                  onChange={(e) => setApplyForm({...applyForm, company_name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Telefon raqam: <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="+998901234567"
                    value={applyForm.contact_phone}
                    onChange={(e) => setApplyForm({...applyForm, contact_phone: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Qo'shimcha telefon:</label>
                  <input 
                    type="text" 
                    placeholder="+998931112233"
                    value={applyForm.extra_phone}
                    onChange={(e) => setApplyForm({...applyForm, extra_phone: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Qaysi obunani sotib olmoqchisiz: <span className="text-rose-500">*</span>
                </label>
                <select 
                  value={applyForm.plan_code}
                  onChange={(e) => setApplyForm({...applyForm, plan_code: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-black text-blue-700"
                >
                  <option value="START">Start Plan (199 000 so'm / oy - 5 tagacha yuk)</option>
                  <option value="STANDARD">Standard Plan (399 000 so'm / oy - 20 tagacha yuk)</option>
                  <option value="BUSINESS">Business Plan (699 000 so'm / oy - 100 tagacha yuk)</option>
                  <option value="ENTERPRISE">Enterprise VIP (1 499 000 so'm / oy - Cheksiz)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">To'lov usuli:</label>
                <select 
                  value={applyForm.payment_method}
                  onChange={(e) => setApplyForm({...applyForm, payment_method: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="BANK_TRANSFER">Hisob-raqam orqali to'lov (Bank o'tkazmasi)</option>
                  <option value="CLICK">Click orqali to'lov</option>
                  <option value="PAYME">Payme orqali to'lov</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Qo'shimcha izoh / xabar:</label>
                <textarea 
                  rows="2"
                  placeholder="Shartnoma tuzish, hisob-faktura yuborish haqida..."
                  value={applyForm.comment}
                  onChange={(e) => setApplyForm({...applyForm, comment: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl text-[11px] text-amber-800 space-y-1 border border-amber-200">
                <strong>🔒 Muhim:</strong>
                <p>Arizangiz to'g'ridan-to'g'ri platforma rahbariga boradi. To'lov tasdiqlangach profilingiz to'liq aktivlashadi.</p>
              </div>

              <div className="flex space-x-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingApp}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/25"
                >
                  {isSubmittingApp ? "Yuborilmoqda..." : "Arizani Jo'natish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cargo Details Modal */}
      {showDetailModal && selectedLoad && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                {selectedLoad.company_name || 'Silk Road Global Logistics'}
              </span>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4">
              <h3 className="text-xl font-black text-slate-900">{selectedLoad.cargo_title}</h3>
              <p className="text-xs text-slate-500 mt-1">{selectedLoad.cargo_category}</p>

              <div className="bg-slate-50 p-4 rounded-2xl mt-4 border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase">Marshrut</div>
                <div className="text-sm font-black text-slate-900 mt-1">
                  {selectedLoad.origin_city}, {selectedLoad.origin_country} ➔ {selectedLoad.destination_city}, {selectedLoad.destination_country}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-slate-400 block font-medium">Vazn:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{(selectedLoad.weight_kg / 1000).toFixed(1)} tonna</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-slate-400 block font-medium">Hajm:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{selectedLoad.volume_m3} m³</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-slate-400 block font-medium">Kuzov turi:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{selectedLoad.required_vehicle_type}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-slate-400 block font-medium">Taklif narxi:</span>
                  <span className="font-black text-emerald-600 text-base">${selectedLoad.price}</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 text-blue-900 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block">Dispetcher:</span>
                  <strong className="text-sm">
                    {selectedLoad.contact_name || selectedLoad.company_name || 'Silk Road Dispetcher'}
                  </strong>
                </div>
                <a 
                  href={`tel:${selectedLoad.contact_phone || '+998901112233'}`}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center space-x-1 shadow-sm transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{selectedLoad.contact_phone || '+998901112233'}</span>
                </a>
              </div>
            </div>

            <div className="mt-6 flex space-x-2">
              <button 
                onClick={() => setShowDetailModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 rounded-xl"
              >
                Yopish
              </button>
              <button 
                onClick={() => {
                  setShowDetailModal(false);
                  setOfferPrice(selectedLoad.price.toString());
                  setShowOfferModal(true);
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white rounded-xl shadow-lg shadow-emerald-600/25"
              >
                Narx Taklif Qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Footer */}
      <footer className="bg-slate-950 text-slate-400 py-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
              CL
            </div>
            <span>© 2026 CARGOLINK International Freight Marketplace. Barcha huquqlar himoyalangan.</span>
          </div>
          <div className="flex items-center space-x-6 text-slate-300 font-semibold">
            <span className="text-emerald-400">Komissiya: 0%</span>
            <span>Haydovchilar: 100% Bepul</span>
            <span>Logistika: Oylik obuna</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
