// Histórico: simulados feitos, desempenho por matéria/assunto e todas as tentativas.

import { MATERIAS, nomeMateria } from "../config.js";
import { listarSessoes, listarTentativas } from "../db.js";
import { desempenhoPorAssunto, desempenhoPorMateria, doPiorParaOMelhor } from "../estatisticas.js";
import { rotaPara, substituirPor } from "../navegacao.js";
import { html, montar, icone } from "../render.js";
import { barraProgresso, barraTopo } from "../ui.js";
import { classeArea } from "../vista-questao.js";
import { formatarData, formatarDataHora, formatarDuracao, formatarPercentual } from "../util.js";

const ABAS = { simulados: "Simulados", desempenho: "Desempenho", tentativas: "Tentativas" };
const LIMITE_TENTATIVAS = 200;
const NOMES_MODO = { aleatorias: "prática", erros: "revisão", simulado: "simulado" };
const NIVEL_CURTO = { fuvest: "nível Fuvest", acima: "acima da Fuvest" };

function abas(ativa) {
  return html`
    <div class="abas" role="tablist">
      ${Object.entries(ABAS).map(([chave, nome]) => html`
        <a role="tab" class="aba ${chave === ativa ? "ativa" : ""}" aria-selected="${chave === ativa}"
          href="${rotaPara("historico", "", { aba: chave })}" data-aba="${chave}">${nome}</a>`)}
    </div>`;
}

function listaSimulados(sessoes) {
  if (!sessoes.length) {
    return html`<div class="estado-vazio"><p>Nenhum simulado entregue ainda.</p>
      <a class="botao botao-primario" href="#/simulado">Fazer um simulado</a></div>`;
  }
  return html`
    <ul class="lista-simulados">
      ${sessoes.map((s) => html`
        <li><a class="cartao-simulado" href="${rotaPara("resultado", s.id)}">
          <span class="cs-data">${formatarData(s.entregueEm)}</span>
          <span class="cs-nota"><strong>${s.acertos}</strong>/${s.total}</span>
          <span class="cs-detalhe">${formatarPercentual(s.total ? s.acertos / s.total : 0)} de acerto em ${formatarDuracao(s.tempoMs)}</span>
        </a></li>`)}
    </ul>`;
}

function linhaPlacar(rotulo, p, classe, detalhe = "") {
  return html`
    <li class="linha-materia ${classe}">
      <span class="lm-nome">${rotulo}${detalhe ? html`<small>${detalhe}</small>` : ""}</span>
      ${barraProgresso(p.taxa, formatarPercentual(p.taxa))}
      <span class="lm-valor">${p.acertos}/${p.total}</span>
    </li>`;
}

function desempenho(tentativas) {
  if (!tentativas.length) return html`<p class="vazio">Sem tentativas ainda.</p>`;
  const materias = doPiorParaOMelhor(desempenhoPorMateria(tentativas).filter((m) => m.total));
  const assuntos = doPiorParaOMelhor(desempenhoPorAssunto(tentativas));
  return html`
    <section class="secao">
      <h2>Por matéria <small>do pior para o melhor</small></h2>
      <ul class="lista-materias">${materias.map((m) => linhaPlacar(m.nome, m, classeArea(m.materia)))}</ul>
    </section>
    <section class="secao">
      <h2>Por tema</h2>
      <ul class="lista-materias">${assuntos.map((a) =>
        linhaPlacar(a.assunto, a, classeArea(a.materia), nomeMateria(a.materia)))}</ul>
    </section>`;
}

function filtroTentativas(consulta) {
  return html`
    <form class="filtro-tentativas" id="filtro-tentativas">
      <label class="campo">
        <span>Matéria</span>
        <select name="materia">
          <option value="">Todas</option>
          ${Object.entries(MATERIAS).map(([chave, m]) => html`
            <option value="${chave}" ${consulta.materia === chave ? "selected" : ""}>${m.nome}</option>`)}
        </select>
      </label>
      <label class="interruptor interruptor-compacto">
        <span>Só erradas</span>
        <input type="checkbox" name="erradas" role="switch" ${consulta.erradas === "1" ? "checked" : ""}>
      </label>
    </form>`;
}

function listaTentativas(tentativas, consulta) {
  const filtradas = tentativas
    .filter((t) => !consulta.materia || t.materia === consulta.materia)
    .filter((t) => consulta.erradas !== "1" || !t.acertou)
    .reverse();
  const visiveis = filtradas.slice(0, LIMITE_TENTATIVAS);
  return html`
    ${filtroTentativas(consulta)}
    <p class="contagem-filtro">${filtradas.length} tentativa${filtradas.length === 1 ? "" : "s"}${
      filtradas.length > LIMITE_TENTATIVAS ? ` (mostrando as ${LIMITE_TENTATIVAS} mais recentes)` : ""}</p>
    <ul class="lista-tentativas">
      ${visiveis.map((t) => html`
        <li><a class="lt-linha ${t.acertou ? "certa" : "errada"}" href="${rotaPara("revisao", t.qid, { tentativa: t.id })}">
          <span class="lt-icone">${icone(t.acertou ? "check" : "fechar")}</span>
          <span class="lt-corpo">
            <span class="lt-tema">${t.tema}</span>
            <span class="lt-meta"><span class="lt-materia ${classeArea(t.materia)}">${nomeMateria(t.materia)}</span>,
              ${NIVEL_CURTO[t.nivel] ?? ""}, ${NOMES_MODO[t.modo] ?? t.modo}, ${formatarDataHora(t.quando)}</span>
          </span>
        </a></li>`)}
    </ul>`;
}

export async function mostrar(raiz, { consulta, sinal }) {
  const aba = ABAS[consulta.aba] ? consulta.aba : "simulados";
  const [sessoes, tentativas] = await Promise.all([listarSessoes(), listarTentativas()]);
  const conteudo = {
    simulados: () => listaSimulados(sessoes),
    desempenho: () => desempenho(tentativas),
    tentativas: () => listaTentativas(tentativas, consulta),
  }[aba]();
  montar(raiz, html`
    ${barraTopo({ titulo: "Histórico" })}
    <div class="pagina historico">
      ${abas(aba)}
      <div class="painel-aba" role="tabpanel">${conteudo}</div>
    </div>`);

  raiz.querySelector(".abas").addEventListener("click", (e) => {
    const link = e.target.closest("[data-aba]");
    if (!link) return;
    e.preventDefault();
    substituirPor(link.getAttribute("href"));
  }, { signal: sinal });

  raiz.querySelector("#filtro-tentativas")?.addEventListener("change", (e) => {
    const dados = new FormData(e.currentTarget);
    const nova = { aba: "tentativas" };
    if (dados.get("materia")) nova.materia = dados.get("materia");
    if (dados.get("erradas")) nova.erradas = "1";
    substituirPor(rotaPara("historico", "", nova));
  }, { signal: sinal });
}
