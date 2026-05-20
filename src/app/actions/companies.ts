'use server';

import { supabase } from '@/lib/supabaseClient';

export interface CompanyData {
  id: string;
  name: string;
  created_at: string;
}

export async function createCompany(formData: FormData): Promise<{ success: boolean; message: string; companyId?: string }> {
  const name = formData.get('name') as string;

  if (!name) {
    return { success: false, message: 'Nome da empresa é obrigatório.' };
  }

  try {
    const { data, error } = await supabase
      .from('companies')
      .insert({ name })
      .select('id')
      .single();

    if (error) throw error;

    return {
      success: true,
      message: 'Empresa cadastrada com sucesso!',
      companyId: data.id,
    };
  } catch (err: any) {
    return { success: false, message: `Erro ao criar empresa: ${err.message || err}` };
  }
}

export async function updateCompany(
  companyId: string,
  formData: FormData
): Promise<{ success: boolean; message: string }> {
  const name = formData.get('name') as string;

  if (!name) {
    return { success: false, message: 'Nome da empresa é obrigatório.' };
  }

  try {
    const { error } = await supabase
      .from('companies')
      .update({ name })
      .eq('id', companyId);

    if (error) throw error;

    return { success: true, message: 'Empresa atualizada com sucesso!' };
  } catch (err: any) {
    return { success: false, message: `Erro ao atualizar empresa: ${err.message || err}` };
  }
}

export async function deleteCompany(companyId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId);

    if (error) throw error;

    return { success: true, message: 'Empresa excluída com sucesso!' };
  } catch (err: any) {
    return { success: false, message: `Erro ao excluir empresa: ${err.message || err}` };
  }
}

export async function getCompanies(): Promise<CompanyData[]> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('name');

    if (error) throw error;
    return (data || []) as CompanyData[];
  } catch (err: any) {
    console.error('Erro ao buscar empresas:', err);
    return [];
  }
}
