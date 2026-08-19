#!/usr/bin/env node
/**
 * build.mjs — publica config/ dentro de public/data/ e valida os contratos.
 *
 * config/ é a fonte de verdade editada à mão. public/ é a raiz do deploy, e o
 * navegador só enxerga o que está dentro dela. Este passo copia os arquivos de
 * configuração que o digest lê em runtime e falha cedo quando algum contrato
 * está quebrado — melhor errar aqui que numa página em produção.
 *
 * Uso: node tools/build.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, 'public/data');

const errors = [];
const warnings = [];

const readJson = async (rel) => {
  try {
    return JSON.parse(await readFile(resolve(ROOT, rel), 'utf8'));
  } catch (error) {
    errors.push(`${rel}: ${error.message}`);
    return null;
  }
};

const personas = await readJson('config/personas.json');
const profile = await readJson('config/profile.json');
const sources = await readJson('config/sources.json');
const dossiers = await readJson('config/dossiers.json');
const library = await readJson('config/library.json');
const digest = await readJson('public/data/digest.json');

/* --------------------------------------------------------------- validação */

if (personas) {
  const ids = personas.personas.map((p) => p.id);
  if (new Set(ids).size !== ids.length) errors.push('personas.json: ids duplicados');

  for (const persona of personas.personas) {
    const sum = persona.scoring.criteria.reduce((acc, c) => acc + c.weight, 0);
    if (Math.abs(sum - 1) > 0.001) {
      errors.push(`personas.json: pesos de "${persona.id}" somam ${sum.toFixed(3)}, deveriam somar 1.0`);
    }
    for (const criterion of persona.scoring.criteria) {
      const hasRule = criterion.map || criterion.curve;
      if (!hasRule) errors.push(`personas.json: critério "${persona.id}.${criterion.id}" não tem map nem curve`);
      if (criterion.curve && !['linear', 'linear_inverse', 'plateau'].includes(criterion.curve)) {
        errors.push(`personas.json: curve desconhecida "${criterion.curve}" em ${persona.id}.${criterion.id}`);
      }
    }
  }

  const blendSum = Object.values(personas.blend.default_weights).reduce((a, b) => a + b, 0);
  if (Math.abs(blendSum - 1) > 0.001) errors.push(`personas.json: blend.default_weights soma ${blendSum}`);

  for (const [name, preset] of Object.entries(personas.blend.presets ?? {})) {
    for (const key of Object.keys(preset)) {
      if (!ids.includes(key)) errors.push(`personas.json: preset "${name}" cita persona inexistente "${key}"`);
    }
  }
}

if (personas && profile) {
  const ids = personas.personas.map((p) => p.id);
  for (const key of Object.keys(profile.persona_weights)) {
    if (key.startsWith('_')) continue;
    if (!ids.includes(key)) errors.push(`profile.json: persona_weights cita "${key}", que não existe em personas.json`);
  }
}

if (sources) {
  const ids = sources.sources.map((s) => s.id);
  if (new Set(ids).size !== ids.length) errors.push('sources.json: ids duplicados');

  const unverified = sources.sources.filter((s) => !s.ingest.verified).length;
  if (unverified) {
    warnings.push(
      `${unverified}/${sources.sources.length} fontes com método de ingestão ainda NÃO verificado — rode: node tools/probe-sources.mjs --write`,
    );
  }
}

if (dossiers) {
  const ids = dossiers.chapters.map((c) => c.id);
  if (new Set(ids).size !== ids.length) errors.push('dossiers.json: ids de capítulo duplicados');
  if (!dossiers.chapters.length) errors.push('dossiers.json: nenhum capítulo — a seção Arquivo ficaria vazia');

  for (const chapter of dossiers.chapters) {
    for (const field of ['kicker', 'title', 'standfirst']) {
      if (!chapter[field]) errors.push(`dossiers.json: capítulo "${chapter.id}" sem ${field}`);
    }
    if (!chapter.body?.length) errors.push(`dossiers.json: capítulo "${chapter.id}" sem corpo de texto`);
  }
}

if (dossiers && library) {
  const known = new Set(library.references.map((r) => r.id));
  for (const chapter of dossiers.chapters) {
    for (const ref of chapter.further_reading ?? []) {
      if (!known.has(ref)) {
        warnings.push(`dossiers.json: capítulo "${chapter.id}" cita referência "${ref}" ausente de library.json — o link não será exibido`);
      }
    }
  }
}

if (dossiers && personas) {
  const ids = personas.personas.map((p) => p.id);
  for (const chapter of dossiers.chapters) {
    for (const persona of chapter.personas ?? []) {
      if (!ids.includes(persona)) errors.push(`dossiers.json: capítulo "${chapter.id}" cita persona inexistente "${persona}"`);
    }
  }
}

if (digest && digest.legacy) {
  warnings.push('digest.json ainda traz a chave "legacy" (seção 911 Turbo S) — removida do layout na v6, pode ser apagada do payload.');
}

if (sources && digest) {
  const known = new Set(sources.sources.map((s) => s.id));
  const listings = [...(digest.market?.live ?? []), ...(digest.market?.sold ?? [])];
  for (const listing of listings) {
    if (listing.source_id && !known.has(listing.source_id)) {
      errors.push(`digest.json: anúncio "${listing.id}" referencia source_id desconhecido "${listing.source_id}"`);
    }
  }
  if (digest.meta?.seed) {
    warnings.push('public/data/digest.json ainda contém DADOS DE EXEMPLO (meta.seed = true) — o digest exibirá o aviso amarelo.');
  }
  if (digest.meta?.exchange_rate?.stale) {
    warnings.push('digest.json: cotação USD/BRL marcada como defasada (usando fallback).');
  }
}

/* ------------------------------------------------------------------- cópia */

if (errors.length === 0) {
  await mkdir(OUT, { recursive: true });
  await writeFile(resolve(OUT, 'personas.json'), JSON.stringify(personas, null, 2) + '\n');
  await writeFile(resolve(OUT, 'profile.json'), JSON.stringify(profile, null, 2) + '\n');
  await writeFile(resolve(OUT, 'sources.json'), JSON.stringify(sources, null, 2) + '\n');
  await writeFile(resolve(OUT, 'dossiers.json'), JSON.stringify(dossiers, null, 2) + '\n');
  await writeFile(resolve(OUT, 'library.json'), JSON.stringify(library, null, 2) + '\n');
  console.log('config/ -> public/data/  (personas, profile, sources, dossiers, library)');
}

/* ----------------------------------------------------------------- relatos */

for (const warning of warnings) console.warn(`aviso: ${warning}`);

if (errors.length) {
  for (const error of errors) console.error(`erro: ${error}`);
  console.error(`\nbuild falhou com ${errors.length} erro(s).`);
  process.exit(1);
}

console.log('build ok.');
