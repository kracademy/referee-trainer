import type { CSSProperties } from 'react';

/** Cámara de un vídeo en mosaico 2×2 (retransmisiones RFEK con cuatro tatamis a la vez). */
export type Camera = 'TL' | 'TR' | 'BL' | 'BR';

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
};

export const CAMERA_LABELS: Record<Camera, string> = {
  TL: 'Arriba izquierda',
  TR: 'Arriba derecha',
  BL: 'Abajo izquierda',
  BR: 'Abajo derecha',
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
