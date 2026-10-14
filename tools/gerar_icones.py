"""Gera os ícones do app (icons/*.png) com PIL.

Desenho: um "F" geométrico em branco sobre azul-caneta; o braço do meio do F
termina numa bolha preenchida, como a marcação do cartão-resposta.

Uso: python3 tools/gerar_icones.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
PASTA = RAIZ / "icons"
AZUL = (35, 70, 168)
BRANCO = (255, 255, 255)
SUPERAMOSTRAGEM = 4
ZONA_SEGURA_MASKABLE = 0.62  # o desenho ocupa 62% do lado (cabe no círculo de 80%)
OCUPACAO_NORMAL = 0.70
RAIO_CANTO_NORMAL = 0.22


def desenhar_f(desenho, origem, lado):
    """F inscrito num quadrado de `lado` px começando em `origem`."""
    x0, y0 = origem
    u = lado / 10  # módulo da grade
    raio = u * 0.55
    haste = (x0 + 1.6 * u, y0, x0 + 3.6 * u, y0 + 10 * u)
    topo = (x0 + 1.6 * u, y0, x0 + 9.0 * u, y0 + 2.0 * u)
    meio = (x0 + 1.6 * u, y0 + 4.2 * u, x0 + 5.6 * u, y0 + 6.2 * u)
    for retangulo in (haste, topo, meio):
        desenho.rounded_rectangle(retangulo, radius=raio, fill=BRANCO)
    centro = (x0 + 7.6 * u, y0 + 5.2 * u)
    r = 1.25 * u
    desenho.ellipse((centro[0] - r, centro[1] - r, centro[0] + r, centro[1] + r), fill=BRANCO)


def gerar(tamanho, maskable):
    grande = tamanho * SUPERAMOSTRAGEM
    imagem = Image.new("RGBA", (grande, grande), (0, 0, 0, 0))
    desenho = ImageDraw.Draw(imagem)
    if maskable:
        desenho.rectangle((0, 0, grande, grande), fill=AZUL)
        ocupacao = ZONA_SEGURA_MASKABLE
    else:
        desenho.rounded_rectangle((0, 0, grande - 1, grande - 1), radius=grande * RAIO_CANTO_NORMAL, fill=AZUL)
        ocupacao = OCUPACAO_NORMAL
    lado = grande * ocupacao
    margem = (grande - lado) / 2
    desenhar_f(desenho, (margem - lado * 0.04, margem), lado)
    return imagem.resize((tamanho, tamanho), Image.LANCZOS)


def main():
    PASTA.mkdir(exist_ok=True)
    gerar(192, maskable=False).save(PASTA / "icon-192.png", optimize=True)
    gerar(512, maskable=False).save(PASTA / "icon-512.png", optimize=True)
    gerar(512, maskable=True).save(PASTA / "maskable-512.png", optimize=True)
    print("Ícones gerados em", PASTA)


if __name__ == "__main__":
    main()
