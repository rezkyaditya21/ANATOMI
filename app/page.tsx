import {flushSync} from 'react-dom';
import {registerAtlasTools} from './agent-tools';
import {useEffect,useMemo,useRef,useState} from 'react';
import {
  Activity,
  ArrowUpRight,
  Camera,
  ChevronRight,
  Focus,
  Heart,
  Info,
  Layers3,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  RotateCcw,
  RotateCw,
  Ruler,
  Scan,
  Scissors,
  Search,
  Sun,
  Volume2,
  VolumeX,
  X,
  Stethoscope
} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from '@/components/ui/combobox';
import AnatomyScene from './scene';
import {
  DEFAULT_VISIBLE,
  SYSTEMS,
  EXPLANATIONS,
  explanation,
  getLatinName,
  getIndonesianName,
  getClinicalNote,
  getPhysiologicalStat,
  type Atlas,
  type Concept,
  type SceneState,
  type SystemId,
  type View
} from './anatomy';
import {playSelectSound, playScanSound, playHeartbeatSound} from './audio-fx';

const initial: SceneState = {
  explode: 0,
  visible: DEFAULT_VISIBLE,
  selected: [],
  isolate: false,
  view: 'three-quarter',
  rotate: false,
  reset: 0,
  theme: 'dark',
  xray: false,
  dissection: 25,
  heartbeat: true,
  clipping: {
    enabled: false,
    plane: 'axial',
    position: 1.15
  }
};

const QUICK_CHIPS = [
  { term: 'heart', label: 'Jantung (Cor)' },
  { term: 'brain', label: 'Otak (Encephalon)' },
  { term: 'lung', label: 'Paru-paru (Pulmo)' },
  { term: 'liver', label: 'Hati (Hepar)' },
  { term: 'stomach', label: 'Lambung (Gaster)' },
  { term: 'kidney', label: 'Ginjal (Ren)' },
  { term: 'femur', label: 'Tulang Paha (Femur)' },
  { term: 'aorta', label: 'Aorta' },
];

function LiveEcgMonitor({ sound }: { sound: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId = 0;
    const w = canvas.width;
    const h = canvas.height;
    const points: number[] = new Array(w).fill(h / 2);
    let t = 0;
    let lastBeat = 0;

    const render = () => {
      animId = requestAnimationFrame(render);
      t++;
      const period = 52.0; // ~69-72 BPM
      const phase = (t % period) / period;

      // Clinical Electrophysiology Continuous Waveform:
      // P wave (atrial depolarization)
      const p = 0.14 * Math.exp(-Math.pow((phase - 0.18) / 0.038, 2));
      // Q wave (septal depolarization)
      const q = -0.16 * Math.exp(-Math.pow((phase - 0.36) / 0.016, 2));
      // R wave (ventricular apex depolarization)
      const r = 1.05 * Math.exp(-Math.pow((phase - 0.40) / 0.022, 2));
      // S wave (ventricular base depolarization)
      const s = -0.34 * Math.exp(-Math.pow((phase - 0.44) / 0.019, 2));
      // T wave (ventricular repolarization)
      const tWave = 0.24 * Math.exp(-Math.pow((phase - 0.64) / 0.065, 2));
      const microNoise = (Math.random() - 0.5) * 0.025;
      const ecg = p + q + r + s + tWave + microNoise;

      if (phase >= 0.39 && phase <= 0.41 && sound && Date.now() - lastBeat > 700) {
        playHeartbeatSound();
        lastBeat = Date.now();
      }

      const val = (h / 2) - ecg * (h * 0.42);
      points.shift();
      points.push(val);

      ctx.clearRect(0, 0, w, h);

      // Clinical 1mm/5mm oscilloscope grid lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < w; x += 10) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 10) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Medical Green Phosphor Oscilloscope Trace with Bloom
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.75;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(i, points[i]);
        else ctx.lineTo(i, points[i]);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, [sound]);

  return <canvas ref={canvasRef} width={268} height={40} className="ecg-canvas" />;
}

export default function Home() {
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [state, setState] = useState<SceneState>(initial);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<'layers' | 'search' | null>(null);
  const [details, setDetails] = useState(false);
  const [about, setAbout] = useState(false);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Concept | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [sliceOpen, setSliceOpen] = useState(false);

  useEffect(() => {
    const handleFS = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFS);
    return () => document.removeEventListener('fullscreenchange', handleFS);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const abort = new AbortController();
    setProgress(0);
    setError('');
    setAtlas(null);
    setChosen(null);
    setDetails(false);
    const base = import.meta.env.BASE_URL || './';
    const atlasUrl = base.endsWith('/') ? `${base}models/atlas.json` : `${base}/models/atlas.json`;
    fetch(atlasUrl, { signal: abort.signal })
      .then(r => {
        if (!r.ok) throw new Error('Katalog anatomi tidak dapat dimuat.');
        return r.json();
      })
      .then(data => setAtlas(data as Atlas))
      .catch(e => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setPanel('search');
        setDetails(false);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const parts = useMemo(() => new Map(atlas?.parts.map(p => [p.id, p])), [atlas]);
  const counts = useMemo(() => Object.fromEntries(SYSTEMS.map(s => [s.id, atlas?.parts.filter(p => p.system === s.id).length ?? 0])), [atlas]);
  const activeSystems = SYSTEMS.filter(s => counts[s.id] > 0);

  const selectedParts = state.selected.map(id => parts.get(id)).filter(p => !!p);
  const selected = selectedParts[0];
  const system = SYSTEMS.find(s => s.id === selected?.system);
  const visibleCount = atlas?.parts.filter(p => state.isolate ? state.selected.includes(p.id) : state.visible.includes(p.system) || state.selected.includes(p.id)).length ?? 0;

  const results = useMemo(() => {
    if (!atlas) return [];
    const term = query.toLowerCase().trim();
    if (!term) {
      return ['heart', 'brain', 'liver', 'stomach', 'spleen', 'pancreas', 'urinary bladder', 'trachea']
        .map(name => atlas.concepts.find(c => c.name.toLowerCase() === name))
        .filter((x): x is Concept => !!x);
    }
    return atlas.concepts.filter(c => {
      const en = c.name.toLowerCase();
      const id = getIndonesianName(c.name).toLowerCase();
      const la = getLatinName(c.name).toLowerCase();
      const cid = c.id.toLowerCase();
      return en.includes(term) || id.includes(term) || la.includes(term) || cid.includes(term);
    }).sort((a, b) => a.name.length - b.name.length).slice(0, 80);
  }, [atlas, query]);

  const choose = (c: Concept) => {
    playSelectSound();
    setChosen(c);
    setState(s => ({ ...s, selected: c.elements, isolate: false, rotate: false }));
    setDetails(true);
    setPanel(null);
  };

  useEffect(() => {
    if (!atlas) return;
    return registerAtlasTools(atlas, c => flushSync(() => choose(c)));
  }, [atlas]);

  const choosePart = (id: string) => {
    const p = parts.get(id);
    if (!p) return;
    playSelectSound();
    setChosen({ id: p.conceptId, name: p.name, elements: [id] });
    setState(s => ({ ...s, selected: [id], isolate: false, rotate: false }));
    setDetails(true);
    setPanel(null);
  };

  const toggle = (id: SystemId) => {
    playSelectSound();
    setDetails(false);
    setState(s => ({
      ...s,
      selected: [],
      isolate: false,
      visible: s.visible.includes(id) ? s.visible.filter(x => x !== id) : [...s.visible, id]
    }));
  };

  const reset = () => {
    playScanSound();
    setState(s => ({
      ...initial,
      theme: s.theme,
      reset: s.reset + 1
    }));
    setChosen(null);
    setDetails(false);
    setPanel(null);
    setSliceOpen(false);
  };

  const openPanel = (next: 'layers' | 'search') => {
    playSelectSound();
    setDetails(false);
    setPanel(p => p === next ? null : next);
  };

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'id-ID';
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  };

  const exportScreenshot = () => {
    playScanSound();
    const canvas = document.querySelector('.scene canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `anatomi-3d-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  const applyDissection = (val: number) => {
    playSelectSound();
    let vis: SystemId[] = [];
    if (val < 15) {
      vis = [...DEFAULT_VISIBLE, 'integumentary'];
    } else if (val < 45) {
      vis = DEFAULT_VISIBLE.filter(s => s !== 'integumentary');
    } else if (val < 75) {
      vis = DEFAULT_VISIBLE.filter(s => s !== 'integumentary' && s !== 'muscular');
    } else if (val < 90) {
      vis = ['cardiac', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive', 'nervous', 'arterial', 'venous'];
    } else {
      vis = ['skeletal'];
    }
    setState(s => ({ ...s, dissection: val, visible: vis, isolate: false }));
  };

  const isDark = state.theme !== 'light';

  return (
    <main className={`studio ${isDark ? 'dark' : 'light'}`}>
      {atlas && (
        <AnatomyScene
          atlas={atlas}
          state={{ ...state, inspectorOpen: details && selectedParts.length > 0 }}
          onSelect={choosePart}
          onProgress={n => {
            setProgress(n);
            if (n === 100) setError('');
          }}
          onError={setError}
          onAnchorUpdate={setAnchor}
        />
      )}

      <div className="vignette" />

      {/* Anatomical 1.75m Scale Height Caliper (Left Edge) */}
      <div className="height-caliper" title="Skala Anatomi Tubuh Pria Dewasa (175 cm)">
        <div className="caliper-header"><Ruler size={11} /> 175 cm</div>
        <div className="caliper-track">
          <div className="caliper-mark" style={{ bottom: '98%' }}><span>175 cm · Vertex</span></div>
          <div className="caliper-mark" style={{ bottom: '84%' }}><span>150 cm · Klavikula</span></div>
          <div className="caliper-mark" style={{ bottom: '68%' }}><span>120 cm · Toraks</span></div>
          <div className="caliper-mark" style={{ bottom: '52%' }}><span>92 cm · Pelvis</span></div>
          <div className="caliper-mark" style={{ bottom: '27%' }}><span>48 cm · Patela</span></div>
          <div className="caliper-mark" style={{ bottom: '2%' }}><span>0 cm · Plantar</span></div>
        </div>
      </div>

      {/* Dynamic 3D Leader Line & HUD Targeting Reticle */}
      {anchor && anchor.visible && chosen && !details && (
        <div className="leader-overlay">
          <svg className="leader-line-svg">
            <defs>
              <radialGradient id="dot-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx={anchor.x} cy={anchor.y} r="22" fill="url(#dot-glow)" />
            <circle cx={anchor.x} cy={anchor.y} r="10" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={anchor.x} cy={anchor.y} r="3.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
            <line x1={anchor.x - 14} y1={anchor.y} x2={anchor.x - 6} y2={anchor.y} stroke="#38bdf8" strokeWidth="1.2" />
            <line x1={anchor.x + 6} y1={anchor.y} x2={anchor.x + 14} y2={anchor.y} stroke="#38bdf8" strokeWidth="1.2" />
            <line x1={anchor.x} y1={anchor.y - 14} x2={anchor.x} y2={anchor.y - 6} stroke="#38bdf8" strokeWidth="1.2" />
            <line x1={anchor.x} y1={anchor.y + 6} x2={anchor.x} y2={anchor.y + 14} stroke="#38bdf8" strokeWidth="1.2" />
            <polyline
              points={`${anchor.x},${anchor.y} ${anchor.x},${anchor.y - 20} ${anchor.x + 20},${anchor.y - 32}`}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          </svg>
          <div
            className="leader-badge"
            style={{ left: `${anchor.x}px`, top: `${anchor.y}px` }}
            onClick={() => setDetails(true)}
            title="Klik untuk membuka dossier medis lengkap"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="leader-badge-indo">{getIndonesianName(chosen.name)}</span>
              <button
                type="button"
                className="leader-audio-chip"
                onClick={e => {
                  e.stopPropagation();
                  speak(`${getIndonesianName(chosen.name)}. ${getLatinName(chosen.name) || chosen.name}`);
                }}
                title="Dengarkan pelafalan suara medis"
              >
                <Volume2 size={12} />
              </button>
            </div>
            {getLatinName(chosen.name) && (
              <span className="leader-badge-latin">{getLatinName(chosen.name)}</span>
            )}
            <span className="leader-badge-system">
              <span className="system-dot" style={{ background: system?.color ?? '#38bdf8' }} />
              {system?.nameId ?? system?.name ?? 'Anatomi'} · Buka Dossier
            </span>
          </div>
        </div>
      )}

      {/* Main Lab Identity Header */}
      <header className="identity">
        <div className="eyebrow">
          <span className="status-dot animate-pulse" /> BIO-DIGITAL HUMAN LAB v4.0
        </div>
        <h1>
          Anatomi <Badge variant="outline" className="edition">3D</Badge>
        </h1>
        <div className="identity-meta">
          <strong>2,234</strong> modeled pieces <span>·</span> <strong>2.28M</strong> Triangles <span>·</span> BodyParts3D <span>·</span> ACES PBR
        </div>
      </header>

      {/* Top Action Dock */}
      <nav className="top-actions" aria-label="Explorer panels">
        <Button
          variant="ghost"
          className={panel === 'search' ? 'active' : ''}
          onClick={() => openPanel('search')}
          aria-label="Cari struktur anatomi"
        >
          <Search size={16} />
          <span>Cari Anatomi</span>
          <kbd>/</kbd>
        </Button>

        {/* CT Slicer Toggle Button */}
        <Button
          variant="ghost"
          className={`icon-button ${sliceOpen ? 'active' : ''}`}
          onClick={() => {
            playScanSound();
            setSliceOpen(!sliceOpen);
            setState(s => ({
              ...s,
              clipping: {
                ...s.clipping!,
                enabled: !sliceOpen
              }
            }));
          }}
          title="Potongan Melintang CT (Cross-Section)"
          aria-label="Potongan CT"
        >
          <Scissors size={17} />
        </Button>

        <Button
          variant="ghost"
          className={`icon-button ${state.xray ? 'active' : ''}`}
          onClick={() => {
            playScanSound();
            setState(s => ({ ...s, xray: !s.xray }));
          }}
          title={state.xray ? 'Nonaktifkan Mode X-Ray' : 'Aktifkan Mode X-Ray (Radiografik)'}
          aria-label="Mode X-Ray"
        >
          <Scan size={18} />
        </Button>

        <Button
          variant="ghost"
          className="icon-button"
          onClick={() => {
            playSelectSound();
            setState(s => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }));
          }}
          title={isDark ? 'Beralih ke Tema Putih Medis' : 'Beralih ke Tema Studio Gelap'}
          aria-label="Toggle Theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </Button>

        <Button
          variant="ghost"
          className={`icon-button ${soundOn ? 'active' : ''}`}
          onClick={() => setSoundOn(!soundOn)}
          title={soundOn ? 'Nonaktifkan Suara Detak Jantung' : 'Aktifkan Suara Denyut Jantung Medis'}
          aria-label="Toggle Heartbeat Sound"
        >
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </Button>

        <Button
          variant="ghost"
          className="icon-button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Keluar dari Layar Penuh' : 'Mode Layar Penuh (Imersif)'}
          aria-label="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </Button>

        <Button
          variant="ghost"
          className="icon-button"
          onClick={exportScreenshot}
          title="Unduh Tangkapan Layar HD (PNG)"
          aria-label="Screenshot"
        >
          <Camera size={18} />
        </Button>

        <Button
          variant="ghost"
          className="icon-button"
          aria-label="Informasi lisensi dan data"
          onClick={() => {
            setDetails(false);
            setPanel(null);
            setAbout(true);
          }}
        >
          <Info size={18} />
        </Button>
      </nav>

      {/* Floating CT Cross-Section Slicer Panel */}
      {sliceOpen && (
        <section className="ct-slice-panel glass" aria-label="Kontrol Irisan CT">
          <div className="panel-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Scissors size={15} style={{ color: '#38bdf8' }} />
              <span style={{ fontWeight: 600 }}>Irisan CT Scanner</span>
            </div>
            <Button variant="ghost" className="icon-button" onClick={() => setSliceOpen(false)} aria-label="Tutup panel irisan">
              <X size={16} />
            </Button>
          </div>
          <div className="slice-plane-selector">
            <Button
              variant="ghost"
              className={state.clipping?.plane === 'axial' ? 'active' : ''}
              onClick={() => {
                playSelectSound();
                setState(s => ({ ...s, clipping: { ...s.clipping!, plane: 'axial', position: 1.15 } }));
              }}
            >
              Aksial (T-D)
            </Button>
            <Button
              variant="ghost"
              className={state.clipping?.plane === 'sagittal' ? 'active' : ''}
              onClick={() => {
                playSelectSound();
                setState(s => ({ ...s, clipping: { ...s.clipping!, plane: 'sagittal', position: 0.9 } }));
              }}
            >
              Sagital (S-D)
            </Button>
            <Button
              variant="ghost"
              className={state.clipping?.plane === 'coronal' ? 'active' : ''}
              onClick={() => {
                playSelectSound();
                setState(s => ({ ...s, clipping: { ...s.clipping!, plane: 'coronal', position: 0.9 } }));
              }}
            >
              Koronal (D-B)
            </Button>
          </div>
          <div className="slice-slider-wrapper">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
              <span>Kedalaman Potongan</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                {Math.round((state.clipping?.position ?? 1.15) * 100)} cm
              </span>
            </div>
            <Slider
              min={10}
              max={175}
              step={1}
              value={[Math.round((state.clipping?.position ?? 1.15) * 100)]}
              onValueChange={v => {
                const val = (Array.isArray(v) ? v[0] : v) / 100;
                setState(s => ({ ...s, clipping: { ...s.clipping!, position: val, enabled: true } }));
              }}
            />
          </div>
        </section>
      )}

      {/* Systems Drawer */}
      <section className={`layers-panel glass ${panel === 'layers' ? 'mobile-open' : ''}`} aria-label="Sistem anatomi tubuh">
        <div className="panel-heading">
          <span>Sistem Anatomi</span>
          <Button variant="ghost" className="mobile-only icon-button" onClick={() => setPanel(null)} aria-label="Tutup panel sistem">
            <X size={18} />
          </Button>
          <Badge variant="secondary" className="desktop-only small-number">{activeSystems.length} Sistem</Badge>
        </div>

        {/* Quick Dissection Presets */}
        <div className="layer-presets">
          <Button
            variant="ghost"
            aria-pressed={state.visible.length >= 14}
            onClick={() => applyDissection(0)}
            title="Semua lapisan termasuk integumen"
          >
            Semua
          </Button>
          <Button
            variant="ghost"
            aria-pressed={state.visible.length === 13 && !state.visible.includes('integumentary')}
            onClick={() => applyDissection(25)}
            title="Lapisan otot, rangka, dan organ dalam"
          >
            Tanpa Kulit
          </Button>
          <Button
            variant="ghost"
            aria-pressed={state.visible.includes('cardiac') && !state.visible.includes('muscular') && !state.visible.includes('skeletal')}
            onClick={() => applyDissection(75)}
            title="Fokus organ viseral (Jantung, Paru, Lambung, Hati, Ginjal)"
          >
            Organ Dalam
          </Button>
          <Button
            variant="ghost"
            aria-pressed={state.visible.length === 1 && state.visible[0] === 'skeletal'}
            onClick={() => applyDissection(100)}
            title="Hanya struktur rangka tulang"
          >
            Rangka
          </Button>
        </div>

        <div className="system-list">
          {activeSystems.map(s => (
            <div className={`system-row ${state.visible.includes(s.id) ? 'enabled' : ''}`} key={s.id}>
              <Button
                variant="ghost"
                className="system-name"
                title={`Isolasi ${s.nameId}`}
                onClick={() => {
                  playSelectSound();
                  setState(v => ({ ...v, visible: [s.id], isolate: false, selected: [] }));
                }}
              >
                <span className="system-dot" style={{ background: s.color }} />
                {s.nameId}
                <span className="system-count">{counts[s.id]}</span>
              </Button>
              <Switch
                checked={state.visible.includes(s.id)}
                onCheckedChange={() => toggle(s.id)}
                aria-label={`Tampilkan ${s.nameId}`}
              />
            </div>
          ))}
        </div>

        <div className="panel-foot">
          <span>{visibleCount.toLocaleString()} struktur aktif</span>
          <Button variant="ghost" onClick={() => {
            playSelectSound();
            setState(s => ({ ...s, visible: [], selected: [], isolate: false }));
          }}>
            Sembunyikan Semua
          </Button>
        </div>
      </section>

      {/* Search Panel */}
      {panel === 'search' && (
        <section className="search-panel glass" aria-label="Cari struktur anatomi">
          <div className="panel-heading">
            <span>Cari Struktur Anatomi</span>
            <Button variant="ghost" className="icon-button" onClick={() => setPanel(null)} aria-label="Tutup pencarian">
              <X size={18} />
            </Button>
          </div>

          <div className="search-chips">
            {QUICK_CHIPS.map(chip => (
              <button
                key={chip.term}
                className="search-chip"
                onClick={() => {
                  playSelectSound();
                  setQuery(chip.term);
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <Combobox<Concept>
            items={results}
            value={null}
            onValueChange={value => {
              if (value) choose(value);
            }}
            inputValue={query}
            onInputValueChange={setQuery}
            itemToStringLabel={c => `${getIndonesianName(c.name)} (${c.name})`}
            filter={null}
            open
            onOpenChange={open => {
              if (!open) setPanel(null);
            }}
          >
            <ComboboxInput
              autoFocus
              placeholder="Ketik Jantung, Otak, Femur, Ren, Saraf..."
              aria-label="Cari nama struktur anatomi"
              showTrigger={false}
            />
            <ComboboxContent className="anatomy-search-results">
              <ComboboxEmpty>Tidak ada struktur anatomi yang cocok.</ComboboxEmpty>
              <ComboboxList>
                {(c: Concept) => (
                  <ComboboxItem key={c.id} value={c}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span className="search-result-name" style={{ fontWeight: 600 }}>
                        {getIndonesianName(c.name)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#8b9bb4', fontStyle: 'italic' }}>
                        {getLatinName(c.name) ? `${getLatinName(c.name)} · ` : ''}{c.name}
                      </span>
                    </div>
                    <span className="small-number">{c.elements.length} bagian</span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <p className="search-note">
            {query ? 'Menampilkan hingga 80 kecocokan. Dukungan nama Bahasa Indonesia, Latin, dan Inggris.' : 'Pilih chip di atas atau ketik nama organ untuk eksplorasi instan.'}
          </p>
        </section>
      )}

      {/* Camera View Controls */}
      <nav className="view-controls glass" aria-label="Kontrol sudut pandang kamera">
        {(['three-quarter', 'front', 'side', 'back'] as View[]).map((v, i) => (
          <Button
            variant="ghost"
            key={v}
            className={state.view === v ? 'active' : ''}
            aria-pressed={state.view === v}
            disabled={state.explode > 0.8 && v !== 'front'}
            onClick={() => {
              playSelectSound();
              setState(s => ({ ...s, view: v, reset: s.reset + 1, rotate: false }));
            }}
            title={`Sudut pandang ${v}`}
            aria-label={`Sudut pandang ${v}`}
          >
            <span>{['¾', 'F', 'S', 'B'][i]}</span>
          </Button>
        ))}
        <i />
        <Button
          variant="ghost"
          className={state.view === 'head' ? 'active' : ''}
          onClick={() => {
            playSelectSound();
            setState(s => ({ ...s, view: 'head', reset: s.reset + 1, rotate: false }));
          }}
          title="Fokus Kepala & Otak"
        >
          <span>K</span>
        </Button>
        <Button
          variant="ghost"
          className={state.view === 'chest' ? 'active' : ''}
          onClick={() => {
            playSelectSound();
            setState(s => ({ ...s, view: 'chest', reset: s.reset + 1, rotate: false }));
          }}
          title="Fokus Toraks (Dada & Jantung)"
        >
          <span>T</span>
        </Button>
        <Button
          variant="ghost"
          className={state.view === 'abdomen' ? 'active' : ''}
          onClick={() => {
            playSelectSound();
            setState(s => ({ ...s, view: 'abdomen', reset: s.reset + 1, rotate: false }));
          }}
          title="Fokus Abdomen (Organ Perut)"
        >
          <span>A</span>
        </Button>
        <Button
          variant="ghost"
          className={state.view === 'legs' ? 'active' : ''}
          onClick={() => {
            playSelectSound();
            setState(s => ({ ...s, view: 'legs', reset: s.reset + 1, rotate: false }));
          }}
          title="Fokus Tungkai & Kaki"
        >
          <span>L</span>
        </Button>
        <i />
        <Button
          variant="ghost"
          disabled={state.explode >= 0.4}
          aria-label={state.rotate ? 'Hentikan rotasi otomatis' : 'Putar tubuh 360° otomatis'}
          title="Putar Tubuh 360°"
          className={state.rotate ? 'active' : ''}
          onClick={() => setState(s => ({ ...s, rotate: !s.rotate }))}
        >
          {state.rotate ? <Pause size={17} /> : <RotateCw size={18} />}
        </Button>
        <Button variant="ghost" aria-label="Reset kamera dan tampilan" title="Reset Tampilan" onClick={reset}>
          <RotateCcw size={17} />
        </Button>
      </nav>

      {/* Caption indicator */}
      <div className="scene-caption">
        <span className="caption-line" />
        <span>
          {state.isolate
            ? `${getIndonesianName(chosen?.name ?? 'STRUKTUR TERISOLASI').toUpperCase()}`
            : state.clipping?.enabled
            ? `IRISAN CT CROSS-SECTION AKTIF (${state.clipping.plane.toUpperCase()})`
            : state.xray
            ? 'MODE RADIOGRAFIK X-RAY AKTIF'
            : state.explode > 0.95
            ? 'ANATOMICAL INVENTORY (TERURAI PENUH)'
            : state.explode > 0.05
            ? 'TAMPILAN TERURAI (EXPLODED VIEW)'
            : 'TUBUH MANUSIA DEWASA · POSISI ANATOMIS TEGAK'}
        </span>
        <span className="caption-line" />
      </div>

      {/* Live ECG Vitals Monitor HUD (Bottom Left) */}
      <div className="ecg-vitals-hud glass" title="Monitor Telemetri Fisiologis Pasien">
        <div className="ecg-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Heart size={13} className="text-red-500 animate-pulse" />
            <span style={{ fontWeight: 700, letterSpacing: '0.05em' }}>72</span>
            <span style={{ fontSize: '9px', color: '#94a3b8' }}>BPM</span>
          </div>
          <span className="ecg-status-pill">SINUS NORMAL</span>
        </div>
        <LiveEcgMonitor sound={soundOn} />
        <div className="ecg-stats-row">
          <span title="Tekanan Darah (Mean Arterial Pressure 93.3 mmHg)">TD: <b>120/80</b></span>
          <span title="Curah Jantung (Cardiac Output = SV 70mL × 72 BPM)">CO: <b>5.0 L/m</b></span>
          <span title="Laju Pernapasan Fisiologis (Tidal Volume ~500 mL)">Resp: <b>14 rpm</b></span>
          <span title="Saturasi Oksigen Perifer & Suhu Tubuh">SpO2: <b>99%</b></span>
        </div>
      </div>

      {/* Bottom Dock */}
      <div className="bottom-dock glass">
        <Button variant="ghost" className="mobile-only dock-layers" onClick={() => openPanel('layers')} aria-label="Buka sistem anatomi">
          <Layers3 size={20} />
          <span>Sistem</span>
        </Button>

        {/* Diseksi Bertahap Slider */}
        <div className="explode-control" style={{ marginRight: '12px' }}>
          <div className="explode-label">
            <label id="dissect-label">Diseksi Bertahap</label>
            <output>{state.dissection ?? 25}<span>%</span></output>
          </div>
          <Slider
            aria-labelledby="dissect-label"
            min={0}
            max={100}
            step={5}
            value={[state.dissection ?? 25]}
            onValueChange={v => {
              const val = Array.isArray(v) ? v[0] : v;
              applyDissection(val);
            }}
          />
          <div className="slider-endpoints">
            <span>Kulit</span>
            <span>Otot</span>
            <span>Organ</span>
            <span>Rangka</span>
          </div>
        </div>

        {/* Exploded View Slider */}
        <div className="explode-control">
          <div className="explode-label">
            <label id="explode-label">Tampilan Terurai</label>
            <output>{Math.round(state.explode * 100)}<span>%</span></output>
          </div>
          <Slider
            aria-labelledby="explode-label"
            min={0}
            max={100}
            step={1}
            value={[state.explode * 100]}
            onValueChange={v =>
              setState(s => ({
                ...s,
                explode: (Array.isArray(v) ? v[0] : v) / 100,
                view: (Array.isArray(v) ? v[0] : v) > 80 ? 'front' : s.view,
                rotate: false
              }))
            }
          />
          <div className="slider-endpoints">
            <span>Menyatu</span>
            <span>Terurai</span>
          </div>
        </div>

        <Button variant="ghost" className="dock-reset" onClick={reset} aria-label="Reset tampilan dan kamera">
          <RotateCcw size={18} />
          <span>Reset</span>
        </Button>
      </div>

      {/* Studio Footer */}
      <footer className="studio-footer">
        <span>
          {state.explode > 0.8 ? 'Tahan geser untuk menggeser' : 'Tahan geser untuk memutar 360°'} <b>·</b> Scroll untuk zoom <b>·</b> Klik bagian tubuh untuk inspeksi
        </span>
        <Button
          variant="ghost"
          onClick={() => {
            setDetails(false);
            setPanel(null);
            setAbout(true);
          }}
        >
          Sumber Data & Lisensi Medis <ArrowUpRight size={12} />
        </Button>
      </footer>

      {/* Loading overlay */}
      {progress < 100 && !error && (
        <div className="loading glass" role="status">
          <Activity size={18} />
          <div>
            <strong>Menyiapkan Anatomi 3D</strong>
            <span>{progress}% · Memuat {atlas?.parts.length.toLocaleString() ?? '2,234'} bagian tubuh asli</span>
            <div className="loading-track">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="loading glass error" role="alert">
          <p>{error}</p>
          <Button variant="ghost" onClick={() => location.reload()}>Muat Ulang Viewer</Button>
        </div>
      )}

      {/* Medical Inspector Dossier Sheet */}
      <Sheet open={details && selectedParts.length > 0} modal={false} disablePointerDismissal onOpenChange={setDetails}>
        <SheetContent initialFocus={detailTitle} className={`detail-sheet glass ${state.isolate ? 'is-isolated' : ''}`} showCloseButton={true}>
          <div className="detail-header">
            <div className="detail-accent" style={{ background: system?.color }} />
            <div className="eyebrow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{system?.nameId ?? system?.name ?? 'ANATOMI'}</span>
              {chosen && (
                <button
                  className="audio-pronounce-btn"
                  onClick={() => speak(`${getIndonesianName(chosen.name)}. ${getLatinName(chosen.name) || chosen.name}`)}
                  title="Dengarkan pelafalan audio medis"
                >
                  <Volume2 size={13} />
                  <span>Pelafalan</span>
                </button>
              )}
            </div>
            <SheetTitle ref={detailTitle} tabIndex={-1} className="structure-title">
              {chosen ? getIndonesianName(chosen.name) : ''}
            </SheetTitle>
            {chosen && getLatinName(chosen.name) && (
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#38bdf8', marginTop: '-6px' }}>
                Terminologia Anatomica: <strong>{getLatinName(chosen.name)}</strong>
              </div>
            )}
            {chosen && chosen.name.toLowerCase() !== getIndonesianName(chosen.name).toLowerCase() && (
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '-2px' }}>
                English: {chosen.name}
              </div>
            )}
          </div>

          <div className="detail-scroll" key={`${chosen?.id}-${state.isolate}`}>
            <SheetDescription className="structure-description">
              {chosen && selected ? explanation(chosen.name, selected.system) : ''}
            </SheetDescription>

            {/* Physiological Statistics Card */}
            {chosen && getPhysiologicalStat(chosen.name) && (
              <div className="physio-stat-card">
                <div className="physio-stat-title">{getPhysiologicalStat(chosen.name)!.stat}</div>
                <div className="physio-stat-val">{getPhysiologicalStat(chosen.name)!.value}</div>
                <div className="physio-stat-detail">{getPhysiologicalStat(chosen.name)!.detail}</div>
              </div>
            )}

            {/* Clinical Pathology Callout */}
            {chosen && getClinicalNote(chosen.name) && (
              <div className="clinical-callout">
                <div className="clinical-callout-head">
                  <Stethoscope size={14} />
                  <span>Korelasi Klinis & Patologi</span>
                </div>
                <div className="clinical-callout-text">
                  {getClinicalNote(chosen.name)}
                </div>
              </div>
            )}

            {chosen && !EXPLANATIONS[chosen.name.toLowerCase()] && (
              <span className="context-note">
                Ikhtisar sistem · Diidentifikasi dari dataset referensi anatomi BodyParts3D
              </span>
            )}

            <div className="structure-meta">
              <span>
                Referensi FMA/BP3D
                <strong>{chosen?.id}</strong>
              </span>
              <span>
                Bagian Terpilih
                <strong>{state.selected.length.toLocaleString()} bagian</strong>
              </span>
            </div>

            {selectedParts.length > 1 && (
              <div className="member-list">
                <h3>Elemen Anatomi Termasuk</h3>
                {selectedParts.slice(0, 50).map(p => (
                  <Button variant="ghost" key={p.id} onClick={() => choosePart(p.id)}>
                    <span>{getIndonesianName(p.name)} ({p.name})</span>
                    <ChevronRight size={14} />
                  </Button>
                ))}
                {selectedParts.length > 50 && (
                  <p>Dan {selectedParts.length - 50} elemen anatomis lainnya.</p>
                )}
              </div>
            )}

            <a className="source-link" href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noreferrer">
              Basis Data BodyParts3D <ArrowUpRight size={14} />
            </a>
          </div>

          <div className="detail-actions">
            <Button
              className={`primary-action ${state.isolate ? 'active' : ''}`}
              onClick={() => {
                playSelectSound();
                setState(s => ({ ...s, isolate: !s.isolate, explode: 0 }));
              }}
            >
              <Focus size={18} />
              {state.isolate ? 'Tampilkan Seluruh Tubuh' : 'Isolasi Struktur Ini'}
              <ChevronRight size={16} />
            </Button>
            <Button
              variant="ghost"
              className="secondary-action"
              onClick={() => {
                playSelectSound();
                setState(s => ({ ...s, selected: [], isolate: false }));
                setDetails(false);
              }}
            >
              Bersihkan Pilihan
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* About & License Sheet */}
      <Sheet open={about} onOpenChange={setAbout}>
        <SheetContent className="about-sheet glass">
          <div className="eyebrow">SUMBER & LISENSI MEDIS</div>
          <SheetTitle className="structure-title">Anatomi Manusia 3D Interaktif</SheetTitle>
          <SheetDescription>
            Eksplorasi model anatomi tubuh manusia dewasa komprehensif dari BodyParts3D.
          </SheetDescription>
          <div className="about-copy">
            <p>
              <strong>2,234 Bagian Poligon Asli · 3,432 Konsep Medis</strong><br />
              Model anatomi tubuh pria dewasa resmi yang diindeks secara saintifik dari database BodyParts3D (Database Center for Life Science, Jepang).
            </p>
            <p>
              Dilengkapi nomenklatur resmi tiga bahasa: Bahasa Indonesia, Latin (<em>Terminologia Anatomica</em>), dan Inggris, serta korelasi patologi klinis untuk pembelajaran kedokteran dan biologi.
            </p>
            <p>
              <strong>Peringatan Keselamatan Pendidikan:</strong><br />
              Aplikasi ini ditujukan murni sebagai media edukasi dan referensi anatomi interaktif. Tidak untuk digunakan sebagai pedoman diagnosis klinis mandiri atau perencanaan prosedur bedah invasif.
            </p>
            <h3>Atribusi Lisensi</h3>
            <p>
              BodyParts3D, © The Database Center for Life Science berlisensi Creative Commons Attribution 4.0 International (CC BY 4.0) dan CC BY-SA 2.1 JP.
            </p>
            <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" target="_blank" rel="noreferrer">
              Lisensi Dataset BodyParts3D <ArrowUpRight size={14} />
            </a>
            <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer">
              Geometri & Metadata Sumber <ArrowUpRight size={14} />
            </a>
            <a href="https://academic.oup.com/nar/article/37/suppl_1/D782/1000752" target="_blank" rel="noreferrer">
              Publikasi Ilmiah Sumber (Nucleic Acids Research) <ArrowUpRight size={14} />
            </a>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
