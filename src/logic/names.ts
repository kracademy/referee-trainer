import type { Athlete } from '../db/types';

/** Nombre para mostrar: "Nombre Apellidos" si está desglosado; si no, tal cual viene de SportData. */
export function athleteName(a?: Athlete | null): string {
  if (!a) return '';
  if (a.firstName && a.lastName) return `${a.firstName} ${a.lastName}`;
  return a.firstName || a.displayName;
}
