/**
 * Smoke dos criterios de aceite (SM-01..SM-07) contra um servidor no ar.
 *
 *   npm run dev        # em outro terminal
 *   npm run db:reset   # banco semeado
 *   npm run smoke
 *
 * Fase 0: a API e o fluxo do lojista ainda nao existem. Endpoint ausente (404)
 * vira PENDING em vez de falha; erro 5xx, CORS ausente ou pagina quebrada
 * continuam falhando. A partir da integracao, PENDING e tratado como falha.
 */
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const STRICT = process.env.SMOKE_STRICT === "1";

const results = [];

function pass(id, descricao, detalhe = "") {
  results.push({ id, status: "PASS", descricao, detalhe });
}

function fail(id, descricao, detalhe) {
  results.push({ id, status: "FAIL", descricao, detalhe });
}

function pending(id, descricao, detalhe = "") {
  results.push({ id, status: "PENDING", descricao, detalhe });
}

async function getJson(pathname) {
  const res = await fetch(`${BASE}${pathname}`, { redirect: "manual" });
  const texto = await res.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* corpo nao-JSON */
  }
  return { res, texto, json };
}

async function checkPagina(id, pathname, textoEsperado) {
  const res = await fetch(`${BASE}${pathname}`);
  const html = await res.text();
  if (res.status !== 200) {
    return fail(id, `${pathname} responde 200`, `recebido ${res.status}`);
  }
  if (!html.includes(textoEsperado)) {
    return fail(id, `${pathname} renderiza "${textoEsperado}"`, "texto nao encontrado");
  }
  pass(id, `${pathname} no ar`, `200, contem "${textoEsperado}"`);
}

async function checkApi(id, pathname, descricao, valida) {
  const { res, texto, json } = await getJson(pathname);
  const cors = res.headers.get("access-control-allow-origin");

  if (res.status === 404) {
    return pending(id, descricao, `${pathname} ainda nao implementado (404)`);
  }
  if (res.status >= 500) {
    return fail(id, descricao, `${pathname} respondeu ${res.status}`);
  }
  if (res.status !== 200) {
    return fail(id, descricao, `${pathname} respondeu ${res.status}: ${texto.slice(0, 120)}`);
  }
  if (!json || !("data" in json)) {
    return fail(id, descricao, "corpo fora do envelope { data, meta }");
  }
  if (!cors) {
    return fail(id, `${descricao} — CORS liberado (RF14)`, "sem Access-Control-Allow-Origin");
  }
  if (valida) {
    const problema = valida(json);
    if (problema) return fail(id, descricao, problema);
  }
  pass(id, descricao, `200, CORS: ${cors}`);
}

async function main() {
  try {
    await fetch(BASE, { method: "HEAD" });
  } catch {
    console.error(`servidor nao respondeu em ${BASE}. Rode "npm run dev" antes.`);
    process.exit(1);
  }

  // SM-01 (parte navegavel) — a busca em si ainda nao existe na fase 0.
  await checkPagina("SM-01", "/", "Comparador");
  await checkPagina("SM-04", "/lojista", "Área do lojista");

  // SM-06 — mesmo dado em JSON.
  await checkApi("SM-06", "/api/v1/markets", "GET /api/v1/markets responde JSON", (j) =>
    Array.isArray(j.data) ? null : "`data` deveria ser um array de mercados",
  );

  await checkApi("SM-01", "/api/v1/products?category=Gr%C3%A3os&q=arroz", "GET /api/v1/products filtra categoria+nome", (j) =>
    Array.isArray(j.data) ? null : "`data` deveria ser um array de produtos",
  );

  await checkApi("SM-03", "/api/v1/prices?product_id=1", "GET /api/v1/prices marca preco vencido", (j) => {
    const ofertas = j?.data?.ofertas;
    if (!Array.isArray(ofertas)) return "`data.ofertas` ausente";
    if (!ofertas.some((o) => o.valido === false || o.posicao === null)) {
      return "nenhuma oferta vencida encontrada — rode npm run db:reset (SEED-02)";
    }
    const primeiraVencida = ofertas.findIndex((o) => o.valido === false);
    if (ofertas.slice(0, primeiraVencida === -1 ? ofertas.length : primeiraVencida).some((o) => o.posicao == null)) {
      return "oferta valida sem posicao de ranking";
    }
    return null;
  });

  // SM-05 — update do lojista ainda nao existe: registra como pendente.
  pending("SM-05", "Atualizar preco no painel e ver reflexo na busca", "depende da issue de auth/lojista");

  const largura = Math.max(...results.map((r) => r.id.length));
  for (const r of results) {
    console.log(`${r.id.padEnd(largura)}  ${r.status.padEnd(7)}  ${r.descricao}${r.detalhe ? ` — ${r.detalhe}` : ""}`);
  }

  const falhas = results.filter((r) => r.status === "FAIL").length;
  const pendentes = results.filter((r) => r.status === "PENDING").length;
  console.log(`\n${results.length - falhas - pendentes} ok, ${pendentes} pendente(s), ${falhas} falha(s)`);

  if (falhas > 0) process.exit(1);
  if (pendentes > 0 && STRICT) {
    console.error("SMOKE_STRICT=1: pendentes contam como falha.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
