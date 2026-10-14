# Especificação do app — Fuvest 1ª fase (PWA offline para Android)

Usuário: Lucas, 18 anos, vai fazer a Fuvest em 01/11/2026. Vai usar no celular Android (Chrome), no metrô, sem internet.
Hospedagem: GitHub Pages em `https://jhopev07.github.io/fuvest-app/` → **todos os caminhos devem ser relativos** (`./`), nunca `/algo`.
Interface toda em português do Brasil, texto curto e direto.

## Princípios de código
Siga Código Limpo e O Programador Pragmático: funções pequenas com nomes claros, uma responsabilidade por módulo,
sem duplicação, sem números mágicos (constantes nomeadas), sem dependências externas nem CDN (tudo tem que funcionar offline).
JavaScript moderno com ES modules (`<script type="module">`), sem build step, sem framework.

## Estrutura de arquivos (raiz do repositório)
```
index.html
manifest.webmanifest
sw.js                     # service worker
css/style.css
js/main.js                # inicialização e roteamento entre telas
js/config.js              # constantes: distribuição do simulado, nomes das matérias, tempo da prova
js/banco.js               # carrega data/questoes.json, embaralha alternativas, seleção de questões
js/db.js                  # IndexedDB (sem biblioteca): tentativas, sessões, simulado em andamento
js/telas/*.js             # uma tela por arquivo (inicio, questao, simulado, resultado, historico, ajustes)
js/rascunho.js            # escrita à mão numa tela de questão (folha de escrita + escrita sobre a questão)
js/rascunho/*.js          # folha de escrita: quadro (canvas), vista (zoom/pan), traços, caneta, camada sobre a questão
js/zoom-texto.js          # tamanho do texto das questões (A−/A+ e pinça)
js/visualizador.js        # tabela/figura em tela cheia com pinça, pan e duplo toque
js/gestos.js, js/camadas.js  # gestos de 1 e 2 dedos; camadas que o "voltar" do Android fecha
js/render.js              # helpers de renderização segura (escape HTML, **negrito**, parágrafos, tabela)
icons/icon-192.png, icons/icon-512.png, icons/maskable-512.png
data/questoes.json        # GERADO por tools/build.py — não editar à mão
tools/build.py            # junta questoes/*.json → data/questoes.json, valida, e atualiza VERSAO no sw.js
```

## Formato de cada questão (data/questoes.json)
Ver docs/SPEC.md seção 4. Campos: id, materia, tema, nivel ("fuvest"|"acima"), origem, inter[], texto?, tabela?, svg?,
enunciado, alternativas[5], correta (0–4), explicacao, erradas[5].
`data/questoes.json` = `{"versao": "<hash>", "geradoEm": "<iso>", "questoes": [...]}`.
Textos usam `\n\n` para parágrafos e `**negrito**`. SEMPRE escapar HTML antes de aplicar o negrito.

Matérias (chave → nome exibido): portugues→Português, literatura→Literatura, ingles→Inglês, arte→Arte,
edfisica→Educação Física, matematica→Matemática, fisica→Física, quimica→Química, biologia→Biologia,
historia→História, geografia→Geografia, filosofia→Filosofia, sociologia→Sociologia.
Dê uma cor de destaque discreta para cada área (Linguagens, Matemática, Natureza, Humanas).

## Alternativas
O app EMBARALHA a ordem das 5 alternativas a cada exibição (as explicações não citam letras) e mostra letras A–E.
Guarde sempre o índice ORIGINAL escolhido.

## Telas e funcionalidades

### 1. Início
- Resumo: questões respondidas, % de acerto geral, sequência de dias, e barras de desempenho por matéria.
- Botões grandes:
  - **Questões aleatórias** → abre filtros: matérias (multi-seleção com "todas"), nível (todos / só "acima"), "priorizar não respondidas" (ligado por padrão). Sem filtro, sorteia com peso proporcional ao banco.
  - **Simulado Fuvest — 80 questões**. Se houver simulado em andamento, mostrar **Continuar simulado** em destaque.
  - **Revisar erros**: fila de questões cuja ÚLTIMA tentativa foi errada.
  - **Histórico**.
  - **Ajustes e backup**.

### 2. Modo prática (aleatórias e revisar erros)
- Uma questão por tela: chip com matéria e tema, selo de nível ("Nível Fuvest" / "Acima da Fuvest"), origem em texto pequeno, ícone se interdisciplinar.
- Texto de apoio, tabela (rolagem horizontal se necessário), enunciado, alternativas como botões grandes (mínimo 48px de altura).
- **Um toque na alternativa = resposta.** Feedback imediato:
  - a correta fica verde; se errou, a escolhida fica vermelha;
  - aparece "Acertou!" / "Errou — a resposta é X";
  - **explicação completa** abaixo; e em cada alternativa errada, um texto pequeno com o porquê dela estar errada (campo `erradas`, mapeado pela ordem original).
- Botão **Próxima** fixo embaixo. Contador da sessão (acertos/tentativas).
- Registrar cada tentativa no IndexedDB: {qid, materia, tema, nivel, escolhida (índice original), acertou, tempoMs, modo, sessaoId, quando}.

### 3. Modo simulado (80 questões)
- Distribuição fixa (em js/config.js): portugues 7, literatura 5, ingles 7, arte 2, edfisica 1, matematica 10, fisica 8,
  quimica 9, biologia 9, historia 9, geografia 9, filosofia 2, sociologia 2 = 80.
  Preferir questões nunca vistas; se faltar, completar com as menos vistas; se a matéria não tiver questões suficientes,
  completar com outras da mesma área e avisar na tela inicial do simulado.
- Ordem das questões: agrupadas por área como numa prova (Linguagens, Matemática, Natureza, Humanas), embaralhadas dentro da área.
- **Sem feedback durante a prova.** Tocar numa alternativa marca (fica destacada); pode trocar. Botão "marcar para revisar".
- Navegação: anterior / próxima + botão que abre uma grade com os 80 números (respondida, em branco, marcada).
- Cronômetro: tempo de prova 5h (300 min). Mostrar tempo usado e restante. O tempo só corre com o app aberto (pausar em `visibilitychange`), porque ele vai fazer em partes no metrô. Mostrar também ritmo (min/questão) e meta de 3,75 min/questão.
- O simulado em andamento é salvo continuamente no IndexedDB (respostas, ordem, ordem embaralhada das alternativas, tempo). Fechar o app e voltar continua de onde parou.
- **Entregar prova** (com confirmação mostrando quantas em branco).

### 4. Resultado do simulado + feedback da prova inteira
- Nota: acertos/80, %, e aviso se abaixo de 24 acertos (corte eliminatório da Fuvest).
- Por matéria e por área: acertos/total e %.
- **Feedback da prova** (gerado no app, por regras):
  - pontos fortes (matérias ≥ 70%) e pontos fracos (≤ 50%), temas errados agrupados;
  - erros em questões "Nível Fuvest" (prioridade máxima de revisão) vs. erros em "Acima da Fuvest";
  - gestão do tempo (tempo médio por questão vs. 3,75 min; questões em branco);
  - 3 recomendações objetivas do que estudar a seguir, a partir dos temas mais errados.
- Lista das 80 questões (número, matéria, sua resposta, certa/errada); tocar abre a questão em modo revisão com explicação completa.
- Botão **Copiar relatório** (texto puro com nota, por matéria, temas errados e ids) para colar numa conversa com o Claude e pedir análise mais profunda.
- As 80 respostas viram tentativas no histórico (modo "simulado").

### 5. Histórico
- Lista de simulados feitos (data, nota, tempo) → abre o resultado.
- Desempenho por matéria e por tema (acertos/tentativas), ordenado do pior para o melhor.
- Lista de todas as tentativas com filtro (matéria, só erradas), tocar abre a questão em revisão.

### 6. Ajustes e backup
- **Exportar progresso** (baixa um .json com tudo do IndexedDB) e **Importar progresso** (input file, mescla sem duplicar).
- Status do armazenamento persistente (`navigator.storage.persisted()`); chamar `navigator.storage.persist()` no primeiro uso.
- Versão do banco (nº de questões, versão), versão do app.
- Tema: automático / claro / escuro.
- Apagar todo o progresso (com confirmação dupla).

### 7. Folha de escrita (essencial)
Botão flutuante ✏️ nas telas de questão (prática, revisar erros, revisão e simulado). Abre a **folha de escrita**: uma área limpa, separada da questão (escrever por cima do enunciado poluído não funciona bem).
- **Modo dividido**: em cima a questão (rolável, com zoom de leitura), embaixo uma folha em branco com quadriculado bem leve. A barra entre as duas é a divisória: arrastá-la ajusta a proporção (padrão 40% questão / 60% folha; limites 15%–70%; a última proporção fica salva no aparelho).
- Na prática dá para marcar a alternativa (e ver o feedback) sem sair do modo dividido; ao passar para a próxima questão a folha continua aberta, com a folha daquela questão.
- **Tela cheia**: botão na barra da folha. A questão sai e fica uma faixa recolhível no topo ("Ver enunciado") com texto de apoio, tabela, enunciado e alternativas para consulta.
- Na folha: **1 dedo (ou caneta) desenha**; **2 dedos fazem pan e a pinça dá zoom** (50% a 400%). Os traços são vetores na unidade da folha e são redesenhados na escala atual, então continuam nítidos. A folha é "infinita" para baixo (dá para rolar até 2 telas abaixo do último traço) e para a direita até o traço mais distante. Com uma caneta encostada, toques da palma são ignorados.
- Ferramentas: caneta fina/grossa, 3 cores, borracha (apaga o traço tocado inteiro), desfazer, refazer, limpar (desfazer traz de volta), botão de zoom que mostra o zoom atual e volta a 100% ao toque, tela cheia, fechar.
- **Escrever sobre a questão** (opção secundária, botão na barra da folha): a camada transparente antiga por cima do enunciado, com fundo transparente/papel, modo "rolar" e as mesmas ferramentas.
- A folha e a escrita sobre a questão são **por questão**: em memória durante a sessão (com desfazer/refazer e zoom de cada questão); no simulado, salvas também no IndexedDB junto do simulado em andamento (`escrita: { folhas, sobre }`), voltando ao recarregar.
- O "voltar" do Android fecha a folha (ou a camada aberta) em vez de sair da questão.
- Pointer Events, `touch-action: none` no canvas, escala por `devicePixelRatio`, traços suavizados (curvas quadráticas entre pontos médios).

### 8. Zoom de leitura
- **A− / A+** na barra das telas de questão: tamanho do texto da questão de 14 a 28 px, em passos de 2 px (padrão 17). Vale para todas as telas de questão e fica salvo no aparelho.
- **Pinça com 2 dedos** sobre a questão ajusta o mesmo tamanho (inclusive no modo dividido). O zoom é por `font-size` (variável CSS `--texto-questao`, com o texto da questão em `em`), nunca `transform`: o texto refaz as quebras e não surge rolagem horizontal. Um dedo continua rolando normalmente.
- **Tabelas e figuras**: tocar abre um visualizador em tela cheia (começa com a tabela inteira visível), com pinça para ampliar, um dedo para mover e duplo toque para ampliar/voltar. O "voltar" do Android ou o X fecham.
- O viewport não usa `user-scalable=no` nem `maximum-scale`: o zoom do navegador continua disponível para acessibilidade. As áreas com gestos próprios (folha, visualizador, pinça no texto) cancelam o gesto do navegador só enquanto há dois dedos sobre elas.

## Offline e PWA
- `manifest.webmanifest`: name "Fuvest 1ª fase", short_name "Fuvest", start_url "./", scope "./", display "standalone", cores do tema, ícones 192/512 + maskable.
- `sw.js`: constante `const VERSAO = "..."` (o build.py substitui). No install, pré-cacheia TODOS os arquivos do app (lista explícita) e `data/questoes.json`; activate apaga caches antigos; fetch: cache-first com fallback para rede; navegação cai em `./index.html`.
- Quando houver um SW novo esperando, mostrar uma faixa "Nova versão com mais questões — toque para atualizar" (postMessage SKIP_WAITING + reload).
- Na primeira abertura, mostrar quando o app está pronto para uso offline ("Pronto para usar sem internet ✓").

## Design
"Bonitinho", limpo e confortável para ler no celular por muito tempo: fonte do sistema, corpo 17px, altura de linha 1.55,
largura máxima de leitura ~720px, bom contraste nos dois temas (claro e escuro, seguindo o sistema por padrão),
cantos arredondados, sombras sutis, animações curtas (respeitar prefers-reduced-motion). Áreas de toque ≥ 44px.
Respeitar `env(safe-area-inset-*)`. Nada de layout que role na horizontal (exceto tabelas largas dentro do próprio contêiner).
Ícone do app: gerar PNGs com Python/PIL — um "F" estilizado ou um símbolo simples sobre fundo de cor sólida.

## Testes
Antes de terminar: rodar `python3 tools/build.py`, servir com `python3 -m http.server` e testar num navegador headless
(se houver Playwright/Chromium disponível) com viewport de celular (412×915): fluxo de prática, simulado completo (responder via script),
resultado, rascunho (eventos de ponteiro), exportar/importar, e recarregar offline. Corrigir todos os erros de console.
Folha de escrita e zoom: testar com multitoque real (CDP `Input.dispatchTouchEvent` com 2 pontos) — desenhar, pinça e pan na folha,
desfazer/refazer, divisória, tela cheia, folha preservada por questão, simulado com folha + recarregar, A−/A+ e pinça no texto, visualizador.
Scripts: `tools/testes/testar_app.py` (fluxos gerais) e `tools/testes/testar_folha_zoom.py` (folha e zoom).

Playwright já está instalado: use `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 seu_teste.py` (Python, `from playwright.sync_api import sync_playwright`). Scripts de teste ficam em `tools/testes/`.
