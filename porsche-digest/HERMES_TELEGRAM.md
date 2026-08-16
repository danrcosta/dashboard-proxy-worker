# Evolução via Telegram — `@Danrcbh_bot`

O digest é editável por comando: cada comando altera **um arquivo de configuração**,
roda a validação e republica. Nenhum comando escreve HTML — o layout vem do template, o
conteúdo vem do JSON, e o Telegram mexe só nas definições.

```
comando → altera config/*.json → node tools/build.mjs → wrangler pages deploy → confirmação
```

Se `build.mjs` falhar, **nada é publicado** e o bot devolve o erro. Config inválida nunca
chega ao ar.

---

## Comandos

### `/digest`
Gera e publica agora, fora do horário diário.

```
/digest              geração completa
/digest --dry        gera e valida, não publica
/digest --secao mercado    regenera só uma seção
```

Resposta: nº de anúncios por seção, melhor aderência, alertas disparados, fontes que
falharam, URL publicada.

---

### `/perfil` — ajusta a mistura das lentes
Escreve `persona_weights` em `config/profile.json`. Valores são normalizados para somar 1.

```
/perfil                                          mostra a mistura atual
/perfil piloto=60 colecionador=30 construtor=10
/perfil so_investir                              aplica um preset
```

Presets: `equilibrado`, `so_dirigir`, `so_investir`, `so_construir`.

> Os sliders do digest alteram só o **seu navegador** (localStorage). `/perfil` muda o
> padrão de todo mundo que abrir o link, e é o peso usado pelos alertas.

---

### `/fonte` — administra o registro de fontes
Escreve `config/sources.json`.

```
/fonte                              lista as 25 com método e status de verificação
/fonte status canepa                detalha uma fonte
/fonte off mobile_de                desabilita sem apagar
/fonte on mobile_de
/fonte add <id> <url> <regiao> <tipo>
/fonte probe                        roda probe-sources.mjs --write e relata o que mudou
```

`/fonte probe` é o comando que converte os métodos de ingestão de hipótese em fato.
Vale rodá-lo mensalmente: sites mudam de estrutura e feeds somem sem aviso.

---

### `/lente` — ajusta os critérios de uma persona
Escreve `config/personas.json`. É o comando mais poderoso e o que mais exige cuidado:
muda como **todo** anúncio é lido.

```
/lente piloto                                     mostra os critérios e pesos
/lente piloto peso service_history=35             realoca e renormaliza para somar 1
/lente colecionador flag undisclosed_repaint=-30  ajusta uma penalidade
/lente piloto faixa_km 50000-170000               move a faixa ideal
/lente reset piloto                               volta ao padrão versionado
```

Toda alteração é commitada com o comando original na mensagem, então `git log` de
`config/personas.json` é o histórico de como sua leitura de mercado mudou ao longo do
tempo. É o registro mais interessante do projeto — vale não reescrevê-lo.

---

### `/carro` — atualiza a ficha
Escreve `config/profile.json`.

```
/carro                              mostra a ficha e o que falta
/carro cor_externa=Arena Red
/carro km=118000                    também carimba mileage_updated_at
/carro revisao 2026-07-14 117200    data + km da última revisão
```

---

### `/alerta` — regras de notificação
Escreve `alerts.rules` em `config/profile.json`.

```
/alerta                                  lista as regras ativas
/alerta on bom_negocio
/alerta off queda_indice
/alerta add cor_favorita "color == 'Riviera Blue'"
```

Regras padrão: `bom_negocio` (aderência ≥80 e ≥10% abaixo do índice), `cor_rara`,
`queda_indice`, `cotacao_defasada`.

---

### `/status`
Diagnóstico sem publicar nada: última geração, `meta.seed`, idade da cotação, fontes
verificadas vs. registradas, fontes que falharam nas últimas 24h, pendências da ficha.

---

### `/ajuda`
Lista os comandos. `/ajuda <comando>` detalha um.

---

## Contrato de implementação para o Hermes

Cada handler segue os mesmos cinco passos:

1. **Parse** — comando desconhecido devolve `/ajuda`, nunca altera arquivo.
2. **Escrita** — altera **um** arquivo de `config/`, preservando ordem de chaves e comentários.
3. **Validação** — `node tools/build.mjs`. Falhou: reverte, devolve o erro, não publica.
4. **Publicação** — `wrangler pages deploy public --project-name porsche-digest`.
5. **Commit** — mensagem contendo o comando original e quem enviou.

### Regras que não devem ser afrouxadas

**Só o dono comanda.** Verificar o `chat_id` do remetente contra uma allowlist. Comandos
alteram um site público — não basta conhecer o nome do bot.

**Nenhum comando escreve em `public/data/digest.json`.** Esse arquivo é do coletor. Um
comando que edite conteúdo diretamente cria um digest que não corresponde a nenhuma
coleta, e o próximo ciclo o sobrescreve em silêncio.

**Nenhum comando desliga a faixa de `seed`.** `meta.seed` só vira `false` quando o
coletor produz dados reais. Um `/seed off` transformaria dado de exemplo em dado com
aparência de verdadeiro, que é exatamente o que o campo existe para evitar.

**Toda alteração é commitada.** Config alterada sem commit se perde no próximo deploy e
não deixa rastro de quando a leitura mudou.

---

## O que ainda não existe

Este documento é o **contrato**, não a implementação. O bot ainda precisa ganhar os
handlers acima. A ordem sugerida:

1. `/status` e `/digest --dry` — só leem, e já dão valor imediato
2. `/perfil` e `/carro` — escrita simples, baixo risco
3. `/fonte probe` — o que mais desbloqueia trabalho de coleta
4. `/lente` — por último: exige validação cuidadosa dos pesos
