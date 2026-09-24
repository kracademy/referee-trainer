import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CropRect } from '../logic/crop';

/** Tamaño interno del reproductor recortado: YouTube elige la calidad por este tamaño (1080p). */
const HD_W = 1920;
const HD_H = 1080;

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

export interface YouTubePlayerHandle {
  getCurrentTime(): number | undefined;
  pause(): void;
  play(): void;
  seekTo(seconds: number): void;
  setRate(rate: number): void;
}

interface Props {
  videoId: string;
  startSeconds?: number;
  endSeconds?: number;
  autoplay?: boolean;
  /** false = sin barra de controles ni búsqueda (modo entrenamiento). */
  controls?: boolean;
  /** Velocidad de reproducción (YouTube admite hasta 2x). */
  playbackRate?: number;
  /** Se dispara una vez cuando la reproducción alcanza endSeconds o el vídeo termina. */
  onEnded?: () => void;
  onError?: (code: number) => void;
  /** true cuando el vídeo está reproduciéndose de verdad (para botones play/pausa propios). */
  onPlayingChange?: (playing: boolean) => void;
  /** Muestra solo un recuadro del fotograma (vídeos en mosaico). */
  crop?: CropRect;
}

/**
 * Reproductor YouTube (IFrame API) con corte en endSeconds.
 * Además del parámetro `end` nativo, hace polling de getCurrentTime como red de seguridad.
 */
const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(function YouTubePlayer(
  { videoId, startSeconds, endSeconds, autoplay = true, controls = true, playbackRate, onEnded, onError, onPlayingChange, crop },
  ref,
) {
  const holderRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const endedFiredRef = useRef(false);
  const cbRef = useRef({ onEnded, onError, onPlayingChange });
  cbRef.current = { onEnded, onError, onPlayingChange };
  const endRef = useRef(endSeconds);
  endRef.current = endSeconds;
  const rateRef = useRef(playbackRate);
  rateRef.current = playbackRate;

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => {
      const t = playerRef.current?.getCurrentTime?.();
      return typeof t === 'number' ? t : undefined;
    },
    pause: () => playerRef.current?.pauseVideo?.(),
    play: () => playerRef.current?.playVideo?.(),
    seekTo: (s: number) => playerRef.current?.seekTo?.(s, true),
    setRate: (r: number) => playerRef.current?.setPlaybackRate?.(r),
  }));

  useEffect(() => {
    let disposed = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    endedFiredRef.current = false;

    loadYouTubeApi().then((YT) => {
      if (disposed || !holderRef.current) return;
      const el = document.createElement('div');
      holderRef.current.innerHTML = '';
      holderRef.current.appendChild(el);
      playerRef.current = new YT.Player(el, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          start: startSeconds != null ? Math.floor(startSeconds) : undefined,
          end: endRef.current != null ? Math.ceil(endRef.current) : undefined,
          autoplay: autoplay ? 1 : 0,
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          controls: controls ? 1 : 0,
          disablekb: controls ? 0 : 1,
          fs: controls ? 1 : 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            if (rateRef.current && rateRef.current !== 1) playerRef.current?.setPlaybackRate?.(rateRef.current);
          },
          onStateChange: (e: any) => {
            if (e.data === YT.PlayerState.ENDED) fireEnded();
            cbRef.current.onPlayingChange?.(e.data === YT.PlayerState.PLAYING);
            // reafirmar la velocidad al arrancar (YouTube la resetea a veces al cargar)
            if (e.data === YT.PlayerState.PLAYING && rateRef.current && rateRef.current !== 1) {
              playerRef.current?.setPlaybackRate?.(rateRef.current);
            }
          },
          onError: (e: any) => cbRef.current.onError?.(e.data),
        },
      });

      const fireEnded = () => {
        if (endedFiredRef.current) return;
        endedFiredRef.current = true;
        playerRef.current?.pauseVideo?.();
        cbRef.current.onEnded?.();
      };

      interval = setInterval(() => {
        const end = endRef.current;
        if (end == null || endedFiredRef.current) return;
        const t = playerRef.current?.getCurrentTime?.();
        if (typeof t === 'number' && t >= end) fireEnded();
      }, 400);
    });

    return () => {
      disposed = true;
      if (interval) clearInterval(interval);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId, startSeconds, autoplay]);

  // Recorte: el reproductor se pinta SIEMPRE a 1920×1080 y se escala para que el recuadro llene
  // el marco. Así YouTube sirve 1080p aunque el marco sea pequeño (iPhone).
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    if (!crop) return;
    const box = holderRef.current?.parentElement;
    if (!box) return;
    const ro = new ResizeObserver(() => setBoxW(box.clientWidth));
    ro.observe(box);
    setBoxW(box.clientWidth);
    return () => ro.disconnect();
  }, [crop]);
  const style = crop && boxW
    ? {
        position: 'absolute' as const,
        left: 0,
        top: 0,
        right: 'auto',
        bottom: 'auto',
        width: HD_W,
        height: HD_H,
        maxWidth: 'none',
        transformOrigin: '0 0',
        transform: `scale(${boxW / (crop.w * HD_W)}) translate(${-crop.x * HD_W}px, ${-crop.y * HD_H}px)`,
      }
    : undefined;

  return <div className="yt-holder" ref={holderRef} style={style} />;
});

export default YouTubePlayer;
