-- Habilitar a extensão PostGIS para buscas geográficas
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Criação de Enums e Tipos Customizados
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending', 'assigned', 'collecting', 'in_transit', 'delivered', 'failed', 'cancelled', 'returned');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'address_type') THEN
    CREATE TYPE address_type AS ENUM ('company', 'customer', 'warehouse');
  END IF;
END $$;

-- 2. Criação das Tabelas Principais

-- Empresas (Multi-tenancy)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Veículos
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT UNIQUE NOT NULL,
  model TEXT NOT NULL,
  max_weight_kg NUMERIC(10, 2) NOT NULL,
  max_volume_m3 NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Motoristas
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  cnh_expires_at DATE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Endereços (Usa PostGIS geography para coordenadas espaciais)
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_type address_type NOT NULL,
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pedidos (Orders)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  status order_status NOT NULL DEFAULT 'pending',
  origin_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  destination_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  weight_kg NUMERIC(10, 2) NOT NULL,
  volume_m3 NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eventos de Rastreamento (Atualizações de GPS)
CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Histórico de Mudanças de Status (Auditoria)
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID
);

-- Prova de Entrega (POD)
CREATE TABLE IF NOT EXISTS proofs_of_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices de Performance e Espaciais
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_company ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_addresses_location ON addresses USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_tracking_location ON tracking_events USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_tracking_recorded_at ON tracking_events(recorded_at DESC);

-- 4. Função e Trigger para Auditoria Automática de Status de Pedido
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_log_order_status_change
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- 5. Habilitar Row Level Security (RLS)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE proofs_of_delivery ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS Ultra Permissivas para Teste Compartilhado
CREATE POLICY "Permitir tudo em companies para testes" ON companies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em vehicles para testes" ON vehicles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em drivers para testes" ON drivers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em addresses para testes" ON addresses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em orders para testes" ON orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em status history para testes" ON order_status_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em proofs para testes" ON proofs_of_delivery FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo em tracking_events para testes" ON tracking_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. Configuração do Storage (Bucket de Fotos/Comprovantes)
-- Cria o bucket 'proofs' público se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Habilitar políticas de acesso completo para o bucket de fotos do MVP
-- Upload (Insert)
CREATE POLICY "Permitir upload para todos no bucket proofs"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'proofs');

-- Leitura (Select)
CREATE POLICY "Permitir leitura para todos no bucket proofs"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'proofs');

-- Atualização (Update)
CREATE POLICY "Permitir update para todos no bucket proofs"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'proofs')
WITH CHECK (bucket_id = 'proofs');

-- Deleção (Delete)
CREATE POLICY "Permitir delecao para todos no bucket proofs"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'proofs');
