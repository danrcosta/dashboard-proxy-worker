# As três lentes

> Definição de máquina: [`config/personas.json`](config/personas.json) ·
> Implementação: [`public/assets/scoring-core.mjs`](public/assets/scoring-core.mjs)

## O problema com a versão anterior

As personas estavam assim:

```
Drivers:    Road-focused, travel, meetups
Collectors: Originality, low mileage, exclusivity
Custom:     Modifications, performance, tuning
```

São descrições corretas e inúteis. Elas não decidem nada. Um digest que mostra a mesma
tabela de leilões, na mesma ordem, para os três perfis não precisa dos três perfis — os
cards viram decoração ao lado de um conteúdo que os ignora.

A correção é tratar cada persona como uma **lente**: um conjunto explícito de critérios
que responde a três perguntas, para qualquer anúncio de 993 C4S que apareça.

1. Quais sinais deste carro importam?
2. Quanto vale cada sinal?
3. O que aqui é defeito?

Com isso respondido, a mesma lista de anúncios produz três ordens diferentes — e a ordem
que você vê é a mistura das três, com os pesos que você escolher.

---

## O Piloto

> O carro existe para ser dirigido. Quilometragem é currículo, não demérito.
> Um 993 que roda 8.000 km/ano está mais saudável que um com 900 km/ano.

**Compra para** uso real: estrada, serra, track day ocasional, encontros com deslocamento.
**Ignora** originalidade de etiqueta, número de donos, prêmio por cor rara.

**Valoriza**
- Histórico de manutenção completo e recente
- Suspensão, freios e refrigeração revisados
- Correções conhecidas do 993 já feitas
- Bancos e ergonomia para 400 km sem dor
- Mods reversíveis que melhoram dirigibilidade

**Sinais de alerta**
- Parado há mais de 24 meses — vedações, embreagem, tanque, freios
- Service book vazio, ou "perdido na mudança"
- Anúncio que vende quilometragem baixa como argumento principal
- Pneus com DOT de mais de 6 anos em carro caro

**Vocabulário** — driver-quality · sorted · usable patina · sympathetic upgrades ·
no-stories car · "service history acima de matching numbers"

**Como pontua**

| Critério | Peso | Leitura |
|---|---:|---|
| `service_history` | 30% | nenhum 0 · parcial 40 · completo 85 · rede oficial 100 |
| `price_vs_index` | 25% | −20% vs índice → 100 · +20% → 0 |
| `mechanical_freshness` | 20% | vencido 0 · a vencer 45 · em dia 100 |
| `usability_mods` | 15% | só exposição 10 · nenhum 55 · estrada 100 · pista pesado 70 |
| `mileage_sweet_spot` | 10% | 60–160 mil km = 100; **abaixo de 25 mil penaliza** |

Penalidades: parado >24 meses −20 · sem qualquer comprovação −15

A curva de quilometragem é a assinatura desta lente. Ela é a única das três em que rodar
pouco **derruba** a nota: 19.000 km pontua abaixo de 50, enquanto 118.000 km pontua 100.

---

## O Colecionador

> O carro é um documento histórico. Cada desvio do estado de fábrica custa dinheiro —
> e alguns são irreversíveis.

**Compra para** preservação e apreciação patrimonial. O uso é cerimonial.
**Ignora** ganho de performance, conveniência moderna, custo de oportunidade de uso.

**Valoriza**
- Kardex Porsche batendo com o carro físico
- Motor e câmbio de número original
- Pintura original com leitura de espessura documentada
- Manual, ferramentas, macaco, compressor e chaves originais
- Cadeia de donos curta e rastreável
- Cor rara de fábrica — não repintada

**Sinais de alerta**
- Repintura não declarada, ou sem leitura de espessura
- "Rebuilt to 3.8" — descaracterização irreversível
- Painel de instrumentos trocado: quilometragem deixa de ser comprovável
- "Restomod", "backdate", "RSR flares" na descrição
- Lacuna de mais de 5 anos no histórico

**Vocabulário** — matching numbers · Kardex · COA · option codes · one owner from new ·
books, tools and jack · paint meter readings · unmolested · PTS · concours

**Como pontua**

| Critério | Peso | Leitura |
|---|---:|---|
| `originality` | 30% | modificado 0 · parcial 45 · original repintado 70 · íntegro 100 |
| `documentation` | 25% | nenhuma 0 · parcial 40 · boa 75 · completa 100 |
| `mileage_low` | 20% | inverso: 0 km → 100 · 200.000 km → 0 |
| `color_rarity` | 15% | padrão 40 · desejável 70 · rara 90 · PTS 100 |
| `owners` | 10% | inverso: 1 dono → 100 · 8 donos → 0 |

Penalidades: mod irreversível **trava o teto em 40** · repintura não documentada −25 ·
painel trocado −20

O teto de 40 é a regra mais dura das três lentes, e é proposital: para esta leitura, um
backdate excelente não é um carro caro — é um carro que deixou de existir.

---

## O Construtor

> O 993 é uma plataforma, não um relicário. O valor não está no que saiu de fábrica —
> está na qualidade e na coerência da execução.

**Compra para** transformar, ou para comprar pronto um build cuja assinatura respeita.
**Ignora** matching numbers, prêmio por cor de fábrica, contagem de donos.

**Valoriza**
- Coerência do conceito — não um catálogo de peças soltas
- Quem construiu: a assinatura do builder é o ativo
- Documentação completa do build: notas, dyno, fotos do processo
- Relação potência/peso, não potência absoluta
- Reversibilidade quando a peça-base é rara

**Sinais de alerta**
- Build inacabado vendido como "só faltam detalhes"
- Sem dyno e sem notas fiscais do motor
- Peças órfãs — fabricante fora de operação, sem reposição
- Solda de alargamento mal executada, gaps irregulares
- Builder anônimo em carro com preço de builder famoso

**Vocabulário** — backdate · hot rod · RS-spec · restomod · 3.6 para 3.8 stroker ·
ITB · carbono seco · builder pedigree · dyno sheet · peso final

**Builders acompanhados** — Gunther Werks · RUF · DP Motorsport · Rothsport ·
Sharkwerks · Bisimoto · Kalmar · Theon Design · Paul Stephens Autoart · Tuthill

**Como pontua**

| Critério | Peso | Leitura |
|---|---:|---|
| `build_coherence` | 35% | catálogo de peças 0 · inconsistente 35 · coerente 80 · exemplar 100 |
| `builder_pedigree` | 25% | desconhecido 20 · oficina local 50 · reconhecido 85 · consagrado 100 |
| `build_documentation` | 15% | nenhuma 0 · só fotos 35 · notas 70 · dossiê 100 |
| `power_to_weight` | 15% | 200 hp/t → 0 · 400 hp/t → 100 |
| `price_vs_index` | 10% | −20% vs índice → 100 · +20% → 0 |

Penalidades: build inacabado −30 · peças órfãs −15 ·
**"bom demais para cortar" −15** — um exemplar original de baixa quilometragem perde
pontos aqui, porque cortá-lo destrói valor e desagrada a comunidade.

A originalidade do carro-base tem peso **zero** nesta lente. Não é esquecimento: é a
afirmação de que, para esta leitura, ela não é informação.

---

## A mistura

Nenhum leitor real é uma lente pura. O digest ranqueia por uma combinação:

```
score_final = Σ (peso_da_lente × score_da_lente)
```

Padrão do perfil — **Piloto 50% · Colecionador 35% · Construtor 15%**: alguém que dirige
o carro, respeita a originalidade e observa o cenário de builds sem pretender construir um.

Presets disponíveis nos botões do digest: `equilibrado`, `só dirigir`, `só investir`,
`só construir`.

### A mistura muda o vencedor

Cinco anúncios de exemplo, ranqueados pela mesma tabela sob pesos diferentes:

| Anúncio | Padrão | Só investir | Só construir |
|---|---:|---:|---:|
| 1997 — histórico completo, uso regular | **1º** (77) | 2º (78) | 2º |
| 1997 — rodado e revisado | 2º (72) | 3º (60) | 3º |
| 1996 — backdate de builder reconhecido | 3º (62) | 5º (38) | **1º** |
| 1997 — dealer com pouca informação | 4º (55) | 4º (55) | 4º |
| 1998 — baixa km, tudo original, parado | 5º (41) | **1º** (88) | 5º |

O último vira primeiro. É esse comportamento que justifica ter três personas em vez de
uma — e é o que o card decorativo nunca entregou.

---

## Dado ausente não é nota zero

Anúncio de dealer com uma foto e duas linhas de texto é comum, e tratá-lo como carro ruim
seria um erro de leitura: falta informação, não falta qualidade.

Quando um sinal não vem, o critério é **removido** e os pesos restantes são
renormalizados. O que cai é a `confidence`, exibida ao lado da nota — não a nota.

No exemplo acima, o anúncio "dealer com pouca informação" pontua 55 com **18% de
confiança**. A leitura correta é "não sei", e o digest diz isso em vez de fingir que sabe.

Anúncios com confiança abaixo de 50% aparecem com o indicador em amarelo.

---

## Onde as lentes agem além do ranking

| Seção | Efeito da lente |
|---|---|
| Mercado | Ordem da tabela e as três notas por anúncio |
| Peças | Cada fornecedor marcado com as lentes que atende |
| Vídeos | Um bloco por lente, alimentado pelas `video_queries` da persona |
| Alertas | `bom_negocio` dispara sobre o score da **sua** mistura |
| Fontes | `source_bias` indica quais fontes priorizar por lente |
