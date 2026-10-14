"""Apoio aos testes: servidor HTTP local, contexto de celular e coleta de erros do console."""
import contextlib
import functools
import http.server
import re
import socket
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
TELAS = Path(__file__).resolve().parent / "screens"
VIEWPORT = {"width": 412, "height": 915}
ESCALA = 2.625  # Pixel 7 / Galaxy típico


class ServidorSilencioso(http.server.SimpleHTTPRequestHandler):
    """Serve a raiz do repositório. `versao_sw` permite simular a publicação de
    uma nova versão do service worker sem tocar no arquivo em disco."""

    versao_sw = None

    def log_message(self, *args):
        pass

    def end_headers(self):
        # Sem cache HTTP: o teste exercita só o cache do service worker.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/sw.js" and ServidorSilencioso.versao_sw:
            texto = (RAIZ / "sw.js").read_text(encoding="utf-8")
            texto = re.sub(r'const VERSAO = "[^"]*";', f'const VERSAO = "{ServidorSilencioso.versao_sw}";', texto)
            corpo = texto.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(corpo)))
            self.end_headers()
            self.wfile.write(corpo)
            return
        super().do_GET()


def publicar_nova_versao_sw(versao):
    ServidorSilencioso.versao_sw = versao


def porta_livre():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@contextlib.contextmanager
def servidor():
    ServidorSilencioso.versao_sw = None
    porta = porta_livre()
    manipulador = functools.partial(ServidorSilencioso, directory=str(RAIZ))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", porta), manipulador)
    fio = threading.Thread(target=httpd.serve_forever, daemon=True)
    fio.start()
    try:
        yield f"http://127.0.0.1:{porta}/"
    finally:
        httpd.shutdown()


class Console:
    """Guarda erros de console e exceções não tratadas da página."""

    def __init__(self):
        self.erros = []

    def ligar(self, pagina):
        pagina.on("console", self._ao_console)
        pagina.on("pageerror", lambda erro: self.erros.append(f"pageerror: {erro}"))

    def _ao_console(self, msg):
        if msg.type == "error":
            self.erros.append(f"console.error: {msg.text}")


@contextlib.contextmanager
def celular(esquema="light", headless=True):
    with sync_playwright() as p:
        navegador = p.chromium.launch(headless=headless)
        contexto = navegador.new_context(
            viewport=VIEWPORT,
            device_scale_factor=ESCALA,
            is_mobile=True,
            has_touch=True,
            color_scheme=esquema,
            locale="pt-BR",
            permissions=["clipboard-read", "clipboard-write"],
            accept_downloads=True,
        )
        try:
            yield contexto
        finally:
            contexto.close()
            navegador.close()


def foto(pagina, nome, pagina_inteira=False):
    TELAS.mkdir(parents=True, exist_ok=True)
    caminho = TELAS / f"{nome}.png"
    pagina.screenshot(path=str(caminho), full_page=pagina_inteira)
    return caminho
