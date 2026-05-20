'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { updateOrderStatus, uploadProofOfDelivery } from '@/app/actions/orders';
import { supabase } from '@/lib/supabaseClient';
import { 
  Play, 
  CheckCircle, 
  MapPin, 
  AlertCircle, 
  Navigation, 
  User, 
  Truck, 
  Package, 
  Camera, 
  Upload, 
  FileCheck,
  ChevronRight
} from 'lucide-react';
import MapDisplay from '@/components/MapDisplay';

interface Driver {
  id: string;
  name: string;
  cpf: string;
  vehicle_id: string;
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
  origin_address?: {
    street: string;
    city: string;
  } | null;
  destination_address?: {
    street: string;
    city: string;
  } | null;
}

export default function DriverDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const driverId = searchParams.get('driverId');

  // Hooks & Refs
  const { coordinates: realCoords, error: gpsError } = useCurrentLocation();
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Estados principais
  const [driver, setDriver] = useState<Driver | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRouting, setIsRouting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estado do simulador de movimento
  const [useSimulation, setUseSimulation] = useState(true);
  const [simStep, setSimStep] = useState(0);

  // Estados do upload de comprovante (POD)
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPOD, setUploadingPOD] = useState(false);

  // Caminho simulado (MASP para Parque Trianon, Av. Paulista, SP)
  const SIMULATED_PATH = [
    { lat: -23.561486, lng: -46.657635 }, // MASP (Start)
    { lat: -23.562286, lng: -46.658435 },
    { lat: -23.563086, lng: -46.659235 },
    { lat: -23.563886, lng: -46.660035 },
    { lat: -23.564686, lng: -46.660835 },
    { lat: -23.565486, lng: -46.661635 }, // Trianon (End)
  ];

  // Carregar dados do motorista e pedido ativo
  useEffect(() => {
    if (!driverId) {
      router.push('/');
      return;
    }

    const fetchDriverData = async () => {
      try {
        // Buscar motorista
        const { data: driverData, error: driverErr } = await supabase
          .from('drivers')
          .select('id, name, cpf, vehicle_id, vehicles(model, plate)')
          .eq('id', driverId)
          .single();

        if (driverErr) throw driverErr;
        setDriver(driverData as any);

        // Buscar ou atribuir um pedido disponível para testes
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .select(`
            id, status, weight_kg, volume_m3,
            origin_address:addresses!orders_origin_address_id_fkey(street, city),
            destination_address:addresses!orders_destination_address_id_fkey(street, city)
          `)
          .or(`status.eq.pending,status.eq.assigned,status.eq.in_transit`)
          .limit(1)
          .maybeSingle();

        if (orderErr) throw orderErr;

        if (orderData) {
          // Atribui o pedido ao motorista se estiver pendente
          if (orderData.status === 'pending' || orderData.status === 'assigned') {
            await supabase
              .from('orders')
              .update({ driver_id: driverId, status: 'assigned' })
              .eq('id', orderData.id);
            orderData.status = 'assigned';
          }
          setActiveOrder(orderData as any);
        }
      } catch (err: any) {
        setStatusMsg({ type: 'error', text: `Erro de carregamento: ${err.message || err}` });
      } finally {
        setLoading(false);
      }
    };

    fetchDriverData();
  }, [driverId, router]);

  // Limpar intervalo ao desmontar
  useEffect(() => {
    return () => {
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    };
  }, []);

  // Iniciar transmissão de rota
  const handleStartRoute = async () => {
    if (!activeOrder || !driver) return;

    try {
      // 1. Atualizar status no banco
      const res = await updateOrderStatus(activeOrder.id, 'in_transit');
      if (!res.success) {
        setStatusMsg({ type: 'error', text: res.message });
        return;
      }

      setActiveOrder(prev => prev ? { ...prev, status: 'in_transit' } : null);
      setIsRouting(true);
      setStatusMsg({ type: 'success', text: 'Rota iniciada! Transmitindo coordenadas.' });

      // Resetar contador do simulador
      setSimStep(0);

      // 2. Iniciar loop de transmissão a cada 10 segundos
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);

      trackingIntervalRef.current = setInterval(async () => {
        let currentLoc = realCoords;

        // Se simulação ativa, usar pontos da Av. Paulista
        if (useSimulation) {
          setSimStep(prevStep => {
            const nextStep = (prevStep + 1) % SIMULATED_PATH.length;
            currentLoc = SIMULATED_PATH[nextStep];
            return nextStep;
          });
        }

        if (currentLoc) {
          const wktPoint = `POINT(${currentLoc.lng} ${currentLoc.lat})`;
          const { error } = await supabase
            .from('tracking_events')
            .insert({
              order_id: activeOrder.id,
              driver_id: driver.id,
              location: wktPoint,
            });

          if (error) {
            console.error('Erro ao enviar coordenadas:', error);
          }
        }
      }, 10000);

    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Erro: ${err.message}` });
    }
  };

  // Tratar arquivo de imagem selecionado
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Registrar entrega finalizada (POD)
  const handleUploadPOD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo || !activeOrder) return;

    setUploadingPOD(true);
    setStatusMsg(null);

    const formData = new FormData();
    formData.append('orderId', activeOrder.id);
    formData.append('file', photo);

    try {
      const res = await uploadProofOfDelivery(formData);
      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message });
        setActiveOrder(prev => prev ? { ...prev, status: 'delivered' } : null);
        setIsRouting(false);
        if (trackingIntervalRef.current) {
          clearInterval(trackingIntervalRef.current);
          trackingIntervalRef.current = null;
        }
        setPhoto(null);
        setPhotoPreview(null);
      } else {
        setStatusMsg({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Erro no upload: ${err.message || err}` });
    } finally {
      setUploadingPOD(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Truck className="w-8 h-8 text-sky-400 animate-bounce" />
          <p className="text-sm text-slate-400">Carregando painel do motorista...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Header */}
      <header className="border-b border-slate-900 bg-slate-900/30 px-4 py-4 flex items-center justify-between sticky top-0 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Motorista</div>
            <div className="text-sm font-semibold text-slate-200">{driver?.name}</div>
          </div>
        </div>
        {driver?.vehicles && (
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Veículo</div>
            <div className="text-xs text-slate-300 font-medium">
              {driver.vehicles.model} • <span className="font-mono text-slate-200">{driver.vehicles.plate}</span>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-4 space-y-4 max-w-xl mx-auto w-full">
        
        {statusMsg && (
          <div className={`p-4 rounded-xl border text-sm flex gap-3 ${
            statusMsg.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {statusMsg.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {!activeOrder ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center">
            <Package className="w-10 h-10 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-300 mb-1">Nenhum Pedido Ativo</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
              Não existem novos pedidos de entrega atribuídos a você no momento.
            </p>
            <button 
              onClick={() => router.push('/')}
              className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-2.5 px-4 rounded-xl transition-all"
            >
              Voltar ao Início
            </button>
          </div>
        ) : (
          <>
            {/* Detalhes do Pedido Ativo */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-sky-400" />
                  <span className="text-xs text-slate-400 font-medium">Pedido:</span>
                  <span className="text-xs font-mono text-slate-200 font-semibold">{activeOrder.id.substring(0, 8)}...</span>
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  activeOrder.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  activeOrder.status === 'in_transit' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                  'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {activeOrder.status === 'assigned' && 'Atribuído'}
                  {activeOrder.status === 'in_transit' && 'Em Trânsito'}
                  {activeOrder.status === 'delivered' && 'Entregue'}
                </span>
              </div>

              {/* Endereços de Origem / Destino */}
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-[9px] top-1.5 bottom-1.5 w-[1.5px] bg-slate-800" />
                
                {/* Origem */}
                <div className="relative">
                  <div className="absolute -left-[22px] top-0.5 w-3 h-3 rounded-full bg-emerald-500 border border-slate-950" />
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Origem / Coleta</div>
                  <div className="text-xs font-medium text-slate-200 mt-0.5">{activeOrder.origin_address?.street}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{activeOrder.origin_address?.city}</div>
                </div>

                {/* Destino */}
                <div className="relative">
                  <div className="absolute -left-[22px] top-0.5 w-3 h-3 rounded-full bg-red-500 border border-slate-950" />
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Destino / Entrega</div>
                  <div className="text-xs font-medium text-slate-200 mt-0.5">{activeOrder.destination_address?.street}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{activeOrder.destination_address?.city}</div>
                </div>
              </div>

              {/* Métricas de Carga */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-900 text-xs">
                <div>
                  <span className="text-slate-500">Peso Total:</span>
                  <span className="font-semibold text-slate-300 ml-1.5">{activeOrder.weight_kg} kg</span>
                </div>
                <div>
                  <span className="text-slate-500">Volume Estimado:</span>
                  <span className="font-semibold text-slate-300 ml-1.5">{activeOrder.volume_m3} m³</span>
                </div>
              </div>
            </div>

            {/* Painel de Controles da Rota */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-4">
              <h3 className="text-sm font-bold text-slate-200">Ações de Rastreamento</h3>

              {activeOrder.status === 'assigned' && (
                <div className="space-y-4">
                  {/* Opção de Simulação */}
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-200 block">Simulador de Movimento GPS</span>
                      <span className="text-slate-500">Simula movimentação ao longo da Avenida Paulista</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={useSimulation} 
                        onChange={(e) => setUseSimulation(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-200 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <button
                    onClick={handleStartRoute}
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <Play className="w-4 h-4 fill-white" /> Iniciar Transmissão da Rota
                  </button>
                </div>
              )}

              {activeOrder.status === 'in_transit' && (
                <div className="space-y-4">
                  <div className="bg-sky-500/5 border border-sky-500/10 p-4 rounded-xl flex items-start gap-3">
                    <Navigation className="w-5 h-5 text-sky-400 flex-shrink-0 animate-pulse mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-sky-400 block">GPS Transmitindo em Tempo Real</span>
                      <span className="text-[11px] text-slate-400 leading-snug">
                        Sua localização está sendo atualizada a cada 10 segundos no painel público do cliente. Mantenha a tela ligada.
                      </span>
                    </div>
                  </div>

                  {/* Formulário de Finalização da Entrega (POD) */}
                  <form onSubmit={handleUploadPOD} className="space-y-4 pt-2 border-t border-slate-850">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Comprovar Conclusão da Entrega</h4>
                    
                    <div className="flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl p-4 bg-slate-950/40 relative">
                      {photoPreview ? (
                        <div className="relative w-full max-h-[160px] rounded-lg overflow-hidden flex justify-center">
                          <img src={photoPreview} alt="Comprovante" className="max-h-[160px] object-cover rounded-lg" />
                          <button
                            type="button"
                            onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                            className="absolute top-2 right-2 bg-slate-950/80 hover:bg-slate-900 text-xs px-2 py-1 rounded border border-slate-800"
                          >
                            Remover
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-2 py-4">
                          <Camera className="w-8 h-8 text-slate-500" />
                          <span className="text-xs text-slate-400">Tire ou anexe uma foto da entrega</span>
                          <span className="text-[10px] text-slate-600">Formatos suportados: PNG, JPG, GIF</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment"
                            onChange={handlePhotoChange}
                            required
                            className="hidden" 
                          />
                        </label>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={!photo || uploadingPOD}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      {uploadingPOD ? (
                        <>
                          <Upload className="w-4 h-4 animate-spin" />
                          Registrando comprovante...
                        </>
                      ) : (
                        <>
                          <FileCheck className="w-4 h-4" />
                          Finalizar e Entregar Pedido
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {activeOrder.status === 'delivered' && (
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-400">Entrega Concluída</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      O pedido foi entregue com sucesso e o comprovante visual foi devidamente registrado no Supabase.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push('/')}
                    className="bg-slate-900 hover:bg-slate-800 text-xs font-semibold py-2 px-4 rounded-lg border border-slate-800 transition-all text-slate-300"
                  >
                    Voltar para Home
                  </button>
                </div>
              )}
            </div>

            {/* Painel do Mapa Integrado (Exibe onde o motorista está no simulador/real) */}
            {activeOrder.status === 'in_transit' && (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-2 flex flex-col h-[280px]">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5" /> Monitoramento de Trajeto
                  </h3>
                  <span className="text-[10px] text-slate-500">Atualizado ao vivo</span>
                </div>
                <div className="flex-grow rounded-xl overflow-hidden relative border border-slate-950">
                  <MapDisplay 
                    orderId={activeOrder.id} 
                    initialDriverLocation={useSimulation ? SIMULATED_PATH[simStep] : realCoords} 
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
