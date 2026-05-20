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
