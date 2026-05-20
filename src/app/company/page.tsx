'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { createOrder } from '@/app/actions/orders';
import { 
  Building2, 
  Plus, 
  Truck, 
  MapPin, 
  User, 
  Package, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  LogOut, 
  AlertCircle,
  Eye
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
}

interface Driver {
  id: string;
  name: string;
}

interface Address {
  id: string;
  street: string;
  city: string;
  address_type: string;
}

interface Order {
  id: string;
  status: string;
  weight_kg: number;
  volume_m3: number;
  created_at: string;
  drivers?: { name: string } | null;
  customers?: { name: string } | null;
  origin?: { street: string; city: string } | null;
  destination?: { street: string; city: string } | null;
}

export default function CompanyDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-sans">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Carregando painel do embarcador...</p>
        </div>
      </div>
    }>
      <CompanyDashboardContent />
    </Suspense>
  );
}

function CompanyDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const companyId = searchParams.get('companyId');

  // Estados
  const [company, setCompany] = useState<Company | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form states
  const [originId, setOriginId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [weight, setWeight] = useState('');
  const [volume, setVolume] = useState('');

  useEffect(() => {
    if (!companyId) {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Buscar empresa
        const { data: compData } = await supabase
          .from('companies')
          .select('id, name')
          .eq('id', companyId)
          .single();
        setCompany(compData);

        // 2. Buscar motoristas
        const { data: drvData } = await supabase
          .from('drivers')
          .select('id, name')
          .order('name');
        setDrivers(drvData || []);

        // 3. Buscar clientes
        const { data: custData } = await supabase
          .from('customers')
          .select('id, name')
          .order('name');
          
        setCustomers(custData || []);

        // 4. Buscar endereços de CD/Warehouse (Origens possíveis)
        const { data: addrData } = await supabase
          .from('addresses')
          .select('id, street, city, address_type')
          .in('address_type', ['warehouse', 'company'])
          .order('street');
        setWarehouses(addrData || []);
        if (addrData && addrData.length > 0) {
          setOriginId(addrData[0].id);
        }

        // 5. Buscar pedidos da empresa
        await fetchOrders();
      } catch (err) {
        console.error('Erro ao inicializar dashboard da empresa:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [companyId]);

  const fetchOrders = async () => {
    const { data: ordData, error } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        weight_kg,
        volume_m3,
        created_at,
        drivers(name),
        customers(name),
        origin:addresses!orders_origin_address_id_fkey(street, city),
        destination:addresses!orders_destination_address_id_fkey(street, city)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (!error && ordData) {
      const formatted = ordData.map((o: any) => ({
        id: o.id,
        status: o.status,
        weight_kg: o.weight_kg,
        volume_m3: o.volume_m3,
        created_at: o.created_at,
        drivers: Array.isArray(o.drivers) ? o.drivers[0] : o.drivers,
        customers: Array.isArray(o.customers) ? o.customers[0] : o.customers,
        origin: Array.isArray(o.origin) ? o.origin[0] : o.origin,
        destination: Array.isArray(o.destination) ? o.destination[0] : o.destination,
      }));
      setOrders(formatted as any);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingOrder(true);
    setFormError(null);
    setFormSuccess(null);

    // Encontrar o endereço do cliente destino
    let destinationId = '';
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('address_id')
        .eq('id', customerId)
        .single();
      
      if (!customer || !customer.address_id) {
        setFormError('Este cliente não possui um endereço cadastrado.');
        setSubmittingOrder(false);
        return;
      }
      destinationId = customer.address_id;
    } catch (err) {
      setFormError('Erro ao recuperar endereço do cliente.');
      setSubmittingOrder(false);
      return;
    }

    const formData = new FormData();
    formData.append('companyId', companyId as string);
    formData.append('customerId', customerId);
    formData.append('driverId', driverId);
    formData.append('originAddressId', originId);
    formData.append('destinationAddressId', destinationId);
    formData.append('weightKg', weight);
    formData.append('volumeM3', volume);
    formData.append('status', 'pending');

    try {
      const res = await createOrder(formData);
      if (res.success) {
        setFormSuccess('Frete/Pedido criado com sucesso!');
        setWeight('');
        setVolume('');
        setDriverId('');
        setCustomerId('');
        await fetchOrders();
      } else {
        setFormError(res.message);
      }
    } catch (err: any) {
      setFormError(err.message || 'Erro de conexão.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('logitrack_user_role');
    localStorage.removeItem('logitrack_company_id');
    router.push('/login');
  };

  // Métricas
  const kpis = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    inTransit: orders.filter(o => o.status === 'in_transit').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-sans">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Carregando painel do embarcador...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans bg-grid-slate-900 pb-12">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-900/20 backdrop-blur-md sticky top-0 z-35 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/15">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100 leading-none">{company?.name}</h1>
              <p className="text-xs text-slate-450 mt-1">Parceiro Embarcador / Logística</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-850 px-3.5 py-2 rounded-xl border border-slate-850 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 space-y-8">
        
        {/* KPI Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-800 transition-all">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Despachados</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold">{kpis.total}</span>
              <span className="text-xs text-slate-500">fretes</span>
            </div>
          </div>

          <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-800 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-550">Aguardando Coleta</span>
              <Clock className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-sky-400">{kpis.pending}</span>
              <span className="text-xs text-slate-500">pendentes</span>
            </div>
          </div>

          <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-800 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-550">Em Trânsito</span>
              <Truck className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-teal-400">{kpis.inTransit}</span>
              <span className="text-xs text-slate-500">na estrada</span>
            </div>
          </div>

          <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-800 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-550">Entregas Concluídas</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-emerald-400">{kpis.delivered}</span>
              <span className="text-xs text-slate-500">concluídos</span>
            </div>
          </div>
        </section>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Novo Frete Form */}
          <div className="lg:col-span-1 bg-slate-900/40 border border-slate-850 rounded-3xl p-6 backdrop-blur-md shadow-xl space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                <Plus className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-lg font-bold text-slate-100">Lançar Novo Frete</h2>
            </div>

            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateOrder} className="space-y-4">
              {/* Origem (CD / Warehouse) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450 block">Ponto de Coleta (Origem)</label>
                <div className="relative">
                  <select
                    value={originId}
                    onChange={(e) => setOriginId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 outline-none appearance-none cursor-pointer"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id} className="bg-slate-950">
                        {w.street} ({w.city})
                      </option>
                    ))}
                  </select>
                  <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              {/* Cliente Final (Destino) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450 block">Cliente Destinatário</label>
                <div className="relative">
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 outline-none appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-slate-950 text-slate-550">Selecionar destinatário...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-950">
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              {/* Motorista Atribuído */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450 block">Atribuir Motorista</label>
                <div className="relative">
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 outline-none appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-slate-950 text-slate-550">Sem motorista (Pendente)...</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-950">
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <Truck className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              {/* Peso e Volume */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450 block">Peso (KG)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="ex: 12.50"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450 block">Volume (M³)</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    placeholder="ex: 0.05"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingOrder || !customerId}
                className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-550 text-white text-xs font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-sky-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                {submittingOrder ? 'Criando Frete...' : 'Criar e Despachar'}
              </button>
            </form>
          </div>

          {/* Listagem de Ordens */}
          <div className="lg:col-span-2 bg-slate-900/40 border border-slate-850 rounded-3xl p-6 backdrop-blur-md shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
                  <Package className="w-4.5 h-4.5" />
                </div>
                <h2 className="text-lg font-bold text-slate-100">Remessas Enviadas</h2>
              </div>
              <span className="text-xs text-slate-450">{orders.length} pedidos encontrados</span>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-850 rounded-2xl text-slate-500">
                <p className="text-xs">Nenhum frete despachado por esta empresa até o momento.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                      <th className="py-3 px-2">Código</th>
                      <th className="py-3 px-2">Destinatário</th>
                      <th className="py-3 px-2">Rota (Origem → Destino)</th>
                      <th className="py-3 px-2">Motorista</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-slate-900/50 hover:bg-slate-900/30 transition-all">
                        <td className="py-3.5 px-2 font-mono text-slate-400 select-all max-w-[80px] truncate" title={o.id}>
                          {o.id.substring(0, 8)}...
                        </td>
                        <td className="py-3.5 px-2 font-semibold text-slate-200">
                          {o.customers?.name || 'Cliente Demo'}
                        </td>
                        <td className="py-3.5 px-2 text-slate-400 max-w-[200px] truncate" title={`${o.origin?.street} → ${o.destination?.street}`}>
                          {o.origin?.street.split(',')[0]} → {o.destination?.street.split(',')[0]}
                        </td>
                        <td className="py-3.5 px-2 text-slate-350">
                          {o.drivers?.name ? (
                            <span className="flex items-center gap-1.5">
                              <Truck className="w-3 h-3 text-slate-500" />
                              {o.drivers.name.split(' ')[0]}
                            </span>
                          ) : (
                            <span className="text-amber-500/80 font-medium">Aguardando...</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            o.status === 'delivered'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : o.status === 'in_transit'
                              ? 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                              : o.status === 'pending'
                              ? 'bg-slate-800 border-slate-700 text-slate-300'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}>
                            {o.status === 'pending' && 'Pendente'}
                            {o.status === 'in_transit' && 'Em Trânsito'}
                            {o.status === 'delivered' && 'Entregue'}
                            {o.status === 'assigned' && 'Atribuído'}
                            {o.status === 'collecting' && 'Coletando'}
                            {o.status === 'failed' && 'Falhou'}
                            {o.status === 'cancelled' && 'Cancelado'}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          <button
                            onClick={() => router.push(`/track/${o.id}`)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-400 hover:text-sky-300 bg-sky-950/30 hover:bg-sky-950/60 border border-sky-900/30 py-1 px-2.5 rounded-lg transition-all cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> Rastrear
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  );
}
