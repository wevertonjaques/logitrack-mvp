'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  createDriver, updateDriver, deleteDriver 
} from '@/app/actions/createDriver';
import { 
  createAddress, updateAddress, deleteAddress,
  createOrder, updateOrder, deleteOrder,
  seedDemoData
} from '@/app/actions/orders';
import { 
  Truck, User, MapPin, Package, LogOut, Plus, Edit3, Trash2, 
  RefreshCw, ClipboardList, ShieldAlert, CheckCircle, Database
} from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();

  // Autenticação básica no client para segurança no MVP
  useEffect(() => {
    const role = localStorage.getItem('logitrack_user_role');
    if (role !== 'admin') {
      router.push('/login');
    }
  }, [router]);

  // Estados de Abas
  const [activeTab, setActiveTab] = useState<'orders' | 'drivers' | 'addresses'>('orders');

  // Listas do Supabase
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Modais
  const [modalType, setModalType] = useState<'driver' | 'address' | 'order' | null>(null);
  const [editId, setEditId] = useState<string | null>(null); // Se definido, é edição
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Estados dos Formulários
  // Form Motorista
  const [driverName, setDriverName] = useState('');
  const [driverCpf, setDriverCpf] = useState('');
  const [driverCnh, setDriverCnh] = useState('');
  const [vehModel, setVehModel] = useState('');
  const [vehPlate, setVehPlate] = useState('');
  const [vehWeight, setVehWeight] = useState('1000');
  const [vehVolume, setVehVolume] = useState('10');

  // Form Endereço
  const [addrType, setAddrType] = useState<'warehouse' | 'customer' | 'company'>('customer');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPostal, setAddrPostal] = useState('');
  const [addrLat, setAddrLat] = useState('-23.561486');
  const [addrLng, setAddrLng] = useState('-46.657635');

  // Form Pedido/Frete
  const [orderDriverId, setOrderDriverId] = useState('');
  const [orderOriginId, setOrderOriginId] = useState('');
  const [orderDestId, setOrderDestId] = useState('');
  const [orderWeight, setOrderWeight] = useState('10');
  const [orderVolume, setOrderVolume] = useState('0.1');
  const [orderStatus, setOrderStatus] = useState('pending');

  // Carregar dados gerais
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Buscar motoristas
      const { data: driversData } = await supabase
        .from('drivers')
        .select('*, vehicles(*)')
        .order('name');
      setDrivers(driversData || []);

      // 2. Buscar endereços
      const { data: addrData } = await supabase
        .from('addresses')
        .select('*')
        .order('street');
      setAddresses(addrData || []);

      // 3. Buscar pedidos com relacionamentos
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          *,
          driver:drivers(id, name),
          origin:addresses!orders_origin_address_id_fkey(*),
          destination:addresses!orders_destination_address_id_fkey(*)
        `)
        .order('created_at', { ascending: false });
      setOrders(ordersData || []);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fechar modal e resetar forms
  const closeModal = () => {
    setModalType(null);
    setEditId(null);
    setMsg(null);
    // Reset motorista
    setDriverName('');
    setDriverCpf('');
    setDriverCnh('');
    setVehModel('');
    setVehPlate('');
    setVehWeight('1000');
    setVehVolume('10');
    // Reset endereço
    setAddrType('customer');
    setAddrStreet('');
    setAddrCity('');
    setAddrState('');
    setAddrPostal('');
    setAddrLat('-23.561486');
    setAddrLng('-46.657635');
    // Reset pedido
    setOrderDriverId('');
    setOrderOriginId('');
    setOrderDestId('');
    setOrderWeight('10');
    setOrderVolume('0.1');
    setOrderStatus('pending');
  };

  // Abrir modal de edição para motorista
  const handleEditDriver = (driver: any) => {
    setEditId(driver.id);
    setDriverName(driver.name);
    setDriverCpf(driver.cpf);
    setDriverCnh(driver.cnh_expires_at);
    setVehModel(driver.vehicles?.model || '');
    setVehPlate(driver.vehicles?.plate || '');
    setVehWeight(String(driver.vehicles?.max_weight_kg || 1000));
    setVehVolume(String(driver.vehicles?.max_volume_m3 || 10));
    setModalType('driver');
  };

  // Abrir modal de edição para endereço
  const handleEditAddress = (addr: any) => {
    setEditId(addr.id);
    setAddrType(addr.address_type);
    setAddrStreet(addr.street);
    setAddrCity(addr.city);
    setAddrState(addr.state);
    setAddrPostal(addr.postal_code);
    
    // Extrair lat/lng do PostGIS point (geography)
    // No Supabase, pode retornar como string 'POINT(lng lat)' ou objeto.
    let lat = '-23.561486';
    let lng = '-46.657635';
    if (typeof addr.location === 'string') {
      const match = addr.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
      if (match) {
        lng = match[1];
        lat = match[2];
      }
    }
    setAddrLat(lat);
    setAddrLng(lng);
    setModalType('address');
  };

  // Abrir modal de edição para pedido
  const handleEditOrder = (ord: any) => {
    setEditId(ord.id);
    setOrderDriverId(ord.driver_id || '');
    setOrderOriginId(ord.origin_address_id || '');
    setOrderDestId(ord.destination_address_id || '');
    setOrderWeight(String(ord.weight_kg));
    setOrderVolume(String(ord.volume_m3));
    setOrderStatus(ord.status);
    setModalType('order');
  };

  // Submissões de Formulários
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setMsg(null);

    const formData = new FormData();

    try {
      if (modalType === 'driver') {
        formData.append('name', driverName);
        formData.append('cpf', driverCpf);
        formData.append('cnhExpiresAt', driverCnh);
        formData.append('vehicleModel', vehModel);
        formData.append('vehiclePlate', vehPlate);
        formData.append('maxWeightKg', vehWeight);
        formData.append('maxVolumeM3', vehVolume);

        const res = editId 
          ? await updateDriver(editId, formData) 
          : await createDriver(formData);

        if (res.success) {
          setMsg({ type: 'success', text: res.message });
          setTimeout(() => { closeModal(); loadData(); }, 1000);
        } else {
          setMsg({ type: 'error', text: res.message });
        }
      } 
      else if (modalType === 'address') {
        formData.append('addressType', addrType);
        formData.append('street', addrStreet);
        formData.append('city', addrCity);
        formData.append('state', addrState);
        formData.append('postalCode', addrPostal);
        formData.append('lat', addrLat);
        formData.append('lng', addrLng);

        const res = editId
          ? await updateAddress(editId, formData)
          : await createAddress(formData);

        if (res.success) {
          setMsg({ type: 'success', text: res.message });
          setTimeout(() => { closeModal(); loadData(); }, 1000);
        } else {
          setMsg({ type: 'error', text: res.message });
        }
      } 
      else if (modalType === 'order') {
        formData.append('driverId', orderDriverId);
        formData.append('originAddressId', orderOriginId);
        formData.append('destinationAddressId', orderDestId);
        formData.append('weightKg', orderWeight);
        formData.append('volumeM3', orderVolume);
        formData.append('status', orderStatus);

        const res = editId
          ? await updateOrder(editId, formData)
          : await createOrder(formData);

        if (res.success) {
          setMsg({ type: 'success', text: res.message });
          setTimeout(() => { closeModal(); loadData(); }, 1000);
        } else {
          setMsg({ type: 'error', text: res.message });
        }
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Erro inesperado na operação.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Exclusões
  const handleDelete = async (type: 'driver' | 'address' | 'order', id: string) => {
    if (!confirm('Deseja realmente excluir este item?')) return;

    try {
      let res;
      if (type === 'driver') res = await deleteDriver(id);
      else if (type === 'address') res = await deleteAddress(id);
      else res = await deleteOrder(id);

      if (res.success) {
        alert(res.message);
        loadData();
      } else {
        alert('Erro ao excluir: ' + res.message);
      }
    } catch (err: any) {
      alert('Erro inesperado: ' + err.message);
    }
  };

  // Rodar Seed de dados demo
  const handleSeedData = async () => {
    if (!confirm('Deseja criar dados de demonstração (Seed) no seu Supabase?')) return;
    setLoading(true);
    const res = await seedDemoData();
    if (res.success) {
      alert('Seed criado com sucesso! Pedido gerado.');
      loadData();
    } else {
      alert('Erro ao seedar banco: ' + res.message);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('logitrack_user_role');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Header */}
      <header className="bg-slate-900/60 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 p-0.5 shadow-lg">
              <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center">
                <Truck className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100 leading-none">LogiTrack</h1>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Painel Administrativo</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              title="Sincronizar dados"
              className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/50 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleSeedData}
              title="Gerar dados demo"
              className="py-2 px-3.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/20 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" /> Demo Seed
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 bg-red-950/20 hover:bg-red-900/30 text-red-400 rounded-xl border border-red-900/30 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        
        {/* Metricas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Fretes</p>
              <p className="text-xl font-bold mt-1 text-slate-100">{orders.length}</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Entregues</p>
              <p className="text-xl font-bold mt-1 text-slate-100">{orders.filter(o => o.status === 'delivered').length}</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Truck className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Em Trânsito</p>
              <p className="text-xl font-bold mt-1 text-slate-100">{orders.filter(o => o.status === 'in_transit' || o.status === 'collecting').length}</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center">
              <User className="w-6 h-6 text-slate-300" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Motoristas</p>
              <p className="text-xl font-bold mt-1 text-slate-100">{drivers.length}</p>
            </div>
          </div>
        </div>

        {/* Abas e Novo Item */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-900/20 p-2 rounded-2xl border border-slate-900">
          {/* Navegação Abas */}
          <div className="flex gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-850 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex-1 sm:flex-initial py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'orders' ? 'bg-slate-800 text-slate-100 border border-slate-700/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="w-4 h-4" /> Fretes
            </button>
            <button
              onClick={() => setActiveTab('drivers')}
              className={`flex-1 sm:flex-initial py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'drivers' ? 'bg-slate-800 text-slate-100 border border-slate-700/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-4 h-4" /> Motoristas
            </button>
            <button
              onClick={() => setActiveTab('addresses')}
              className={`flex-1 sm:flex-initial py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'addresses' ? 'bg-slate-800 text-slate-100 border border-slate-700/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-4 h-4" /> Endereços
            </button>
          </div>

          {/* Botão Novo */}
          <button
            onClick={() => {
              if (activeTab === 'orders') setModalType('order');
              if (activeTab === 'drivers') setModalType('driver');
              if (activeTab === 'addresses') setModalType('address');
            }}
            className="w-full sm:w-auto py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-sky-600/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Cadastrar {activeTab === 'orders' ? 'Frete' : activeTab === 'drivers' ? 'Motorista' : 'Endereço'}
          </button>
        </div>

        {/* Tabelas de Listagem */}
        <div className="bg-slate-900/30 border border-slate-850 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
              Sincronizando dados com o banco Supabase...
            </div>
          ) : (
            <>
              {/* ABA FRETES */}
              {activeTab === 'orders' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-medium">
                        <th className="p-4">Pedido / ID</th>
                        <th className="p-4">Origem</th>
                        <th className="p-4">Destino</th>
                        <th className="p-4">Motorista</th>
                        <th className="p-4">Carga (kg / m³)</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500">Nenhum frete/pedido cadastrado.</td>
                        </tr>
                      ) : (
                        orders.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-900/20">
                            <td className="p-4">
                              <div className="font-semibold text-slate-200">#{o.id.substring(0, 8)}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{new Date(o.created_at).toLocaleDateString()}</div>
                            </td>
                            <td className="p-4 max-w-[200px] truncate">{o.origin?.street || 'N/A'}</td>
                            <td className="p-4 max-w-[200px] truncate">{o.destination?.street || 'N/A'}</td>
                            <td className="p-4 font-semibold text-sky-400">{o.driver?.name || <span className="text-slate-500 italic">Não atribuído</span>}</td>
                            <td className="p-4 text-slate-300">
                              {o.weight_kg} kg / {o.volume_m3} m³
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                o.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                o.status === 'in_transit' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                                o.status === 'pending' ? 'bg-slate-800 text-slate-400' :
                                'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <button
                                onClick={() => handleEditOrder(o)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg cursor-pointer inline-flex"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete('order', o.id)}
                                className="p-1.5 bg-slate-800 hover:bg-red-950/40 text-red-400 rounded-lg cursor-pointer inline-flex"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ABA MOTORISTAS */}
              {activeTab === 'drivers' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-medium">
                        <th className="p-4">Nome</th>
                        <th className="p-4">CPF</th>
                        <th className="p-4">Validade CNH</th>
                        <th className="p-4">Veículo</th>
                        <th className="p-4">Capacidade Máxima</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {drivers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">Nenhum motorista cadastrado.</td>
                        </tr>
                      ) : (
                        drivers.map((d) => (
                          <tr key={d.id} className="hover:bg-slate-900/20">
                            <td className="p-4 font-semibold text-slate-200">{d.name}</td>
                            <td className="p-4 text-slate-400">{d.cpf}</td>
                            <td className="p-4 text-slate-300">{d.cnh_expires_at}</td>
                            <td className="p-4">
                              <div className="font-semibold">{d.vehicles?.plate || 'S/V'}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{d.vehicles?.model || 'Sem veículo'}</div>
                            </td>
                            <td className="p-4 text-slate-400">
                              {d.vehicles ? `${d.vehicles.max_weight_kg}kg / ${d.vehicles.max_volume_m3}m³` : '-'}
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <button
                                onClick={() => handleEditDriver(d)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg cursor-pointer inline-flex"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete('driver', d.id)}
                                className="p-1.5 bg-slate-800 hover:bg-red-950/40 text-red-400 rounded-lg cursor-pointer inline-flex"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ABA ENDEREÇOS */}
              {activeTab === 'addresses' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-medium">
                        <th className="p-4">Tipo</th>
                        <th className="p-4">Rua</th>
                        <th className="p-4">Cidade / UF</th>
                        <th className="p-4">CEP</th>
                        <th className="p-4">Coordenadas</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {addresses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">Nenhum endereço cadastrado.</td>
                        </tr>
                      ) : (
                        addresses.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-900/20">
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                a.address_type === 'warehouse' ? 'bg-amber-500/10 text-amber-400' :
                                a.address_type === 'company' ? 'bg-sky-500/10 text-sky-400' :
                                'bg-emerald-500/10 text-emerald-400'
                              }`}>
                                {a.address_type}
                              </span>
                            </td>
                            <td className="p-4 font-semibold text-slate-200">{a.street}</td>
                            <td className="p-4 text-slate-400">{a.city} - {a.state}</td>
                            <td className="p-4 text-slate-400">{a.postal_code}</td>
                            <td className="p-4 text-[10px] text-slate-500 font-mono">
                              {a.location ? 'PostGIS Point' : 'N/A'}
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <button
                                onClick={() => handleEditAddress(a)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg cursor-pointer inline-flex"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete('address', a.id)}
                                className="p-1.5 bg-slate-800 hover:bg-red-950/40 text-red-400 rounded-lg cursor-pointer inline-flex"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ==============================================
          MODAIS DOS FORMULÁRIOS (DRIVERS, ADDRESSES, ORDERS)
         ============================================== */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
            <div className="p-6 border-b border-slate-850 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {editId ? <Edit3 className="w-4 h-4 text-sky-400" /> : <Plus className="w-4 h-4 text-sky-400" />}
                {editId ? 'Editar' : 'Cadastrar'} {modalType === 'driver' ? 'Motorista' : modalType === 'address' ? 'Endereço/Cliente' : 'Frete/Pedido'}
              </h3>
              <button 
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-100 text-xs font-semibold py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {msg && (
                <div className={`p-3 rounded-xl text-xs flex gap-2 ${
                  msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {msg.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <ShieldAlert className="w-4 h-4 flex-shrink-0" />}
                  <span>{msg.text}</span>
                </div>
              )}

              {/* FORM MOTORISTA */}
              {modalType === 'driver' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nome do Motorista *</label>
                    <input
                      type="text"
                      required
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">CPF *</label>
                    <input
                      type="text"
                      required
                      value={driverCpf}
                      onChange={(e) => setDriverCpf(e.target.value)}
                      placeholder="Apenas números"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Validade CNH *</label>
                    <input
                      type="date"
                      required
                      value={driverCnh}
                      onChange={(e) => setDriverCnh(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Modelo do Veículo *</label>
                    <input
                      type="text"
                      required
                      value={vehModel}
                      onChange={(e) => setVehModel(e.target.value)}
                      placeholder="Ex: Mercedes Sprinter"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Placa do Veículo *</label>
                    <input
                      type="text"
                      required
                      value={vehPlate}
                      onChange={(e) => setVehPlate(e.target.value)}
                      placeholder="Ex: ABC1D23"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Carga Máxima (kg)</label>
                    <input
                      type="number"
                      value={vehWeight}
                      onChange={(e) => setVehWeight(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Volume Máximo (m³)</label>
                    <input
                      type="number"
                      value={vehVolume}
                      onChange={(e) => setVehVolume(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* FORM ENDEREÇO */}
              {modalType === 'address' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipo de Endereço *</label>
                    <select
                      value={addrType}
                      onChange={(e) => setAddrType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                    >
                      <option value="customer">Cliente Final (Destinatário)</option>
                      <option value="warehouse">Centro de Distribuição (Origem)</option>
                      <option value="company">Empresa Comercial (Multi-tenant)</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Logradouro / Rua *</label>
                    <input
                      type="text"
                      required
                      value={addrStreet}
                      onChange={(e) => setAddrStreet(e.target.value)}
                      placeholder="Ex: Av. Paulista, 1000"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cidade *</label>
                    <input
                      type="text"
                      required
                      value={addrCity}
                      onChange={(e) => setAddrCity(e.target.value)}
                      placeholder="Ex: São Paulo"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estado (UF) *</label>
                    <input
                      type="text"
                      required
                      value={addrState}
                      onChange={(e) => setAddrState(e.target.value)}
                      placeholder="Ex: SP"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">CEP *</label>
                    <input
                      type="text"
                      required
                      value={addrPostal}
                      onChange={(e) => setAddrPostal(e.target.value)}
                      placeholder="Ex: 01310-100"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latitude (Geolocalização) *</label>
                    <input
                      type="text"
                      required
                      value={addrLat}
                      onChange={(e) => setAddrLat(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Longitude (Geolocalização) *</label>
                    <input
                      type="text"
                      required
                      value={addrLng}
                      onChange={(e) => setAddrLng(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none font-mono"
                    />
                  </div>
                </div>
              )}

              {/* FORM PEDIDO/FRETE */}
              {modalType === 'order' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Endereço de Origem (Coleta) *</label>
                    <select
                      required
                      value={orderOriginId}
                      onChange={(e) => setOrderOriginId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none cursor-pointer"
                    >
                      <option value="">Selecione um Centro de Origem</option>
                      {addresses
                        .filter(a => a.address_type === 'warehouse' || a.address_type === 'company')
                        .map(a => (
                          <option key={a.id} value={a.id}>{a.street} ({a.city})</option>
                        ))
                      }
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Endereço de Destino (Entrega) *</label>
                    <select
                      required
                      value={orderDestId}
                      onChange={(e) => setOrderDestId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none cursor-pointer"
                    >
                      <option value="">Selecione o Cliente de Entrega</option>
                      {addresses
                        .filter(a => a.address_type === 'customer')
                        .map(a => (
                          <option key={a.id} value={a.id}>{a.street} ({a.city})</option>
                        ))
                      }
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Motorista Responsável</label>
                    <select
                      value={orderDriverId}
                      onChange={(e) => setOrderDriverId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none cursor-pointer"
                    >
                      <option value="">Não atribuído</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.vehicles?.plate || 'S/V'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Peso Total (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={orderWeight}
                        onChange={(e) => setOrderWeight(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Volume Total (m³)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={orderVolume}
                        onChange={(e) => setOrderVolume(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none"
                      />
                    </div>
                  </div>

                  {editId && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status do Pedido</label>
                      <select
                        value={orderStatus}
                        onChange={(e) => setOrderStatus(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none cursor-pointer"
                      >
                        <option value="pending">Pendente (pending)</option>
                        <option value="assigned">Atribuído (assigned)</option>
                        <option value="collecting">Coleta (collecting)</option>
                        <option value="in_transit">Em Trânsito (in_transit)</option>
                        <option value="delivered">Entregue (delivered)</option>
                        <option value="failed">Falhou (failed)</option>
                        <option value="cancelled">Cancelado (cancelled)</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sky-600/10 transition-all cursor-pointer"
              >
                {actionLoading ? 'Salvando...' : 'Confirmar e Salvar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
