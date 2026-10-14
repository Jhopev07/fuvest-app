// Escolha de filtros antes das questões aleatórias.

import { AREAS, MATERIAS, ORDEM_AREAS } from "../config.js";
import { contarPorMateria, questoesFiltradas } from "../banco.js";
import { gravarAjuste, lerAjuste } from "../db.js";
import { consultaDosFiltros, normalizarFiltros } from "../filtros-pratica.js";
import { irPara, rotaPara } from "../navegacao.js";
import { html, montar } from "../render.js";
import { barraTopo } from "../ui.js";
import { classeArea } from "../vista-questao.js";
import { plural } from "../util.js";

const CHAVE_FILTROS = "filtrosPratica";

function chipMateria(materia, nome, quantidade, marcada) {
  return html`
    <label class="chip-filtro ${classeArea(materia)}">
      <input type="checkbox" name="materia" value="${materia}" ${marcada ? "checked" : ""} ${quantidade ? "" : "disabled"}>
      <span>${nome} <small>${quantidade}</small></span>
    </label>`;
}

function grupoArea(area, filtros, contagem) {
  const materias = Object.entries(MATERIAS).filter(([, m]) => m.area === area);
  return html`
    <div class="grupo-area">
      <p class="grupo-area-nome">${AREAS[area].nome}</p>
      <div class="chips">
        ${materias.map(([chave, m]) => chipMateria(chave, m.nome, contagem[chave], filtros.materias.includes(chave)))}
      </div>
    </div>`;
}

function formulario(filtros) {
  const contagem = contarPorMateria();
  const todas = filtros.materias.length === 0;
  return html`
    <form class="pagina filtros" id="form-filtros">
      <fieldset>
        <legend>Matérias</legend>
        <label class="chip-filtro chip-todas">
          <input type="checkbox" name="todas" ${todas ? "checked" : ""}>
          <span>Todas as matérias</span>
        </label>
        ${ORDEM_AREAS.map((area) => grupoArea(area, filtros, contagem))}
      </fieldset>

      <fieldset>
        <legend>Nível</legend>
        <div class="segmentado">
          <label><input type="radio" name="nivel" value="todos" ${filtros.soAcima ? "" : "checked"}><span>Todos</span></label>
          <label><input type="radio" name="nivel" value="acima" ${filtros.soAcima ? "checked" : ""}><span>Só acima da Fuvest</span></label>
        </div>
      </fieldset>

      <label class="interruptor">
        <span>
          <strong>Priorizar não respondidas</strong>
          <small>Questões que você nunca fez aparecem primeiro.</small>
        </span>
        <input type="checkbox" name="priorizar" role="switch" ${filtros.priorizarNaoRespondidas ? "checked" : ""}>
      </label>

      <div class="barra-inferior">
        <p class="contagem-filtro" id="contagem-filtro" aria-live="polite"></p>
        <button type="submit" class="botao botao-primario" id="botao-comecar">Começar</button>
      </div>
    </form>`;
}

function lerFormulario(form) {
  const dados = new FormData(form);
  return {
    materias: dados.getAll("materia"),
    soAcima: dados.get("nivel") === "acima",
    priorizarNaoRespondidas: dados.get("priorizar") === "on",
  };
}

function sincronizarTodas(form, alvo) {
  const todas = form.elements.todas;
  const caixas = [...form.querySelectorAll('input[name="materia"]')];
  if (alvo === todas && todas.checked) caixas.forEach((c) => { c.checked = false; });
  if (alvo.name === "materia") todas.checked = caixas.every((c) => !c.checked);
  if (alvo === todas && !todas.checked && caixas.every((c) => !c.checked)) todas.checked = true;
}

function atualizarContagem(form) {
  const total = questoesFiltradas(lerFormulario(form)).length;
  form.querySelector("#contagem-filtro").textContent = plural(total, "questão", "questões");
  form.querySelector("#botao-comecar").disabled = total === 0;
}

export async function mostrar(raiz, { sinal }) {
  const filtros = normalizarFiltros(await lerAjuste(CHAVE_FILTROS, null));
  montar(raiz, html`${barraTopo({ titulo: "Questões aleatórias" })}${formulario(filtros)}`);
  const form = raiz.querySelector("#form-filtros");
  atualizarContagem(form);
  form.addEventListener("change", (e) => {
    sincronizarTodas(form, e.target);
    atualizarContagem(form);
  }, { signal: sinal });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const escolhidos = lerFormulario(form);
    await gravarAjuste(CHAVE_FILTROS, escolhidos).catch((erro) => console.warn(erro));
    irPara(rotaPara("pratica", "", consultaDosFiltros(escolhidos)));
  }, { signal: sinal });
}
