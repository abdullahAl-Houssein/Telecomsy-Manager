// ─────────────────────────────────────────────────────────────────────────────
//  BAR CHART — reusable SVG bar chart with grid lines and hover tooltip
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";

export default function BarChart({
  data,
  color       = "#5BB5F5",
  height      = 110,
  fmt:  fmtFn = v => v,
  fmtTooltip: fmtTip = null,
  showGrid    = true,
}) {
  const tipFn = fmtTip || fmtFn;
  const [hovered, setHovered] = useState(null);

  if (!data.length) return null;

  const max    = Math.max(...data.map(d => d.value), 1);
  const PAD_L  = 36, PAD_B = 22, PAD_T = 18, PAD_R = 8;
  const W      = 320, H = height;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const BAR    = Math.max(10, Math.floor((chartW - data.length * 6) / data.length));
  const gap    = (chartW - data.length * BAR) / (data.length + 1);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(p => ({
    y:   PAD_T + chartH * (1 - p),
    val: max * p,
  }));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible", display:"block" }}>

      {/* Grid lines */}
      {showGrid && gridLines.map((gl, i) => (
        <g key={i}>
          <line
            x1={PAD_L} y1={gl.y} x2={W - PAD_R} y2={gl.y}
            stroke={i === 0 ? "#1E3050" : "#17253D"}
            strokeWidth={i === 0 ? 1.5 : 0.7}
            strokeDasharray={i === 0 ? "none" : "3,3"}
          />
          {gl.val > 0 && (
            <text x={PAD_L - 4} y={gl.y + 3.5} textAnchor="end"
              fill="#2A4060" fontSize={7.5} fontFamily="DM Mono,monospace">
              {fmtFn(gl.val)}
            </text>
          )}
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const bh    = Math.max(d.value > 0 ? 2 : 0, Math.round((d.value / max) * chartH));
        const x     = PAD_L + gap + (BAR + gap) * i;
        const y     = PAD_T + chartH - bh;
        const isHov = hovered === i;

        return (
          <g key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor:"default" }}>

            {/* Bar track */}
            <rect x={x} y={PAD_T} width={BAR} height={chartH} rx={3}
              fill="#0A1422" opacity={0.5}/>

            {/* Bar fill */}
            <rect x={x} y={y} width={BAR} height={bh} rx={3}
              fill={d.value > 0 ? color : "#17253D"}
              opacity={isHov ? 1 : 0.82}
              style={{ transition:"opacity .1s" }}/>

            {/* Glow on hover */}
            {isHov && d.value > 0 && (
              <rect x={x - 1} y={y - 1} width={BAR + 2} height={bh + 2} rx={4}
                fill="none" stroke={color} strokeWidth={1.5} opacity={0.5}/>
            )}

            {/* X-axis label */}
            <text x={x + BAR / 2} y={PAD_T + chartH + 14} textAnchor="middle"
              fill={isHov ? "#94ADC8" : "#3A5070"} fontSize={9}
              fontFamily="DM Sans,sans-serif"
              fontWeight={isHov ? "600" : "normal"}>
              {d.label}
            </text>

            {/* Value label — shown on hover or if bar is tall enough */}
            {(isHov || bh > 20) && d.value > 0 && (
              <text x={x + BAR / 2} y={y - 5} textAnchor="middle"
                fill={isHov ? "#FFFFFF" : color}
                fontSize={isHov ? 9 : 8}
                fontFamily="DM Mono,monospace" fontWeight="700">
                {fmtFn(d.value)}
              </text>
            )}
          </g>
        );
      })}

      {/* Hover tooltip */}
      {hovered !== null && data[hovered]?.value > 0 && (() => {
        const d  = data[hovered];
        const bh = Math.max(2, Math.round((d.value / max) * chartH));
        const x  = PAD_L + gap + (BAR + gap) * hovered;
        const ty = PAD_T + chartH - bh - 28;
        const tx = Math.min(Math.max(x + BAR / 2 - 50, PAD_L), W - PAD_R - 100);
        return (
          <g>
            <rect x={tx} y={ty} width={100} height={22} rx={5}
              fill="#060E1E" stroke={color} strokeWidth={1.2} opacity={0.97}/>
            <text x={tx + 50} y={ty + 14} textAnchor="middle"
              fill={color} fontSize={9.5} fontFamily="DM Mono,monospace" fontWeight="700">
              {tipFn(d.value)}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
