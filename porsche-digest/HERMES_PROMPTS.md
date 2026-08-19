# Mensagens prontas para o Hermes

Sequência para colar no `@Danrcbh_bot`, uma mensagem por vez. Cada bloco cabe no limite
de 4096 caracteres do Telegram e é auto-contido.

**Ordem importa.** Cada mensagem depende da resposta da anterior — não adiante.

Estado: 1 e 2 já rodaram. Próximas a enviar: **2b** e **3**.

Os scripts não têm nenhuma dependência externa: só builtins do Node (18+, ideal 20+).
Não há `npm install` em lugar nenhum desta sequência.

---

## 1 · Preparar o ambiente

```
Clone o repositório danrcosta/dashboard-proxy-worker e faça checkout da branch
claude/porsche-993-digest-improvements-g9rk35 (não é a main — o trabalho está nessa branch).

Depois entre em porsche-digest/ e rode, nesta ordem:

  node --version
  node tools/build.mjs
  node tools/score-listing.mjs --test

Esperado: Node 18 ou superior; "build ok." com quatro avisos (fontes não verificadas,
dados de exemplo, cotação defasada); e "11/11 asserções passaram."

Não instale nada — os scripts usam só builtins do Node.

Depois sirva a pasta public/ num servidor estático qualquer e abra no navegador, só para
confirmar que a página monta:

  npx serve public

Me responda com: a versão do Node, a saída dos dois comandos, e se a página abriu.
Se algum comando falhar, mande a mensagem de erro inteira sem resumir.
```

---

## 2 · Verificar as fontes — o passo que desbloqueia tudo

```
No repositório, dentro de porsche-digest/, rode:

  node tools/probe-sources.mjs

Isso é um dry-run: faz um GET em cada uma das 25 fontes registradas em
config/sources.json, com pausa de 1,5s entre elas, e classifica a resposta em
rss / json_api / scrape / unknown. Não escreve nada ainda. Leva uns 40 segundos.

Confira a tabela. Se fizer sentido, rode de novo gravando:

  node tools/probe-sources.mjs --write
  node tools/build.mjs

Depois faça commit e push na mesma branch:

  git add config/sources.json
  git commit -m "Verify source ingestion methods against live feeds"
  git push origin claude/porsche-993-digest-improvements-g9rk35

Me responda com:
1. A tabela completa que o probe imprimiu
2. As duas linhas do resumo (quantas verificadas, quantas automatizáveis)
3. Quais fontes deram rss e se a coluna "993?" veio "sim" nelas

Contexto de por que isso importa: hoje as 25 fontes estão marcadas verified:false porque
o ambiente onde o projeto foi escrito não tinha rota de rede para os sites de leilão.
O método de ingestão de cada uma é hipótese, não fato. Esta verificação é o que decide
quais fontes vale automatizar primeiro.

Importante: não habilite scraping em nenhuma fonte antes de checar robots.txt e os Termos
de Uso. Bring a Trailer e Classic.com restringem uso automatizado; Mobile.de e AutoScout24
já estão marcados como manual por isso.
```

---

## 2b · Re-verificar com as candidatas novas

> Rodar depois que a 2 responder. Corrige o falso positivo do Bring a Trailer.

```
Puxe as últimas alterações da branch claude/porsche-993-digest-improvements-g9rk35 —
corrigi dois defeitos no probe que a sua primeira rodada expôs.

O que mudou: feed que responde XML mas com ZERO itens não conta mais como fonte
utilizável (era o caso do Bring a Trailer, que eu tinha marcado como rss por engano), e
agora cada fonte pode ter várias URLs candidatas, testadas em ordem. Bring a Trailer e
Porsche Newsroom ganharam quatro candidatas cada.

Dentro de porsche-digest/:

  git pull origin claude/porsche-993-digest-improvements-g9rk35
  node tools/probe-sources.mjs

Me responda com a tabela e as linhas de resumo. Quero saber especificamente:
1. Alguma das 4 candidatas do bring_a_trailer devolveu feed COM itens?
2. E alguma das 4 do porsche_newsroom?

Se alguma pegar, rode com --write, depois node tools/build.mjs, e faça commit e push
na mesma branch.

Uma correção de contagem, para não seguirmos com número errado: são 7 fontes com HTTP 403
(classic_com, hemmings, collecting_cars, canepa, suncoast, fcp_euro, pelican_parts), 3
manuais (mobile_de, autoscout24, porsche_classic_partners) e 3 automatizáveis de verdade
(elferspot, classic_driver, exchange_rate) — não 4.

Investigação separada: abra no navegador cada uma das 7 que deram 403 e procure se existe
feed RSS ou API oficial documentada — link no rodapé, /developers, /api, ou uma tag
<link type="application/rss+xml"> no HTML da página.

NÃO troque o User-Agent para contornar o 403. É controle de acesso deliberado do site.
Sem rota oficial, a fonte fica como manual mesmo.
```

---

## 3 · Descobrir o que os feeds contêm, e coletar o que já dá

```
Antes de escrever o coletor de mercado, preciso saber o que os feeds que funcionam
realmente trazem.

Hoje só 3 fontes são automatizáveis: elferspot e classic_driver (RSS, 10 itens cada) e
exchange_rate (JSON). O bring_a_trailer não conta — o feed dele veio com zero itens.

PASSO 1 — Baixe os feeds do elferspot e do classic_driver e me mostre, de cada um, os 3
primeiros itens com: título, link, data e as categorias/tags, se houver.

PASSO 2 — Me diga, para cada feed, qual dos dois ele é:
  (a) ANÚNCIOS de carro à venda, com preço
  (b) MATÉRIAS editoriais / artigos de revista

Isso decide o rumo do projeto. Se os dois forem (b), a seção "Em pauta" pode ser
automatizada agora, mas "O Mercado" fica sem nenhuma fonte automatizável — e aí a
conversa é outra: ou parser de HTML, ou curadoria manual pelo Telegram.

PASSO 3 — Implemente só o que já é possível hoje, seguindo CONTRATO_DIGEST_JSON.md:
  - newsroom.articles a partir dos feeds que forem editoriais
  - meta.exchange_rate com a cotação USD/BRL real, stale:false

NÃO mexa em market.live nem em market.sold ainda, e mantenha meta.seed:true enquanto o
mercado continuar sendo dado de exemplo. O aviso amarelo no topo do digest existe
exatamente para esse estado intermediário — não o desligue.

Valide antes de considerar pronto:

  node tools/build.mjs
  node tools/score-listing.mjs --test

Me responda com as respostas dos passos 1 e 2, e o diff do que mudou no digest.json.
```

---

## 4 · Escrever o coletor de mercado

> **Depende da resposta do passo 2 acima.** Se os feeds forem editoriais, este prompt
> precisa ser reescrito para scraping ou curadoria — não use como está.

### Rascunho, a reescrever quando o passo 2 da mensagem 3 responder

```
Escreva o coletor diário do Porsche Digest. Ele deve produzir o arquivo
porsche-digest/public/data/digest.json seguindo exatamente o contrato em
porsche-digest/CONTRATO_DIGEST_JSON.md — leia esse arquivo inteiro antes de começar.

Escopo do recorte: Porsche 911 (993) Carrera 4S, anos-modelo 1996, 1997 e 1998.
Filtros e regra de dedup estão em config/sources.json (chaves vin_filter, text_filter
e dedup). Classic.com e Hemmings são agregadores: o mesmo carro aparece neles e na
plataforma de origem, e a origem prevalece.

Colete apenas das fontes que o probe marcou como rss ou json_api. As demais ficam para
depois — não improvise scraping agora.

O que produzir a cada execução:
- meta com seed:false, generated_at do dia com offset, e a cotação USD/BRL real
- 5 anúncios em market.live e 5 em market.sold, após dedup
- os sinais das lentes em cada anúncio, seguindo a regra de ouro do contrato:
  sinal só entra quando há evidência no anúncio; na dúvida, omita
- newsroom.articles a partir das fontes editoriais

Não preencha nada por suposição. Campo sem evidência fica ausente — o digest trata dado
ausente reduzindo a confiança exibida, não a nota, e isso é proposital.

Ao final, valide antes de considerar pronto:

  node tools/build.mjs
  node tools/score-listing.mjs --test

Se o build reprovar, corrija o coletor. Não publique nada com o build vermelho.
```

---

## 5 · Publicar no Cloudflare Pages

```
Publique o digest no Cloudflare Pages como projeto separado — ele não deve tocar o Worker
dashboard-proxy que existe na raiz do repositório.

Dentro de porsche-digest/:

  node tools/build.mjs
  npx wrangler pages deploy public --project-name porsche-digest

Depois configure o domínio digest.costafamily.ai apontando para esse projeto Pages.

Me responda com a URL que o wrangler devolveu e se o domínio já resolve.

Regra permanente: nunca publique sem rodar node tools/build.mjs antes e ele passar.
Um digest do dia anterior, com a data visível, é melhor que um digest de hoje com número
inventado.
```

---

## 6 · Os comandos de Telegram

```
Implemente os handlers de comando do Porsche Digest conforme o contrato em
porsche-digest/HERMES_TELEGRAM.md — leia o arquivo inteiro antes.

Comece pelos dois que só leem, porque dão valor imediato e não têm risco:

  /status          diagnóstico: última geração, meta.seed, idade da cotação,
                   fontes verificadas vs registradas, pendências da ficha
  /digest --dry    gera e valida sem publicar

Depois, nesta ordem: /perfil e /carro (escrita simples), /fonte probe, e /lente por último.

Todo handler segue os mesmos cinco passos: parse → escreve UM arquivo de config/ →
node tools/build.mjs → se passou, publica → commit com o comando original na mensagem.
Se o build falhar, reverta e devolva o erro. Config inválida nunca chega ao ar.

Três regras que não devem ser afrouxadas:
1. Verifique o chat_id do remetente contra uma allowlist. Os comandos alteram um site
   público — conhecer o nome do bot não basta.
2. Nenhum comando escreve em public/data/digest.json. Esse arquivo é do coletor.
3. Nenhum comando desliga meta.seed. Isso só vira false quando há dado real coletado.
```

---

## Depois

Quando a 2 responder, me traga a tabela do probe. Com ela dá para:

- ajustar o prompt 3 para as fontes que realmente têm feed
- reordenar a prioridade de ingestão em `config/sources.json`
- decidir quais das 25 valem esforço de parser e quais ficam em curadoria manual
