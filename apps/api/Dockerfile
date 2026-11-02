# syntax=docker/dockerfile:1

# Imagen de producción de la API (Milestone 1.10). `bookworm-slim`, no
# alpine: bcrypt y sharp traen binarios nativos/prebuilt y musl (base de
# alpine) da problemas con ellos.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# corepack toma la versión exacta del campo "packageManager" del package.json
# raíz (pnpm@11.18.0) — no se repite la versión a mano aquí.
RUN corepack enable

# --- deps: instala con el lockfile congelado, sin scripts todavía ----------
# El postinstall raíz compila packages/shared, que en esta etapa aún no
# existe como código fuente (solo se copiaron los manifiestos, para que esta
# capa se cachee mientras no cambien las dependencias) — correrlo aquí
# fallaría. Se compila a mano en la etapa "build", después de copiar el
# código fuente completo.
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

# --- build: código fuente completo, compila shared y luego api -------------
FROM deps AS build
WORKDIR /app
COPY . .
# apps/api usa `tsc -p` (no `tsc -b`) — no arrastra la project reference a
# packages/shared, así que shared se compila explícitamente primero.
RUN pnpm --filter @esencia-glow/shared build && pnpm --filter @esencia-glow/api build

# --- deploy: solo la API + sus deps de producción, podadas ------------------
# `pnpm deploy` resuelve `@esencia-glow/shared: workspace:*` contra el
# `dist/` ya compilado y arma un node_modules con SOLO dependencies (nunca
# devDependencies) — así `mongodb-memory-server`/`tsx`/etc. no llegan a la
# imagen final. Requiere que apps/api/package.json declare `"files": ["dist"]`
# (ya lo hace): sin eso, pnpm cae al .gitignore del repo, que ignora dist/, y
# el deploy quedaría vacío de código compilado.
#
# `--legacy`: pnpm 10+ por default solo hace deploy de workspaces con
# "inject-workspace-packages" (copia el paquete interno en vez de symlink),
# que este repo no activa. Con `--legacy` pnpm arma el deploy con symlinks a
# los paquetes del workspace — el mismo mecanismo que ya usa apps/api para
# consumir @esencia-glow/shared en desarrollo.
FROM build AS deploy
WORKDIR /app
RUN pnpm --filter @esencia-glow/api --prod deploy /prod/api --legacy

# --- runtime: imagen final, mínima -----------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deploy /prod/api /app
# Usuario sin privilegios — la imagen base ya trae el usuario "node".
USER node
EXPOSE 4000
# Exec form: server.ts maneja SIGTERM para un shutdown ordenado (ver
# apps/api/src/server.ts) — un CMD en shell form interpondría /bin/sh y se
# comería la señal antes de que Node la reciba.
CMD ["node", "dist/server.js"]
