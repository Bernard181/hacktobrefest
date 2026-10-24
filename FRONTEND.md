# Frontend — tabela comparativa de preços

Esta especificação descreve a tela pública de preços do MVP em Rio Branco/AC. Ela consome a API definida em `BACKEND.md`. A comparação abaixo organiza os valores fornecidos para os mesmos produtos e quantidades nos mercados Arasuper e Assaí. Como a fonte não trouxe datas de coleta, os preços são valores informados e a validade ainda não pode ser confirmada.

## 1. Tabela de comparação

| Produto | Quantidade | Arasuper | Assaí | Diferença informada | Menor valor informado |
|---|---:|---:|---:|---:|---|
| Arroz Brilhante | 5 kg | R$ 27,99 | R$ 23,49 | R$ 4,50 | Assaí |
| Feijão Dona de | 1 kg | R$ 7,59 | R$ 6,65 | R$ 0,94 | Assaí |
| Açúcar Itamarati | 1 kg | R$ 3,09 | R$ 2,49 | R$ 0,60 | Assaí |
| Café Vovó Pureza | 250 g | R$ 13,99 | R$ 12,49 | R$ 1,50 | Assaí |
| Farinha de trigo Campesina | 1 kg | R$ 5,59 | R$ 3,49 | R$ 2,10 | Assaí |
| **Cesta com os cinco itens** |  | **R$ 58,25** | **R$ 48,61** | **R$ 9,64** | **Assaí** |

A diferença é Arasuper menos Assaí. O menor valor nesta tabela é apenas o menor preço entre os dados recebidos; não deve ser rotulado como oferta atual até a data de coleta ser cadastrada e validada pelo backend.

## 2. Colunas e apresentação

| Coluna/elemento | Conteúdo | Regra de interface |
|---|---|---|
| Produto | Nome, marca e quantidade | Mostrar a quantidade junto ao produto; nunca agrupar tamanhos diferentes. |
| Mercado | Nome do mercado | Uma coluna por mercado retornado pela API; nome vindo do backend. |
| Preço | Valor formatado em `R$` | Converter centavos para reais apenas na apresentação. |
| Diferença | Diferença entre os mercados comparados | Calcular com inteiros em centavos, sem ponto flutuante. |
| Menor preço | Mercado com menor oferta válida | Destacar somente ofertas com `ranked: true`. |
| Coleta | Data de coleta retornada pela API | Mostrar a data; se estiver ausente, indicar “Data não informada” e não declarar preço atual. |
| Estado | Válido, desatualizado ou sem coleta | Usar os campos de validade/ranking da API; preço desatualizado fica visível com aviso e fora do destaque. |

## 3. Regras de busca e ordenação

1. Permitir busca por nome e filtro por categoria conforme os parâmetros da API.
2. Agrupar e comparar somente produtos iguais em descrição, marca e unidade/quantidade.
3. Ordenar ofertas válidas da menor para a maior, conforme o ranking calculado no backend.
4. Exibir empates; quando valores forem iguais, mostrar primeiro a coleta mais recente.
5. Manter preços vencidos visíveis com aviso, mas não tratá-los como vencedores.
6. Mostrar os dados do mercado e a data devolvidos pela API; não completar dados ausentes por suposição.
7. Tratar carregamento, erro de rede e busca sem resultados com mensagens claras.

## 4. Responsividade e acessibilidade

| Cenário | Comportamento esperado |
|---|---|
| Desktop | Tabela com colunas Produto, Quantidade, Arasuper e Assaí; diferença e menor preço claramente identificados. |
| Celular | Reorganizar linhas em cartões ou permitir rolagem horizontal sem cortar valores nem nomes. |
| Estado desatualizado | Selo textual “Preço desatualizado”, além de cor; não depender só da cor para transmitir o estado. |
| Estado sem data | Exibir “Data não informada”; não usar selo de preço atual. |
| Carregamento/erro/vazio | Exibir estado correspondente sem apresentar dados antigos como resposta nova. |

## 5. Fluxo de funcionamento

1. A tela chama `GET /api/v1/products` para catálogo/busca e `GET /api/v1/prices?product_id=...&city=Rio%20Branco` para ofertas.
2. A API devolve preço inteiro em centavos, nome/endereço do mercado, data de coleta e indicadores `valid`/`ranked`.
3. O frontend formata os valores em reais e renderiza uma coluna por mercado.
4. O backend determina validade e ranking segundo as regras de 30 dias; o frontend apresenta os estados e não redefine essas regras.
5. Quando o lojista registra um novo preço e a API confirma, a tela atualiza a comparação consultando novamente as ofertas.

> O repositório ainda não contém componentes ou rotas de frontend. Este arquivo define o comportamento e o formato visual esperado para implementação.
