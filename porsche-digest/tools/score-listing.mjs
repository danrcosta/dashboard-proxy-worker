#!/usr/bin/env node
/**
 * score-listing.mjs — CLI e testes das lentes definidas em config/personas.json.
 *
 * A lógica de pontuação vive em public/assets/scoring-core.mjs (módulo puro,
 * compartilhado com o navegador) — este arquivo só faz I/O, CLI e asserções.
 *
 * Uso:
 *   node tools/score-listing.mjs --test            roda os testes
 *   node tools/score-listing.mjs listings.json     pontua um array de anúncios
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

import { scoreListing, scoreCriterion } from '../public/assets/scoring-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PERSONAS_PATH = resolve(HERE, '../config/personas.json');

const loadPersonas = async () => JSON.parse(await readFile(PERSONAS_PATH, 'utf8'));

/* ------------------------------------------------------------------ testes */

const FIXTURES = {
  // Rodado, revisado, mods de estrada. O carro do Piloto.
  driver: {
    id: 'driver',
    mileage_km: 118000,
    owners: 3,
    service_history: 'full',
    mechanical_freshness: 'fresh',
    usability_mods: 'tasteful_driver',
    originality: 'original_repainted',
    documentation: 'partial',
    color_rarity: 'standard',
    price_vs_index: -0.05,
    flags: [],
  },
  // 19.000 km, tudo original, parado há anos. O carro do Colecionador.
  queen: {
    id: 'queen',
    mileage_km: 19000,
    owners: 1,
    service_history: 'partial',
    mechanical_freshness: 'overdue',
    usability_mods: 'none',
    originality: 'fully_original',
    documentation: 'complete',
    color_rarity: 'rare',
    price_vs_index: 0.12,
    flags: ['dormant_over_24m'],
  },
  // Backdate de builder conhecido, motor aberto. O carro do Construtor.
  build: {
    id: 'build',
    mileage_km: 74000,
    owners: 4,
    service_history: 'full',
    mechanical_freshness: 'fresh',
    usability_mods: 'heavy_track',
    originality: 'modified',
    documentation: 'partial',
    color_rarity: 'standard',
    build_coherence: 'exemplary',
    builder_pedigree: 'marquee',
    build_documentation: 'full_dossier',
    power_to_weight: 340,
    price_vs_index: 0.08,
    flags: ['irreversible_mod'],
  },
  // Anúncio de dealer com uma foto e duas linhas de texto.
  sparse: { id: 'sparse', price_vs_index: -0.02, flags: [] },
};

async function runTests() {
  const personas = await loadPersonas();
  const score = (fixture) => scoreListing(fixture, personas);

  const driver = score(FIXTURES.driver);
  const queen = score(FIXTURES.queen);
  const build = score(FIXTURES.build);
  const sparse = score(FIXTURES.sparse);

  // As lentes precisam DISCORDAR — se concordassem, não seriam lentes.
  assert.ok(
    driver.scores.piloto.score > queen.scores.piloto.score,
    'Piloto deve preferir o carro rodado e revisado ao garage queen',
  );
  assert.ok(
    queen.scores.colecionador.score > driver.scores.colecionador.score,
    'Colecionador deve preferir o carro original de baixa km',
  );
  assert.ok(
    build.scores.construtor.score > driver.scores.construtor.score &&
      build.scores.construtor.score > queen.scores.construtor.score,
    'Construtor deve preferir o build de builder reconhecido',
  );

  // Mod irreversível trava o teto do Colecionador em 40.
  assert.ok(
    build.scores.colecionador.score <= 40,
    'Mod irreversível deve limitar o score do Colecionador a 40',
  );

  // Parado há 2 anos custa pontos ao Piloto.
  assert.ok(
    queen.scores.piloto.applied.some((p) => p.id === 'dormant_over_24m'),
    'Penalidade de carro parado deve ser aplicada',
  );

  // O blend muda o vencedor — é isso que os sliders do digest exploram.
  const porPiloto = [driver, queen].map((r) => r.scores.piloto.score);
  const porColecionador = [driver, queen].map((r) => r.scores.colecionador.score);
  assert.ok(
    porPiloto[0] > porPiloto[1] && porColecionador[0] < porColecionador[1],
    'A ordem dos anúncios deve se inverter entre as lentes Piloto e Colecionador',
  );

  // Dado ausente derruba a confiança, não a nota.
  assert.ok(sparse.scores.piloto.score !== null, 'Anúncio esparso ainda recebe nota');
  assert.ok(sparse.confidence < 0.5, 'Anúncio esparso deve ter confiança baixa');
  assert.ok(
    sparse.scores.piloto.missing.includes('service_history'),
    'Critérios sem dado devem ser listados em `missing`',
  );
  assert.ok(
    sparse.scores.piloto.score > 40,
    'Ausência de dado não pode ser tratada como nota zero',
  );

  // Quilometragem baixa é penalizada para o Piloto, não premiada.
  const piloto = personas.personas.find((p) => p.id === 'piloto');
  const kmCriterion = piloto.scoring.criteria.find((c) => c.id === 'mileage_sweet_spot');
  assert.ok(scoreCriterion(kmCriterion, 19000) < 50, 'Piloto: 19.000 km deve pontuar abaixo de 50');
  assert.equal(scoreCriterion(kmCriterion, 118000), 100, 'Piloto: 118.000 km está na faixa ideal');

  console.table(
    [driver, queen, build, sparse].map((r) => ({
      anuncio: r.id,
      piloto: r.scores.piloto.score,
      colecionador: r.scores.colecionador.score,
      construtor: r.scores.construtor.score,
      final: r.blended,
      confianca: r.confidence,
    })),
  );
  console.log('\n11/11 asserções passaram.');
}

/* -------------------------------------------------------------------- cli */

const [, , arg] = process.argv;
if (arg === '--test') {
  await runTests();
} else if (arg) {
  const personas = await loadPersonas();
  const parsed = JSON.parse(await readFile(resolve(process.cwd(), arg), 'utf8'));
  // Aceita um array solto, o digest inteiro, ou { listings: [...] }.
  const listings = Array.isArray(parsed)
    ? parsed
    : parsed.market
      ? [...(parsed.market.live ?? []), ...(parsed.market.sold ?? [])]
      : (parsed.listings ?? []);

  if (!listings.length) {
    console.error(`${arg}: nenhum anúncio encontrado (esperado array, {listings} ou {market:{live,sold}})`);
    process.exit(1);
  }

  console.log(JSON.stringify(listings.map((l) => scoreListing(l, personas)), null, 2));
} else {
  console.log('uso: node tools/score-listing.mjs --test | <arquivo.json>');
}
