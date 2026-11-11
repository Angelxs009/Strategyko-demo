# strategyko-rates

Módulo de **tarifas de navieras** para Strategyko (pieza de **Synapse**). Consulta tarifas de 3 navieras con origen en China, las normaliza a un formato común, las guarda, las compara y las envía a Strategyko por API REST.

> **Estado honesto:** hoy todo corre en **modo demo**. Las tarifas son **simuladas** y están marcadas como tales en la API y en la interfaz. Los adaptadores *live* están construidos pero **no hay contrato verificado** de ninguna naviera (ver [Pendientes](#pendientes-honestos)).

## Qué hace

- Consulta **Maersk, CMA CGM y Hapag-Lloyd** en paralelo (origen: puertos de China; destino por defecto `ECGYE`; contenedor por defecto `40HC`).
- Normaliza a `RateQuote` y guarda cada consulta con su `tenantId`.
- Compara: ranking, diferencia vs. la más barata, balance costo/tránsito (70/30), dispersión, desglose por componente e insights en español.
- Envía tarifas + comparación a Strategyko (`dry-run` si no hay URL configurada).
- Interfaz web "Comparativo de tarifas" con historial.

## Arquitectura

```
strategyko-rates/
  backend/    NestJS 12 + Prisma 7 + PostgreSQL
  frontend/   Next.js 16 (App Router) + TypeScript
  docker-compose.yml        PostgreSQL local (puerto 55434)
  .github/workflows/ci.yml  lint, tipos, tests y migraciones
```

Módulos del backend (`backend/src`):

| Módulo | Responsabilidad |
|---|---|
| `carriers` | Interfaz `CarrierAdapter`; adaptadores demo y live (`carriers/live`) |
| `rates` | Consulta en paralelo (`Promise.allSettled`), timeout, reintentos, persistencia e historial |
| `compare` | Análisis comparativo (función pura en `compare.ts`) |
| `strategyko-sync` | Envío del paquete versionado a Strategyko |
| `health` | `/health` con el modo actual |
| `prisma`, `common` | Acceso a datos, guard de API key, timeout/reintentos |

Flujo: `GET /api/compare` → `RatesService` consulta cada adaptador (8 s de timeout, hasta 2 reintentos con backoff exponencial solo ante errores transitorios) → guarda lo obtenido → `compareQuotes` → respuesta. Si una naviera falla, las demás siguen y el error se informa por naviera. Con menos de 2 tarifas responde `502` con el detalle.

## Cómo correrlo

Requisitos: Node 24, npm y Docker.

```bash
# 1. Base de datos
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install            # genera el cliente Prisma (postinstall)
npm run db:migrate     # migración inicial
npm run db:seed        # opcional: 3 tarifas demo de ejemplo
npm run start:dev      # http://localhost:4000  (Swagger: /api/docs)

# 3. Frontend (otra terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3000
```

> **Puerto de Postgres:** el contenedor publica el **55434**, no el 5432, para no chocar con instalaciones locales de Postgres (en la máquina de desarrollo ya ocupaban el 5432 y el 5433).
>
> **CORS:** el backend solo acepta el origen definido en `CORS_ORIGINS` (por defecto `http://localhost:3000`). Si el frontend corre en otro puerto, cámbialo en `backend/.env`.

### Tests y calidad

```bash
# Backend
cd backend
npm run lint && npx tsc --noEmit
npm test               # unitarios
npm run test:e2e       # integración (necesita Postgres y la base strategyko_rates_test)

# Frontend
cd frontend
npm run lint && npm run typecheck && npm test && npm run build
```

Para la base de pruebas local:

```bash
docker exec strategyko-rates-db psql -U strategyko -d postgres -c "CREATE DATABASE strategyko_rates_test"
DATABASE_URL=postgresql://strategyko:strategyko@localhost:55434/strategyko_rates_test npm run db:deploy
```

**Resultado verificado en local (11-nov-2026):** backend 72 unitarios + 11 de integración, frontend 9; lint, tipos y build sin errores. El workflow de CI **no se ha ejecutado todavía** (no hay repositorio remoto); su sintaxis YAML es válida y corre los mismos comandos.

## Variables de entorno

Backend (`backend/.env.example`):

| Variable | Descripción |
|---|---|
| `RATES_MODE` | `demo` (por defecto) o `live` |
| `PORT` | Puerto del backend (4000) |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma |
| `SERVICE_API_KEY` | Si se define, las rutas `/api` exigen el header `x-api-key` |
| `DATABASE_URL` | Conexión a PostgreSQL |
| `DEV_TENANT_ID` | Tenant fijo de desarrollo (por defecto `dev-tenant`) |
| `STRATEGYKO_URL`, `STRATEGYKO_API_KEY` | Destino del envío; vacío = dry-run |
| `MAERSK_*`, `CMACGM_*`, `HAPAG_*` | `BASE_URL`, `TOKEN_URL`, `CLIENT_ID`, `CLIENT_SECRET`, `API_KEY` (solo modo live) |

Frontend (`frontend/.env.example`): `NEXT_PUBLIC_API_URL` (por defecto `http://localhost:4000`).

Los secretos nunca van en el repositorio: `.env` está en `.gitignore` y solo se versionan los `.env.example`.

## Endpoints

Documentación interactiva en `/api/docs` (Swagger). Parámetros: `origin` (UN/LOCODE de China, obligatorio), `destination` (por defecto `ECGYE`), `container` (`20GP`, `40GP`, `40HC`; por defecto `40HC`). Los errores de validación llegan como `400` en español.

```bash
# Estado y modo
curl http://localhost:4000/health

# Tarifas de las 3 navieras (las guarda)
curl "http://localhost:4000/api/rates?origin=CNSHA&destination=ECGYE&container=40HC"

# Historial paginado (filtros: origin, destination, container, carrier, page, pageSize)
curl "http://localhost:4000/api/rates/history?carrier=MAERSK&page=1&pageSize=10"

# Comparativo
curl "http://localhost:4000/api/compare?origin=CNSHA"

# Envío a Strategyko (dry-run si no hay STRATEGYKO_URL; responde 202)
curl -X POST http://localhost:4000/api/push \
  -H "content-type: application/json" \
  -d '{"origin":"CNSHA","destination":"ECGYE","container":"40HC"}'

# Con API key activada
curl -H "x-api-key: <clave>" "http://localhost:4000/api/compare?origin=CNSHA"
```

### Formato común `RateQuote`

```json
{
  "carrier": "MAERSK | CMA_CGM | HAPAG_LLOYD | MSC",
  "origin": "CNSHA", "destination": "ECGYE", "container": "40HC",
  "baseFreightUsd": 3321.69,
  "surcharges": [{ "code": "BAF", "name": "Recargo por combustible (BAF)", "amountUsd": 421.43 }],
  "totalUsd": 4077.77,
  "transitDays": 39,
  "validFrom": "2026-11-09", "validTo": "2026-11-22",
  "currency": "USD",
  "source": "demo | live"
}
```

`totalUsd` siempre es `baseFreightUsd` + suma de recargos. `source` es obligatorio en todo dato.

### Contrato con Strategyko (**propuesta, pendiente de alinear con el backend real**)

`POST` a `STRATEGYKO_URL` con `Authorization: Bearer ${STRATEGYKO_API_KEY}`:

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "2026-11-11T17:00:00.000Z",
  "origin": "strategyko-rates",
  "query": { "origin": "CNSHA", "destination": "ECGYE", "container": "40HC" },
  "dataMode": "demo | live | mixed",
  "quotes": [],
  "comparison": {}
}
```

Este formato lo definí yo a partir del requerimiento; **no** viene del backend de Strategyko. Los cambios futuros deben ser compatibles hacia atrás mediante `schemaVersion`.

## Modo demo y modo live

**Demo (por defecto):** tarifas simuladas, deterministas por semana ISO (mismo resultado dentro de la semana, variación pequeña entre semanas) y con perfiles distintos por naviera. Todas llevan `source: "demo"`; la API devuelve `mode: "demo"` con un aviso y la interfaz muestra el banner **"Modo demo"** más una insignia en cada fila.

**Live (`RATES_MODE=live`):** requiere cuenta en el portal de cada naviera. **Hoy no funciona**: sin variables de entorno cada naviera informa qué variables faltan; con ellas, informa que el contrato no está verificado. En ningún caso cae a demo ni inventa datos. Para activarlo:

1. Abrir la documentación del portal con una cuenta: Maersk (developer.maersk.com, *Product Offers and Pricing*), CMA CGM (api-portal.cma-cgm.com, *Quotation API*), Hapag-Lloyd (api-portal.hlag.com, *Quick Quotes / Quick Quotes Spot*).
2. En `backend/src/carriers/live/<naviera>.adapter.ts`, completar `buildRequest()` y `parseResponse()` (y `apiKeyHeader()` si usa API key). Cada archivo documenta qué se encontró y qué falta confirmar (`TODO(angel)`).
3. Cargar las variables de entorno y poner `RATES_MODE=live`.

Lo ya resuelto y probado: cliente HTTP con clasificación de errores, OAuth2 `client_credentials` con caché de token, y validación del mapeo a `RateQuote` (solo USD, montos y fechas válidos, total coherente).

## Decisiones de diseño

- **Funciones puras para el análisis** (`compare.ts`): fáciles de probar y sin acceso a datos.
- **Multi-tenant desde el inicio:** `tenantId` en las tablas principales y filtro obligatorio en el historial (hay un test que comprueba que no devuelve filas de otro tenant). Hoy el tenant sale de `DEV_TENANT_ID`; falta la autenticación real que lo determine.
- **Fallar en lugar de aparentar:** los datos demo siempre se etiquetan y los errores de live son explícitos.
- **Cada métrica muestra su base (`n`)** y no hay porcentajes sin datos.
- **API key solo en el servidor:** el frontend no envía `x-api-key` porque una variable `NEXT_PUBLIC_*` quedaría expuesta en el navegador. Si activas `SERVICE_API_KEY`, el frontend necesita un proxy del lado del servidor.
- **Migraciones en el pipeline:** `npm run db:deploy` (`prisma migrate deploy`) se ejecuta en CI y debe ejecutarse en el despliegue, no a mano.

## Despliegue (recomendación, no incluido)

Backend y frontend como servicios separados en Railway, con PostgreSQL por ambiente. Orden: **primero backend** (con `npm run db:deploy` antes de arrancar), luego frontend. Probar siempre en **staging** antes de producción; este repositorio no contiene ningún despliegue directo a producción.

## Pendientes honestos

| Pendiente | Estado |
|---|---|
| Adaptadores live de Maersk, CMA CGM y Hapag-Lloyd | **Sin contrato verificado.** No hay credenciales y los portales no fueron legibles sin sesión. Solo está la infraestructura. |
| Contrato real con Strategyko | **Propuesta propia**, sin validar con su backend. |
| CI en GitHub Actions | Escrito y con YAML válido, **nunca ejecutado** (no hay remoto). |
| Autenticación y tenant real | Tenant fijo por variable de entorno. |
| MSC | Fuera de esta entrega; el tipo existe, falta el adaptador. |
| Puerto `CNQIN` | No lo pude verificar como UN/LOCODE; no está en el selector (sí se puede escribir en "otro puerto"). |
| Insights del backend | Usan punto decimal (`USD 4077.77`), mientras la interfaz usa formato `es-EC`. |
| Auditoría de dependencias | `npm audit` reportó avisos en ambos proyectos; no se revisaron. |
| Despliegue y staging | No configurados. |
