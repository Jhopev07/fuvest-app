// Modo prática: questões aleatórias (com filtros) e fila de revisão de erros.
// Uma questão por vez; um toque na alternativa responde e mostra o feedback.

import { MODOS } from "../config.js";
import { questaoPorId, ordemEmbaralhada, sortearPratica } from "../banco.js";
import { listarTentativas, registrarTentativa } from "../db.js";
import { contarVezesVista, filaDeErros } from "../estatisticas.js";
import { filtrosDaConsulta } from "../filtros-pratica.js";
import { Cronometro } from "../cronometro.js";
import { prepararLeitura, rolarQuestaoParaTopo } from "../leitura.js";
import { EscritaDaTela } from "../rascunho.js";
import { html, montar, icone } from "../render.js";
import { aoAgir, avisar, barraTopo, rolarAte } from "../ui.js";
import { controlesDeTexto } from "../zoom-texto.js";
import {
  blocoFeedback, botaoRascunho, cabecalhoQuestao, corpoQuestao, listaAlternativas,
} from "../vista-questao.js";
import { gerarId, plural } from "../util.js";

const TITULOS = { [MODOS.aleatorias]: "Questões aleatórias", [MODOS.erros]: "Revisar erros" };
const VOLTAR = { [MODOS.aleatorias]: "#/filtros", [MODOS.erros]: "#/" };

/** Estado de uma sessão de prática (vive enquanto a tela está aberta). */
function novaSessao(modo, filtros, tentativas) {
  return {
    id: gerarId("pra-"),
    modo,
    filtros,
    vezesVista: contarVezesVista(tentativas),
    fila: modo === MODOS.erros ? filaDeErros(tentativas) : [],
    vistas: new Set(),
    acertos: 0,
    respondidas: 0,
    atual: null,
  };
}

function proximaQuestao(sessao) {
  if (sessao.modo === MODOS.erros) {
    const qid = sessao.fila.find((id) => !sessao.vistas.has(id) && questaoPorId(id));
    return qid ? questaoPorId(qid) : null;
  }
  return sortearPratica(sessao.filtros, sessao.vistas, sessao.vezesVista);
}

function placarSessao(sessao) {
  if (sessao.respondidas === 0) return "";
  return html`<span class="placar-sessao" aria-label="${sessao.acertos} acertos em ${sessao.respondidas}">
    <strong>${sessao.acertos}</strong>/${sessao.respondidas}</span>`;
}

function progressoFila(sessao) {
  if (sessao.modo !== MODOS.erros) return "";
  const feitas = sessao.vistas.size;
  return html`<p class="progresso-fila">Questão ${feitas} de ${sessao.fila.length} da fila</p>`;
}

function telaQuestao(sessao) {
  const { questao: q, ordem, escolhida } = sessao.atual;
  const respondida = escolhida !== null;
  return html`
    ${barraTopo({
      titulo: TITULOS[sessao.modo], voltar: VOLTAR[sessao.modo],
      direita: placarSessao(sessao), ferramentas: controlesDeTexto(),
    })}
    <article class="pagina questao ${respondida ? "respondida" : ""}" data-qid="${q.id}">
      ${progressoFila(sessao)}
      ${cabecalhoQuestao(q)}
      ${corpoQuestao(q)}
      ${listaAlternativas(q, ordem, { escolhida, revelar: respondida })}
      ${respondida ? blocoFeedback(q, ordem, escolhida) : ""}
    </article>
    ${botaoRascunho()}
    <div class="barra-inferior barra-pratica">
      ${respondida
        ? html`<button type="button" class="botao botao-primario botao-largo" data-acao="proxima">Próxima ${icone("proxima")}</button>`
        : html`<button type="button" class="botao botao-secundario botao-largo" data-acao="proxima">Pular</button>`}
    </div>`;
}

function telaFim(sessao) {
  const titulo = sessao.modo === MODOS.erros ? "Fila de erros concluída" : "Não há questões com esses filtros";
  const texto = sessao.modo === MODOS.erros
    ? (sessao.respondidas
      ? `Você refez ${plural(sessao.respondidas, "questão", "questões")} e acertou ${sessao.acertos}. As que errou de novo voltam para a fila.`
      : "Nenhuma questão com erro pendente. Bom sinal.")
    : "Escolha outras matérias ou outro nível.";
  return html`
    ${barraTopo({ titulo: TITULOS[sessao.modo], voltar: VOLTAR[sessao.modo] })}
    <div class="pagina estado-vazio">
      <h2>${titulo}</h2>
      <p>${texto}</p>
      <a class="botao botao-primario" href="#/">Voltar ao início</a>
    </div>`;
}

export async function mostrar(raiz, { nome, consulta, sinal }) {
  const modo = nome === "erros" ? MODOS.erros : MODOS.aleatorias;
  const sessao = novaSessao(modo, filtrosDaConsulta(consulta), await listarTentativas());
  const escrita = new EscritaDaTela(raiz);
  prepararLeitura(raiz, sinal);
  const cronometro = new Cronometro((ms) => {
    if (sessao.atual && sessao.atual.escolhida === null) sessao.atual.tempoMs += ms;
  });
  cronometro.ligar(sinal);

  function exibir() {
    montar(raiz, sessao.atual ? telaQuestao(sessao) : telaFim(sessao));
    if (sessao.atual) escrita.mostrarQuestao(sessao.atual.questao, sessao.atual.ordem, TITULOS[sessao.modo]);
  }

  async function avancar() {
    const questao = proximaQuestao(sessao);
    if (!questao) await escrita.fecharFolha();
    sessao.atual = questao ? { questao, ordem: ordemEmbaralhada(), escolhida: null, tempoMs: 0 } : null;
    if (questao) sessao.vistas.add(questao.id);
    exibir();
    rolarQuestaoParaTopo(raiz);
  }

  async function responder(original) {
    const atual = sessao.atual;
    if (!atual || atual.escolhida !== null) return;
    cronometro.registrarTrecho();
    atual.escolhida = original;
    const acertou = original === atual.questao.correta;
    sessao.respondidas += 1;
    if (acertou) sessao.acertos += 1;
    sessao.vezesVista.set(atual.questao.id, (sessao.vezesVista.get(atual.questao.id) ?? 0) + 1);
    exibir();
    rolarAte(raiz.querySelector("#resultado-questao"));
    await salvarTentativa(sessao, atual, acertou);
  }

  aoAgir(raiz, sinal, {
    escolher: (botao) => responder(Number(botao.dataset.original)),
    proxima: () => avancar(),
    rascunho: () => escrita.abrirFolha(),
  });
  avancar();
}

async function salvarTentativa(sessao, atual, acertou) {
  const q = atual.questao;
  try {
    await registrarTentativa({
      id: gerarId("t-"),
      qid: q.id,
      materia: q.materia,
      tema: q.tema,
      nivel: q.nivel,
      escolhida: atual.escolhida,
      acertou,
      tempoMs: Math.round(atual.tempoMs),
      modo: sessao.modo,
      sessaoId: sessao.id,
      ordem: atual.ordem,
      quando: new Date().toISOString(),
    });
  } catch (erro) {
    console.error(erro);
    avisar("Não foi possível salvar esta resposta.");
  }
}
