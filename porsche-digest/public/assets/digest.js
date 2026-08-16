/**
 * digest.js — monta o Porsche Digest a partir de data/*.json.
 *
 * O ranqueamento usa scoring-core.mjs, o MESMO módulo que o pipeline usa em
 * tools/score-listing.mjs — a página e os alertas nunca discordam.
 */

import { scoreListing } from './scoring-core.mjs';

/* ----------------------------------------------------------------- helpers */

/** Cria um elemento. `props.text` vira textContent (nunca innerHTML). */
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
  if (!host) return;
  host.replaceChildren(...nodes.flat().filter(Boolean));
};

const usd = (n) =>
  typeof n === 'number' ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—';

const brl = (n) =>
  typeof n === 'number' ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—';

const km = (n) => (typeof n === 'number' ? `${n.toLocaleString('pt-BR')} km` : '—');

const pct = (n) => (typeof n === 'number' ? `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%` : '—');

/** Data longa em pt-BR de verdade: "16 de agosto de 2026". */
function longDate(value) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STATUS_LABEL = { active: 'ao vivo', ending: 'encerrando', ended: 'encerrado', sold: 'vendido' };

/* -------------------------------------------------------------------- load */

const loadJson = async (path) => {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

let personas, profile, digest, sources;
try {
  [personas, profile, digest, sources] = await Promise.all([
    loadJson('./data/personas.json'),
    loadJson('./data/profile.json'),
    loadJson('./data/digest.json'),
    loadJson('./data/sources.json'),
  ]);
} catch (error) {
  mount(
    'main',
    el('div', { class: 'empty', style: 'margin:2rem 0' }, [
      el('strong', { text: 'Não foi possível carregar os dados do digest. ' }),
      el('span', { text: String(error.message) }),
      el('p', { text: 'A página precisa ser servida por HTTP (fetch não funciona em file://). Rode `node tools/build.mjs && npx serve public`.' }),
    ]),
  );
  throw error;
}

const personaById = Object.fromEntries(personas.personas.map((p) => [p.id, p]));
const sourceById = Object.fromEntries(sources.sources.map((s) => [s.id, s]));
const RATE = digest.meta?.exchange_rate?.rate ?? 5.11;
const toBrl = (value) => (typeof value === 'number' ? value * RATE : null);

/* ------------------------------------------------------------------ header */

const THEME_KEY = 'porsche-digest:theme';
const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

document.getElementById('theme-toggle').addEventListener('click', () => {
  const current =
    document.documentElement.dataset.theme ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
});

document.title = profile.digest?.title ?? document.title;
document.getElementById('masthead-sub').textContent =
  `${profile.car.production_years_of_interest.join(' – ')} · gerado em ${longDate(digest.meta.generated_at)}`;

const fx = digest.meta.exchange_rate ?? {};
mount(
  'fx',
  el('span', { text: 'USD/BRL ' }),
  el('strong', { text: RATE.toFixed(2) }),
  fx.stale ? el('span', { class: 'stale', text: ' · cotação defasada' }) : null,
);

if (digest.meta?.seed) {
  const banner = document.getElementById('seed-banner');
  banner.hidden = false;
  document.getElementById('seed-msg').textContent =
    digest.meta.seed_warning ?? 'Os valores exibidos são de exemplo e não vieram de fonte real.';
}

/* ------------------------------------------------------------- 1. newsroom */

mount(
  'newsroom-rail',
  (digest.newsroom?.articles ?? []).map((article) =>
    el('a', { class: 'card', href: article.url, target: '_blank', rel: 'noopener', style: 'text-decoration:none' }, [
      el('div', { class: 'article-meta', text: `${article.source} · ${longDate(article.date)}` }),
      el('h3', { text: article.title }),
      el('p', { text: article.summary ?? '' }),
    ]),
  ),
);

if (!digest.newsroom?.articles?.length) {
  mount('newsroom-rail', el('div', { class: 'empty', text: 'Sem matérias nesta geração.' }));
}

/* ------------------------------------------------------------- 2. personas */

mount(
  'persona-cards',
  personas.personas.map((persona) =>
    el('article', { class: 'card persona-card', style: `--persona:${persona.badge_color}` }, [
      el('span', { class: 'persona-tag', text: persona.label_pt }),
      el('blockquote', { text: persona.thesis }),

      el('h4', { text: 'compra para' }),
      el('p', { text: persona.buys_for }),

      el('h4', { text: 'valoriza' }),
      el('ul', {}, persona.values.slice(0, 3).map((v) => el('li', { text: v }))),

      el('h4', { text: 'sinais de alerta' }),
      el('ul', {}, persona.red_flags.slice(0, 3).map((v) => el('li', { text: v }))),

      el('h4', { text: 'mede por' }),
      el('div', { class: 'chips' }, persona.kpis.map((k) => el('span', { class: 'chip', text: k.label }))),

      el('h4', { text: 'vocabulário' }),
      el('div', { class: 'chips' }, persona.vocabulary.slice(0, 5).map((v) => el('span', { class: 'chip', text: v }))),

      el('h4', { text: 'ignora' }),
      el('p', { text: persona.ignores }),
    ]),
  ),
);

/* --------------------------------------------------------------- 3. blend */

const WEIGHTS_KEY = 'porsche-digest:weights';

function loadWeights() {
  try {
    const saved = JSON.parse(localStorage.getItem(WEIGHTS_KEY) ?? 'null');
    if (saved && personas.personas.every((p) => typeof saved[p.id] === 'number')) return saved;
  } catch {
    /* configuração salva inválida — cai no padrão do perfil */
  }
  const fromProfile = { ...profile.persona_weights };
  delete fromProfile._note;
  return fromProfile;
}

let weights = loadWeights();

/** Normaliza para somar 1. Tudo em zero volta ao padrão do perfil. */
function normalized(raw) {
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  if (total <= 0) return personas.blend.default_weights;
  return Object.fromEntries(Object.entries(raw).map(([id, value]) => [id, value / total]));
}

function renderSliders() {
  mount(
    'sliders',
    personas.personas.map((persona) => {
      const value = Math.round((normalized(weights)[persona.id] ?? 0) * 100);
      const output = el('b', { text: `${value}%` });
      const input = el('input', {
        type: 'range',
        min: '0',
        max: '100',
        step: '5',
        value: String(value),
        'aria-label': `Peso da lente ${persona.label_pt}`,
        oninput: (event) => {
          weights = { ...weights, [persona.id]: Number(event.target.value) };
          localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
          renderSliders();
          renderMarket();
        },
      });
      return el('div', { class: 'slider', style: `--persona:${persona.badge_color}` }, [
        el('label', {}, [el('span', { text: persona.label_pt }), output]),
        input,
      ]);
    }),
  );

  const active = normalized(weights);
  document.getElementById('blend-summary').textContent = personas.personas
    .map((p) => `${p.label_pt} ${Math.round(active[p.id] * 100)}%`)
    .join(' · ');
}

mount(
  'presets',
  Object.entries(personas.blend.presets ?? {}).map(([name, preset]) =>
    el('button', {
      type: 'button',
      text: name.replace(/_/g, ' '),
      onclick: () => {
        weights = { ...preset };
        localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
        renderSliders();
        renderMarket();
      },
    }),
  ),
);

/* -------------------------------------------------------------- 3. mercado */

function scoreCell(result) {
  const score = result.blended;
  if (score === null) return el('td', { class: 'num' }, el('span', { class: 'conf low', text: 'sem sinal' }));
  const lowConfidence = result.confidence < 0.5;
  return el('td', { class: 'num' }, [
    el('span', { class: 'score', text: score.toFixed(0) }),
    el('i', { class: 'score-bar', style: `width:${score}%` }),
    el('span', {
      class: `conf${lowConfidence ? ' low' : ''}`,
      text: `confiança ${Math.round(result.confidence * 100)}%`,
      title: lowConfidence ? 'Anúncio com poucos dados — a nota vale menos.' : '',
    }),
  ]);
}

function lensCell(result) {
  return el(
    'td',
    { class: 'lens-scores' },
    personas.personas.map((persona) => {
      const score = result.scores[persona.id]?.score;
      return el('div', {}, [
        el('span', { text: `${persona.label_pt.replace('O ', '')} ` }),
        el('b', { style: `color:${persona.badge_color}`, text: score === null || score === undefined ? '—' : String(Math.round(score)) }),
      ]);
    }),
  );
}

function renderMarket() {
  const active = normalized(weights);

  const rows = (digest.market?.live ?? [])
    .map((listing) => ({ listing, result: scoreListing(listing, personas, active) }))
    .sort((a, b) => (b.result.blended ?? -1) - (a.result.blended ?? -1));

  mount(
    'live-body',
    rows.map(({ listing, result }) =>
      el('tr', {}, [
        el('td', {}, [
          el('a', { class: 'veh-title', href: listing.url, target: '_blank', rel: 'noopener', text: listing.title }),
          el('div', { class: 'veh-sub', text: [listing.color, km(listing.mileage_km)].filter(Boolean).join(' · ') }),
        ]),
        el('td', {}, [
          el('div', { text: listing.source_name ?? sourceById[listing.source_id]?.name ?? '—' }),
          el('div', { class: 'veh-sub', text: (listing.region ?? '').toUpperCase() }),
        ]),
        el('td', { class: 'num' }, [
          el('span', { text: usd(listing.price_usd) }),
          el('span', { class: 'brl', text: brl(toBrl(listing.price_usd)) }),
          listing.price_vs_index !== undefined && listing.price_vs_index !== null
            ? el('span', {
                class: `brl delta ${listing.price_vs_index < 0 ? 'up' : 'down'}`,
                text: `${pct(listing.price_vs_index)} vs índice`,
              })
            : null,
        ]),
        scoreCell(result),
        lensCell(result),
        el('td', {}, el('span', { class: `badge ${listing.status}`, text: STATUS_LABEL[listing.status] ?? listing.status })),
      ]),
    ),
  );

  if (!rows.length) {
    mount('live-body', el('tr', {}, el('td', { colspan: '6' }, el('div', { class: 'empty', text: 'Nenhum anúncio nesta geração.' }))));
  }
}

renderSliders();
renderMarket();

mount(
  'sold-body',
  (digest.market?.sold ?? []).map((listing) =>
    el('tr', {}, [
      el('td', {}, el('a', { class: 'veh-title', href: listing.url, target: '_blank', rel: 'noopener', text: listing.title })),
      el('td', { text: listing.source_name ?? '—' }),
      el('td', { class: 'num' }, [
        el('span', { text: usd(listing.price_usd) }),
        el('span', { class: 'brl', text: brl(toBrl(listing.price_usd)) }),
      ]),
      el('td', { class: 'num', text: km(listing.mileage_km) }),
      el('td', { text: longDate(listing.sold_at) }),
    ]),
  ),
);

/* ------------------------------------------------------------ 4. valuation */

const SERIES = [
  { key: 'c4s', label: '993 Carrera 4S', color: '#d4af37' },
  { key: 'carrera', label: '993 Carrera 2', color: '#27ae60' },
  { key: 'turbo', label: '993 Turbo', color: '#e74c3c' },
];

/** Gráfico de linhas em SVG puro — sem CDN, sem dependência externa. */
function renderChart(points) {
  const W = 800;
  const H = 260;
  const PAD = { top: 16, right: 16, bottom: 30, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const values = points.flatMap((p) => SERIES.map((s) => p[s.key])).filter((v) => typeof v === 'number');
  if (!points.length || !values.length) {
    return el('div', { class: 'empty', text: 'Sem série de valores nesta geração.' });
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => PAD.top + plotH - ((v - min) / span) * plotH;

  const svgEl = (tag, attrs) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Série histórica de valores' });

  // Grade horizontal + rótulos do eixo Y.
  for (let step = 0; step <= 4; step += 1) {
    const value = min + (span * step) / 4;
    const yy = y(value);
    svg.append(
      svgEl('line', { x1: PAD.left, x2: W - PAD.right, y1: yy, y2: yy, stroke: 'currentColor', 'stroke-opacity': '0.12' }),
    );
    const label = svgEl('text', { x: PAD.left - 8, y: yy + 4, 'text-anchor': 'end', 'font-size': '11', fill: 'currentColor', 'fill-opacity': '0.55' });
    label.textContent = Math.round(value);
    svg.append(label);
  }

  // Rótulos do eixo X (primeiro, meio, último) para não embolar.
  for (const i of [0, Math.floor(points.length / 2), points.length - 1]) {
    const label = svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', 'font-size': '11', fill: 'currentColor', 'fill-opacity': '0.55' });
    label.textContent = points[i].period;
    svg.append(label);
  }

  for (const series of SERIES) {
    const d = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[series.key]).toFixed(1)}`)
      .join(' ');
    svg.append(svgEl('path', { d, fill: 'none', stroke: series.color, 'stroke-width': '2', 'stroke-linejoin': 'round' }));
    svg.append(svgEl('circle', { cx: x(points.length - 1), cy: y(points.at(-1)[series.key]), r: '3.5', fill: series.color }));
  }

  return svg;
}

const valuation = digest.valuation ?? {};
document.getElementById('valuation-note').textContent =
  valuation.note ?? 'Série histórica por modelo.';

mount('chart', renderChart(valuation.points ?? []));

mount(
  'chart-legend',
  SERIES.map((series) =>
    el('span', {}, [el('i', { style: `background:${series.color}` }), el('span', { text: series.label })]),
  ),
);

mount(
  'valuation-cards',
  (valuation.models ?? []).map((model) => {
    const [low, high] = model.range_usd ?? [];
    const position =
      typeof model.median_usd === 'number' && typeof low === 'number' && high > low
        ? ((model.median_usd - low) / (high - low)) * 100
        : null;
    return el('article', { class: 'card' }, [
      el('h3', { text: model.label }),
      el('div', { class: 'stat', text: usd(model.median_usd) }),
      el('div', { class: 'brl', text: brl(toBrl(model.median_usd)) }),
      el('div', {
        class: `delta ${model.trend_yoy >= 0 ? 'up' : 'down'}`,
        text: `${pct(model.trend_yoy)} em 12 meses`,
      }),
      position === null
        ? null
        : el('div', { class: 'range-bar' }, el('i', { style: `left:${position.toFixed(1)}%` })),
      position === null
        ? null
        : el('div', { class: 'range-labels' }, [el('span', { text: usd(low) }), el('span', { text: usd(high) })]),
    ]);
  }),
);

/* ---------------------------------------------------------------- 5. peças */

mount(
  'parts-grid',
  (digest.parts?.suppliers ?? []).map((supplier) =>
    el('a', { class: 'card', href: supplier.url, target: '_blank', rel: 'noopener', style: 'text-decoration:none' }, [
      el('div', { class: 'article-meta', text: supplier.category }),
      el('h3', { text: supplier.name }),
      el('p', { text: supplier.note ?? '' }),
      el(
        'div',
        { class: 'chips', style: 'margin-top:0.7rem' },
        (supplier.personas ?? []).map((id) =>
          el('span', { class: 'chip', style: `border-color:${personaById[id]?.badge_color}`, text: personaById[id]?.label_pt ?? id }),
        ),
      ),
    ]),
  ),
);

/* --------------------------------------------------------------- 6. vídeos */

document.getElementById('videos-note').textContent =
  digest.videos?.mode === 'curated'
    ? 'Curadoria diária por lente.'
    : digest.videos?.note ?? 'Buscas parametrizadas por lente.';

const youtubeSearch = (query) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

mount(
  'videos-grid',
  personas.personas.map((persona) => {
    const curated = digest.videos?.curated?.[persona.id] ?? [];
    const items = curated.length
      ? curated.map((video) =>
          el('a', { class: 'video-link', href: video.url, target: '_blank', rel: 'noopener' }, [
            el('span', { class: 'play', text: '▶' }),
            el('span', { text: `${video.title}${video.duration ? ` · ${video.duration}` : ''}` }),
          ]),
        )
      : persona.video_queries.map((query) =>
          el('a', { class: 'video-link', href: youtubeSearch(query), target: '_blank', rel: 'noopener' }, [
            el('span', { class: 'play', text: '⌕' }),
            el('span', { text: query }),
          ]),
        );

    return el('article', { class: 'card persona-card', style: `--persona:${persona.badge_color}` }, [
      el('span', { class: 'persona-tag', text: persona.label_pt }),
      ...items,
    ]);
  }),
);

/* --------------------------------------------------------------- 7. legado */

mount(
  'legacy-grid',
  (digest.legacy?.items ?? []).map((item) =>
    el('article', { class: 'card' }, [
      el('div', { class: 'article-meta', text: item.label }),
      el('div', { class: 'spec-row' }, [
        el('dt', { text: '993' }),
        item.value_993 === null
          ? el('dd', { class: 'todo', text: 'a preencher' })
          : el('dd', { text: String(item.value_993) }),
      ]),
      el('div', { class: 'spec-row' }, [
        el('dt', { text: 'atual' }),
        item.value_current === null
          ? el('dd', { class: 'todo', text: 'a preencher' })
          : el('dd', { text: String(item.value_current) }),
      ]),
    ]),
  ),
);

/* -------------------------------------------------------- 8. especificações */

const SPEC_FIELDS = [
  ['Modelo', profile.car.model],
  ['Ano-modelo', profile.car.model_year],
  ['Motor', profile.car.engine_code],
  ['Transmissão', profile.car.transmission_code],
  ['Chassi', profile.car.chassis_number],
  ['Cor externa', profile.car.color_exterior],
  ['Cor interna', profile.car.color_interior],
  ['Quilometragem', profile.car.mileage_km ? km(profile.car.mileage_km) : null],
];

const MAINTENANCE_FIELDS = [
  ['Última revisão', profile.maintenance.last_service_date ? longDate(profile.maintenance.last_service_date) : null],
  ['km na última revisão', profile.maintenance.last_service_km ? km(profile.maintenance.last_service_km) : null],
  ['DOT dos pneus', profile.maintenance.tires_dot_date],
];

const specList = (title, fields, extra) =>
  el('article', { class: 'card' }, [
    el('h3', { text: title }),
    el(
      'dl',
      { style: 'margin:0' },
      fields.map(([label, value]) =>
        el('div', { class: 'spec-row' }, [
          el('dt', { text: label }),
          value === null || value === undefined
            ? el('dd', { class: 'todo', text: 'a preencher' })
            : el('dd', { text: String(value) }),
        ]),
      ),
    ),
    extra,
  ]);

mount(
  'specs-grid',
  specList('Ficha', SPEC_FIELDS),
  specList(
    'Manutenção',
    MAINTENANCE_FIELDS,
    el('div', {}, [
      el('h4', { style: 'margin:1rem 0 0.4rem;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted)', text: 'roteiro de inspeção' }),
      el(
        'ul',
        { style: 'margin:0;padding-left:1.1rem;font-size:0.85rem;color:var(--text-muted)' },
        (profile.maintenance.known_issues_to_track ?? []).map((issue) => el('li', { text: issue })),
      ),
      el('p', { class: 'veh-sub', style: 'margin-top:0.6rem', text: profile.maintenance._known_issues_disclaimer ?? '' }),
    ]),
  ),
);

/* --------------------------------------------------------------- 9. rodapé */

const automatable = sources.sources.filter((s) => ['rss', 'json_api'].includes(s.ingest.method));
const verified = sources.sources.filter((s) => s.ingest.verified);

mount(
  'attrib',
  el('span', {
    text: `Gerado por Hermes Carrera · ${longDate(digest.meta.generated_at)} · cotação USD/BRL ${RATE.toFixed(2)}`,
  }),
);

mount(
  'footer-sources',
  el('div', {
    text: `${sources.sources.length} fontes registradas · ${verified.length} com ingestão verificada · ${automatable.length} automatizáveis por feed`,
  }),
  el('div', { style: 'margin-top:0.4rem' }, [
    el('span', { text: 'Fontes: ' }),
    ...sources.sources
      .filter((s) => s.section?.includes('market') || s.type === 'news')
      .slice(0, 12)
      .flatMap((source, index) => [
        index ? el('span', { text: ' · ' }) : null,
        el('a', { href: source.url, target: '_blank', rel: 'noopener', text: source.name }),
      ]),
  ]),
);
