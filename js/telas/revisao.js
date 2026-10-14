// Revisão de uma questão já respondida, com a resposta dada, a certa e a explicação.
// Origem: item de um simulado entregue (?sessao=&n=) ou uma tentativa (?tentativa=).

import { questaoPorId } from "../banco.js";
import { obterSessao, obterTentativa } from "../db.js";
import { prepararLeitura } from "../leitura.js";
import { EscritaDaTela } from "../rascunho.js";
import { rotaPara, substituirPor } from "../navegacao.js";
import { html, montar, icone } from "../render.js";
import { aoAgir, barraTopo } from "../ui.js";
import { controlesDeTexto } from "../zoom-texto.js";
import {
  blocoFeedback, botaoRascunho, cabecalhoQuestao, corpoQuestao, listaAlternativas,
} from "../vista-questao.js";
import { formatarDataHora } from "../util.js";

const ORDEM_ORIGINAL = [0, 1, 2, 3, 4];
// Desenhos da revisão ficam em memória enquanto o app está aberto (entre questões e idas e vindas).
const desenhosDaRevisao = { folhas: {}, sobre: {} };
// Ao passar para a questão seguinte do simulado com a folha aberta, ela reabre na nova tela.
let reabrirFolha = false;

function ordemValida(ordem) {
  return Array.isArray(ordem) && ordem.length === ORDEM_ORIGINAL.length ? ordem : ORDEM_ORIGINAL;
}

async function carregarContexto(qid, consulta) {
  if (consulta.sessao) {
    const sessao = await obterSessao(consulta.sessao);
    const indice = Number(consulta.n);
    const item = sessao?.itens?.[indice];
    if (item) {
      return {
        qid: item.qid, ordem: item.ordem, escolhida: item.escolhida,
        numero: indice + 1, sessao, indice, voltar: rotaPara("resultado", sessao.id),
      };
    }
  }
  if (consulta.tentativa) {
    const t = await obterTentativa(consulta.tentativa);
    if (t) {
      return {
        qid: t.qid, ordem: t.ordem, escolhida: t.escolhida, quando: t.quando,
        voltar: rotaPara("historico", "", { aba: "tentativas" }),
      };
    }
  }
  return { qid, ordem: null, escolhida: null, consulta: true, voltar: "#/historico" };
}

function navegacaoSessao(ctx) {
  if (!ctx.sessao) return "";
  const total = ctx.sessao.itens.length;
  return html`
    <nav class="barra-inferior barra-simulado" aria-label="Navegar no simulado">
      <button type="button" class="botao botao-secundario" data-acao="ir" data-n="${ctx.indice - 1}"
        ${ctx.indice === 0 ? "disabled" : ""} aria-label="Questão anterior">${icone("anterior")}</button>
      <a class="botao botao-secundario botao-grade" href="${ctx.voltar}" data-voltar>Resultado</a>
      <button type="button" class="botao botao-secundario" data-acao="ir" data-n="${ctx.indice + 1}"
        ${ctx.indice >= total - 1 ? "disabled" : ""} aria-label="Próxima questão">${icone("proxima")}</button>
    </nav>`;
}

function tela(q, ctx) {
  const ordem = ordemValida(ctx.ordem);
  const titulo = ctx.numero ? `Questão ${ctx.numero}` : "Revisão";
  return html`
    ${barraTopo({ titulo, voltar: ctx.voltar, ferramentas: controlesDeTexto() })}
    <article class="pagina questao respondida" data-qid="${q.id}">
      ${ctx.quando ? html`<p class="progresso-fila">Respondida em ${formatarDataHora(ctx.quando)}</p>` : ""}
      ${cabecalhoQuestao(q, ctx.numero ?? null)}
      ${corpoQuestao(q)}
      ${listaAlternativas(q, ordem, { escolhida: ctx.escolhida, revelar: true })}
      ${blocoFeedback(q, ordem, ctx.escolhida, { respondida: !ctx.consulta })}
    </article>
    ${botaoRascunho()}
    ${navegacaoSessao(ctx)}`;
}

export async function mostrar(raiz, { parametro, consulta, sinal }) {
  const ctx = await carregarContexto(parametro, consulta);
  const q = questaoPorId(ctx.qid);
  if (!q) {
    montar(raiz, html`
      ${barraTopo({ titulo: "Revisão", voltar: ctx.voltar })}
      <div class="pagina estado-vazio"><h2>Questão não encontrada</h2>
      <p>A questão ${ctx.qid} não está mais no banco desta versão do app.</p></div>`);
    return;
  }
  montar(raiz, tela(q, ctx));
  const escrita = new EscritaDaTela(raiz, {
    ...desenhosDaRevisao,
    aoGuardar: (desenhos) => Object.assign(desenhosDaRevisao, desenhos),
  });
  escrita.mostrarQuestao(q, ordemValida(ctx.ordem), ctx.numero ? `Questão ${ctx.numero}` : "Revisão");
  prepararLeitura(raiz, sinal);
  if (reabrirFolha) escrita.abrirFolha();
  reabrirFolha = false;
  aoAgir(raiz, sinal, {
    rascunho: () => escrita.abrirFolha(),
    ir: (botao) => {
      const n = Number(botao.dataset.n);
      const item = ctx.sessao.itens[n];
      reabrirFolha = escrita.folhaAberta;
      substituirPor(rotaPara("revisao", item.qid, { sessao: ctx.sessao.id, n }));
    },
  });
}
