import {
  type DesignSystem,
  type Page,
  type SlideMeta,
  type SlideTransition,
  useIsActivePage,
  useSlidePageNumber,
} from '@open-slide/core';
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import useA from './assets/use-a-business.jpg';
import useB from './assets/use-b-env.jpg';
import useC from './assets/use-c-list.jpg';
import useD from './assets/use-d-drawer.jpg';
import useE from './assets/use-e-watch.jpg';
import useF from './assets/use-f-report.jpg';

// Radar cinematic: deep navy night sky, brand blue sweep, one data-driven radar
// bookending the deck (cover = first frame, closing = last frame).
export const design: DesignSystem = {
  palette: { bg: '#0a1431', text: '#e8edfb', accent: '#5b80ff' },
  fonts: {
    display:
      '"IBM Plex Sans KR", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    body: '"IBM Plex Sans KR", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif',
  },
  typeScale: { hero: 168, body: 34 },
  radius: 18,
};

const ink = {
  muted: '#8d9ac4',
  dim: '#5f6c96',
  line: 'rgba(132, 158, 238, 0.14)',
  lineHi: 'rgba(132, 158, 238, 0.34)',
  panel: 'rgba(19, 32, 72, 0.82)',
  panelEdge: 'rgba(120, 150, 240, 0.22)',
  blip: '#7d99ff',
  soft: 'rgba(91, 128, 255, 0.36)',
  mint: '#7ee2a8',
  amber: '#ffb547',
  gray: '#4b5781',
  node: '#14214a',
  deep: '#0a1431',
};

const MONO = '"IBM Plex Mono", "IBM Plex Sans KR", "SF Mono", Menlo, Consolas, monospace';
const DISPLAY = 'var(--osd-font-display)';

// ─── Webfont + keyframes (module-level, slide-keyed, create-or-update) ───

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap';
const FONT_LINK_ID = 'osd-webfont-regrader-intro';
const STYLE_ID = 'osd-styles-regrader-intro';

// Tracker status colors: 미검토 → 검토중 → 조치필요 → 조치완료
const STATUS = [ink.gray, '#5b80ff', ink.amber, ink.mint];

const dotKeys = STATUS.map((c, k) => {
  const on = k * 25;
  return `@keyframes rgx-d${k} {
    0%, ${on}% { background: ${ink.gray}; box-shadow: 0 0 0 0 transparent; }
    ${on + 2}%, 97% { background: ${c}; box-shadow: 0 0 0 7px ${c}2e; }
    100% { background: ${ink.gray}; box-shadow: 0 0 0 0 transparent; }
  }`;
}).join('\n');

// ─── 사용법 장면: 실제 사이트 화면(2026-10-05) 위에서 커서 · 강조 · 확대가 움직인다 ───
// 좌표는 화면 비율(0~1). 시간은 초이고, k 로 페이지 길이(내레이션)에 맞춰 늘린다.

const FW = 1088; // 화면 크기 (사이트 1440×900 의 비율 그대로)
const FH = 680;
type Pt = [number, number, number]; // t, x, y
type CamPt = [number, number, number, number]; // t, scale, centerX, centerY
type UseDef = { id: string; k: number; dur: number; cursor: Pt[]; clicks: number[]; cam: CamPt[] };

const U1: UseDef = {
  id: 'u1',
  k: 1.12,
  dur: 16,
  cursor: [[0, 0.55, 0.62], [1.0, 0.55, 0.62], [2.4, 0.837, 0.19], [3.6, 0.837, 0.19], [5.0, 0.68, 0.4], [8.6, 0.68, 0.4], [9.8, 0.585, 0.62], [16, 0.585, 0.62]],
  clicks: [2.55],
  cam: [[0, 1, 0.5, 0.5], [4.4, 1, 0.5, 0.5], [5.4, 1.25, 0.58, 0.57], [16, 1.25, 0.58, 0.57]],
};
const U2: UseDef = {
  id: 'u2',
  k: 1,
  dur: 17,
  cursor: [[0, 0.6, 0.75], [0.8, 0.6, 0.75], [2.2, 0.4, 0.408], [3.5, 0.4, 0.408], [5.2, 0.7, 0.62], [10.2, 0.7, 0.62], [11.4, 0.538, 0.224], [17, 0.538, 0.224]],
  clicks: [2.35],
  cam: [[0, 1, 0.5, 0.5], [4.6, 1, 0.5, 0.5], [5.4, 1.4, 0.69, 0.7], [10.2, 1.4, 0.69, 0.7], [11.0, 1.4, 0.55, 0.3], [17, 1.4, 0.55, 0.3]],
};
const U3: UseDef = {
  id: 'u3',
  k: 1,
  dur: 16,
  cursor: [[0, 0.4, 0.6], [0.6, 0.4, 0.6], [1.9, 0.085, 0.402], [3.0, 0.085, 0.402], [4.2, 0.29, 0.15], [6.4, 0.45, 0.55], [8.4, 0.948, 0.035], [9.6, 0.948, 0.035], [10.8, 0.5, 0.536], [13.2, 0.5, 0.536], [14.2, 0.45, 0.66], [16, 0.45, 0.66]],
  clicks: [2.05, 8.6],
  cam: [[0, 1, 0.5, 0.5], [9.6, 1, 0.5, 0.5], [10.4, 1.3, 0.5, 0.52], [16, 1.3, 0.5, 0.52]],
};

const camT = (s: number, cx: number, cy: number) => {
  const tx = Math.min(0, Math.max(FW - s * FW, FW / 2 - s * cx * FW));
  const ty = Math.min(0, Math.max(FH - s * FH, FH / 2 - s * cy * FH));
  return `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s})`;
};
const useKeys = [U1, U2, U3].map((u) => {
  const pc = (t: number) => `${((t / u.dur) * 100).toFixed(3)}%`;
  const cur = u.cursor.map(([t, x, y]) => `${pc(t)} { transform: translate(${(x * FW).toFixed(1)}px, ${(y * FH).toFixed(1)}px); }`).join(' ');
  const clk = ['0% { transform: scale(1); }', ...u.clicks.flatMap((t) => [`${pc(t - 0.12)} { transform: scale(1); }`, `${pc(t)} { transform: scale(0.78); }`, `${pc(t + 0.18)} { transform: scale(1); }`]), '100% { transform: scale(1); }'].join(' ');
  const cam = u.cam.map(([t, sc, cx, cy]) => `${pc(t)} { transform: ${camT(sc, cx, cy)}; }`).join(' ');
  return `@keyframes rgx-cur-${u.id} { ${cur} } @keyframes rgx-clk-${u.id} { ${clk} } @keyframes rgx-cam-${u.id} { ${cam} }`;
}).join('\n');

const ANIMATED = [
  'rgx-rise', 'rgx-fade', 'rgx-grow', 'rgx-pop', 'rgx-draw', 'rgx-ticker', 'rgx-scan',
  'rgx-ping', 'rgx-travel', 'rgx-node', 'rgx-state', 'rgx-pill', 'rgx-dot', 'rgx-cursor',
  'rgx-shotin', 'rgx-ring', 'rgx-ringkeep', 'rgx-ripple', 'rgx-stepon', 'rgx-cur', 'rgx-clk', 'rgx-cam',
];
const stillSel = ANIMATED.map((c) => `[data-still] .${c}`).join(', ');
const reducedSel = ANIMATED.map((c) => `.${c}`).join(', ');

// Base styles are the resting state; keyframes describe where things come from.
const css = `
  .rgx-rise { animation: rgx-rise 0.9s cubic-bezier(0.2, 1.08, 0.32, 1) both; }
  .rgx-fade { animation: rgx-fade 1s ease-out both; }
  .rgx-grow { animation: rgx-grow 1.2s cubic-bezier(0.16, 1, 0.3, 1) both; transform-origin: 0 50%; }
  .rgx-pop { animation: rgx-pop 0.5s cubic-bezier(0.2, 1.25, 0.35, 1) both; }
  .rgx-draw { stroke-dasharray: 400; animation: rgx-draw 1.1s cubic-bezier(0.4, 0, 0.2, 1) both; }
  .rgx-ticker { animation: rgx-ticker 70s linear infinite; }
  .rgx-scan { opacity: 0; animation: rgx-scan 3.4s cubic-bezier(0.45, 0, 0.2, 1) infinite both; }
  .rgx-ping { animation: rgx-ping 2s ease-out infinite; }
  .rgx-travel { opacity: 0; animation: rgx-travel 5s linear infinite; }
  .rgx-node { animation: rgx-node 5s ease-out infinite; }
  .rgx-state { animation: rgx-state 8s linear infinite both; }
  .rgx-pill { animation: rgx-pill 8s linear infinite; }
  .rgx-cursor { animation: rgx-cursor 2s cubic-bezier(0.45, 0, 0.2, 1) infinite; }

  .rgx-shotin { animation: rgx-shotin 0.45s ease-out both; }
  .rgx-ring { opacity: 0; animation: rgx-ring linear both; }
  .rgx-ringkeep { animation: rgx-ringkeep 0.4s cubic-bezier(0.2, 1.1, 0.3, 1) both; }
  .rgx-ripple { opacity: 0; animation: rgx-ripple 0.7s ease-out both; }
  .rgx-stepon { animation: rgx-stepon 0.5s ease-out both; }
  .rgx-cur, .rgx-clk, .rgx-cam { animation-timing-function: cubic-bezier(0.45, 0, 0.2, 1); animation-fill-mode: both; }
  @keyframes rgx-shotin { from { opacity: 0; } }
  @keyframes rgx-ring { 0% { opacity: 0; transform: scale(1.06); } 6% { opacity: 1; transform: scale(1); } 90% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1); } }
  @keyframes rgx-ringkeep { from { opacity: 0; transform: scale(1.06); } }
  @keyframes rgx-ripple { 0% { opacity: 0; transform: scale(0.4); } 2% { opacity: 0.9; transform: scale(0.4); } 100% { opacity: 0; transform: scale(2.6); } }
  @keyframes rgx-stepon { from { opacity: 0.28; } }
  ${useKeys}
  @keyframes rgx-rise { from { opacity: 0; transform: translateY(22px); filter: blur(8px); } }
  @keyframes rgx-fade { from { opacity: 0; } }
  @keyframes rgx-grow { from { transform: scaleX(0); } }
  @keyframes rgx-pop { from { opacity: 0; transform: scale(0.2); } }
  @keyframes rgx-draw { from { stroke-dashoffset: 400; } }
  @keyframes rgx-ticker { to { transform: translateX(-50%); } }
  @keyframes rgx-scan {
    0% { transform: translateX(0); opacity: 0; }
    6% { opacity: 1; }
    62% { transform: translateX(var(--rgx-dist)); opacity: 1; }
    70%, 100% { transform: translateX(var(--rgx-dist)); opacity: 0; }
  }
  @keyframes rgx-ping { 0% { transform: scale(0.6); opacity: 0.85; } 100% { transform: scale(2.8); opacity: 0; } }
  @keyframes rgx-travel {
    0% { transform: translateX(0); opacity: 0; }
    3% { opacity: 1; }
    72% { transform: translateX(var(--rgx-dist)); opacity: 1; }
    80%, 100% { transform: translateX(var(--rgx-dist)); opacity: 0; }
  }
  @keyframes rgx-node {
    0% { background: #5b80ff; border-color: #9fb4ff; transform: scale(1.08); }
    24%, 100% { background: ${ink.node}; border-color: ${ink.lineHi}; transform: scale(1); }
  }
  @keyframes rgx-state {
    0% { opacity: 0; transform: translateY(12px); filter: blur(6px); }
    3%, 22% { opacity: 1; transform: translateY(0); filter: blur(0); }
    25%, 100% { opacity: 0; transform: translateY(-12px); filter: blur(6px); }
  }
  @keyframes rgx-pill {
    0%, 23% { background: ${STATUS[0]}; }
    26%, 48% { background: ${STATUS[1]}; }
    51%, 73% { background: ${STATUS[2]}; }
    76%, 98% { background: ${STATUS[3]}; }
    100% { background: ${STATUS[0]}; }
  }
  @keyframes rgx-cursor {
    0% { transform: translate(0, 0) scale(0.82); }
    8% { transform: translate(0, 0) scale(1); }
    45% { transform: translate(110px, 84px) scale(1); }
    88% { transform: translate(0, 0) scale(1); }
    100% { transform: translate(0, 0) scale(0.82); }
  }
  ${dotKeys}
  ${stillSel} { animation: none !important; }
  @media (prefers-reduced-motion: reduce) { ${reducedSel} { animation: none !important; } }
`;

if (typeof document !== 'undefined') {
  let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== FONT_HREF) link.href = FONT_HREF;

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}

// ─── Page transition: hold + settle ───

const EASE_OUT = 'cubic-bezier(0, 0, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

export const transition: SlideTransition = {
  duration: 260,
  exit: { duration: 260, easing: EASE_IN, keyframes: [{ opacity: 1 }, { opacity: 1 }] },
  enter: {
    duration: 260,
    easing: EASE_OUT,
    keyframes: [
      { opacity: 0, transform: 'translateY(8px)', filter: 'blur(3px)' },
      { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
    ],
  },
};

// ─── Helpers ───

const vars = (o: Record<string, string>) => o as CSSProperties;
const fmt = (n: number) => n.toLocaleString('en-US');
const pad2 = (n: number) => String(n).padStart(2, '0');
const prefersReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Counts up from 0 when the page becomes active; inactive pages show the final value.
function useCountUp(to: number, delay = 0, duration = 1600) {
  const active = useIsActivePage();
  const [v, setV] = useState(to);
  useLayoutEffect(() => {
    if (!active || prefersReduced()) {
      setV(to);
      return;
    }
    setV(0);
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / duration));
      setV(Math.round(to * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, to, delay, duration]);
  return v;
}

const Count = ({ to, delay = 0, duration = 1600 }: { to: number; delay?: number; duration?: number }) => {
  const v = useCountUp(to, delay, duration);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</span>;
};

// ─── Radar data: every dot is one real 2026 amendment (RegRader, 2026-10-05) ───
// Encoded as dayOfYear*32 + ringIndex*4 + risk*2 + adminRule.

const EV_RAW = '9,9,16,16,17,17,17,17,17,17,17,20,20,20,21,21,22,24,24,24,24,24,24,24,24,25,25,25,25,25,25,25,25,26,26,26,26,26,26,28,28,28,28,28,28,29,29,29,36,40,40,40,40,44,44,44,44,44,44,44,48,48,48,48,48,48,52,52,52,52,52,52,52,52,56,56,56,56,56,56,56,56,56,56,56,56,56,56,56,56,56,56,56,56,56,56,57,57,57,57,57,57,57,57,60,60,60,60,60,60,60,60,60,60,153,181,184,184,285,349,477,489,688,693,697,860,1001,1004,1004,1012,1012,1012,1012,1012,1012,1016,1016,1020,1020,1080,1117,1292,1596,1596,1596,1697,1724,1753,1789,1789,1805,1844,1844,1846,1846,1848,1848,1848,1850,1908,1909,1909,1909,1909,1909,1909,1909,1909,1909,1909,1909,1909,1909,1909,1909,1909,1909,1910,1913,1942,1980,1980,2009,2054,2072,2192,2192,2194,2196,2204,2205,2205,2268,2273,2416,2417,2424,2424,2426,2492,2492,2494,2494,2494,2516,2520,2520,2520,2520,2520,2522,2632,2636,2636,2640,2640,2644,2644,2644,2644,2648,2649,2652,2652,2652,2652,2652,2652,2652,2652,2652,2652,2652,2716,2716,2716,2716,2716,2716,2716,2749,2845,2865,2868,2873,2876,2876,2876,2904,2904,2905,2906,2968,3065,3092,3097,3100,3100,3117,3164,3289,3289,3289,3289,3289,3289,3289,3289,3289,3321,3534,3548,3548,3581,3581,3608,3637,3637,3637,3640,3640,3640,3768,3772,3773,3801,3805,3805,3806,3806,3817,3836,3860,3864,3864,3865,3868,3957,3957,3957,3957,3957,3957,3957,3957,3957,3957,3957,3957,4020,4028,4028,4029,4045,4045,4061,4088,4093,4189,4200,4208,4208,4208,4208,4209,4210,4210,4220,4220,4220,4220,4220,4222,4222,4256,4256,4281,4285,4429,4430,4436,4468,4468,4509,4509,4509,4646,4656,4664,4665,4677,4697,4716,4716,4716,4732,4734,4734,4734,4848,4849,4849,4853,4854,4854,4856,4857,4857,4861,4869,4876,4892,4892,4904,4904,4904,4908,4908,4924,4924,4925,5108,5116,5116,5172,5341,5353,5373,5493,5532,5532,5532,5532,5532,5532,5532,5532,5532,5532,5532,5533,5537,5544,5550,5561,5561,5580,5582,5588,5588,5652,5652,5653,5653,5657,5660,5660,5661,5729,5764,5773,5784,5785,5785,5789,5793,5793,5796,5800,5800,5800,5800,5801,5804,5805,5808,5808,5808,5808,5809,5809,5809,5812,5812,5812,5812,5812,5812,5812,5812,5812,5813,5813,5813,5813,5813,5816,5816,5816,5816,5816,5816,5816,5816,5817,5820,5820,5820,5820,5821,5837,5949,5998,5998,6004,6012,6025,6037,6068,6069,6077,6085,6237,6270,6297,6425,6436,6462,6500,6502,6653,6653,6653,6653,6653,6665,6676,6676,6680,6681,6717,6776,6776,6777,6805,6806,6806,6806,6845,6888,6889,6889,6904,6904,6925,7101,7112,7112,7128,7193,7348,7385,7404,7405,7408,7408,7408,7408,7408,7410,7420,7422,7570,7570,7669,7673,7732,7753,7793,7793,7798,7801,7801,7833,7837,7849,8022,8022,8025,8068,8108,8109,8109,8109,8109,8109,8109,8110,8110,8124,8124,8217,8221,8336,8336,8336,8336,8337,8338,8338,8338,8340,8340,8340,8340,8341,8344,8348,8348,8348,8348,8348,8348,8348,8348,8348,8348,8348,8348,8348,8349,8476,8604,8604,8604,8604,8649,8661,8680,8692,8697,8697,8750,8750,8760,8760,8760,8760,8760,8776,8776,8776,8776,8780,8780,8784,8784,8784,8784,8788,8792,8792,8792,8792,8796,8978,8980,8982,8988,8988,8988,8988,8990,9432,10102,10108,10108,10110,10110,10138,10140,10358,10576,10576,10580,10617,10760,10760,10928,10928,10930,10932,10970,10992,10996,11004,11006,11293,11668,11668';
const TODAY = 277; // 2026-10-05, zero-based day of year
const TAU = Math.PI * 2;
const PERIOD = 7.5; // seconds per sweep
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const RINGS = ['지식재산권', '지배구조', '공정거래', '정보보호', '인사노무', '안전', '재무회계', '환경'];

const angOf = (doy: number) => -Math.PI / 2 + ((doy + 0.5) / 365) * TAU;
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Ev = { a: number; u: number; risk: boolean; future: boolean };

const EVENTS: Ev[] = EV_RAW.split(',').map((s, i) => {
  const v = Number(s);
  const doy = v >> 5;
  const ring = (v >> 2) & 7;
  return {
    a: angOf(doy + hash(i) * 1.8),
    u: (ring + 0.16 + 0.68 * hash(i + 999)) / 8,
    risk: ((v >> 1) & 1) === 1,
    future: doy > TODAY,
  };
});

function drawRadar(ctx: CanvasRenderingContext2D, S: number, phi: number, revealTo: number | null) {
  const cx = S / 2;
  const cy = S / 2;
  const R = S * 0.43;
  const r0 = S * 0.085;
  const k = S / 960;
  ctx.clearRect(0, 0, S, S);

  const disc = ctx.createRadialGradient(cx, cy, r0, cx, cy, R);
  disc.addColorStop(0, 'rgba(91, 128, 255, 0.10)');
  disc.addColorStop(1, 'rgba(91, 128, 255, 0.025)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();

  // Not yet in force: today → year end
  ctx.fillStyle = 'rgba(126, 226, 168, 0.05)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R, angOf(TODAY), -Math.PI / 2 + TAU);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    ctx.strokeStyle = i === 8 ? 'rgba(132, 158, 238, 0.5)' : 'rgba(132, 158, 238, 0.14)';
    ctx.beginPath();
    ctx.arc(cx, cy, r0 + ((R - r0) * i) / 8, 0, TAU);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 ${Math.round(18 * k)}px "IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif`;
  MONTH_START.forEach((d, m) => {
    const a = angOf(d - 0.5);
    ctx.strokeStyle = 'rgba(132, 158, 238, 0.16)';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * (R + 10 * k), cy + Math.sin(a) * (R + 10 * k));
    ctx.stroke();
    const am = angOf(d + 14);
    ctx.fillStyle = 'rgba(165, 184, 240, 0.62)';
    ctx.fillText(`${m + 1}월`, cx + Math.cos(am) * (R + 30 * k), cy + Math.sin(am) * (R + 30 * k));
  });

  ctx.textAlign = 'right';
  ctx.font = `500 ${Math.round(15 * k)}px "IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif`;
  ctx.fillStyle = 'rgba(165, 184, 240, 0.5)';
  ctx.strokeStyle = 'rgba(10, 20, 49, 0.9)';
  ctx.lineWidth = 4 * k;
  RINGS.forEach((name, j) => {
    const y = cy - (r0 + ((R - r0) * (j + 0.5)) / 8);
    ctx.strokeText(name, cx - 12 * k, y);
    ctx.fillText(name, cx - 12 * k, y);
  });

  // Sweep wedge + leading edge
  const W = 0.9;
  if (typeof ctx.createConicGradient === 'function') {
    const cg = ctx.createConicGradient(phi - W, cx, cy);
    cg.addColorStop(0, 'rgba(91, 128, 255, 0)');
    cg.addColorStop((W / TAU) * 0.995, 'rgba(120, 152, 255, 0.30)');
    cg.addColorStop(W / TAU, 'rgba(91, 128, 255, 0)');
    cg.addColorStop(1, 'rgba(91, 128, 255, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, phi - W, phi);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(178, 198, 255, 0.9)';
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(phi) * r0, cy + Math.sin(phi) * r0);
  ctx.lineTo(cx + Math.cos(phi) * R, cy + Math.sin(phi) * R);
  ctx.stroke();

  let shown = 0;
  for (const e of EVENTS) {
    if (revealTo !== null && e.a > revealTo) continue;
    shown++;
    const d = (((phi - e.a) % TAU) + TAU) % TAU;
    const glow = Math.exp(-d / 0.75);
    const r = r0 + (R - r0) * e.u;
    const x = cx + Math.cos(e.a) * r;
    const y = cy + Math.sin(e.a) * r;
    const color = e.risk ? ink.amber : e.future ? ink.mint : ink.blip;
    const size = (e.risk ? 4.6 : 3.4) * k;
    if (glow > 0.08) {
      ctx.globalAlpha = glow * 0.3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size * (2.2 + 2 * glow), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 0.42 + 0.58 * glow;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    if (e.future && !e.risk) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6 * k;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Today
  const aT = angOf(TODAY);
  ctx.setLineDash([6 * k, 6 * k]);
  ctx.strokeStyle = 'rgba(126, 226, 168, 0.85)';
  ctx.lineWidth = 1.6 * k;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(aT) * r0, cy + Math.sin(aT) * r0);
  ctx.lineTo(cx + Math.cos(aT) * R, cy + Math.sin(aT) * R);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = ink.mint;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(aT) * R, cy + Math.sin(aT) * R, 5 * k, 0, TAU);
  ctx.fill();

  ctx.fillStyle = ink.deep;
  ctx.beginPath();
  ctx.arc(cx, cy, r0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(132, 158, 238, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8edfb';
  ctx.font = `600 ${Math.round(26 * k)}px "IBM Plex Mono", Menlo, monospace`;
  ctx.fillText('2026', cx, cy);
  return shown;
}

const Radar = ({
  size,
  intro = false,
  hitRef,
}: {
  size: number;
  intro?: boolean;
  hitRef?: RefObject<HTMLSpanElement | null>;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const active = useIsActivePage();
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = active ? Math.min(2, window.devicePixelRatio || 1) : 1;
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!active || prefersReduced()) {
      const paint = () => drawRadar(ctx, size, angOf(TODAY), null);
      paint();
      document.fonts?.ready.then(paint);
      if (hitRef?.current) hitRef.current.textContent = fmt(EVENTS.length);
      return;
    }
    let raf = 0;
    let last = -1;
    const t0 = performance.now();
    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      const phi = intro ? -Math.PI / 2 + (t / PERIOD) * TAU : angOf(TODAY) + (t / PERIOD) * TAU;
      const shown = drawRadar(ctx, size, phi, intro && t < PERIOD ? phi : null);
      if (hitRef?.current && shown !== last) {
        hitRef.current.textContent = fmt(shown);
        last = shown;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, size, intro, hitRef]);
  return <canvas ref={ref} style={{ width: size, height: size, display: 'block' }} />;
};

// ─── Shared building blocks ───

const fill: CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  background: 'var(--osd-bg)',
  color: 'var(--osd-text)',
  fontFamily: 'var(--osd-font-body)',
  letterSpacing: '-0.01em',
  wordBreak: 'keep-all',
  WebkitFontSmoothing: 'antialiased',
};

const Logo = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block', flex: 'none' }}>
    <rect width="32" height="32" rx="9" fill="#3056d3" />
    <circle cx="16" cy="16" r="9.5" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="1.8" />
    <circle cx="16" cy="16" r="5" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.8" />
    <path d="M16 16 22.7 9.3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="16" cy="16" r="2" fill="#fff" />
    <circle cx="21.2" cy="20.6" r="1.7" fill="#7ee2a8" />
  </svg>
);

// Faint dot grid + radar arcs drifting in from the top-right corner.
const Backdrop = ({ arcs }: { arcs: boolean }) => (
  <>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(rgba(132, 158, 238, 0.16) 1.4px, transparent 1.6px)',
        backgroundSize: '48px 48px',
        backgroundPosition: '24px 24px',
        maskImage: 'radial-gradient(ellipse at 70% 30%, #000 0%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 70% 30%, #000 0%, transparent 75%)',
      }}
    />
    {arcs && (
      <svg
        width="900"
        height="900"
        viewBox="0 0 900 900"
        style={{ position: 'absolute', right: -420, top: -440, opacity: 0.9 }}
      >
        <circle cx="450" cy="450" r="440" fill="none" stroke={ink.line} strokeWidth="1.5" />
        <circle cx="450" cy="450" r="330" fill="none" stroke={ink.line} strokeWidth="1.5" />
        <circle cx="450" cy="450" r="220" fill="none" stroke={ink.line} strokeWidth="1.5" />
        <circle cx="450" cy="450" r="110" fill="none" stroke={ink.line} strokeWidth="1.5" />
      </svg>
    )}
  </>
);

const Footer = () => {
  const { current, total } = useSlidePageNumber();
  return (
    <div
      style={{
        position: 'absolute',
        left: 140,
        right: 140,
        bottom: 44,
        zIndex: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: MONO,
        fontSize: 20,
        lineHeight: 1,
        letterSpacing: '0.14em',
        color: ink.dim,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Logo size={24} />
        REGRADER
      </span>
      <span>DATA AS OF 2026.10.05</span>
      <span style={{ color: ink.muted }}>
        {pad2(current)} / {pad2(total)}
      </span>
    </div>
  );
};

const Frame = ({
  children,
  footer = true,
  arcs = true,
}: {
  children: ReactNode;
  footer?: boolean;
  arcs?: boolean;
}) => {
  const active = useIsActivePage();
  return (
    <div style={fill} data-still={active ? undefined : ''}>
      <Backdrop arcs={arcs} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          boxSizing: 'border-box',
          padding: '112px 140px 120px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
      {footer && <Footer />}
    </div>
  );
};

const Eyebrow = ({ code, children }: { code: string; children: ReactNode }) => (
  <div className="rgx-rise" style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 24, lineHeight: 1.1 }}>
    <span style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: '0.2em', color: 'var(--osd-accent)' }}>
      {code}
    </span>
    <span style={{ width: 40, height: 2, background: ink.lineHi }} />
    <span style={{ color: ink.muted, fontWeight: 500 }}>{children}</span>
  </div>
);

const Heading = ({ children, size = 64 }: { children: ReactNode; size?: number }) => (
  <h2
    className="rgx-rise"
    style={{
      animationDelay: '90ms',
      margin: '24px 0 0',
      fontFamily: 'var(--osd-font-display)',
      fontSize: size,
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.035em',
      textWrap: 'balance',
    }}
  >
    {children}
  </h2>
);

const Pill = ({ children, color = ink.muted, solid }: { children: ReactNode; color?: string; solid?: boolean }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 40,
      padding: '0 16px',
      borderRadius: 20,
      fontSize: 21,
      fontWeight: 500,
      color: solid ? ink.deep : color,
      background: solid ? color : 'transparent',
      border: `1.5px solid ${solid ? color : `${color}88`}`,
    }}
  >
    {children}
  </span>
);

const Readout = ({ label, children, accent }: { label: string; children: ReactNode; accent?: boolean }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <span style={{ fontSize: 20, color: ink.muted, fontWeight: 500 }}>{label}</span>
    <span
      style={{
        fontFamily: MONO,
        fontSize: 44,
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: '-0.02em',
        color: accent ? ink.mint : 'var(--osd-text)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </span>
  </div>
);

const LegendDot = ({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        boxSizing: 'border-box',
        background: hollow ? 'transparent' : color,
        border: `2px solid ${color}`,
      }}
    />
    {label}
  </span>
);

// ─── 1. Cover ───

const Cover: Page = () => {
  const hits = useRef<HTMLSpanElement>(null);
  return (
    <Frame footer={false} arcs={false}>
      <div style={{ position: 'absolute', left: 940, top: 60 }}>
        <Radar size={960} intro hitRef={hits} />
      </div>
      <div
        style={{
          position: 'relative',
          width: 800,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div className="rgx-rise" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Logo size={60} />
          <span style={{ fontSize: 28, fontWeight: 500, color: ink.muted }}>법규 개정 모니터링 시스템</span>
        </div>
        <h1
          className="rgx-rise"
          style={{
            animationDelay: '120ms',
            margin: '36px 0 0',
            fontFamily: 'var(--osd-font-display)',
            fontSize: 'var(--osd-size-hero)',
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.045em',
          }}
        >
          Reg<span style={{ color: 'var(--osd-accent)' }}>Rader</span>
        </h1>
        <p
          className="rgx-rise"
          style={{ animationDelay: '260ms', margin: '40px 0 0', fontSize: 42, lineHeight: 1.45, fontWeight: 400 }}
        >
          우리 회사에 해당하는 법규 개정을
          <br />
          매일 아침 먼저 찾아 드립니다.
        </p>
        <div className="rgx-rise" style={{ animationDelay: '420ms', display: 'flex', gap: 56, marginTop: 64 }}>
          <Readout label="마지막 스캔">10.05 07:43</Readout>
          <Readout label="적용법규">923</Readout>
          <Readout label="올해 포착" accent>
            <span ref={hits}>660</span>
          </Readout>
        </div>
        <div
          className="rgx-fade"
          style={{ animationDelay: '700ms', display: 'flex', gap: 32, marginTop: 52, fontSize: 22, color: ink.muted }}
        >
          <LegendDot color={ink.blip} label="개정 1건" />
          <LegendDot color={ink.amber} label="벌칙·과태료·의무 변경" />
          <LegendDot color={ink.mint} label="시행 예정" hollow />
        </div>
        <div className="rgx-fade" style={{ animationDelay: '800ms', marginTop: 14, fontSize: 22, color: ink.dim }}>
          링 = 직무 · 12시 방향 = 1월 1일 · 점선 = 오늘
        </div>
      </div>
    </Frame>
  );
};

// ─── 2. Problem ───

const LAWS_A = [
  '상수원관리규칙', '종합부동산세법', '대외무역법', '도시가스사업법', '근로자퇴직급여 보장법',
  '환경기술 및 환경산업 지원법', '노동조합 및 노동관계조정법', '화학물질관리법', '원자력안전법',
  '파견근로자보호 등에 관한 법률', '상법', '산업안전보건기준에 관한 규칙',
];
const LAWS_B = [
  '대기환경보전법', '수도법', '토양환경보전법', '환경정책기본법', '지방세법', '법인세법',
  '개인정보 보호법', '연구실 안전환경 조성에 관한 법률', '물환경보전법', '에너지이용 합리화법',
  '국제조세조정에 관한 법률', '장애인고용촉진 및 직업재활법',
];
const LAWS_C = [
  '보세창고 특허 및 운영에 관한 고시', '특허·실용신안 심사기준', '관세조사 운영에 관한 훈령',
  '2026년 적용 최저임금 고시', '보세운송에 관한 고시', '순환자원 지정 등에 관한 고시',
  '화학물질의 분류 및 표시 등에 관한 규정', '녹색인증제 운영요령', '안전검사 고시',
  '외부감사 및 회계 등에 관한 규정',
];
const LAWS_D = [
  '폐기물관리법', '식품위생법', '고용정책 기본법', '건축법', '대리점 거래의 공정화에 관한 법률',
  '자본시장과 금융투자업에 관한 법률', '최저임금법', '관세법', '전기안전관리법', '고용보험법',
  '고압가스 안전관리법', '하도급거래 공정화에 관한 법률', '순환경제사회 전환 촉진법', '근로기준법',
];

const TickerSet = ({ items }: { items: string[] }) => (
  <div style={{ display: 'flex', flex: 'none' }}>
    {items.map((t) => (
      <span key={t} style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
        {t}
        <span style={{ margin: '0 28px', color: ink.dim }}>/</span>
      </span>
    ))}
  </div>
);

const TickerRow = ({
  items,
  top,
  seconds,
  reverse,
  color,
}: {
  items: string[];
  top: number;
  seconds: number;
  reverse?: boolean;
  color: string;
}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top,
      height: 52,
      overflow: 'hidden',
      fontSize: 32,
      lineHeight: '52px',
      color,
      maskImage: 'linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)',
      WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)',
    }}
  >
    <div
      className="rgx-ticker"
      style={{
        display: 'flex',
        width: 'max-content',
        animationDuration: `${seconds}s`,
        animationDirection: reverse ? 'reverse' : 'normal',
      }}
    >
      <TickerSet items={items} />
      <TickerSet items={items} />
    </div>
  </div>
);

const Problem: Page = () => (
  <Frame>
    <Eyebrow code="WHY">왜 필요한가</Eyebrow>
    <div className="rgx-rise" style={{ animationDelay: '100ms', display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 36 }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 220, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.05em' }}>
        <Count to={5426} duration={2200} />
      </span>
      <span style={{ fontSize: 56, fontWeight: 600, color: ink.muted }}>건</span>
    </div>
    <p className="rgx-rise" style={{ animationDelay: '250ms', margin: '28px 0 0', fontSize: 34, color: ink.muted }}>
      2026년에 시행되는 법령 개정 · 국가법령정보센터 기준, 행정규칙 제외
    </p>
    <h2
      className="rgx-rise"
      style={{ animationDelay: '450ms', margin: '44px 0 0', fontSize: 60, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.035em' }}
    >
      하루 평균 <span style={{ color: 'var(--osd-accent)' }}>15건</span>.
      <br />
      매일 모두 확인하기는 어렵습니다.
    </h2>
    <div className="rgx-fade" style={{ animationDelay: '600ms' }}>
      <TickerRow items={LAWS_A} top={720} seconds={80} color="rgba(141, 154, 196, 0.55)" />
      <TickerRow items={LAWS_B} top={782} seconds={95} reverse color="rgba(141, 154, 196, 0.38)" />
      <TickerRow items={LAWS_C} top={844} seconds={70} color="rgba(141, 154, 196, 0.55)" />
      <TickerRow items={LAWS_D} top={906} seconds={105} reverse color="rgba(141, 154, 196, 0.38)" />
    </div>
  </Frame>
);

// ─── 3. Funnel ───

const FunnelRow = ({
  n,
  plus,
  label,
  sub,
  width,
  color,
  delay,
}: {
  n: number;
  plus?: boolean;
  label: string;
  sub: string;
  width: number;
  color: string;
  delay: number;
}) => (
  <div style={{ display: 'grid', gridTemplateColumns: '330px 760px 1fr', alignItems: 'center', height: 124 }}>
    <div
      className="rgx-rise"
      style={{
        animationDelay: `${delay}ms`,
        paddingRight: 40,
        textAlign: 'right',
        fontFamily: DISPLAY,
        fontSize: 76,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '-0.04em',
        color,
      }}
    >
      <Count to={n} delay={delay} duration={1400} />
      {plus && '+'}
    </div>
    <div style={{ position: 'relative', height: 40 }}>
      <div
        className="rgx-grow"
        style={{ animationDelay: `${delay}ms`, position: 'absolute', left: 0, top: 0, bottom: 0, width, borderRadius: 4, background: color }}
      />
      <div
        className="rgx-scan"
        style={{
          ...vars({ '--rgx-dist': `${width - 4}px` }),
          animationDelay: `${delay + 1300}ms`,
          position: 'absolute',
          left: 0,
          top: -8,
          bottom: -8,
          width: 4,
          borderRadius: 2,
          background: '#ffffff',
        }}
      />
    </div>
    <div className="rgx-rise" style={{ animationDelay: `${delay + 150}ms`, paddingLeft: 40 }}>
      <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.25 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 24, color: ink.muted }}>{sub}</div>
    </div>
  </div>
);

const Funnel: Page = () => (
  <Frame>
    <Eyebrow code="WHAT">하는 일</Eyebrow>
    <Heading size={72}>필요한 것만 남기고 걸러 냅니다</Heading>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 64 }}>
      <FunnelRow n={5426} plus label="올해 시행되는 법령 개정" sub="국가법령정보센터 · 행정규칙 제외" width={760} color="rgba(141, 154, 196, 0.55)" delay={200} />
      <FunnelRow n={660} label="우리 회사에 해당하는 개정" sub="적용법규 923개 기준" width={574} color="#5b80ff" delay={550} />
      <FunnelRow n={35} label="아직 시행 전" sub="준비할 시간이 남은 개정" width={314} color="#9cb2ff" delay={900} />
      <FunnelRow n={9} label="30일 안에 시행" sub="지금 바로 챙길 개정" width={194} color={ink.mint} delay={1250} />
    </div>
  </Frame>
);

// ─── 4. How it works ───

const PipeNode = ({ i, mark, mono, title, desc }: { i: number; mark: string; mono?: boolean; title: string; desc: ReactNode }) => (
  <div style={{ width: 328, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
    <div
      className="rgx-node"
      style={{
        animationDelay: `${i * 0.9}s`,
        width: 140,
        height: 140,
        boxSizing: 'border-box',
        borderRadius: '50%',
        border: `2px solid ${ink.lineHi}`,
        background: ink.node,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: mono ? MONO : 'var(--osd-font-display)',
        fontSize: mono ? 30 : 34,
        fontWeight: mono ? 500 : 700,
        position: 'relative',
        zIndex: 1,
      }}
    >
      {mark}
    </div>
    <div className="rgx-rise" style={{ animationDelay: `${200 + i * 120}ms`, marginTop: 36, fontSize: 36, fontWeight: 700, lineHeight: 1.3 }}>
      {title}
    </div>
    <div className="rgx-rise" style={{ animationDelay: `${280 + i * 120}ms`, marginTop: 12, fontSize: 26, lineHeight: 1.5, color: ink.muted }}>
      {desc}
    </div>
  </div>
);

const HudItem = ({ k, v }: { k: string; v: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 14 }}>
    <span style={{ fontFamily: MONO, fontSize: 20, letterSpacing: '0.16em', color: 'var(--osd-accent)' }}>{k}</span>
    <span style={{ fontSize: 26, color: 'var(--osd-text)' }}>{v}</span>
  </span>
);

const Pipeline: Page = () => (
  <Frame>
    <Eyebrow code="HOW">작동 방식</Eyebrow>
    <Heading>매일 아침, 사람 손을 거치지 않고 돌아갑니다</Heading>
    <div style={{ position: 'absolute', left: 140, top: 400, width: 1640 }}>
      <div
        className="rgx-grow"
        style={{ animationDelay: '150ms', position: 'absolute', left: 164, top: 69, width: 1312, height: 2, background: ink.lineHi }}
      />
      <div
        className="rgx-travel"
        style={{
          ...vars({ '--rgx-dist': '1312px' }),
          position: 'absolute',
          left: 153,
          top: 59,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: ink.mint,
          boxShadow: '0 0 0 6px rgba(126, 226, 168, 0.18)',
          zIndex: 0,
        }}
      />
      <div style={{ display: 'flex' }}>
        <PipeNode i={0} mark="07:00" mono title="자동 시작" desc={<>정해진 시간에<br />스스로 시작</>} />
        <PipeNode i={1} mark="수집" title="법령 수집" desc={<>국가법령정보센터에서<br />개정 정보를 가져옴</>} />
        <PipeNode i={2} mark="대조" title="회사 기준 대조" desc={<>적용법규 923개와 비교해<br />해당하는 것만 남김</>} />
        <PipeNode i={3} mark="분석" title="개정문 분석" desc={<>벌칙·과태료·의무가<br />바뀐 조문을 표시</>} />
        <PipeNode i={4} mark="게시" title="사이트 갱신" desc={<>추가·삭제된 개정도<br />내역으로 기록</>} />
      </div>
    </div>
    <div
      className="rgx-fade"
      style={{
        animationDelay: '900ms',
        position: 'absolute',
        left: 140,
        right: 140,
        top: 868,
        paddingTop: 28,
        borderTop: `1px solid ${ink.line}`,
        display: 'flex',
        gap: 64,
      }}
    >
      <HudItem k="SOURCE" v="국가법령정보센터 Open API" />
      <HudItem k="SCHEDULE" v="매일 07:00" />
      <HudItem k="SCOPE" v="적용법규 923개" />
    </div>
  </Frame>
);

// ─── 5. Scope ───

const TreeRow = ({
  y,
  x,
  tag,
  name,
  tone = ink.muted,
  delay,
}: {
  y: number;
  x: number;
  tag: string;
  name: string;
  tone?: string;
  delay: number;
}) => (
  <div
    className="rgx-rise"
    style={{
      animationDelay: `${delay}ms`,
      position: 'absolute',
      left: x,
      top: y - 22,
      height: 44,
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      whiteSpace: 'nowrap',
    }}
  >
    <Pill color={tone}>{tag}</Pill>
    <span style={{ fontSize: 30, fontWeight: 600 }}>{name}</span>
  </div>
);

const RuleRow = ({ y, name, delay }: { y: number; name: string; delay: number }) => (
  <div
    className="rgx-rise"
    style={{ animationDelay: `${delay}ms`, position: 'absolute', left: 124, top: y - 18, height: 36, fontSize: 24, lineHeight: '36px', color: ink.muted, whiteSpace: 'nowrap' }}
  >
    {name}
  </div>
);

const Scope: Page = () => (
  <Frame>
    <Eyebrow code="SCOPE">지켜보는 범위</Eyebrow>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 36 }}>
      <span
        className="rgx-rise"
        style={{ animationDelay: '100ms', fontFamily: DISPLAY, fontSize: 220, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.05em', color: 'var(--osd-accent)' }}
      >
        <Count to={923} duration={1800} />
      </span>
      <span className="rgx-rise" style={{ animationDelay: '200ms', fontSize: 48, fontWeight: 700 }}>
        개 적용법규
      </span>
    </div>
    <div style={{ width: 760, marginTop: 44 }}>
      <div className="rgx-grow" style={{ animationDelay: '400ms', display: 'flex', height: 22, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: '27.5%', background: 'var(--osd-accent)' }} />
        <div style={{ flex: 1, background: ink.soft }} />
      </div>
      <div className="rgx-rise" style={{ animationDelay: '600ms', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24, fontSize: 28 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 16, height: 16, borderRadius: 3, background: 'var(--osd-accent)' }} />
          법령 <b style={{ fontFamily: MONO, fontWeight: 600 }}>254</b>
          <span style={{ color: ink.muted }}>법률 · 시행령 · 시행규칙</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 16, height: 16, borderRadius: 3, background: ink.soft }} />
          행정규칙 <b style={{ fontFamily: MONO, fontWeight: 600 }}>669</b>
          <span style={{ color: ink.muted }}>고시 · 훈령 · 예규</span>
        </span>
      </div>
    </div>
    <div
      className="rgx-rise"
      style={{ animationDelay: '800ms', width: 760, marginTop: 48, paddingTop: 32, borderTop: `1px solid ${ink.line}`, fontSize: 30, lineHeight: 1.5 }}
    >
      84개 법령 계열 · 8개 직무
      <div style={{ fontSize: 26, color: ink.muted, marginTop: 8 }}>공장 건설 → 제품 생산 → 판매·수출입, 그리고 회사 공통 업무</div>
    </div>

    <div style={{ position: 'absolute', left: 1020, top: 230, width: 760, height: 620 }}>
      <div className="rgx-fade" style={{ animationDelay: '300ms', fontSize: 22, fontWeight: 500, color: ink.muted }}>
        법령체계도 예시
      </div>
      <div style={{ position: 'absolute', left: 0, top: 70, width: 760, height: 540 }}>
        <svg width="760" height="540" style={{ position: 'absolute', inset: 0 }}>
          <path className="rgx-draw" style={{ animationDelay: '500ms' }} d="M22 60 V268 M22 114 H50 M22 268 H50" fill="none" stroke={ink.lineHi} strokeWidth="2" />
          <path className="rgx-draw" style={{ animationDelay: '700ms' }} d="M78 136 V190 M78 190 H106" fill="none" stroke={ink.lineHi} strokeWidth="2" />
          <path className="rgx-draw" style={{ animationDelay: '1000ms' }} d="M78 290 V432 M78 336 H106 M78 384 H106 M78 432 H106" fill="none" stroke={ink.lineHi} strokeWidth="2" />
        </svg>
        <TreeRow y={38} x={0} tag="법률" name="화학물질관리법" tone="#9cb2ff" delay={400} />
        <TreeRow y={114} x={56} tag="시행령" name="화학물질관리법 시행령" delay={600} />
        <TreeRow y={190} x={112} tag="시행규칙" name="화학물질관리법 시행규칙" delay={800} />
        <TreeRow y={268} x={56} tag="행정규칙 32" name="고시 29 · 예규 3" tone={ink.mint} delay={1000} />
        <RuleRow y={336} name="유해화학물질 보관시설 설치 및 관리에 관한 고시" delay={1150} />
        <RuleRow y={384} name="유해화학물질 소량 취급시설에 관한 고시" delay={1250} />
        <RuleRow y={432} name="사고대비물질의 지정" delay={1350} />
        <div className="rgx-fade" style={{ animationDelay: '1500ms', position: 'absolute', left: 124, top: 466, fontSize: 22, color: ink.dim }}>
          + 29건 더
        </div>
      </div>
    </div>
  </Frame>
);

// ─── 6. This year ───

const JobRow = ({ i, name, s, t }: { i: number; name: string; s: number; t: number }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', alignItems: 'center', height: 56 }}>
    <span style={{ fontSize: 30, fontWeight: 600 }}>{name}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div className="rgx-grow" style={{ animationDelay: `${300 + i * 90}ms`, display: 'flex', height: 26, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: s * 3.9, background: 'var(--osd-accent)' }} />
        <div style={{ width: t * 3.9, background: ink.soft }} />
      </div>
      <span className="rgx-fade" style={{ animationDelay: `${700 + i * 90}ms`, fontFamily: MONO, fontSize: 28, fontWeight: 500 }}>
        {s + t}
      </span>
    </div>
  </div>
);

const QuarterTile = ({ q, n, live, delay }: { q: string; n: number; live?: boolean; delay: number }) => (
  <div
    className="rgx-rise"
    style={{
      animationDelay: `${delay}ms`,
      height: 190,
      boxSizing: 'border-box',
      padding: '28px 30px',
      borderRadius: 'var(--osd-radius)',
      background: ink.panel,
      border: `1px solid ${live ? `${ink.mint}66` : ink.panelEdge}`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}
  >
    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 26, color: ink.muted }}>
      {q}
      {live && <span style={{ fontSize: 20, fontWeight: 600, color: ink.mint }}>진행 중</span>}
    </span>
    <span style={{ fontFamily: DISPLAY, fontSize: 72, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em' }}>
      <Count to={n} delay={delay} duration={1300} />
    </span>
  </div>
);

const ThisYear: Page = () => (
  <Frame>
    <Eyebrow code="2026">올해 현황</Eyebrow>
    <Heading size={72}>
      올해 우리 회사 법규 개정{' '}
      <span style={{ color: 'var(--osd-accent)' }}>
        <Count to={660} duration={1600} />
      </span>
      건
    </Heading>
    <div style={{ display: 'flex', gap: 100, marginTop: 52 }}>
      <div style={{ width: 1080 }}>
        <div className="rgx-fade" style={{ animationDelay: '200ms', display: 'flex', alignItems: 'center', gap: 32, marginBottom: 20, fontSize: 24, color: ink.muted }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 16, height: 16, borderRadius: 3, background: 'var(--osd-accent)' }} />
            실질 개정 456
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 16, height: 16, borderRadius: 3, background: ink.soft }} />
            타법개정 204
          </span>
          <span style={{ color: ink.dim }}>다른 법이 바뀌며 용어·인용만 정리된 개정</span>
        </div>
        <JobRow i={0} name="환경" s={111} t={75} />
        <JobRow i={1} name="재무회계" s={124} t={38} />
        <JobRow i={2} name="안전" s={90} t={43} />
        <JobRow i={3} name="인사노무" s={57} t={14} />
        <JobRow i={4} name="정보보호" s={32} t={18} />
        <JobRow i={5} name="공정거래" s={24} t={14} />
        <JobRow i={6} name="지배구조" s={10} t={2} />
        <JobRow i={7} name="지식재산권" s={8} t={0} />
      </div>
      <div style={{ width: 460 }}>
        <div className="rgx-fade" style={{ animationDelay: '200ms', marginBottom: 20, fontSize: 24, color: ink.muted }}>
          분기별 시행
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <QuarterTile q="1분기" n={248} delay={500} />
          <QuarterTile q="2분기" n={177} delay={600} />
          <QuarterTile q="3분기" n={177} delay={700} />
          <QuarterTile q="4분기" n={58} live delay={800} />
        </div>
      </div>
    </div>
  </Frame>
);

// ─── 7. Sanctions & duties ───

const TypeRow = ({ i, label, n }: { i: number; label: string; n: number }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', height: 52 }}>
    <span style={{ fontSize: 28, fontWeight: 600 }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        className="rgx-grow"
        style={{ animationDelay: `${500 + i * 90}ms`, width: n * 7, height: 22, borderRadius: 4, background: ink.amber, opacity: 1 - i * 0.12 }}
      />
      <span className="rgx-fade" style={{ animationDelay: `${900 + i * 90}ms`, fontFamily: MONO, fontSize: 26 }}>
        {n}
      </span>
    </div>
  </div>
);

const Evidence = ({ refText, text, kind, delay }: { refText: string; text: string; kind: string; delay: number }) => (
  <div
    className="rgx-rise"
    style={{ animationDelay: `${delay}ms`, display: 'grid', gridTemplateColumns: '170px 1fr auto', alignItems: 'center', gap: 16, height: 64, borderTop: `1px solid ${ink.line}` }}
  >
    <span style={{ fontFamily: MONO, fontSize: 22, color: '#9cb2ff' }}>{refText}</span>
    <span style={{ fontSize: 28 }}>{text}</span>
    <span style={{ fontSize: 22, fontWeight: 600, color: ink.amber }}>{kind}</span>
  </div>
);

const Sanctions: Page = () => (
  <Frame>
    <Eyebrow code="FLAG">중점 관리</Eyebrow>
    <Heading>벌칙·과태료·의무가 바뀐 개정은 따로 표시합니다</Heading>
    <div style={{ display: 'grid', gridTemplateColumns: '640px 880px', gap: 120, marginTop: 56 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <span
            className="rgx-rise"
            style={{ animationDelay: '150ms', fontFamily: DISPLAY, fontSize: 200, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.05em', color: ink.amber }}
          >
            <Count to={69} delay={150} duration={1400} />
          </span>
          <span className="rgx-rise" style={{ animationDelay: '250ms', fontSize: 48, fontWeight: 700 }}>
            건
          </span>
        </div>
        <div className="rgx-rise" style={{ animationDelay: '300ms', marginTop: 16, fontSize: 28, color: ink.muted }}>
          올해 660건 중 제재·의무가 바뀐 개정
        </div>
        <div style={{ marginTop: 40 }}>
          <TypeRow i={0} label="의무" n={54} />
          <TypeRow i={1} label="과태료" n={16} />
          <TypeRow i={2} label="벌칙" n={15} />
          <TypeRow i={3} label="처분" n={11} />
          <TypeRow i={4} label="과징금" n={10} />
        </div>
        <div className="rgx-fade" style={{ animationDelay: '1300ms', marginTop: 16, fontSize: 22, color: ink.dim }}>
          한 건에 여러 항목이 함께 바뀔 수 있습니다
        </div>
      </div>

      <div
        className="rgx-rise"
        style={{
          animationDelay: '400ms',
          boxSizing: 'border-box',
          padding: '44px 48px 36px',
          borderRadius: 'var(--osd-radius)',
          background: ink.panel,
          border: `1px solid ${ink.panelEdge}`,
          boxShadow: '0 40px 80px -40px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          <Pill>환경</Pill>
          <Pill>2026.11.12 시행</Pill>
          <Pill color={ink.mint}>D-38</Pill>
        </div>
        <div style={{ marginTop: 24, fontSize: 52, fontWeight: 700, letterSpacing: '-0.03em' }}>대기환경보전법</div>
        <div style={{ marginTop: 8, fontSize: 26, color: ink.muted }}>저공해자동차 충전시설 관련 조문 신설·변경</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <Pill color={ink.amber} solid>의무 신설</Pill>
          <Pill color={ink.amber}>과태료 신설</Pill>
          <Pill color={ink.amber}>벌칙 신설</Pill>
        </div>
        <div style={{ marginTop: 36, marginBottom: 8, fontSize: 22, fontWeight: 500, color: ink.dim }}>
          개정문에서 찾은 근거
        </div>
        <Evidence refText="제58조의10" text="충전시설 설치정보 전산망 등록" kind="의무" delay={900} />
        <Evidence refText="제94조 ④" text="등록하지 않으면 과태료" kind="과태료" delay={1100} />
        <Evidence refText="제92조" text="조치명령 불이행 시 벌칙" kind="벌칙" delay={1300} />
      </div>
    </div>
  </Frame>
);

// ─── 8. Coming soon ───

const PX_PER_DAY = 1640 / 87; // 10.05 → 12.31
const xOf = (daysFromToday: number) => daysFromToday * PX_PER_DAY;

const Stack = ({ days, n, risk }: { days: number; n: number; risk: number }) => {
  const x = xOf(days);
  const base = 300 + (x / 1640) * 2000;
  return (
    <div style={{ position: 'absolute', left: x - 8, bottom: 14, display: 'flex', flexDirection: 'column-reverse', gap: 8 }}>
      {Array.from({ length: n }, (_, k) => (
        <span
          key={k}
          className="rgx-pop"
          style={{ animationDelay: `${base + k * 60}ms`, width: 16, height: 16, borderRadius: '50%', background: k < risk ? ink.amber : ink.blip }}
        />
      ))}
    </div>
  );
};

const DateMark = ({ days, label, align = 'center' }: { days: number; label: string; align?: 'center' | 'right' }) => (
  <span
    style={{
      position: 'absolute',
      left: xOf(days),
      top: 316,
      transform: align === 'center' ? 'translateX(-50%)' : 'translateX(-100%)',
      fontFamily: MONO,
      fontSize: 20,
      color: ink.muted,
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </span>
);

const MonthLine = ({ days, label }: { days: number; label: string }) => (
  <div style={{ position: 'absolute', left: xOf(days), top: 0, bottom: 0, borderLeft: `1.5px dashed ${ink.line}` }}>
    <span style={{ position: 'absolute', left: 10, top: 6, fontSize: 22, color: ink.dim, whiteSpace: 'nowrap' }}>{label}</span>
  </div>
);

const Chip = ({ children, risk }: { children: ReactNode; risk?: boolean }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 44,
      padding: '0 18px',
      borderRadius: 22,
      fontSize: 24,
      background: ink.panel,
      border: `1.5px solid ${risk ? `${ink.amber}bb` : ink.panelEdge}`,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

const Soon: Page = () => (
  <Frame>
    <Eyebrow code="SOON">시행 임박</Eyebrow>
    <Heading>곧 시행되는 개정을 미리 알려 드립니다</Heading>
    <div
      className="rgx-fade"
      style={{ animationDelay: '200ms', position: 'absolute', right: 140, top: 262, display: 'flex', gap: 28, fontSize: 22, color: ink.muted }}
    >
      <LegendDot color={ink.amber} label="벌칙·과태료·의무 변경" />
      <LegendDot color={ink.blip} label="그 밖의 개정" />
    </div>

    <div style={{ position: 'absolute', left: 140, top: 320, width: 1640, height: 300 }}>
      <div
        className="rgx-fade"
        style={{
          animationDelay: '150ms',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: xOf(30),
          background: 'rgba(126, 226, 168, 0.06)',
          borderRight: `1.5px dashed ${ink.mint}66`,
        }}
      >
        <span style={{ position: 'absolute', left: 18, top: 10, fontSize: 24, fontWeight: 600, color: ink.mint }}>30일 이내 · 9건</span>
      </div>
      <MonthLine days={27} label="11월" />
      <MonthLine days={57} label="12월" />
      <div style={{ position: 'absolute', left: -1, top: -44, bottom: 0, width: 2, background: ink.mint }}>
        <span style={{ position: 'absolute', left: 12, top: -2, fontSize: 22, fontWeight: 600, color: ink.mint, whiteSpace: 'nowrap' }}>오늘 10.05</span>
      </div>
      <div className="rgx-grow" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: ink.lineHi }} />
      <div
        className="rgx-scan"
        style={{ ...vars({ '--rgx-dist': '1640px' }), animationDelay: '300ms', position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'rgba(178, 198, 255, 0.3)' }}
      />
      <Stack days={3} n={8} risk={3} />
      <Stack days={17} n={1} risk={0} />
      <Stack days={38} n={5} risk={3} />
      <Stack days={39} n={2} risk={1} />
      <Stack days={46} n={1} risk={1} />
      <Stack days={53} n={3} risk={0} />
      <Stack days={54} n={1} risk={0} />
      <Stack days={59} n={2} risk={0} />
      <Stack days={64} n={4} risk={1} />
      <Stack days={65} n={1} risk={1} />
      <Stack days={66} n={4} risk={1} />
      <Stack days={75} n={1} risk={0} />
      <Stack days={87} n={2} risk={0} />
      <span
        className="rgx-fade"
        style={{ animationDelay: '900ms', position: 'absolute', left: xOf(3) + 22, bottom: 172, fontFamily: MONO, fontSize: 24, fontWeight: 600, color: ink.mint }}
      >
        D-3
      </span>
      <DateMark days={3} label="10.08" />
      <DateMark days={17} label="10.22" />
      <DateMark days={38} label="11.12" />
      <DateMark days={53} label="11.27" />
      <DateMark days={64} label="12.08" />
      <DateMark days={87} label="12.31" align="right" />
    </div>

    <div style={{ position: 'absolute', left: 140, top: 700, width: 1640, display: 'grid', gridTemplateColumns: '1000px 1fr', gap: 80 }}>
      <div className="rgx-rise" style={{ animationDelay: '1200ms' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, fontSize: 30, fontWeight: 700 }}>
          30일 안에 시행
          <span style={{ fontFamily: MONO, color: ink.mint }}>9건</span>
          <span style={{ fontSize: 22, fontWeight: 400, color: ink.muted }}>10.08 · 8건 / 10.22 · 1건</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
          <Chip risk>근로기준법</Chip>
          <Chip risk>화학물질관리법</Chip>
          <Chip risk>감염병예방법</Chip>
          <Chip>탄소중립기본법</Chip>
          <Chip>탄소중립기본법 시행령</Chip>
          <Chip>배출권거래법 시행령</Chip>
          <Chip>식품위생법</Chip>
          <Chip>환경정책기본법 시행령</Chip>
          <Chip>대외무역법</Chip>
        </div>
      </div>
      <div className="rgx-rise" style={{ animationDelay: '1350ms' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, fontSize: 30, fontWeight: 700 }}>
          31일 이후 시행
          <span style={{ fontFamily: MONO, color: '#9cb2ff' }}>26건</span>
        </div>
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 24 }}>
          <span>
            <b style={{ fontWeight: 600 }}>11월 · 12건</b>
            <span style={{ color: ink.muted }}>  대기환경보전법 · 폐기물관리법 …</span>
          </span>
          <span>
            <b style={{ fontWeight: 600 }}>12월 · 14건</b>
            <span style={{ color: ink.muted }}>  근로기준법 · 자본시장법 …</span>
          </span>
        </div>
      </div>
    </div>
  </Frame>
);

// ─── 9. Tracker ───

const StatusLabel = ({ k, text, dark }: { k: number; text: string; dark?: boolean }) => (
  <span
    className="rgx-state"
    style={{
      animationDelay: `${k * 2}s`,
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 34,
      fontWeight: 700,
      color: dark ? ink.deep : '#ffffff',
      opacity: k === 3 ? 1 : 0,
    }}
  >
    {text}
  </span>
);

const TrackStep = ({ k, label }: { k: number; label: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
    <span
      className="rgx-dot"
      style={{
        animationName: `rgx-d${k}`,
        animationDuration: '8s',
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: STATUS[k],
        border: `3px solid ${ink.deep}`,
      }}
    />
    <span style={{ fontSize: 24, color: ink.muted, whiteSpace: 'nowrap' }}>{label}</span>
  </div>
);

const Point = ({ n, title, desc, delay }: { n: string; title: string; desc: string; delay: number }) => (
  <div className="rgx-rise" style={{ animationDelay: `${delay}ms` }}>
    <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: '0.12em', color: 'var(--osd-accent)' }}>{n}</div>
    <div style={{ marginTop: 10, fontSize: 36, fontWeight: 700 }}>{title}</div>
    <div style={{ marginTop: 10, fontSize: 26, lineHeight: 1.5, color: ink.muted }}>{desc}</div>
  </div>
);

const Cursor = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" style={{ display: 'block' }}>
    <path d="M4 2.5 19.5 11 12.6 12.8 9.4 19.6Z" fill="#ffffff" stroke={ink.deep} strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const Tracker: Page = () => (
  <Frame>
    <Eyebrow code="ACTION">대응 현황</Eyebrow>
    <Heading>담당자는 사이트에서 바로 대응 상태를 기록합니다</Heading>
    <div
      className="rgx-rise"
      style={{
        animationDelay: '200ms',
        position: 'absolute',
        left: 140,
        top: 290,
        width: 940,
        boxSizing: 'border-box',
        padding: '48px 52px 44px',
        borderRadius: 'var(--osd-radius)',
        background: ink.panel,
        border: `1px solid ${ink.panelEdge}`,
        boxShadow: '0 40px 80px -40px rgba(0, 0, 0, 0.6)',
      }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        <Pill>인사노무</Pill>
        <Pill color={ink.mint}>D-3</Pill>
        <Pill color={ink.amber}>벌칙 변경</Pill>
      </div>
      <div style={{ marginTop: 26, fontSize: 56, fontWeight: 700, letterSpacing: '-0.03em' }}>근로기준법</div>
      <div style={{ marginTop: 10, fontSize: 28, color: ink.muted }}>2026.10.08 시행 · 일부개정</div>
      <div style={{ marginTop: 48, fontSize: 22, fontWeight: 500, color: ink.dim }}>대응 상태</div>
      <div style={{ position: 'relative', marginTop: 16, width: 320, height: 84 }}>
        <div className="rgx-pill" style={{ position: 'absolute', inset: 0, borderRadius: 42, background: STATUS[3] }}>
          <StatusLabel k={0} text="미검토" />
          <StatusLabel k={1} text="검토중" />
          <StatusLabel k={2} text="조치필요" dark />
          <StatusLabel k={3} text="조치완료" dark />
        </div>
        <span
          className="rgx-ping"
          style={{ position: 'absolute', left: 250, top: 34, width: 18, height: 18, borderRadius: '50%', border: '2px solid #ffffff', animationDuration: '2s' }}
        />
        <div className="rgx-cursor" style={{ position: 'absolute', left: 252, top: 36 }}>
          <Cursor />
        </div>
      </div>
      <div style={{ position: 'relative', marginTop: 52, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div style={{ position: 'absolute', left: '12.5%', right: '12.5%', top: 11, height: 2, background: ink.lineHi }} />
        <TrackStep k={0} label="미검토" />
        <TrackStep k={1} label="검토중" />
        <TrackStep k={2} label="조치필요" />
        <TrackStep k={3} label="조치완료 · 해당없음" />
      </div>
    </div>
    <div style={{ position: 'absolute', left: 1180, top: 300, width: 600, display: 'flex', flexDirection: 'column', gap: 44 }}>
      <Point n="01" title="직무별 담당자" desc="8개 직무마다 담당자가 자기 직무의 개정을 확인합니다" delay={400} />
      <Point n="02" title="시행 전 대응 우선" desc="시행이 가까운 미완료 건을 먼저 보여 줍니다" delay={550} />
      <Point n="03" title="보고서에 자동 반영" desc="진행 현황이 임원 보고 PPT·Excel에 그대로 들어갑니다" delay={700} />
    </div>
  </Frame>
);

// ─── 10. Keeps growing ───

const Feature = ({ code, title, desc, data, delay }: { code: string; title: string; desc: string; data: string; delay: number }) => (
  <div
    className="rgx-rise"
    style={{
      animationDelay: `${delay}ms`,
      height: 322,
      boxSizing: 'border-box',
      padding: '40px 44px',
      borderRadius: 'var(--osd-radius)',
      background: ink.panel,
      border: `1px solid ${ink.panelEdge}`,
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <span style={{ fontFamily: MONO, fontSize: 20, letterSpacing: '0.18em', color: 'var(--osd-accent)' }}>{code}</span>
    <span style={{ marginTop: 14, fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em' }}>{title}</span>
    <span style={{ marginTop: 10, fontSize: 28, lineHeight: 1.45, color: ink.muted }}>{desc}</span>
    <span style={{ marginTop: 'auto', fontSize: 28, fontWeight: 600, color: ink.mint }}>{data}</span>
  </div>
);

const Grow: Page = () => (
  <Frame>
    <Eyebrow code="GROW">계속 자라는 시스템</Eyebrow>
    <Heading>쓸수록 넓어지고, 해가 바뀌어도 이어집니다</Heading>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, marginTop: 44 }}>
      <Feature code="REQUEST" title="법규 추가 요청" desc="빠진 법규는 사이트의 요청 버튼으로 추가합니다" data="기본 법령 207 → 254개" delay={200} />
      <Feature code="HISTORY" title="업데이트 내역" desc="매일 새로 잡히거나 빠진 개정을 날짜별로 남깁니다" data="10.01 +7 · 10.02 +3 · 10.04 −1" delay={320} />
      <Feature code="ROLLOVER" title="연도 자동 전환" desc="1월 1일이 되면 지난해 자료는 보관하고 새해를 시작합니다" data="다음 전환 2027.01.01" delay={440} />
      <Feature code="REPORT" title="보고서 한 번에" desc="분기 보고용 PPT와 Excel을 그날 데이터로 바로 만듭니다" data="PPT · Excel · 메일 보고" delay={560} />
    </div>
  </Frame>
);

// ─── 11–13. 사용법 (실제 사이트 화면) ───

type Box = { x: number; y: number; w: number; h: number };

const Shot = ({ src, at, k }: { src: string; at: number; k: number }) => (
  <img
    src={src}
    alt=""
    className={at > 0 ? 'rgx-shotin' : undefined}
    style={{ animationDelay: `${at * k}s`, position: 'absolute', left: 0, top: 0, width: FW, height: FH, display: 'block' }}
  />
);

const Ring = ({ box, from, to, k, label, keep, below }: { box: Box; from: number; to?: number; k: number; label?: string; keep?: boolean; below?: boolean }) => (
  <div
    className={keep ? 'rgx-ringkeep' : 'rgx-ring'}
    style={{
      animationDelay: `${from * k}s`,
      animationDuration: keep ? undefined : `${((to ?? from + 3) - from) * k}s`,
      position: 'absolute',
      left: box.x * FW - 6,
      top: box.y * FH - 6,
      width: box.w * FW + 12,
      height: box.h * FH + 12,
      boxSizing: 'border-box',
      border: `3px solid ${ink.mint}`,
      borderRadius: 10,
      boxShadow: '0 0 0 6px rgba(126, 226, 168, 0.18)',
      pointerEvents: 'none',
    }}
  >
    {label && (
      <span
        style={{
          position: 'absolute',
          left: -3,
          ...(below ? { top: 'calc(100% + 8px)' } : { bottom: 'calc(100% + 8px)' }),
          padding: '4px 12px',
          borderRadius: 8,
          background: ink.mint,
          color: ink.deep,
          fontSize: 18,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    )}
  </div>
);

const Ripple = ({ x, y, t, k }: { x: number; y: number; t: number; k: number }) => (
  <span
    className="rgx-ripple"
    style={{
      animationDelay: `${t * k}s`,
      position: 'absolute',
      left: x * FW - 18,
      top: y * FH - 18,
      width: 36,
      height: 36,
      borderRadius: '50%',
      border: '3px solid #ffffff',
      boxShadow: '0 0 0 2px rgba(10, 20, 49, 0.4)',
      pointerEvents: 'none',
    }}
  />
);

// 화면 안의 모든 것(화면 · 강조 · 커서)이 함께 확대된다
const Browser = ({ u, children }: { u: UseDef; children: ReactNode }) => {
  const last = u.cursor[u.cursor.length - 1];
  return (
    <div
      className="rgx-rise"
      style={{
        animationDelay: '150ms',
        position: 'absolute',
        left: 140,
        top: 262,
        width: FW,
        borderRadius: 14,
        overflow: 'hidden',
        background: '#0d1736',
        border: `1px solid ${ink.panelEdge}`,
        boxShadow: '0 40px 90px -40px rgba(0, 0, 0, 0.75)',
      }}
    >
      <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderBottom: `1px solid ${ink.line}` }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff6b5f' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ffbd2e' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ marginLeft: 18, padding: '3px 14px', borderRadius: 7, background: 'rgba(132, 158, 238, 0.12)', fontFamily: MONO, fontSize: 15, color: ink.muted }}>
          tjdudfhr.github.io/RegRader
        </span>
      </div>
      <div style={{ position: 'relative', width: FW, height: FH, overflow: 'hidden', background: '#e3e7ed' }}>
        <div
          className="rgx-cam"
          style={{ animationName: `rgx-cam-${u.id}`, animationDuration: `${u.dur * u.k}s`, position: 'absolute', left: 0, top: 0, width: FW, height: FH, transformOrigin: '0 0' }}
        >
          {children}
          <div
            className="rgx-cur"
            style={{
              animationName: `rgx-cur-${u.id}`,
              animationDuration: `${u.dur * u.k}s`,
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate(${last[1] * FW}px, ${last[2] * FH}px)`,
              zIndex: 5,
            }}
          >
            <div className="rgx-clk" style={{ animationName: `rgx-clk-${u.id}`, animationDuration: `${u.dur * u.k}s`, transformOrigin: '7px 4px', marginLeft: -7, marginTop: -4 }}>
              <Cursor />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const UseStepRow = ({ n, title, desc, at, k }: { n: string; title: string; desc: string; at: number; k: number }) => (
  <div className="rgx-stepon" style={{ animationDelay: `${at * k}s`, display: 'grid', gridTemplateColumns: '58px 1fr', gap: 16 }}>
    <span
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        border: '2px solid var(--osd-accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: MONO,
        fontSize: 22,
        color: 'var(--osd-accent)',
      }}
    >
      {n}
    </span>
    <div>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.3 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 24, lineHeight: 1.5, color: ink.muted }}>{desc}</div>
    </div>
  </div>
);

const UseSteps = ({ children }: { children: ReactNode }) => (
  <div style={{ position: 'absolute', left: 1288, top: 290, width: 492, display: 'flex', flexDirection: 'column', gap: 40 }}>{children}</div>
);

const UseJob: Page = () => (
  <Frame>
    <Eyebrow code="STEP 1">사용법 · 직무 선택</Eyebrow>
    <Heading>내 직무를 고르면, 챙길 일이 바로 보입니다</Heading>
    <Browser u={U1}>
      <Shot src={useA} at={0} k={U1.k} />
      <Shot src={useB} at={3.0} k={U1.k} />
      <Ring box={{ x: 0.7969, y: 0.1691, w: 0.0795, h: 0.0422 }} from={1.6} to={3.0} k={U1.k} />
      <Ripple x={0.837} y={0.19} t={2.55} k={U1.k} />
      <Ring box={{ x: 0.5892, y: 0.3282, w: 0.1812, h: 0.1118 }} from={5.0} to={8.8} k={U1.k} label="30일 내 시행 5건" />
      <Ring box={{ x: 0.463, y: 0.459, w: 0.243, h: 0.463 }} from={9.6} k={U1.k} keep label="제재·의무 변경 17건" />
    </Browser>
    <UseSteps>
      <UseStepRow n="1" title="직무별 개정 현황" desc="왼쪽 메뉴에서 엽니다" at={0} k={U1.k} />
      <UseStepRow n="2" title="내 직무 선택" desc="예: 환경 186건" at={2.6} k={U1.k} />
      <UseStepRow n="3" title="챙길 일 확인" desc="30일 내 시행 5건 · 제재·의무 변경 17건" at={5.0} k={U1.k} />
    </UseSteps>
  </Frame>
);

const UseLaw: Page = () => (
  <Frame>
    <Eyebrow code="STEP 2">사용법 · 법령 상세</Eyebrow>
    <Heading>법령을 누르면, 바뀐 내용과 근거가 보입니다</Heading>
    <Browser u={U2}>
      <Shot src={useC} at={0} k={U2.k} />
      <Shot src={useD} at={2.9} k={U2.k} />
      <Ring box={{ x: 0.2226, y: 0.3838, w: 0.47, h: 0.0493 }} from={1.5} to={2.9} k={U2.k} />
      <Ripple x={0.4} y={0.408} t={2.35} k={U2.k} />
      <Ring box={{ x: 0.406, y: 0.472, w: 0.577, h: 0.52 }} from={5.0} to={10.6} k={U2.k} label="벌칙·과태료·의무 + 근거 조문" />
      <Ring box={{ x: 0.408, y: 0.206, w: 0.236, h: 0.037 }} from={11.0} k={U2.k} keep below label="개정문 원문 · 신구조문 비교" />
    </Browser>
    <UseSteps>
      <UseStepRow n="1" title="다가오는 시행에서 선택" desc="예: 대기환경보전법 11.12 시행" at={0} k={U2.k} />
      <UseStepRow n="2" title="벌칙·과태료·의무 변경" desc="근거 조문까지 자동 정리" at={2.9} k={U2.k} />
      <UseStepRow n="3" title="원문 바로 열기" desc="개정문 원문 · 신구조문 비교 · 현행 법령" at={10.8} k={U2.k} />
    </UseSteps>
  </Frame>
);

const UseReport: Page = () => (
  <Frame>
    <Eyebrow code="STEP 3">사용법 · 시행 임박 · 보고서</Eyebrow>
    <Heading>시행 임박을 확인하고, 보고서로 공유합니다</Heading>
    <Browser u={U3}>
      <Shot src={useB} at={0} k={U3.k} />
      <Shot src={useE} at={2.4} k={U3.k} />
      <Shot src={useF} at={9.4} k={U3.k} />
      <Ring box={{ x: 0.0083, y: 0.3813, w: 0.1528, h: 0.0422 }} from={1.3} to={2.4} k={U3.k} />
      <Ripple x={0.085} y={0.402} t={2.05} k={U3.k} />
      <Ring box={{ x: 0.193, y: 0.1, w: 0.187, h: 0.097 }} from={3.6} to={6.0} k={U3.k} below label="7일 이내 시행 8건" />
      <Ring box={{ x: 0.193, y: 0.447, w: 0.778, h: 0.53 }} from={5.6} to={8.2} k={U3.k} label="D-day 순 목록" />
      <Ring box={{ x: 0.9178, y: 0.015, w: 0.06, h: 0.04 }} from={7.6} to={9.4} k={U3.k} />
      <Ripple x={0.948} y={0.035} t={8.6} k={U3.k} />
      <Ring box={{ x: 0.29, y: 0.245, w: 0.42, h: 0.33 }} from={10.0} to={13.4} k={U3.k} label="임원 보고용 PPT" />
      <Ring box={{ x: 0.29, y: 0.6, w: 0.42, h: 0.2 }} from={13.4} k={U3.k} keep below label="Excel 내려받기" />
    </Browser>
    <UseSteps>
      <UseStepRow n="1" title="시행 임박" desc="D-day 순으로 정리된 목록" at={0} k={U3.k} />
      <UseStepRow n="2" title="보고서 버튼" desc="화면 오른쪽 위" at={7.6} k={U3.k} />
      <UseStepRow n="3" title="PPT · Excel" desc="임원 보고용 PPT와 개정 목록 엑셀" at={9.4} k={U3.k} />
    </UseSteps>
  </Frame>
);

// ─── 11. Closing (mirrors the cover so the deck loops) ───

const UseStep = ({ n, text, delay }: { n: string; text: string; delay: number }) => (
  <div className="rgx-rise" style={{ animationDelay: `${delay}ms`, display: 'flex', alignItems: 'baseline', gap: 24, fontSize: 34 }}>
    <span style={{ fontFamily: MONO, fontSize: 24, color: 'var(--osd-accent)' }}>{n}</span>
    {text}
  </div>
);

const Closing: Page = () => (
  <Frame footer={false} arcs={false}>
    <div style={{ position: 'absolute', left: 940, top: 60 }}>
      <Radar size={960} />
    </div>
    <div
      style={{
        position: 'relative',
        width: 800,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div className="rgx-rise" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Logo size={44} />
        <span style={{ fontFamily: MONO, fontSize: 28, color: 'var(--osd-accent)', letterSpacing: '0.02em' }}>
          tjdudfhr.github.io/RegRader
        </span>
      </div>
      <h1
        className="rgx-rise"
        style={{
          animationDelay: '150ms',
          margin: '40px 0 0',
          fontFamily: 'var(--osd-font-display)',
          fontSize: 96,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: '-0.045em',
        }}
      >
        매일 아침,
        <br />
        레이더가
        <br />
        먼저 봅니다.
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 60 }}>
        <UseStep n="01" text="사이트 접속" delay={450} />
        <UseStep n="02" text="내 직무 고르기" delay={570} />
        <UseStep n="03" text="시행 임박부터 확인" delay={690} />
      </div>
    </div>
  </Frame>
);

export const meta: SlideMeta = {
  title: 'RegRader 소개',
  createdAt: '2026-10-05T14:45:57.777Z',
};

export default [Cover, Problem, Funnel, Pipeline, Scope, ThisYear, Sanctions, Soon, Tracker, Grow, UseJob, UseLaw, UseReport, Closing] satisfies Page[];

export const notes: (string | undefined)[] = [
  '매일 아침, 우리 회사에 해당하는 법규 개정을 먼저 찾아 주는 시스템, RegRader입니다. 지금 화면의 점 하나하나가 올해 실제로 포착된 개정 1건입니다.',
  '올해 시행되는 법령 개정만 5,400건이 넘습니다. 하루 평균 15건입니다. 이를 매일 사람이 모두 읽고, 우리 회사에 해당하는 것만 골라내기는 쉽지 않습니다.',
  'RegRader는 우리 회사 적용법규 923개를 기준으로, 해당하는 개정만 남깁니다. 올해는 660건이며, 그중 30일 안에 시행되는 9건부터 확인하면 됩니다.',
  '이 과정은 매일 아침 7시에 자동으로 진행됩니다. 국가법령정보센터에서 개정 정보를 가져와 회사 기준과 대조하고, 개정문까지 분석해 사이트에 게시합니다. 별도로 조작할 필요가 없습니다.',
  '관리 대상은 법령 254개와, 고시 등 행정규칙 669개입니다. 법률부터 시행령, 시행규칙, 그 아래 고시까지 하나의 체계로 묶어 관리합니다.',
  '올해 개정을 직무별로 보면 환경, 재무회계, 안전 순으로 많습니다. 다른 법 개정에 따라 용어만 정비된 타법개정은 따로 구분해, 실제로 바뀐 내용에 집중할 수 있도록 했습니다.',
  '특히 벌칙, 과태료, 회사 의무가 바뀐 개정은 별도로 표시합니다. 올해는 69건입니다. 예를 들어 대기환경보전법은 충전시설 정보를 전산망에 등록해야 하고, 등록하지 않으면 과태료 대상이 됩니다. 이러한 근거를 조문 번호와 함께 제시합니다.',
  '시행 임박 화면에서는 연말까지 시행될 개정을 날짜순으로 보여 줍니다. 10월 8일에는 근로기준법을 포함해 8건이 한꺼번에 시행됩니다.',
  '확인으로 끝나지 않습니다. 담당자는 사이트에서 검토중, 조치필요, 조치완료 등 대응 상태를 바로 기록하고, 이 진행 현황은 보고서에 그대로 반영됩니다.',
  '누락된 법규는 사이트에서 바로 추가를 요청할 수 있습니다. 매일의 변경 사항은 업데이트 내역에 기록되고, 해가 바뀌면 지난해 자료를 보관한 뒤 새해를 자동으로 시작합니다.',
  '이제 실제 사용 방법을 보겠습니다. 먼저 직무별 개정 현황에서 내 직무를 선택합니다. 환경을 선택하면, 30일 안에 시행되는 5건과 제재나 의무가 바뀐 17건이 바로 표시됩니다.',
  '목록에서 법령을 누르면 상세 화면이 열립니다. 어떤 벌칙과 과태료, 의무가 새로 생기거나 바뀌었는지 근거 조문과 함께 정리되어 있고, 개정문 원문과 신구조문 비교도 바로 열어 볼 수 있습니다.',
  '시행 임박 메뉴에서는 곧 시행되는 개정을 D-day 순서로 확인합니다. 보고가 필요할 때는 오른쪽 위의 보고서 버튼을 누르면, 임원 보고용 PPT와 엑셀 파일을 바로 만들 수 있습니다.',
  '매일 아침, 레이더가 먼저 봅니다. 사이트에 접속해 내 직무를 선택하고, 시행 임박부터 확인하시기 바랍니다.',
];
