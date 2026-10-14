// Geometria plana usada pelo desenho e pelos gestos. Pontos são pares [x, y].

export function pontoMedio(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function distancia(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function distanciaAoSegmento(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const comprimento2 = dx * dx + dy * dy;
  const t = comprimento2 === 0 ? 0 : limitar(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / comprimento2, 0, 1);
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}

/** Retângulos {x0, y0, x1, y1} se cruzam? */
export function retangulosSeCruzam(a, b) {
  return a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
}
