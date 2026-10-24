# AGENTS.md — Comparador de Preços (MVP 3h)

Instruções para agentes que trabalham neste repositório. Leia `REQUISITOS.md` antes de codar: ele é a fonte de verdade do produto.

## Fonte de verdade

- `REQUISITOS.md` manda em **comportamento de produto**: escopo, regras de negócio, critérios de aceite.
- A seção 2 ("Decisões fechadas") está **congelada**. Não reabra essas decisões nem pergunte de novo.
- Config/scripts mandam em **como rodar**. Se código e doc divergirem, corrija o doc na mesma tarefa.
- Estado atual: scaffold full-stack implementado em Next.js App Router, TypeScript e SQLite.

## Stack adotada

Monólito Next.js (App Router, TypeScript) + SQLite. Um repo, um deploy, um banco — nada de microserviços.
Esta stack está configurada no scaffold. Se o projeto mudar, atualize esta seção antes de paralelizar agentes.

## Modelo multiagente

Um agente integrador + três agentes de fluxo, espelhando o plano da seção 10 do `REQUISITOS.md`.

| Papel | Pode escrever | Não escreve |
|---|---|---|
| **Integrador** | `package.json`, lockfile, `tsconfig`, `next.config`, `app/layout.tsx`, `db/schema.sql`, `docs/api.md`, deploy | features de fluxo |
| **Backend/Dados** | `app/api/**`, `lib/db.ts`, `lib/prices.ts`, `db/seed.*` | UI, auth, `package.json` |
| **Frontend consumidor** | `app/(public)/**`, `components/consumer/**` | `lib/**`, API, auth |
| **Auth/Lojista** | `app/(merchant)/**`, `lib/auth.ts`, `proxy.ts`, `components/merchant/**` | `lib/prices.ts`, API pública |

Regras:
- **Um dono por caminho.** Não edite arquivo de outro papel; peça a mudança ao dono.
- Só o **Integrador** roda `npm install`, migrations/seed global, dev server e deploy.
- Os demais leem o contrato e codam contra ele; o Integrador mantém o servidor de pé.
- Commits pequenos e frequentes. Nunca `git checkout`, `reset --hard`, `clean` ou troca de branch no workspace compartilhado — use worktree/branch próprio e rebase antes de integrar.
- Não reformate arquivos que você não possui.

## Fluxo por issue (obrigatório)

Toda issue nova segue este ciclo. Não existe "depois eu testo". Casos, fixtures e rastreabilidade estão em `TESTES.md`: toda issue referencia um ID de lá (`UT-*`, `SEED-*`, `API-*`, `SM-*`, `MV-*`).

1. **Issue** — título no padrão `feat: ...`, `fix: ...` ou `refactor: ...`; corpo com critério de aceite e plano de teste (o que será automatizado).
2. **Teste junto** — a mudança entra com teste automatizado no mesmo commit. Bug fix exige teste de regressão que **falha antes** e passa depois.
3. **Verificação** — `npm test` e `npm run typecheck` verdes antes do commit; `npm run smoke` antes de integrar.
4. **Commit** — commits pequenos do mesmo issue; mensagem no padrão abaixo.

Cobertura mínima obrigatória (regras de negócio em `lib/prices.ts` e auth):

- validade de 30 dias no limite (29, 30 e 31 dias);
- preço vencido fora do ranking, mas visível e sinalizado;
- desempate por data (RN03);
- append-only: atualizar preço cria novo registro (RN06);
- lojista não escreve em outro `market_id` (RN07);
- centavos sem arredondamento (RN09).

UI puramente visual pode ser coberta pelo `smoke`; lógica de negócio, não.

### Commits

Tipos permitidos: **`feat`**, **`fix`**, **`refactor`**. Proibido `wip`, `update`, `changes`, `ajustes`, `correções`.

```
tipo(escopo): descrição no imperativo, minúscula, sem ponto final
```

```text
feat(busca): filtrar produtos por categoria e nome
fix(precos): excluir preço vencido do ranking
refactor(api): isolar regra de validade em lib/prices
```

- Escopo = área tocada (`busca`, `precos`, `api`, `auth`, `admin`, `seed`).
- Doc, config ou seed sem mudança de comportamento entram como `refactor(docs|infra|seed)`.
- Branch: `<tipo>/<slug>` (ex.: `feat/busca-categoria`).
- Um commit = uma intenção; não misture `refactor` com `feat`.
- O commit que introduz comportamento **inclui seu teste**. Commit separado de teste não substitui isso.
- Nunca commitar com teste vermelho ou `skip` para "resolver depois".

## Contrato compartilhado (congelar nos primeiros 20 min)

O Integrador publica, antes dos fluxos paralelos:

1. `db/schema.sql` — tabelas `market`, `product`, `price`, `user` da seção 7.
2. `docs/api.md` — formato exato de `GET /api/v1/products`, `/prices`, `/markets` (RF11–RF14).
3. Superfície de `lib/prices.ts` — validade de 30 dias, ranking de menor preço e formatação de moeda.

Depois disso, mudança de schema ou de resposta JSON **exige** atualizar o doc e avisar os outros agentes. UI nunca inventa campo que a API não devolve.

## Invariantes que agentes costumam errar

- **Dinheiro em centavos (inteiro)** em todo o domínio; converter para `R$` só na renderização (RN09).
- **Regra dos 30 dias em um único lugar** (`lib/prices.ts`). Não duplicar em SQL e em JS — as duas versões divergem.
- **Preço é append-only** (RN06): atualizar = `INSERT`, nunca `UPDATE` no valor.
- **Preço vencido não ganha ranking**, mas continua visível sinalizado (RN01, RN04).
- **Lojista só escreve no próprio `market_id`** (RN07). Validar no servidor, não só esconder no front.
- **Não comparar produtos de unidades diferentes** (RN10): `5 kg` e `1 kg` são ofertas distintas.
- **`data_coleta` não pode ser futura** (RN05). Datas em ISO 8601.
- **API key**: guardar apenas hash SHA-256, exibir uma única vez, nunca logar (RN08, RNF04).
- **Leitura pública**: CORS liberado, sem auth (RF14). Escrita via API é *stretch*, com `X-API-Key` (RF15).
- **Interface em pt-BR** e responsiva (RNF01).

## Comandos

O Integrador mantém estes scripts sincronizados com `package.json`:

```bash
npm run dev        # servidor local
npm run db:reset   # aplica schema + seed de demonstração
npm test           # testes unitários (regras de negócio) — obrigatório
npm run test:watch # testes durante o desenvolvimento
npm run smoke      # valida os critérios de aceite 1–6 contra localhost:3000
npm run typecheck
```

O `npm run smoke` depende de um servidor local em `localhost:3000` e de banco semeado.

## Dados da demo

- Coleta manual: **2–3 mercados × ~10 produtos**, teto de 40 min, um único responsável.
- Seed obrigatório: um produto presente em **3 mercados** e pelo **menos um preço com mais de 30 dias** (para demonstrar RN04).
- Mercados reais com preços fictícios devem estar rotulados como **demonstração**.

## Definição de pronto

O MVP está pronto quando os passos **1–6** da seção 11 do `REQUISITOS.md` rodam ao vivo, incluindo a API respondendo JSON, com `npm test` e `npm run typecheck` verdes. Nenhuma issue é considerada entregue sem o teste automatizado da regra que alterou. O *stretch* (POST com API key, docs da API) só começa depois disso.

## Guarda de escopo

Proibido no MVP: app nativo, geolocalização/raio, crowdsourcing, scraping, OCR, pagamentos, notificações, favoritos, mapa, multi-cidade, OAuth2, verificação de e-mail, antifraude. Lista completa na seção 3 do `REQUISITOS.md`. Na dúvida, **não implemente** — registre como pós-MVP.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
