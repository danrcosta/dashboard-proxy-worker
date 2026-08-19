# Porsche Digest — especificação v6

Recorte: **911 (993) Carrera 4S, 1996–1998**, com o air-cooled em geral como contexto —
história, compra, mercado, peças, performance, tuning, manutenção e referências de design.

Publicado em `digest.costafamily.ai` (Cloudflare Pages). Gerado diariamente pelo Hermes.

| | |
|---|---|
| [`EDITORIAL.md`](EDITORIAL.md) | A linha editorial e os 5 princípios de design |
| [`PERSONAS.md`](PERSONAS.md) | As três lentes em profundidade |
| [`CONTRATO_DIGEST_JSON.md`](CONTRATO_DIGEST_JSON.md) | O que o coletor precisa produzir |
| [`HERMES_TELEGRAM.md`](HERMES_TELEGRAM.md) | Comandos de evolução |

---

## O que mudou na v6

A v5 era um **dashboard**: oito caixas paralelas com o mesmo peso visual, cada uma
respondendo a uma pergunta diferente. Ler de cima a baixo não produzia conclusão nenhuma.
A v6 reorganiza tudo em torno de hierarquia editorial. Raciocínio completo em
`EDITORIAL.md`.

**1. Removida a seção "911 Turbo S 2026".** Comparar o 993 com o 911 atual não servia ao
objetivo do projeto — informava sobre um carro que não está em questão. O espaço foi para
o Arquivo.

**2. Nova seção: O Arquivo.** Um capítulo editorial por edição sobre o 993 — engenharia,
desenho, mercado, história — em rotação determinística por dia do ano. Resolve o problema
estrutural de qualquer digest diário: num dia sem anúncio novo, passa a haver o que ler.
Conteúdo em `config/dossiers.json`.

**3. Nova seção: A Abertura.** Um argumento por edição, antes de qualquer dado. Escrito
pelo Hermes via `lead`; na ausência, composto a partir dos próprios dados e declarado
como derivado.

**4. Nova seção: A Biblioteca.** As 14 publicações de referência, cada uma registrando o
que especificamente se toma dela. Mantém o benchmark verificável em vez de virar folclore.

**5. Julgamento por anúncio.** Cada item do Mercado carrega uma frase: `editorial_note`
quando há leitura humana, ou uma explicação derivada do próprio score quando não há —
tipograficamente distintas, para que máquina não se passe por gente.

**6. Redesenho completo.** Papel e tinta no lugar de ouro sobre preto; serifada para voz
editorial e sem-serifa para dado; status como ponto e palavra em vez de pílula de
semáforo; capitular na abertura; seções numeradas com fio.

**7. Peças e manutenção fundiram-se em A Oficina.** Eram duas caixas respondendo à mesma
pergunta prática.

---

## Estrutura

```
porsche-digest/
├── config/              fonte de verdade, editada à mão (ou pelo Telegram)
│   ├── personas.json      as 3 lentes + função de score + blend
│   ├── sources.json       25 fontes, ingestão, dedup, filtros
│   ├── profile.json       seu carro, pesos, alertas, manutenção
│   ├── dossiers.json      os capítulos do Arquivo
│   └── library.json       as 14 referências editoriais + benchmark
├── public/              raiz do deploy
│   ├── index.html         as 9 seções
│   ├── assets/
│   │   ├── digest.css     sistema editorial
│   │   ├── digest.js      render
│   │   └── scoring-core.mjs  lentes (compartilhado com o pipeline)
│   └── data/            gerado — não editar à mão
│       └── digest.json    payload diário do Hermes
└── tools/
    ├── build.mjs          config/ → public/data/ + validação
    ├── score-listing.mjs  CLI + testes das lentes
    └── probe-sources.mjs  verifica quais fontes têm feed
```

---

## As seções

### — · A Abertura

Um argumento por edição, com capitular e corpo em duas colunas. Não resume o digest:
defende uma tese.

- **Fonte** — `lead` no payload; sem ele, composição derivada dos dados
- **Campos** — `kicker`, `headline`, `standfirst`, `body[]`
- **Pronto quando** — a abertura não poderia ser trocada com a de outra edição sem alguém notar

### 01 · Em pauta

Noticiário compacto — lista editorial, não carrossel de cards. Deliberadamente discreto:
não compete com a matéria de capa.

- **Fontes** — Porsche Newsroom, Classic Driver, Elferspot e demais fontes editoriais
- **Pronto quando** — ≥3 itens, nenhum com mais de 14 dias, `url` resolvível

### 02 · O Arquivo

A matéria de capa. Capítulo rotativo sobre o 993, com barra lateral de pontos-chave,
"A confirmar" e "Para aprofundar" ligando à Biblioteca.

- **Fonte** — `config/dossiers.json`, rotação `dia-do-ano % nº de capítulos`
- **Campos** — `kicker`, `title`, `standfirst`, `body[]`, `key_facts[]`, `fact_check[]`, `further_reading[]`
- **Pronto quando** — capítulo com ≥3 parágrafos e `further_reading` resolvendo na Biblioteca
- **Evolução** — imagem por capítulo; capítulos sobre variantes vizinhas; série sobre restauração

> O corpo é prosa. Números vivem em `key_facts`, e o que exige conferência contra fonte
> primária vai em `fact_check`, exibido como "A confirmar". Um capítulo sem `fact_check`
> é o que afirma só o que é seguro afirmar.

### 03 · As três lentes

Os três cards, montados direto de `config/personas.json` — o HTML não duplica definição.
Detalhe em `PERSONAS.md`.

### 04 · O Mercado

Anúncios ao vivo como linhas editoriais numeradas, mais a lista de negócios fechados.

- **Fontes** — as 20 plataformas em `config/sources.json`
- **Controle** — três sliders + presets; reordena sem recarregar
- **Por anúncio** — título, fonte, preço USD/BRL, delta vs índice, aderência, confiança,
  notas por lente, status, e a frase de julgamento
- **Dedup** — Classic.com e Hemmings são agregadores; funde por VIN, senão por
  (ano, modelo, cor, km ±2%) + preço ±5%, senão por similaridade de título >0.85
- **Filtro** — 10º dígito do VIN (T=1996, V=1997, W=1998); sem VIN, filtro textual
- **Pronto quando** — 5+5 itens, sem duplicata, todo `source_id` no registro
- **Evolução** — favoritos, alertas por regra, tempo de mercado por anúncio

### 05 · O Índice

Gráfico de 3 séries em SVG inline + medianas com faixa.

- **Fontes** — Classic.com, BaT Index, relatórios PCA
- **Pronto quando** — ≥8 períodos por série e `seed: false`

> É o dado com maior chance de virar decisão de compra. Enquanto for exemplo, a seção diz
> isso no próprio texto.

### 06 · A Oficina

Fornecedores de peça e roteiro de inspeção lado a lado — o roteiro é o mesmo que a lente
do Piloto usa para pontuar.

- **Fontes** — `parts.suppliers[]` e `profile.maintenance.known_issues_to_track`
- **Evolução** — preço de peças de alto giro, comparador, intervalos com alerta

### 07 · A Estrada

Um bloco por lente. Em `mode: "search"`, as `video_queries` da persona viram busca
parametrizada. Em `mode: "curated"`, vídeos com título e duração.

### 08 · O Carro

Ficha e uso do seu exemplar, de `config/profile.json`. Campo sem confirmação aparece como
pendência.

### 09 · A Biblioteca

As 14 publicações de referência, com o que se toma de cada uma.

- **Fonte** — `config/library.json`
- **Pronto quando** — toda `further_reading` dos capítulos resolve aqui (validado no build)

---

## Dados globais

**Câmbio USD → BRL** — buscado a cada geração; fallback 5,11. Quando o fallback entra, o
masthead e o colofão marcam "defasada", e `alerts.cotacao_defasada` dispara acima de 48h.

**Formato de data** — `pt-BR` real: "16 de agosto de 2026".

**Moeda** — USD `$142,500` · BRL `R$ 738.150`, com separador brasileiro.

**Colofão** — data, cotação, contagem de fontes registradas / verificadas / automatizáveis
e o tamanho da Biblioteca.

---

## Design system

Derivado do benchmark. Princípios em `EDITORIAL.md`; tokens em `public/assets/digest.css`.

| | Claro | Escuro |
|---|---|---|
| Papel | `#faf8f5` | `#100f0d` |
| Tinta | `#16130f` | `#ece7de` |
| Tinta suave | `#453f37` | `#c3bbaf` |
| Fio | `#ddd5c9` | `#2f2a24` |
| Ouro (acento) | `#d4af37` / `#8a6d1f` | `#d4af37` |

Status em tinta, não em semáforo: ativo `#3f7d4e` · encerrando `#a8762a` ·
encerrado `#8f3f34` · vendido `#6f675d`. As mesmas cores identificam Piloto,
Colecionador e Construtor.

**Tipografia** — display e prosa em `'Iowan Old Style', 'Palatino Linotype', Palatino,
Georgia, serif`; dado e rótulo em stack de sistema sem serifa. Nenhuma fonte externa: o
digest não depende de CDN.

**Espaçamento** — seção 4,5rem (3rem no mobile); medida de leitura 68ch; largura 1160px.
Breakpoints em 900px e 720px. Nada rola na horizontal.

**Tema** — claro por padrão, escuro por `prefers-color-scheme`, botão sobrepõe e persiste.

---

## Fluxo diário

```
1 COLETA          feeds e páginas das fontes habilitadas
                  cotação USD/BRL
2 NORMALIZAÇÃO    schema único; extração dos sinais das lentes
                  dedup contra agregadores; filtro 993 C4S 96-98
3 REDAÇÃO         compõe o `lead` da edição
                  escreve `editorial_note` nos anúncios que merecem leitura
4 GERAÇÃO         escreve public/data/digest.json com meta.seed = false
5 VALIDAÇÃO       node tools/build.mjs   → falha aborta o deploy
                  node tools/score-listing.mjs --test
6 DEPLOY          wrangler pages deploy public --project-name porsche-digest
7 NOTIFICAÇÃO     resumo no Telegram
```

A etapa 3 é a que separa jornal de feed, e a 5 é a que impede um digest quebrado de
chegar ao ar — ela reprova `source_id` desconhecido, peso de lente que não soma 1, curva
inválida, capítulo sem corpo e referência pendurada na Biblioteca.

---

## Estado atual

| | |
|---|---|
| Seções | 9 + abertura |
| Capítulos no Arquivo | 7 |
| Referências na Biblioteca | 14 |
| Fontes registradas | 25 |
| Ingestão **verificada** | **0** — rode `node tools/probe-sources.mjs --write` |
| Dados de mercado | exemplo (`meta.seed: true`) |
| Cotação | fallback 5,11 |
| Ficha do carro | 8 campos pendentes |
| Fotografia | **ausente** — ver a lacuna conhecida em `EDITORIAL.md` |

---

## Roadmap

**Curto prazo**
- [ ] Rodar `probe-sources.mjs --write` e priorizar as fontes com feed real
- [ ] Ligar o coletor ao contrato (`meta.seed: false`)
- [ ] Cotação USD/BRL ao vivo
- [ ] Hermes redigindo `lead` e `editorial_note` a cada edição
- [ ] Fotografia: imagem de largura total entre a abertura e o Arquivo

**Médio prazo**
- [ ] Índice de valuation real (Classic.com / BaT Index)
- [ ] Serifada própria auto-hospedada em `woff2` — maior ganho visual disponível
- [ ] Imagem por capítulo do Arquivo
- [ ] Alertas de `profile.json` disparando no Telegram
- [ ] YouTube Data API v3 → `mode: "curated"`
- [ ] Captura dos comentários do BaT como sinal de qualidade

**Longo prazo**
- [ ] Extração automática dos sinais das lentes a partir do texto do anúncio
- [ ] Novos capítulos do Arquivo a partir de leitura das fontes da Biblioteca
- [ ] Série histórica por anúncio (relistagens, tempo de mercado)
- [ ] Comparação direta "este anúncio vs. o seu carro"

---

## Manutenção diária

```
□ node tools/build.mjs           sem erro
□ node tools/score-listing.mjs --test
□ meta.seed = false
□ `lead` escrito para a edição
□ cotação do dia, sem flag de defasagem
□ 5 ao vivo + 5 fechados, sem duplicata
□ capítulo do Arquivo coerente com o dia
□ deploy no Pages concluído
□ resumo recebido no Telegram
```
