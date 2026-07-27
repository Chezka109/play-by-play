FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
COPY client/package.json client/package-lock.json ./client/

RUN npm ci \
    && npm --prefix server ci \
    && npm --prefix client ci

COPY . .
RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV SERVE_CLIENT=true

COPY server/package.json server/package-lock.json ./server/
RUN npm --prefix server ci --omit=dev

COPY --chown=node:node server/src ./server/src
COPY --chown=node:node --from=build /app/client/dist ./client/dist

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3001/health >/dev/null || exit 1

CMD ["node", "server/src/index.js"]
