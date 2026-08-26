import { useEffect, useRef, useState } from 'react';
import { db } from '../db/db';
import { downloadJson, exportBackup, importBackup, type BackupFile } from '../logic/backup';
import { syncDataset } from '../data/dataset';
import { deleteLocalVideo, importVideoFile, listLocalVideos, type LocalVideoInfo } from '../logic/localVideos';

const fmtSize = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);

export default function Settings() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<LocalVideoInfo[]>([]);
  const [importing, setImporting] = useState('');

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    listLocalVideos().then(setVideos).catch(() => setVideos([]));
  }, []);

  async function doImportVideos(files: FileList) {
    try {
      await navigator.storage?.persist?.();
      // nombres válidos del dataset: id de encuentro (clip) o id de YouTube (vídeo completo)
      const perfs = await db.performances.toArray();
      const validBases = new Set<string>();
      for (const p of perfs) {
        if (p.videoId) { validBases.add(p.id); validBases.add(p.videoId); }
        if (p.aoVideoId) validBases.add(p.aoVideoId);
      }
      const list = Array.from(files);
      const sinCorrespondencia: string[] = [];
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        setImporting(`Importando ${i + 1}/${list.length}: ${f.name}…`);
        await importVideoFile(f, (pct) => setImporting(`Importando ${i + 1}/${list.length}: ${f.name} · ${pct}%`));
        const base = f.name.replace(/\.(mp4|m4v|mov|webm)$/i, '');
        if (!validBases.has(base)) sinCorrespondencia.push(f.name);
      }
      setImporting('');
      // cuántos encuentros quedan enlazados a un vídeo local
      const nombres = new Set((await listLocalVideos()).map((v) => v.name.replace(/\.(mp4|m4v|mov|webm)$/i, '')));
      const enlazados = perfs.filter((p) => p.videoId && (nombres.has(p.id) || nombres.has(p.videoId))).length;
      let m = `✅ ${list.length} vídeo${list.length !== 1 ? 's' : ''} importado${list.length !== 1 ? 's' : ''} · ${enlazados} encuentros enlazados automáticamente.`;
      if (sinCorrespondencia.length) {
        m += ` ⚠️ ${sinCorrespondencia.length} sin correspondencia (nombre no coincide con ningún encuentro): ${sinCorrespondencia.slice(0, 5).join(', ')}${sinCorrespondencia.length > 5 ? '…' : ''}`;
      }
      setMsg(m);
      setVideos(await listLocalVideos());
    } catch (e) {
      setImporting('');
      setMsg(`Error al importar vídeo: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function doExport() {
    const data = await exportBackup();
    downloadJson(data, `kata-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`);
    setMsg(`Backup exportado (${data.attempts.length} intentos).`);
  }

  async function doImport(file: File) {
    try {
      const data = JSON.parse(await file.text()) as BackupFile;
      await importBackup(data);
      setMsg('Backup importado correctamente.');
    } catch (e) {
      setMsg(`Error al importar: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function resetAttempts() {
    if (!confirm('¿Borrar TODOS tus intentos y estadísticas? Esta acción no se puede deshacer.')) return;
    await db.attempts.clear();
    setMsg('Intentos borrados.');
  }

  return (
    <>
      <h1>Ajustes</h1>

      <h2>Copia de seguridad</h2>
      <div className="card">
        <p className="muted">
          Tus intentos y estadísticas viven solo en este dispositivo. Exporta un backup de vez en cuando
          (especialmente en iPhone, donde el sistema puede purgar datos de apps poco usadas).
        </p>
        <button className="btn-primary" onClick={doExport}>⬇️ Exportar datos (JSON)</button>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>⬆️ Importar datos</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
        />
      </div>

      <h2>Vídeos locales (sin anuncios)</h2>
      <div className="card">
        <p className="muted">
          Si tienes los vídeos como archivos, impórtalos aquí y la app los usará en vez de YouTube: sin anuncios y
          sin conexión. Pon los archivos en cualquier carpeta de Archivos (iCloud Drive, p. ej.), toca <b>Importar
          vídeos</b>, y en el selector <b>selecciona todos a la vez</b> — se enlazan solos a cada encuentro por el
          nombre del archivo, sin hacer nada más. (No hace falta que estén en ninguna carpeta concreta: la app no
          puede leer carpetas del sistema, solo los archivos que eliges aquí.)
        </p>
        <button className="btn-primary" onClick={() => videoRef.current?.click()} disabled={!!importing}>
          🎞 Importar vídeos
        </button>
        <input
          ref={videoRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files?.length) doImportVideos(e.target.files); e.target.value = ''; }}
        />
        {importing && <p className="muted center">{importing}</p>}
        {videos.length > 0 && (
          <>
            <p className="muted" style={{ marginBottom: 6 }}>
              {videos.length} vídeo{videos.length !== 1 ? 's' : ''} · {fmtSize(videos.reduce((s, v) => s + v.size, 0))} en total
            </p>
            {videos.map((v) => (
              <div key={v.name} className="row" style={{ alignItems: 'center', marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.name} <span className="muted">({fmtSize(v.size)})</span>
                </span>
                <button
                  style={{ flex: '0 0 auto', padding: '6px 10px' }}
                  onClick={async () => { await deleteLocalVideo(v.name); setVideos(await listLocalVideos()); }}
                >
                  🗑
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      <h2>Datos</h2>
      <div className="card">
        <p className="muted">
          El catálogo de actuaciones se publica con la app. Los campeonatos nuevos aparecen aquí
          automáticamente tras cada actualización del dataset.
        </p>
        <button className="btn-secondary" onClick={async () => { await syncDataset(); setMsg('Dataset sincronizado.'); }}>
          🔄 Re-sincronizar dataset
        </button>
        <p className="muted">
          Almacenamiento persistente: {persisted == null ? 'desconocido' : persisted ? '✅ concedido' : '⚠️ no concedido'}
        </p>
      </div>

      <h2>Zona de peligro</h2>
      <div className="card">
        <button className="btn-secondary" style={{ borderColor: '#8f2a22', color: '#ef9a93' }} onClick={resetAttempts}>
          🗑️ Borrar todos mis intentos
        </button>
      </div>

      {msg && <div className="card" role="status">{msg}</div>}
      <p className="muted center">Kracademy Kata Trainer · v0.1 · Fase 1</p>
    </>
  );
}
