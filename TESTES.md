# TESTES.md — Plano de Testes do MVP

> Derivado de `REQUISITOS.md` (RF/RN) e `AGENTS.md` (fluxo por issue).
> Status: **implementado** — testes unitários, API e smoke estão no repositório; comandos verificados no scaffold atual.
> Runner padrão: Vitest (Next.js). Se a stack mudar, preserve os mesmos IDs e casos.

## 1. Estratégia

Três camadas, da mais barata para a mais cara:

| Camada | O que cobre | Onde roda | Quando |
|---|---|---|---|
| **Unitária** | Regras de negócio puras (`lib/prices.ts`, `lib/auth.ts`) | `npm test` | A cada commit |
| **API** | Contrato JSON, CORS, auth por API key | `npm test` | A cada commit |
| **Smoke/E2E** | Critérios de aceite 1–7 da demo | `npm run smoke` | Antes de integrar |

Regras:
- Toda issue nova adiciona **pelo menos um caso** desta lista e referencia o ID no commit.
- Bug fix exige caso de regressão que **falha antes** e passa depois.
- **P0** bloqueia a demo; **P1** importante; **P2** só se sobrar tempo.
- Proibido `skip`/`todo` para "resolver depois".

## 2. Como executar

```bash
npm run db:reset   # banco limpo + fixtures
npm test           # unitários + API
npm run typecheck
npm run smoke      # assume dev server em localhost:3000
```

Ordem obrigatória: **`db:reset` → `test` → `typecheck` → `smoke`**. O `smoke` depende de servidor no ar e banco recém-semeado.

## 3. Fixtures (dados determinísticos)

Relógio fixo de referência: `AGORA = 2026-10-24T12:00:00Z`. **Nunca** use `Date.now()` dentro da regra; injete o relógio para não gerar teste instável.

**Mercados**

| ID | Nome | Endereço |
|---|---|---|
| M1 | Mercado Centro | Rua A, 100 — Centro, Rio Branco/AC |
| M2 | Mercado Bosque | Rua B, 200 — Bosque, Rio Branco/AC |
| M3 | Mercado Floresta | Rua C, 300 — Floresta, Rio Branco/AC |

**Produtos**

| ID | Nome | Categoria | Unidade |
|---|---|---|---|
| P1 | Arroz Branco | Grãos | 5 kg |
| P2 | Arroz Branco | Grãos | 1 kg |
| P3 | Leite Integral | Laticínios | 1 L |
| P4 | Feijão Carioca | Grãos | 1 kg |

**Preços**

| Produto | Mercado | Valor (centavos) | Coleta | Situação |
|---|---|---|---|---|
| P1 | M1 | 2890 | 2026-10-24 | válido |
| P1 | M2 | 2750 | 2026-10-23 | válido — **mais barato** |
| P1 | M3 | 2650 | 2026-09-20 | **vencido** (34 dias) |
| P4 | M1 | 1990 | 2026-10-20 | empate |
| P4 | M2 | 1990 | 2026-10-22 | empate — **mais recente** |
| P3 | M1 | 499 | 2026-10-24 | válido |
| P3 | M2 | 519 | 2026-10-24 | válido |
| P3 | M3 | 450 | 2026-10-30 | **futuro — inválido** |

## 4. Casos unitários (domínio)

| ID | Cenário | Esperado | Req. | Pri |
|---|---|---|---|---|
| UT-01 | Preço coletado há 29 dias | válido | RN01 | P0 |
| UT-02 | Preço coletado há exatamente 30 dias | válido (limite inclusivo) | RN01 | P0 |
| UT-03 | Preço coletado há 31 dias | inválido | RN01 | P0 |
| UT-04 | Ranking de P1 | exclui M3; vencedor M2 (2750) | RN01, RN02 | P0 |
| UT-05 | Preço vencido na listagem | continua retornado com `valido: false`/flag | RN04 | P0 |
| UT-06 | Empate de P4 | retorna M1 e M2; M2 (mais recente) primeiro | RN03 | P1 |
| UT-07 | Formatar 2890 centavos | `R$ 28,90` | RN09 | P0 |
| UT-08 | Somar/comparar valores | inteiros, sem artefato de float | RN09 | P1 |
| UT-09 | `data_coleta` futura | rejeitada na escrita | RN05 | P0 |
| UT-10 | P1 (5 kg) vs P2 (1 kg) | não entram no mesmo ranking | RN10 | P1 |
| UT-11 | Atualizar preço existente | cria novo registro; anterior permanece | RN06 | P0 |
| UT-12 | Lojista de M1 grava em M2 | rejeitado no servidor | RN07 | P0 |
| UT-13 | Gerar API key | armazenada como hash SHA-256; texto puro exibido uma vez | RN08 | P1 |
| UT-14 | Senha do usuário | armazenada com hash, nunca em texto puro | RNF03 | P0 |
| UT-15 | Busca sem resultados | retorna `[]`, sem erro | RF01 | P1 |
| UT-16 | Preço sem `data_coleta` | permanece visível com `valido: false` e fora do ranking | RN01, RN04 | P0 |
| UT-17 | Comparação de duas ofertas sem data | exibe diferença nominal em centavos sem atribuir vencedor atual | RF02, RN09 | P0 |
| UT-18 | Cadastro público e acesso do lojista | e-mail único, senha protegida e mercado ativo não-demo vinculados; login concede acesso ao painel | RF06, RN07, RNF03 | P0 |

### Exemplo de teste (nomes ilustrativos)

O Integrador congela a assinatura real em `lib/prices.ts`; o padrão abaixo é o esperado.

```ts
import { describe, it, expect } from 'vitest'
import { isPriceValid } from './prices'

const NOW = new Date('2026-10-24T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

describe('RN01 — validade de 30 dias', () => {
  it('aceita 29 dias', () => {
    expect(isPriceValid({ data_coleta: daysAgo(29) }, NOW)).toBe(true)
  })
  it('aceita exatamente 30 dias', () => {
    expect(isPriceValid({ data_coleta: daysAgo(30) }, NOW)).toBe(true)
  })
  it('rejeita 31 dias', () => {
    expect(isPriceValid({ data_coleta: daysAgo(31) }, NOW)).toBe(false)
  })
})
```

## 4.1 Seed e integridade dos dados

| ID | Cenário | Esperado | Pri |
|---|---|---|---|
| SEED-01 | Após `db:reset` | 3 mercados fictícios ativos em Rio Branco, todos com `state=AC` | P0 |
| SEED-02 | Fixture do P1 | preço em M1, M2 e M3; exatamente um com mais de 30 dias | P0 |
| SEED-03 | Fixture do P4 | dois preços iguais em mercados distintos, com datas diferentes | P1 |
| SEED-04 | Sanidade dos preços | nenhuma `data_coleta` futura; todo valor inteiro > 0 | P0 |
| SEED-05 | Preços reais informados | os 10 valores Arasuper/Assaí têm `verified=1` e `collected_at=2026-10-24` | P0 |
| BOOT-01 | Inicialização em banco vazio e legado | migra `image_url`, carrega catálogo real uma vez e preserva dados após chamadas repetidas | RF11, RF12 | P0 |

## 5. Casos de API (integração)

| ID | Cenário | Esperado | Req. | Pri |
|---|---|---|---|---|
| API-01 | `GET /api/v1/products?category=Grãos` | só produtos da categoria | RF11 | P0 |
| API-02 | `GET /api/v1/products?q=arroz` | encontra P1/P2, sem diferenciar caixa/acento | RF11 | P0 |
| API-03 | `GET /api/v1/prices?product_id=P1` | JSON com valor, mercado, endereço e data de coleta | RF12 | P0 |
| API-04 | Preço de M3 (vencido) | fora do ranking, com flag de desatualizado | RF12, RN04 | P0 |
| API-05 | `product_id` inexistente | resposta consistente (`404` ou `[]`), documentada | RF12 | P1 |
| API-06 | Qualquer GET público | header CORS presente | RF14 | P0 |
| API-07 | GET sem credencial | responde `200` | RF14, RF05 | P0 |
| API-08 | `GET /api/v1/markets` | mercados do Acre com `state=AC`, nome e cidade cadastrada | RF13 | P1 |
| API-09 | Query inválida (`category` vazia, `product_id` malformado) | `400` ou lista vazia, nunca `500` | RF11/RF12 | P1 |
| API-15 | Preços-base confirmados e datados | os 10 preços mostram coleta 2026-10-24 e ficam válidos/rankeados dentro dos 30 dias | RF12, RN01 | P0 |
| API-16 | Atualização autenticada pelo lojista | registro novo recebe `verified: true` e a coleta informada | RF08, RN06 | P0 |
| API-17 | Filtro estadual `state=AC` | mercados e preços de qualquer município do Acre cadastrado são incluídos | RF13 | P0 |
| API-18 | `GET /api/v1/products` | `image_url` é caminho local existente para imagens ilustrativas | RF11 | P1 |
| API-10 | `POST /api/v1/prices` sem `X-API-Key` | `401` | RF15 | P2 |
| API-11 | POST com chave de outro mercado | `403` | RF15, RN07 | P2 |
| API-12 | POST válido | `201`; preço aparece no GET | RF15 | P2 |
| API-13 | POST com data futura ou valor ≤ 0 | `400` | RN05, RN09 | P2 |
| API-14 | POST sobre preço existente | novo registro; anterior preservado | RN06 | P2 |

> API-10 a API-14 são *stretch*: só entram depois dos critérios 1–6 da demo.

## 6. Smoke / aceite (roteiro da demo)

| ID | Passo | Esperado | Req. |
|---|---|---|---|
| SM-01 | Abrir o site sem login e buscar "arroz" em Grãos | resultados aparecem sem autenticação | RF05, RF01 |
| SM-02 | Conferir a lista | ordem crescente; nome do mercado, endereço, preço e data visíveis | RF02, RF03 |
| SM-03 | Localizar o preço de M3 | marcado como desatualizado e fora do ranking | RF04 |
| SM-04 | Logar como lojista e alterar um preço | alteração aceita só no próprio mercado | RF06–RF08 |
| SM-05 | Recarregar a busca | nova ordem/valor refletidos | RF08 |
| SM-06 | Abrir a API pública (`/api/v1/prices?product_id=...`) | mesmo dado em JSON | RF12 |
| SM-07 | (Stretch) POST com `X-API-Key` | `201` e reflexo na busca | RF15 |

## 7. Verificação manual / visual

| ID | Cenário | Esperado | Pri |
|---|---|---|---|
| MV-01 | Viewport 375 px | layout utilizável, sem rolagem horizontal | P1 |
| MV-02 | Textos da interface | pt-BR correto | P1 |
| MV-03 | Dados semeados | rotulados como demonstração | P1 |
| MV-04 | Busca vazia / erro de rede | estado vazio e mensagem clara | P1 |
| MV-05 | Preço vencido | selo visível e legível | P0 |
| MV-06 | Lista de produtos | busca opcional, seis itens por página, contraste entre linhas e paginação funcional | RF01, RF11 | P1 |
| MV-07 | Estado sem seleção | tabela e localização dos mercados ficam ocultas até selecionar um produto | RF02, RF03 | P0 |
| MV-08 | Cadastro público de lojista | escolher mercado revela localidade; cadastro concluído permite login e painel | RF06, RF07 | P0 |

## 8. Rastreabilidade

### Requisitos funcionais

| RF | Casos |
|---|---|
| RF01 | UT-15, API-01, API-02, SM-01 |
| RF02 | UT-04, UT-06, UT-17, SM-02 |
| RF03 | API-03, SM-02 |
| RF04 | UT-03, UT-05, UT-16, SM-03, MV-05 |
| RF05 | API-07, SM-01 |
| RF06 | SM-04 |
| RF07 | UT-12, API-11, SM-04 |
| RF08 | API-12, API-16, SM-04, SM-05 |
| RF09 | UT-13 |
| RF10 | UT-12, API-11 |
| RF11 | UT-15, API-01, API-02, API-09 |
| RF12 | API-03, API-04, API-05, API-15, SM-06 |
| RF13 | API-08 |
| RF14 | API-06, API-07 |
| RF15 | API-10 a API-14, SM-07 |

### Regras de negócio

| RN | Casos |
|---|---|
| RN01 | UT-01, UT-02, UT-03, UT-04, UT-16, API-15 |
| RN02 | UT-04 |
| RN03 | UT-06 |
| RN04 | UT-05, UT-16, API-04, SM-03 |
| RN05 | UT-09, API-13 |
| RN06 | UT-11, API-14 |
| RN07 | UT-12, API-11 |
| RN08 | UT-13 |
| RN09 | UT-07, UT-08, API-13 |
| RN10 | UT-10 |

## 9. Estrutura sugerida

```text
lib/prices.test.ts      # UT-01..UT-11, UT-15
lib/auth.test.ts        # UT-12..UT-14
tests/api.test.ts       # API-01..API-14
tests/smoke.test.ts     # SM-01..SM-07
```

Convenção: `describe('RN01 — validade de 30 dias')` e `it('aceita exatamente 30 dias')`, em pt-BR, referenciando o ID no nome quando útil.

## 10. Requisitos de testabilidade

- Regras puras recebem `now` por parâmetro; nada de relógio global.
- Banco de teste isolado e resetado antes de cada suíte (`db:reset`), sem depender de ordem de execução.
- Fixtures em código/seed versionado, nunca digitadas à mão na demo.
- Testes unitários sem rede e sem servidor.
- `smoke` usa texto visível/rota, não seletor CSS frágil.

## 11. Fora de escopo

Carga e performance além do volume da demo, pentest, matriz de navegadores, acessibilidade completa (WCAG), app nativo e integração real com PDV. Não bloqueiam a entrega.
