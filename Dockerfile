FROM node:20-bookworm-slim AS app-build

WORKDIR /app

# Native module fallback support (better-sqlite3) if prebuilt binaries are unavailable.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]

FROM app-build AS app-dev

FROM app-build AS app-prod