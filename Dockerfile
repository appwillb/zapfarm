# =======================================================
# Multi-Stage Dockerfile para ZapFarm SaaS (Pronto para Coolify)
# =======================================================

# Estágio 1: Build do Frontend (Vite + React)
FROM node:22-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# Estágio 2: Imagem de Produção do Servidor
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Instalar dependências necessárias para compilação nativa de addons (better-sqlite3) e healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    python3 \
    make \
    g++ \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependências do backend
COPY package*.json ./
RUN npm install --omit=dev

# Copiar código do backend
COPY server/ ./server

# Copiar build do frontend estático
COPY --from=client-builder /app/client/dist ./client/dist

# Criar diretório de dados persistentes para SQLite e sessões Baileys
RUN mkdir -p /app/data/sessions

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV DATABASE_PATH=/app/data/zapfarm.db

# Declarar volume persistente para banco de dados e sessões do WhatsApp
VOLUME ["/app/data"]

EXPOSE 3000

# Healthcheck para Coolify
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server/index.js"]
