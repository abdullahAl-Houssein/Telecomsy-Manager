// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS & SHARED UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export const APP_VERSION = "6.0.0";
export const LOGO_IMG    = "/logo.png";
export const API_BASE    = "http://localhost:3001";

// ── Default data ──────────────────────────────────────────────────────────────
export const DEFAULT_TIERS = [
  { id:1, code:"H",  from:0,      to:2000,   step:200,  ppm:2.25 },
  { id:2, code:"G",  from:2000,   to:5000,   step:300,  ppm:2.15 },
  { id:3, code:"F",  from:5000,   to:10000,  step:500,  ppm:2.05 },
  { id:4, code:"E",  from:10000,  to:25000,  step:500,  ppm:1.95 },
  { id:5, code:"D",  from:25000,  to:50000,  step:600,  ppm:1.90 },
  { id:6, code:"C",  from:50000,  to:75000,  step:800,  ppm:1.85 },
  { id:7, code:"B",  from:75000,  to:100000, step:1000, ppm:1.80 },
  { id:8, code:"A",  from:100000, to:150000, step:0,    ppm:1.75 },
  { id:9, code:"A2", from:150000, to:400000, step:0,    ppm:1.55 },
];
export const DEFAULT_PORT_PRICES = { first1G:150, extra1G:500, port10G:1200 };

// ── Role permissions ──────────────────────────────────────────────────────────
export const ROLE_PERMS = {
  superadmin: ["dashboard","companies","ports","requests","pricing","branches","areas","users","cycles"],
  manager:    ["dashboard","companies","ports","requests","areas"],
  viewer:     ["dashboard","requests"],
};

// ── Shared styles ─────────────────────────────────────────────────────────────
export const IS  = {
  width:"100%", background:"#060A14", border:"1px solid #17253D",
  borderRadius:7, padding:"8px 11px", color:"#C9D5E8", fontSize:13,
};
export const LBL = { fontSize:12, color:"#3A5070", display:"block", marginBottom:5 };

export const CYCLE_STATUS = {
  open:   { bg:"#052E1C", text:"#34D399", border:"#065F46" },
  closed: { bg:"#2D0909", text:"#F87171", border:"#7F1D1D" },
};
export const REQ_STATUS = {
  pending:  { bg:"#2D2006", text:"#FBBF24", border:"#78500A" },
  approved: { bg:"#052E1C", text:"#34D399", border:"#065F46" },
  rejected: { bg:"#2D0909", text:"#F87171", border:"#7F1D1D" },
};
export const TIER_COLOR = {
  A2:"#818CF8", A:"#818CF8", B:"#34D399", C:"#34D399",
  D:"#FBBF24",  E:"#F97316", F:"#F97316", G:"#F87171", H:"#F87171",
};

// ── Formatting helpers ────────────────────────────────────────────────────────
export const fmt     = n  => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
export const fmtMb   = mb => mb >= 1000 ? `${(mb/1000).toFixed(mb%1000===0?0:1)} Gbps` : `${mb} Mbps`;
export const monthLabel = m => { const [y,mo] = m.split("-"); return `${mo}-${y}`; };
export const fmtDate    = d => { if (!d) return "—"; const [y,mo,dd] = d.split("-"); return `${dd}-${mo}-${y}`; };

// ── Pricing calculator ────────────────────────────────────────────────────────
export function calcPrice(totalMb, tiers) {
  if (!tiers || !tiers.length || totalMb <= 0) return { cost:0, tier:tiers[0]||null };
  const sorted = [...tiers].sort((a,b) => a.from - b.from);
  let matched = sorted[0];
  for (const t of sorted) { if (totalMb > t.from) matched = t; }
  return { cost: totalMb * matched.ppm, tier: matched };
}

// ── UID generator (for local-only keys) ──────────────────────────────────────
let _uid = 700;
export const uid = () => ++_uid;
