/**
 * digest.js — monta o Porsche Digest a partir de data/*.json.
 *
 * Estrutura editorial (v6): abertura → arquivo → lentes → mercado → índice →
 * oficina → estrada → carro → biblioteca. A hierarquia é deliberada: o argumento
 * do dia vem primeiro, o acervo fica no fim.
 *
 * O ranqueamento usa scoring-core.mjs, o MESMO módulo do pipeline em
 * tools/score-listing.mjs — página e alertas nunca discordam.
 */

import { scoreListing } from './scoring-core.mjs';

/* ----------------------------------------------------------------- helpers */

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (key === 'style') node.setAttribute('style', value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

const mount = (id, ...nodes) => {
  const host = document.getElementById(id);
  if (host) host.replaceChildren(...nodes.flat().filter(Boolean));
};

const usd = (n) =>
  typeof n === 'number' ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—';
const brl = (n) =>
  typeof n === 'number' ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—';
const km = (n) => (typeof n === 'number' ? `${n.toLocaleString('pt-BR')} km` : null);
const pct = (n) => (typeof n === 'number' ? `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%` : '—');

function longDate(value) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const dayOfYear = (value) => {
  const date = new Date(value ?? Date.now());
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
};

const STATUS = { active: 'ao vivo', ending: 'encerrando', ended: 'encerrado', sold: 'vendido' };

/** Rótulos em pt-BR dos critérios, para explicar uma nota sem jargão de schema. */
const CRITERION_LABEL = {
  service_history: 'histórico de manutenção',
  mechanical_freshness: 'estado mecânico',
  price_vs_index: 'preço frente ao índice',
  usability_mods: 'modificações de uso',
  mileage_sweet_spot: 'quilometragem de uso',
  mileage_low: 'quilometragem baixa',
  originality: 'originalidade',
  documentation: 'documentação',
  color_rarity: 'raridade da cor',
  owners: 'número de donos',
  build_coherence: 'coerência do build',
  builder_pedigree: 'assinatura do builder',
  build_documentation: 'documentação do build',
  power_to_weight: 'potência/peso',
};

/* -------------------------------------------------------------------- load */

const loadJson = async (path) => {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

let personas, profile, digest, sources, dossiers, library;
try {
  [personas, profile, digest, sources, dossiers, library] = await Promise.all([
    loadJson('./data/personas.json'),
    loadJson('./data/profile.json'),
    loadJson('./data/digest.json'),
    loadJson('./data/sources.json'),
    loadJson('./data/dossiers.json'),
    loadJson('./data/library.json'),
  ]);
} catch (error) {
  document.querySelector('main').replaceChildren(
    el('div', { class: 'wrap' }, [
      el('p', { class: 'empty', text: `Não foi possível carregar os dados: ${error.message}` }),
      el('p', { class: 'empty', text: 'A página precisa ser servida por HTTP. Rode: node tools/build.mjs && npx serve public' }),
    ]),
  );
  throw error;
}

const personaById = Object.fromEntries(personas.personas.map((p) => [p.id, p]));
const libraryById = Object.fromEntries(library.references.map((r) => [r.id, r]));
const RATE = digest.meta?.exchange_rate?.rate ?? 5.11;
const toBrl = (v) => (typeof v === 'number' ? v * RATE : null);

/* ---------------------------------------------------------------- masthead */

const THEME_KEY = 'porsche-digest:theme';
const saved = localStorage.getItem(THEME_KEY);
if (saved) document.documentElement.dataset.theme = saved;

document.getElementById('theme-toggle').addEventListener('click', () => {
  const current =
    document.documentElement.dataset.theme ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
});

document.title = profile.digest?.title ?? document.title;
document.getElementById('edition').textContent = longDate(digest.meta.generated_at);
document.getElementById('fx').textContent = digest.meta.exchange_rate?.stale
  ? `USD/BRL ${RATE.toFixed(2)} · defasada`
  : `USD/BRL ${RATE.toFixed(2)}`;

if (digest.meta?.seed) {
  document.getElementById('seed-banner').hidden = false;
  document.getElementById('seed-msg').textContent =
    digest.meta.seed_warning ?? 'Os valores exibidos são de exemplo.';
}

/* ------------------------------------------------------- abertura (o lead) */

const scored = (digest.market?.live ?? []).map((listing) => ({
  listing,
  result: scoreListing(listing, personas, profile.persona_weights),
}));
const best = [...scored].sort((a, b) => (b.result.blended ?? -1) - (a.result.blended ?? -1))[0];

/** Sem lead escrito, compõe um a partir do que os dados de fato dizem. */
function derivedLead() {
  const models = digest.valuation?.models ?? [];
  const c4s = models.find((m) => m.id === 'c4s');
  const body = [];

  if (best?.result.blended !== null && best) {
    body.push(
      `A maior aderência desta edição é ${best.listing.title}, com ${Math.round(best.result.blended)} pontos ` +
        `na sua mistura de lentes e ${Math.round(best.result.confidence * 100)}% de confiança na leitura. ` +
        `Está anunciado em ${usd(best.listing.price_usd)} na ${best.listing.source_name ?? 'plataforma de origem'}.`,
    );
  }
  if (c4s) {
    body.push(
      `O índice do Carrera 4S marca ${usd(c4s.median_usd)} de mediana, ${pct(c4s.trend_yoy)} em doze meses, ` +
        `numa faixa que vai de ${usd(c4s.range_usd?.[0])} a ${usd(c4s.range_usd?.[1])}. ` +
        `A distância entre os extremos dessa faixa é maior que o preço de muitos 911 inteiros — ` +
        `é nela que a leitura por lente faz diferença.`,
    );
  }
  body.push(
    'Abaixo: o capítulo do dia no Arquivo, as três lentes que ordenam o mercado, e o que está à venda agora.',
  );

  return {
    kicker: 'Abertura',
    headline: 'O que esta edição diz',
    standfirst:
      'Um resumo do dia composto a partir dos próprios dados — substituído por texto editorial quando o Hermes escreve o lead.',
    body,
  };
}

const lead = digest.lead ?? derivedLead();

mount(
  'lead',
  el('span', { class: 'label lead-kicker', text: lead.kicker ?? 'Abertura' }),
  el('h2', { text: lead.headline }),
  lead.standfirst ? el('p', { class: 'standfirst', text: lead.standfirst }) : null,
  el('div', { class: 'lead-body' }, (lead.body ?? []).map((p) => el('p', { text: p }))),
);

/* ------------------------------------------------------------- 01 em pauta */

const articles = digest.newsroom?.articles ?? [];
mount(
  'news',
  articles.length
    ? articles.map((article) =>
        el('article', { class: 'news-row' }, [
          el('div', {}, [
            el('span', { class: 'label', text: article.source }),
            el('h3', {}, el('a', { href: article.url, target: '_blank', rel: 'noopener', text: article.title })),
            article.summary ? el('p', { text: article.summary }) : null,
          ]),
          el('span', { class: 'when', text: longDate(article.date) }),
        ]),
      )
    : el('p', { class: 'empty', text: 'Nenhuma matéria nova nesta edição.' }),
);

/* -------------------------------------------------------------- 02 arquivo */

const chapters = dossiers.chapters ?? [];
const chapter = chapters.length ? chapters[dayOfYear(digest.meta.generated_at) % chapters.length] : null;

if (chapter) {
  const reading = (chapter.further_reading ?? []).map((id) => libraryById[id]).filter(Boolean);

  mount(
    'dossier',
    el('div', {}, [
      el('span', { class: 'label dossier-kicker', text: chapter.kicker }),
      el('h3', { text: chapter.title }),
      el('p', { class: 'standfirst', text: chapter.standfirst }),
      el('div', { class: 'dossier-body measure' }, (chapter.body ?? []).map((p) => el('p', { text: p }))),
    ]),
    el('div', {}, [
      el('div', { class: 'aside' }, [
        el('h4', { class: 'label', text: 'Pontos-chave' }),
        el('ul', {}, (chapter.key_facts ?? []).map((f) => el('li', { text: f }))),
      ]),
      chapter.fact_check?.length
        ? el('div', { class: 'aside' }, [
            el('h4', { class: 'label', text: 'A confirmar' }),
            el('ul', {}, chapter.fact_check.map((f) => el('li', { class: 'caveat', text: f }))),
          ])
        : null,
      reading.length
        ? el('div', { class: 'aside' }, [
            el('h4', { class: 'label', text: 'Para aprofundar' }),
            el(
              'ul',
              {},
              reading.map((ref) =>
                el('li', {}, el('a', { href: ref.url, target: '_blank', rel: 'noopener', text: ref.name })),
              ),
            ),
          ])
        : null,
      el('div', { class: 'aside' }, [
        el('h4', { class: 'label', text: 'Rotação' }),
        el('ul', {}, el('li', { class: 'caveat', text: `Capítulo ${chapters.indexOf(chapter) + 1} de ${chapters.length}. Muda a cada edição.` })),
      ]),
    ]),
  );
} else {
  mount('dossier', el('p', { class: 'empty', text: 'Nenhum capítulo no arquivo.' }));
}

/* --------------------------------------------------------------- 02 lentes */

mount(
  'lenses',
  personas.personas.map((persona) =>
    el('article', { class: 'lens', style: `--accent:${persona.badge_color}` }, [
      el('span', { class: 'lens-role', text: persona.label_de }),
      el('h3', { class: 'lens-name', text: persona.label_pt }),
      el('p', { class: 'lens-thesis', text: persona.thesis }),

      el('h4', { class: 'label', text: 'Valoriza' }),
      el('ul', {}, persona.values.slice(0, 3).map((v) => el('li', { text: v }))),

      el('h4', { class: 'label', text: 'Sinais de alerta' }),
      el('ul', {}, persona.red_flags.slice(0, 3).map((v) => el('li', { text: v }))),

      el('h4', { class: 'label', text: 'Ignora' }),
      el('p', { text: persona.ignores }),

      el('h4', { class: 'label', text: 'Vocabulário' }),
      el('p', { class: 'terms', text: persona.vocabulary.slice(0, 6).join(' · ') }),
    ]),
  ),
);

/* -------------------------------------------------------------- 03 mercado */

const WEIGHTS_KEY = 'porsche-digest:weights';

function loadWeights() {
  try {
    const stored = JSON.parse(localStorage.getItem(WEIGHTS_KEY) ?? 'null');
    if (stored && personas.personas.every((p) => typeof stored[p.id] === 'number')) return stored;
  } catch {
    /* preferência salva inválida — cai no padrão do perfil */
  }
  const fromProfile = { ...profile.persona_weights };
  delete fromProfile._note;
  return fromProfile;
}

let weights = loadWeights();

function normalized(raw) {
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  if (total <= 0) return personas.blend.default_weights;
  return Object.fromEntries(Object.entries(raw).map(([id, v]) => [id, v / total]));
}

/**
 * Explica a nota a partir dos próprios critérios: o que mais pesou a favor e o
 * que penalizou. Derivado do score — nunca uma opinião inventada.
 */
function explain(result, active) {
  const lead = personas.personas
    .map((p) => ({ p, weight: active[p.id] ?? 0, r: result.scores[p.id] }))
    .filter((x) => x.r && x.r.score !== null)
    .sort((a, b) => b.weight * b.r.score - a.weight * a.r.score)[0];
  if (!lead) return null;

  const penalties = Object.values(result.scores).flatMap((s) => s?.applied ?? []);
  const name = lead.p.label_pt.replace(/^O\s+/, '');
  const parts = [`Lê melhor pela lente do ${name} (${Math.round(lead.r.score)}).`];

  if (penalties.length) {
    parts.push(`Penalizado: ${[...new Set(penalties.map((p) => p.reason.toLowerCase()))].join('; ')}.`);
  }
  if (lead.r.missing?.length >= 3) {
    const missing = lead.r.missing.slice(0, 3).map((id) => CRITERION_LABEL[id] ?? id);
    parts.push(`Anúncio não informa ${missing.join(', ')} — a leitura vale menos.`);
  }
  return parts.join(' ');
}

function renderSliders() {
  const active = normalized(weights);
  mount(
    'sliders',
    personas.personas.map((persona) => {
      const value = Math.round((active[persona.id] ?? 0) * 100);
      return el('div', { class: 'slider', style: `--accent:${persona.badge_color}` }, [
        el('label', {}, [el('span', { text: persona.label_pt }), el('b', { text: `${value}%` })]),
        el('input', {
          type: 'range', min: '0', max: '100', step: '5', value: String(value),
          'aria-label': `Peso da lente ${persona.label_pt}`,
          oninput: (event) => {
            weights = { ...weights, [persona.id]: Number(event.target.value) };
            localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
            renderSliders();
            renderMarket();
          },
        }),
      ]);
    }),
  );

  document.getElementById('blend-summary').textContent = personas.personas
    .map((p) => `${p.label_pt} ${Math.round(active[p.id] * 100)}%`)
    .join('  ·  ');
}

mount(
  'presets',
  Object.entries(personas.blend.presets ?? {}).map(([name, preset]) =>
    el('button', {
      type: 'button', text: name.replace(/_/g, ' '),
      onclick: () => {
        weights = { ...preset };
        localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
        renderSliders();
        renderMarket();
      },
    }),
  ),
);

function renderMarket() {
  const active = normalized(weights);
  const rows = (digest.market?.live ?? [])
    .map((listing) => ({ listing, result: scoreListing(listing, personas, active) }))
    .sort((a, b) => (b.result.blended ?? -1) - (a.result.blended ?? -1));

  mount(
    'listings',
    rows.length
      ? rows.map(({ listing, result }, index) => {
          const note = listing.editorial_note ?? explain(result, active);
          const meta = [listing.color, km(listing.mileage_km), (listing.region ?? '').toUpperCase()]
            .filter(Boolean)
            .join('  ·  ');

          return el('article', { class: 'listing' }, [
            el('div', { class: 'rank', text: String(index + 1).padStart(2, '0') }),

            el('div', {}, [
              el('h3', {}, el('a', { href: listing.url, target: '_blank', rel: 'noopener', text: listing.title })),
              el('div', { class: 'listing-meta', text: `${listing.source_name ?? '—'}${meta ? '  ·  ' + meta : ''}` }),
              note
                ? el('p', { class: `listing-note${listing.editorial_note ? '' : ' absent'}`, text: note })
                : null,
            ]),

            el('div', { class: 'price' }, [
              el('div', { class: 'usd', text: usd(listing.price_usd) }),
              el('span', { class: 'brl', text: brl(toBrl(listing.price_usd)) }),
              typeof listing.price_vs_index === 'number'
                ? el('span', {
                    class: `idx ${listing.price_vs_index < 0 ? 'below' : 'above'}`,
                    text: `${pct(listing.price_vs_index)} vs índice`,
                  })
                : null,
            ]),

            el('div', { class: 'verdict' }, [
              result.blended === null
                ? el('div', { class: 'conf low', text: 'sem sinal' })
                : el('div', {}, [
                    el('span', { class: 'fit', text: String(Math.round(result.blended)) }),
                    el('span', { class: 'of', text: '/100' }),
                  ]),
              el('span', {
                class: `conf${result.confidence < 0.5 ? ' low' : ''}`,
                text: `confiança ${Math.round(result.confidence * 100)}%`,
              }),
              el(
                'div',
                { class: 'lens-split' },
                personas.personas.map((persona) => {
                  const score = result.scores[persona.id]?.score;
                  return el('span', {}, [
                    el('span', { text: `${persona.label_pt.replace('O ', '')} ` }),
                    el('b', { style: `color:${persona.badge_color}`, text: score == null ? '—' : String(Math.round(score)) }),
                  ]);
                }),
              ),
              el('div', { class: `status ${listing.status}`, style: 'margin-top:0.6rem', text: STATUS[listing.status] ?? listing.status }),
            ]),
          ]);
        })
      : el('p', { class: 'empty', text: 'Nenhum anúncio nesta edição.' }),
  );
}

renderSliders();
renderMarket();

mount(
  'sold',
  (digest.market?.sold ?? []).map((listing) =>
    el('div', { class: 'sold-row' }, [
      el('span', { class: 'who' }, el('a', { href: listing.url, target: '_blank', rel: 'noopener', text: listing.title })),
      el('span', { class: 'when', text: `${listing.source_name ?? '—'}  ·  ${km(listing.mileage_km) ?? '—'}  ·  ${longDate(listing.sold_at)}` }),
      el('span', { class: 'amount', text: usd(listing.price_usd) }),
    ]),
  ),
);

/* --------------------------------------------------------------- 04 índice */

const SERIES = [
  { key: 'c4s', label: '993 Carrera 4S', color: 'var(--colecionador)' },
  { key: 'carrera', label: '993 Carrera 2', color: 'var(--piloto)' },
  { key: 'turbo', label: '993 Turbo', color: 'var(--construtor)' },
];

function renderChart(points) {
  const W = 900, H = 300;
  const PAD = { top: 18, right: 20, bottom: 34, left: 52 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const values = points.flatMap((p) => SERIES.map((s) => p[s.key])).filter((v) => typeof v === 'number');
  if (!points.length || !values.length) return el('p', { class: 'empty', text: 'Sem série nesta edição.' });

  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => PAD.top + plotH - ((v - min) / span) * plotH;

  const s = (tag, attrs) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Série histórica de valores' });

  for (let step = 0; step <= 4; step += 1) {
    const value = min + (span * step) / 4;
    const yy = y(value);
    svg.append(s('line', { x1: PAD.left, x2: W - PAD.right, y1: yy, y2: yy, stroke: 'currentColor', 'stroke-opacity': '0.13' }));
    const t = s('text', { x: PAD.left - 10, y: yy + 4, 'text-anchor': 'end', 'font-size': '11', 'font-family': 'system-ui, sans-serif', fill: 'currentColor', 'fill-opacity': '0.5' });
    t.textContent = Math.round(value);
    svg.append(t);
  }

  for (const i of [...new Set([0, Math.floor(points.length / 2), points.length - 1])]) {
    const t = s('text', { x: x(i), y: H - 10, 'text-anchor': 'middle', 'font-size': '11', 'font-family': 'system-ui, sans-serif', fill: 'currentColor', 'fill-opacity': '0.5' });
    t.textContent = points[i].period;
    svg.append(t);
  }

  for (const series of SERIES) {
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[series.key]).toFixed(1)}`).join(' ');
    svg.append(s('path', { d, fill: 'none', stroke: series.color, 'stroke-width': '1.75', 'stroke-linejoin': 'round' }));
    svg.append(s('circle', { cx: x(points.length - 1), cy: y(points.at(-1)[series.key]), r: '3', fill: series.color }));
  }
  return svg;
}

const valuation = digest.valuation ?? {};
document.getElementById('index-dek').textContent = valuation.note ?? 'Série histórica por modelo.';
mount('chart', renderChart(valuation.points ?? []));
mount(
  'chart-legend',
  SERIES.map((series) => el('span', {}, [el('i', { style: `background:${series.color}` }), el('span', { text: series.label })])),
);

mount(
  'models',
  (valuation.models ?? []).map((model) => {
    const [low, high] = model.range_usd ?? [];
    const position =
      typeof model.median_usd === 'number' && typeof low === 'number' && high > low
        ? ((model.median_usd - low) / (high - low)) * 100
        : null;
    return el('article', { class: 'model' }, [
      el('h3', { text: model.label }),
      el('div', { class: 'median', text: usd(model.median_usd) }),
      el('div', { class: 'sub', text: brl(toBrl(model.median_usd)) }),
      el('div', { class: `trend ${model.trend_yoy >= 0 ? 'up' : 'down'}`, text: `${pct(model.trend_yoy)} em 12 meses` }),
      position === null ? null : el('div', { class: 'range-bar' }, el('i', { style: `left:${position.toFixed(1)}%` })),
      position === null ? null : el('div', { class: 'range-labels' }, [el('span', { text: usd(low) }), el('span', { text: usd(high) })]),
    ]);
  }),
);

/* -------------------------------------------------------------- 05 oficina */

mount(
  'suppliers',
  (digest.parts?.suppliers ?? []).map((supplier) =>
    el('article', { class: 'entry' }, [
      el('span', { class: 'label', text: supplier.category }),
      el('h3', {}, el('a', { href: supplier.url, target: '_blank', rel: 'noopener', text: supplier.name })),
      el('p', { text: supplier.note ?? '' }),
      supplier.personas?.length
        ? el('div', { class: 'tags', text: supplier.personas.map((id) => personaById[id]?.label_pt ?? id).join(' · ') })
        : null,
    ]),
  ),
);

mount('inspection', (profile.maintenance?.known_issues_to_track ?? []).map((issue) => el('li', { text: issue })));
document.getElementById('inspection-caveat').textContent = profile.maintenance?._known_issues_disclaimer ?? '';

/* -------------------------------------------------------------- 06 estrada */

document.getElementById('road-dek').textContent =
  digest.videos?.mode === 'curated'
    ? 'Curadoria da edição, por lente.'
    : 'Buscas parametrizadas pelo vocabulário de cada lente — nada de vídeo inventado até a API entrar.';

const ytSearch = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

mount(
  'watch',
  personas.personas.map((persona) => {
    const curated = digest.videos?.curated?.[persona.id] ?? [];
    const items = curated.length
      ? curated.map((v) => el('a', { href: v.url, target: '_blank', rel: 'noopener', text: `${v.title}${v.duration ? ` · ${v.duration}` : ''}` }))
      : persona.video_queries.map((q) => el('a', { href: ytSearch(q), target: '_blank', rel: 'noopener', text: q }));

    return el('article', { class: 'watch', style: `--accent:${persona.badge_color}` }, [
      el('span', { class: 'label', text: persona.label_pt }),
      el('h3', { text: persona.buys_for.split('.')[0] }),
      ...items,
    ]);
  }),
);

/* ---------------------------------------------------------------- 07 carro */

const specs = [
  ['Modelo', profile.car.model],
  ['Ano-modelo', profile.car.model_year],
  ['Motor', profile.car.engine_code],
  ['Transmissão', profile.car.transmission_code],
  ['Chassi', profile.car.chassis_number],
  ['Cor externa', profile.car.color_exterior],
  ['Cor interna', profile.car.color_interior],
  ['Quilometragem', km(profile.car.mileage_km)],
];

const upkeep = [
  ['Última revisão', profile.maintenance.last_service_date ? longDate(profile.maintenance.last_service_date) : null],
  ['km na última revisão', km(profile.maintenance.last_service_km)],
  ['DOT dos pneus', profile.maintenance.tires_dot_date],
  ['Adquirido em', profile.car.acquired_at ? longDate(profile.car.acquired_at) : null],
];

const specBlock = (title, fields, footnote) =>
  el('div', {}, [
    el('h4', { class: 'label', text: title }),
    el(
      'dl',
      { style: 'margin:1rem 0 0' },
      fields.map(([label, value]) =>
        el('div', { class: 'spec-row' }, [
          el('dt', { text: label }),
          value == null ? el('dd', { class: 'pending', text: 'a preencher' }) : el('dd', { text: String(value) }),
        ]),
      ),
    ),
    footnote ? el('p', { class: 'aside caveat', style: 'margin-top:1rem', text: footnote }) : null,
  ]);

mount('car', specBlock('Ficha', specs, profile.car._note), specBlock('Uso e manutenção', upkeep));

/* ----------------------------------------------------------- 08 biblioteca */

document.getElementById('library-dek').textContent = library.principle;

mount(
  'library',
  library.references.map((ref) =>
    el('article', { class: 'lib-item' }, [
      el('span', { class: 'label', text: ref.focus }),
      el('h3', {}, el('a', { href: ref.url, target: '_blank', rel: 'noopener', text: ref.name })),
      el('p', { text: ref.borrow }),
    ]),
  ),
);

/* ---------------------------------------------------------------- rodapé */

const automatable = sources.sources.filter((s) => ['rss', 'json_api'].includes(s.ingest.method));
const verified = sources.sources.filter((s) => s.ingest.verified);

document.getElementById('colophon').textContent =
  `Gerado por Hermes Carrera em ${longDate(digest.meta.generated_at)}. ` +
  `Cotação USD/BRL ${RATE.toFixed(2)}${digest.meta.exchange_rate?.stale ? ' (defasada)' : ''}. ` +
  `${sources.sources.length} fontes registradas, ${verified.length} com ingestão verificada, ` +
  `${automatable.length} automatizáveis por feed. ` +
  `Referência editorial em ${library.references.length} publicações — ver A Biblioteca.`;

mount(
  'sources-line',
  el('span', { text: 'Fontes de mercado: ' }),
  ...sources.sources
    .filter((s) => s.section?.includes('market'))
    .slice(0, 14)
    .flatMap((source, index) => [
      index ? el('span', { text: '  ·  ' }) : null,
      el('a', { href: source.url, target: '_blank', rel: 'noopener', text: source.name }),
    ]),
);
