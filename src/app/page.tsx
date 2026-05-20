'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDriver } from '@/app/actions/createDriver';
import { seedDemoData } from '@/app/actions/orders';
import { MapPin, Truck, User, Search, RefreshCw, AlertCircle, CheckCircle2, Package } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [trackingId, setTrackingId] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [submittingDriver, setSubmittingDriver] = useState(false);
  
  // Mensagens de status
  const [seedStatus, setSeedStatus] = useState<{ success?: boolean; message?: string; orderId?: string } | null>(null);
  const [driverStatus, setDriverStatus] = useState<{ success?: boolean; message?: string; driverId?: string } | null>(null);

  // Manipular busca de código de rastreamento
  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingId.trim()) {
      router.push(`/track/${trackingId.trim()}`);
    }
  };

  // Manipular seeding de dados demo
  const handleSeed = async () => {
    setSeeding(true);
    setSeedStatus(null);
    try {
      const res = await seedDemoData();
      setSeedStatus(res);
      if (res.success && res.orderId) {
        setTrackingId(res.orderId);
      }
    } catch (err: any) {
      setSeedStatus({ success: false, message: err.message || 'Erro ao gerar dados' });
    } finally {
      setSeeding(false);
    }
  };

  // Manipular cadastro de motorista
  const handleDriverSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittingDriver(true);
    setDriverStatus(null);
    
    const formData = new FormData(e.currentTarget);
    try {
      const res = await createDriver(formData);
      setDriverStatus(res);
      if (res.success && res.driverId) {
        // Redireciona para o painel do motorista passando o driverId
        setTimeout(() => {
          router.push(`/driver?driverId=${res.driverId}`);
        }, 1500);
      }
    } catch (err: any) {
      setDriverStatus({ success: false, message: err.message || 'Erro ao cadastrar' });
    } finally {
      setSubmittingDriver(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 bg-grid-slate-900 font-sans selection:bg-sky-500/30 relative">
      
      {/* Top Navbar */}
      <header className="w-full max-w-5xl flex items-center justify-between py-4 mb-6 border-b border-slate-900">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-sky-400" />
          <span className="font-bold text-slate-200 text-sm tracking-tight">LogiTrack</span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push('/login')}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 py-2 px-4 rounded-xl hover:bg-slate-900 transition-all cursor-pointer"
          >
            Entrar
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="text-xs font-semibold bg-sky-950/40 text-sky-400 hover:text-sky-300 py-2.5 px-4 rounded-xl border border-sky-900/30 hover:bg-sky-900/10 transition-all cursor-pointer"
          >
            Painel Admin
          </button>
        </div>
      </header>

      {/* Header / Brand */}
      <div className="text-center mb-10 max-w-xl animate-fade-in mt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold mb-4">
          <Truck className="w-3.5 h-3.5" /> LogiTrack MVP
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400 mb-4">
          Rastreamento Inteligente em Tempo Real
        </h1>
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
          Plataforma de logística integrada para motoristas e clientes. Acompanhe a entrega com geolocalização ao vivo de ponta a ponta.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl items-stretch mb-12">
        
        {/* Painel do Cliente - Rastrear Pedido */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:border-slate-700/60 transition-all duration-300 shadow-xl">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400 mb-6">
              <MapPin className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-slate-100">Portal do Cliente</h2>
            <p className="text-sm text-slate-400 mb-6">
              Insira o código identificador do pedido para visualizar o trajeto e a posição do motorista em tempo real no mapa.
            </p>

            <form onSubmit={handleTrackSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Código de Rastreamento (Order UUID)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="ex: 8b26-5ab2e29039a6..."
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/60 text-slate-100 text-sm px-4 py-3 pl-11 rounded-xl outline-none transition-all font-mono"
                  />
                  <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-sky-500/10 transition-all flex items-center justify-center gap-2"
              >
                Rastrear Agora
              </button>
            </form>
          </div>

          {/* Seção Quick Seed para Testes */}
          <div className="mt-8 pt-8 border-t border-slate-800/80">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Ambientes de Teste
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Não possui um código? Clique abaixo para gerar automaticamente uma simulação com rota pela Av. Paulista e obter um código válido.
            </p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="w-full sm:w-auto bg-slate-850 hover:bg-slate-800 text-xs font-medium text-sky-400 hover:text-sky-300 py-2.5 px-4 rounded-lg border border-slate-800 flex items-center justify-center gap-2 transition-all"
            >
              {seeding ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Gerando Pedido...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Gerar Pedido & Rota Demo
                </>
              )}
            </button>

            {seedStatus && (
              <div className={`mt-3 p-3 rounded-lg border text-xs flex gap-2 ${
                seedStatus.success 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {seedStatus.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <div>
                  <p className="font-semibold">{seedStatus.message || 'Pedido demo criado!'}</p>
                  {seedStatus.orderId && (
                    <p className="mt-1">
                      Código: <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded text-slate-200 select-all">{seedStatus.orderId}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Portal do Motorista - Cadastro / Acesso */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:border-slate-700/60 transition-all duration-300 shadow-xl">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-6">
              <User className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-slate-100">Portal do Motorista</h2>
            <p className="text-sm text-slate-400 mb-6">
              Cadastre seu perfil e veículo de trabalho para acessar o painel de entrega e iniciar a transmissão de coordenadas.
            </p>

            <form onSubmit={handleDriverSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="João Silva"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 text-slate-100 text-sm px-4 py-2.5 rounded-xl outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                    CPF
                  </label>
                  <input
                    type="text"
                    name="cpf"
                    required
                    placeholder="123.456.789-00"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 text-slate-100 text-sm px-4 py-2.5 rounded-xl outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                    Vencimento da CNH
                  </label>
                  <input
                    type="date"
                    name="cnhExpiresAt"
                    required
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 text-slate-100 text-sm px-4 py-2.5 rounded-xl outline-none transition-all text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                    Modelo do Veículo
                  </label>
                  <input
                    type="text"
                    name="vehicleModel"
                    required
                    placeholder="Fiorino 1.4"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 text-slate-100 text-sm px-4 py-2.5 rounded-xl outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                    Placa do Veículo
                  </label>
                  <input
                    type="text"
                    name="vehiclePlate"
                    required
                    placeholder="ABC-1234"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 text-slate-100 text-sm px-4 py-2.5 rounded-xl outline-none transition-all uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                    Carga Máxima (KG)
                  </label>
                  <input
                    type="number"
                    name="maxWeightKg"
                    placeholder="1000"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 text-slate-100 text-sm px-4 py-2.5 rounded-xl outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingDriver}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-emerald-500/10 transition-all flex items-center justify-center gap-2"
              >
                {submittingDriver ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  'Cadastrar e Entrar'
                )}
              </button>
            </form>
          </div>

          {driverStatus && (
            <div className={`mt-6 p-4 rounded-xl border text-sm flex gap-2 ${
              driverStatus.success 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {driverStatus.success ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <div>
                <p className="font-semibold">{driverStatus.message}</p>
                {driverStatus.success && <p className="text-xs text-slate-400 mt-1">Redirecionando para o painel do motorista...</p>}
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
