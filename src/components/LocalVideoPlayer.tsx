import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { YouTubePlayerHandle } from './YouTubePlayer';

interface Props {
  src: string; // object URL del archivo local
  startSeconds?: number;
  endSeconds?: number;
  autoplay?: boolean;
  controls?: boolean;
  playbackRate?: number;
  onEnded?: () => void;
  onError?: (code: number) => void;
  onPlayingChange?: (playing: boolean) => void;
}

const mmss = (s: number) => {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Reproductor de vídeo local (sin anuncios): misma interfaz que YouTubePlayer
 * para poder intercambiarlos en las sesiones de entrenamiento.
 * Con `controls`, muestra controles PROPIOS acotados al tramo [startSeconds, endSeconds]
 * (la barra nativa enseñaría el archivo entero).
 */
const LocalVideoPlayer = forwardRef<YouTubePlayerHandle, Props>(function LocalVideoPlayer(
  { src, startSeconds, endSeconds, autoplay = true, controls = true, playbackRate = 1, onEnded, onError, onPlayingChange },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const endedFiredRef = useRef(false);
  const cbRef = useRef({ onEnded, onError, onPlayingChange });
  cbRef.current = { onEnded, onError, onPlayingChange };
  const endRef = useRef(endSeconds);
  endRef.current = endSeconds;
  const [t, setT] = useState(startSeconds ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dur, setDur] = useState(0);
  // modo estudio (controls): velocidad propia y pantalla grande
  const [rate, setRate] = useState(playbackRate);
  const [fs, setFs] = useState(false);
  const rateRef = useRef(playbackRate);

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => videoRef.current?.currentTime,
    pause: () => videoRef.current?.pause(),
    play: () => { videoRef.current?.play().catch(() => undefined); },
    seekTo: (s: number) => { if (videoRef.current) videoRef.current.currentTime = s; },
    setRate: (r: number) => { rateRef.current = r; if (videoRef.current) applyRate(videoRef.current, r); },
  }));

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    endedFiredRef.current = false;
    const fireEnded = () => {
      if (endedFiredRef.current) return;
      endedFiredRef.current = true;
      v.pause();
      cbRef.current.onEnded?.();
    };
    const onLoaded = () => {
      if (startSeconds != null) v.currentTime = startSeconds;
      (v as HTMLVideoElement & { preservesPitch?: boolean }).preservesPitch = false;
      v.playbackRate = rateRef.current;
      setDur(v.duration || 0);
      setT(startSeconds ?? 0);
      if (autoplay) v.play().catch(() => undefined);
    };
    const onTime = () => {
      setT(v.currentTime);
      const end = endRef.current;
      if (end != null && v.currentTime >= end) fireEnded();
    };
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', fireEnded);
    const onPlay = () => { setIsPlaying(true); cbRef.current.onPlayingChange?.(true); };
    const onPause = () => { setIsPlaying(false); cbRef.current.onPlayingChange?.(false); };
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    const onErr = () => cbRef.current.onError?.(0);
    v.addEventListener('error', onErr);
    v.load();
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', fireEnded);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onErr);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, startSeconds]);

  // cambio de velocidad sin re-montar (prop desde el entrenamiento, o chips propios en estudio)
  useEffect(() => {
    rateRef.current = playbackRate;
    setRate(playbackRate);
    if (videoRef.current) applyRate(videoRef.current, playbackRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackRate]);
  // al salir de pantalla grande, forzar a iOS a re-muestrear el color de la barra de estado
  useEffect(() => {
    if (fs) return;
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta) { const v = meta.content; meta.content = '#fffffe'; requestAnimationFrame(() => { meta.content = v; }); }
    window.scrollTo(window.scrollX, window.scrollY);
  }, [fs]);

  /** Cambia la velocidad re-sincronizando audio/vídeo (en iOS el audio se quedaba "arrastrado"). */
  function applyRate(v: HTMLVideoElement, r: number) {
    // sin corrección de tono: el time-stretch de WebKit deja el audio desfasado al volver a x1
    (v as HTMLVideoElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }).preservesPitch = false;
    (v as HTMLVideoElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = false;
    v.playbackRate = r;
    // pequeño re-seek al mismo instante: fuerza a re-alinear la pista de audio con la de vídeo
    const t = v.currentTime;
    v.currentTime = t;
  }
  function changeRate(r: number) {
    rateRef.current = r;
    setRate(r);
    if (videoRef.current) applyRate(videoRef.current, r);
  }

  // tramo visible en los controles propios
  const segStart = startSeconds ?? 0;
  const segEnd = endSeconds ?? (dur || segStart + 1);
  const rel = Math.min(Math.max(t - segStart, 0), segEnd - segStart);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) { v.pause(); return; }
    // si estaba al final del tramo, volver a empezar
    if (v.currentTime >= segEnd - 0.25) v.currentTime = segStart;
    endedFiredRef.current = false;
    v.play().catch(() => undefined);
  }

  const videoEl = (
    <video
      ref={videoRef}
      className="yt-holder"
      src={src}
      controls={false}
      playsInline
      preload="auto"
      style={{ objectFit: 'contain', background: '#000' }}
      onClick={controls ? togglePlay : undefined}
    />
  );

  // sin controles (entrenamiento): solo el vídeo, dentro del .player-wrap del padre
  if (!controls) return videoEl;

  // con controles (estudio): vídeo + barra DEBAJO (no tapa la imagen) + velocidad + pantalla grande
  return (
    <div className={`lv-stack${fs ? ' fs' : ''}`}>
      <div className="player-wrap">
        {videoEl}
        {fs && <button className="fs-btn" onClick={() => setFs(false)} aria-label="Cerrar pantalla grande">✕</button>}
      </div>
      <div className="lv-controls">
        <button onClick={togglePlay} aria-label={isPlaying ? 'Pausa' : 'Reproducir'}>{isPlaying ? '⏸' : '▶︎'}</button>
        <input
          type="range"
          min={0}
          max={Math.max(0.1, segEnd - segStart)}
          step={0.1}
          value={rel}
          onChange={(e) => {
            const v = videoRef.current;
            if (!v) return;
            endedFiredRef.current = false;
            v.currentTime = segStart + parseFloat(e.target.value);
            setT(v.currentTime);
          }}
        />
        <span className="lv-time">{mmss(rel)} / {mmss(segEnd - segStart)}</span>
      </div>
      <div className="lv-extra">
        {[0.25, 0.5, 1, 1.5, 2].map((r) => (
          <button key={r} className={`chip${rate === r ? ' sel' : ''}`} onClick={() => changeRate(r)}>x{r}</button>
        ))}
        <button className="chip lv-fs" onClick={() => setFs(!fs)} aria-label="Pantalla grande">{fs ? '✕' : '⤢'}</button>
      </div>
    </div>
  );
});

export default LocalVideoPlayer;
