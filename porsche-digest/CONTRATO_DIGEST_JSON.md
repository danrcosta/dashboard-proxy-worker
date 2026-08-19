# Contrato de `public/data/digest.json`

O que o coletor do Hermes precisa produzir a cada geração. O digest lê **só este arquivo**
para conteúdo — `config/` cuida das definições, e `tools/build.mjs` valida os dois juntos.

Exemplo vivo: o próprio `public/data/digest.json` no repo (hoje, semente marcada).
Validação: `node tools/build.mjs` — reprova antes do deploy.

---

## Raiz

```jsonc
{
  "meta":      { /* obrigatório */ },
  "lead":      { /* a abertura editorial — ver abaixo */ },
  "newsroom":  { "articles": [] },
  "market":    { "live": [], "sold": [] },
  "valuation": { "points": [], "models": [] },
  "parts":     { "suppliers": [] },
  "videos":    { "mode": "search" | "curated", "curated": {} }
}
```

Seção ausente ou vazia não quebra a página — renderiza estado vazio. O que quebra é
campo com valor **errado**, e é isso que a validação persegue.

---

## `meta`

| Campo | Tipo | Nota |
|---|---|---|
| `schema_version` | string | `"6.0"` |
| `generated_at` | ISO 8601 | com offset; alimenta o cabeçalho e o rodapé |
| `generator` | string | quem gerou, para rastrear |
| `seed` | boolean | `true` → faixa amarela de "dados de exemplo". **Produção: `false`.** |
| `seed_warning` | string | texto da faixa, quando `seed` |
| `exchange_rate.rate` | number | USD→BRL usado em toda conversão |
| `exchange_rate.source` | string | de onde veio |
| `exchange_rate.fetched_at` | ISO 8601 \| null | |
| `exchange_rate.stale` | boolean | `true` marca "cotação defasada" no cabeçalho |

`seed: true` é a chave de honestidade do digest. Enquanto ela estiver ligada, nenhum
número da página deve ser lido como real — e a página diz isso.

---

## `lead` — a abertura editorial

O que separa jornal de feed. Um argumento por edição, escrito pelo Hermes.

| Campo | Tipo | Nota |
|---|---|---|
| `kicker` | string | rótulo curto acima do título |
| `headline` | string | a tese, não um resumo |
| `standfirst` | string | uma frase que sustenta a tese |
| `body` | string[] | 2–4 parágrafos; o primeiro recebe capitular |

Sem `lead`, o digest **compõe um** a partir dos próprios dados — melhor aderência da
edição e movimento do índice — e o declara como derivado. Funciona, mas é o modo
degradado: a abertura derivada não defende nada.

O teste de uma boa abertura: trocá-la com a de outra edição deveria ser perceptível.

---

## `market.live[]` — o mais importante

Além dos campos de exibição, cada anúncio carrega os **sinais** que alimentam as três
lentes. Sinal ausente não invalida o anúncio: o critério é removido e a `confidence` cai.

### Exibição

| Campo | Tipo | Obrigatório |
|---|---|:--:|
| `id` | string | ✔ |
| `source_id` | string | ✔ — precisa existir em `config/sources.json` |
| `source_name` | string | |
| `url` | string | ✔ — link real; nunca inventar caminho profundo |
| `title` | string | ✔ |
| `status` | `active` \| `ending` \| `ended` \| `sold` | ✔ |
| `year` | number | 1996–1998 |
| `color` | string | |
| `region` | `usa` \| `europe` \| `germany` \| `uk` \| `global` | |
| `price_usd` | number | ✔ — sempre em USD; o BRL é derivado |
| `ends_at` | ISO 8601 | leilões |
| `also_listed_on` | string[] | ids das fontes agregadoras que também listam |
| `editorial_note` | string | uma frase de leitura humana — ver abaixo |

### Sinais das lentes

| Campo | Valores | Usado por |
|---|---|---|
| `price_vs_index` | number — `-0.12` = 12% abaixo do índice | Piloto, Construtor |
| `mileage_km` | number | Piloto (faixa ideal), Colecionador (inverso) |
| `owners` | number | Colecionador |
| `service_history` | `none` \| `partial` \| `full` \| `full_opc` | Piloto |
| `mechanical_freshness` | `unknown` \| `overdue` \| `due_soon` \| `fresh` | Piloto |
| `usability_mods` | `show_only` \| `none` \| `tasteful_driver` \| `heavy_track` | Piloto |
| `originality` | `modified` \| `partial` \| `original_repainted` \| `fully_original` | Colecionador |
| `documentation` | `none` \| `partial` \| `good` \| `complete` | Colecionador |
| `color_rarity` | `standard` \| `desirable` \| `rare` \| `pts` | Colecionador |
| `build_coherence` | `parts_bin` \| `inconsistent` \| `coherent` \| `exemplary` | Construtor |
| `builder_pedigree` | `unknown` \| `local_shop` \| `recognized` \| `marquee` | Construtor |
| `build_documentation` | `none` \| `photos_only` \| `invoices` \| `full_dossier` | Construtor |
| `power_to_weight` | number — hp por tonelada | Construtor |

**Valor fora da lista é tratado como ausente**, não como erro. Enum novo exige atualizar
o `map` correspondente em `config/personas.json`.

### `flags[]`

Penalidades. Só as reconhecidas têm efeito; as demais são ignoradas.

| Flag | Efeito |
|---|---|
| `dormant_over_24m` | Piloto −20 |
| `no_service_records` | Piloto −15 |
| `irreversible_mod` | Colecionador: **teto de 40** |
| `undisclosed_repaint` | Colecionador −25 |
| `cluster_swap` | Colecionador −20 |
| `unfinished_build` | Construtor −30 |
| `orphan_parts` | Construtor −15 |
| `too_good_to_cut` | Construtor −15 |

### Regra de ouro dos sinais

Sinal só entra quando há **evidência no anúncio**. Na dúvida, omita.

Omitir custa confiança — visível e honesta. Chutar produz um ranking confiante e errado,
que é o pior resultado possível para um digest cuja função é ajudar a decidir compra.

`mechanical_freshness: "unknown"` existe para o caso em que o anúncio afirma não saber:
é diferente de não haver informação nenhuma.

### `editorial_note` — a frase de julgamento

Uma frase que diz **o que a nota não diz**: procedência, contexto, o que o anúncio omite,
por que o preço é o que é. Não repita o score — ele já está na página.

Sem ela, o digest gera uma explicação derivada do próprio score (lente dominante,
penalidades aplicadas, campos ausentes) e a renderiza em itálico esmaecido. A distinção
tipográfica é intencional: máquina explicando máquina não deve parecer alguém que leu o
carro.

Escreva `editorial_note` para os anúncios que merecem leitura — não para todos. Nota
editorial em todo item vira ruído, e o modo derivado já cobre o resto com honestidade.

---

## `market.sold[]`

Mesmos campos, mais `sold_at` (`YYYY-MM-DD`). Não são ranqueados — servem de referência
de preço realizado. Sinais das lentes são opcionais aqui.

---

## Demais seções

**`newsroom.articles[]`** — `title`, `date`, `summary`, `image`, `url`, `source`.

**`valuation`** — `points[]` com `{ period, c4s, carrera, turbo }`, ordenados;
`models[]` com `{ id, label, median_usd, trend_yoy, range_usd: [min, max] }`.
Enquanto for exemplo, `seed: true` e `note` dizendo isso.

**`parts.suppliers[]`** — `{ id, name, url, category, note, personas: [ids] }`.

**`videos`** — `mode: "search"` usa as `video_queries` das personas e ignora `curated`.
`mode: "curated"` exige `curated: { piloto: [], colecionador: [], construtor: [] }`,
cada item com `{ title, url, duration?, views? }`.

> A chave `legacy` (seção "911 Turbo S 2026") **saiu na v6**. Se o coletor ainda a
> produzir, o build avisa e o digest a ignora.

---

## Checklist do gerador

```
□ meta.seed = false
□ meta.generated_at do dia, com offset
□ lead escrito para a edição (ou aceito o modo derivado, conscientemente)
□ exchange_rate.rate real; stale = false
□ 5 live + 5 sold após dedup
□ todo source_id existe em config/sources.json
□ toda url resolve (HTTP 200)
□ price_usd em USD, nunca convertido
□ sinal só presente quando há evidência
□ node tools/build.mjs sem erro
```

Falha em qualquer linha: **não publicar**. Um digest do dia anterior, com data visível,
é melhor que um digest de hoje com número inventado.
