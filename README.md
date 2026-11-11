<div align="center">

# 🚢 strategyko-rates

**Tarifas de navieras desde China, normalizadas y comparadas.**
Una pieza de *Synapse* para Strategyko · Cargo Allianz

![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![Tests](https://img.shields.io/badge/tests-92%20passing-2A7F8E)
![Modo](https://img.shields.io/badge/datos-modo%20demo-D99E2B)

</div>

---

> [!IMPORTANT]
> **Estado honesto:** hoy todo corre en **modo demo**. Las tarifas son **simuladas**, y están marcadas como tales en la API y en la pantalla. Los adaptadores *live* están construidos y probados, pero **ninguna naviera tiene un contrato de API verificado todavía**. Detalles en [Pendientes](#-pendientes-honestos).

## ✨ Qué hace

| | |
|---|---|
| 🔎 **Consulta** | Maersk, CMA CGM y Hapag-Lloyd **en paralelo**, desde puertos de China (por defecto hacia `ECGYE`, contenedor `40HC`). |
| 🧩 **Normaliza** | Todas las respuestas se convierten a un único formato, `RateQuote`, con `source` obligatorio (`demo` o `live`). |
| 💾 **Guarda** | Cada consulta queda en PostgreSQL con su vigencia y su `tenantId`, con historial paginado. |
| ⚖️ **Compara** | Ranking, diferencia frente a la más barata, balance costo/tránsito (70/30), dispersión, desglose por componente e insights en español. |
| 📤 **Envía** | Paquete versionado hacia Strategyko, con **dry-run** si no hay URL configurada. |
| 🖥️ **Muestra** | Interfaz web "Comparativo de tarifas", responsive, accesible y con modo oscuro. |

<div align="center">

![Comparativo de tarifas](docs/captura-comparativo.png)

<sub>Vista "Comparativo de tarifas" con datos <b>simulados</b> (modo demo).</sub>

</div>

## 🏗️ Arquitectura

```mermaid
flowchart LR
    UI["Frontend<br/>Next.js"] -->|REST| API["Backend<br/>NestJS"]
    API --> RATES["rates"]
    RATES -->|en paralelo| M["Maersk"]
    RATES -->|en paralelo| C["CMA CGM"]
    RATES -->|en paralelo| H["Hapag-Lloyd"]
    RATES --> DB[("PostgreSQL<br/>Prisma")]
    API --> CMP["compare"]
    API --> SYNC["strategyko-sync"]
    SYNC -->|"POST versionado"| SK["Strategyko"]
```

**Flujo de una comparación:** `GET /api/compare` → cada naviera se consulta con **8 s de timeout** y hasta **2 reintentos con backoff exponencial** (solo ante errores transitorios) → se guarda lo obtenido → se calcula el análisis. Si una naviera falla, **las demás siguen** y el error se informa por naviera. Con menos de 2 tarifas responde `502` con el detalle.

| Módulo (`backend/src`) | Responsabilidad |
|---|---|
| `carriers` | Interfaz `CarrierAdapter`; adaptadores demo y live (`carriers/live`) |
| `rates` | Consulta en paralelo, timeout, reintentos, persistencia e historial |
| `compare` | Análisis comparativo como función pura (`compare.ts`) |
| `strategyko-sync` | Envío del paquete a Strategyko |
| `health` | Estado del servicio y modo actual |
| `prisma`, `common` | Acceso a datos, guard de API key, utilidades de resiliencia |

## 🚀 Puesta en marcha

**Requisitos:** Node 24, npm y Docker.

```bash
# 1. Base de datos
docker compose up -d

# 2. Backend  →  http://localhost:4000  (Swagger en /api/docs)
cd backend
cp .env.example .env
npm install              # genera el cliente de Prisma automáticamente
npm run db:migrate       # migración inicial
npm run db:seed          # opcional: tarifas demo de ejemplo
npm run start:dev

# 3. Frontend  →  http://localhost:3000   (en otra terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

> [!NOTE]
> - **Puerto de PostgreSQL:** el contenedor publica el **55434** (no el 5432) para no chocar con instalaciones locales.
> - **CORS:** el backend solo acepta el origen indicado en `CORS_ORIGINS` (por defecto `http://localhost:3000`). Si el frontend corre en otro puerto, cámbialo en `backend/.env`.

## 🔌 API

Documentación interactiva en **`/api/docs`** (Swagger).

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado y modo (`demo` / `live`) |
| `GET` | `/api/rates` | Consulta las navieras, guarda y devuelve `quotes[]` y `errors[]` |
| `GET` | `/api/rates/history` | Historial paginado con filtros |
| `GET` | `/api/compare` | Tarifas + análisis comparativo |
| `POST` | `/api/push` | Envío a Strategyko (dry-run sin `STRATEGYKO_URL`, responde `202`) |

**Parámetros:** `origin` (UN/LOCODE de China, obligatorio), `destination` (por defecto `ECGYE`) y `container` (`20GP`, `40GP`, `40HC`; por defecto `40HC`). Los errores de validación llegan como `400` en español.

```bash
curl "http://localhost:4000/api/compare?origin=CNSHA&destination=ECGYE&container=40HC"

curl -X POST http://localhost:4000/api/push \
  -H "content-type: application/json" \
  -d '{"origin":"CNSHA","destination":"ECGYE","container":"40HC"}'
```

<details>
<summary><b>Formato común <code>RateQuote</code></b></summary>

```json
{
  "carrier": "MAERSK | CMA_CGM | HAPAG_LLOYD | MSC",
  "origin": "CNSHA",
  "destination": "ECGYE",
  "container": "40HC",
  "baseFreightUsd": 3321.69,
  "surcharges": [
    { "code": "BAF", "name": "Recargo por combustible (BAF)", "amountUsd": 421.43 }
  ],
  "totalUsd": 4077.77,
  "transitDays": 39,
  "validFrom": "2026-11-09",
  "validTo": "2026-11-22",
  "currency": "USD",
  "source": "demo | live"
}
```

`totalUsd` siempre es `baseFreightUsd` + la suma de los recargos.

</details>

<details>
<summary><b>Contrato de envío a Strategyko</b> (propuesta, pendiente de alinear)</summary>

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

Este formato es una **propuesta propia**, definida a partir del requerimiento; no proviene del backend real de Strategyko. Los cambios futuros deben ser compatibles hacia atrás mediante `schemaVersion`.

</details>

### Probar con Swagger o Postman

- **Swagger:** abre `http://localhost:4000/api/docs`, elige un endpoint, *Try it out* y *Execute*.
- **Postman:** importa [`postman/strategyko-rates.postman_collection.json`](postman/strategyko-rates.postman_collection.json). Trae 6 peticiones con 11 aserciones y las variables `baseUrl` y `apiKey`. También corre por consola: `npx newman run postman/strategyko-rates.postman_collection.json`.

## 🧪 Modo demo y modo live

**Demo (por defecto).** Tarifas simuladas, deterministas por semana ISO: el mismo resultado dentro de la semana y una variación pequeña entre semanas, con perfiles distintos por naviera. La API devuelve `mode: "demo"` con un aviso, y la interfaz muestra el banner **Modo demo** y una insignia en cada fila.

**Live (`RATES_MODE=live`).** Requiere una cuenta en el portal de cada naviera. **Hoy no está operativo:** sin variables de entorno, cada naviera informa cuáles faltan; con ellas, informa que el contrato no está verificado. Nunca cae a demo ni inventa datos.

Para activarlo cuando haya acceso:

1. Abrir la documentación de cada portal: Maersk (*Product Offers and Pricing*), CMA CGM (*Quotation API*) y Hapag-Lloyd (*Quick Quotes / Quick Quotes Spot*).
2. En `backend/src/carriers/live/<naviera>.adapter.ts`, completar `buildRequest()` y `parseResponse()` (y `apiKeyHeader()` si aplica). Cada archivo documenta qué se encontró y qué falta confirmar (`TODO(angel)`).
3. Cargar las variables de entorno y establecer `RATES_MODE=live`.

Ya resuelto y probado: cliente HTTP con clasificación de errores, OAuth2 `client_credentials` con caché de token y validación del mapeo a `RateQuote` (solo USD, montos y fechas válidos, total coherente).

## ⚙️ Variables de entorno

<details>
<summary><b>Backend</b> (<code>backend/.env.example</code>)</summary>

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

</details>

**Frontend** (`frontend/.env.example`): `NEXT_PUBLIC_API_URL` (por defecto `http://localhost:4000`).

Los secretos nunca van en el repositorio: `.env` está ignorado y solo se versionan los `.env.example`.

## ✅ Calidad

```bash
# Backend
cd backend
npm run lint && npx tsc --noEmit
npm test               # unitarios
npm run test:e2e       # integración (requiere PostgreSQL y la base strategyko_rates_test)

# Frontend
cd frontend
npm run lint && npm run typecheck && npm test && npm run build
```

| Suite | Pruebas |
|---|---|
| Backend, unitarias | 72 |
| Backend, integración (supertest + PostgreSQL) | 11 |
| Frontend (Vitest + Testing Library) | 9 |

Verificado en local con lint, tipos y build sin errores. El workflow de [GitHub Actions](.github/workflows/ci.yml) ejecuta los mismos comandos (incluye `prisma migrate deploy`); su sintaxis es válida, pero **aún no se ha ejecutado**.

<details>
<summary>Base de datos de pruebas local</summary>

```bash
docker exec strategyko-rates-db psql -U strategyko -d postgres -c "CREATE DATABASE strategyko_rates_test"
DATABASE_URL=postgresql://strategyko:strategyko@localhost:55434/strategyko_rates_test npm run db:deploy
```

</details>

## 🧠 Decisiones de diseño

- **Cero datos inventados.** Los datos simulados siempre se etiquetan y los errores del modo live son explícitos.
- **Cada métrica muestra su base (`n`).** Sin datos suficientes no hay porcentajes.
- **Análisis como funciones puras.** `compare.ts` no toca la base de datos: es fácil de probar y de razonar.
- **Multi-tenant desde el inicio.** `tenantId` en las tablas principales y filtro obligatorio en las consultas; un test comprueba que el historial nunca devuelve filas de otro tenant. Hoy el tenant sale de una variable de entorno.
- **La API key vive solo en el servidor.** El frontend no la envía: una variable `NEXT_PUBLIC_*` quedaría expuesta en el navegador. Si se activa `SERVICE_API_KEY`, el frontend necesita un proxy del lado del servidor.
- **Migraciones en el pipeline.** `npm run db:deploy` corre en CI y debe correr en el despliegue, no a mano.

## 🗂️ Estructura

```
strategyko-rates/
├── backend/            NestJS + Prisma + PostgreSQL
│   ├── prisma/         esquema, migraciones y seed
│   ├── src/            carriers, rates, compare, strategyko-sync, health…
│   └── test/           pruebas de integración
├── frontend/           Next.js (App Router) + TypeScript
├── postman/            colección de pruebas de la API
├── docs/               capturas
├── docker-compose.yml  PostgreSQL local
└── .github/workflows/  CI
```

## 🚧 Pendientes honestos

| Pendiente | Estado |
|---|---|
| Adaptadores live de Maersk, CMA CGM y Hapag-Lloyd | **Sin contrato verificado.** Faltan credenciales y la documentación de los portales no fue accesible sin sesión. Solo está la infraestructura. |
| Contrato real con Strategyko | **Propuesta propia**, sin validar con su backend. |
| CI en GitHub Actions | Escrito y con sintaxis válida, **aún sin ejecutar**. |
| Autenticación y tenant real | Tenant fijo por variable de entorno. |
| MSC | Fuera de esta entrega: el tipo existe, falta el adaptador. |
| Puerto `CNQIN` | No se pudo verificar como UN/LOCODE; no está en el selector, pero se puede escribir en "otro puerto". |
| Insights del backend | Usan punto decimal (`USD 4077.77`), mientras la interfaz usa formato `es-EC`. |
| Auditoría de dependencias | `npm audit` reportó avisos en ambos proyectos; no se revisaron. |
| Despliegue y staging | No configurados. Recomendación: Railway con servicios separados, primero el backend con `npm run db:deploy`, y siempre pasar por staging antes de producción. |

---

<div align="center">

Hecho por **Angel Loor**

</div>
