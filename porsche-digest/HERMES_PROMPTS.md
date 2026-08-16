# Mensagens prontas para o Hermes

Sequência para colar no `@Danrcbh_bot`, uma mensagem por vez. Cada bloco cabe no limite
de 4096 caracteres do Telegram e é auto-contido.

**Ordem importa.** A 3 depende do resultado da 2 — não adiante.

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

## 3 · Escrever o coletor

> **Só depois da 2.** O que este prompt deve pedir depende de quais fontes têm feed real.
> O texto abaixo é a versão genérica; ajuste a lista de fontes conforme o probe retornar.

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

## 4 · Publicar no Cloudflare Pages

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

## 5 · Os comandos de Telegram

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
