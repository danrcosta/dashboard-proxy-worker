# Linha editorial

> Benchmark registrado em [`config/library.json`](config/library.json) ·
> Capítulos do Arquivo em [`config/dossiers.json`](config/dossiers.json)

Este documento existe para uma função só: impedir que a próxima evolução volte a
transformar o digest num painel. Toda proposta nova deve ser checada contra o que está
aqui antes de virar código.

---

## O diagnóstico que motivou a v6

A versão anterior era um **dashboard**: oito caixas paralelas, todas com o mesmo peso
visual, cada uma respondendo a uma pergunta diferente. Ler de cima a baixo não produzia
nenhuma conclusão — só oito conclusões parciais, empilhadas.

Isso é literalmente a definição de amontoado de informação. E não se resolve melhorando
cada caixa: se resolve estabelecendo hierarquia entre elas.

As publicações do benchmark não são painéis. São jornais, e jornais têm três coisas que
um painel não tem:

1. **Um argumento por edição.** A capa diz o que importa hoje. O resto se subordina.
2. **Hierarquia radical.** A matéria principal ocupa espaço desproporcional. O acervo
   vive no rodapé, e tudo bem.
3. **Voz.** Alguém escreveu aquilo, e dá para perceber. Dado sem leitura é tabela.

---

## Os cinco princípios

### 1 · Um argumento por edição

A abertura não resume o digest — ela **defende uma coisa**. Quando o Hermes escreve o
`lead`, escreve uma tese e a sustenta em três parágrafos. Quando não escreve, o digest
compõe uma abertura a partir dos próprios dados, e ela é declaradamente derivada.

O teste: se a abertura pudesse ser trocada entre duas edições sem ninguém notar, ela não
é uma abertura — é um cabeçalho.

### 2 · Hierarquia antes de densidade

Nem toda seção merece o mesmo espaço. A ordem atual é deliberada:

| | Seção | Papel |
|---|---|---|
| — | Abertura | O argumento do dia |
| 01 | Em pauta | Noticiário, compacto — não compete com a capa |
| 02 | O Arquivo | A matéria de capa. Espaço desproporcional, de propósito |
| 03 | As três lentes | A chave de leitura, antes do que ela filtra |
| 04 | O Mercado | Onde a chave é aplicada |
| 05 | O Índice | Contexto de preço |
| 06 | A Oficina | Referência de uso |
| 07 | A Estrada | Cultura |
| 08 | O Carro | Ficha pessoal |
| 09 | A Biblioteca | Acervo — o rodapé é o lugar certo |

Seção nova entra **posicionada**, não anexada ao fim.

### 3 · Serifada opina, sem-serifa mede

A tipografia carrega a distinção entre argumento e medição sem precisar rotular nenhum
dos dois. Prosa editorial em serifada; preço, nota, quilometragem e rótulo em sem-serifa.

Consequência prática: se um conteúdo novo não couber claramente em um dos dois lados, ele
provavelmente não está claro o bastante para entrar.

Nenhuma fonte externa é carregada — o digest não depende de CDN, então trabalha com as
stacks do sistema. Um serif próprio, auto-hospedado em `woff2`, é a melhoria de maior
impacto visual disponível e está no roadmap.

### 4 · Cor por exceção

Papel e tinta como base. Ouro só como acento. O status de um leilão é um ponto colorido
com uma palavra ao lado, não uma pílula de semáforo — a versão anterior usava verde,
amarelo e vermelho saturados, que empurravam a leitura para "terminal de operações"
quando o registro pretendido é "publicação".

### 5 · O que não se sabe aparece como não sabido

Este é o princípio que separa o digest de um agregador. Campo sem confirmação aparece
como pendência. Índice de exemplo se anuncia como exemplo. Anúncio com pouca informação
recebe nota com confiança baixa, exibida ao lado — e a explicação diz quais campos o
anúncio não informa.

O ganho não é moral, é prático: um digest que sinaliza sua própria incerteza pode ser
usado para decidir. Um que não sinaliza precisa ser conferido inteiro, e aí não serve
para nada.

---

## O que o Arquivo resolve

`config/dossiers.json` guarda capítulos escritos uma vez, que rodam por dia do ano.

Isso resolve o problema estrutural de qualquer digest diário: **num dia sem anúncio novo,
não há o que ler**. Com o Arquivo, sempre há — e o que há é o que efetivamente constrói
conhecimento sobre o carro ao longo do tempo, que era o objetivo declarado do projeto.

Os capítulos atuais cobrem o encerramento da linhagem air-cooled, o eixo traseiro
multibraço, a carroceria emprestada do 4S, o VarioRam, o desenho de Tony Hatter, a cor
como atributo de mercado e a inversão de preço pós-996.

**Regra de honestidade do Arquivo:** o corpo é prosa; os números vivem em `key_facts`; e
o que merece conferência contra fonte primária vai em `fact_check`, que o digest exibe
como "A confirmar". Um capítulo sem `fact_check` é um capítulo que afirma só o que é
seguro afirmar — não é um capítulo mais confiante.

---

## O julgamento por anúncio

Cada anúncio no Mercado carrega uma frase. Ela vem de um de dois lugares, e a diferença
é visível:

- **`editorial_note`** — escrita pelo Hermes. Diz o que a nota não diz: procedência,
  contexto, o que o anúncio omite. Renderizada em tinta cheia.
- **Explicação derivada** — quando não há nota editorial, o digest explica a própria nota:
  qual lente pontuou melhor, quais penalidades incidiram, quais campos faltaram.
  Renderizada em itálico esmaecido, para não se passar por opinião humana.

A distinção tipográfica entre as duas é intencional. Máquina explicando máquina não deve
parecer alguém tendo lido o carro.

---

## O que a Biblioteca faz na página

As 14 publicações de referência não estão listadas por cortesia. Elas cumprem duas
funções: dão ao leitor para onde ir depois, e mantêm o benchmark **verificável** — cada
uma registra em `borrow` o que especificamente se toma dela e em `applied_in` onde isso
aparece.

O princípio declarado em `library.principle`: não copiar nenhuma individualmente. 000 e
Type 7 dão a forma; Hagerty e Classic Driver dão a função; Petrolicious e Curves dão o
tom; Stuttcars e Porsche ORIGINALE dão o lastro. A combinação é que produz algo que
nenhuma delas é — inteligência de mercado com voz editorial.

---

## A lacuna conhecida: fotografia

Todo o benchmark é movido a imagem. 000, Type 7, Curves e Petrolicious são, antes de
tudo, projetos fotográficos.

Este digest ainda não tem fotografia — o ambiente onde foi construído não tinha rede para
buscar imagem, e usar foto de terceiro sem licença não é opção num projeto que pode virar
público. O layout foi então resolvido tipograficamente: hierarquia, respiro e fio no lugar
onde a referência usaria uma imagem de largura total.

Funciona, e tem mérito próprio. Mas é uma escolha feita sob restrição, não a versão final.

**Quando houver fotografia**, os pontos de entrada naturais são, em ordem de impacto:

1. Uma imagem de largura total entre a abertura e o Arquivo
2. Uma imagem por capítulo do Arquivo, alinhada à coluna do texto
3. Miniatura por anúncio no Mercado — a partir da própria fonte, com crédito

O que **não** fazer: encher as três de uma vez. A disciplina do Luftgekühlt é mostrar
poucos carros muito bem escolhidos, e ela vale aqui.

---

## Checagem para qualquer evolução futura

```
□ Isso se subordina ao argumento da edição, ou compete com ele?
□ Entra posicionado na hierarquia, ou foi anexado ao fim?
□ É opinião (serifada) ou medição (sem-serifa)? Se não dá para dizer, revisar.
□ Precisa de cor, ou um fio e um rótulo resolvem?
□ O que não se sabe está visível como não sabido?
□ Aumenta densidade sem aumentar conclusão? Então é dashboard — reformular.
```
