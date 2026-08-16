# Porsche Digest — 911 (993) Carrera 4S

Digest pessoal sobre o último 911 refrigerado a ar, com recorte no **Carrera 4S
1996–1998**: mercado, peças, manutenção, performance, tuning, referências de design e
história. Publicado diariamente em `digest.costafamily.ai`.

A ideia central: o mesmo carro vale coisas diferentes dependendo de quem olha. O digest
lê cada anúncio por **três lentes** — Piloto, Colecionador, Construtor — e ranqueia pela
mistura que você escolher.

| Documento | |
|---|---|
| [`PERSONAS.md`](PERSONAS.md) | As três lentes e por que a ordem da tabela muda |
| [`DIGEST_SPEC.md`](DIGEST_SPEC.md) | As 8 seções, design system, fluxo diário, roadmap |
| [`CONTRATO_DIGEST_JSON.md`](CONTRATO_DIGEST_JSON.md) | O que o coletor precisa produzir |
| [`HERMES_TELEGRAM.md`](HERMES_TELEGRAM.md) | Comandos de evolução via `@Danrcbh_bot` |

---

## Rodar

```bash
cd porsche-digest
node tools/build.mjs        # config/ → public/data/ + validação
npx serve public            # http://localhost:3000
```

A página precisa ser servida por HTTP — ela busca os JSON com `fetch`, que não funciona
em `file://`. Qualquer servidor estático serve (`python3 -m http.server -d public`).

## Testar

```bash
node tools/score-listing.mjs --test              # 11 asserções das lentes
node tools/score-listing.mjs public/data/digest.json   # pontua os anúncios do dia
```

## Publicar

```bash
npx wrangler pages deploy public --project-name porsche-digest
```

Domínio: `digest.costafamily.ai` (CNAME no painel do Pages). Este projeto é
**independente** do Worker `dashboard-proxy` na raiz do repositório — nada aqui altera
`src/index.js` ou `wrangler.toml`.

---

## Como está montado

```
config/     fonte de verdade, editada à mão ou pelo Telegram
public/     raiz do deploy — public/data/ é gerado, não editar
tools/      build, testes e verificação de fontes
```

Duas decisões estruturais valem conhecer:

**As lentes têm uma implementação só.** `public/assets/scoring-core.mjs` é importado
tanto pelo navegador quanto pelo `tools/score-listing.mjs`. Uma cópia separada para o
pipeline divergiria em semanas, e o ranking dos alertas passaria a discordar do ranking
da página.

**Dado ausente não vira nota zero.** Quando um sinal falta, o critério sai da conta e os
pesos restantes são renormalizados — o que cai é a `confidence` exibida ao lado da nota.
Um anúncio de dealer com duas linhas de texto marca 55 com 18% de confiança, não 12 com
100%. Falta informação, não falta qualidade.

---

## Estado atual — leia antes de usar para decidir algo

| | |
|---|---|
| Dados de mercado | **exemplo** (`meta.seed: true`) — a faixa amarela no topo avisa |
| Índice de valuation | série de exemplo, não use para decisão |
| Cotação USD/BRL | fallback 5,11, marcada como defasada |
| Fontes registradas | 25 |
| Ingestão verificada | **0 de 25** |
| Ficha do carro | 8 campos pendentes |
| Seção Legado | vazia, aguardando dado verificado |

Nada de mercado, valuation ou ficha foi preenchido com valor plausível: o que não foi
coletado aparece como pendência. Um digest que parece pronto e informa errado é pior que
um que mostra o buraco.

### Próximo passo

O método de ingestão das 25 fontes é **hipótese**. O ambiente onde este repo foi escrito
não tinha saída de rede para os sites de leilão, então nada foi testado — o registro
marca todos como `verified: false`.

Numa máquina com rede:

```bash
node tools/probe-sources.mjs            # dry-run: relata o que encontrou
node tools/probe-sources.mjs --write    # grava o veredito em config/sources.json
```

O probe faz um GET por fonte, com pausa de 1,5s, e classifica a resposta em
`rss` / `json_api` / `scrape` / `unknown` — dizendo também se o feed sequer menciona 993.
É o que decide quais fontes o coletor automatiza primeiro.

**Antes de habilitar `scrape` em qualquer fonte**, checar `robots.txt` e os Termos de
Uso. Bring a Trailer e Classic.com em particular restringem uso automatizado; Mobile.de e
AutoScout24 já estão marcados como `manual` por isso.
