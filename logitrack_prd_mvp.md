Este documento foi estruturado para ser consumido por uma IA de codificação (como GitHub Copilot Workspace, Cursor, Devin ou AutoGPT). O foco é a atomicidade: cada tarefa gera um artefato testável e validável antes de passar para a próxima.

O plano segue a estratégia **Schema-First**, garantindo que a base de dados esteja 100% alinhada com o PRD corrigido antes de escrever uma linha de frontend.

---

# Plano de Implementação: LogiTrack MVP (Schema Revisado)

**Contexto do Sistema:**
- **Linguagem:** TypeScript.
- **Framework:** Next.js 14 (App Router).
- **Banco de Dados:** Supabase (PostgreSQL + PostGIS).
- **Mapas:** Google Maps Platform.
- **Estilo:** Tailwind CSS.

---

## FASE 1: Fundação de Dados e Infraestrutura
*Objetivo: Provisionar o banco de dados exatamente como especificado no PRD corrigido.*

### Task 1.1: Criação de Enums e Tipos Customizados
**Objetivo:** Garantir a integridade dos dados de status e tipos de endereço.

**Prompt para IA:**
> "Acesse o Supabase SQL Editor e execute a criação dos tipos enumerados (`ENUM`) necessários para o sistema. Isso deve ser feito antes da criação das tabelas.
>
> **Código SQL de Referência:**
> ```sql
> CREATE TYPE order_status AS ENUM ('pending', 'assigned', 'collecting', 'in_transit', 'delivered', 'failed', 'cancelled', 'returned');
> CREATE TYPE address_type AS ENUM ('company', 'customer', 'warehouse');
> ```"

**✅ Checkpoint de Validação:**
- Execute `SELECT enum_range(NULL::order_status);` no banco.
- **Sucesso:** O retorno deve conter a lista exata de status definida.

### Task 1.2: Criação do Schema Físico (DDL)
**Objetivo:** Criar a estrutura de tabelas com todos os campos corrigidos e relacionamentos.

**Prompt para IA:**
> "Crie as tabelas principais do sistema. Certifique-se de utilizar os tipos ENUM criados na Task 1.1. Inclua os campos de capacidade em `vehicles`, CPF/CNH em `drivers`, e a estrutura genérica para `addresses`.
>
> **Requisitos Específicos:**
> 1. Tabela `vehicles` deve ter `max_weight_kg` e `max_volume_m3`.
> 2. Tabela `drivers` deve ter `cpf` (unique) e `cnh_expires_at`.
> 3. Tabela `orders` deve usar o tipo `order_status` para a coluna `status`.
> 4. Habilite a extensão `postgis` no início do script."

**✅ Checkpoint de Validação:**
- Verifique se a tabela `orders` aceita apenas valores do ENUM (teste inserir um status inválido, deve falhar).
- Verifique se a tabela `addresses` possui a coluna `location` do tipo `geography`.

### Task 1.3: Indexação e Performance
**Objetivo:** Preparar o banco para o volume massivo de dados de rastreamento.

**Prompt para IA:**
> "Gere os índices críticos para garantir performance no dashboard e no rastreamento. Foque em buscas espaciais e filtros por status.
>
> **Índices Obrigatórios:**
> ```sql
> CREATE INDEX idx_orders_status ON orders(status);
> CREATE INDEX idx_orders_company ON orders(company_id);
> CREATE INDEX idx_addresses_location ON addresses USING GIST(location);
> CREATE INDEX idx_tracking_location ON tracking_events USING GIST(location);
> CREATE INDEX idx_tracking_recorded_at ON tracking_events(recorded_at DESC);
> ```"

**✅ Checkpoint de Validação:**
- Execute um `EXPLAIN` em uma query de seleção de pedidos por status. O resultado deve mostrar "Index Scan".

---

## FASE 2: Backend e Lógica de Negócio (Supabase Client)
*Objetivo: Conectar a aplicação ao banco e configurar segurança.*

### Task 2.1: Configuração do Ambiente e Cliente Supabase
**Objetivo:** Inicializar o projeto e conexão.

**Prompt para IA:**
> "Configure o projeto Next.js:
> 1. Instale `@supabase/supabase-js` e `@react-google-maps/api`.
> 2. Crie o arquivo `lib/supabaseClient.ts` exportando um cliente Supabase configurado com variáveis de ambiente.
> 3. Crie um arquivo `.env.local` com placeholders para `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_GOOGLE_MAPS_KEY`."

**✅ Checkpoint de Validação:**
- Inicie o app (`npm run dev`). Não deve haver erros de compilação.

### Task 2.2: Row Level Security (RLS) Policies
**Objetivo:** Garantir o isolamento de dados (Multi-tenancy).

**Prompt para IA:**
> "Execute no SQL Editor as políticas de segurança para garantir que empresas só vejam seus próprios dados e motoristas só vejam suas ordens.
>
> **Script SQL:**
> ```sql
> -- 1. Habilitar RLS nas tabelas principais
> ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
> ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
>
> -- 2. Criar política para Motoristas (Exemplo simplificado usando auth.uid)
> CREATE POLICY "Drivers can view own orders"
> ON orders FOR SELECT
> TO authenticated
> USING (driver_id = auth.uid());
> ```
> *Nota: Ajuste a lógica de `auth.uid()` conforme sua tabela de usuários ligada a `drivers`."

**✅ Checkpoint de Validação:**
- Tente selecionar dados da tabela `orders` com um usuário não autenticado. Deve retornar vazio ou erro.

---

## FASE 3: O "Input" (Módulo Motorista - PWA)
*Objetivo: Criar a interface que envia dados para o banco.*

### Task 3.1: Hook de Geolocalização
**Objetivo:** Capturar a posição atual do dispositivo.

**Prompt para IA:**
> "Crie um custom hook React em `hooks/useCurrentLocation.ts`.
> Deve retornar `{ coordinates: { lat, lng } | null, error: string | null }`.
> Use `navigator.geolocation.watchPosition` para atualizações contínuas.
> Adicione tratamento de erro para permissão negada."

**✅ Checkpoint de Validação:**
- Acesse uma página de teste que use o hook. O navegador deve pedir permissão de localização e exibir as coordenadas no console.

### Task 3.2: Formulário de Cadastro de Entidade (CRUD Mínimo)
**Objetivo:** Permitir o cadastro de motoristas e veículos para o teste.

**Prompt para IA:**
> "Crie uma Server Action (ou API Route) `app/actions/createDriver.ts`.
> Ela deve receber os dados do formulário (incluindo CPF e Validade CNH como definido no PRD) e inserir na tabela `drivers`.
> Valide se o CPF é único antes de inserir."

**✅ Checkpoint de Validação:**
- Preencha o formulário no frontend. Verifique se o dado aparece corretamente na tabela `drivers` no Supabase.

---

## FASE 4: O "Core" (Rastreamento e Mapas)
*Objetivo: Validação da funcionalidade principal (PoC).*

### Task 4.1: Integração Google Maps e Renderização
**Objetivo:** Exibir o mapa e a rota.

**Prompt para IA:**
> "Crie um componente Client Component `components/MapDisplay.tsx`.
> Use `@react-google-maps/api`.
> O mapa deve centralizar na localização do usuário.
> Adicione um marcador que represente a posição atual do motorista."

**✅ Checkpoint de Validação:**
- O mapa carrega sem erros de API Key e mostra a localização inicial.

### Task 4.2: Realtime Subscription (A Mágica)
**Objetivo:** O marcador se move em tempo real.

**Prompt para IA:**
> "Implemente a lógica de Realtime no componente `MapDisplay.tsx`:
> 1. Inscreva-se no canal `tracking_events` do Supabase.
> 2. Ao receber um evento `INSERT`, atualize o estado da posição do marcador.
> 3. No componente do Motorista, crie um botão que dispara a inserção de um novo ponto na tabela `tracking_events` a cada 10 segundos (usando o hook de geolocalização da Task 3.1)."

**✅ Checkpoint de Validação (O "Grande Teste"):**
1. Abra a aplicação em duas janelas lado a lado.
2. Na janela do "Motorista", clique em "Iniciar Rota" e ande fisicamente ou use um simulador de localização.
3. **Sucesso:** O marcador na janela "Mapa/Cliente" move-se instantaneamente, sem necessidade de refresh.

---

## FASE 5: Finalização do Protótipo (Workflow)

### Task 5.1: Workflow de Status e Histórico
**Objetivo:** Implementar a mudança de status com auditoria.

**Prompt para IA:**
> "Crie uma função RPC no Supabase ou uma Server Action `updateOrderStatus`.
> Ela deve receber `order_id` e `new_status`.
> **Regra de Negócio:** Antes de atualizar o status na tabela `orders`, insira um registro na tabela `order_status_history` registrando a mudança (`from_status`, `to_status`, `changed_by`)."

**✅ Checkpoint de Validação:**
- Mude o status de um pedido de 'pending' para 'in_transit'.
- Verifique a tabela `order_status_history`. Deve existir um registro dessa transação.

### Task 5.2: Prova de Entrega (POD) Simples
**Objetivo:** Validar a captura de dados finais.

**Prompt para IA:**
> "Na tela do Motorista, ao finalizar uma entrega (status 'delivered'), permita o upload de uma foto.
> Utilize o Supabase Storage para salvar a imagem.
> Salve a URL pública na tabela `proofs_of_delivery` vinculada ao `order_id`."

**✅ Checkpoint de Validação:**
- Tire uma foto no final da entrega.
- Verifique se a URL da imagem foi salva corretamente no banco e se a imagem é acessível.
