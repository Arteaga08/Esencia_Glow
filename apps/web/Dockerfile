# syntax=docker/dockerfile:1

# Imagen de producción del front (tienda + panel, una sola app Next). Se construye
# con la RAÍZ del repo como contexto: `docker build -f apps/web/Dockerfile .`.
# `bookworm-slim`, no alpine: sharp (optimizador de /_next/image) trae binarios
# prebuilt para glibc.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# corepack toma la versión exacta de pnpm del campo "packageManager" del package.json raíz.
RUN corepack enable

# --- deps: instala con el lockfile congelado, sin scripts todavía ----------
# Solo los manifiestos, para que esta capa se cachee mientras no cambien las
# dependencias. `--filter @esencia-glow/web...` instala el web y sus dependencias
# internas (packages/shared), sin arrastrar las de la API. Sin scripts: el
# postinstall raíz compila shared, que aquí aún no tiene código fuente.
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@esencia-glow/web..."

# --- build: código fuente completo, compila shared y luego el web ----------
FROM deps AS build
WORKDIR /app
COPY . .
# Variables que Next fija AL COMPILAR (las NEXT_PUBLIC_* se incrustan en el JS del
# navegador y `next.config.ts` exige CLOUDINARY_CLOUD_NAME). En Railway, el
# Dockerfile solo recibe como build args las variables declaradas con ARG.
# Ninguna es secreta; INTERNAL_API_TOKEN y TRUST_PROXY_HOPS son de ejecución y
# NO van aquí: no deben quedar horneadas en la imagen.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CHECKOUT_MODE
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG CLOUDINARY_CLOUD_NAME
RUN pnpm --filter @esencia-glow/shared build && pnpm --filter @esencia-glow/web build

# --- runtime: imagen final, mínima -----------------------------------------
# `output: "standalone"` deja en .next/standalone el servidor ya trazado, con la
# misma estructura del monorepo (apps/web/server.js). Next no copia `.next/static`
# ahí; se agrega a mano. No existe apps/web/public.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
# Escuchar en todas las interfaces (el default solo atiende al contenedor mismo);
# Railway inyecta PORT y server.js lo respeta.
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
# Usuario sin privilegios — la imagen base ya trae el usuario "node".
USER node
EXPOSE 3000
# Exec form: sin /bin/sh de por medio, el SIGTERM de Railway llega directo a Node.
CMD ["node", "apps/web/server.js"]
