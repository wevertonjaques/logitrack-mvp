'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Lock, Truck, Shield, KeyRound, AlertCircle, ArrowRight, Building2, User } from 'lucide-react';

interface Company {
  id: string;
  name: string;
}

interface Driver {
  id: string;
  name: string;
  cpf: string;
}

interface Customer {
  id: string;
  name: string;
  cpf_cnpj: string;
}

export default function LoginPage() {
  const router = useRouter();

  // Estados
  const [role, setRole] = useState<'admin' | 'company' | 'driver' | 'customer'>('admin');
  const [password, setPassword] = useState('');
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companiesLoading, setCompaniesLoading] = useState(false);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driversLoading, setDriversLoading] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customersLoading, setCustomersLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carregar dados de acordo com o perfil selecionado
  useEffect(() => {
    setErrorMsg(null);

    if (role === 'company') {
      const fetchCompanies = async () => {
        setCompaniesLoading(true);
        try {
          const { data, error } = await supabase
            .from('companies')
            .select('id, name')
            .order('name');
          if (error) throw error;
          setCompanies(data || []);
          if (data && data.length > 0) {
            setSelectedCompanyId(data[0].id);
          }
        } catch (err: any) {
          setErrorMsg('Erro ao carregar empresas. Verifique a conexão com o Supabase.');
        } finally {
          setCompaniesLoading(false);
        }
      };
      fetchCompanies();
    } else if (role === 'driver') {
      const fetchDrivers = async () => {
        setDriversLoading(true);
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
          setErrorMsg('Erro ao carregar motoristas. Verifique se o schema foi aplicado.');
        } finally {
          setDriversLoading(false);
        }
      };
      fetchDrivers();
    } else if (role === 'customer') {
      const fetchCustomers = async () => {
        setCustomersLoading(true);
        try {
          const { data, error } = await supabase
            .from('customers')
            .select('id, name, cpf_cnpj')
            .order('name');
          if (error) throw error;
          setCustomers(data || []);
          if (data && data.length > 0) {
            setSelectedCustomerId(data[0].id);
          }
        } catch (err: any) {
          setErrorMsg('Erro ao carregar clientes. Verifique se a tabela customers existe.');
        } finally {
          setCustomersLoading(false);
        }
      };
      fetchCustomers();
    }
  }, [role]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    await new Promise((resolve) => setTimeout(resolve, 600));

    if (role === 'admin') {
      if (password === 'admin123') {
        localStorage.setItem('logitrack_user_role', 'admin');
        router.push('/admin');
      } else {
        setErrorMsg('Senha administrativa incorreta. Use "admin123".');
        setLoading(false);
      }
    } else if (role === 'company') {
      if (!selectedCompanyId) {
        setErrorMsg('Nenhuma empresa disponível para seleção.');
        setLoading(false);
        return;
      }
      localStorage.setItem('logitrack_user_role', 'company');
      localStorage.setItem('logitrack_company_id', selectedCompanyId);
      router.push(`/company?companyId=${selectedCompanyId}`);
    } else if (role === 'driver') {
      if (!selectedDriverId) {
        setErrorMsg('Nenhum motorista disponível para seleção.');
        setLoading(false);
        return;
      }
      localStorage.setItem('logitrack_user_role', 'driver');
      localStorage.setItem('logitrack_driver_id', selectedDriverId);
      router.push(`/driver?driverId=${selectedDriverId}`);
    } else if (role === 'customer') {
      if (!selectedCustomerId) {
        setErrorMsg('Nenhum cliente disponível para seleção.');
        setLoading(false);
        return;
      }
      localStorage.setItem('logitrack_user_role', 'customer');
      localStorage.setItem('logitrack_customer_id', selectedCustomerId);
      router.push(`/customer?customerId=${selectedCustomerId}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Decorativo */}
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

        {/* Seleção de Perfil (Grid 2x2) */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Perfil de Acesso</label>
          <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2 rounded-2xl border border-slate-850">
            <button
              type="button"
              onClick={() => { setRole('admin'); setErrorMsg(null); }}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                role === 'admin' 
                  ? 'bg-slate-800 text-slate-100 shadow-md border border-slate-700/50' 
                  : 'text-slate-450 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-sky-400" /> Admin
            </button>
            
            <button
              type="button"
              onClick={() => { setRole('company'); setErrorMsg(null); }}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                role === 'company' 
                  ? 'bg-slate-800 text-slate-100 shadow-md border border-slate-700/50' 
                  : 'text-slate-450 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-teal-400" /> Embarcador
            </button>

            <button
              type="button"
              onClick={() => { setRole('driver'); setErrorMsg(null); }}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                role === 'driver' 
                  ? 'bg-slate-800 text-slate-100 shadow-md border border-slate-700/50' 
                  : 'text-slate-450 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-emerald-400" /> Motorista
            </button>

            <button
              type="button"
              onClick={() => { setRole('customer'); setErrorMsg(null); }}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                role === 'customer' 
                  ? 'bg-slate-800 text-slate-100 shadow-md border border-slate-700/50' 
                  : 'text-slate-450 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <User className="w-3.5 h-3.5 text-amber-405" /> Cliente Final
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex gap-2.5 items-start animate-fade-in">
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulário Dinâmico */}
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* Campo do Admin */}
          {role === 'admin' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Senha do Administrador</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha (padrão: admin123)"
                  required
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-650 outline-none transition-all"
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              </div>
            </div>
          )}

          {/* Campo da Empresa / Embarcador */}
          {role === 'company' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Selecionar Embarcador</label>
              <div className="relative">
                {companiesLoading ? (
                  <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-500">
                    Carregando embarcadores...
                  </div>
                ) : companies.length === 0 ? (
                  <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-500">
                    Nenhuma empresa cadastrada no banco. Use o CD demo na Home.
                  </div>
                ) : (
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all appearance-none cursor-pointer"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-950 text-slate-200">
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              </div>
            </div>
          )}

          {/* Campo do Motorista */}
          {role === 'driver' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Selecionar Motorista</label>
              <div className="relative">
                {driversLoading ? (
                  <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-500">
                    Carregando motoristas...
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
                      <option key={d.id} value={d.id} className="bg-slate-950 text-slate-200">
                        {d.name} ({d.cpf})
                      </option>
                    ))}
                  </select>
                )}
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              </div>
            </div>
          )}

          {/* Campo do Cliente Final */}
          {role === 'customer' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Selecionar Cliente</label>
              <div className="relative">
                {customersLoading ? (
                  <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-500">
                    Carregando clientes...
                  </div>
                ) : customers.length === 0 ? (
                  <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-500">
                    Nenhum cliente cadastrado no banco.
                  </div>
                ) : (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all appearance-none cursor-pointer"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-950 text-slate-200">
                        {c.name} ({c.cpf_cnpj})
                      </option>
                    ))}
                  </select>
                )}
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading || 
              (role === 'company' && companies.length === 0) || 
              (role === 'driver' && drivers.length === 0) || 
              (role === 'customer' && customers.length === 0)
            }
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sky-600/10 transition-all cursor-pointer mt-2"
          >
            {loading ? 'Autenticando...' : 'Acessar Sistema'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
