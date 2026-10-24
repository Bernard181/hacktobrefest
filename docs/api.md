# API pública de preços — contrato v1

> **Status: congelado na fase 0.** Mudança de formato exige atualizar este doc,
> os fixtures de teste e avisar os três fluxos antes do merge.
> Fonte de verdade do produto: `REQUISITOS.md` (RF11–RF14, RN01–RN10).

- Base: `/api/v1`
- Leitura **pública**: sem autenticação, CORS liberado (RF14).
- Formato: JSON UTF-8. Dinheiro **sempre** em centavos (inteiro) — RN09.
- Datas: `data_coleta` = `YYYY-MM-DD`; `created_at` = ISO 8601 UTC
  (`2026-10-24T12:00:00Z`).
- Cidade fixa do MVP: `Rio Branco/AC`.
- `Cache-Control: no-store` em todas as respostas (a demo precisa refletir
  alteração do lojista no reload — SM-05).

## CORS (RF14)

Toda resposta, inclusive `OPTIONS` e erros, envia:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-API-Key
```

`OPTIONS /api/v1/*` responde `204` sem corpo.

## Envelope

Sucesso — objeto com `data` e, quando fizer sentido, `meta`:

```json
{ "data": {}, "meta": {} }
```

Erro — sempre o mesmo envelope, sem stack trace:

```json
{ "error": { "code": "product_not_found", "message": "Produto não encontrado." } }
```

| HTTP | `code` | Quando |
|---|---|---|
| 400 | `invalid_product_id` | `product_id` ausente ou não inteiro em `/prices` |
| 404 | `product_not_found` | `product_id` inexistente ou inativo |
| 404 | `not_found` | rota desconhecida sob `/api/v1` |
| 500 | `internal_error` | falha inesperada (nunca vaza SQL) |
| 401 | `missing_api_key` | POST stretch sem `X-API-Key` |
| 403 | `market_mismatch` | POST stretch com chave de outro mercado (RN07) |
| 400 | `invalid_price` | POST stretch com data futura ou valor ≤ 0 (RN05, RN09) |

Regra: parâmetro de busca em branco (`?category=`) é **ignorado**, nunca 400;
entrada malformada nunca gera `500` (API-09).

---

## GET /api/v1/products

Catálogo, filtrado por categoria e/ou nome (RF11).

### Query

| Param | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `category` | string | não | igualdade exata na categoria, sem diferenciar caixa/acento |
| `q` | string | não | contém no `nome`, sem diferenciar caixa/acento |

Valores vazios = filtro ausente. Sem filtro, devolve o catálogo ativo inteiro
(≤ 40 itens na demo). `q` casa com o **nome do produto** apenas, não com
categoria nem mercado.

### 200

```json
{
  "data": [
    {
      "id": 1,
      "nome": "Arroz Branco",
      "categoria": "Grãos",
      "unidade": "5 kg",
      "ean": null,
      "ativo": true
    },
    {
      "id": 2,
      "nome": "Arroz Branco",
      "categoria": "Grãos",
      "unidade": "1 kg",
      "ean": null,
      "ativo": true
    }
  ],
  "meta": { "total": 2 }
}
```

- `unidade` é parte do produto: nunca misture produtos de unidades diferentes
  no mesmo ranking (RN10).
- Ordem: `nome` asc, depois `unidade` asc (determinística).
- Produto inativo não aparece. Lista vazia → `200` com `data: []` (UT-15).

`curl "http://localhost:3000/api/v1/products?category=Gr%C3%A3os&q=arroz"`

---

## GET /api/v1/prices

Ofertas de **um** produto, com mercado, endereço, valor e data de coleta
(RF12), já ordenadas pela regra de ranking (RN02/RN03/RN04).

### Query

| Param | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `product_id` | inteiro | **sim** | produto existente e ativo; senão 400/404 |
| `city` | string | não | default `Rio Branco/AC`; filtra `market.cidade` |

### Regras de ordenação (não reimplementar no front — vem pronto)

1. Ofertas **válidas** primeiro, por `valor_centavos` crescente (RN02).
2. Empate de valor: `data_coleta` **mais recente** primeiro (RN03).
3. Empate restante: `market.nome` ascendente (estabilidade).
4. Ofertas **vencidas** (`valido: false`) ao final, `data_coleta` desc.
5. `posicao` é 1-based **apenas entre as válidas**; vencida recebe `null`
   (RN04 — vencida nunca vence o ranking, mas continua visível).

Validade = `data_coleta >= hoje - 30 dias`, limite **inclusivo**, calculada
exclusivamente em `lib/prices.ts` (`isPriceValid`). Nunca recalcular no SQL.

### 200

Fixture de `TESTES.md` (P1 = Arroz Branco 5 kg, preço de M3 vencido):

```json
{
  "data": {
    "product": {
      "id": 1,
      "nome": "Arroz Branco",
      "categoria": "Grãos",
      "unidade": "5 kg",
      "ean": null,
      "ativo": true
    },
    "ofertas": [
      {
        "price_id": 102,
        "market_id": 2,
        "market": {
          "id": 2,
          "nome": "Mercado Bosque",
          "endereco": "Rua B, 200",
          "bairro": "Bosque",
          "cidade": "Rio Branco/AC"
        },
        "valor_centavos": 2750,
        "data_coleta": "2026-10-23",
        "fonte": "painel",
        "valido": true,
        "dias_desde_coleta": 1,
        "posicao": 1
      },
      {
        "price_id": 101,
        "market_id": 1,
        "market": {
          "id": 1,
          "nome": "Mercado Centro",
          "endereco": "Rua A, 100",
          "bairro": "Centro",
          "cidade": "Rio Branco/AC"
        },
        "valor_centavos": 2890,
        "data_coleta": "2026-10-24",
        "fonte": "painel",
        "valido": true,
        "dias_desde_coleta": 0,
        "posicao": 2
      },
      {
        "price_id": 103,
        "market_id": 3,
        "market": {
          "id": 3,
          "nome": "Mercado Floresta",
          "endereco": "Rua C, 300",
          "bairro": "Floresta",
          "cidade": "Rio Branco/AC"
        },
        "valor_centavos": 2650,
        "data_coleta": "2026-09-20",
        "fonte": "painel",
        "valido": false,
        "dias_desde_coleta": 34,
        "posicao": null
      }
    ],
    "resumo": {
      "menor_valor_centavos": 2750,
      "vencedores": [{ "price_id": 102, "market_id": 2, "valor_centavos": 2750 }],
      "total_ofertas": 3,
      "total_validas": 2,
      "total_vencidas": 1
    }
  },
  "meta": { "cidade": "Rio Branco/AC", "gerado_em": "2026-10-24T12:00:00Z" }
}
```

- `vencedores` lista **todos** os empatados no menor valor válido (RN03). Sem
  oferta válida → `menor_valor_centavos: null` e `vencedores: []`.
- Histórico completo do produto **não** é exposto: só a leitura mais recente
  por mercado dentro da cidade (a oferta anterior continua no banco, RN06).
- A API **não** devolve `valor_formatado`: formate no cliente com
  `formatBRL()` de `lib/prices.ts` (RN09).
- Produto sem nenhuma oferta → `200` com `ofertas: []` e `resumo` zerado.

### Erros

```json
{ "error": { "code": "invalid_product_id", "message": "product_id é obrigatório e deve ser inteiro." } }
```

```json
{ "error": { "code": "product_not_found", "message": "Produto não encontrado." } }
```

`curl "http://localhost:3000/api/v1/prices?product_id=1"`

---

## GET /api/v1/markets

Mercados ativos da cidade (RF13).

### Query

| Param | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `city` | string | não | default `Rio Branco/AC` |

### 200

```json
{
  "data": [
    {
      "id": 1,
      "nome": "Mercado Centro",
      "endereco": "Rua A, 100",
      "bairro": "Centro",
      "cidade": "Rio Branco/AC",
      "ativo": true
    }
  ],
  "meta": { "total": 1, "cidade": "Rio Branco/AC" }
}
```

Nunca expor `api_key_hash` — nem em erro, nem em log (RN08, RNF04).

`curl "http://localhost:3000/api/v1/markets"`

---

## POST /api/v1/prices — stretch (RF15)

Só depois dos critérios 1–6 da demo passarem. Contrato reservado:

```http
POST /api/v1/prices
X-API-Key: <chave em texto puro>
Content-Type: application/json

{ "product_id": 1, "valor_centavos": 2790, "data_coleta": "2026-10-24" }
```

- `market_id` **não** vem no corpo: vem da chave (RN07).
- `201 Created` com o registro criado (`price_id`, `market_id`, `criado_em`).
- `401` sem chave, `403` chave de outro mercado, `400` data futura / valor ≤ 0.
- Sempre `INSERT`: preço anterior preservado (RN06).

---

## Mapa de rotas do app (não é API)

| Rota | Rota group | Dono | Requisito |
|---|---|---|---|
| `/` | `app/(public)/` | Frontend | RF01–RF05 |
| `/lojista` | `app/(merchant)/lojista/` | Auth/Lojista | RF06–RF10 |
| `/lojista/login` | `app/(merchant)/lojista/login/` | Auth/Lojista | RF06 |

Os route groups existem para separar layouts; `/` e `/lojista` **não** podem
ocupar o mesmo segmento no mesmo grupo.
