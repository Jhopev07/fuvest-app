// Resultado de um simulado entregue: nota, desempenho, feedback por regras,
// lista das questões e relatório em texto para copiar.

import { SIMULADO, nomeMateria } from "../config.js";
import { letraDe } from "../letras.js";
import { obterSessao } from "../db.js";
import { analisarProva, relatorioTexto } from "../feedback-prova.js";
import { rotaPara } from "../navegacao.js";
import { html, montar, icone } from "../render.js";
import { aoAgir, avisar, barraProgresso, barraTopo, copiarTexto } from "../ui.js";
import { classeArea } from "../vista-questao.js";
import {
  formatarData, formatarDecimal, formatarDuracao, formatarPercentual, plural,
} from "../util.js";

function placarNota(analise, sessao) {
  const { nota } = analise;
  return html`
    <section class="nota ${analise.abaixoDoCorte ? "nota-abaixo" : ""}">
      <p class="nota-valor"><strong>${nota.acertos}</strong><span>/${nota.total}</span></p>
      <p class="nota-detalhe">${formatarPercentual(nota.taxa)} de acerto, ${formatarDuracao(sessao.tempoMs)} de prova</p>
      ${analise.abaixoDoCorte
        ? html`<p class="nota-corte">${icone("aviso")}Abaixo de ${SIMULADO.corteEliminatorio} acertos: na Fuvest, isso elimina da 2ª fase.</p>`
        : html`<p class="nota-corte nota-corte-ok">Acima do corte eliminatório de ${SIMULADO.corteEliminatorio} acertos.</p>`}
    </section>`;
}

function linhaPlacar(rotulo, p, classe) {
  return html`
    <li class="linha-materia ${classe}">
      <span class="lm-nome">${rotulo}</span>
      ${barraProgresso(p.taxa, formatarPercentual(p.taxa))}
      <span class="lm-valor">${p.acertos}/${p.total}</span>
    </li>`;
}

function tabelaDesempenho(analise) {
  return html`
    <section class="secao">
      <h2>Por área</h2>
      <ul class="lista-materias">${analise.areas.map((a) => linhaPlacar(a.nome, a, `area-${a.area}`))}</ul>
      <h2>Por matéria</h2>
      <ul class="lista-materias">${analise.materias.map((m) => linhaPlacar(m.nome, m, classeArea(m.materia)))}</ul>
    </section>`;
}

function listaNomes(placares) {
  return placares.map((p) => `${p.nome} (${formatarPercentual(p.taxa)})`).join(", ");
}

function blocoFeedbackProva(analise) {
  const { fortes, fracos, assuntos, errosFuvest, errosAcima } = analise;
  return html`
    <section class="secao analise">
      <h2>Análise da prova</h2>

      <h3>Pontos fortes</h3>
      <p>${fortes.length ? listaNomes(fortes) : "Nenhuma matéria chegou a 70% desta vez."}</p>

      <h3>Pontos fracos</h3>
      <p>${fracos.length ? listaNomes(fracos) : "Nenhuma matéria ficou em 50% ou menos."}</p>

      <h3>Erros por nível</h3>
      <p><strong>${plural(errosFuvest.length, "erro", "erros")} em questões nível Fuvest</strong> — prioridade máxima:
        é o tipo de questão que vai cair.${errosFuvest.length ? "" : " Ótimo."}</p>
      <p>${plural(errosAcima.length, "erro", "erros")} em questões acima da Fuvest — revise depois das de nível Fuvest.</p>

      <h3>Gestão do tempo</h3>
      ${analise.frasesTempo.map((f) => html`<p>${f}</p>`)}
      ${analise.tempo.lentas.length ? html`<p>Mais demoradas: ${analise.tempo.lentas
        .map((i) => `nº ${i.numero} (${formatarDecimal(i.tempoMs / 60000)} min)`).join(", ")}.</p>` : ""}

      ${assuntos.length ? html`
        <h3>Temas errados</h3>
        <ul class="temas-errados">
          ${assuntos.map((a) => html`<li class="${classeArea(a.materia)}">
            <span class="te-nome">${nomeMateria(a.materia)} — ${a.assunto}</span>
            <span class="te-qtd">${a.erros}</span>
          </li>`)}
        </ul>` : ""}

      ${analise.recomendacoes.length ? html`
        <h3>O que estudar a seguir</h3>
        <ol class="recomendacoes">${analise.recomendacoes.map((r) => html`<li>${r}</li>`)}</ol>` : ""}
    </section>`;
}

function marcaResposta(item) {
  return item.escolhida === null ? "–" : letraDe(item.ordem, item.escolhida);
}

function listaQuestoes(sessao) {
  return html`
    <section class="secao">
      <h2>Questões</h2>
      <ol class="lista-resultado">
        ${sessao.itens.map((item, n) => html`
          <li>
            <a class="lr-linha ${item.acertou ? "certa" : item.escolhida === null ? "branco" : "errada"}"
              href="${rotaPara("revisao", item.qid, { sessao: sessao.id, n })}">
              <span class="lr-numero">${n + 1}</span>
              <span class="lr-materia ${classeArea(item.materia)}">${nomeMateria(item.materia)}</span>
              <span class="lr-resposta">${marcaResposta(item)}${item.acertou ? "" : html`<small> → ${letraDe(item.ordem, item.correta)}</small>`}</span>
              <span class="lr-icone">${icone(item.acertou ? "check" : "fechar")}</span>
            </a>
          </li>`)}
      </ol>
    </section>`;
}

export async function mostrar(raiz, { parametro, sinal }) {
  const sessao = await obterSessao(parametro);
  if (!sessao) {
    montar(raiz, html`${barraTopo({ titulo: "Resultado", voltar: "#/historico" })}
      <div class="pagina estado-vazio"><h2>Simulado não encontrado</h2><p>Ele pode ter sido apagado.</p></div>`);
    return;
  }
  const analise = analisarProva(sessao);
  montar(raiz, html`
    ${barraTopo({ titulo: `Simulado de ${formatarData(sessao.entregueEm)}`, voltar: "#/historico" })}
    <div class="pagina tela-resultado">
      ${placarNota(analise, sessao)}
      <button type="button" class="botao botao-secundario botao-largo" data-acao="copiar">
        ${icone("copiar")}Copiar relatório</button>
      <p class="dica-relatorio">Texto com nota, matérias, temas errados e ids das questões, para colar numa conversa com o Claude.</p>
      ${blocoFeedbackProva(analise)}
      ${tabelaDesempenho(analise)}
      ${listaQuestoes(sessao)}
    </div>`);
  aoAgir(raiz, sinal, {
    copiar: async () => {
      if (await copiarTexto(relatorioTexto(sessao, analise))) avisar("Relatório copiado.");
    },
  });
}
