'use server';

import { supabase } from '@/lib/supabaseClient';

interface CreateDriverResult {
  success: boolean;
  message: string;
  driverId?: string;
}

export async function createDriver(formData: FormData): Promise<CreateDriverResult> {
  const name = formData.get('name') as string;
  const cpf = formData.get('cpf') as string;
  const cnhExpiresAt = formData.get('cnhExpiresAt') as string;
  const model = formData.get('vehicleModel') as string;
  const plate = formData.get('vehiclePlate') as string;
  const maxWeightKg = Number(formData.get('maxWeightKg') || 1000);
  const maxVolumeM3 = Number(formData.get('maxVolumeM3') || 10);

  if (!name || !cpf || !cnhExpiresAt || !model || !plate) {
    return { success: false, message: 'Todos os campos obrigatórios devem ser preenchidos.' };
  }

  // Limpar formatação do CPF (manter apenas números)
  const cleanCpf = cpf.replace(/\D/g, '');

  try {
    // 1. Verificar se o CPF é único
    const { data: existingDriver, error: checkError } = await supabase
      .from('drivers')
      .select('id')
      .eq('cpf', cleanCpf)
      .maybeSingle();

    if (checkError) {
      return { success: false, message: `Erro ao verificar CPF: ${checkError.message}` };
    }

    if (existingDriver) {
      return { success: false, message: 'Já existe um motorista cadastrado com este CPF.' };
    }

    // 2. Criar ou buscar o veículo
    const { data: existingVehicle } = await supabase
      .from('vehicles')
      .select('id')
      .eq('plate', plate.toUpperCase())
      .maybeSingle();

    let vehicleId = existingVehicle?.id;

    if (!vehicleId) {
      const { data: newVehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          plate: plate.toUpperCase(),
          model,
          max_weight_kg: maxWeightKg,
          max_volume_m3: maxVolumeM3,
        })
        .select('id')
        .single();

      if (vehicleError) {
        return { success: false, message: `Erro ao cadastrar veículo: ${vehicleError.message}` };
      }
      vehicleId = newVehicle.id;
    }

    // 3. Cadastrar motorista
    const { data: newDriver, error: driverError } = await supabase
      .from('drivers')
      .insert({
        name,
        cpf: cleanCpf,
        cnh_expires_at: cnhExpiresAt,
        vehicle_id: vehicleId,
      })
      .select('id')
      .single();

    if (driverError) {
      return { success: false, message: `Erro ao cadastrar motorista: ${driverError.message}` };
    }

    return {
      success: true,
      message: 'Motorista e veículo cadastrados com sucesso!',
      driverId: newDriver.id,
    };
  } catch (err: any) {
    return { success: false, message: `Erro interno no servidor: ${err.message || err}` };
  }
}

export async function updateDriver(driverId: string, formData: FormData): Promise<CreateDriverResult> {
  const name = formData.get('name') as string;
  const cpf = formData.get('cpf') as string;
  const cnhExpiresAt = formData.get('cnhExpiresAt') as string;
  const model = formData.get('vehicleModel') as string;
  const plate = formData.get('vehiclePlate') as string;
  const maxWeightKg = Number(formData.get('maxWeightKg') || 1000);
  const maxVolumeM3 = Number(formData.get('maxVolumeM3') || 10);

  if (!name || !cpf || !cnhExpiresAt || !model || !plate) {
    return { success: false, message: 'Todos os campos obrigatórios devem ser preenchidos.' };
  }

  const cleanCpf = cpf.replace(/\D/g, '');

  try {
    // 1. Buscar o motorista atual para obter o vehicle_id
    const { data: currentDriver, error: getDriverError } = await supabase
      .from('drivers')
      .select('vehicle_id')
      .eq('id', driverId)
      .single();

    if (getDriverError || !currentDriver) {
      return { success: false, message: 'Motorista não encontrado.' };
    }

    const vehicleId = currentDriver.vehicle_id;

    // 2. Atualizar ou criar o veículo associado
    if (vehicleId) {
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({
          plate: plate.toUpperCase(),
          model,
          max_weight_kg: maxWeightKg,
          max_volume_m3: maxVolumeM3,
        })
        .eq('id', vehicleId);

      if (vehicleError) {
        return { success: false, message: `Erro ao atualizar veículo: ${vehicleError.message}` };
      }
    }

    // 3. Atualizar o motorista
    const { error: driverError } = await supabase
      .from('drivers')
      .update({
        name,
        cpf: cleanCpf,
        cnh_expires_at: cnhExpiresAt,
      })
      .eq('id', driverId);

    if (driverError) {
      return { success: false, message: `Erro ao atualizar motorista: ${driverError.message}` };
    }

    return {
      success: true,
      message: 'Motorista e veículo atualizados com sucesso!',
      driverId,
    };
  } catch (err: any) {
    return { success: false, message: `Erro interno no servidor: ${err.message || err}` };
  }
}

export async function deleteDriver(driverId: string): Promise<CreateDriverResult> {
  try {
    // Buscar o vehicle_id antes de excluir para podermos remover o veículo se desejado (opcional)
    const { data: driver } = await supabase
      .from('drivers')
      .select('vehicle_id')
      .eq('id', driverId)
      .maybeSingle();

    // Excluir motorista
    const { error: deleteError } = await supabase
      .from('drivers')
      .delete()
      .eq('id', driverId);

    if (deleteError) {
      return { success: false, message: `Erro ao excluir motorista: ${deleteError.message}` };
    }

    // Opcional: Excluir o veículo se ele existir
    if (driver?.vehicle_id) {
      await supabase
        .from('vehicles')
        .delete()
        .eq('id', driver.vehicle_id);
    }

    return { success: true, message: 'Motorista excluído com sucesso!' };
  } catch (err: any) {
    return { success: false, message: `Erro interno ao excluir: ${err.message || err}` };
  }
}
