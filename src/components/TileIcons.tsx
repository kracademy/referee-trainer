/** Iconos pequeños estilo SF Symbols para los tiles de estadísticas (sustituyen a los emojis). */

const base = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const TI = {
  /** llama (racha) */
  flame: (
    <svg {...base}>
      <path d="M12 21c-3.7 0-6.3-2.5-6.3-6 0-2.5 1.6-4.4 2.9-6.2C9.8 7.2 11 5.6 11.3 3.4c2.7 1.5 3.4 3.9 3.2 5.9 1.1-.3 1.9-1 2.3-2.1 1.1 1.6 1.5 3.3 1.5 4.8 0 3.5-2.6 6-6.3 6z" />
    </svg>
  ),
  /** diana (precisión) */
  target: (
    <svg {...base}>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  /** claqueta de vídeo (actuaciones listas) */
  clapper: (
    <svg {...base}>
      <rect x="3.4" y="8.6" width="17.2" height="11" rx="2.4" />
      <path d="M3.8 8.6 20 5l.6 2.6-16.2 3.6z" />
      <path d="M8 5.9 10.2 8M12.4 4.9l2.2 2.1M16.8 4l2.2 2.1" />
    </svg>
  ),
  /** aviso (errores pendientes) */
  alert: (
    <svg {...base}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7.4v5.4" />
      <circle cx="12" cy="16.3" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  /** carrete (clips) */
  film: (
    <svg {...base}>
      <rect x="4" y="4.6" width="16" height="14.8" rx="2.6" />
      <path d="M8.4 4.8v14.4M15.6 4.8v14.4M4.4 9.4h3.8M4.4 14.6h3.8M15.8 9.4h3.8M15.8 14.6h3.8" />
    </svg>
  ),
  /** balanza (polémicas) */
  scale: (
    <svg {...base}>
      <path d="M12 4.6v14.8M7.6 19.4h8.8" />
      <path d="M5.4 7.2h13.2" />
      <path d="M5.4 7.2 3 13.2c1 1 3.8 1 4.8 0zM18.6 7.2l-2.4 6c1 1 3.8 1 4.8 0z" />
    </svg>
  ),
  /** marcador de página (repaso) */
  bookmark: (
    <svg {...base}>
      <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z" />
    </svg>
  ),
  /** dos personas (combates) */
  duo: (
    <svg {...base}>
      <circle cx="8.4" cy="8" r="2.6" />
      <path d="M3.6 19c.4-3.4 2.3-5.4 4.8-5.4S12.8 15.6 13.2 19" />
      <circle cx="16.6" cy="7.2" r="2.1" />
      <path d="M14.9 12.4c.6-.4 1.1-.6 1.7-.6 2.1 0 3.7 1.7 4 4.6" />
    </svg>
  ),
  /** mano abierta (agarres) */
  palm: (
    <svg {...base}>
      <path d="M7.7 11.2V6.6a1.05 1.05 0 0 1 2.1 0v3.8" />
      <path d="M9.8 9.8V4.9a1.05 1.05 0 0 1 2.1 0v4.7" />
      <path d="M11.9 9.6V5.7a1.05 1.05 0 0 1 2.1 0v4.5" />
      <path d="M14 10.2V7.4a1.05 1.05 0 0 1 2.1 0v4.8c0 3.9-2 6.5-5.1 6.5-2.4 0-3.7-1.2-5.3-4l-1-1.7c-.4-.7-.2-1.4.4-1.8.6-.4 1.3-.2 1.8.4l.8 1.1" />
    </svg>
  ),
  /** salida del área (jogai) */
  exit: (
    <svg {...base}>
      <path d="M14.5 8V6.6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10.8a2 2 0 0 0 2 2h6.5a2 2 0 0 0 2-2V16" />
      <path d="M9.6 12h10.4" />
      <path d="M17 9l3 3-3 3" />
    </svg>
  ),
  /** impacto (mubobi / contacto) */
  burst: (
    <svg {...base}>
      <circle cx="12" cy="12" r="2.7" />
      <path d="M12 4.2v2.5M12 17.3v2.5M4.2 12h2.5M17.3 12h2.5M6.5 6.5l1.8 1.8M15.7 15.7l1.8 1.8M17.5 6.5l-1.8 1.8M8.3 15.7l-1.8 1.8" />
    </svg>
  ),
  /** megáfono (exagerar) */
  mega: (
    <svg {...base}>
      <path d="M4.2 10.4v3.2c0 .7.5 1.2 1.2 1.2h2.1l6.6 3.6c.8.5 1.9-.1 1.9-1.1V6.7c0-1-1.1-1.6-1.9-1.1L7.5 9.2H5.4c-.7 0-1.2.5-1.2 1.2z" />
      <path d="M18.7 9.3a3.8 3.8 0 0 1 0 5.4" />
    </svg>
  ),
  /** máscara (simular lesión) */
  mask: (
    <svg {...base}>
      <path d="M5 5.4c2.3.9 4.6 1.3 7 1.3s4.7-.4 7-1.3v6.4c0 4.6-3 7.8-7 7.8s-7-3.2-7-7.8z" />
      <circle cx="9.2" cy="10.8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="10.8" r="0.9" fill="currentColor" stroke="none" />
      <path d="M9.2 15.8c.9-.9 1.8-1.3 2.8-1.3s1.9.4 2.8 1.3" />
    </svg>
  ),
  /** giro (proyecciones y barridos) */
  rotate: (
    <svg {...base}>
      <path d="M19.2 12a7.2 7.2 0 1 1-2.2-5.2" />
      <path d="M17.8 3.2v3.9h-3.9" />
    </svg>
  ),
  /** media vuelta (evitar combate) */
  uturn: (
    <svg {...base}>
      <path d="M8.6 7.6 5 11.2l3.6 3.6" />
      <path d="M5 11.2h9.3a4.5 4.5 0 0 1 0 9H9.6" />
    </svg>
  ),
  /** lista (intentos) */
  list: (
    <svg {...base}>
      <path d="M8.8 6.4h10.8M8.8 12h10.8M8.8 17.6h10.8" />
      <circle cx="4.8" cy="6.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.8" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.8" cy="17.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
};
