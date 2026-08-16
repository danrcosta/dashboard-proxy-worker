/**
 * scoring-core.mjs — implementação pura das lentes de config/personas.json.
 *
 * Sem dependências de Node nem de DOM, de propósito: o mesmo arquivo roda no
 * pipeline (tools/score-listing.mjs) e no navegador (assets/digest.js). Uma
 * única implementação evita que o ranking do digest divirja do ranking dos
 * alertas.
 *
 * Princípio: dado AUSENTE não vira nota zero. O critério sem sinal é removido e
 * os pesos são renormalizados; o que cai é a `confidence`, não a nota.
 */

/** Critério -> campo do anúncio de onde o sinal é lido. */
const FIELD_OF = {
  mileage_sweet_spot: 'mileage_km',
  mileage_low: 'mileage_km',
};

export const fieldFor = (criterionId) => FIELD_OF[criterionId] ?? criterionId;

const clamp = (n, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const lerp = (v, min, max) => ((v - min) / (max - min)) * 100;

/** Converte um sinal bruto em nota 0-100. Retorna null quando não há dado. */
export function scoreCriterion(criterion, value) {
  if (value === undefined || value === null || value === '') return null;

  if (criterion.map) {
    const mapped = criterion.map[value];
    return mapped === undefined ? null : mapped;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) return null;

  switch (criterion.curve) {
    case 'linear':
      return clamp(lerp(value, criterion.min, criterion.max));

    case 'linear_inverse':
      return clamp(100 - lerp(value, criterion.min, criterion.max));

    case 'plateau': {
      const { ideal_min, ideal_max, floor_penalty_below = 0 } = criterion;
      if (value >= ideal_min && value <= ideal_max) return 100;
      if (value > ideal_max) {
        // Decai até 0 ao dobro do topo da faixa ideal.
        return clamp(100 - lerp(value, ideal_max, ideal_max * 2));
      }
      // Abaixo da faixa ideal: quilometragem muito baixa é sintoma, não virtude.
      if (value >= floor_penalty_below) {
        return clamp(50 + lerp(value, floor_penalty_below, ideal_min) / 2);
      }
      return clamp(lerp(value, 0, floor_penalty_below) / 2);
    }

    default:
      return null;
  }
}

/**
 * Pontua um anúncio sob UMA persona.
 * @returns {{score:number|null, confidence:number, missing:string[], applied:object[]}}
 */
export function scorePersona(listing, persona) {
  const flags = new Set(listing.flags ?? []);
  const parts = [];
  const missing = [];

  for (const criterion of persona.scoring.criteria) {
    const value = scoreCriterion(criterion, listing[fieldFor(criterion.id)]);
    if (value === null) {
      missing.push(criterion.id);
      continue;
    }
    parts.push({ id: criterion.id, weight: criterion.weight, value });
  }

  const presentWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const totalWeight = persona.scoring.criteria.reduce((sum, c) => sum + c.weight, 0);
  const confidence = totalWeight === 0 ? 0 : presentWeight / totalWeight;

  // Sem nenhum sinal não há nota — e dizer isso é mais honesto que devolver 0.
  if (presentWeight === 0) return { score: null, confidence: 0, missing, applied: [] };

  let score = parts.reduce((sum, p) => sum + (p.weight / presentWeight) * p.value, 0);

  const applied = [];
  let cap = 100;
  for (const penalty of persona.scoring.penalties ?? []) {
    if (!flags.has(penalty.id)) continue;
    applied.push(penalty);
    if (typeof penalty.points === 'number') score += penalty.points;
    if (typeof penalty.cap === 'number') cap = Math.min(cap, penalty.cap);
  }

  return {
    score: Math.round(clamp(Math.min(score, cap)) * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    missing,
    applied,
  };
}

/** Pontua um anúncio sob as 3 lentes e mistura pelo blend do perfil. */
export function scoreListing(listing, personasDoc, weights) {
  const blend = weights ?? personasDoc.blend.default_weights;
  const byPersona = {};

  for (const persona of personasDoc.personas) {
    byPersona[persona.id] = scorePersona(listing, persona);
  }

  // A mistura ignora personas sem nota e renormaliza os pesos restantes.
  let weightSum = 0;
  let acc = 0;
  for (const [id, weight] of Object.entries(blend)) {
    const result = byPersona[id];
    if (!result || result.score === null || !weight) continue;
    acc += weight * result.score;
    weightSum += weight;
  }

  const confidences = Object.values(byPersona)
    .map((r) => r.confidence)
    .filter((c) => c > 0);

  return {
    id: listing.id,
    scores: byPersona,
    blended: weightSum === 0 ? null : Math.round((acc / weightSum) * 10) / 10,
    confidence: confidences.length
      ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
      : 0,
  };
}
