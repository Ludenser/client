# Build client
FROM node:20-alpine AS client
WORKDIR /app/client
COPY client/package.json ./package.json
COPY client/vite.config.js ./vite.config.js
COPY client/tailwind.config.js ./tailwind.config.js
COPY client/postcss.config.js ./postcss.config.js
COPY client/index.html ./index.html
COPY client/public ./public
COPY client/src ./src
RUN npm install --no-audit --no-fund && npm run build

# Build server
FROM node:20-alpine AS server
WORKDIR /app/server
COPY server/package.json ./package.json
RUN npm install --no-audit --no-fund
COPY server/src ./src

# Final image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=server /app/server /app/server
COPY --from=client /app/client/dist /app/client/dist
EXPOSE 8080
CMD ["node", "server/src/index.js"]
