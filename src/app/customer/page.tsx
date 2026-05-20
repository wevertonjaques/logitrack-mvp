'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  User, 
  Package, 
  MapPin, 
  Truck, 
  LogOut, 
  Clock, 
  CheckCircle2, 
  Map, 
  Calendar,
  Layers
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf_cnpj: string;
}

interface Order {
  id: string;
  status: string;
  weight_kg: number;
  volume_m3: number;
  created_at: string;
  companies?: { name: string } | null;
  drivers?: { 
    name: string;
    vehicles?: { plate: string; model: string } | null;
  } | null;
  origin?: { street: string; city: string } | null;
  destination?: { street: string; city: string } | null;
}

export default function CustomerDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-sans">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Carregando painel do cliente...</p>
        </div>
      </div>
    }>
      <CustomerDashboardContent />
    </Suspense>
  );
}

function CustomerDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const customerId = searchParams.get('customerId');

  // Estados
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Buscar dados do cliente
        const { data: custData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();
        
        setCustomer(custData);

        // 2. Buscar pedidos destinados a este cliente
        const { data: ordData, error } = await supabase
          .from('orders')
          .select(`
            id,
            status,
            weight_kg,
            volume_m3,
            created_at,
            companies(name),
            drivers(
              name,
              vehicles(plate, model)
            ),
            origin:addresses!orders_origin_address_id_fkey(street, city),
            destination:addresses!orders_destination_address_id_fkey(street, city)
          `)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false });

        if (!error && ordData) {
          const formatted = ordData.map((o: any) => {
            const driverObj = Array.isArray(o.drivers) ? o.drivers[0] : o.drivers;
            const companyObj = Array.isArray(o.companies) ? o.companies[0] : o.companies;
            const originObj = Array.isArray(o.origin) ? o.origin[0] : o.origin;
            const destinationObj = Array.isArray(o.destination) ? o.destination[0] : o.destination;

            // Handle vehicles nested inside drivers
            let finalDriver = null;
            if (driverObj) {
              const vehicleObj = Array.isArray(driverObj.vehicles) ? driverObj.vehicles[0] : driverObj.vehicles;
              finalDriver = {
                ...driverObj,
                vehicles: vehicleObj || null
              };
            }

            return {
              id: o.id,
              status: o.status,
              weight_kg: o.weight_kg,
              volume_m3: o.volume_m3,
              created_at: o.created_at,
              companies: companyObj || null,
              drivers: finalDriver,
              origin: originObj || null,
              destination: destinationObj || null,
            };
          });
          setOrders(formatted as any);
        }
      } catch (err) {
        console.error('Erro ao buscar dados do cliente:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [customerId]);

  const handleLogout = () => {
    localStorage.removeItem('logitrack_user_role');
    localStorage.removeItem('logitrack_customer_id');
    router.push('/login');
  };

  // Renderizar a linha do tempo de status de forma visual
  const renderStatusTimeline = (status: string) => {
    const steps = [
      { key: 'pending', label: 'Pendente', desc: 'Aguardando despacho' },
      { key: 'in_transit', label: 'Em Trânsito', desc: 'Pacote na estrada' },
      { key: 'delivered', label: 'Entregue', desc: 'Finalizado com POD' }
    ];

    let activeIndex = 0;
    if (status === 'in_transit') activeIndex = 1;
    if (status === 'delivered') activeIndex = 2;

    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 p-4 bg-slate-950/40 border border-slate-900 rounded-2xl">
        {steps.map((step, idx) => {
          const isCompleted = idx <= activeIndex;
          const isActive = idx === activeIndex;
          
          return (
            <div key={step.key} className="flex items-center gap-3 sm:flex-col sm:items-center sm:text-center flex-1 w-full last:flex-initial">
              <div className="flex items-center gap-3 w-full sm:flex-col sm:items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border font-bold text-xs ${
                  isCompleted 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                {idx < steps.length - 1 && (
                  <div className={`hidden sm:block h-0.5 flex-1 w-full mx-2 ${
                    idx < activeIndex ? 'bg-emerald-500/30' : 'bg-slate-900'
                  }`} />
                )}
              </div>
              <div className="text-left sm:text-center mt-0.5 sm:mt-2">
                <p className={`text-xs font-semibold ${isCompleted ? 'text-slate-200' : 'text-slate-500'}`}>
                  {step.label}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-sans">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Carregando painel do cliente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans bg-grid-slate-900 pb-12">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-900/20 backdrop-blur-md sticky top-0 z-35 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/15">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100 leading-none">{customer?.name}</h1>
              <p className="text-xs text-slate-450 mt-1">Cliente Final • CPF/CNPJ: {customer?.cpf_cnpj}</p>
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-8 space-y-8">
        
        {/* Intro */}
        <section className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-sky-400" /> Minhas Encomendas
          </h2>
          <p className="text-xs text-slate-400">
            Acompanhe o status e a localização em tempo real de todas as mercadorias destinadas a você.
          </p>
        </section>

        {/* Lista de Pedidos */}
        {orders.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/10 border border-dashed border-slate-850 rounded-3xl text-slate-500 space-y-3">
            <Package className="w-8 h-8 text-slate-650 mx-auto" />
            <p className="text-sm font-medium">Nenhum pedido localizado para este CPF/CNPJ no sistema.</p>
            <p className="text-xs text-slate-600">Peça para a empresa de logística despachar uma encomenda associada a você.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div 
                key={order.id} 
                className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 hover:border-slate-800 transition-all shadow-xl space-y-5"
              >
                {/* Cabeçalho da Ordem */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-900/60">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Identificador da Entrega</span>
                    <span className="font-mono text-xs text-slate-200 select-all font-semibold">{order.id}</span>
                  </div>
                  
                  {order.status !== 'pending' && (
                    <button
                      onClick={() => router.push(`/track/${order.id}`)}
                      className="w-full sm:w-auto bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-sky-600/10"
                    >
                      <Map className="w-3.5 h-3.5" /> Rastrear ao Vivo no Mapa
                    </button>
                  )}
                </div>

                {/* Detalhes Técnicos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1 bg-slate-950/20 p-3 rounded-xl border border-slate-900/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Transportadora</span>
                    <span className="font-semibold text-slate-300">{order.companies?.name || 'LogiTrack Logística'}</span>
                  </div>

                  <div className="space-y-1 bg-slate-950/20 p-3 rounded-xl border border-slate-900/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Origem de Coleta</span>
                    <span className="font-semibold text-slate-350 truncate block" title={order.origin?.street}>
                      {order.origin?.street.split('-')[0]}
                    </span>
                  </div>

                  <div className="space-y-1 bg-slate-950/20 p-3 rounded-xl border border-slate-900/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Motorista Atribuído</span>
                    <span className="font-semibold text-slate-350 block">
                      {order.drivers?.name ? (
                        <span className="flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-emerald-400" />
                          {order.drivers.name} ({order.drivers.vehicles?.plate})
                        </span>
                      ) : (
                        <span className="text-amber-500 font-medium">Aguardando motorista</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Linha do Tempo de Progresso */}
                {renderStatusTimeline(order.status)}

                {/* Data e Detalhes da Carga */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 px-1 pt-1">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Lançado em {new Date(order.created_at).toLocaleDateString('pt-BR')} às {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>Peso: {order.weight_kg} KG</span>
                    <span>Volume: {order.volume_m3} M³</span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
