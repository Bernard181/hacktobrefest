# Funcionalidades Esperadas — CompraFácil

Este documento consolida os requisitos obrigatórios do MVP e define como validar cada um. Ele complementa `REQUISITOS.md`, `docs/api.md` e `TESTES.md`; em caso de divergência, `REQUISITOS.md` e o contrato da API prevalecem.

## Objetivo do produto

Permitir que moradores de Rio Branco encontrem produtos básicos e comparem preços por mercado, com unidade equivalente, data de coleta e indicação clara de qual oferta pode ser considerada atual. O lojista deve poder atualizar preços apenas do mercado vinculado à sua conta.

## Funcionalidades obrigatórias do MVP

| ID | Funcionalidade | Regra de aceite | Validação |
|---|---|---|---|
| FE-01 | Catálogo básico | Produto tem nome, marca, categoria e unidade; unidades diferentes permanecem como itens distintos. | UT-10, API-01/02 |
| FE-02 | Busca pública | Buscar sem login por nome/marca, sem diferenciar maiúsculas ou acentos, e filtrar por categoria. Busca vazia não gera erro. | UT-15, API-01/02, SM-01 |
| FE-03 | Comparação em tabela | Para cada produto, mostrar o preço mais recente de cada mercado, marca/unidade, data, endereço quando conhecido e diferença nominal entre ofertas. | UT-17, SM-02, MV-01/02 |
| FE-04 | Ranking transparente | Somente preços válidos entram no ranking; menor valor vence; empates preservam os mercados empatados e priorizam coleta mais recente. | UT-01..08, SM-02 |
| FE-05 | Frescor e verificação dos dados | `verified` registra confirmação da informação; a validade depende da coleta. Preços sem data ficam visíveis, sinalizados e fora do ranking atual. | UT-01..05, UT-16, API-15, SEED-05, SM-03, MV-05 |
| FE-06 | API pública de leitura | `GET /api/v1/products`, `/markets` e `/prices` retornam JSON documentado, sem credenciais, com CORS e estados de erro consistentes. | API-01..09, SM-06 |
| FE-07 | Sessão do lojista | A área de gestão exige autenticação; senha armazenada em hash; sessão usa cookie protegido. | UT-14, SM-04 |
| FE-08 | Isolamento por mercado | O servidor deriva o mercado da sessão e rejeita tentativa de gravar em outro mercado. | UT-12, SM-04 |
| FE-09 | Atualização segura | Validar centavos inteiros positivos e data não futura; nova coleta cria novo registro sem apagar histórico. | UT-09, UT-11, UT-08, SM-04/05 |
| FE-10 | Experiência acessível no celular | Interface em pt-BR com estados de carregamento, vazio e erro; tabela permanece utilizável em telas estreitas. | SM-01, MV-01..05 |
| FE-11 | Seed reproduzível | `npm run db:reset` restaura catálogo, preços informados e fixtures determinísticas sem depender de digitação manual. | SEED-01..04, API-03/04 |
| FE-12 | Qualidade de entrega | Testes unitários/API, typecheck, build e smoke precisam passar antes da entrega. | `npm test`, `npm run typecheck`, `npm run build`, `npm run smoke` |

## Dados de referência dos mercados

Os dez valores fornecidos pelo usuário são armazenados em centavos e associados ao produto equivalente nos dois mercados. Eles ficam **verificados** porque o usuário confirmou que são reais. Como não foram fornecidas datas de coleta nem endereços, a interface não deve inventá-los: exibe a confirmação separada da coleta e mantém as ofertas fora do ranking de preço atual até receber a data.

| Produto e unidade | Marca | Arasuper | Assaí |
|---|---|---:|---:|
| Arroz, 5 kg | Brilhante | R$ 27,99 | R$ 23,49 |
| Feijão, 1 kg | Dona de | R$ 7,59 | R$ 6,65 |
| Açúcar, 1 kg | Itamarati | R$ 3,09 | R$ 2,49 |
| Café, 250 g | Vovó Pureza | R$ 13,99 | R$ 12,49 |
| Farinha de trigo, 1 kg | Campesina | R$ 5,59 | R$ 3,49 |

## Fora do MVP

Aplicativo nativo, geolocalização, múltiplas cidades, scraping, OCR, integração real com PDV, pagamentos, favoritos, notificações, gráficos históricos, cadastro aberto de mercados e API key de escrita. Só devem entrar após os critérios obrigatórios acima estarem aprovados.

## Roteiro curto de aceite

1. Abrir a página inicial sem login e buscar arroz.
2. Conferir a tabela por mercado, unidade, preço e estado da data de coleta.
3. Verificar que preço sem data não recebe selo de preço atual nem entra no ranking.
4. Entrar com a conta local de demonstração e atualizar um preço próprio.
5. Tentar alterar o `market_id`; a API deve rejeitar a operação.
6. Confirmar que a nova oferta aparece na tabela e na API pública.
7. Rodar testes, typecheck, build e smoke.

Conta local de demonstração: `lojista@comprafacil.local` / `demo123`. A conta é criada somente pelo seed local; não deve ser usada em produção.

## Pitch estratégico

**CompraFácil ajuda famílias de Rio Branco a decidir onde comprar cada produto básico com mais informação e menos esforço.** O MVP compara preços equivalentes entre mercados, mostra quando o valor foi coletado e permite que o próprio lojista mantenha a oferta atualizada. A API aberta transforma o catálogo em infraestrutura para futuras integrações.

A estratégia de entrada é começar com poucos mercados e produtos essenciais, priorizando cobertura e confiança dos dados. A próxima expansão deve acontecer quando houver coleta recente suficiente e lojistas ativos; só então ampliar o catálogo e a área atendida. As métricas iniciais são percentual de ofertas verificadas nos últimos 30 dias, mercados com atualização ativa, produtos comparáveis e economia observada por cesta.
