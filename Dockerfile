# Typing Course (Bun + Hono + PostgreSQL)
FROM oven/bun:1 AS base
WORKDIR /app

# --- deps ---
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- build css (tailwind) ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build:css

# --- runner ---
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/bun.lock ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src

EXPOSE 3200
CMD ["bun", "src/index.ts"]
