'use server';

import { supabase } from '@/lib/supabaseClient';

export interface CustomerData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf_cnpj: string;
  address_id: string | null;
  created_at: string;
  addresses?: {
    id: string;
    street: string;
    city: string;
    state: string;
    postal_code: string;
    location: string; // POINT(lng lat)
  } | null;
}

export async function createCustomer(formData: FormData): Promise<{ success: boolean; message: string; customerId?: string }> {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const cpfCnpj = formData.get('cpfCnpj') as string;

  // Campos do endereço
  const street = formData.get('street') as string;
  const city = formData.get('city') as string;
  const state = formData.get('state') as string;
  const postalCode = formData.get('postalCode') as string;
  const lat = Number(formData.get('lat') || -23.56);
  const lng = Number(formData.get('lng') || -46.65);

  if (!name || !cpfCnpj || !street || !city || !state || !postalCode) {
    return { success: false, message: 'Nome, CPF/CNPJ e dados do endereço são obrigatórios.' };
  }

  try {
    // 1. Cadastrar o endereço do cliente
    const pointString = `POINT(${lng} ${lat})`;
    const { data: addressData, error: addressError } = await supabase
      .from('addresses')
      .insert({
        address_type: 'customer',
        street,
        city,
        state,
        postal_code: postalCode,
        location: pointString,
      })
      .select('id')
      .single();

    if (addressError) throw addressError;

    // 2. Cadastrar o cliente com a referência do endereço
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .insert({
        name,
        email: email || null,
        phone: phone || null,
        cpf_cnpj: cpfCnpj,
        address_id: addressData.id,
      })
      .select('id')
      .single();

    if (customerError) {
      // Rollback manual do endereço em caso de erro
      await supabase.from('addresses').delete().eq('id', addressData.id);
      throw customerError;
    }

    return {
      success: true,
      message: 'Cliente cadastrado com sucesso!',
      customerId: customerData.id,
    };
  } catch (err: any) {
    return { success: false, message: `Erro ao criar cliente: ${err.message || err}` };
  }
}

export async function updateCustomer(
  customerId: string,
  formData: FormData
): Promise<{ success: boolean; message: string }> {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const cpfCnpj = formData.get('cpfCnpj') as string;

  // Campos do endereço
  const street = formData.get('street') as string;
  const city = formData.get('city') as string;
  const state = formData.get('state') as string;
  const postalCode = formData.get('postalCode') as string;
  const lat = Number(formData.get('lat') || -23.56);
  const lng = Number(formData.get('lng') || -46.65);

  if (!name || !cpfCnpj || !street || !city || !state || !postalCode) {
    return { success: false, message: 'Nome, CPF/CNPJ e dados do endereço são obrigatórios.' };
  }

  try {
    // 1. Obter o id do endereço do cliente
    const { data: currentCustomer, error: getError } = await supabase
      .from('customers')
      .select('address_id')
      .eq('id', customerId)
      .single();

    if (getError) throw getError;

    // 2. Atualizar o cliente
    const { error: customerError } = await supabase
      .from('customers')
      .update({
        name,
        email: email || null,
        phone: phone || null,
        cpf_cnpj: cpfCnpj,
      })
      .eq('id', customerId);

    if (customerError) throw customerError;

    // 3. Atualizar o endereço do cliente
    if (currentCustomer.address_id) {
      const pointString = `POINT(${lng} ${lat})`;
      const { error: addressError } = await supabase
        .from('addresses')
        .update({
          street,
          city,
          state,
          postal_code: postalCode,
          location: pointString,
        })
        .eq('id', currentCustomer.address_id);

      if (addressError) throw addressError;
    }

    return { success: true, message: 'Dados do cliente e endereço atualizados com sucesso!' };
  } catch (err: any) {
    return { success: false, message: `Erro ao atualizar cliente: ${err.message || err}` };
  }
}

export async function deleteCustomer(customerId: string): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Obter o id do endereço do cliente antes de deletar
    const { data: customer, error: getError } = await supabase
      .from('customers')
      .select('address_id')
      .eq('id', customerId)
      .single();

    if (getError && getError.code !== 'PGRST116') throw getError;

    // 2. Deletar o cliente
    const { error: deleteError } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId);

    if (deleteError) throw deleteError;

    // 3. Deletar o endereço correspondente para evitar registros órfãos
    if (customer && customer.address_id) {
      await supabase.from('addresses').delete().eq('id', customer.address_id);
    }

    return { success: true, message: 'Cliente e seu endereço foram excluídos com sucesso!' };
  } catch (err: any) {
    return { success: false, message: `Erro ao deletar cliente: ${err.message || err}` };
  }
}

export async function getCustomers(): Promise<CustomerData[]> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*, addresses(*)');

    if (error) throw error;
    return (data || []) as CustomerData[];
  } catch (err: any) {
    console.error('Erro ao buscar clientes:', err);
    return [];
  }
}
