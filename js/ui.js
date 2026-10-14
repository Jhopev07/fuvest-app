// Componentes de interface reutilizáveis: barra superior, diálogos e avisos.

import { html, montar, icone } from "./render.js";

const DURACAO_AVISO_MS = 3200;

export function barraTopo({ titulo, voltar = "#/", direita = "" }) {
  return html`
    <header class="barra-topo">
      <a class="botao-icone" href="${voltar}" data-voltar aria-label="Voltar">${icone("voltar")}</a>
      <h1 class="barra-titulo" tabindex="-1">${titulo}</h1>
      <div class="barra-direita">${direita}</div>
    </header>`;
}

/** Cria um elemento a partir de HTML seguro. */
export function criarElemento(conteudo) {
  const modelo = document.createElement("template");
  montar(modelo, conteudo);
  return modelo.content.firstElementChild;
}

/**
 * Diálogo modal com botões. Resolve com o valor do botão tocado
 * (ou null se fechado com o "voltar"/Esc).
 */
export function dialogo({ titulo, mensagem = "", botoes, conteudo = "" }) {
  return new Promise((resolve) => {
    const caixa = criarElemento(html`
      <dialog class="dialogo">
        <form method="dialog">
          <h2>${titulo}</h2>
          ${mensagem ? html`<p>${mensagem}</p>` : ""}
          ${conteudo}
          <div class="dialogo-botoes">
            ${botoes.map((b) => html`<button class="botao ${b.classe ?? "botao-secundario"}" value="${b.valor}">${b.rotulo}</button>`)}
          </div>
        </form>
      </dialog>`);
    caixa.addEventListener("close", () => {
      resolve(caixa.returnValue && caixa.returnValue !== "" ? caixa.returnValue : null);
      caixa.remove();
    });
    document.body.append(caixa);
    caixa.showModal();
  });
}

export async function confirmar({ titulo, mensagem, sim, nao = "Cancelar", perigo = false }) {
  const valor = await dialogo({
    titulo,
    mensagem,
    botoes: [
      { valor: "nao", rotulo: nao },
      { valor: "sim", rotulo: sim, classe: perigo ? "botao-perigo" : "botao-primario" },
    ],
  });
  return valor === "sim";
}

let temporizadorAviso = null;

/** Mensagem curta no rodapé, anunciada a leitores de tela. */
export function avisar(texto) {
  const area = document.getElementById("aviso");
  if (!area) return;
  area.textContent = texto;
  area.classList.add("visivel");
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => area.classList.remove("visivel"), DURACAO_AVISO_MS);
}

/** Faixa persistente no topo (ex.: nova versão). Devolve o elemento para quem chamou. */
export function mostrarFaixa({ id, texto, aoTocar }) {
  document.getElementById(id)?.remove();
  const faixa = criarElemento(html`<button type="button" class="faixa" id="${id}">${texto}</button>`);
  faixa.addEventListener("click", aoTocar);
  document.body.prepend(faixa);
  return faixa;
}

export function barraProgresso(fracao, rotulo = "") {
  const largura = Math.round(Math.max(0, Math.min(1, fracao)) * 100);
  return html`<span class="barra" role="img" aria-label="${rotulo || `${largura}%`}">
    <span class="barra-cheia" style="width:${largura}%"></span></span>`;
}

/** Rola até o elemento, sem animação se o usuário pediu menos movimento. */
export function rolarAte(elemento, bloco = "nearest") {
  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  elemento?.scrollIntoView({ block: bloco, behavior: reduzir ? "auto" : "smooth" });
}

/** Delegação de cliques por `data-acao`, removida automaticamente quando a tela sai. */
export function aoAgir(raiz, sinal, acoes) {
  raiz.addEventListener("click", (evento) => {
    const alvo = evento.target.closest("[data-acao]");
    if (!alvo || !raiz.contains(alvo)) return;
    const acao = acoes[alvo.dataset.acao];
    if (acao) acao(alvo, evento);
  }, { signal: sinal });
}

export function baixarArquivo(nome, conteudo, tipo = "application/json") {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copiarComSelecao(texto) {
  const area = document.createElement("textarea");
  area.value = texto;
  area.setAttribute("readonly", "");
  area.className = "fora-da-tela";
  document.body.append(area);
  area.select();
  const ok = document.execCommand?.("copy") ?? false;
  area.remove();
  return ok;
}

/** Copia texto; se o navegador negar, abre um diálogo com o texto selecionável. */
export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    if (await copiarComSelecao(texto)) return true;
  }
  await dialogo({
    titulo: "Copie o relatório",
    mensagem: "Toque e segure no texto para copiar.",
    conteudo: html`<textarea class="texto-relatorio" readonly rows="10">${texto}</textarea>`,
    botoes: [{ valor: "ok", rotulo: "Fechar", classe: "botao-primario" }],
  });
  return false;
}
