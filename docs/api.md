# Contrato congelado — API v1 e domínio

Este contrato foi publicado antes dos fluxos paralelos. Backend implementa estes formatos; frontend consome sem renomear nem inferir campos; auth fornece a sessão de lojista conforme o contrato de autenticação. Mudança posterior exige atualizar este documento e avisar todos os fluxos.

## Domínio e banco

O schema em `db/schema.sql` é a fonte de verdade. IDs são strings estáveis. Dinheiro é sempre inteiro em centavos. `verified` indica que a informação foi confirmada pelo usuário responsável ou por um lojista autenticado; não significa que o preço foi coletado recentemente. `collected_at` pode ser `null`; sem data, a oferta permanece fora do ranking.

## GET /api/v1/products?q=&category=

- Público, JSON, CORS `*`.
- `q` busca sem diferenciar caixa ou acentos; `category` filtra por igualdade sem diferenciar caixa.
- `200`: `{ "items": Product[] }`.
- Produto: `{ "id": string, "name": string, "brand": string, "category": string, "unit": string }`.
- Sem resultados: `200 { "items": [] }`.

## GET /api/v1/markets?state=

- Público, JSON, CORS `*`; `state` omitido significa `AC`, e a consulta abrange os municípios desse estado. Mercados preservam sua cidade cadastrada; cobertura estadual não presume filiais ou endereços.
- `200`: `{ "items": Market[] }`.
- Mercado: `{ "id": string, "name": string, "address": string | null, "neighborhood": string | null, "city": string, "state": string, "demo": boolean }`.

## GET /api/v1/prices?product_id=&state=

- Público, JSON, CORS `*`; `product_id` é obrigatório; `state` omitido significa `AC` e filtra as ofertas de todo o estado.
- `200`: `{ "product": Product, "offers": Offer[] }`; produto inexistente: `404 { "error": "Produto não encontrado" }`.
- Oferta: `{ "id": string, "market": Market, "price_cents": number, "collected_at": string | null, "verified": boolean, "valid": boolean, "ranked": boolean, "source": "painel" | "api" | "seed" }`. Uma coleta enviada por lojista autenticado recebe `verified: true`.
- A resposta inclui o registro mais recentemente inserido para cada mercado. O histórico completo permanece append-only no banco; esta rota compara a oferta atual de cada mercado.
- Ofertas válidas vêm primeiro por preço crescente; empates vêm por coleta mais recente. Preços vencidos e sem data permanecem visíveis após as válidas, com `ranked: false`. `valid` só é `true` quando a coleta está dentro dos últimos 30 dias inclusivos.

## Regras compartilhadas de domínio

Backend implementa em `lib/prices.ts`; frontend não replica a validade.

- `isPriceValid(price, now)` recebe `collected_at` como ISO `YYYY-MM-DD | null` e `now` como `Date`.
- `rankPrices(prices, now)` devolve todas as ofertas, com flags `valid`/`ranked`, em ordem válida crescente, empate por data recente, vencidas em seguida e sem data por último.
- `formatPrice(cents)` converte inteiro em centavos para moeda `pt-BR`.
- Limite inclusivo: exatamente 30 dias é válido; 31 dias não.
- Datas futuras são inválidas e devem ser rejeitadas na escrita.
- Nunca comparar produtos com unidades diferentes.

## Autenticação e escrita do lojista

- `lib/auth.ts` exporta `SessionUser = { id: string; email: string; role: 'consumer' | 'merchant'; marketId: string | null }`, `getSessionUser(): Promise<SessionUser | null>`, `requireMerchant(): Promise<SessionUser>` (lança `AuthError` com status `401` ou `403`), `signIn(email, password): Promise<SessionUser | null>`, `signOut(): Promise<void>` e `hashPassword(password): Promise<string>` para o seed.
- Cookie de sessão HttpOnly, SameSite=Lax, Secure em produção; senhas com hash.
- `POST /api/merchant/prices` aceita sessão de lojista e `{ product_id, value_cents, collected_at }`; market_id vem da sessão, nunca do corpo. Insere preço append-only. Erros: `400` validação, `401` sem sessão, `403` role/loja inadequada.
- API key / `POST /api/v1/prices` é stretch e não será implementado nesta entrega do MVP.

Rotas privadas do painel:

- `GET /api/merchant/prices`: exige sessão `merchant`; retorna `{ "items": Offer[] }` somente do `market_id` da sessão.
- `POST /api/merchant/prices`: exige sessão `merchant`; corpo `{ "product_id": string, "value_cents": number, "collected_at": "YYYY-MM-DD" }`. `market_id` do corpo é ignorado/rejeitado; o vínculo vem da sessão. Sucesso `201` com registro criado; `400` validação, `401` sem sessão e `403` sem vínculo lojista.

## Seed e demonstração

Os preços fornecidos para Arasuper e Assaí são incluídos com `verified: true` e `collected_at: 2026-10-24`, data de coleta informada pelo usuário. A API permite consultar todos os municípios do Acre (`state=AC`). Os dois mercados-base estão cadastrados em Rio Branco, pois não foram informados outros municípios nem endereços; cobertura estadual não significa que existam filiais cadastradas em todo o estado. Fixtures com endereços/dados fictícios dos testes precisam ser marcadas `demo: true` e claramente rotuladas na interface.
