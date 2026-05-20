'use server';

import { supabase } from '@/lib/supabaseClient';

export async function updateOrderStatus(
  orderId: string, 
  newStatus: string
): Promise<{ success: boolean; message?: string; order?: any }> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      return { success: false, message: `Erro ao atualizar status: ${error.message}` };
    }

    return { success: true, order: data };
  } catch (err: any) {
    return { success: false, message: `Erro interno no servidor: ${err.message || err}` };
  }
}

export async function uploadProofOfDelivery(
  formData: FormData
): Promise<{ success: boolean; message: string; photoUrl?: string }> {
  const orderId = formData.get('orderId') as string;
  const file = formData.get('file') as File;

  if (!orderId || !file) {
    return { success: false, message: 'ID do pedido e arquivo de imagem são obrigatórios.' };
  }

  try {
    // 1. Converter o arquivo para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Definir o caminho do arquivo no bucket
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `${orderId}/${Date.now()}.${fileExt}`;

    // 3. Fazer upload para o Supabase Storage (bucket: 'proofs')
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('proofs')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      return { success: false, message: `Erro ao enviar arquivo para o Storage: ${uploadError.message}` };
    }

    // 4. Obter a URL pública da imagem
    const { data: { publicUrl } } = supabase.storage
      .from('proofs')
      .getPublicUrl(filePath);

    // 5. Inserir registro na tabela proofs_of_delivery
    const { error: dbError } = await supabase
      .from('proofs_of_delivery')
      .insert({
        order_id: orderId,
        photo_url: publicUrl,
      });

    if (dbError) {
      return { success: false, message: `Erro ao registrar prova de entrega no banco: ${dbError.message}` };
    }

    // 6. Atualizar status do pedido para 'delivered'
    const statusUpdate = await updateOrderStatus(orderId, 'delivered');
    if (!statusUpdate.success) {
      return { success: false, message: `Imagem enviada, mas erro ao atualizar status do pedido: ${statusUpdate.message}` };
    }

    return {
      success: true,
      message: 'Entrega finalizada com sucesso com comprovante registrado!',
      photoUrl: publicUrl,
    };
  } catch (err: any) {
    return { success: false, message: `Erro interno no servidor: ${err.message || err}` };
  }
}

// Criar uma Server Action que seeda dados iniciais para testes
export async function seedDemoData() {
  try {
    // 1. Criar empresa demo se não existir
    let companyId: string;
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const { data: newCompany, error: compErr } = await supabase
        .from('companies')
        .insert({ name: 'LogiTrack Logística S/A' })
        .select('id')
        .single();
      if (compErr) throw compErr;
      companyId = newCompany.id;
    }

    // 2. Criar endereços demo (Origem e Destino) se não existirem
    // Nota: para inserir no PostGIS geography Point, passamos strings no formato 'POINT(lng lat)'
    const originLocation = 'POINT(-46.657635 -23.561486)'; // MASP, SP (lng, lat)
    const destLocation = 'POINT(-46.661635 -23.565486)'; // Parque Trianon, SP (lng, lat)

    const { data: addresses } = await supabase
      .from('addresses')
      .select('id')
      .limit(2);

    let originId: string;
    let destId: string;

    if (addresses && addresses.length >= 2) {
      originId = addresses[0].id;
      destId = addresses[1].id;
    } else {
      const { data: addr1, error: addr1Err } = await supabase
        .from('addresses')
        .insert({
          address_type: 'warehouse',
          street: 'Av. Paulista, 1000 - Centro de Distribuição',
          city: 'São Paulo',
          state: 'SP',
          postal_code: '01310-100',
          location: originLocation,
        })
        .select('id')
        .single();
      if (addr1Err) throw addr1Err;
      originId = addr1.id;

      const { data: addr2, error: addr2Err } = await supabase
        .from('addresses')
        .insert({
          address_type: 'customer',
          street: 'Alameda Campinas, 450',
          city: 'São Paulo',
          state: 'SP',
          postal_code: '01404-000',
          location: destLocation,
        })
        .select('id')
        .single();
      if (addr2Err) throw addr2Err;
      destId = addr2.id;
    }

    // 3. Criar pedido demo pendente
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    let orderId: string;

    if (existingOrder) {
      orderId = existingOrder.id;
    } else {
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          company_id: companyId,
          status: 'pending',
          origin_address_id: originId,
          destination_address_id: destId,
          weight_kg: 12.5,
          volume_m3: 0.05,
        })
        .select('id')
        .single();
      if (orderErr) throw orderErr;
      orderId = newOrder.id;
    }

    return { success: true, orderId };
  } catch (err: any) {
    return { success: false, message: `Erro ao criar dados demo: ${err.message || err}` };
  }
}
