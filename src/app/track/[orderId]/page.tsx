'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  MapPin, 
  Clock, 
  Truck, 
  User, 
  CheckCircle, 
  ArrowLeft, 
  ShieldAlert, 
  Calendar,
  Image as ImageIcon
} from 'lucide-react';
import MapDisplay from '@/components/MapDisplay';

interface PageProps {
  params: Promise<{
    orderId: string;
  }>;
}

interface Address {
  street: string;
  city: string;
  state: string;
}

interface Driver {
  name: string;
  vehicles?: {
    model: string;
    plate: string;
  } | null;
}

interface Order {
  id: string;
  status: string;
  weight_kg: number;
  volume_m3: number;
  origin_address?: Address | null;
  destination_address?: Address | null;
  drivers?: Driver | null;
}

interface StatusHistory {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
}

export default function TrackOrderPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const orderId = resolvedParams.orderId;

  // Estados
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [proof, setProof] = useState<{ photo_url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carregar dados iniciais e assinar atualizações
  useEffect(() => {
    if (!orderId) return;

    const fetchOrderData = async () => {
      try {
        // 1. Buscar pedido
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .select(`
            id, status, weight_kg, volume_m3,
            origin_address:addresses!orders_origin_address_id_fkey(street, city, state),
            destination_address:addresses!orders_destination_address_id_fkey(street, city, state),
            drivers(name, vehicles(model, plate))
          `)
          .eq('id', orderId)
          .maybeSingle();

        if (orderErr) throw orderErr;
        if (!orderData) {
          setErrorMsg('Pedido não encontrado. Verifique se o código está correto.');
          setLoading(false);
          return;
        }

        setOrder(orderData as any);

        // 2. Buscar histórico de status
        const { data: historyData, error: histErr } = await supabase
          .from('order_status_history')
          .select('id, from_status, to_status, changed_at')
          .eq('order_id', orderId)
          .order('changed_at', { ascending: false });

        if (histErr) throw histErr;
        setHistory(historyData || []);

        // 3. Buscar comprovante de entrega se já finalizado
        if (orderData.status === 'delivered') {
          const { data: proofData } = await supabase
            .from('proofs_of_delivery')
            .select('photo_url')
            .eq('order_id', orderId)
            .maybeSingle();
          setProof(proofData);
        }

      } catch (err: any) {
        setErrorMsg(`Erro ao carregar dados de rastreamento: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();

    // 4. Assinar mudanças no Pedido (Status) em tempo real
    const orderSubscription = supabase
      .channel(`order-changes:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        async (payload) => {
          const updatedOrder = payload.new as any;
          setOrder((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              status: updatedOrder.status,
            };
          });

          // Se mudou para entregue, buscar o comprovante
          if (updatedOrder.status === 'delivered') {
            const { data: proofData } = await supabase
              .from('proofs_of_delivery')
              .select('photo_url')
              .eq('order_id', orderId)
              .maybeSingle();
            setProof(proofData);
          }

          // Recarregar histórico de status
          const { data: historyData } = await supabase
            .from('order_status_history')
            .select('id, from_status, to_status, changed_at')
            .eq('order_id', orderId)
            .order('changed_at', { ascending: false });
          setHistory(historyData || []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderSubscription);
    };
  }, [orderId]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Aguardando Coleta';
      case 'assigned': return 'Atribuído ao Motorista';
      case 'collecting': return 'Coletando Carga';
      case 'in_transit': return 'Em Trânsito / Rota de Entrega';
      case 'delivered': return 'Entregue com Sucesso';
      case 'failed': return 'Falha na Entrega';
      case 'cancelled': return 'Cancelado';
      case 'returned': return 'Devolvido ao Remetente';
      default: return status;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'in_transit':
        return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
      case 'failed':
      case 'cancelled':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Truck className="w-8 h-8 text-sky-400 animate-bounce" />
          <p className="text-sm text-slate-400">Carregando painel de rastreamento...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-xl">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-200">Ops! Algo deu errado</h2>
          <p className="text-sm text-slate-400">{errorMsg}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-slate-800 hover:bg-slate-700 text-sm font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-900 bg-slate-900/30 px-4 py-4 sticky top-0 backdrop-blur-md z-20 flex items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-850"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Painel Geral
        </button>
        <div className="text-xs text-slate-400">
          Pedido: <span className="font-mono text-slate-200 font-semibold">{orderId.substring(0, 8)}...</span>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-grow p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LADO ESQUERDO: Mapa de Acompanhamento (Lg: 7 colunas) */}
        <div className="lg:col-span-7 h-[360px] md:h-[450px] lg:h-full min-h-[360px] flex flex-col">
          <div className="bg-slate-900/30 border border-slate-900 p-2 rounded-2xl flex-grow relative overflow-hidden flex items-stretch">
            <MapDisplay orderId={orderId} />
          </div>
        </div>

        {/* LADO DIREITO: Informações e Status (Lg: 5 colunas) */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          
          <div className="space-y-4">
            {/* Bloco de Status Atual */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Status da Entrega</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${getStatusBadgeClass(order?.status || '')}`}>
                  {getStatusText(order?.status || '')}
                </span>
              </div>

              {/* Barra de Progresso Simples */}
              <div className="relative pt-2">
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-1000 ${
                    order?.status === 'delivered' ? 'w-full' :
                    order?.status === 'in_transit' ? 'w-2/3' :
                    order?.status === 'assigned' || order?.status === 'collecting' ? 'w-1/3' :
                    'w-[10%]'
                  }`} />
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 uppercase font-semibold mt-1.5">
                  <span>Atribuído</span>
                  <span>Em Trânsito</span>
                  <span>Entregue</span>
                </div>
              </div>
            </div>

            {/* Detalhes do Motorista / Veículo */}
            {order?.drivers ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-sky-400" /> Detalhes do Portador
                </h3>
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center text-slate-300 border border-slate-850">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{order.drivers.name}</div>
                    {order.drivers.vehicles && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        {order.drivers.vehicles.model} • Placa: <span className="font-mono font-semibold text-slate-300 uppercase">{order.drivers.vehicles.plate}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-5 text-center text-xs text-slate-500 shadow-md">
                Aguardando motorista aceitar a solicitação de trânsito.
              </div>
            )}

            {/* Endereços de Origem e Destino */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-sky-400" /> Rota de Distribuição
              </h3>
              
              <div className="relative pl-5 space-y-3 text-xs">
                <div className="absolute left-[5.5px] top-1.5 bottom-1.5 w-[1.5px] bg-slate-800" />
                <div>
                  <div className="absolute -left-[18px] top-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-slate-950" />
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Origem</span>
                  <span className="text-slate-300 font-medium">{order?.origin_address?.street}</span>
                  <span className="text-slate-500 block text-[10px] mt-0.5">{order?.origin_address?.city}, {order?.origin_address?.state}</span>
                </div>
                <div>
                  <div className="absolute -left-[18px] top-0.5 w-2 h-2 rounded-full bg-red-500 border border-slate-950" />
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Destino</span>
                  <span className="text-slate-300 font-medium">{order?.destination_address?.street}</span>
                  <span className="text-slate-500 block text-[10px] mt-0.5">{order?.destination_address?.city}, {order?.destination_address?.state}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Histórico / Linha do Tempo e Prova de Entrega (POD) */}
          <div className="space-y-4 pt-2">
            
            {/* Bloco de Comprovante de Entrega se já Entregue */}
            {order?.status === 'delivered' && proof && (
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 space-y-3 shadow-md">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4" /> Comprovante Visual (POD)
                </h4>
                <div className="rounded-lg overflow-hidden border border-emerald-500/20 max-h-[140px] flex justify-center bg-slate-950">
                  <img 
                    src={proof.photo_url} 
                    alt="Assinatura/Comprovante" 
                    className="max-h-[140px] object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <a 
                  href={proof.photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-semibold text-sky-400 hover:underline block text-center uppercase tracking-wider"
                >
                  Abrir imagem em alta definição
                </a>
              </div>
            )}

            {/* Linha do Tempo de Status (Auditoria) */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md max-h-[220px] overflow-y-auto">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-sky-400" /> Histórico de Eventos
              </h3>

              {history.length > 0 ? (
                <div className="space-y-4 relative pl-4 text-xs">
                  <div className="absolute left-[3px] top-1.5 bottom-1.5 w-[1px] bg-slate-800" />
                  
                  {history.map((event) => (
                    <div key={event.id} className="relative">
                      <div className="absolute -left-[16px] top-1 w-1.5 h-1.5 rounded-full bg-sky-500 border border-slate-950" />
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{getStatusText(event.to_status)}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(event.changed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Nenhum evento registrado ainda.</p>
              )}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
