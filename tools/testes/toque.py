"""Gestos de toque reais via CDP (Input.dispatchTouchEvent), com um ou dois dedos."""


def _interpolar(a, b, passos):
    return [(a[0] + (b[0] - a[0]) * k / passos, a[1] + (b[1] - a[1]) * k / passos) for k in range(1, passos + 1)]


def _numero_de_passos(a, b, passo_px):
    return max(1, int(max(abs(b[0] - a[0]), abs(b[1] - a[1])) / passo_px))


class Toque:
    def __init__(self, pagina, contexto):
        self.pagina = pagina
        self.cdp = contexto.new_cdp_session(pagina)

    def _enviar(self, tipo, pontos):
        self.cdp.send("Input.dispatchTouchEvent", {
            "type": tipo,
            "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pontos)],
        })

    def arrastar(self, pontos, passo_px=10, espera_ms=50):
        """Um dedo pelos pontos, com movimentos intermediários a cada `passo_px`."""
        self._enviar("touchStart", [pontos[0]])
        for a, b in zip(pontos, pontos[1:]):
            for p in _interpolar(a, b, _numero_de_passos(a, b, passo_px)):
                self._enviar("touchMove", [p])
        self._enviar("touchEnd", [])
        self.pagina.wait_for_timeout(espera_ms)

    def tocar(self, ponto, espera_ms=30):
        self._enviar("touchStart", [ponto])
        self._enviar("touchEnd", [])
        self.pagina.wait_for_timeout(espera_ms)

    def dois_dedos(self, inicio_a, inicio_b, fim_a, fim_b, passos=12, espera_ms=80):
        """Dois dedos de (inicio_a, inicio_b) até (fim_a, fim_b): pinça e/ou pan."""
        self._enviar("touchStart", [inicio_a])
        self._enviar("touchStart", [inicio_a, inicio_b])
        trajeto_a = _interpolar(inicio_a, fim_a, passos)
        trajeto_b = _interpolar(inicio_b, fim_b, passos)
        for a, b in zip(trajeto_a, trajeto_b):
            self._enviar("touchMove", [a, b])
        self._enviar("touchEnd", [fim_a])
        self._enviar("touchEnd", [])
        self.pagina.wait_for_timeout(espera_ms)

    def pinca(self, centro, distancia_inicial, distancia_final, passos=12):
        """Pinça horizontal em torno de `centro` (afastar = ampliar)."""
        cx, cy = centro
        di, df = distancia_inicial / 2, distancia_final / 2
        self.dois_dedos((cx - di, cy), (cx + di, cy), (cx - df, cy), (cx + df, cy), passos)
