# Plano de paralelização — fase 0 → MVP

> Derivado de `REQUISITOS.md` §10 e `AGENTS.md`. Vale a partir do contrato
> congelado (`docs/api.md`, `db/schema.sql`, `lib/prices.ts`).

## 0. O que está congelado (não mudar sem aviso aos 3 fluxos)

| Artefato | Dono | Conteúdo congelado |
|---|---|---|
| `db/schema.sql` | Integrador | tabelas, CHECKs, triggers append-only, índices |
| `docs/api.md` | Integrador | rotas, query params, JSON, erros, CORS, ordenação |
| `lib/prices.ts` | Backend (superfície: Integrador) | constantes, tipos, assinaturas, `now` injetado |
| `lib/db.ts` | Backend (stub: Integrador) | `getDb()`, `closeDb()`, `databasePath()` |
| `tests/contract.test.ts` | Integrador | guarda de drift entre os três artefatos |

Mudança em qualquer um: atualizar doc + testes no mesmo commit e avisar os
outros dois fluxos antes do merge.

## 1. Frentes e janela (3 pessoas × 3 h)

| Janela | Integrador (P1 dados) | Frontend consumidor (P2) | Auth/Lojista (P3) |
|---|---|---|---|
| 0:00–0:20 | ✅ scaffold, schema, API doc, superfície, deploy preparado | lê contrato; planeja componentes | lê contrato; planeja login/sessão |
| 0:20–1:30 | `db/seed.ts`, `lib/prices.ts` (UT-01..UT-11), `app/api/v1/**` | `app/(public)/**`: busca, lista, selo vencido | `lib/auth.ts`, login, painel, API key |
| 1:30–2:15 | integra seed real + expõe API; smoke | conecta na API; estados vazio/erro | edição de preço ponta a ponta (RN07) |
| 2:15–2:40 | regra dos 30 dias ponta a ponta, revisão de contrato | ajuste visual/responsivo | ajuste de sessão/permissões |
| 2:40–2:50 | deploy final + seed publicado | roteiro da demo | roteiro da demo |
| 2:50–3:00 | ensaio cronometrado | ensaio | ensaio |

## 2. Ordem de merge (evita bloqueio)

1. **Backend**: `db/seed.ts` + `lib/prices.ts` implementado (testes UT) — destrava tudo.
2. **Backend**: `/api/v1/markets` → `/api/v1/products` → `/api/v1/prices` (o front
   usa mock do JSON de `docs/api.md` até aqui; nunca inventa campo).
3. **Frontend**: busca consumindo a API real (o contrato já permite começar antes).
4. **Auth**: login + painel; por último o POST stretch (RF15).
5. **Integrador**: smoke estrito (`SMOKE_STRICT=1`) e deploy.

## 3. Interfaces de handoff (sem conversa)

- Frontend importa **somente** `formatBRL` e tipos de `lib/prices.ts`; toda
  ordenação/validade vem pronta da API (`valido`, `posicao`, `resumo`).
- Auth valida `market_id` no servidor (RN07) e usa `getDb()` de `lib/db.ts`;
  nunca escreve em `lib/prices.ts` nem nas rotas públicas.
- Backend não toca em `app/(public)/**` nem em `app/(merchant)/**`.
- Seed é a única fonte de dados da demo (SEED-01..04); ninguém digita preço na mão.

## 4. Testes por fluxo (obrigatório no mesmo commit)

| Fluxo | Casos |
|---|---|
| Backend | UT-01..UT-11, UT-15, SEED-01..04, API-01..API-09 |
| Auth/Lojista | UT-12..UT-14, API-10..API-14, SM-04, SM-05 |
| Frontend | SM-01..SM-03, SM-06, MV-01..MV-05 (visual via smoke) |
| Integrador | contrato, build, smoke estrito, deploy |

## 5. Riscos de paralelização

| Risco | Mitigação |
|---|---|
| Frontend inventar campo | JSON de exemplo em `docs/api.md` é a única fonte; teste de contrato |
| Backend mudar envelope | aviso aos 3 + atualização do doc e dos fixtures |
| `lib/prices.ts` duplicado no SQL | validade só em JS; SQL só filtra cidade/produto |
| SQLite no serverless | deploy em host com disco (`docs/deploy.md`) |
| Seed atrasar a demo | Backend entrega seed antes da API (janela 0:20–0:50) |
