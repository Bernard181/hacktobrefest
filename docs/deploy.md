# Deploy — MVP

Objetivo: um único ambiente público, acessível por link na apresentação
(RNF07). Stack: Next.js + SQLite em arquivo — **um repo, um deploy, um banco**.

## Status

| Item | Estado |
|---|---|
| Build de produção (`npm run build`) | ✅ verde local |
| Container (`Dockerfile`) | ✅ pronto, não publicado |
| Blueprint Render (`render.yaml`) | ✅ pronto, não aplicado |
| Credenciais de deploy | ❌ ausentes no ambiente (sem `vercel`/`gh`/tokens) |

**Bloqueio:** publicar exige login do dono da conta. O código está pronto para
`git push` + import no host; nenhuma alteração de código é necessária.

## Escolha do host (importante para SQLite)

SQLite precisa de **disco persistente**. Em serverless (Vercel/Lambda) o
sistema de arquivos é efêmero: a leitura funciona no primeiro request, mas a
escrita do lojista (SM-04/SM-05) se perde no próximo cold start. Por isso:

| Host | Suporta SQLite gravável | Plano gratuito | Veredito |
|---|---|---|---|
| **Render** (Docker + Disk) | ✅ disco | disco exige plano pago | **recomendado** |
| **Fly.io** (volume) | ✅ volume | pay-as-you-go | alternativa boa |
| **Railway** (volume) | ✅ volume | trial | alternativa |
| VPS própria + docker | ✅ | custo fixo | plano B |
| Vercel | ❌ FS efêmero | ✅ | só demo leitura; quebra SM-04/05 |
| Vercel + Turso | ✅ (libsql) | ✅ | exige trocar `lib/db.ts` (backend) |

> Se a equipe só tiver Vercel: a demo de escrita precisa de Turso (SQLite
> remoto) ou de rodar local + túnel. Decidir **antes** do fluxo de auth.

## Render — passo a passo

1. Push do repositório para o GitHub (`origin` já configurado).
2. Dashboard → **New → Blueprint** → selecionar o repo (lê `render.yaml`).
3. Montar o disco em `/data` (o blueprint já declara `mountPath: /data`).
4. Definir `SESSION_SECRET` (Environment → Secret).
5. Deploy. Healthcheck em `/` deve responder `200`.
6. Semear o banco do ambiente publicado (uma vez):

   ```bash
   # a partir da máquina local, apontando para o banco do host
   DATABASE_PATH=/data/app.db npm run db:reset
   ```

   > Alternativa sem shell: rodar o seed no start do container
   > (`npm run db:reset && npm start`) enquanto o banco não existir. Evitar
   > depois da demo começar — o reset apaga os preços.

## Fly.io — resumo

```bash
fly launch --no-deploy          # gera fly.toml
fly volumes create data --size 1
fly secrets set SESSION_SECRET=...
fly deploy
```

`fly.toml` precisa de `[mounts] source = "data" destination = "/data"`.

## Variáveis de ambiente

| Variável | Obrigatória | Default | Uso |
|---|---|---|---|
| `DATABASE_PATH` | prod: sim | `./data/app.db` | arquivo SQLite |
| `SESSION_SECRET` | sim (auth) | — | assinatura do cookie de sessão |
| `PORT` | host define | `3000` | porta do `next start` |
| `UF_PADRAO` | não | `AC` | UF padrão para consulta estadual |

Segredos nunca no repositório (RNF05); `.env.example` documenta as chaves.

## Fallback de emergência (demo)

Se o deploy falhar perto do fim:

```bash
npm run db:reset
npm run build
npm start                 # http://localhost:3000
# em outro terminal: túnel público
cloudflared tunnel --url http://localhost:3000
```

Válido para a apresentação; registrar no roteiro qual link será usado.

## Checklist antes de publicar

- [ ] `npm run db:reset` (seed com 3 mercados e preço vencido — SEED-01/02)
- [ ] `npm test` verde
- [ ] `npm run typecheck` verde
- [ ] `npm run build` verde
- [ ] `npm run smoke` sem `FAIL` (PENDING = falha a partir da integração;
      rodar com `SMOKE_STRICT=1`)
- [ ] `GET /api/v1/markets` responde JSON com CORS
- [ ] aviso de "dados de demonstração" visível (MV-03)
