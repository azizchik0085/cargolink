import React, { useState, useEffect } from 'react';
import { 
  Truck, Package, Search, PlusCircle, CreditCard, ShieldCheck, 
  MapPin, Calendar, ArrowRight, User, Phone, CheckCircle2, 
  DollarSign, Activity, Sparkles, LogOut, Lock, MessageSquare, AlertCircle,
  Filter, Globe, SlidersHorizontal, ChevronRight, X, Info, Check, Eye,
  BarChart3, Navigation, Star, FileText, CheckCircle, Clock, Pause, Play
} from 'lucide-react';
import { useLanguage } from './LanguageContext';

const API_BASE = 'http://localhost:8000/api/v1';

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

  // Auth Form State
  const [authForm, setAuthForm] = useState({
    phone: '',
    password: '',
    full_name: '',
    role: 'DRIVER', // 'DRIVER', 'LOGISTIC', 'VEHICLE_OWNER', 'TRANSPORT_COMPANY'
    company_name: '',
    city: 'Tashkent'
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
    contact_name: '',
    contact_phone: '',
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
        fetchRoleDashboard(data.role);
      } else {
        logout();
      }
    } catch (err) {
      console.error(err);
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

  const loginAs = async (phone, password) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.access_token);
        localStorage.setItem('cargolink_token', data.access_token);
        setUser(data.user);
        showToast(`Xush kelibsiz, ${data.user.full_name}!`);
        setShowAuthModal(false);
        fetchRoleDashboard(data.user.role);
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
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
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
        showToast(data.detail || 'Xatolik', 'error');
      }
    } catch (err) {
      showToast('Xatolik', 'error');
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

            {user ? (
              <div className="flex items-center space-x-3">
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

          {/* Shaxsiy Kabinet - Kirgan foydalanuvchiga */}
          {user && (
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
            <>
              <button 
                onClick={() => runSmartMatching(vehicles[0]?.id)}
                className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-2 transition ${activeTab === 'matching' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-400 hover:text-white'}`}
              >
                <Sparkles className="w-4 h-4" />
                <span>{t('nav_matching')}</span>
              </button>

              <button 
                onClick={() => setActiveTab('publish_truck')}
                className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-2 transition ${activeTab === 'publish_truck' ? 'bg-emerald-700 text-white shadow-md' : 'text-emerald-400 hover:text-white'}`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Fura Qo'shish (Bepul)</span>
              </button>
            </>
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
                  <button 
                    onClick={() => setActiveTab('publish_load')}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition shadow-md flex items-center space-x-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Yangi Yuk E'lon Qilish</span>
                  </button>
                )}
              </div>
            </div>

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
              <button 
                onClick={() => setActiveTab('publish_truck')}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition shadow-md flex items-center space-x-2 self-start sm:self-auto"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Bepul Fura Qo'shish</span>
              </button>
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
                    onClick={() => showToast("Obuna to'lov tizimi muvaffaqiyatli faollashtirildi!")}
                    className="mt-8 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-xs transition shadow-lg shadow-blue-500/20"
                  >
                    Obuna Bo'lish
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

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
                  <strong className="text-sm">{selectedLoad.contact_name}</strong>
                </div>
                <a 
                  href={`tel:${selectedLoad.contact_phone}`}
                  className="px-3.5 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center space-x-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{selectedLoad.contact_phone}</span>
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
