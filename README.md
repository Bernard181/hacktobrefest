# Comparador de Preços — Rio Branco/AC

Descubra em qual supermercado da cidade um item alimentício está mais barato.
Busca por categoria e nome, ranking do menor preço, selo de preço desatualizado
(> 30 dias) e API pública em JSON.

> **Demonstração:** mercados reais com preços fictícios. Não use como
> referência de compra.

- Fonte de verdade do produto: [`REQUISITOS.md`](./REQUISITOS.md)
- Regras para agentes: [`AGENTS.md`](./AGENTS.md)
- Plano de testes: [`TESTES.md`](./TESTES.md)
- **Contrato da API (congelado):** [`docs/api.md`](./docs/api.md)
- Deploy: [`docs/deploy.md`](./docs/deploy.md)

## Stack

Next.js 15 (App Router, TypeScript) + SQLite (`better-sqlite3`), monólito
full-stack, um único deploy. Testes com Vitest.

## Como rodar

Requisitos: Node 22+.

```bash
npm install
npm run db:reset   # aplica db/schema.sql (+ db/seed.ts, quando existir)
npm run dev        # http://localhost:3000
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor local |
| `npm run db:reset` | recria o banco a partir do schema e do seed |
| `npm test` | testes unitários e de contrato |
| `npm run test:watch` | testes em watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run smoke` | critérios de aceite contra `localhost:3000` |
| `npm run build` / `npm start` | build e execução de produção |

`npm run smoke` aceita `SMOKE_BASE_URL` (default `http://localhost:3000`) e
`SMOKE_STRICT=1` (PENDING conta como falha após a integração).

### Windows

Se `npm` for bloqueado por Execution Policy:

```powershell
npm.cmd install
npm.cmd run dev
```

O npm 11 pede aprovação de scripts de instalação; autorize o binário nativo:

```powershell
npm.cmd install-scripts approve better-sqlite3 esbuild
```

## Rotas

| Rota | Descrição |
|---|---|
| `/` | busca do consumidor (sem login) |
| `/lojista` | painel do lojista (login obrigatório) |
| `/lojista/login` | entrada do lojista |
| `/api/v1/products` | catálogo (`?category=&q=`) |
| `/api/v1/prices` | ofertas rankeadas de um produto (`?product_id=&city=`) |
| `/api/v1/markets` | mercados da cidade |

## Estrutura

```text
app/(public)/         # consumidor
app/(merchant)/       # lojista
app/api/v1/           # API de leitura
db/schema.sql         # schema SQLite (contrato)
db/reset.ts           # recria banco + seed
lib/db.ts             # conexao SQLite
lib/prices.ts         # validade 30 dias, ranking, formatacao (RN01-RN10)
docs/api.md           # contrato JSON congelado
tests/                # contrato + unitarios + API
scripts/smoke.mjs     # criterios de aceite
```

## Estado do MVP (fase 0)

Scaffold no ar, contrato congelado (`docs/api.md`, `db/schema.sql`,
`lib/prices.ts`) e testes de contrato verdes. Busca, API e auth entram nas
issues de fluxo, em paralelo, cada uma com seu teste automatizado.
