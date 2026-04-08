FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsup src/index.ts --format esm --out-dir dist

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY drizzle/ ./drizzle/
EXPOSE 8080
ENTRYPOINT []
CMD ["node", "dist/index.js"]
