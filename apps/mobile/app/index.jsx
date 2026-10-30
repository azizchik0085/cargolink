import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  TextInput, SafeAreaView, StatusBar, ActivityIndicator, Modal, ScrollView, Alert 
} from 'react-native';

const API_BASE = 'http://localhost:8000/api/v1';

export default function MobileApp() {
  const [user, setUser] = useState(null); // null if guest
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState('loads'); // 'loads', 'vehicles', 'matching', 'dashboard', 'pricing', 'publish_truck', 'publish_load'
  
  const [loads, setLoads] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [plans, setPlans] = useState([]);
  const [matchedLoads, setMatchedLoads] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerComment, setOfferComment] = useState('');

  // Auth form
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authRole, setAuthRole] = useState('DRIVER'); // 'DRIVER' or 'LOGISTIC'

  // Truck post form
  const [truckMake, setTruckMake] = useState('Volvo');
  const [truckPlate, setTruckPlate] = useState('');
  const [truckWeight, setTruckWeight] = useState('22');
  const [truckVolume, setTruckVolume] = useState('90');

  // Load post form
  const [loadTitle, setLoadTitle] = useState('');
  const [loadOrigin, setLoadOrigin] = useState('Tashkent');
  const [loadDest, setLoadDest] = useState('Almaty');
  const [loadPrice, setLoadPrice] = useState('1800');
  const [loadWeight, setLoadWeight] = useState('20000');

  useEffect(() => {
    loadPublicData();
  }, []);

  const loadPublicData = async () => {
    setLoading(true);
    try {
      const resL = await fetch(`${API_BASE}/loads/`);
      const dataL = await resL.json();
      setLoads(dataL);

      const resV = await fetch(`${API_BASE}/vehicles/`);
      const dataV = await resV.json();
      setVehicles(dataV);

      const resP = await fetch(`${API_BASE}/subscriptions/plans`);
      const dataP = await resP.json();
      setPlans(dataP);
    } catch (e) {
      console.log('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!authPhone || !authPassword) {
      Alert.alert('Xatolik', 'Telefon raqam va parolni kiriting');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: authPhone, password: authPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.access_token);
        setUser(data.user);
        setShowAuthModal(false);
        fetchDashboard(data.user.role, data.access_token);
        Alert.alert('Muvaffaqiyatli', `Xush kelibsiz, ${data.user.full_name}!`);
      } else {
        Alert.alert('Kirishda xatolik', data.detail || 'Parol yoki telefon xato');
      }
    } catch (e) {
      Alert.alert('Tarmoq xatosi', 'Server bilan aloqa yo\'q');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!authPhone || !authPassword || !authFullName) {
      Alert.alert('Xatolik', 'Barcha maydonlarni to\'ldiring');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: authPhone,
          password: authPassword,
          full_name: authFullName,
          role: authRole
        })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.access_token);
        setUser(data.user);
        setShowAuthModal(false);
        fetchDashboard(data.user.role, data.access_token);
        Alert.alert('Muvaffaqiyatli', 'Ro\'yxatdan o\'tdingiz!');
      } else {
        Alert.alert('Xatolik', data.detail || 'Bu raqam allaqachon ro\'yxatdan o\'tgan');
      }
    } catch (e) {
      Alert.alert('Xatolik', 'Server xatosi');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async (role, userToken) => {
    try {
      let endpoint = '/dashboard/driver';
      if (role === 'LOGISTIC' || role === 'LOGISTICS_COMPANY_OWNER') {
        endpoint = '/dashboard/logistic';
      }
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${userToken || token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (e) {
      console.log('Dashboard error', e);
    }
  };

  const logout = () => {
    setUser(null);
    setToken('');
    setDashboardData(null);
    setActiveTab('loads');
    Alert.alert('Chiqildi', 'Hisobingizdan chiqdingiz');
  };

  const runSmartMatching = async (vehicleId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/search/match-for-vehicle/${vehicleId}`);
      const data = await res.json();
      setMatchedLoads(data);
      setActiveTab('matching');
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOffer = async () => {
    if (!token) {
      Alert.alert('Diqqat', 'Avval haydovchi sifatida tizimga kiring');
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
          currency: 'USD',
          pickup_date: new Date().toISOString(),
          comment: offerComment
        })
      });
      if (res.ok) {
        Alert.alert('Yuborildi', 'Taklif logistika dispetcheriga yuborildi (0% komissiya)!');
        setShowOfferModal(false);
        setOfferPrice('');
        setOfferComment('');
        if (user) fetchDashboard(user.role, token);
      } else {
        const data = await res.json();
        Alert.alert('Xatolik', data.detail || 'Yuborishda xatolik');
      }
    } catch (e) {
      Alert.alert('Xatolik', 'Tarmoq xatosi');
    }
  };

  const handleCreateTruck = async () => {
    if (!token) {
      Alert.alert('Diqqat', 'Avval haydovchi hisobingiz bilan kiring');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/vehicles/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicle_type: 'Curtain-sided truck (Tent)',
          make: truckMake,
          plate_number: truckPlate,
          max_weight_tons: parseFloat(truckWeight),
          max_volume_m3: parseFloat(truckVolume),
          current_country: 'Uzbekistan',
          current_city: 'Tashkent'
        })
      });
      if (res.ok) {
        Alert.alert('Muvaffaqiyatli', 'Avtomobilingiz 100% bepul ro\'yxatdan o\'tdi!');
        setActiveTab('vehicles');
        loadPublicData();
        if (user) fetchDashboard(user.role, token);
      }
    } catch (e) {
      Alert.alert('Xatolik', 'Xatolik yuz berdi');
    }
  };

  const handleCreateLoad = async () => {
    if (!token) {
      Alert.alert('Diqqat', 'Avval logistika hisobi bilan kiring');
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
          cargo_title: loadTitle,
          origin_city: loadOrigin,
          origin_country: 'Uzbekistan',
          destination_city: loadDest,
          destination_country: 'Kazakhstan',
          weight_kg: parseFloat(loadWeight),
          volume_m3: 86,
          required_vehicle_type: 'Curtain-sided truck (Tent)',
          price: parseFloat(loadPrice),
          currency: 'USD',
          contact_name: user?.full_name || 'Dispatcher',
          contact_phone: user?.phone || '+998901234567',
          loading_date: new Date().toISOString()
        })
      });
      if (res.ok) {
        Alert.alert('Muvaffaqiyatli', 'Yuk e\'loni chop etildi!');
        setActiveTab('loads');
        loadPublicData();
        if (user) fetchDashboard(user.role, token);
      }
    } catch (e) {
      Alert.alert('Xatolik', 'Yuk kiritishda xatolik');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>CL</Text>
          </View>
          <View style={{ marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.brandTitle}>CARGOLINK</Text>
              <View style={styles.commissionBadge}>
                <Text style={styles.commissionText}>0% KOMISSIYA</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>
              {user ? `${user.full_name} (${user.role})` : 'Xalqaro Yuk & Transport Birjasi'}
            </Text>
          </View>
        </View>

        {/* User Auth Action Button */}
        {user ? (
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutBtnText}>Chiqish</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            onPress={() => {
              setAuthMode('login');
              setShowAuthModal(true);
            }} 
            style={styles.loginHeaderBtn}
          >
            <Text style={styles.loginHeaderBtnText}>Kirish</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Navigation Tabs - Strict Role Isolation */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'loads' && styles.tabButtonActive]}
          onPress={() => setActiveTab('loads')}
        >
          <Text style={[styles.tabText, activeTab === 'loads' && styles.tabTextActive]}>
            📦 Yuklar ({loads.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'vehicles' && styles.tabButtonActive]}
          onPress={() => setActiveTab('vehicles')}
        >
          <Text style={[styles.tabText, activeTab === 'vehicles' && styles.tabTextActive]}>
            🚛 Furalar ({vehicles.length})
          </Text>
        </TouchableOpacity>

        {/* Kirgan foydalanuvchi uchun kabinet */}
        {user && (
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'dashboard' && styles.tabButtonActive]}
            onPress={() => {
              fetchDashboard(user.role, token);
              setActiveTab('dashboard');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>
              📊 Shaxsiy Kabinet
            </Text>
          </TouchableOpacity>
        )}

        {/* FAQAT HAYDOVCHI MENYULARI */}
        {user && (user.role === 'DRIVER' || user.role === 'VEHICLE_OWNER') && (
          <>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'matching' && styles.tabButtonActive]}
              onPress={() => vehicles[0] ? runSmartMatching(vehicles[0].id) : setActiveTab('matching')}
            >
              <Text style={[styles.tabText, activeTab === 'matching' && styles.tabTextActive]}>
                ✨ Smart Moslashuv
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'publish_truck' && styles.tabButtonActive]}
              onPress={() => setActiveTab('publish_truck')}
            >
              <Text style={[styles.tabText, activeTab === 'publish_truck' && styles.tabTextActive]}>
                ➕ Fura Qo'shish (Bepul)
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* FAQAT LOGISTIKA MENYULARI */}
        {user && (user.role === 'LOGISTIC' || user.role === 'LOGISTICS_COMPANY_OWNER' || user.role === 'SUPER_ADMIN') && (
          <>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'publish_load' && styles.tabButtonActive]}
              onPress={() => setActiveTab('publish_load')}
            >
              <Text style={[styles.tabText, activeTab === 'publish_load' && styles.tabTextActive]}>
                ➕ Yuk Qo'shish
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'pricing' && styles.tabButtonActive]}
              onPress={() => setActiveTab('pricing')}
            >
              <Text style={[styles.tabText, activeTab === 'pricing' && styles.tabTextActive]}>
                💳 Obuna Tariflari
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Main Content Body */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Yuklanmoqda...</Text>
        </View>
      ) : activeTab === 'loads' ? (
        <FlatList
          data={loads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.companyBadge}>{item.company_name || 'Silk Road Global Logistics'}</Text>
                <Text style={styles.priceText}>${item.price.toLocaleString()}</Text>
              </View>

              <Text style={styles.cargoTitle}>{item.cargo_title}</Text>
              
              <View style={styles.routeContainer}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeLabel}>Ortish:</Text>
                  <Text style={styles.cityText}>{item.origin_city}</Text>
                  <Text style={styles.countryText}>{item.origin_country}</Text>
                </View>
                <Text style={styles.arrowText}>➔</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.routeLabel}>Yetkazish:</Text>
                  <Text style={styles.cityText}>{item.destination_city}</Text>
                  <Text style={styles.countryText}>{item.destination_country}</Text>
                </View>
              </View>

              <View style={styles.specsRow}>
                <View style={styles.specBox}>
                  <Text style={styles.specLabel}>Vazn</Text>
                  <Text style={styles.specVal}>{(item.weight_kg / 1000).toFixed(1)} t</Text>
                </View>
                <View style={styles.specBox}>
                  <Text style={styles.specLabel}>Hajm</Text>
                  <Text style={styles.specVal}>{item.volume_m3} m³</Text>
                </View>
                <View style={styles.specBox}>
                  <Text style={styles.specLabel}>Kuzov</Text>
                  <Text style={styles.specVal} numberOfLines={1}>{item.required_vehicle_type.split(' ')[0]}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.offerButton}
                onPress={() => {
                  setSelectedLoad(item);
                  setOfferPrice(item.price.toString());
                  setShowOfferModal(true);
                }}
              >
                <Text style={styles.offerButtonText}>Narx Taklif Qilish (0% Komissiya)</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      ) : activeTab === 'vehicles' ? (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.truckTypeBadge}>{item.vehicle_type}</Text>
                <Text style={styles.plateText}>{item.plate_number}</Text>
              </View>

              <Text style={styles.cargoTitle}>{item.make} {item.model}</Text>
              <Text style={styles.driverText}>Haydovchi: {item.owner_name} (✓ Tasdiqlangan)</Text>

              <View style={styles.routeContainer}>
                <Text style={styles.countryText}>Hozirgi joyi: <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>{item.current_city}, {item.current_country}</Text></Text>
              </View>

              <View style={styles.specsRow}>
                <View style={styles.specBox}>
                  <Text style={styles.specLabel}>Sig'imi</Text>
                  <Text style={styles.specVal}>{item.max_weight_tons} t</Text>
                </View>
                <View style={styles.specBox}>
                  <Text style={styles.specLabel}>Hajmi</Text>
                  <Text style={styles.specVal}>{item.max_volume_m3} m³</Text>
                </View>
              </View>
            </View>
          )}
        />
      ) : activeTab === 'dashboard' && dashboardData ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {/* Dashboard Summary Card */}
          <View style={styles.card}>
            <Text style={styles.brandTitle}>{dashboardData.profile?.full_name}</Text>
            <Text style={styles.driverText}>{dashboardData.profile?.role} • {dashboardData.profile?.phone}</Text>

            <View style={styles.specsRow}>
              {Object.entries(dashboardData.statistics || {}).slice(0, 4).map(([k, v], idx) => (
                <View key={idx} style={styles.specBox}>
                  <Text style={styles.specLabel} numberOfLines={1}>{k.replace(/_/g, ' ')}</Text>
                  <Text style={styles.specVal}>{v}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Role-Specific List */}
          {dashboardData.my_loads ? (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.sectionHeaderTitle}>Mening Yuklarim ({dashboardData.my_loads.length})</Text>
              {dashboardData.my_loads.map((l) => (
                <View key={l.id} style={styles.card}>
                  <Text style={styles.cargoTitle}>{l.cargo_title}</Text>
                  <Text style={styles.countryText}>{l.origin} ➔ {l.destination}</Text>
                  <Text style={styles.priceText}>${l.price}</Text>
                  <Text style={styles.driverText}>Holat: {l.status} • Takliflar: {l.offers_count} ta</Text>
                </View>
              ))}
            </View>
          ) : dashboardData.vehicles ? (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.sectionHeaderTitle}>Mening Transportlarim ({dashboardData.vehicles.length})</Text>
              {dashboardData.vehicles.map((v) => (
                <View key={v.id} style={styles.card}>
                  <Text style={styles.cargoTitle}>{v.make} {v.model} ({v.plate_number})</Text>
                  <Text style={styles.countryText}>{v.vehicle_type} • {v.max_weight_tons}t</Text>
                  <Text style={styles.specVal}>✓ {v.is_available ? 'Yukka tayyor' : 'Band'}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : activeTab === 'publish_truck' ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={styles.card}>
            <Text style={styles.cargoTitle}>Avtomobil Qo'shish (100% BEPUL)</Text>
            <Text style={styles.driverText}>Barcha logistika kompaniyalariga ko'rinadi</Text>

            <Text style={styles.inputLabel}>Markasi (Volvo, MAN, Scania, KamAZ):</Text>
            <TextInput style={styles.modalInput} value={truckMake} onChangeText={setTruckMake} />

            <Text style={styles.inputLabel}>Davlat raqami:</Text>
            <TextInput style={styles.modalInput} placeholder="01 A 777 GA" placeholderTextColor="#64748B" value={truckPlate} onChangeText={setTruckPlate} />

            <Text style={styles.inputLabel}>Sig'imi (tonna):</Text>
            <TextInput style={styles.modalInput} keyboardType="numeric" value={truckWeight} onChangeText={setTruckWeight} />

            <TouchableOpacity style={styles.offerButton} onPress={handleCreateTruck}>
              <Text style={styles.offerButtonText}>E'lon Qilish (Bepul)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : activeTab === 'publish_load' ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={styles.card}>
            <Text style={styles.cargoTitle}>Yangi Xalqaro Yuk Chop Etish</Text>
            
            <Text style={styles.inputLabel}>Yuk nomi:</Text>
            <TextInput style={styles.modalInput} placeholder="Meva / Tekstil / Texnika" placeholderTextColor="#64748B" value={loadTitle} onChangeText={setLoadTitle} />

            <Text style={styles.inputLabel}>Qayerdan (shahar):</Text>
            <TextInput style={styles.modalInput} value={loadOrigin} onChangeText={setLoadOrigin} />

            <Text style={styles.inputLabel}>Qayerga (shahar):</Text>
            <TextInput style={styles.modalInput} value={loadDest} onChangeText={setLoadDest} />

            <Text style={styles.inputLabel}>Narxi ($):</Text>
            <TextInput style={styles.modalInput} keyboardType="numeric" value={loadPrice} onChangeText={setLoadPrice} />

            <TouchableOpacity style={[styles.offerButton, { backgroundColor: '#2563EB' }]} onPress={handleCreateLoad}>
              <Text style={styles.offerButtonText}>Yukni E'lon Qilish</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : activeTab === 'matching' ? (
        <FlatList
          data={matchedLoads}
          keyExtractor={(item) => item.load_id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.matchScoreText}>{item.relevance_score}% Moslik</Text>
              <Text style={styles.cargoTitle}>{item.cargo_title}</Text>
              <Text style={styles.countryText}>{item.origin} ➔ {item.destination}</Text>
              <Text style={styles.priceText}>{item.price}</Text>
              <TouchableOpacity 
                style={styles.offerButton}
                onPress={() => {
                  setSelectedLoad({ id: item.load_id, cargo_title: item.cargo_title, price: 0 });
                  setShowOfferModal(true);
                }}
              >
                <Text style={styles.offerButtonText}>Darhol Taklif Yuborish</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cargoTitle}>{item.name}</Text>
              <Text style={styles.planPriceText}>{(item.price_uzs / 1000).toLocaleString()} ming <Text style={{ fontSize: 13, color: '#94A3B8' }}>so'm / oy</Text></Text>
              <Text style={styles.driverText}>✓ {item.active_loads_limit} tagacha faol yuk</Text>
              <TouchableOpacity style={[styles.offerButton, { backgroundColor: '#2563EB' }]}>
                <Text style={styles.offerButtonText}>Obuna Bo'lish</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Auth Modal (Login & Registration) */}
      {showAuthModal && (
        <Modal transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {authMode === 'login' ? 'Tizimga Kirish' : 'Ro\'yxatdan O\'tish'}
              </Text>

              {authMode === 'register' && (
                <>
                  <Text style={styles.inputLabel}>Hisob turi (Rol):</Text>
                  <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                    <TouchableOpacity 
                      onPress={() => setAuthRole('DRIVER')}
                      style={[styles.roleSelectBtn, authRole === 'DRIVER' && styles.roleSelectBtnActive]}
                    >
                      <Text style={[styles.roleSelectText, authRole === 'DRIVER' && styles.roleSelectTextActive]}>
                        🚛 Haydovchi
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setAuthRole('LOGISTIC')}
                      style={[styles.roleSelectBtn, authRole === 'LOGISTIC' && styles.roleSelectBtnActive]}
                    >
                      <Text style={[styles.roleSelectText, authRole === 'LOGISTIC' && styles.roleSelectTextActive]}>
                        🏢 Logistika
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.inputLabel}>To'liq Ism:</Text>
                  <TextInput
                    placeholder="Ismingiz"
                    placeholderTextColor="#64748B"
                    value={authFullName}
                    onChangeText={setAuthFullName}
                    style={styles.modalInput}
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Telefon raqam:</Text>
              <TextInput
                placeholder="+998901234567"
                placeholderTextColor="#64748B"
                value={authPhone}
                onChangeText={setAuthPhone}
                style={styles.modalInput}
              />

              <Text style={styles.inputLabel}>Parol:</Text>
              <TextInput
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#64748B"
                value={authPassword}
                onChangeText={setAuthPassword}
                style={styles.modalInput}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelBtn}
                  onPress={() => setShowAuthModal(false)}
                >
                  <Text style={styles.modalCancelText}>Bekor qilish</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.modalSendBtn}
                  onPress={authMode === 'login' ? handleLogin : handleRegister}
                >
                  <Text style={styles.modalSendText}>
                    {authMode === 'login' ? 'Kirish' : 'Ro\'yxatdan o\'tish'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                style={{ marginTop: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#60A5FA', fontSize: 12, fontWeight: '700' }}>
                  {authMode === 'login' ? 'Yangi hisob ochish (Ro\'yxatdan o\'tish)' : 'Hisobingiz bormi? Kirish'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Offer Modal */}
      {showOfferModal && selectedLoad && (
        <Modal transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Narx Taklif Qilish</Text>
              <Text style={styles.modalSub}>{selectedLoad.cargo_title}</Text>

              <Text style={styles.inputLabel}>Taklif Narxi ($):</Text>
              <TextInput
                keyboardType="numeric"
                value={offerPrice}
                onChangeText={setOfferPrice}
                style={styles.modalInput}
              />

              <Text style={styles.inputLabel}>Izoh:</Text>
              <TextInput
                multiline
                numberOfLines={3}
                placeholder="Mashina holati, yuk ortish vaqti..."
                placeholderTextColor="#64748B"
                value={offerComment}
                onChangeText={setOfferComment}
                style={[styles.modalInput, { height: 60 }]}
              />

              <View style={styles.zeroComNotice}>
                <Text style={styles.zeroComText}>✓ 0% Komissiya: Kelishilgan summa 100% sizga tegishli.</Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelBtn}
                  onPress={() => setShowOfferModal(false)}
                >
                  <Text style={styles.modalCancelText}>Bekor qilish</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.modalSendBtn}
                  onPress={handleSendOffer}
                >
                  <Text style={styles.modalSendText}>Yuborish</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 17,
  },
  commissionBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  commissionText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  loginHeaderBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  loginHeaderBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  logoutBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 12,
  },
  tabsScroll: {
    backgroundColor: '#0F172A',
    maxHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 4,
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: '#1E293B',
  },
  tabButtonActive: {
    backgroundColor: '#2563EB',
  },
  tabText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 12,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 14,
  },
  card: {
    backgroundColor: '#131D31',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#24324D',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyBadge: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  truckTypeBadge: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  plateText: {
    color: '#F8FAFC',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: '900',
  },
  priceText: {
    color: '#34D399',
    fontWeight: '900',
    fontSize: 20,
  },
  planPriceText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 22,
    marginTop: 4,
  },
  cargoTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 16,
    marginTop: 10,
  },
  driverText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  sectionHeaderTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 8,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1527',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  routeLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cityText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 14,
    marginTop: 1,
  },
  countryText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  arrowText: {
    color: '#3B82F6',
    marginHorizontal: 12,
    fontWeight: '900',
    fontSize: 16,
  },
  specsRow: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'space-between',
  },
  specBox: {
    flex: 1,
    backgroundColor: '#0D1527',
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  specLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  specVal: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  offerButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  offerButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  matchScoreText: {
    color: '#6EE7B7',
    fontWeight: '900',
    fontSize: 12,
    marginBottom: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  modalSub: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 14,
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  roleSelectBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#334155',
  },
  roleSelectBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  roleSelectText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  roleSelectTextActive: {
    color: '#FFFFFF',
  },
  zeroComNotice: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  zeroComText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  modalCancelText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
  },
  modalSendBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSendText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  }
});
