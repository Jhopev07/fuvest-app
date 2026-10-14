"""Teste de ponta a ponta do app no Chromium headless, em viewport de celular.

Uso (na raiz do repositório):
    python3 tools/build.py
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 tools/testes/testar_app.py

Cobre: carga e modo offline, prática, revisar erros, escrita sobre a questão (eventos
de ponteiro de toque e de mouse), simulado completo com saída e retomada, resultado e relatório,
histórico, exportar/importar, tema, nova versão do service worker, IndexedDB
indisponível, escape de HTML e renderização de todas as questões do banco.
Screenshots vão para tools/testes/screens/.
"""
import json
import sys
import time
from collections import Counter
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

from apoio import RAIZ, TELAS, Console, celular, foto, publicar_nova_versao_sw, servidor  # noqa: E402

BANCO = json.loads((RAIZ / "data" / "questoes.json").read_text(encoding="utf-8"))
QUESTOES = {q["id"]: q for q in BANCO["questoes"]}
CONFIG_SIMULADO = {
    "portugues": 7, "literatura": 5, "ingles": 7, "arte": 2, "edfisica": 1, "matematica": 10,
    "fisica": 8, "quimica": 9, "biologia": 9, "historia": 9, "geografia": 9, "filosofia": 2, "sociologia": 2,
}
AREA = {
    "portugues": "linguagens", "literatura": "linguagens", "ingles": "linguagens", "arte": "linguagens",
    "edfisica": "linguagens", "matematica": "matematica", "fisica": "natureza", "quimica": "natureza",
    "biologia": "natureza", "historia": "humanas", "geografia": "humanas", "filosofia": "humanas",
    "sociologia": "humanas",
}
ORDEM_AREAS = ["linguagens", "matematica", "natureza", "humanas"]

LER_LOJA = """async (loja) => new Promise((resolve, reject) => {
  const pedido = indexedDB.open("fuvest-app");
  pedido.onerror = () => reject(pedido.error);
  pedido.onsuccess = () => {
    const banco = pedido.result;
    const leitura = banco.transaction(loja).objectStore(loja).getAll();
    leitura.onsuccess = () => { resolve(leitura.result); banco.close(); };
    leitura.onerror = () => reject(leitura.error);
  };
})"""

PIXELS_DESENHADOS = """() => {
  const c = document.querySelector(".rs-canvas");
  const dados = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < dados.length; i += 4) if (dados[i]) n++;
  return n;
}"""

SIMULAR_VISIBILIDADE = """(estado) => {
  Object.defineProperty(document, "visibilityState", { value: estado, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}"""

resultados = []


def verificar(condicao, descricao):
    resultados.append((bool(condicao), descricao))
    print(("  ok   " if condicao else "  FALHA ") + descricao)
    return condicao


def secao(titulo):
    print(f"\n== {titulo}")


def ler_loja(pagina, loja):
    return pagina.evaluate(LER_LOJA, loja)


def abrir_escrita_sobre(pagina):
    """Folha de escrita → "escrever sobre a questão" (a opção secundária)."""
    pagina.click('[data-acao="rascunho"]')
    pagina.wait_for_selector(".folha-escrita")
    pagina.click('[data-rs="sobre"]')
    pagina.wait_for_selector(".rascunho canvas")
    pagina.wait_for_function("!document.querySelector('.folha-escrita')")


def ir(pagina, hash_, seletor):
    pagina.evaluate("(h) => { location.hash = h; }", hash_)
    pagina.wait_for_selector(seletor)


ESPERA_TRANSICAO_MS = 400  # transições de cor e rolagem suave terminam antes da foto


def fotos_claro_escuro(pagina, nome, pagina_inteira=False):
    for esquema, sufixo in (("light", "claro"), ("dark", "escuro")):
        pagina.emulate_media(color_scheme=esquema)
        pagina.wait_for_timeout(ESPERA_TRANSICAO_MS)
        foto(pagina, f"{nome}-{sufixo}", pagina_inteira)
    pagina.emulate_media(color_scheme="light")


def qid_atual(pagina):
    return pagina.get_attribute("article.questao", "data-qid")


def responder(pagina, certo):
    q = QUESTOES[qid_atual(pagina)]
    original = q["correta"] if certo else (q["correta"] + 1) % 5
    pagina.click(f'[data-acao="escolher"][data-original="{original}"]')
    return q, original


# ---------------------------------------------------------------- testes

def testar_carga(pagina, url):
    secao("Carga inicial e service worker")
    pagina.goto(url)
    pagina.wait_for_selector(".inicio")
    verificar(pagina.locator("h1").inner_text() == "Fuvest 1ª fase", "tela inicial abre")
    pagina.wait_for_function("navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready")
    pagina.evaluate("navigator.serviceWorker.ready")
    pagina.wait_for_selector("#aviso.visivel", timeout=10_000)
    verificar("Pronto para usar sem internet" in pagina.inner_text("#aviso"), "aviso de pronto para offline")
    chaves = pagina.evaluate("caches.keys()")
    verificar(any(k.startswith("fuvest-") for k in chaves), f"cache criado ({chaves})")
    larguras = pagina.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    verificar(larguras[0] <= larguras[1], "sem rolagem horizontal na tela inicial")
    fotos_claro_escuro(pagina, "01-inicio-vazio")


def testar_escape(pagina):
    secao("Escape de HTML e negrito")
    resultado = pagina.evaluate("""async () => {
      const r = await import("./js/render.js");
      const alvo = document.createElement("div");
      r.montar(alvo, r.textoRico('<img src=x onerror="window.__xss=1"> **forte** & <b>b</b>\\n\\nsegundo'));
      const tab = document.createElement("div");
      r.montar(tab, r.tabela({ titulo: "<i>t</i>", cabecalho: ["<s>a</s>"], linhas: [["**x**"]] }));
      const svg = document.createElement("div");
      r.montar(svg, r.figuraSvg('<svg viewBox="0 0 10 10" onload="window.__xss=2"><script>window.__xss=3</script><circle r="2"/></svg>'));
      const vazio = document.createElement("div");
      r.montar(vazio, [r.tabela(undefined), r.figuraSvg(undefined), r.textoRico(undefined)]);
      return { html: alvo.innerHTML, img: alvo.querySelectorAll("img").length, strong: alvo.querySelectorAll("strong").length,
               p: alvo.querySelectorAll("p").length, tabela: tab.innerHTML, svg: svg.innerHTML, vazio: vazio.innerHTML,
               xss: window.__xss ?? null };
    }""")
    verificar(resultado["img"] == 0 and "&lt;img" in resultado["html"], "tags vindas do texto são escapadas")
    verificar(resultado["strong"] == 1 and resultado["p"] == 2, "**negrito** e parágrafos aplicados depois do escape")
    verificar("<i>" not in resultado["tabela"] and "<strong>x</strong>" in resultado["tabela"], "tabela escapada")
    verificar("script" not in resultado["svg"] and "onload" not in resultado["svg"] and "<circle" in resultado["svg"],
              "SVG passa por lista branca")
    verificar(resultado["vazio"] == "" and resultado["xss"] is None, "campos ausentes não quebram e nada executa")


def testar_todas_as_questoes(pagina):
    secao("Renderização de todas as questões do banco")
    falhas = []
    for qid, q in QUESTOES.items():
        ir(pagina, f"#/revisao/{qid}", "article.questao")
        info = pagina.evaluate("""() => ({
          alts: document.querySelectorAll(".alternativas .alt").length,
          certa: document.querySelectorAll(".alt-certa").length,
          tabela: document.querySelectorAll(".tabela table").length,
          largura: document.documentElement.scrollWidth,
          explic: document.querySelector(".explicacao").innerText.length })""")
        ok = (info["alts"] == 5 and info["certa"] == 1 and info["largura"] <= 412
              and info["tabela"] == (1 if q.get("tabela") else 0) and info["explic"] > 200)
        if not ok:
            falhas.append((qid, info))
    verificar(not falhas, f"{len(QUESTOES)} questões renderizadas sem rolagem horizontal {falhas[:3]}")
    ir(pagina, "#/revisao/GEO-001", ".tabela")
    foto(pagina, "02-revisao-tabela-claro", pagina_inteira=True)


def testar_pratica(pagina):
    secao("Prática: filtros, resposta, feedback, próxima")
    ir(pagina, "#/", ".inicio")
    pagina.click("text=Questões aleatórias")
    pagina.wait_for_selector("#form-filtros")
    verificar(pagina.inner_text("#contagem-filtro") == f"{len(QUESTOES)} questões", "contagem sem filtro = banco todo")
    pagina.click("label.chip-filtro:has(input[value=fisica])")
    pagina.click("label.chip-filtro:has(input[value=matematica])")
    esperado = sum(1 for q in QUESTOES.values() if q["materia"] in ("fisica", "matematica"))
    verificar(pagina.inner_text("#contagem-filtro") == f"{esperado} questões", "filtro por matéria atualiza a contagem")
    verificar(not pagina.is_checked("input[name=todas]"), "'todas' desmarca ao escolher matéria")
    fotos_claro_escuro(pagina, "03-filtros")
    pagina.click("#botao-comecar")
    pagina.wait_for_selector("article.questao")
    verificar(QUESTOES[qid_atual(pagina)]["materia"] in ("fisica", "matematica"), "questão respeita o filtro")
    alturas = pagina.eval_on_selector_all('[data-acao="escolher"]', "bs => bs.map(b => b.getBoundingClientRect().height)")
    verificar(min(alturas) >= 48, f"alternativas com altura ≥ 48px (mín {min(alturas):.0f})")
    letras = pagina.eval_on_selector_all(".alternativas .bolha", "bs => bs.map(b => b.textContent)")
    verificar(letras == list("ABCDE"), "letras A–E")
    fotos_claro_escuro(pagina, "04-questao")

    q, _ = responder(pagina, certo=True)
    pagina.wait_for_selector(".feedback")
    verificar(pagina.inner_text("#resultado-questao").strip() == "Acertou!", "feedback 'Acertou!'")
    verificar(pagina.locator(".alt-certa").count() == 1 and pagina.locator(".alt-errada").count() == 0, "certa em verde")
    verificar(pagina.locator(".alt-motivo").count() == 4, "motivo em cada uma das 4 erradas")
    verificar(pagina.inner_text(".placar-sessao").replace(" ", "") == "1/1", "placar da sessão 1/1")
    pagina.click('[data-acao="proxima"]')
    pagina.wait_for_selector('[data-acao="escolher"]')
    q2, escolhida = responder(pagina, certo=False)
    pagina.wait_for_selector(".feedback")
    texto = pagina.inner_text("#resultado-questao")
    ordem_letras = pagina.eval_on_selector_all(".alternativas .alt", "ls => ls.map(l => l.className)")
    posicao_certa = next(i for i, c in enumerate(ordem_letras) if "alt-certa" in c)
    verificar(texto.strip() == f"Errou — a resposta é {'ABCDE'[posicao_certa]}", f"feedback de erro com a letra certa ({texto.strip()})")
    verificar(pagina.locator(".alt-errada").count() == 1, "escolhida em vermelho")
    motivo_errada = pagina.inner_text(".alt-errada .alt-motivo")
    verificar(motivo_errada.strip() == q2["erradas"][escolhida].replace("**", "").strip(),
              "motivo da errada mapeado pela ordem original")
    fotos_claro_escuro(pagina, "05-feedback-erro")
    foto(pagina, "05-feedback-erro-inteira-claro", pagina_inteira=True)

    tentativas = ler_loja(pagina, "tentativas")
    verificar(len(tentativas) == 2, "2 tentativas gravadas no IndexedDB")
    ultima = max(tentativas, key=lambda t: t["quando"])
    campos = {"qid", "materia", "tema", "nivel", "escolhida", "acertou", "tempoMs", "modo", "sessaoId", "quando"}
    verificar(campos <= set(ultima), "tentativa tem todos os campos da especificação")
    verificar(ultima["qid"] == q2["id"] and ultima["escolhida"] == escolhida and ultima["acertou"] is False
              and ultima["modo"] == "aleatorias", "tentativa guarda o índice ORIGINAL escolhido")

    for _ in range(3):  # mais algumas erradas para a fila de revisão
        pagina.click('[data-acao="proxima"]')
        pagina.wait_for_selector('[data-acao="escolher"]')
        responder(pagina, certo=False)
        pagina.wait_for_selector(".feedback")
    return q2["id"]


def testar_rascunho(pagina, cdp):
    secao("Escrita sobre a questão: desenhar, desfazer, borracha, limpar, fundo, rolar")
    pagina.click('[data-acao="proxima"]')
    pagina.wait_for_selector('[data-acao="escolher"]')
    responder(pagina, certo=True)  # com a explicação aberta a página fica longa o bastante para rolar
    pagina.wait_for_selector(".feedback")
    pagina.evaluate("scrollTo(0, 0)")
    rolavel = pagina.evaluate("document.documentElement.scrollHeight - innerHeight")
    verificar(rolavel > 300, f"página da questão maior que a tela ({rolavel}px a rolar)")
    abrir_escrita_sobre(pagina)
    canvas = pagina.evaluate("(() => { const c = document.querySelector('.rs-canvas'); return [c.width, c.height, getComputedStyle(c).touchAction]; })()")
    verificar(canvas[0] == round(412 * 2.625) and canvas[2] == "none", f"canvas escalado por devicePixelRatio e touch-action none {canvas}")
    pixels = lambda: pagina.evaluate(PIXELS_DESENHADOS)  # noqa: E731
    verificar(pixels() == 0, "rascunho começa vazio")

    def traco_toque(pontos, passo=10):
        """Arrasta o dedo pelos pontos, com movimentos intermediários a cada `passo` px."""
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": pontos[0][0], "y": pontos[0][1]}]})
        for (x0, y0), (x1, y1) in zip(pontos, pontos[1:]):
            n = max(1, int(max(abs(x1 - x0), abs(y1 - y0)) / passo))
            for k in range(1, n + 1):
                x, y = x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n
                cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        pagina.wait_for_timeout(50)

    traco_toque([(60 + i * 12, 200 + (i % 4) * 8) for i in range(20)])
    p1 = pixels()
    verificar(p1 > 500, f"traço com o dedo (pointerType touch) desenha ({p1} px)")
    pagina.mouse.move(80, 400)
    pagina.mouse.down()
    for i in range(15):
        pagina.mouse.move(80 + i * 15, 400 + i * 6)
    pagina.mouse.up()
    p2 = pixels()
    verificar(p2 > p1, "segundo traço (mouse) desenha")

    pagina.click('[data-rs="desfazer"]')
    verificar(abs(pixels() - p1) < p1 * 0.05, "desfazer remove só o último traço")
    pagina.click('[data-rs="desfazer"]')
    verificar(pixels() == 0, "desfazer de novo esvazia")

    pagina.click('[data-rs="grossa"]')
    pagina.click('[data-rs="cor-vermelho"]')
    traco_toque([(100, 300), (150, 320), (200, 340), (260, 360)])
    traco_toque([(100, 600), (300, 600)])
    p_grossa = pixels()
    verificar(pagina.get_attribute('[data-rs="cor-vermelho"]', "aria-pressed") == "true", "cor vermelha selecionada")
    pagina.click('[data-rs="borracha"]')
    traco_toque([(180, 280), (180, 330), (180, 380)])  # cruza só o primeiro traço
    p_apagado = pixels()
    verificar(0 < p_apagado < p_grossa, f"borracha apaga o traço tocado inteiro ({p_grossa} → {p_apagado})")
    pagina.click('[data-rs="desfazer"]')
    verificar(pixels() == p_grossa, "desfazer devolve o traço apagado pela borracha")
    traco_toque([(20, 800), (25, 805)])  # borracha longe de tudo
    verificar(pixels() == p_grossa, "borracha em área vazia não apaga nada")

    pagina.click('[data-rs="limpar"]')
    verificar(pixels() == 0, "limpar apaga tudo")
    pagina.click('[data-rs="desfazer"]')
    verificar(pixels() == p_grossa, "desfazer depois de limpar recupera")

    pagina.click('[data-rs="fundo"]')
    verificar("papel" in pagina.get_attribute(".rascunho", "class"), "fundo papel (opaco quadriculado)")
    fotos_claro_escuro(pagina, "06-rascunho-papel")
    pagina.click('[data-rs="fundo"]')
    verificar("papel" not in pagina.get_attribute(".rascunho", "class"), "fundo volta a transparente")
    pagina.click('[data-rs="fina"]')
    traco_toque([(60, 150), (120, 160), (200, 150), (260, 170), (330, 160)])
    fotos_claro_escuro(pagina, "07-rascunho-transparente")

    antes_rolar = pixels()
    pagina.click('[data-rs="rolar"]')
    verificar("rolando" in pagina.get_attribute(".rascunho", "class"), "modo rolar ativado")
    traco_toque([(200, 700), (200, 600), (200, 450), (200, 300)])
    rolou = pagina.evaluate("scrollY")
    verificar(pixels() <= antes_rolar, "no modo rolar o dedo não desenha")
    verificar(rolou > 0, f"no modo rolar o dedo rola a questão (scrollY={rolou})")
    pagina.click('[data-rs="rolar"]')
    verificar(pixels() > 0, "desenho acompanha a rolagem (ainda visível)")

    pagina.set_viewport_size({"width": 400, "height": 860})
    pagina.wait_for_timeout(150)
    verificar(pixels() > 0, "redimensionar não perde o desenho")
    pagina.set_viewport_size({"width": 412, "height": 915})

    pagina.click('[data-rs="fechar"]')
    verificar(pagina.locator(".rascunho").count() == 0, "fechar remove a camada")
    abrir_escrita_sobre(pagina)
    verificar(pixels() > 0, "reabrir na mesma questão mostra o desenho")
    pagina.go_back()
    pagina.wait_for_timeout(150)
    verificar(pagina.locator(".rascunho").count() == 0 and pagina.locator("article.questao").count() == 1,
              "'voltar' do Android fecha o rascunho e fica na questão")


def testar_revisar_erros(pagina):
    secao("Revisar erros")
    ir(pagina, "#/", ".inicio")
    detalhe = pagina.inner_text('a[href="#/erros"] .acao-detalhe')
    verificar("4 questões para refazer" in detalhe, f"início mostra a fila de erros ({detalhe})")
    pagina.click('a[href="#/erros"]')
    pagina.wait_for_selector('[data-acao="escolher"]')
    verificar("1 de 4" in pagina.inner_text(".progresso-fila"), "fila com 4 questões")
    responder(pagina, certo=True)
    pagina.wait_for_selector(".feedback")
    for _ in range(3):
        pagina.click('[data-acao="proxima"]')
        pagina.wait_for_selector('[data-acao="escolher"]')
        responder(pagina, certo=False)
        pagina.wait_for_selector(".feedback")
    pagina.click('[data-acao="proxima"]')
    pagina.wait_for_selector(".estado-vazio")
    verificar("Fila de erros concluída" in pagina.inner_text(".estado-vazio"), "fim da fila")
    ir(pagina, "#/", ".inicio")
    verificar("3 questões" in pagina.inner_text('a[href="#/erros"] .acao-detalhe'), "acerto sai da fila; erros continuam")
    tentativas = ler_loja(pagina, "tentativas")
    verificar(sum(1 for t in tentativas if t["modo"] == "erros") == 4, "tentativas da revisão gravadas com modo 'erros'")


def testar_simulado(pagina, contexto):
    secao("Simulado: 80 questões, sair no meio, continuar, entregar")
    ir(pagina, "#/simulado", ".abertura-simulado")
    verificar("80 questões" in pagina.inner_text(".abertura-titulo"), "abertura mostra 80 questões")
    fotos_claro_escuro(pagina, "08-simulado-abertura")
    pagina.click('[data-acao="comecar"]')
    pagina.wait_for_selector("article.simulado")
    sim = ler_loja(pagina, "andamento")[0]
    materias = Counter(QUESTOES[i["qid"]]["materia"] for i in sim["itens"])
    verificar(dict(materias) == CONFIG_SIMULADO, "distribuição por matéria igual à da configuração")
    areas = [AREA[QUESTOES[i["qid"]]["materia"]] for i in sim["itens"]]
    verificar(areas == sorted(areas, key=ORDEM_AREAS.index), "questões agrupadas por área na ordem da prova")
    vistas = {t["qid"] for t in ler_loja(pagina, "tentativas")}
    verificar(not (vistas & {i["qid"] for i in sim["itens"]}), "simulado prefere questões nunca vistas")
    verificar(all(sorted(i["ordem"]) == [0, 1, 2, 3, 4] for i in sim["itens"]), "ordem embaralhada salva por questão")

    respostas = {}
    acertos_esperados = 0

    def responder_atual(n):
        nonlocal acertos_esperados
        certo = n % 3 != 0  # ~2/3 de acerto
        _, original = responder(pagina, certo)
        respostas[n] = original
        acertos_esperados += certo
        if n == 0:
            marcada = pagina.locator(".alt-marcada").count() == 1
            verificar(marcada and pagina.locator(".feedback").count() == 0, "marca sem feedback durante a prova")

    for n in range(40):
        responder_atual(n)
        if n == 0:
            outra = (respostas[0] + 1) % 5
            pagina.click(f'[data-acao="escolher"][data-original="{outra}"]')
            verificar(pagina.get_attribute(".alt-marcada", "data-original") == str(outra), "pode trocar a resposta")
            pagina.click(f'[data-acao="escolher"][data-original="{respostas[0]}"]')
            fotos_claro_escuro(pagina, "09-simulado-questao")
        if n == 5:
            pagina.click('[data-acao="revisar"]')
            verificar("ativo" in pagina.get_attribute('[data-acao="revisar"]', "class"), "marcar para revisar")
        pagina.click('[data-acao="proxima"]')
        pagina.wait_for_selector(f'article.simulado[data-numero="{n + 2}"]')

    # Tempo só corre com o app visível
    pagina.wait_for_timeout(1200)
    pagina.evaluate(SIMULAR_VISIBILIDADE, "hidden")
    antes = ler_loja(pagina, "andamento")[0]["tempoMs"]
    pagina.wait_for_timeout(2500)
    depois = ler_loja(pagina, "andamento")[0]["tempoMs"]
    relogio_parado = pagina.inner_text("#relogio-valor")
    pagina.wait_for_timeout(1100)
    verificar(depois == antes and pagina.inner_text("#relogio-valor") == relogio_parado,
              "cronômetro pausa com o app escondido e salva ao esconder")
    pagina.evaluate(SIMULAR_VISIBILIDADE, "visible")
    pagina.wait_for_timeout(1100)
    verificar(pagina.inner_text("#relogio-valor") != relogio_parado, "cronômetro volta a correr")

    # Escrita sobre a questão no simulado é salva junto do simulado
    abrir_escrita_sobre(pagina)
    pagina.mouse.move(100, 300)
    pagina.mouse.down()
    pagina.mouse.move(250, 350)
    pagina.mouse.up()
    pagina.click('[data-rs="fechar"]')
    qid_rascunho = qid_atual(pagina)
    pagina.wait_for_timeout(600)

    # Sair no meio e voltar depois de recarregar
    ir(pagina, "#/", ".inicio")
    verificar(pagina.locator(".cartao-continuar").count() == 1, "início mostra 'Continuar simulado'")
    fotos_claro_escuro(pagina, "10-inicio-continuar")
    pagina.reload()
    pagina.wait_for_selector(".cartao-continuar")
    pagina.click(".cartao-continuar")
    pagina.wait_for_selector("article.simulado")
    verificar(pagina.get_attribute("article.simulado", "data-numero") == "41", "continua na questão 41 após recarregar")
    sim = ler_loja(pagina, "andamento")[0]
    verificar(sum(1 for i in sim["itens"] if i["escolhida"] is not None) == 40, "40 respostas preservadas")
    verificar(sim["tempoMs"] > 1000, f"tempo preservado ({sim['tempoMs']:.0f} ms)")
    verificar(len(sim["escrita"]["sobre"].get(qid_rascunho, [])) == 1, "escrita sobre a questão salva no IndexedDB")
    abrir_escrita_sobre(pagina)
    verificar(pagina.evaluate(PIXELS_DESENHADOS) > 0, "escrita sobre a questão volta depois de recarregar")
    pagina.click('[data-rs="fechar"]')

    # Grade com os 80 números
    pagina.click('[data-acao="grade"]')
    pagina.wait_for_selector(".folha[open]")
    verificar(pagina.locator(".folha-linha").count() == 80, "folha de respostas com 80 linhas")
    verificar(pagina.locator(".folha-linha.respondida").count() == 40 and pagina.locator(".folha-linha.marcada").count() == 1,
              "folha mostra respondidas e marcadas")
    verificar(pagina.locator(".folha-area").count() == 4, "folha separada pelas 4 áreas")
    fotos_claro_escuro(pagina, "11-folha-respostas")
    pagina.click('.folha [data-acao="entregar"]')
    pagina.wait_for_selector(".dialogo[open]")
    verificar("40 questões estão em branco" in pagina.inner_text(".dialogo"), "confirmação mostra quantas em branco")
    pagina.click('.dialogo button[value="nao"]')
    pagina.wait_for_selector("article.simulado")
    pagina.click('[data-acao="grade"]')
    pagina.wait_for_selector(".folha[open]")
    pagina.click('.folha-linha[data-indice="40"]')
    pagina.wait_for_selector('article.simulado[data-numero="41"]')

    for n in range(40, 80):
        responder_atual(n)
        if n < 79:
            pagina.click('[data-acao="proxima"]')
            pagina.wait_for_selector(f'article.simulado[data-numero="{n + 2}"]')
    verificar(pagina.locator('.barra-simulado [data-acao="entregar"]').count() == 1, "última questão mostra 'Entregar'")
    pagina.click('.barra-simulado [data-acao="entregar"]')
    pagina.wait_for_selector(".dialogo[open]")
    verificar("Todas as questões estão respondidas" in pagina.inner_text(".dialogo"), "confirmação sem brancos")
    pagina.click('.dialogo button[value="sim"]')
    pagina.wait_for_selector(".tela-resultado .nota")
    verificar(not ler_loja(pagina, "andamento"), "simulado em andamento apagado após entregar")
    sessoes = ler_loja(pagina, "sessoes")
    verificar(len(sessoes) == 1 and sessoes[0]["acertos"] == acertos_esperados,
              f"nota correta: {sessoes[0]['acertos'] if sessoes else '?'} = {acertos_esperados}")
    tentativas = [t for t in ler_loja(pagina, "tentativas") if t["modo"] == "simulado"]
    verificar(len(tentativas) == 80, "80 tentativas de modo 'simulado' no histórico")
    return sessoes[0]


def testar_resultado(pagina, sessao):
    secao("Resultado, feedback da prova e relatório")
    nota = pagina.inner_text(".nota-valor").replace("\n", "")
    verificar(nota == f"{sessao['acertos']}/80", f"nota exibida {nota}")
    analise = pagina.inner_text(".analise")
    for trecho in ("Pontos fortes", "Pontos fracos", "Erros por nível", "Gestão do tempo", "O que estudar a seguir"):
        verificar(trecho in analise, f"feedback contém '{trecho}'")
    verificar(pagina.locator(".recomendacoes li").count() == 3, "3 recomendações")
    verificar(pagina.locator(".lista-resultado li").count() == 80, "lista com as 80 questões")
    fotos_claro_escuro(pagina, "12-resultado")
    foto(pagina, "12-resultado-inteira-claro", pagina_inteira=True)
    pagina.click('[data-acao="copiar"]')
    pagina.wait_for_selector("#aviso.visivel")
    relatorio = pagina.evaluate("navigator.clipboard.readText()")
    erradas = [i["qid"] for i in sessao["itens"] if not i["acertou"]]
    verificar(relatorio.startswith("Simulado Fuvest 1ª fase") and f"Nota: {sessao['acertos']}/80" in relatorio,
              "relatório copiado com a nota")
    verificar(all(qid in relatorio for qid in erradas) and "Por matéria:" in relatorio and "Temas errados:" in relatorio,
              "relatório traz matérias, temas errados e ids")
    (TELAS / "relatorio-exemplo.txt").write_text(relatorio, encoding="utf-8")

    pagina.click(".lr-linha.errada >> nth=0")
    pagina.wait_for_selector("article.questao.respondida")
    verificar(pagina.locator(".alt-errada").count() == 1 and pagina.locator(".explicacao").count() == 1,
              "questão do simulado abre em revisão com explicação")
    numero = int(pagina.inner_text(".q-numero"))
    pagina.click('.barra-simulado [aria-label="Próxima questão"]')
    pagina.wait_for_function(f"document.querySelector('.q-numero')?.textContent === '{numero + 1}'")
    verificar(True, "navegação entre questões na revisão do simulado")
    fotos_claro_escuro(pagina, "13-revisao-simulado")
    pagina.click('.barra-simulado a:has-text("Resultado")')
    pagina.wait_for_selector(".tela-resultado .nota")
    verificar(True, "voltar ao resultado")


def testar_historico(pagina):
    secao("Histórico")
    ir(pagina, "#/historico", ".historico")
    verificar(pagina.locator(".cartao-simulado").count() == 1, "simulado listado")
    fotos_claro_escuro(pagina, "14-historico-simulados")
    pagina.click('.aba[data-aba="desempenho"]')
    pagina.wait_for_selector(".painel-aba .lista-materias")
    taxas = pagina.eval_on_selector_all(".secao:first-of-type .linha-materia .lm-valor",
                                        "vs => vs.map(v => { const [a, t] = v.textContent.split('/').map(Number); return a / t; })")
    verificar(taxas == sorted(taxas), "matérias do pior para o melhor")
    fotos_claro_escuro(pagina, "15-historico-desempenho")
    pagina.click('.aba[data-aba="tentativas"]')
    pagina.wait_for_selector(".lista-tentativas")
    tentativas = ler_loja(pagina, "tentativas")
    verificar(f"{len(tentativas)} tentativas" in pagina.inner_text(".contagem-filtro"), f"lista com as {len(tentativas)} tentativas")
    # Matéria com acertos e erros, para o filtro "só erradas" ter o que esconder e o que mostrar.
    resultados_por_materia = {}
    for t in tentativas:
        resultados_por_materia.setdefault(t["materia"], set()).add(t["acertou"])
    materia = next(m for m, r in resultados_por_materia.items() if r == {True, False})
    pagina.select_option("select[name=materia]", materia)
    pagina.wait_for_function(f"location.hash.includes('materia={materia}')")
    materias = pagina.eval_on_selector_all(".lt-materia", "ms => [...new Set(ms.map(m => m.textContent))]")
    verificar(len(materias) == 1, f"filtro por matéria ({materias})")
    pagina.click("label.interruptor-compacto")
    pagina.wait_for_function("location.hash.includes('erradas=1')")
    pagina.wait_for_function("!document.querySelector('.lt-linha.certa')", timeout=5000)
    verificar(pagina.locator(".lt-linha.certa").count() == 0 and pagina.locator(".lt-linha.errada").count() > 0, "filtro só erradas")
    fotos_claro_escuro(pagina, "16-historico-tentativas")
    pagina.click(".lt-linha >> nth=0")
    pagina.wait_for_selector("article.questao.respondida")
    verificar(pagina.locator(".alt-errada").count() == 1, "tentativa abre em revisão")


def testar_backup(pagina, pasta):
    secao("Exportar, apagar e importar")
    ir(pagina, "#/ajustes", ".ajustes")
    fotos_claro_escuro(pagina, "17-ajustes")
    tentativas_antes = len(ler_loja(pagina, "tentativas"))
    with pagina.expect_download() as info:
        pagina.click('[data-acao="exportar"]')
    arquivo = pasta / "backup.json"
    info.value.save_as(arquivo)
    dados = json.loads(arquivo.read_text(encoding="utf-8"))
    verificar(dados["formato"] == "fuvest-app-backup" and len(dados["tentativas"]) == tentativas_antes
              and len(dados["sessoes"]) == 1, f"exportou {tentativas_antes} tentativas e 1 simulado")

    pagina.click('[data-acao="apagar"]')
    pagina.click('.dialogo button[value="sim"]')
    pagina.wait_for_selector(".dialogo[open] >> text=Tem certeza?")
    pagina.click('.dialogo button[value="sim"]')
    pagina.wait_for_function("document.querySelector('#aviso').textContent.includes('apagado')")
    verificar(len(ler_loja(pagina, "tentativas")) == 0 and len(ler_loja(pagina, "sessoes")) == 0,
              "apagar com confirmação dupla limpa tudo")

    pagina.set_input_files("#arquivo-importar", str(arquivo))
    pagina.wait_for_function("document.querySelector('#aviso').textContent.includes('Importado')")
    verificar(len(ler_loja(pagina, "tentativas")) == tentativas_antes and len(ler_loja(pagina, "sessoes")) == 1,
              "importar restaura tudo")
    pagina.set_input_files("#arquivo-importar", str(arquivo))
    pagina.wait_for_function("document.querySelector('#aviso').textContent.includes('0 tentativas novas')")
    verificar(len(ler_loja(pagina, "tentativas")) == tentativas_antes, "importar de novo não duplica")
    invalido = pasta / "invalido.json"
    invalido.write_text('{"x": 1}', encoding="utf-8")
    pagina.set_input_files("#arquivo-importar", str(invalido))
    pagina.wait_for_function("document.querySelector('#aviso').textContent.includes('não é um backup')")
    verificar(True, "arquivo inválido é recusado com mensagem clara")


def testar_tema(pagina):
    secao("Tema")
    ir(pagina, "#/ajustes", ".ajustes")
    fundo = lambda: pagina.evaluate("getComputedStyle(document.body).backgroundColor")  # noqa: E731
    claro = fundo()
    pagina.click('#escolha-tema label:has(input[value=escuro])')
    verificar(pagina.evaluate("document.documentElement.dataset.tema") == "escuro" and fundo() != claro, "tema escuro aplicado")
    foto(pagina, "18-ajustes-tema-escuro-forcado")
    pagina.reload()
    pagina.wait_for_selector(".ajustes")
    verificar(pagina.evaluate("document.documentElement.dataset.tema") == "escuro", "tema escolhido persiste")
    pagina.click('#escolha-tema label:has(input[value=claro])')
    pagina.emulate_media(color_scheme="dark")
    verificar(fundo() == claro, "tema claro forçado ignora o sistema escuro")
    pagina.click('#escolha-tema label:has(input[value=auto])')
    verificar(fundo() != claro, "automático segue o sistema")
    pagina.emulate_media(color_scheme="light")


def testar_offline(pagina, contexto):
    secao("Offline depois do primeiro carregamento")
    contexto.set_offline(True)
    ir(pagina, "#/", ".inicio")
    pagina.reload()
    pagina.wait_for_selector(".inicio")
    verificar(pagina.locator(".numeros").count() == 1, "recarrega offline")
    sem_rede = pagina.evaluate("fetch('./data/questoes.json').then(r => r.json()).then(d => d.questoes.length)")
    verificar(sem_rede == len(QUESTOES), "banco de questões servido pelo cache")
    ir(pagina, "#/filtros", "#form-filtros")
    pagina.click("#botao-comecar")
    pagina.wait_for_selector('[data-acao="escolher"]')
    responder(pagina, certo=True)
    pagina.wait_for_selector(".feedback")
    verificar(True, "prática funciona offline")
    pagina.goto(pagina.url.split("#")[0] + "#/historico")
    pagina.wait_for_selector(".historico")
    verificar(True, "navegação direta para rota funciona offline")
    contexto.set_offline(False)


def testar_nova_versao(pagina):
    secao("Nova versão do service worker")
    cache_antigo = pagina.evaluate("caches.keys()")
    publicar_nova_versao_sw("teste-nova-versao")
    pagina.goto(pagina.url.split("#")[0] + "#/")
    pagina.wait_for_selector(".inicio")
    pagina.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
    pagina.wait_for_selector("#faixa-atualizar", timeout=15_000)
    verificar("Nova versão" in pagina.inner_text("#faixa-atualizar"), "faixa de nova versão aparece")
    foto(pagina, "19-faixa-atualizar-claro")
    with pagina.expect_navigation():
        pagina.click("#faixa-atualizar")
    pagina.wait_for_selector(".inicio")
    pagina.wait_for_function("caches.keys().then(k => k.includes('fuvest-teste-nova-versao'))")
    verificar(pagina.locator("#faixa-atualizar").count() == 0, "tocar atualiza e recarrega")
    verificar(pagina.evaluate("caches.keys()") == ["fuvest-teste-nova-versao"], f"cache antigo apagado ({cache_antigo})")
    verificar(len(ler_loja(pagina, "tentativas")) > 0, "progresso mantido após atualizar")


def testar_sem_indexeddb(url):
    secao("IndexedDB indisponível (armazenamento negado)")
    console = Console()
    with celular() as contexto:
        contexto.add_init_script("Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });")
        pagina = contexto.new_page()
        console.ligar(pagina)
        pagina.goto(url)
        pagina.wait_for_selector(".inicio")
        pagina.click("text=Questões aleatórias")
        pagina.wait_for_selector("#form-filtros")
        pagina.click("#botao-comecar")
        pagina.wait_for_selector('[data-acao="escolher"]')
        responder(pagina, certo=True)
        pagina.wait_for_selector(".feedback")
        verificar(pagina.inner_text(".placar-sessao").replace(" ", "") == "1/1", "prática funciona sem IndexedDB")
        ir(pagina, "#/", ".inicio")
        verificar(pagina.inner_text(".numeros dd >> nth=0") == "1", "progresso em memória durante a sessão")
        ir(pagina, "#/ajustes", ".ajustes")
        verificar("bloqueado" in pagina.inner_text(".lista-dados"), "ajustes avisam que o armazenamento está bloqueado")
    verificar(not console.erros, f"sem erros de console sem IndexedDB {console.erros}")


def main():
    TELAS.mkdir(parents=True, exist_ok=True)
    for antiga in TELAS.glob("[01]?-*.png"):  # 01–19: telas desta suíte (as da folha/zoom ficam)
        antiga.unlink()
    for antiga in TELAS.glob("20-*.png"):
        antiga.unlink()
    console = Console()
    with servidor() as url:
        with celular() as contexto:
            pagina = contexto.new_page()
            console.ligar(pagina)
            cdp = contexto.new_cdp_session(pagina)
            testar_carga(pagina, url)
            testar_escape(pagina)
            testar_todas_as_questoes(pagina)
            testar_pratica(pagina)
            testar_rascunho(pagina, cdp)
            testar_revisar_erros(pagina)
            sessao = testar_simulado(pagina, contexto)
            testar_resultado(pagina, sessao)
            testar_historico(pagina)
            ir(pagina, "#/", ".inicio")
            fotos_claro_escuro(pagina, "20-inicio-com-dados")
            testar_backup(pagina, TELAS)
            testar_tema(pagina)
            testar_offline(pagina, contexto)
            testar_nova_versao(pagina)
        testar_sem_indexeddb(url)
    for temporario in ("backup.json", "invalido.json"):
        (TELAS / temporario).unlink(missing_ok=True)

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
