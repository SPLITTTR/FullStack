# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
ENV NODE_ENV=production

# These are baked into the client bundle if referenced from client code.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `public/` is optional in Next.js; ensure it exists so Docker COPY never fails.
RUN mkdir -p public

RUN npm run build

# ---- runtime (standalone) ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Runtime env vars (Clerk secret, etc.) must be provided at `docker run` / compose.

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
