#!/usr/bin/env node
/**
 * probe-sources.mjs — converte `ingest.method` de HIPÓTESE em FATO.
 *
 * O registro em config/sources.json nasce com hipóteses porque o ambiente onde
 * ele foi escrito não tinha saída de rede para os sites de leilão. Rode este
 * script numa máquina com internet: ele testa cada candidate_url, detecta se a
 * resposta é um feed de verdade, e reescreve sources.json com `verified: true`
 * e a evidência (status, content-type, nº de itens, data do item mais recente).
 *
 * Uso:
 *   node tools/probe-sources.mjs            # só relata, não escreve
 *   node tools/probe-sources.mjs --write    # relata e atualiza sources.json
 *
 * Não faz scraping — só um GET por candidate_url, sequencial, com pausa. Fontes
 * marcadas como `manual` são puladas por definição.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = resolve(HERE, '../config/sources.json');

const TIMEOUT_MS = 15000;
const PAUSE_MS = 1500; // educado com os servidores alheios
const UA = 'PorscheDigestBot/1.0 (+https://digest.costafamily.ai; feed discovery)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Descobre se um corpo de resposta é RSS/Atom e extrai o que der. */
function inspectFeed(body) {
  const head = body.slice(0, 4000);
  const isFeed = /<rss[\s>]|<feed[\s>]|<channel[\s>]/i.test(head);
  if (!isFeed) return { isFeed: false };

  const items = body.match(/<item[\s>]|<entry[\s>]/gi) ?? [];
  const dateMatch = body.match(/<(pubDate|updated|published)>([^<]+)</i);
  let latest = null;
  if (dateMatch) {
    const parsed = new Date(dateMatch[2].trim());
    if (!Number.isNaN(parsed.getTime())) latest = parsed.toISOString();
  }
  return { isFeed: true, itemCount: items.length, latestItem: latest };
}

/** Um anúncio de 993 aparece no feed? Feed que existe mas não cobre 993 é quase inútil. */
function mentions993(body) {
  return /\b993\b/.test(body);
}

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
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      ...inspectFeed(body),
      mentions993: mentions993(body),
      bytes: body.length,
    };
  } catch (error) {
    return { ok: false, status: 0, error: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Traduz o resultado do probe no método de ingestão comprovado. */
function verdictFor(source, result) {
  if (!result) return { method: source.ingest.method, verified: false, reason: 'sem candidate_url para testar' };
  if (!result.ok) {
    return {
      method: 'unknown',
      verified: true,
      reason: `candidate_url falhou (${result.error ?? 'HTTP ' + result.status}) — precisa de outra rota de ingestão`,
    };
  }
  if (result.isFeed) {
    return {
      method: 'rss',
      verified: true,
      reason: `feed com ${result.itemCount} itens${result.mentions993 ? ', menciona 993' : ', SEM mencao a 993 — checar se cobre o modelo'}`,
    };
  }
  if (/json/i.test(result.contentType)) {
    return { method: 'json_api', verified: true, reason: 'respondeu JSON' };
  }
  return {
    method: 'scrape',
    verified: true,
    reason: `respondeu HTML (${result.contentType.split(';')[0]}) — exige parser e checagem de robots.txt/ToS`,
  };
}

const doc = JSON.parse(await readFile(SOURCES_PATH, 'utf8'));
const write = process.argv.includes('--write');
const rows = [];

for (const source of doc.sources) {
  if (source.ingest.method === 'manual') {
    rows.push({ fonte: source.id, resultado: 'pulado (manual)', metodo: 'manual' });
    continue;
  }

  const url = source.ingest.candidate_url ?? source.url;
  process.stderr.write(`  testando ${source.id} … `);
  const result = await probe(url);
  const verdict = verdictFor(source, result);
  process.stderr.write(`${verdict.method}\n`);

  source.ingest.method = verdict.method;
  source.ingest.verified = verdict.verified;
  source.ingest.reason = verdict.reason;
  source.ingest.probed_at = new Date().toISOString();
  source.ingest.probe_url = url;

  rows.push({
    fonte: source.id,
    resultado: result.ok ? `HTTP ${result.status}` : result.error ?? `HTTP ${result.status}`,
    metodo: verdict.method,
    itens: result.itemCount ?? '',
    '993?': result.mentions993 === undefined ? '' : result.mentions993 ? 'sim' : 'nao',
  });

  await sleep(PAUSE_MS);
}

console.table(rows);

const verified = doc.sources.filter((s) => s.ingest.verified).length;
console.log(`\n${verified}/${doc.sources.length} fontes verificadas.`);
console.log(
  `Automatizáveis (rss/json_api): ${doc.sources.filter((s) => ['rss', 'json_api'].includes(s.ingest.method)).length}`,
);

if (write) {
  doc.probed_at = new Date().toISOString();
  await writeFile(SOURCES_PATH, JSON.stringify(doc, null, 2) + '\n');
  console.log(`\nconfig/sources.json atualizado.`);
} else {
  console.log('\n(dry-run — rode com --write para gravar em config/sources.json)');
}
