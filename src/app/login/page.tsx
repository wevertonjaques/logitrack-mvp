'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Lock, Truck, Shield, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  cpf: string;
}

export default function LoginPage() {
  const router = useRouter();

  // Estados
  const [role, setRole] = useState<'admin' | 'driver'>('admin');
  const [password, setPassword] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [loading, setLoading] = useState(false);
  const [driversLoading, setDriversLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carregar motoristas cadastrados se a role for driver
  useEffect(() => {
    if (role === 'driver') {
      const fetchDrivers = async () => {
        setDriversLoading(true);
        setErrorMsg(null);
        try {
          const { data, error } = await supabase
            .from('drivers')
            .select('id, name, cpf')
            .order('name');
          
          if (error) throw error;
          
          setDrivers(data || []);
          if (data && data.length > 0) {
            setSelectedDriverId(data[0].id);
          }
        } catch (err: any) {
          setErrorMsg('Erro ao carregar motoristas. Verifique se o schema do banco foi instalado.');
        } finally {
          setDriversLoading(false);
        }
      };
      fetchDrivers();
    }
  }, [role]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // Pequena pausa para efeito de carregamento premium
    await new Promise((resolve) => setTimeout(resolve, 600));

    if (role === 'admin') {
      if (password === 'admin123') {
        localStorage.setItem('logitrack_user_role', 'admin');
        router.push('/admin');
      } else {
        setErrorMsg('Senha administrativa incorreta. Use "admin123".');
        setLoading(false);
      }
    } else {
      if (!selectedDriverId) {
        setErrorMsg('Por favor, selecione um motorista ou cadastre um no painel administrativo.');
        setLoading(false);
        return;
      }
      localStorage.setItem('logitrack_user_role', 'driver');
      localStorage.setItem('logitrack_driver_id', selectedDriverId);
      router.push(`/driver?driverId=${selectedDriverId}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Detalhes de Background Decorativo (Sem roxo, apenas Emerald/Sky) */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl relative z-10 space-y-6">
        
        {/* Logo/Icon */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-emerald-400 p-0.5 mx-auto shadow-lg shadow-sky-500/15">
            <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-sky-400" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">LogiTrack</h1>
            <p className="text-xs text-slate-400 mt-1">Selecione seu perfil de acesso para entrar no sistema</p>
          </div>
        </div>

        {/* Seleção de Perfil */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-850">
          <button
            type="button"
            onClick={() => { setRole('admin'); setErrorMsg(null); }}
            className={`py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              role === 'admin' 
                ? 'bg-slate-800 text-slate-100 shadow-md border border-slate-700/50' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" /> Administrador
          </button>
          <button
            type="button"
            onClick={() => { setRole('driver'); setErrorMsg(null); }}
            className={`py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              role === 'driver' 
                ? 'bg-slate-800 text-slate-100 shadow-md border border-slate-700/50' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" /> Motorista
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex gap-2.5 items-start">
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-4">
          {role === 'admin' ? (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Senha Operador</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite a senha (padrão: admin123)"
                  required
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selecionar Motorista</label>
              <div className="relative">
                {driversLoading ? (
                  <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-500">
                    Buscando motoristas cadastrados...
                  </div>
                ) : drivers.length === 0 ? (
                  <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-500">
                    Nenhum motorista cadastrado no banco.
                  </div>
                ) : (
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all appearance-none cursor-pointer"
                  >
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-950">
                        {d.name} ({d.cpf})
                      </option>
                    ))}
                  </select>
                )}
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (role === 'driver' && drivers.length === 0)}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sky-600/10 transition-all cursor-pointer"
          >
            {loading ? 'Autenticando...' : 'Acessar Sistema'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}

// Pequeno helper local para o ícone de User
function UserIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24" 
      strokeWidth={1.5} 
      stroke="currentColor" 
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}
