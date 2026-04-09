FROM node:22-alpine AS api-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsup src/index.ts --format esm --out-dir dist

FROM node:22-alpine AS dashboard-builder
WORKDIR /app
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=api-builder /app/dist ./dist
COPY --from=dashboard-builder /app/dist ./dashboard/dist
COPY drizzle/ ./drizzle/
COPY site/ ./site/
EXPOSE 8080
ENTRYPOINT []
CMD ["node", "dist/index.js"]
