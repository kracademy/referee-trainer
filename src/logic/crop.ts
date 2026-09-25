import type { CSSProperties } from 'react';

/**
 * Cámara de un vídeo en mosaico (retransmisiones RFEK).
 * TL/TR/BL/BR: mosaico de 4 tatamis (2×2). T3/BL3/BR3: mosaico de 3 (uno arriba centrado, dos abajo).
 */
export type Camera = 'TL' | 'TR' | 'BL' | 'BR' | 'T3' | 'BL3' | 'BR3';

export interface CropRect {
  /** Fracciones (0–1) del fotograma completo. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Recuadros medidos sobre el mosaico de la RFEK (hay márgenes y un logo en el centro,
 * así que no son cuartos exactos). Cada recuadro mantiene la proporción 16:9.
 */
export const CAMERA_RECTS: Record<Camera, CropRect> = {
  TL: { x: 0.028, y: 0.024, w: 0.448, h: 0.455 },
  TR: { x: 0.524, y: 0.024, w: 0.448, h: 0.455 },
  BL: { x: 0.028, y: 0.49, w: 0.448, h: 0.455 },
  BR: { x: 0.524, y: 0.49, w: 0.448, h: 0.455 },
  // mosaico de 3 (medido sobre Córdoba 2024, tatamis 1-3-5)
  T3: { x: 0.275, y: 0.022, w: 0.4525, h: 0.4525 },
  BL3: { x: 0.025, y: 0.527, w: 0.4525, h: 0.4525 },
  BR3: { x: 0.525, y: 0.527, w: 0.4525, h: 0.4525 },
};

export const CAMERA_LABELS: Record<Camera, string> = {
  TL: 'Arriba izquierda',
  TR: 'Arriba derecha',
  BL: 'Abajo izquierda',
  BR: 'Abajo derecha',
  T3: 'Arriba (3 cámaras)',
  BL3: 'Abajo izquierda (3 cámaras)',
  BR3: 'Abajo derecha (3 cámaras)',
};

/**
 * Estilo para el elemento que pinta el vídeo (iframe de YouTube o <video>) dentro de un
 * contenedor con overflow hidden: lo agranda y lo desplaza para que el recuadro llene el marco.
 */
export function cropStyle(r?: CropRect): CSSProperties | undefined {
  if (!r) return undefined;
  return {
    position: 'absolute',
    left: `${(-r.x / r.w) * 100}%`,
    top: `${(-r.y / r.h) * 100}%`,
    width: `${100 / r.w}%`,
    height: `${100 / r.h}%`,
    right: 'auto',
    bottom: 'auto',
    maxWidth: 'none',
  };
}
