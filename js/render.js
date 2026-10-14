// Renderização segura. Todo texto vindo das questões ou do armazenamento passa por
// `escapar` antes de virar HTML. O template `html` escapa as interpolações sozinho;
// só objetos `HtmlSeguro` (gerados aqui) entram sem escape.

class HtmlSeguro {
  constructor(conteudo) {
    this.conteudo = conteudo;
  }

  toString() {
    return this.conteudo;
  }
}

const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

function serializar(valor) {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof HtmlSeguro) return valor.conteudo;
  if (Array.isArray(valor)) return valor.map(serializar).join("");
  return escapar(valor);
}

export function html(partes, ...valores) {
  let resultado = partes[0];
  valores.forEach((valor, i) => {
    resultado += serializar(valor) + partes[i + 1];
  });
  return new HtmlSeguro(resultado);
}

/** Marca como seguro um HTML que já foi escapado/sanitizado aqui dentro. */
function confiavel(conteudo) {
  return new HtmlSeguro(conteudo);
}

export function montar(elemento, conteudo) {
  elemento.innerHTML = serializar(conteudo);
}

const NEGRITO = /\*\*(.+?)\*\*/g;

/** Uma linha: escapa e aplica **negrito**. */
export function textoInline(texto) {
  return confiavel(escapar(texto).replace(NEGRITO, "<strong>$1</strong>"));
}

/** Vários parágrafos separados por linha em branco; quebra simples vira <br>. */
export function textoRico(texto) {
  if (!texto) return confiavel("");
  const paragrafos = String(texto)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapar(p).replace(NEGRITO, "<strong>$1</strong>").replace(/\n/g, "<br>")}</p>`);
  return confiavel(paragrafos.join(""));
}

export function tabela(dados) {
  if (!dados || !Array.isArray(dados.cabecalho)) return confiavel("");
  const linhas = Array.isArray(dados.linhas) ? dados.linhas : [];
  return html`
    <figure class="tabela">
      ${dados.titulo ? html`<figcaption>${textoInline(dados.titulo)}</figcaption>` : ""}
      <div class="tabela-rolagem" tabindex="0">
        <table>
          <thead><tr>${dados.cabecalho.map((c) => html`<th scope="col">${textoInline(c)}</th>`)}</tr></thead>
          <tbody>${linhas.map((linha) => html`<tr>${linha.map((c) => html`<td>${textoInline(c)}</td>`)}</tr>`)}</tbody>
        </table>
      </div>
    </figure>`;
}

// SVG vem do banco de questões: passa por lista branca de elementos e atributos.
const SVG_ELEMENTOS = new Set([
  "svg", "g", "path", "line", "polyline", "polygon", "rect", "circle", "ellipse",
  "text", "tspan", "defs", "marker", "title", "desc",
]);
const SVG_ATRIBUTO_PROIBIDO = /^(on|href|xlink:href|style)/i;

function limparSvg(no) {
  for (const filho of [...no.children]) {
    if (!SVG_ELEMENTOS.has(filho.localName)) {
      filho.remove();
      continue;
    }
    for (const atributo of [...filho.attributes]) {
      if (SVG_ATRIBUTO_PROIBIDO.test(atributo.name)) filho.removeAttribute(atributo.name);
    }
    limparSvg(filho);
  }
}

export function figuraSvg(fonte) {
  if (!fonte) return confiavel("");
  const documento = new DOMParser().parseFromString(fonte, "image/svg+xml");
  const raiz = documento.documentElement;
  if (raiz.localName !== "svg" || documento.querySelector("parsererror")) return confiavel("");
  for (const atributo of [...raiz.attributes]) {
    if (SVG_ATRIBUTO_PROIBIDO.test(atributo.name)) raiz.removeAttribute(atributo.name);
  }
  raiz.removeAttribute("width");
  raiz.removeAttribute("height");
  limparSvg(raiz);
  return html`<figure class="figura">${confiavel(new XMLSerializer().serializeToString(raiz))}</figure>`;
}

/** Ícones de traço simples, desenhados à mão (sem dependência externa). */
const ICONES = {
  voltar: '<path d="M15 5l-7 7 7 7"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  lapis: '<path d="M4 20l1-5L16 4l4 4L9 19l-5 1z"/><path d="M14 6l4 4"/>',
  grade: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  bandeira: '<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>',
  anterior: '<path d="M14 6l-6 6 6 6"/>',
  proxima: '<path d="M10 6l6 6-6 6"/>',
  desfazer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-4"/>',
  lixeira: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  borracha: '<path d="M14 4l6 6-9 9H6l-3-3z"/><path d="M9 9l6 6"/><path d="M11 20h9"/>',
  mover: '<path d="M12 3v18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3"/>',
  papel: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>',
  transparente: '<rect x="4" y="3" width="16" height="18" rx="2" stroke-dasharray="3 3"/>',
  inter: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  relogio: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  aviso: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
};

export function icone(nome, classe = "") {
  const caminhos = ICONES[nome] ?? "";
  return confiavel(
    `<svg class="icone ${escapar(classe)}" viewBox="0 0 24 24" aria-hidden="true" fill="none" ` +
    `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${caminhos}</svg>`,
  );
}
