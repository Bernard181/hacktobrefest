# CompraFácil — Acre/AC

Comparador de preços de mercados com catálogo inicial, busca pública e painel de lojista. O contrato da API está em [`docs/api.md`](docs/api.md); requisitos de produto em [`REQUISITOS.md`](REQUISITOS.md).

## Stack e execução

Next.js App Router, TypeScript e SQLite.

```bash
npm install
npm run db:reset
npm run dev
```

Abra `http://localhost:3000`. Para executar verificações, mantenha o servidor local em execução e, em outro terminal:

```bash
npm test
npm run typecheck
npm run smoke
```

`npm run` lista os scripts disponíveis. `npm run db:reset` restaura os preços-base informados para Arasuper e Assaí com coleta em 24/10/2026 e dados de demonstração. A API consulta mercados por UF (`state=AC`); os mercados-base informados estão em Rio Branco, sem endereço presumido.
