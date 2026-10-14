"""Testes da folha de escrita e do zoom (multitoque real via CDP), em celular 412×915.

Uso (na raiz do repositório):
    python3 tools/build.py
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 tools/testes/testar_folha_zoom.py

Cobre: abrir a folha, desenhar, pinça e pan na folha, desfazer/refazer, borracha,
limpar, 100%, divisória (arrastar e lembrar), tela cheia com faixa de consulta,
responder sem sair do modo dividido, folha preservada por questão, simulado com
folha + recarregar, escrever sobre a questão, A−/A+ e pinça no texto (sem rolagem
horizontal), visualizador de tabela (pinça, pan, duplo toque, voltar).
"""
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

from apoio import TELAS, Console, celular, foto, servidor  # noqa: E402
from toque import Toque  # noqa: E402

ESPERA_TRANSICAO_MS = 400
QUESTAO_COM_TABELA = "GEO-001"

resultados = []

LER_ANDAMENTO = """async () => new Promise((resolve, reject) => {
  const pedido = indexedDB.open("fuvest-app");
  pedido.onerror = () => reject(pedido.error);
  pedido.onsuccess = () => {
    const banco = pedido.result;
    const leitura = banco.transaction("andamento").objectStore("andamento").getAll();
    leitura.onsuccess = () => { resolve(leitura.result[0] ?? null); banco.close(); };
  };
})"""

# Pixels de tinta (opacos) no canvas da folha; a grade é quase transparente e não conta.
# Espera um quadro: gestos agrupam o redesenho com requestAnimationFrame.
PIXELS_DE_TINTA = """async () => {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const c = document.querySelector(".fe-canvas");
  if (!c) return -1;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) n++;
  return n;
}"""

ESTADO_FOLHA = """() => {
  const area = document.querySelector(".fe-area").getBoundingClientRect();
  const tela = document.querySelector(".tela").getBoundingClientRect();
  return {
    zoom: document.querySelector(".fe-zoom").textContent,
    area: [area.top, area.height],
    tela: [tela.top, tela.height],
    larguraPagina: document.documentElement.scrollWidth,
    podeDesfazer: !document.querySelector('[data-rs="desfazer"]').disabled,
    podeRefazer: !document.querySelector('[data-rs="refazer"]').disabled,
  };
}"""


def verificar(condicao, descricao):
    resultados.append((bool(condicao), descricao))
    print(("  ok   " if condicao else "  FALHA ") + descricao)
    return condicao


def secao(titulo):
    print(f"\n== {titulo}")


def fotos_claro_escuro(pagina, nome):
    for esquema, sufixo in (("light", "claro"), ("dark", "escuro")):
        pagina.emulate_media(color_scheme=esquema)
        pagina.wait_for_timeout(ESPERA_TRANSICAO_MS)
        foto(pagina, f"{nome}-{sufixo}")
    pagina.emulate_media(color_scheme="light")


def ir(pagina, hash_, seletor):
    pagina.evaluate("(h) => { location.hash = h; }", hash_)
    pagina.wait_for_selector(seletor)


def area_da_folha(pagina):
    r = pagina.evaluate("(() => { const r = document.querySelector('.fe-area').getBoundingClientRect(); "
                        "return [r.left, r.top, r.width, r.height]; })()")
    return {"x": r[0], "y": r[1], "largura": r[2], "altura": r[3]}


def ponto_na_folha(area, fx, fy):
    return (area["x"] + area["largura"] * fx, area["y"] + area["altura"] * fy)


def abrir_folha(pagina):
    pagina.click('[data-acao="rascunho"]')
    pagina.wait_for_selector(".folha-escrita .fe-canvas")
    pagina.wait_for_timeout(100)


def rabisco(area, fy=0.4):
    return [ponto_na_folha(area, 0.15 + i * 0.035, fy + (i % 4) * 0.02) for i in range(20)]


def zoom_atual(pagina):
    return int(pagina.inner_text(".fe-zoom").rstrip("%"))


# ---------------------------------------------------------------- testes

def testar_folha_basica(pagina, toque):
    secao("Folha de escrita: abrir, desenhar, pinça, pan, desfazer/refazer")
    ir(pagina, "#/filtros", "#form-filtros")
    pagina.click("#botao-comecar")
    pagina.wait_for_selector('[data-acao="escolher"]')
    qid_1 = pagina.get_attribute("article.questao", "data-qid")
    abrir_folha(pagina)
    estado = pagina.evaluate(ESTADO_FOLHA)
    verificar("modo-folha" in pagina.evaluate("document.documentElement.className"), "modo dividido ativo")
    proporcao = estado["tela"][1] / (estado["tela"][1] + estado["area"][1] + 100)
    verificar(0.3 < proporcao < 0.5, f"proporção padrão ~40% questão ({proporcao:.2f})")
    verificar(estado["zoom"] == "100%", "zoom da folha começa em 100%")
    verificar(pagina.evaluate(PIXELS_DE_TINTA) == 0, "folha começa limpa (só a grade)")
    dica_visivel = lambda: pagina.evaluate("getComputedStyle(document.querySelector('.fe-dica')).opacity") == "1"  # noqa: E731
    verificar(dica_visivel(), "folha vazia mostra a dica de uso")
    canvas = pagina.evaluate("(() => { const c = document.querySelector('.fe-canvas'); "
                             "return [c.width / c.clientWidth, getComputedStyle(c).touchAction]; })()")
    verificar(abs(canvas[0] - 2.625) < 0.01 and canvas[1] == "none", f"canvas da folha com devicePixelRatio e touch-action none {canvas}")
    fotos_claro_escuro(pagina, "21-folha-vazia")

    area = area_da_folha(pagina)
    toque.arrastar(rabisco(area, 0.3))
    tinta_1 = pagina.evaluate(PIXELS_DE_TINTA)
    verificar(tinta_1 > 300, f"um dedo desenha na folha ({tinta_1} px)")
    pagina.wait_for_timeout(ESPERA_TRANSICAO_MS)
    verificar(not dica_visivel(), "a dica some depois do primeiro traço")
    toque.arrastar(rabisco(area, 0.6))
    tinta_2 = pagina.evaluate(PIXELS_DE_TINTA)
    verificar(tinta_2 > tinta_1 * 1.5, "segundo traço")
    fotos_claro_escuro(pagina, "22-folha-com-traco")

    pagina.click('[data-rs="desfazer"]')
    verificar(abs(pagina.evaluate(PIXELS_DE_TINTA) - tinta_1) < tinta_1 * 0.1, "desfazer remove o último traço")
    verificar(pagina.evaluate(ESTADO_FOLHA)["podeRefazer"], "refazer fica disponível")
    pagina.click('[data-rs="refazer"]')
    verificar(abs(pagina.evaluate(PIXELS_DE_TINTA) - tinta_2) < tinta_2 * 0.05, "refazer devolve o traço")
    verificar(not pagina.evaluate(ESTADO_FOLHA)["podeRefazer"], "nada mais a refazer")

    # Pinça para ampliar: os traços crescem e continuam nítidos (redesenhados na escala).
    centro = ponto_na_folha(area, 0.5, 0.45)
    toque.pinca(centro, 80, 200)
    zoom = zoom_atual(pagina)
    verificar(220 <= zoom <= 280, f"pinça amplia a folha (~250%: {zoom}%)")
    largura_traco = pagina.evaluate("""() => {
      const c = document.querySelector(".fe-canvas"), ctx = c.getContext("2d");
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let max = 0;
      for (let x = 0; x < c.width; x += 4) {
        let corrida = 0;
        for (let y = 0; y < c.height; y++) {
          if (d[(y * c.width + x) * 4 + 3] > 200) { corrida++; max = Math.max(max, corrida); } else corrida = 0;
        }
      }
      return max;
    }""")
    verificar(largura_traco >= 12, f"traço ampliado com espessura proporcional ({largura_traco} px físicos)")
    fotos_claro_escuro(pagina, "23-folha-ampliada")

    # Escrever ampliado e conferir que o traço cai no lugar certo da folha.
    toque.arrastar([ponto_na_folha(area, 0.3, 0.8), ponto_na_folha(area, 0.7, 0.8)])
    verificar(pagina.evaluate(ESTADO_FOLHA)["podeDesfazer"], "desenha também com a folha ampliada")

    # Pan com dois dedos para baixo: a folha "infinita" desce.
    antes = pagina.evaluate(PIXELS_DE_TINTA)
    a, b = ponto_na_folha(area, 0.35, 0.8), ponto_na_folha(area, 0.65, 0.8)
    toque.dois_dedos(a, b, (a[0], a[1] - area["altura"] * 0.7), (b[0], b[1] - area["altura"] * 0.7))
    depois = pagina.evaluate(PIXELS_DE_TINTA)
    verificar(depois != antes, f"pan com dois dedos move a folha ({antes} → {depois} px de tinta visíveis)")
    verificar(zoom_atual(pagina) == zoom, "pan não muda o zoom")

    pagina.click('[data-rs="zoom"]')
    verificar(pagina.inner_text(".fe-zoom") == "100%", "botão 100% volta o zoom")
    toque.pinca(centro, 240, 40)
    verificar(zoom_atual(pagina) == 50, f"zoom mínimo 50% ({zoom_atual(pagina)}%)")
    toque.pinca(centro, 30, 300)
    toque.pinca(centro, 30, 300)
    verificar(zoom_atual(pagina) == 400, f"zoom máximo 400% ({zoom_atual(pagina)}%)")
    pagina.click('[data-rs="zoom"]')

    # Borracha, limpar e desfazer.
    tinta = pagina.evaluate(PIXELS_DE_TINTA)
    pagina.click('[data-rs="borracha"]')
    toque.arrastar([ponto_na_folha(area, 0.1, 0.05), ponto_na_folha(area, 0.95, 0.95)], passo_px=6)
    verificar(pagina.evaluate(PIXELS_DE_TINTA) < tinta, "borracha apaga traços inteiros")
    pagina.click('[data-rs="desfazer"]')
    verificar(pagina.evaluate(PIXELS_DE_TINTA) == tinta, "desfazer devolve o que a borracha apagou")
    pagina.click('[data-rs="fina"]')
    pagina.click('[data-rs="limpar"]')
    verificar(pagina.evaluate(PIXELS_DE_TINTA) == 0, "limpar apaga a folha")
    pagina.click('[data-rs="desfazer"]')
    verificar(pagina.evaluate(PIXELS_DE_TINTA) == tinta, "desfazer depois de limpar recupera")

    # Pinça: o primeiro dedo não deixa risco. Uma pinça parada não muda a vista, então
    # a tinta visível tem de ser a mesma; e o "refazer" do limpar continua disponível
    # (um traço novo apagaria o que dava para refazer).
    tinta = pagina.evaluate(PIXELS_DE_TINTA)
    toque.pinca(ponto_na_folha(area, 0.5, 0.15), 100, 100)
    verificar(pagina.evaluate(PIXELS_DE_TINTA) == tinta and pagina.evaluate(ESTADO_FOLHA)["podeRefazer"],
              "a pinça não deixa risco do primeiro dedo")
    return qid_1


def testar_divisoria_e_tela_cheia(pagina, toque):
    secao("Divisória e tela cheia")
    estado = pagina.evaluate(ESTADO_FOLHA)
    barra = pagina.evaluate("(() => { const r = document.querySelector('.fe-pega').getBoundingClientRect(); "
                            "return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    toque.arrastar([barra, (barra[0], barra[1] + 200)], passo_px=8)
    depois = pagina.evaluate(ESTADO_FOLHA)
    verificar(depois["tela"][1] > estado["tela"][1] + 150, f"arrastar a divisória para baixo aumenta a questão ({estado['tela'][1]:.0f} → {depois['tela'][1]:.0f})")
    verificar(pagina.evaluate(PIXELS_DE_TINTA) > 0, "o desenho continua após redimensionar a folha")
    salvo = pagina.evaluate("localStorage.getItem('fuvest-folha-divisao')")
    verificar(salvo is not None and float(salvo) > 0.5, f"proporção salva ({salvo})")
    barra = (barra[0], barra[1] + 200)
    toque.arrastar([barra, (barra[0], barra[1] - 600)], passo_px=8)
    limite = pagina.evaluate(ESTADO_FOLHA)
    verificar(limite["tela"][1] >= 100, f"a questão não some ao arrastar até o topo ({limite['tela'][1]:.0f}px)")
    toque.arrastar([(barra[0], limite["area"][0] - 30), (barra[0], 380)], passo_px=8)

    pagina.click('[data-rs="cheia"]')
    verificar("folha-cheia" in pagina.evaluate("document.documentElement.className"), "folha em tela cheia")
    verificar(not pagina.is_visible(".tela"), "a questão sai da tela")
    verificar(pagina.is_visible(".fe-consulta-alternar") and not pagina.is_visible(".fe-consulta-corpo"),
              "faixa de consulta recolhida no topo")
    fotos_claro_escuro(pagina, "24-folha-tela-cheia")
    pagina.click(".fe-consulta-alternar")
    verificar(pagina.is_visible(".fe-consulta-corpo .q-enunciado") and pagina.locator(".fe-consulta-corpo .alt").count() == 5,
              "faixa aberta mostra enunciado e alternativas")
    fotos_claro_escuro(pagina, "25-folha-consulta-aberta")
    pagina.click(".fe-consulta-alternar")
    pagina.click('[data-rs="cheia"]')
    verificar(pagina.is_visible(".tela"), "sai da tela cheia e a questão volta")


def testar_responder_e_trocar_questao(pagina, toque, qid_1):
    secao("Responder sem sair da folha; folha por questão")
    tinta_1 = pagina.evaluate(PIXELS_DE_TINTA)
    pagina.locator('[data-acao="escolher"]').first.click()
    pagina.wait_for_selector(".feedback")
    verificar(pagina.locator(".folha-escrita").count() == 1, "responder a alternativa mantém o modo dividido")
    fotos_claro_escuro(pagina, "26-folha-com-feedback")
    pagina.click('[data-acao="proxima"]')
    pagina.wait_for_function(f"document.querySelector('article.questao')?.dataset.qid !== '{qid_1}'")
    verificar(pagina.locator(".folha-escrita").count() == 1, "a folha continua aberta na próxima questão")
    verificar(pagina.evaluate(PIXELS_DE_TINTA) == 0, "a próxima questão tem a folha limpa")
    verificar(not pagina.evaluate(ESTADO_FOLHA)["podeDesfazer"], "desfazer é por questão")
    area = area_da_folha(pagina)
    toque.arrastar(rabisco(area, 0.5))
    tinta_2 = pagina.evaluate(PIXELS_DE_TINTA)
    pagina.click('[data-rs="fechar"]')
    pagina.wait_for_function("!document.querySelector('.folha-escrita')")
    verificar("modo-folha" not in pagina.evaluate("document.documentElement.className"), "fechar desfaz o modo dividido")
    abrir_folha(pagina)
    verificar(pagina.evaluate(PIXELS_DE_TINTA) == tinta_2, "reabrir mostra a folha desta questão")
    pagina.go_back()
    pagina.wait_for_function("!document.querySelector('.folha-escrita')")
    verificar(pagina.locator("article.questao").count() == 1, "'voltar' do Android fecha a folha e fica na questão")
    return tinta_1


def testar_revisao_com_folha(pagina, toque):
    secao("Revisão: folha preservada ao voltar à questão")
    ir(pagina, f"#/revisao/{QUESTAO_COM_TABELA}", "article.questao")
    abrir_folha(pagina)
    area = area_da_folha(pagina)
    toque.arrastar(rabisco(area, 0.4))
    tinta = pagina.evaluate(PIXELS_DE_TINTA)
    pagina.click('[data-rs="fechar"]')
    ir(pagina, "#/revisao/MAT-A-002", "article.questao")
    abrir_folha(pagina)
    verificar(pagina.evaluate(PIXELS_DE_TINTA) == 0, "outra questão começa com a folha limpa")
    pagina.click('[data-rs="fechar"]')
    pagina.wait_for_function("!document.querySelector('.folha-escrita')")
    pagina.go_back()
    pagina.wait_for_function(f"document.querySelector('article.questao')?.dataset.qid === '{QUESTAO_COM_TABELA}'")
    abrir_folha(pagina)
    verificar(pagina.evaluate(PIXELS_DE_TINTA) == tinta, "voltar à questão anterior mostra a folha dela")
    pagina.click('[data-rs="fechar"]')
    pagina.wait_for_function("!document.querySelector('.folha-escrita')")


def testar_simulado_com_folha(pagina, toque):
    secao("Simulado: folha salva no IndexedDB e recarregar")
    ir(pagina, "#/simulado", ".abertura-simulado, article.simulado")
    if pagina.locator('[data-acao="comecar"]').count():
        pagina.click('[data-acao="comecar"]')
    pagina.wait_for_selector("article.simulado")
    qid = pagina.get_attribute("article.simulado", "data-qid")
    abrir_folha(pagina)
    pagina.locator('[data-acao="escolher"]').nth(1).click()
    verificar(pagina.locator(".alt-marcada").count() == 1 and pagina.locator(".folha-escrita").count() == 1,
              "marca a alternativa com a folha aberta")
    area = area_da_folha(pagina)
    toque.arrastar(rabisco(area, 0.4))
    toque.pinca(ponto_na_folha(area, 0.5, 0.5), 100, 160)
    tinta = pagina.evaluate(PIXELS_DE_TINTA)
    fotos_claro_escuro(pagina, "27-simulado-com-folha")
    pagina.click('[data-acao="proxima"]')
    pagina.wait_for_selector('article.simulado[data-numero="2"]')
    verificar(pagina.evaluate(PIXELS_DE_TINTA) == 0, "questão 2 do simulado com folha limpa")
    pagina.click('.tela [aria-label="Questão anterior"]')
    pagina.wait_for_selector('article.simulado[data-numero="1"]')
    verificar(pagina.evaluate(PIXELS_DE_TINTA) == tinta, "voltar à questão 1 mostra a folha e o zoom dela")
    pagina.wait_for_timeout(700)
    sim = pagina.evaluate(LER_ANDAMENTO)
    verificar(len(sim["escrita"]["folhas"].get(qid, [])) == 1, "folha salva no IndexedDB com o simulado")
    pagina.reload()
    pagina.wait_for_selector('article.simulado[data-numero="1"]')
    verificar(pagina.locator(".folha-escrita").count() == 0, "depois de recarregar abre a questão (folha fechada)")
    abrir_folha(pagina)
    verificar(pagina.evaluate(PIXELS_DE_TINTA) > 0, "folha volta depois de recarregar o app")
    pagina.click('[data-rs="fechar"]')
    pagina.wait_for_function("!document.querySelector('.folha-escrita')")


def testar_escrita_sobre(pagina):
    secao("Escrever sobre a questão (opção secundária)")
    abrir_folha(pagina)
    pagina.click('[data-rs="sobre"]')
    pagina.wait_for_selector(".rascunho .rs-canvas")
    verificar(pagina.locator(".folha-escrita").count() == 0, "troca a folha pela camada sobre a questão")
    pagina.mouse.move(100, 300)
    pagina.mouse.down()
    pagina.mouse.move(260, 340)
    pagina.mouse.up()
    verificar(pagina.locator('[data-rs="refazer"]').count() == 1, "camada sobre a questão também tem refazer")
    pagina.click('[data-rs="fechar"]')
    pagina.wait_for_function("!document.querySelector('.rascunho')")
    verificar(pagina.evaluate("history.state?.camadas?.length ?? 0") == 0, "histórico sem entradas de camada sobrando")


def testar_zoom_do_texto(pagina, toque):
    secao("Zoom de leitura: A−/A+ e pinça no texto")
    ir(pagina, f"#/revisao/{QUESTAO_COM_TABELA}", "article.questao")
    fonte = lambda: pagina.evaluate("parseFloat(getComputedStyle(document.querySelector('.q-enunciado')).fontSize)")  # noqa: E731
    sem_rolagem = lambda: pagina.evaluate("document.documentElement.scrollWidth <= innerWidth")  # noqa: E731
    verificar(fonte() == 17, f"tamanho padrão 17px ({fonte()})")
    for _ in range(10):
        if pagina.is_disabled('[data-acao="texto-maior"]'):
            break
        pagina.click('[data-acao="texto-maior"]')
    verificar(fonte() == 28, f"A+ chega a 28px ({fonte()})")
    verificar(pagina.is_disabled('[data-acao="texto-maior"]'), "A+ desativa no máximo")
    verificar(sem_rolagem(), "texto grande sem rolagem horizontal")
    fotos_claro_escuro(pagina, "28-texto-grande")
    for _ in range(10):
        if pagina.is_disabled('[data-acao="texto-menor"]'):
            break
        pagina.click('[data-acao="texto-menor"]')
    verificar(fonte() == 14, f"A− chega a 14px ({fonte()})")
    verificar(sem_rolagem(), "texto pequeno sem rolagem horizontal")
    pagina.click('[data-acao="texto-maior"]')
    pagina.click('[data-acao="texto-maior"]')
    verificar(fonte() == 18, f"A+ anda de 2 em 2 ({fonte()})")

    toque.pinca((206, 600), 100, 180)
    depois_pinca = fonte()
    verificar(depois_pinca > 26, f"pinça para abrir aumenta o texto (18 → {depois_pinca})")
    verificar(sem_rolagem(), "pinça no texto não cria rolagem horizontal")
    verificar(pagina.evaluate("visualViewport.scale") == 1, "o zoom do navegador não foi acionado")
    toque.pinca((206, 600), 200, 90)
    verificar(fonte() < depois_pinca, f"pinça para fechar diminui ({fonte()})")
    salvo = float(pagina.evaluate("localStorage.getItem('fuvest-texto-questao')"))
    verificar(salvo == fonte(), f"tamanho salvo no aparelho ({salvo})")
    rolagem = pagina.evaluate("scrollY")
    toque.arrastar([(206, 700), (206, 300)])
    verificar(pagina.evaluate("scrollY") > rolagem, "um dedo continua rolando a questão")

    ir(pagina, "#/filtros", "#form-filtros")
    pagina.click("#botao-comecar")
    pagina.wait_for_selector("article.questao")
    verificar(fonte() == salvo, "o tamanho vale para as outras telas de questão")
    abrir_folha(pagina)
    toque.pinca((206, 220), 80, 160)
    verificar(fonte() > salvo, "pinça no texto também funciona no modo dividido")
    verificar(pagina.evaluate("document.documentElement.scrollWidth <= innerWidth"), "modo dividido sem rolagem horizontal")
    pagina.click('[data-rs="fechar"]')
    pagina.wait_for_function("!document.querySelector('.folha-escrita')")
    pagina.evaluate("localStorage.setItem('fuvest-texto-questao', '17')")


def testar_visualizador(pagina, toque):
    secao("Visualizador de tabela")
    ir(pagina, f"#/revisao/{QUESTAO_COM_TABELA}", ".tabela")
    pagina.click(".tabela td >> nth=0")
    pagina.wait_for_selector(".visualizador .vz-conteudo table")
    escala = lambda: pagina.evaluate("new DOMMatrix(getComputedStyle(document.querySelector('.vz-conteudo')).transform).a")  # noqa: E731
    cabe = pagina.evaluate("(() => { const r = document.querySelector('.vz-conteudo').getBoundingClientRect(); "
                           "return r.left >= -1 && r.right <= innerWidth + 1; })()")
    verificar(cabe, "tabela inteira visível ao abrir (sem cortar colunas)")
    inicial = escala()
    fotos_claro_escuro(pagina, "29-visualizador")
    toque.pinca((206, 500), 80, 220)
    ampliada = escala()
    verificar(ampliada > inicial * 2, f"pinça amplia a tabela ({inicial:.2f} → {ampliada:.2f})")
    verificar(pagina.evaluate("document.documentElement.scrollWidth <= innerWidth"), "ampliar não cria rolagem na página")
    posicao = pagina.evaluate("document.querySelector('.vz-conteudo').getBoundingClientRect().left")
    toque.arrastar([(300, 500), (120, 500)])
    verificar(pagina.evaluate("document.querySelector('.vz-conteudo').getBoundingClientRect().left") < posicao,
              "um dedo move a tabela ampliada")
    foto(pagina, "30-visualizador-ampliado-claro")
    toque.tocar((206, 500))
    toque.tocar((206, 500))
    pagina.wait_for_timeout(100)
    verificar(abs(escala() - inicial) < 0.01, "duplo toque volta ao tamanho inicial")
    toque.tocar((206, 500))
    toque.tocar((206, 500))
    pagina.wait_for_timeout(100)
    verificar(escala() > inicial * 2, "duplo toque amplia")
    pagina.go_back()
    pagina.wait_for_function("!document.querySelector('.visualizador')")
    verificar(pagina.locator("article.questao").count() == 1, "'voltar' fecha o visualizador e fica na questão")
    pagina.click(".tabela .ampliar-dica")
    pagina.wait_for_selector(".visualizador")
    pagina.click('[data-vz="fechar"]')
    pagina.wait_for_function("!document.querySelector('.visualizador')")
    verificar(pagina.evaluate("history.state?.camadas?.length ?? 0") == 0, "fechar pelo X limpa o histórico")


def testar_viewport(pagina):
    secao("Viewport e acessibilidade")
    meta = pagina.get_attribute('meta[name="viewport"]', "content")
    verificar("user-scalable=no" not in meta and "maximum-scale" not in meta, f"zoom do navegador não bloqueado ({meta})")


def main():
    for antiga in TELAS.glob("2[1-9]-*.png"):
        antiga.unlink()
    for antiga in TELAS.glob("30-*.png"):
        antiga.unlink()
    console = Console()
    with servidor() as url, celular() as contexto:
        pagina = contexto.new_page()
        console.ligar(pagina)
        toque = Toque(pagina, contexto)
        pagina.goto(url)
        pagina.wait_for_selector(".inicio")
        testar_viewport(pagina)
        qid_1 = testar_folha_basica(pagina, toque)
        testar_divisoria_e_tela_cheia(pagina, toque)
        testar_responder_e_trocar_questao(pagina, toque, qid_1)
        testar_revisao_com_folha(pagina, toque)
        testar_simulado_com_folha(pagina, toque)
        testar_escrita_sobre(pagina)
        testar_zoom_do_texto(pagina, toque)
        testar_visualizador(pagina, toque)
    secao("Console")
    verificar(not console.erros, "zero erros no console" + ("" if not console.erros else f": {console.erros}"))
    falhas = [d for ok, d in resultados if not ok]
    print(f"\n{len(resultados) - len(falhas)}/{len(resultados)} verificações passaram.")
    return 1 if falhas else 0


if __name__ == "__main__":
    inicio = time.time()
    codigo = main()
    print(f"Tempo: {time.time() - inicio:.0f}s")
    sys.exit(codigo)
