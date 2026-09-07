import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import ModuleSelect from './screens/ModuleSelect';
import Home from './screens/Home';
import Train from './screens/Train';
import Library from './screens/Library';
import ErrorsScreen from './screens/ErrorsScreen';
import Stats from './screens/Stats';
import Catalog from './screens/Catalog';
import Settings from './screens/Settings';
import KataStudy from './screens/KataStudy';
import KumiteHome from './screens/kumite/KumiteHome';
import KumiteTrain from './screens/kumite/KumiteTrain';
import KumiteBouts from './screens/kumite/KumiteBouts';
import KumiteLibrary from './screens/kumite/KumiteLibrary';
import KumiteStats from './screens/kumite/KumiteStats';
import KumiteCatalog from './screens/kumite/KumiteCatalog';
import KumitePolemics from './screens/kumite/KumitePolemics';

/* Iconos estilo SF Symbols (trazo 1.7, currentColor) */
const I = {
  house: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.2V19a1.5 1.5 0 0 0 1.5 1.5h10A1.5 1.5 0 0 0 18.5 19V9.2" />
      <path d="M9.8 20.2v-5.4a1.2 1.2 0 0 1 1.2-1.2h2a1.2 1.2 0 0 1 1.2 1.2v5.4" />
    </svg>
  ),
  play: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.75" />
      <path d="M10.2 8.9v6.2l5-3.1z" fill="currentColor" stroke="none" />
    </svg>
  ),
  stack: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="9.5" width="14" height="10" rx="2" />
      <path d="M7 6.8h10" />
      <path d="M8.8 4.2h6.4" />
      <path d="M10.6 12.4v4.2l3.6-2.1z" fill="currentColor" stroke="none" />
    </svg>
  ),
  chart: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="13" width="3.6" height="6.5" rx="1" />
      <rect x="10.2" y="8.5" width="3.6" height="11" rx="1" />
      <rect x="16.4" y="4.5" width="3.6" height="15" rx="1" />
    </svg>
  ),
  figure: (
    // neko-ashi-dachi: peso atrás, pie delantero de puntillas, shuto adelante y mano recogida
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12.6" cy="3.9" r="1.8" />
      <path d="M12.1 6 11.2 12.2" />
      <path d="M12.1 7l3.2 1.3 3.7-1 1.4-.8" />
      <path d="M12.1 7 9.3 9.1l2 1.6" />
      <path d="M11.2 12.2 7.9 14.5l.5 5.2" />
      <path d="M11.2 12.2l3.3 2.7 1.2 4.8" />
    </svg>
  ),
  spar: (
    // kizami-tsuki jodan: atacante en zenkutsu lanzando el puño adelantado a la cara del rival
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.6" cy="6.8" r="1.8" />
      <path d="M6.1 8.9 4.9 13.4" />
      <path d="M6.3 9.4l8.6-2.2" />
      <path d="M6.3 9.9 4 11.8" />
      <path d="M4.9 13.4l3.9 2.8-.3 4.2" />
      <path d="M4.9 13.4l-2.9 6" />
      <circle cx="19.1" cy="5.7" r="1.8" />
      <path d="M18.5 7.6l-1.1 5.5" />
      <path d="M18.2 8.3l-2.9 2.2" />
      <path d="M17.4 13.1l-1.7 6.3" />
      <path d="M17.4 13.1l3.9 5.6" />
    </svg>
  ),
  gear: (
    // engranaje estilo iOS (8 dientes)
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.3 10.5 21.6 10.9 21.6 13.1 19.3 13.5 18.3 16.1 19.6 18.0 18.0 19.6 16.1 18.3 13.5 19.3 13.1 21.6 10.9 21.6 10.5 19.3 7.9 18.3 6.0 19.6 4.4 18.0 5.7 16.1 4.7 13.5 2.4 13.1 2.4 10.9 4.7 10.5 5.7 7.9 4.4 6.0 6.0 4.4 7.9 5.7 10.5 4.7 10.9 2.4 13.1 2.4 13.5 4.7 16.1 5.7 18.0 4.4 19.6 6.0 18.3 7.9z" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  ),
};

const KATA_TABS = [
  { to: '/kata', ico: I.house, label: 'Inicio' },
  { to: '/kata/entrenar', ico: I.play, label: 'Entrenar' },
  { to: '/kata/katas', ico: I.figure, label: 'Katas' },
  { to: '/kata/biblioteca', ico: I.stack, label: 'Biblioteca' },
  { to: '/kata/estadisticas', ico: I.chart, label: 'Stats' },
  { to: '/kata/ajustes', ico: I.gear, label: 'Ajustes' },
];

const KUMITE_TABS = [
  { to: '/kumite', ico: I.house, label: 'Inicio' },
  { to: '/kumite/entrenar', ico: I.play, label: 'Entrenar' },
  { to: '/kumite/combates', ico: I.spar, label: 'Combates' },
  { to: '/kumite/biblioteca', ico: I.stack, label: 'Biblioteca' },
  { to: '/kumite/estadisticas', ico: I.chart, label: 'Stats' },
  { to: '/kumite/ajustes', ico: I.gear, label: 'Ajustes' },
];

export default function App() {
  const { pathname } = useLocation();
  // Dos "apps en una": cada módulo tiene su propia barra de pestañas; la portada no tiene ninguna.
  const tabs = pathname.startsWith('/kumite') ? KUMITE_TABS : pathname.startsWith('/kata') ? KATA_TABS : null;

  return (
    <>
      <main>
        <Routes>
          <Route path="/" element={<ModuleSelect />} />

          <Route path="/kata" element={<Home />} />
          <Route path="/kata/entrenar" element={<Train />} />
          <Route path="/kata/katas" element={<KataStudy />} />
          <Route path="/kata/biblioteca" element={<Library />} />
          <Route path="/kata/errores" element={<ErrorsScreen />} />
          <Route path="/kata/estadisticas" element={<Stats />} />
          <Route path="/kata/catalogar" element={<Catalog />} />
          <Route path="/kata/ajustes" element={<Settings />} />

          <Route path="/kumite" element={<KumiteHome />} />
          <Route path="/kumite/entrenar" element={<KumiteTrain />} />
          <Route path="/kumite/combates" element={<KumiteBouts />} />
          <Route path="/kumite/biblioteca" element={<KumiteLibrary />} />
          <Route path="/kumite/estadisticas" element={<KumiteStats />} />
          <Route path="/kumite/catalogar" element={<KumiteCatalog />} />
          <Route path="/kumite/polemicas" element={<KumitePolemics />} />
          <Route path="/kumite/ajustes" element={<Settings />} />

          {/* rutas antiguas → nuevas (marcadores/PWA ya instaladas) */}
          <Route path="/entrenar" element={<Navigate to="/kata/entrenar" replace />} />
          <Route path="/katas" element={<Navigate to="/kata/katas" replace />} />
          <Route path="/biblioteca" element={<Navigate to="/kata/biblioteca" replace />} />
          <Route path="/errores" element={<Navigate to="/kata/errores" replace />} />
          <Route path="/estadisticas" element={<Navigate to="/kata/estadisticas" replace />} />
          <Route path="/catalogar" element={<Navigate to="/kata/catalogar" replace />} />
          <Route path="/ajustes" element={<Navigate to="/kata/ajustes" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {tabs && (
        <nav className="bottom">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/kata' || t.to === '/kumite'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ico">{t.ico}</span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}
