# REQUISITOS.md — Comparador de Preços de Supermercado (Acre/AC)

> Status: rascunho alinhado para MVP de hackathon
> Última atualização: 24/10/2026
> Prazo: 3 horas · Equipe: 3 pessoas · Entrega: MVP demonstrável

---

## 1. Objetivo

Dar ao consumidor do Acre um lugar único para descobrir **em qual mercado cadastrado no estado um item alimentício está mais barato**, exibindo **preço, nome e endereço do mercado**.

O diferencial do produto é a **API pública de preços**: o mercado que quiser integrar seu sistema de estoque/PDV atualiza os preços automaticamente, sem digitação manual.

### Proposta de valor
- Consumidor: economiza tempo e dinheiro comparando preços dos mercados cadastrados no Acre.
- Lojista: aparece na comparação com o preço correto, sem esforço manual.
- Ecossistema: API aberta permite que terceiros construam sobre os dados.

---

## 2. Decisões fechadas (alinhamento)

| Tema | Decisão |
|---|---|
| Origem dos preços | Painel do lojista + API própria de atualização (push do mercado) |
| Plataforma | Web agora (responsivo); app nativo depois |
| Abrangência | Acre/AC; consultar todos os mercados cadastrados no estado e exibir sua cidade conhecida |
| Contas | Consumidor: login opcional. Lojista: login obrigatório. Perfis distintos |
| Busca | Categoria + nome |
| Frescor do preço | Exibir data de coleta; **preço perde relevância após 30 dias** |
| Corte do MVP | Busca do consumidor + admin mínimo do lojista + API de leitura |
| Auth da API | API key por loja (escrita); leitura pública |
| Dados da demo | Coleta manual na hora, 2–3 mercados |

---

## 3. Escopo do MVP (3 horas)

### Dentro do escopo
1. **Busca do consumidor** (sem login): filtrar por categoria e nome, listar resultados do menor para o maior preço com nome do mercado, endereço, preço e data de coleta.
2. **Cadastro/login do lojista** com perfil separado do consumidor.
3. **Admin mínimo do lojista**: listar seus produtos/preços e atualizar o preço de um item.
4. **API pública de leitura** (JSON) para consulta de mercados, produtos e preços.
5. **Regra de validade**: preços com mais de 30 dias não entram no ranking de "mais barato" e são sinalizados.
6. **Seed de demonstração** com dados coletados manualmente.

### Fora do escopo (explicitamente)
- App mobile nativo, geolocalização e raio de distância.
- Crowdsourcing, scraping, OCR de nota fiscal.
- Integração automática real com PDV (apenas o contrato da API).
- Pagamentos, assinaturas, anúncios.
- Histórico/gráfico de variação de preço, notificações, favoritos.
- Abrangência fora do Acre, CEP e mapa.
- OAuth2, verificação de e-mail, recuperação de senha.
- Moderação antifraude.

### Stretch (só se sobrar tempo)
- `POST /api/v1/prices` autenticado por API key, permitindo que o mercado atualize sem abrir o painel.
- Tela de documentação da API (Swagger/OpenAPI ou página estática com exemplos `curl`).

---

## 4. Atores e perfis

| Ator | Acesso | Permissões |
|---|---|---|
| Consumidor | Sem login (opcional criar conta) | Buscar, comparar, ver detalhes |
| Lojista | Login obrigatório | Gerenciar apenas os preços do **seu** mercado |
| Admin da plataforma | Interno (fora do MVP) | Cadastrar mercados e catálogo base |

> No MVP o cadastro de mercados pode ser feito por seed/script; o lojista recebe credenciais prontas para a demo.

---

## 5. Requisitos funcionais

### Consumidor
- **RF01** — Buscar produtos por nome, com filtro por categoria.
- **RF02** — Exibir resultados ordenados por preço crescente.
- **RF03** — Cada resultado mostra: nome do produto, preço, nome do mercado, endereço e data de coleta do preço.
- **RF04** — Indicar visualmente preço desatualizado (> 30 dias) e excluí-lo do ranking de menor preço.
- **RF05** — Buscar sem autenticação.

### Lojista
- **RF06** — Cadastrar-se/iniciar sessão com e-mail e senha.
- **RF07** — Visualizar somente os preços do mercado vinculado ao seu usuário.
- **RF08** — Criar ou atualizar o preço de um produto do catálogo, informando valor e data de coleta.
- **RF09** — Receber/gerar uma API key da própria loja (hash armazenado; chave exibida uma única vez).
- **RF10** — Perfil `lojista` não acessa funções de consumidor autenticado e vice-versa quando não permitido.

### API pública
- **RF11** — `GET /api/v1/products?category=&q=` lista o catálogo.
- **RF12** — `GET /api/v1/prices?product_id=&state=` retorna preços válidos com mercado, endereço, valor e data de coleta.
- **RF13** — `GET /api/v1/markets` lista mercados da cidade.
- **RF14** — Respostas em JSON, somente leitura, sem autenticação, com CORS liberado.
- **RF15** — (Stretch) `POST /api/v1/prices` com header `X-API-Key`, aceitando apenas o mercado dono da chave.

---

## 6. Regras de negócio

- **RN01** — Preço válido é aquele com `data_coleta >= hoje - 30 dias`.
- **RN02** — O "mais barato" é o menor `valor` entre os preços válidos do produto na cidade.
- **RN03** — Empate: exibir todos os mercados empatados, do mais recente para o mais antigo.
- **RN04** — Preço vencido continua visível apenas como histórico/aviso, nunca como vencedor do ranking.
- **RN05** — `data_coleta` não pode ser futura.
- **RN06** — Preços são **append-only**: atualizar gera novo registro, preservando o histórico.
- **RN07** — Um lojista só escreve em registros do próprio `market_id`.
- **RN08** — API key é única por loja, armazenada como hash e revogável.
- **RN09** — Valores monetários em centavos (inteiro) para evitar erro de ponto flutuante.
- **RN10** — Unidade de medida faz parte do produto (ex.: 5 kg, 1 L, 500 g); não se compara "arroz" com "arroz 5kg" sem unidade.

---

## 7. Modelo de dados (mínimo)

```
market      (id, nome, endereco, bairro, cidade, api_key_hash, ativo)
product     (id, nome, categoria, unidade, ean?, ativo)
price       (id, market_id, product_id, valor_centavos, data_coleta, fonte, created_at)
user        (id, email, senha_hash, role, market_id?, created_at)
```

- `price.fonte`: `painel` | `api`.
- `user.role`: `consumidor` | `lojista`.
- `user.market_id` obrigatório quando `role = lojista`.
- Índices: `price(product_id, data_coleta)`, `product(categoria)`.

---

## 8. Requisitos não funcionais

- **RNF01** — Web responsivo, interface em pt-BR, utilizável em celular.
- **RNF02** — Busca respondendo em < 1 s com o volume da demo (dezenas de produtos).
- **RNF03** — Senhas com hash (bcrypt/argon2); nunca em texto puro.
- **RNF04** — API key nunca retornada após a criação; comparar por hash.
- **RNF05** — HTTPS em produção; segredos em variáveis de ambiente.
- **RNF06** — LGPD: coletar o mínimo (e-mail), sem dados sensíveis; preços e endereços são dados públicos de estabelecimento.
- **RNF07** — Deploy em um único ambiente público acessível por link durante a apresentação.

---

## 9. Arquitetura e stack sugeridas

> Ajustar ao domínio real da equipe — em 3h, **stack conhecida vale mais que stack ideal**.

- **Monólito full-stack**: Next.js (React + API routes) ou FastAPI + front simples.
- **Banco**: SQLite (arquivo) para velocidade; PostgreSQL se já houver instância pronta.
- **Auth**: sessão/JWT simples com e-mail e senha; sem verificação de e-mail.
- **Deploy**: Vercel/Render/Fly ou máquina local exposta; definir na primeira meia hora.

Princípio: **um repositório, um deploy, um banco**. Nada de microserviços em 3h.

---

## 10. Plano de execução (3 pessoas × 3 horas)

| Janela | Atividade |
|---|---|
| 0:00–0:20 | Fechar stack, criar schema, subir repo e deploy vazio |
| 0:20–1:30 | P1: dados/seed + API de leitura · P2: tela de busca · P3: auth + admin do lojista |
| 1:30–2:15 | Integração dos fluxos; coleta manual vira seed do banco |
| 2:15–2:40 | Regra dos 30 dias, estados de erro/vazio, ajustes visuais |
| 2:40–2:50 | Roteiro de demo + dados de apresentação |
| 2:50–3:00 | Ensaio cronometrado e correções finais |

**Divisão sugerida**
- **P1 (dados/backend)**: schema, seed, endpoints de leitura, deploy.
- **P2 (frontend consumidor)**: busca, lista ordenada, selo de preço vencido.
- **P3 (auth/admin)**: login, perfis, CRUD de preço, geração de API key.

**Regra de ouro**: a coleta manual tem **dono e teto** — no máximo 2–3 mercados × 10 produtos, e não pode passar de 40 minutos de uma pessoa.

---

## 11. Critérios de aceite (roteiro da demo)

1. Abrir o site sem login e buscar "arroz" na categoria "Grãos".
2. Ver resultados ordenados do mais barato ao mais caro, com mercado, endereço e data de coleta.
3. Identificar visualmente um preço com mais de 30 dias marcado como desatualizado (e fora do ranking).
4. Logar como lojista, alterar o preço de um item do seu mercado.
5. Recarregar a busca e ver a ordem/valor atualizados.
6. Abrir a API pública (ou `curl`) e mostrar o mesmo dado em JSON.
7. (Stretch) Atualizar via `POST` com `X-API-Key` e ver o reflexo na busca.

---

## 12. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Coleta manual consumir o tempo de dev | Alto | Teto de 40 min, 1 pessoa, 2–3 mercados, planilha pré-formatada |
| Auth com 2 perfis atrasar | Alto | Sessão simples, sem verificação de e-mail; seed de usuários prontos |
| Escopo crescer na hora | Alto | Fora de escopo escrito; stretch só após critérios 1–6 passarem |
| Dados reais com preço fictício gerar problema | Médio | Marcar como demonstração; evitar expor marca de terceiro de forma enganosa |
| Deploy falhar perto do fim | Alto | Deploy vazio na primeira meia hora; fallback local |
| Ambiguidade de unidade (5 kg vs 1 kg) | Médio | Unidade no produto; não comparar grandezas diferentes |

---

## 13. Questões abertas

- Qual stack a equipe já domina? (define a escolha da seção 9)
- Onde será hospedado e quem tem as contas?
- Nome/marca do produto e identidade visual mínima.
- Termos de uso e política de privacidade para a API pública (pós-MVP).
- Estratégia de aquisição dos primeiros mercados (pós-MVP).
- Modelo de monetização (pós-MVP).
