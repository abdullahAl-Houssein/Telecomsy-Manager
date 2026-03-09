// ─────────────────────────────────────────────────────────────────────────────
//  UI PRIMITIVES — shared across all pages
// ─────────────────────────────────────────────────────────────────────────────
import { IS, LBL, fmt } from "../../constants";

export function FI({ label, val, set, type, onEnter, placeholder }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={LBL}>{label}</label>}
      <input type={type||"text"} value={val} onChange={e=>set(e.target.value)}
        placeholder={placeholder} onKeyDown={e=>onEnter&&e.key==="Enter"&&onEnter()} style={IS}/>
    </div>
  );
}

export function FS({ label, val, set, opts }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={LBL}>{label}</label>}
      <select value={val} onChange={e=>set(e.target.value)} style={IS}>
        {opts.map(o => typeof o === "object"
          ? <option key={o.value} value={o.value}>{o.label}</option>
          : <option key={o}>{o}</option>
        )}
      </select>
    </div>
  );
}

export function SearchBox({ val, set, placeholder }) {
  return (
    <input value={val} onChange={e=>set(e.target.value)}
      placeholder={placeholder||"Search..."}
      style={{ ...IS, width:180, padding:"5px 10px", fontSize:12 }}/>
  );
}

export function Btn({ children, onClick, ghost, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:"8px 18px", borderRadius:8,
      border: ghost ? "1px solid #17253D" : "none",
      background: disabled ? "#1A2535" : ghost ? "none" : "linear-gradient(135deg,#1A6FA8,#0B3D6B)",
      color: disabled ? "#3A5070" : ghost ? "#4A6580" : "#fff",
      fontWeight:600, fontSize:13,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  );
}

export function IBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background:"#112030", border:"1px solid #17253D",
      borderRadius:6, padding:"4px 7px", cursor:"pointer", fontSize:13,
    }}>{children}</button>
  );
}

export function Badge({ children, sc }) {
  return (
    <span style={{
      padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:600,
      background:sc.bg, color:sc.text, border:"1px solid "+sc.border,
    }}>{children}</span>
  );
}

export function GovBadge({ children }) {
  return (
    <span style={{
      fontSize:11, background:"#112040", color:"#5BB5F5",
      padding:"2px 8px", borderRadius:4, fontWeight:500,
    }}>{children}</span>
  );
}

export function Stat({ label, val }) {
  return (
    <div style={{ background:"#060A14", borderRadius:7, padding:"8px 10px", textAlign:"center" }}>
      <div style={{ fontFamily:"'DM Mono'", fontSize:13, fontWeight:500, color:"#5BB5F5" }}>{val}</div>
      <div style={{ fontSize:10, color:"#3A5070" }}>{label}</div>
    </div>
  );
}

export function MiniStat({ label, val }) {
  return (
    <div style={{ background:"#060A14", borderRadius:7, padding:"8px 12px" }}>
      <div style={{ fontSize:10, color:"#3A5070", marginBottom:2 }}>{label}</div>
      <div style={{ fontFamily:"'DM Mono'", fontSize:13, fontWeight:600, color:"#C9D5E8" }}>{val}</div>
    </div>
  );
}

export function Row({ children, gap, mt }) {
  return <div style={{ display:"flex", gap, marginTop:mt||0 }}>{children}</div>;
}

export function Muted({ children }) {
  return <span style={{ fontSize:13, color:"#3A5070" }}>{children}</span>;
}

export function Card({ title, headerRight, children }) {
  return (
    <div style={{ background:"#0C1222", border:"1px solid #17253D", borderRadius:12, padding:"18px 20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontWeight:600, fontSize:12, color:"#4A6580", letterSpacing:".5px", textTransform:"uppercase" }}>{title}</div>
        {headerRight && <div>{headerRight}</div>}
      </div>
      {children}
    </div>
  );
}

export function SLabel({ children, mt, noMb }) {
  return (
    <div style={{
      fontSize:11, color:"#4A6580", letterSpacing:".8px", textTransform:"uppercase",
      marginTop:mt||0, marginBottom:noMb?0:10,
    }}>{children}</div>
  );
}

export function CostLine({ label, val }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:13, color:"#4A6580" }}>
      <span>{label}</span>
      <span style={{ fontFamily:"'DM Mono'" }}>{fmt(val)}</span>
    </div>
  );
}

export function ToolBar({ children, right }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>{children}</div>
      <div>{right}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:80, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:"#0C1222", border:"1px solid #17253D", borderRadius:14, padding:26,
        width:wide?700:450, maxHeight:"92vh", overflowY:"auto", animation:"fadeIn .2s",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:"#C9D5E8" }}>{title}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#3A5070", cursor:"pointer", fontSize:22, lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DataTable({ cols, rows }) {
  return (
    <div style={{ overflowX:"auto", background:"#0C1222", borderRadius:10, border:"1px solid #17253D" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ background:"#0A1525" }}>
            {cols.map((c,i) => (
              <th key={i} style={{
                textAlign:"left", padding:"10px 14px", fontSize:10, fontWeight:700,
                color:"#3A5070", borderBottom:"1px solid #17253D", whiteSpace:"nowrap",
                textTransform:"uppercase", letterSpacing:".6px",
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i) => (
            <tr key={i} className="hrow" style={{ borderBottom:"1px solid #0F1A2A" }}>
              {r.map((cell,j) => (
                <td key={j} style={{ padding:"11px 14px", verticalAlign:"middle" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div style={{ padding:36, textAlign:"center", color:"#1E3050", fontSize:13 }}>No records found</div>
      )}
    </div>
  );
}
