# Backend e API — base de preços

Este documento define a origem de dados do MVP de comparação no Acre/AC. Os valores fornecidos para Arasuper e Assaí são a fonte inicial do catálogo. A coleta informada para os dez preços-base ocorreu em 24/10/2026. Os endereços não foram fornecidos e não devem ser presumidos.

## 1. Catálogo inicial

| Código | Produto | Marca | Quantidade | Categoria |
|---|---|---|---:|---|
| P1 | Arroz | Brilhante | 5 kg | Pendente de cadastro |
| P2 | Feijão | Dona de | 1 kg | Pendente de cadastro |
| P3 | Açúcar | Itamarati | 1 kg | Pendente de cadastro |
| P4 | Café | Vovó Pureza | 250 g | Pendente de cadastro |
| P5 | Farinha de trigo | Campesina | 1 kg | Pendente de cadastro |

## 2. Valores fornecidos por mercado

| Produto | Quantidade | Arasuper (centavos) | Assaí (centavos) |
|---|---:|---:|---:|
| Arroz Brilhante | 5 kg | 2799 | 2349 |
| Feijão Dona de | 1 kg | 759 | 665 |
| Açúcar Itamarati | 1 kg | 309 | 249 |
| Café Vovó Pureza | 250 g | 1399 | 1249 |
| Farinha de trigo Campesina | 1 kg | 559 | 349 |

Os valores são inteiros em centavos (`R$ 27,99` → `2799`). A tabela acima é a transcrição canônica dos preços recebidos. Não são fornecidos endereços de loja. Os cadastros de mercado devem receber endereço real antes de servi-lo pela API.

## 3. Modelo de dados

| Entidade | Campos principais | Regra |
|---|---|---|
| `market` | `id`, `nome`, `endereco`, `bairro`, `cidade`, `state`, `ativo` | UF filtra a cobertura estadual; endereço e cidade permanecem dados explícitos do cadastro. |
| `product` | `id`, `nome`, `marca`, `categoria`, `unidade`, `ativo` | A unidade integra a identidade comparável do produto. |
| `price` | `id`, `market_id`, `product_id`, `valor_centavos`, `data_coleta`, `fonte`, `created_at` | Registro append-only; a correção cria outro preço e preserva o anterior. |
| `user` | `id`, `email`, `senha_hash`, `role`, `market_id`, `created_at` | Lojista só gerencia o mercado vinculado à sua conta. |

## 4. Regras de validação e comparação

| Regra | Comportamento obrigatório |
|---|---|
| Validade | É válido o preço com coleta entre hoje e 30 dias atrás, inclusive. Data ausente não é válida para ranking. |
| Ordenação | Ordenar apenas preços válidos por valor crescente. |
| Empate | Exibir todos os mercados empatados; desempate visual pela coleta mais recente. |
| Vencimento | Preço com mais de 30 dias pode continuar visível como desatualizado, mas fica fora do ranking. |
| Data futura | Rejeitar preço com data de coleta futura. |
| Comparabilidade | Comparar somente o mesmo produto, marca e unidade/quantidade. |
| Dinheiro | Armazenar e comparar centavos como inteiro, nunca `float`. |
| Histórico | Atualização cria registro novo; não sobrescreve o valor anterior. |
| Autorização | Escrita deve conferir no servidor que o usuário/chave pertence ao `market_id` informado. |
| API key | Guardar somente hash SHA-256; nunca retornar ou registrar a chave após sua criação. |
| Dados faltantes | Não inventar categoria, endereço nem data. Exigir cadastro/coleta antes de afirmar que são atuais. |

## 5. Contrato da API pública

Todas as rotas públicas são JSON, sem autenticação, com CORS habilitado.

| Método e rota | Parâmetros | Resultado |
|---|---|---|
| `GET /api/v1/products` | `q`, `category` opcionais | Catálogo, incluindo marca e unidade para identificar itens comparáveis. |
| `GET /api/v1/markets` | `state` opcional; padrão `AC`, cobertura estadual | Mercados ativos com nome e endereço cadastrado. |
| `GET /api/v1/prices` | `product_id` e `state` | Ofertas do produto, com preço em centavos, mercado/endereço, coleta, validade e indicação se participa do ranking. |

Exemplo de resposta de preço com data de coleta informada:

```json
{
  "product": { "id": "P1", "name": "Arroz", "brand": "Brilhante", "unit": "5 kg" },
  "offers": [
    {
      "market": { "id": "M1", "name": "Arasuper", "address": "endereço cadastrado" },
      "price_cents": 2799,
      "collected_at": "data ISO 8601 fornecida pelo mercado",
      "valid": true,
      "ranked": true,
      "source": "painel"
    }
  ]
}
```

O endereço no exemplo é marcador explicativo. A data 2026-10-24 é a coleta informada pelo usuário para os preços-base. A validade deve continuar sendo derivada da data pela regra de 30 dias.

## 6. Entrada e persistência

1. O lojista envia produto, valor e data pelo painel; a API de escrita (stretch definido em `REQUISITOS.md`) aceita `X-API-Key`.
2. O backend valida centavos positivos, data não futura, produto ativo e autorização do mercado.
3. O backend insere um novo registro `price`, com fonte `painel` ou `api`; não atualiza registros anteriores.
4. A API pública entrega dados ao frontend. O frontend não calcula validade com regra própria: usa os indicadores derivados no backend.

> O repositório não tem implementação de banco ou rotas ainda. Este arquivo é o contrato e a estrutura de dados para orientar a implementação.
