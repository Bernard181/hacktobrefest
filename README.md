# CompraFácil — Acre/AC

Comparador de preços de mercados com catálogo inicial, busca pública e painel de lojista. O contrato da API está em [`docs/api.md`](docs/api.md); requisitos de produto em [`REQUISITOS.md`](REQUISITOS.md).

## Stack e execução

Next.js App Router, TypeScript e SQLite.

```bash
npm install
npm run db:bootstrap
npm run dev
```

Abra `http://localhost:3000`. Para executar verificações, mantenha o servidor local em execução e, em outro terminal:

```bash
npm test
npm run typecheck
npm run smoke
```

`npm run` lista os scripts disponíveis. O `predev` e o `prestart` executam o bootstrap idempotente: o catálogo só é criado quando o banco está vazio. `npm run db:reset` recria a base local e apaga os dados existentes; use apenas em desenvolvimento. Configure `DATABASE_PATH` para um disco persistente no deploy. Os preços-base de Arasuper e Assaí usam coleta em 24/10/2026. A API consulta mercados por UF (`state=AC`); os mercados-base estão em Rio Branco, sem endereço presumido.
