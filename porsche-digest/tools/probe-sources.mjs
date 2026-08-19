#!/usr/bin/env node
/**
 * probe-sources.mjs — converte `ingest.method` de HIPÓTESE em FATO.
 *
 * Rode numa máquina com saída de rede: testa cada URL candidata, detecta se a
 * resposta é um feed utilizável, e reescreve config/sources.json com
 * `verified: true` e a evidência.
 *
 * Uso:
 *   node tools/probe-sources.mjs                     # dry-run
 *   node tools/probe-sources.mjs --write             # grava em config/sources.json
 *   node tools/probe-sources.mjs --sources <arquivo> # usa outro registro (testes)
 *
 * Não faz scraping — um GET por candidata, sequencial, com pausa. Fontes
 * marcadas como `manual` são puladas por definição.
 *
 * Duas lições da primeira rodada real, incorporadas aqui:
 *
 * 1. Um feed que responde XML mas traz ZERO itens não é uma fonte utilizável —
 *    quase sempre significa que a URL candidata está errada. A primeira versão
 *    marcava isso como `rss` verificado, o que superestimava a cobertura.
 * 2. Uma candidata por fonte é pouco. Convenções de caminho de feed variam
 *    (/feed/, /rss, /feed.xml, .rss), então cada fonte pode listar várias em
 *    `candidate_urls` e o probe tenta em ordem até achar uma que preste.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const write = argv.includes('--write');
const sourcesArg = argv.indexOf('--sources');
const SOURCES_PATH =
  sourcesArg !== -1 && argv[sourcesArg + 1]
    ? resolve(process.cwd(), argv[sourcesArg + 1])
    : resolve(HERE, '../config/sources.json');

const TIMEOUT_MS = 15000;
const PAUSE_MS = 1500; // educado com os servidores alheios
const UA = 'PorscheDigestBot/1.0 (+https://digest.costafamily.ai; feed discovery)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Descobre se um corpo de resposta é RSS/Atom e conta os itens. */
function inspectFeed(body) {
  const head = body.slice(0, 4000);
  if (!/<rss[\s>]|<feed[\s>]|<channel[\s>]/i.test(head)) return { isFeed: false };

  const items = body.match(/<item[\s>]|<entry[\s>]/gi) ?? [];
  const dateMatch = body.match(/<(pubDate|updated|published)>([^<]+)</i);
  let latest = null;
  if (dateMatch) {
    const parsed = new Date(dateMatch[2].trim());
    if (!Number.isNaN(parsed.getTime())) latest = parsed.toISOString();
  }
  return { isFeed: true, itemCount: items.length, latestItem: latest };
}

const mentions993 = (body) => /\b993\b/.test(body);

/**
 * Autodescoberta de feed: quando uma candidata devolve HTML, o próprio HTML
 * costuma declarar onde está o feed:
 *
 *   <link rel="alternate" type="application/rss+xml" href="/feed/">
 *
 * É o padrão de descoberta, e usá-lo é estritamente melhor que adivinhar
 * caminhos — foi adivinhando que erramos as quatro candidatas do Porsche
 * Newsroom. Devolve até `limit` URLs absolutas.
 */
export function discoverFeeds(html, baseUrl, limit = 3) {
  const found = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel\s*=\s*["']?alternate/i.test(tag)) continue;
    if (!/type\s*=\s*["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      const absolute = new URL(href, baseUrl).href;
      if (!found.includes(absolute)) found.push(absolute);
    } catch {
      /* href malformado — ignora */
    }
    if (found.length >= limit) break;
  }
  return found;
}

/** Um feed só serve se responde XML E traz itens. */
const isUsableFeed = (r) => r?.ok && r.isFeed && r.itemCount > 0;
const isJsonApi = (r) => r?.ok && !r.isFeed && /json/i.test(r.contentType ?? '');

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml, */*' },
    });
    const body = await res.text();
    const feed = inspectFeed(body);
    return {
      url,
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      ...feed,
      mentions993: feed.isFeed && feed.itemCount > 0 ? mentions993(body) : undefined,
      bytes: body.length,
      body: feed.isFeed ? undefined : body, // só o HTML interessa, para autodescoberta
    };
  } catch (error) {
    return { url, ok: false, status: 0, error: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

/** URLs a tentar, em ordem. */
function candidatesFor(source) {
  const list = source.ingest.candidate_urls ?? [source.ingest.candidate_url ?? source.url];
  return [...new Set(list.filter(Boolean))];
}

/** Traduz os resultados das tentativas no método de ingestão comprovado. */
function verdictFor(attempts) {
  const usable = attempts.find(isUsableFeed);
  if (usable) {
    return {
      method: 'rss',
      verified: true,
      url: usable.url,
      reason:
        `feed com ${usable.itemCount} itens` +
        (usable.mentions993 ? ', menciona 993' : ', SEM mencao a 993 — checar se cobre o modelo'),
    };
  }

  const json = attempts.find(isJsonApi);
  if (json) return { method: 'json_api', verified: true, url: json.url, reason: 'respondeu JSON' };

  const emptyFeed = attempts.find((r) => r.ok && r.isFeed);
  if (emptyFeed) {
    return {
      method: 'unknown',
      verified: true,
      url: emptyFeed.url,
      reason: 'feed respondeu XML mas com ZERO itens — candidate_url provavelmente errada; tentar outro caminho',
    };
  }

  const html = attempts.find((r) => r.ok);
  if (html) {
    return {
      method: 'scrape',
      verified: true,
      url: html.url,
      reason: `respondeu HTML (${(html.contentType ?? '').split(';')[0]}) — exige parser e checagem de robots.txt/ToS`,
    };
  }

  const last = attempts.at(-1) ?? {};
  const detail = last.error ?? `HTTP ${last.status}`;
  const forbidden = attempts.some((r) => r.status === 401 || r.status === 403);
  return {
    method: 'unknown',
    verified: true,
    url: last.url,
    reason: forbidden
      ? `acesso automatizado recusado (${detail}) — o site bloqueia bots; procurar feed/API oficial ou tratar como manual`
      : `todas as candidatas falharam (${detail}) — precisa de outra rota de ingestão`,
  };
}

/**
 * Um feed pode ser válido e mesmo assim não servir: o feed geral do Bring a
 * Trailer traz 20 leilões de todas as marcas e pode não conter nenhum 993 numa
 * janela qualquer. Formato e cobertura são perguntas diferentes.
 */
function winnerCoversModel(attempts, verdict) {
  if (verdict.method !== 'rss') return null;
  const winner = attempts.find((a) => a.url === verdict.url);
  return winner?.mentions993 ?? null;
}

/* ------------------------------------------------------------------ execução */

/**
 * A execução fica atrás de uma guarda de módulo principal. Sem isso, um simples
 * `import` deste arquivo — para reaproveitar discoverFeeds num teste, por
 * exemplo — dispara o probe inteiro contra as 25 fontes reais como efeito
 * colateral. Aconteceu.
 */
async function main() {
  const doc = JSON.parse(await readFile(SOURCES_PATH, 'utf8'));
  const rows = [];

  for (const source of doc.sources) {
    if (source.ingest.method === 'manual') {
      rows.push({ fonte: source.id, tentativas: 0, resultado: 'pulado (manual)', metodo: 'manual', itens: '', '993?': '' });
      continue;
    }

    const urls = candidatesFor(source);
    const attempts = [];
    process.stderr.write(`  ${source.id} … `);

    const queue = [...urls];
    const seen = new Set();
    let discovered = 0;

    while (queue.length) {
      const url = queue.shift();
      if (seen.has(url)) continue;
      seen.add(url);

      const result = await probe(url);
      const { body, ...record } = result;
      attempts.push(record);

      // Achou algo utilizável: não precisa insistir nas outras candidatas.
      if (isUsableFeed(result) || isJsonApi(result)) break;

      // HTML: deixe a própria página dizer onde está o feed, em vez de adivinhar.
      if (result.ok && body && discovered < 3 && /html/i.test(result.contentType ?? '')) {
        const links = discoverFeeds(body, url, 3 - discovered);
        for (const link of links) {
          if (seen.has(link)) continue;
          discovered += 1;
          record.discovered_feed = true;
          queue.push(link);
        }
      }

      if (queue.length) await sleep(PAUSE_MS);
    }

    const verdict = verdictFor(attempts);
    process.stderr.write(`${verdict.method}\n`);

    source.ingest.method = verdict.method;
    source.ingest.verified = verdict.verified;
    source.ingest.reason = verdict.reason;
    source.ingest.probed_at = new Date().toISOString();
    source.ingest.probe_url = verdict.url;
    source.ingest.covers_model = winnerCoversModel(attempts, verdict);
    source.ingest.probe_attempts = attempts.map((a) => ({
      url: a.url,
      status: a.status,
      ...(a.error ? { error: a.error } : {}),
      ...(a.isFeed ? { items: a.itemCount } : {}),
    }));

    const winner = attempts.find((a) => a.url === verdict.url) ?? attempts.at(-1) ?? {};
    rows.push({
      fonte: source.id,
      tentativas: attempts.length,
      resultado: winner.ok ? `HTTP ${winner.status}` : (winner.error ?? `HTTP ${winner.status}`),
      metodo: verdict.method,
      itens: winner.itemCount ?? '',
      '993?': winner.mentions993 === undefined ? '' : winner.mentions993 ? 'sim' : 'nao',
    });

    await sleep(PAUSE_MS);
  }

  console.table(rows);

  const byMethod = (m) => doc.sources.filter((s) => s.ingest.method === m).length;
  const usable = doc.sources.filter((s) => ['rss', 'json_api'].includes(s.ingest.method));

  console.log(`\n${doc.sources.filter((s) => s.ingest.verified).length}/${doc.sources.length} fontes verificadas.`);
  console.log(`Com feed/API utilizável: ${usable.length} — ${usable.map((s) => s.id).join(', ') || 'nenhuma'}`);

  const covering = usable.filter((s) => s.ingest.covers_model !== false);
  const notCovering = usable.filter((s) => s.ingest.covers_model === false);
  console.log(`  destes, cobrindo o recorte 993: ${covering.length} — ${covering.map((s) => s.id).join(', ') || 'nenhuma'}`);
  if (notCovering.length) {
    console.log(
      `  feed valido mas SEM 993 na janela atual: ${notCovering.map((s) => s.id).join(', ')}` +
        `\n  (formato ok, cobertura nao — um feed geral do site pode nunca trazer o modelo)`,
    );
  }
  console.log(`scrape: ${byMethod('scrape')} · manual: ${byMethod('manual')} · sem rota: ${byMethod('unknown')}`);

  const blocked = doc.sources.filter((s) => (s.ingest.reason ?? '').includes('recusado'));
  if (blocked.length) {
    console.log(
      `\n${blocked.length} fonte(s) bloqueiam acesso automatizado: ${blocked.map((s) => s.id).join(', ')}.` +
        `\nNão contorne o bloqueio. Procure feed/API oficial; se não houver, deixe como manual.`,
    );
  }

  if (write) {
    doc.probed_at = new Date().toISOString();
    await writeFile(SOURCES_PATH, JSON.stringify(doc, null, 2) + '\n');
    console.log(`\n${SOURCES_PATH} atualizado.`);
  } else {
    console.log('\n(dry-run — rode com --write para gravar)');
  }
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) await main();
