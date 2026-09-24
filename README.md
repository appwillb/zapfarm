# ⚕️ ZapFarm SaaS — Sistema Completo de Atendimento e Vendas para Farmácias via WhatsApp

Sistema SaaS completo, multi-tenant e profissional projetado para farmácias realizarem atendimento automático e vendas pelo WhatsApp com conexão direta via **Baileys**, catálogo inteligente de medicamentos, controle rigoroso de estoque e lotes, cobrança via Pix com QR Code e **despacho automatizado para entregadores (motoboys) após a confirmação real do pagamento**.

Pronto para rodar localmente e homologado para deploy no **Coolify**.

---

## 🌟 Principais Funcionalidades

### 1. Robô de Atendimento WhatsApp (Baileys Multi-sessão)
- **Multi-sessão Isolada:** Cada farmácia cadastrada no SaaS possui sua própria sessão e credenciais do WhatsApp isoladas.
- **Leitura de QR Code no Painel:** O farmacêutico gera o QR Code na aba "Conexão WhatsApp" do painel e conecta o aparelho em segundos.
- **Reconexão Automática:** Caso a conexão caia temporariamente, o sistema recupera a sessão automaticamente.
- **Simulador Interativo Embutido:** Permite testar todo o fluxo do bot diretamente na tela do navegador, sem necessidade de um segundo chip físico!

### 2. Fluxo Completo de Venda e Busca de Medicamentos
1. **Recepção Amigável:** O cliente envia uma mensagem e o bot saúda com o nome da farmácia.
2. **Busca Semântica & Apresentação Exata:** Consulta em tempo real no banco de dados da farmácia por nome, princípio ativo ou código de barras (EAN).
   - Se houver múltiplos medicamentos correspondentes, apresenta uma lista numerada clara.
   - Retorna dosagem, apresentação (ex: caixa com 20 comprimidos), preço e unidades disponíveis no estoque.
3. **Gestão de Carrinho:** O cliente escolhe a quantidade, adiciona mais produtos ou finaliza o pedido.
4. **Validação de Receita Médica:** Se algum medicamento do carrinho exigir receita médica (antibióticos, tarja vermelha ou controlados), o robô orienta o envio da receita médica para validação farmacêutica.
5. **Opção de Entrega ou Retirada:**
   - **Retirada:** Liberação no balcão da farmácia sem taxa.
   - **Entrega (Delivery):** Coleta o endereço completo e calcula a taxa de frete automaticamente (com regra de frete grátis configurável).
6. **Pagamento Seguro via Pix:**
   - Gera o código **Pix Copia e Cola** (padrão EMV oficial do Banco Central) e QR Code.
   - Reserva temporariamente a quantidade dos medicamentos no estoque.
7. **🔒 REGRA ESTRITA DE SEGURANÇA (Anti-Fraude):**
   - **Mensagens como "já paguei" ou fotos de comprovantes NÃO liberam o pedido automaticamente.**
   - O robô agradece e informa que a equipe financeira e o sistema estão conciliando o pagamento.
   - O pedido só avança para separação e entrega após a **confirmação real do pagamento** no painel da farmácia ou via webhook bancário.
8. **Despacho Automatizado para o Motoboy:**
   - Assim que a farmácia separa os itens e clica em **"Liberar Pedido para Motoboy"**, o sistema seleciona o entregador disponível e **envia uma mensagem no WhatsApp do motoboy com todos os dados da entrega** (nome do cliente, telefone, endereço completo, itens do pacote, comprovante de que está pago e taxa a receber).
   - O cliente recebe simultaneamente no WhatsApp o aviso de que o pedido está a caminho com o nome do motoboy e veículo!
9. **Finalização da Entrega:** O motoboy ou a farmácia confirma a entrega, liberando o motoboy para novas corridas e enviando agradecimento ao cliente.

### 3. Painel Administrativo Super Profissional & Responsivo
- **Visão Geral / Dashboard:** Faturamento do dia, pedidos pendentes, pedidos em separação, entregas ativas, alertas de estoque baixo e status do WhatsApp.
- **Kanban & Lista de Pedidos:** Colunas visuais (*Aguardando Pix*, *Pago / Em Separação*, *Pronto / Liberado*, *Em Rota com Motoboy*, *Entregue*).
- **Catálogo & Medicamentos:** Cadastro com dosagem, apresentação, laboratório, código de barras, preço de custo, preço de venda, estoque mínimo e indicação de receita obrigatória.
- **Importador de Planilhas CSV:** Permite subir milhares de medicamentos em lote de uma só vez.
- **Gestão de Estoque & Lotes:** Acompanhamento de datas de validade e alertas de reposição imediata.
- **Gestão de Entregadores:** Cadastro de motoboys, status em tempo real (Disponível, Em Entrega, Offline) e botão de teste de comunicação via WhatsApp.
- **Atendimento Humano (Chat ao Vivo):** Permite pausar o robô a qualquer momento para que um farmacêutico ou atendente assuma o chat manualmente com o cliente.
- **Painel Master do Dono do SaaS:** Controle das farmácias clientes, planos (Starter, Pro, Enterprise), faturamento de assinaturas e isolamento de tenants.

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Node.js 18+ (Node.js 22 ou 24 recomendado)
- npm

### 1. Instalação
Clone o projeto ou acesse a pasta raiz:
```bash
cd zapfarm
npm install
npm --prefix client install
```

### 2. Inicialização em Modo Desenvolvimento
Inicie o backend e o frontend simultaneamente:
```bash
npm run dev
```
- **Painel Web:** `http://localhost:5173`
- **Backend API & Baileys:** `http://localhost:3001`
- **WebSocket:** `ws://localhost:3001/ws`

### 3. Modo de Produção Local
```bash
npm run build
npm start
```
Acesse diretamente `http://localhost:3001`.

---

## 🐳 Deploy no Coolify (Passo a Passo)

O ZapFarm está configurado para deploy instantâneo no **Coolify** utilizando o `Dockerfile` multi-estágio e SQLite persistente.

### 1. Repositório no GitHub / GitLab
Suba este código para o seu repositório Git.

### 2. Configurar Aplicação no Coolify
1. No seu painel do Coolify, clique em **+ New Resource** > **Application**.
2. Selecione **Public/Private Repository** e aponte para o repositório do ZapFarm.
3. Escolha o tipo de build: **Dockerfile** (o Coolify detectará automaticamente o `Dockerfile` na raiz).

### 3. Configurar Volumes Persistentes (CRÍTICO) ⚠️
Para que as sessões do WhatsApp (Baileys) e o banco de dados SQLite não sejam apagados quando o container reiniciar ou atualizar:
- Na aba **Storages / Persistent Storage** do Coolify, adicione:
  - **Destination Path:** `/app/data`
  - **Volume Name:** `zapfarm_data`

### 4. Variáveis de Ambiente no Coolify
Na aba **Environment Variables**, adicione:
```env
PORT=3000
NODE_ENV=production
DATA_DIR=/app/data
DATABASE_PATH=/app/data/zapfarm.db
JWT_SECRET=defina_uma_chave_longa_e_segura_aqui_12345
```

### 5. Porta e Domínio
- Configure seu domínio (ex: `farmacia.seusass.com.br`) apontando para a porta `3000`.
- Clique em **Deploy**.

Pronto! Seu SaaS de Farmácia com Baileys WhatsApp estará online com SSL automático pelo Coolify!

---

## 🧪 Como Testar Imediatamente Sem Aparelho Físico

1. Abra o painel no navegador: `http://localhost:3001` ou `http://localhost:5173`.
2. Clique no botão **"Simular Conversa"** no topo ou no menu lateral.
3. O simulador abrirá uma janela no formato de smartphone:
   - Clique em **"Olá, boa tarde"** ou digite no campo.
   - Digite **"Dipirona"** para ver a busca em tempo real do banco de dados.
   - Escolha o número da opção (ex: **"1"**).
   - Digite a quantidade (ex: **"2"**).
   - Clique em **"Finalizar Pedido"**.
   - Escolha **"1"** (Entrega).
   - Envie o endereço de entrega (ex: **"Rua das Flores, 123 - Centro"**).
   - O robô gerará o **Pix Copia e Cola** com o valor total e taxa de entrega calculada!
   - Digite **"Já paguei"**: observe que o robô **não** libera a entrega até que você clique em **"Confirmar Pix Real"** no Kanban de Pedidos.
   - Ao confirmar o Pix e clicar em **"Liberar p/ Motoboy"**, veja a notificação automática ser enviada para o entregador e para o cliente!

---

## 📂 Estrutura do Projeto

```
zapfarm/
├── client/                     # Frontend Vite + React + Tailwind CSS
│   ├── src/
│   │   ├── components/         # Dashboard, Orders, Products, WhatsApp, Chat, Modais
│   │   ├── api.js              # Cliente de APIs REST
│   │   ├── App.jsx             # Aplicação central
│   │   └── main.jsx
├── server/                     # Backend Node.js
│   ├── baileys/
│   │   └── sessionManager.js   # Gerenciador multi-sessão do Baileys
│   ├── bot/
│   │   └── botEngine.js        # Máquina de estados conversacional do bot
│   ├── db/
│   │   └── database.js         # SQLite com better-sqlite3 e dados iniciais
│   ├── middleware/             # Autenticação JWT e controle de tenants
│   ├── routes/                 # APIs REST (pedidos, produtos, motoboys, chat)
│   └── index.js                # Servidor Express + WebSocket
├── data/                       # Diretório persistente (banco SQLite + sessões)
├── Dockerfile                  # Multi-stage build para Coolify
├── docker-compose.yml          # Configuração Docker pronta
├── package.json
└── README.md
```

Desenvolvido para atender farmácias e drogarias com máxima confiabilidade, segurança regulatória e automação logística.
