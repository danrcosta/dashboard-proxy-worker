# Porsche Digest — especificação v5

Sucessor do `DIGEST_INSTRUCTIONS.md`. Recorte: **911 (993) Carrera 4S, 1996–1998**, com
o air-cooled em geral como contexto — compra, mercado, peças, performance, tuning,
manutenção, referências de design e história.

Publicado em `digest.costafamily.ai` (Cloudflare Pages). Gerado diariamente pelo Hermes.

- Personas em profundidade → [`PERSONAS.md`](PERSONAS.md)
- Contrato do JSON diário → [`CONTRATO_DIGEST_JSON.md`](CONTRATO_DIGEST_JSON.md)
- Comandos de evolução → [`HERMES_TELEGRAM.md`](HERMES_TELEGRAM.md)

---

## O que mudou em relação à v4

**1. As personas viraram lentes executáveis.** Antes eram três cards descritivos ao lado
de uma tabela que os ignorava. Agora cada anúncio recebe três notas independentes, e a
ordem da tabela responde à mistura que você escolhe. Detalhe em `PERSONAS.md`.

**2. As seções foram reordenadas.** As personas subiram da posição 5 para a 2, antes de
Mercado. A lente precisa ser lida antes daquilo que ela filtra — na ordem antiga, o leitor
via a tabela ranqueada e só três seções depois descobria por qual critério.

**3. Chart.js saiu; o gráfico é SVG inline.** Uma dependência de CDN para desenhar três
linhas cobra um custo real — falha de rede quebra a seção, e o Pages passa a depender de
terceiro. O gráfico de valuation é gerado em SVG puro em `digest.js`.

**4. Vídeos deixaram de ser lista fixa.** Não há IDs de YouTube inventados no repo. Cada
lente publica suas `video_queries` como busca parametrizada — link sempre válido. Quando
a YouTube Data API v3 entrar, `videos.mode` passa a `"curated"` e o mesmo bloco renderiza
thumbnail, duração e views sem mudar o HTML.

**5. Dados não coletados aparecem como pendência, nunca como número.** Campos vazios
renderizam "a preencher" em amarelo; enquanto `meta.seed` for `true`, o digest exibe uma
faixa de aviso no topo. A alternativa — preencher com valor plausível — produz um digest
que parece pronto e informa errado.

**6. As fontes viraram registro versionado.** As 22 URLs do briefing (com duas duplicatas
resolvidas) estão em `config/sources.json` com região, tipo, seção, regra de dedup e
método de ingestão. Todo método hoje está marcado **não verificado** — ver "Estado atual".

---

## Estrutura

```
porsche-digest/
├── config/              fonte de verdade, editada à mão (ou pelo Telegram)
│   ├── personas.json      as 3 lentes + função de score + blend
│   ├── sources.json       25 fontes, ingestão, dedup, filtros
│   └── profile.json       seu carro, pesos, alertas, manutenção
├── public/              raiz do deploy no Pages
│   ├── index.html         as 8 seções
│   ├── assets/
│   │   ├── digest.css     design system
│   │   ├── digest.js      render
│   │   └── scoring-core.mjs  lentes (compartilhado com o pipeline)
│   └── data/            gerado — não editar à mão
│       └── digest.json    payload diário do Hermes
└── tools/
    ├── build.mjs          config/ → public/data/ + validação
    ├── score-listing.mjs  CLI + testes das lentes
    └── probe-sources.mjs  verifica quais fontes têm feed
```

`config/` é escrito por humano; `public/data/` é gerado. `tools/build.mjs` faz a ponte e
falha cedo quando um contrato quebra.

---

## As 8 seções

### 1 · Newsroom & Classic

Carrossel horizontal de matérias recentes, renovado a cada geração.

- **Fontes** — Porsche Newsroom, Classic Driver, Elferspot Magazine
- **Campos** — `title`, `date`, `summary`, `image`, `url`, `source`
- **Layout** — cards de 280px, scroll horizontal com snap
- **Pronto quando** — ≥3 itens, nenhum com mais de 14 dias, todos com `url` resolvível
- **Evolução** — filtro por categoria, favoritos em localStorage

### 2 · As três lentes

Os três cards de persona, montados direto de `config/personas.json` — o HTML não duplica
nenhuma definição. Cada card traz tese, o que compra, o que valoriza, sinais de alerta,
KPIs, vocabulário e o que ignora.

- **Pronto quando** — os três cards renderizam sem campo vazio
- **Evolução** — membros em destaque, calendário de eventos, feed de posts

### 3 · Mercado & Leilões

Duas tabelas: **5 anúncios ao vivo** e **5 negócios fechados**, sobre 993 C4S 1996–1998.

- **Fontes** — as 20 plataformas de venda em `config/sources.json` (EUA, Europa, Alemanha, Reino Unido)
- **Controle** — três sliders de mistura + presets; re-ranqueia sem recarregar
- **Colunas** — veículo, fonte, preço USD/BRL + delta vs índice, aderência + confiança, notas por lente, status
- **Status** — `active` verde · `ending` amarelo · `ended` vermelho · `sold` cinza
- **Dedup** — Classic.com e Hemmings são agregadores; funde por VIN, senão por
  (ano, modelo, cor, km ±2%) + preço ±5%, senão por similaridade de título >0.85.
  A plataforma de origem prevalece; o agregador vai para `also_listed_on[]`.
- **Filtro** — 10º dígito do VIN (T=1996, V=1997, W=1998); sem VIN, filtro textual
- **Pronto quando** — 5+5 itens, nenhum duplicado, todo `source_id` existente no registro
- **Evolução** — sort/filter por coluna, alertas por regra, série histórica por anúncio

### 4 · Análise de valor

Gráfico de linhas com 3 séries + três cards de mediana, tendência 12 meses e faixa.

- **Fontes** — Classic.com, BaT Index, relatórios PCA
- **Modelos** — 993 Carrera 4S, 993 Carrera 2, 993 Turbo
- **Pronto quando** — ≥8 períodos por série e `seed: false`
- **Evolução** — janela de 5 anos, comparação com índices gerais, previsão

> Enquanto for série de exemplo, o texto da seção diz isso explicitamente. Índice de
> valuation é o dado do digest com maior chance de virar decisão de compra — é onde o
> número inventado causa mais estrago.

### 5 · Peças & acessórios

Grid de fornecedores, cada um marcado com as lentes que atende.

- **Atuais** — Suncoast (OEM/Classic), FCP Euro (consumíveis), Pelican Parts (peças + DIY)
- **Pronto quando** — ≥3 fornecedores, cada um com ≥1 lente marcada
- **Evolução** — preço de peças de alto giro, comparador, integração de estoque

### 6 · Vídeos por lente

Um bloco por lente. Em `mode: "search"`, lista as `video_queries` da persona como busca.
Em `mode: "curated"`, lista vídeos com título, duração e views.

- **Pronto quando** — 3 blocos com ≥3 itens cada
- **Evolução** — YouTube Data API v3, curadoria automática por tags, histórico do que já apareceu

### 7 · Legado — 993 e a geração atual

Comparativo de engenharia entre o último air-cooled e o 911 contemporâneo.

- **Campos** — potência, 0–100 km/h, aerodinâmica (extensível)
- **Estado** — vazio de propósito; preencher com dado verificado
- **Evolução** — linha do tempo 993 → 996 → 997 → 991 → 992, tabela completa de specs

### 8 · Seu carro

Ficha e manutenção, de `config/profile.json`, mais o roteiro de inspeção do 993.

- **Pronto quando** — nenhum "a preencher" na coluna Ficha
- **Evolução** — intervalos de revisão com alerta, histórico de custo por km

> `engine_code` e `transmission_code` vieram do briefing e **não** foram verificados
> contra o Kardex. Vale pedir o Kardex à Porsche Classic antes de publicar como fato.

---

## Dados globais

**Câmbio USD → BRL** — buscado a cada geração; fallback 5,11. Quando o fallback entra,
o rodapé e o cabeçalho marcam "cotação defasada", e `alerts.cotacao_defasada` dispara
acima de 48h.

**Formato de data** — `pt-BR` real: "16 de agosto de 2026". A v4 especificava
"16 de August de 2026", que misturava dois idiomas — corrigido.

**Moeda** — USD `$142,500` · BRL `R$ 738.150` (separador brasileiro, não o americano).

**Atribuição** — "Gerado por Hermes Carrera · <data> · cotação USD/BRL <taxa>", com a
contagem de fontes registradas / verificadas / automatizáveis.

---

## Design system

| | |
|---|---|
| Preto | `#000000` — masthead e rodapé |
| Ouro Porsche | `#d4af37` — acentos, marcador de seção, lente Colecionador |
| Cinza claro | `#f5f5f5` — fundo alternado |
| Cinza escuro | `#2c2c2c` |
| Status ativo | `#27ae60` — também a lente Piloto |
| Status encerrando | `#f39c12` — também pendências e baixa confiança |
| Status encerrado | `#e74c3c` — também a lente Construtor |

Tipografia — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
Títulos 28–32px · subtítulos 16–18px · corpo 14–16px · legendas 12–14px.

Espaçamento — seção 2rem (1,5rem no mobile) · gap 1,5rem · breakpoint 768px ·
grid `auto-fit, minmax(260px, 1fr)`.

Tema — claro por padrão, escuro por `prefers-color-scheme`, botão sobrepõe e persiste
em localStorage. Tabelas largas rolam dentro do próprio contêiner: a página nunca rola
na horizontal.

---

## Fluxo diário

```
1 COLETA          feeds e páginas das fontes habilitadas em sources.json
                  cotação USD/BRL
2 NORMALIZAÇÃO    schema único de anúncio; extração dos sinais das lentes
                  dedup contra agregadores; filtro 993 C4S 96-98
3 GERAÇÃO         escreve public/data/digest.json com meta.seed = false
4 VALIDAÇÃO       node tools/build.mjs   → falha aborta o deploy
                  node tools/score-listing.mjs --test
5 DEPLOY          wrangler pages deploy public --project-name porsche-digest
6 NOTIFICAÇÃO     resumo no Telegram: nº de anúncios, melhor aderência,
                  alertas disparados, fontes que falharam
```

A etapa 4 é a que impede um digest quebrado de chegar ao ar. Ela reprova `source_id`
desconhecido, peso de lente que não soma 1 e curva de score inválida.

---

## Estado atual

| | |
|---|---|
| Fontes registradas | 25 |
| Ingestão **verificada** | **0** — rode `node tools/probe-sources.mjs --write` |
| Dados de mercado | exemplo (`meta.seed: true`) |
| Cotação | fallback 5,11 |
| Seção Legado | vazia, aguardando dado verificado |
| Ficha do carro | 8 campos pendentes |

O método de ingestão de cada fonte é uma **hipótese**: o ambiente onde este repo foi
escrito não tinha saída de rede para os sites de leilão, então nada foi testado. O probe
converte hipótese em fato e é o primeiro passo antes de decidir o que automatizar.

---

## Roadmap

**Curto prazo (1–2 semanas)**
- [ ] Rodar `probe-sources.mjs --write` e priorizar as fontes com feed real
- [ ] Ligar o coletor do Hermes ao contrato de `digest.json` (`meta.seed: false`)
- [ ] Cotação USD/BRL ao vivo
- [ ] Sort e filtro por coluna na tabela de mercado
- [ ] Favoritar anúncios em localStorage

**Médio prazo (1 mês)**
- [ ] Índice de valuation real (Classic.com / BaT Index)
- [ ] Alertas de `profile.json` disparando no Telegram
- [ ] YouTube Data API v3 → `mode: "curated"`
- [ ] Captura dos comentários do BaT como sinal de qualidade
- [ ] EN / PT-BR / DE

**Longo prazo (2–3 meses)**
- [ ] Extração automática dos sinais das lentes a partir do texto do anúncio
- [ ] Série histórica por anúncio (relistagens, quanto tempo no mercado)
- [ ] Previsão de preço com faixa de incerteza explícita
- [ ] Comparação direta "este anúncio vs. o seu carro"

---

## Manutenção diária

```
□ node tools/build.mjs           sem erro
□ node tools/score-listing.mjs --test
□ meta.seed = false
□ cotação do dia, sem flag de defasagem
□ 5 ao vivo + 5 fechados, sem duplicata entre agregador e origem
□ deploy no Pages concluído
□ resumo recebido no Telegram
```
