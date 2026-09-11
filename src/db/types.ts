// Modelo de datos — Kracademy Kata Trainer
// Convención: el competidor de arriba del bracket es AKA (rojo), el de abajo AO (azul).

export type CompetitionType =
  | 'WORLD_CHAMPIONSHIP'
  | 'CONTINENTAL_CHAMPIONSHIP'
  | 'PREMIER_LEAGUE'
  | 'SERIES_A'
  | 'WORLD_CUP'
  | 'OTHER';

export type Continent = 'EUROPE' | 'PANAMERICA' | 'ASIA' | 'AFRICA' | 'OCEANIA' | 'WORLD';

export type RoundType = 'FINAL' | 'BRONZE_1' | 'BRONZE_2' | 'OTHER';

/** Formato de la fase de la que procede el encuentro (reglas WKF, Art. 3.3). */
export type PhaseFormat = 'ELIMINATION' | 'ROUND_ROBIN' | 'POOLWINNER_TREE' | 'REPECHAGE';

export type Winner = 'AKA' | 'AO';

export type OfficialResultType =
  | 'AKA_WINS'
  | 'AO_WINS'
  | 'AKA_DISQUALIFIED'
  | 'AO_DISQUALIFIED'
  | 'BOTH_DISQUALIFIED'
  | 'OTHER';

export type CatalogStatus =
  | 'MISSING_DATA'
  | 'DATA_IMPORTED'
  | 'VIDEO_MISSING'
  | 'VIDEO_CATALOGUED'
  | 'READY';

export type VideoAvailability = 'UNKNOWN' | 'AVAILABLE' | 'UNAVAILABLE';

export interface Competition {
  id: string; // p. ej. 'wkf-worlds-2025-cairo'
  name: string;
  year: number;
  dateStart?: string; // ISO
  dateEnd?: string;
  location?: string;
  country?: string; // código 3 letras
  competitionType: CompetitionType;
  continent?: Continent;
  tier: 1 | 2 | 3; // 1 = Worlds/Continentales, 2 = Premier League, 3 = Series A
  sportDataEventId?: number; // vernr
  sportDataUrl?: string;
  source?: string;
  notes?: string;
  /** Vídeos candidatos del canal de YouTube de la WKF (pestaña Live) para precargar en Catalogar. */
  candidateVideos?: { id: string; title: string }[];
}

export interface Category {
  id: string; // p. ej. 'senior-female-kata'
  name: string; // 'Senior Female Kata'
  gender: 'FEMALE' | 'MALE';
  discipline: 'KATA'; // KUMITE en el futuro
  ageGroup: 'SENIOR' | 'U21';
  /** Kata individual o Team Kata. */
  format?: 'INDIVIDUAL' | 'TEAM';
  sportDataCatId?: number; // catid estable: 36 = Female Kata, 37 = Male Kata
}

export interface Athlete {
  id: string; // slug p. ej. 'lau-mo-sheung-grace-hkg'
  firstName?: string;
  lastName?: string;
  displayName: string; // como aparece en SportData
  country: string; // nombre
  countryCode: string; // 3 letras
  sportDataId?: string;
  notes?: string;
}

export interface Video {
  id: string; // youtube videoId
  platform: 'YOUTUBE';
  url: string;
  title?: string;
  durationSeconds?: number;
  availabilityStatus: VideoAvailability;
  lastChecked?: string;
  notes?: string;
}

/** Un encuentro (bout) de Kata: AKA vs AO. */
export interface Performance {
  id: string; // p. ej. 'wkf-worlds-2025-cairo_senior-female-kata_final'
  competitionId: string;
  categoryId: string;
  roundType: RoundType;
  roundLabel?: string; // etiqueta original de SportData, p. ej. 'Poolwinner Tree - Round 4'
  phaseFormat?: PhaseFormat;
  matchNumber?: number;

  akaAthleteId: string;
  aoAthleteId: string;
  kataAka?: string; // p. ej. 'Chatanyara Kushanku'
  kataAkaNumber?: number; // número de la lista oficial WKF, p. ej. 8
  kataAo?: string;
  kataAoNumber?: number;

  officialWinner: Winner;
  officialResultType: OfficialResultType;
  /** Total oficial (sistema 2023–2025), p. ej. 46.10. */
  officialScoreAka?: number;
  officialScoreAo?: number;
  /** Nº de jueces cuyo total se muestra (5 eliminatorias, 7 round-robin). Para la media. */
  judgesCount?: number;
  /** Sistema 2026: votos por mayoría, p. ej. { aka: 3, ao: 4 }. */
  judgeVotes?: { aka: number; ao: number };
  /** Puntuaciones individuales de jueces si constan (sistema antiguo). */
  judgeScoresAka?: number[];
  judgeScoresAo?: number[];

  videoId?: string;
  /** Segundos dentro del vídeo. */
  startSeconds?: number;
  endSeconds?: number;
  /** Sub-clips por atleta (opcional): permiten entrenar AKA y AO por separado y el modo estudio de katas. */
  akaStartSeconds?: number;
  akaEndSeconds?: number;
  aoStartSeconds?: number;
  aoEndSeconds?: number;

  /** Resultado ajustado/controvertido (marcado a mano o votos 4–3): se avisa en el reveal para no dudar de uno mismo. */
  closeResult?: boolean;
  /** Nota escrita por el usuario en Catalogar (independiente de `notes`, que las cura el dataset). */
  userNote?: string;
  /** Encuentro que salió en exámenes EKF/WKF de otros años: entrenable aparte (incluso sin vídeo, de memoria). */
  formerExam?: boolean;
  /** En qué exámenes salió y en qué posición (p. ej. [{exam:'EKF 25', order:6}]). */
  examAppearances?: { exam: string; order: number }[];
  /** Vídeo distinto para la actuación de AO (en exámenes a veces cada atleta viene de un vídeo). */
  aoVideoId?: string;
  /** Marcado por el usuario para la lista de repaso (igualado, discrepo de los jueces, quiero verlo con otros...). */
  review?: boolean;
  reviewNote?: string;
  reviewAt?: string;

  status: CatalogStatus;
  sportDataUrl?: string;
  notes?: string;
}

/** Votos con margen de 1 (4–3, 3–2…): resultado ajustado automático. */
export function isCloseResult(p: Pick<Performance, 'closeResult' | 'judgeVotes'>): boolean {
  if (p.closeResult) return true;
  return p.judgeVotes != null && Math.abs(p.judgeVotes.aka - p.judgeVotes.ao) === 1;
}

/** Un intento del usuario sobre una Performance. */
export interface Attempt {
  id?: number; // autoincrement
  performanceId: string;
  userId: string; // 'local-user'
  attemptedAt: string; // ISO
  selectedWinner: Winner;
  selectedResultType?: OfficialResultType;
  /** Puntuación opcional del usuario por atleta (media por juez, escala 5.0–10.0). */
  userScoreAka?: number;
  userScoreAo?: number;
  isCorrectWinner: boolean;
  /** Desviación respecto a la media oficial por juez (si hay datos). */
  scoreDeviationAka?: number;
  scoreDeviationAo?: number;
  isFirstAttempt: boolean;
  completed: boolean;
  notes?: string;
}

/** Media oficial por juez, p. ej. 43.30 / 5 = 8.66. */
export function officialAverage(total: number | undefined, judgesCount = 5): number | undefined {
  if (total == null || judgesCount <= 0) return undefined;
  return Math.round((total / judgesCount) * 100) / 100;
}

/** Dataset publicado en /data/*.json y fusionado en IndexedDB al arrancar. */
export interface DatasetFile {
  schemaVersion: number;
  generatedAt: string;
  competitions: Competition[];
  categories: Category[];
  athletes: Athlete[];
  videos: Video[];
  performances: Performance[];
}

/** Export de la pantalla Catalogar (PC → dataset publicado). */
export interface CatalogExport {
  schemaVersion: number;
  exportedAt: string;
  entries: {
    performanceId: string;
    /** Ausentes cuando la entrada solo transporta marcas (formerExam, ajustado, nota) sin vídeo. */
    videoId?: string;
    startSeconds?: number;
    endSeconds?: number;
    /** Puntuaciones oficiales vistas en el vídeo (cuando SportData no las publica). */
    officialScoreAka?: number;
    officialScoreAo?: number;
    judgesCount?: number;
    /** Sub-clips por atleta. */
    akaStartSeconds?: number;
    akaEndSeconds?: number;
    aoStartSeconds?: number;
    aoEndSeconds?: number;
    /** Resultado ajustado marcado a mano + nota que se muestra tras decidir. */
    closeResult?: boolean;
    note?: string;
    formerExam?: boolean;
  }[];
  /** Encuentros creados a mano por el usuario (p. ej. exámenes EKF/WKF que no están en el dataset). */
  custom?: {
    competitions: Competition[];
    athletes: Athlete[];
    performances: Performance[];
  };
}

// ============================= KUMITE =============================
// Módulo Kumite Trainer: clips de situaciones arbitrales (reglas WKF 2026).

/** Situación de la acción (se pueden combinar varias en un clip). */
export type KumiteSituation =
  | 'PUNTUACION' // ¿es Yuko/Waza-ari/Ippon válido?
  | 'AGARRE' // agarres, clinch, empujar, pecho contra pecho, Wakarete
  | 'PROYECCION' // proyecciones y barridos (punto de pivote, agarre de pierna...)
  | 'JOGAI'
  | 'MUBOBI_CONTACTO' // mubobi / contacto excesivo / contacto en garganta
  | 'EXAGERAR' // exagerar el contacto recibido
  | 'SIMULAR' // simular una lesión
  | 'TECNICA_PROHIBIDA' // ataques a brazos/piernas/ingle, mano abierta a la cara, codo/rodilla/cabeza, patear al caído
  | 'EVITAR_COMBATE' // evitar combate (huir, no dejar puntuar)
  | 'PASIVIDAD' // pasividad (nadie intenta puntuar)
  | 'VR' // revisión de vídeo: ¿dentro del Ato Shibaraku? ¿antes o después del final?
  | 'LESION' // gestión de lesión / regla de los 10 segundos
  | 'ETIQUETA'; // descortés / Shikkaku

/** Lo que da (o no da) el árbitro central tras la acción. */
export type KumiteCall =
  | 'NO_ACTION' // sigue el combate / no da nada
  | 'YUKO'
  | 'WAZA_ARI'
  | 'IPPON'
  | 'CHUI'
  | 'HANSOKU_CHUI'
  | 'HANSOKU'
  | 'SHIKKAKU'
  | 'WAKARETE'
  | 'TSUZUKETE' // aviso informal de actividad
  | 'SENSHU_TORIMASEN'; // anulación del Senshu

export type KumiteSide = 'AKA' | 'AO' | 'NONE';

/** Un clip de kumite: la acción hasta el YAME y, opcionalmente, la señalización real después. */
export interface KumiteClip {
  id: string; // uuid corto
  videoId: string;
  /** Acción: desde antes de la situación hasta justo cuando el árbitro para (sin ver la decisión). */
  startSeconds: number;
  endSeconds: number;
  /** Opcional: hasta dónde seguir reproduciendo tras decidir, para ver la señalización real. */
  revealEndSeconds?: number;

  title?: string; // p. ej. 'Agarre y ura mawashi'
  competitionName?: string;
  akaName?: string;
  aoName?: string;

  situations: KumiteSituation[];
  /** Decisión real del árbitro central. */
  decisionSide: KumiteSide; // a quién afecta (quien puntúa o quien es sancionado)
  decisionCall: KumiteCall;
  /** Detalle libre, p. ej. '2º Chui por agarre' o 'Yuko gyaku tsuki chudan'. */
  decisionDetail?: string;
  /** Explicación didáctica que se muestra tras decidir. */
  explanation?: string;

  /**
   * Quiz de dos columnas preparado al catalogar: respuestas para AO (columna izquierda)
   * y para AKA (columna derecha), en orden FIJO y con "Nada" como última opción.
   * Se pueden marcar varias correctas por lado; al entrenar hay que responder a los dos lados.
   * Si un clip no tiene quiz, se entrena con el selector clásico (lado + decisión).
   */
  quizAo?: { text: string; correct: boolean }[];
  quizAka?: { text: string; correct: boolean }[];

  /** Marcador: tiempo restante visible (p. ej. "0:14") y si es dentro/cerca de los últimos 15 s. */
  timeRemaining?: string;
  atoShibaraku?: boolean;

  /** Situación polémica: se estudia en su propio apartado, no se mezcla con el entrenamiento normal. */
  polemic?: boolean;
  /** Por qué es polémica. */
  polemicNote?: string;

  createdAt: string; // ISO
}

/** Intento del usuario sobre un clip de kumite. */
export interface KumiteAttempt {
  id?: number;
  clipId: string;
  attemptedAt: string;
  /** Modo clásico (sin quiz). */
  selectedSide?: KumiteSide;
  selectedCall?: KumiteCall;
  /** Modo quiz: textos elegidos en cada columna. */
  selectedAo?: string[];
  selectedAka?: string[];
  isCorrect: boolean;
}

export const KUMITE_SITUATION_LABELS: Record<KumiteSituation, string> = {
  PUNTUACION: 'Puntuación',
  AGARRE: 'Agarres / Clinch / Empujar / Wakarete',
  PROYECCION: 'Proyecciones y barridos',
  JOGAI: 'Jogai',
  MUBOBI_CONTACTO: 'Mubobi / Contacto excesivo',
  EXAGERAR: 'Exagerar',
  SIMULAR: 'Simular lesión',
  TECNICA_PROHIBIDA: 'Técnica prohibida',
  EVITAR_COMBATE: 'Evitar combate',
  PASIVIDAD: 'Pasividad',
  VR: 'VR (revisión de vídeo)',
  LESION: 'Lesión / regla 10 s',
  ETIQUETA: 'Descortés / Shikkaku',
};

/**
 * Respuestas precargadas del quiz según la situación (se aplican a las dos columnas, AO y AKA).
 * La última siempre es "Nada".
 */
export const KUMITE_QUIZ_TEMPLATES: Record<KumiteSituation, string[]> = {
  PUNTUACION: ['Yuko', 'Waza-ari', 'Ippon', 'Nada'],
  AGARRE: ['Agarre', 'Empujar', 'Wakarete', 'Nada'],
  PROYECCION: ['Yuko', 'Ippon', 'Agarre', 'Contacto', 'Nada'],
  JOGAI: ['Jogai', 'Agarre', 'Empujón', 'Nada'],
  MUBOBI_CONTACTO: ['Contacto', 'Mubobi', 'Exagerar', 'Nada'],
  EXAGERAR: ['Contacto', 'Mubobi', 'Exagerar', 'Nada'],
  SIMULAR: ['Contacto', 'Mubobi', 'Simular', 'Nada'],
  TECNICA_PROHIBIDA: ['Contacto', 'Técnica pasada', 'Nada'],
  EVITAR_COMBATE: ['Evadir', 'Nada'],
  PASIVIDAD: ['Pasividad', 'Nada'],
  VR: ['Antes del Atoshi Baraku', 'Después del Atoshi Baraku', 'Antes del final', 'Después del final', 'Nada'],
  LESION: ['Contacto', 'Mubobi', 'Exagerar', 'Simular', 'Nada'],
  ETIQUETA: ['Descortés', 'Shikkaku', 'Nada'],
};

export const KUMITE_CALL_LABELS: Record<KumiteCall, string> = {
  NO_ACTION: 'Nada / sigue',
  YUKO: 'Yuko',
  WAZA_ARI: 'Waza-ari',
  IPPON: 'Ippon',
  CHUI: 'Chui',
  HANSOKU_CHUI: 'Hansoku-Chui',
  HANSOKU: 'Hansoku',
  SHIKKAKU: 'Shikkaku',
  WAKARETE: 'Wakarete',
  TSUZUKETE: 'Tsuzukete (aviso)',
  SENSHU_TORIMASEN: 'Senshu Torimasen',
};

/** Export/dataset del módulo Kumite. */
export interface KumiteDatasetFile {
  schemaVersion: number;
  generatedAt: string;
  clips: KumiteClip[];
}
