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

-- 5. Row Level Security (RLS) Policies

-- Habilitar RLS nas tabelas principais
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE proofs_of_delivery ENABLE ROW LEVEL SECURITY;

-- Políticas para a Tabela de Pedidos (Orders)
-- Empresas (Authenticated) podem ver todos os pedidos associados a empresas do usuário (simplificado para MVP: qualquer usuário autenticado por agora, ou com base em company_id se associado a um perfil)
CREATE POLICY "Users can view all orders"
ON orders FOR SELECT
TO authenticated
USING (true);

-- Motoristas podem visualizar suas próprias ordens atribuídas
CREATE POLICY "Drivers can view assigned orders"
ON orders FOR SELECT
TO authenticated
USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

-- Motoristas podem atualizar o status das suas ordens
CREATE POLICY "Drivers can update assigned orders status"
ON orders FOR UPDATE
TO authenticated
USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
WITH CHECK (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

-- Clientes podem rastrear um pedido específico anonimamente (público) para a tela de tracking
CREATE POLICY "Public anonymous tracking access"
ON orders FOR SELECT
TO anon
USING (status IN ('pending', 'assigned', 'collecting', 'in_transit', 'delivered'));

-- Políticas para a Tabela de Eventos de Rastreamento (tracking_events)
-- Motoristas podem inserir dados de rastreamento para suas entregas
CREATE POLICY "Drivers can insert tracking events"
ON tracking_events FOR INSERT
TO authenticated
WITH CHECK (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

-- Qualquer um pode visualizar eventos de rastreamento para exibir no mapa público de tracking
CREATE POLICY "Public tracking events view"
ON tracking_events FOR SELECT
TO anon, authenticated
USING (true);

-- Políticas para Drivers
CREATE POLICY "Anyone can view drivers (needed for tracking)"
ON drivers FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users or anonymous form"
ON drivers FOR INSERT
TO anon, authenticated
WITH CHECK (true);
