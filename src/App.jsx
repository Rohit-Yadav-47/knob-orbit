import { useEffect, useRef, useState } from 'react';
import { icons } from 'lucide-react';

const Icon = ({ name, ...props }) => {
  const C = icons[name] || icons.Circle;
  return <C {...props} />;
};

const rad = (deg) => (deg * Math.PI) / 180;
const polar = (r, deg) => [r * Math.sin(rad(deg)), -r * Math.cos(rad(deg))];

// Ring segment centred on 0deg (top), clockwise angles.
function wedge(span, ro, ri, gap = 1.2) {
  const a0 = -span / 2 + gap;
  const a1 = span / 2 - gap;
  const [x0, y0] = polar(ro, a0);
  const [x1, y1] = polar(ro, a1);
  const [x2, y2] = polar(ri, a1);
  const [x3, y3] = polar(ri, a0);
  return `M${x0} ${y0} A${ro} ${ro} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${ri} ${ri} 0 0 0 ${x3} ${y3}Z`;
}

export default function App() {
  const [view, setView] = useState(null);
  const [menu, setMenu] = useState(null);
  const [hud, setHud] = useState(null);

  useEffect(() => {
    window.orbit.onState((s) => {
      if (s.accent) {
        const [a, b] = Array.isArray(s.accent) ? s.accent : [s.accent, s.accent];
        document.documentElement.style.setProperty('--accent', a);
        document.documentElement.style.setProperty('--accent-2', b);
      }
      setView(s.view);
      if (s.view === 'menu') setMenu(s);
      if (s.view === 'hud') setHud(s);
    });
  }, []);

  return (
    <div className="stage">
      {menu && <Dial open={view === 'menu'} {...menu} />}
      {hud && <Hud open={view === 'hud'} {...hud} />}
    </div>
  );
}

/* ------------------------------------------------------------------ dial */
const R = 200;
const IN = 98;

function Dial({ open, items, sel, pos }) {
  const n = items.length;
  const step = 360 / n;
  const current = items[sel];
  const selAngle = sel * step;

  return (
    <div className={`dial ${open ? 'is-open' : ''}`}>
      <svg viewBox={`${-R - 30} ${-R - 30} ${2 * R + 60} ${2 * R + 60}`} className="dial-svg">
        <defs>
          <radialGradient id="body" cx="50%" cy="22%" r="85%">
            <stop offset="0%" stopColor="#2c2c3a" />
            <stop offset="100%" stopColor="#0e0e14" />
          </radialGradient>
          <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="45%" stopColor="#fff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.08" />
          </linearGradient>
          <radialGradient id="wedgeFill" cx="0" cy="0" r={R} gradientUnits="userSpaceOnUse">
            <stop offset={IN / R} stopColor="var(--accent)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="14" stdDeviation="18" floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>

        {/* body */}
        <circle r={R} fill="url(#body)" filter="url(#shadow)" opacity="0.96" />
        <circle r={R - 0.5} fill="none" stroke="url(#rim)" strokeWidth="1.2" />

        {/* watch-style ticks */}
        {Array.from({ length: 120 }, (_, i) => {
          const a = i * 3;
          const diff = Math.abs(((a - selAngle + 540) % 360) - 180);
          const near = diff < step / 2;
          const [x0, y0] = polar(R - 7, a);
          const [x1, y1] = polar(R - (i % 5 === 0 ? 13 : 10), a);
          return (
            <line key={i} x1={x0} y1={y0} x2={x1} y2={y1}
              className={`tick ${near ? 'tick-on' : ''}`} />
          );
        })}

        {/* selection */}
        <g className="sel" style={{ transform: `rotate(${pos * step}deg)` }}>
          <path d={wedge(step, R - 18, IN + 8)} fill="var(--accent)" filter="url(#glow)" opacity="0.55" />
          <path d={wedge(step, R - 18, IN + 8)} fill="url(#wedgeFill)" />
          <path d={wedge(step, R - 18, R - 21, 2.4)} fill="#fff" opacity="0.5" />
        </g>

        {/* separators */}
        {items.map((_, i) => {
          const [x0, y0] = polar(IN + 14, (i + 0.5) * step);
          const [x1, y1] = polar(R - 24, (i + 0.5) * step);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className="sep" />;
        })}

        {/* items */}
        {items.map((it, i) => {
          const [x, y] = polar((R - 18 + IN + 8) / 2, i * step);
          const on = i === sel;
          return (
            <g key={i} transform={`translate(${x} ${y})`}>
              <g className={`item ${on ? 'item-on' : ''}`}>
                <Icon name={it.icon} x={-11} y={-21} size={22} strokeWidth={on ? 2 : 1.6} />
                <text y={17} className="item-label">{it.label}</text>
              </g>
            </g>
          );
        })}

        {/* centre */}
        <circle r={IN - 2} fill="#0b0b10" opacity="0.9" />
        <circle r={IN - 2} fill="none" stroke="url(#rim)" strokeWidth="1" />
        <circle r={IN - 9} fill="none" className="centre-ring" />
      </svg>

      <div className="centre" key={sel}>
        <div className="centre-icon">
          <Icon name={current.icon} size={34} strokeWidth={1.7} />
        </div>
        <div className="centre-label">{current.label}</div>
        <div className={`chip ${current.type === 'mode' ? 'chip-mode' : ''}`}>
          {current.type === 'mode' ? 'Mode' : 'Action'}
        </div>
      </div>

      <div className="hint">
        <span className="kbd">⟲</span> rotate <span className="dot" /> <span className="kbd">●</span> click
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- hud */
function Hud({ open, item, tick }) {
  const [awake, setAwake] = useState(true);
  const timer = useRef();

  useEffect(() => {
    setAwake(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAwake(false), 1800);
    return () => clearTimeout(timer.current);
  }, [tick, open]);

  const r = 66;
  const trail = 46;
  const [tx0, ty0] = polar(r, -trail);
  const [tx1, ty1] = polar(r, trail);

  return (
    <div className={`hud ${open ? 'is-open' : ''} ${awake ? '' : 'is-sleepy'}`}>
      <svg viewBox="-90 -90 180 180" className="hud-svg">
        <defs>
          <radialGradient id="hudBody" cx="50%" cy="20%" r="85%">
            <stop offset="0%" stopColor="#2c2c3a" />
            <stop offset="100%" stopColor="#0e0e14" />
          </radialGradient>
          <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--accent-2)" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <filter id="hudShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000" floodOpacity="0.5" />
          </filter>
        </defs>
        <circle r="84" fill="url(#hudBody)" filter="url(#hudShadow)" opacity="0.96" />
        <circle r="83.5" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="1" />
        <circle r={r} fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth="6" />
        {Array.from({ length: 12 }, (_, i) => {
          const [x0, y0] = polar(r + 9, i * 30);
          const [x1, y1] = polar(r + 12, i * 30);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className="tick" />;
        })}
        <g className="sel" style={{ transform: `rotate(${tick * 30}deg)` }}>
          <path d={`M${tx0} ${ty0} A${r} ${r} 0 0 1 ${tx1} ${ty1}`} fill="none"
            stroke="url(#trail)" strokeWidth="6" strokeLinecap="round" />
          <circle cy={-r} r="9" fill="var(--accent)" opacity="0.35" />
          <circle cy={-r} r="5.5" fill="#fff" />
        </g>
      </svg>
      <div className="hud-centre">
        <Icon name={item.icon} size={24} strokeWidth={1.8} />
        <div className="hud-label">{item.label}</div>
        <div className="hud-hint">click to exit</div>
      </div>
    </div>
  );
}
