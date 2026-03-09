// ─────────────────────────────────────────────────────────────────────────────
//  useConfirm — styled confirm dialog (replaces window.confirm)
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";

function ConfirmDialog({ msg, detail, confirmLabel = "Delete", confirmColor = "#F87171", onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#000000A0", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#0C1222", border:"1px solid #2A3550", borderRadius:14, padding:"28px 32px", maxWidth:420, width:"90%",
        boxShadow:"0 24px 64px #000000A0", animation:"fadeIn .18s ease" }}>
        <div style={{ fontSize:28, marginBottom:14, textAlign:"center" }}>⚠️</div>
        <div style={{ fontWeight:700, fontSize:15, color:"#C9D5E8", marginBottom:8, textAlign:"center" }}>{msg}</div>
        {detail && <div style={{ fontSize:12, color:"#3A5070", marginBottom:20, textAlign:"center", lineHeight:1.6 }}>{detail}</div>}
        <div style={{ display:"flex", gap:10, justifyContent:"center", marginTop:20 }}>
          <button onClick={onConfirm} style={{ background:confirmColor+"20", border:`1px solid ${confirmColor}60`,
            color:confirmColor, borderRadius:8, padding:"8px 24px", cursor:"pointer", fontWeight:600, fontSize:13 }}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} style={{ background:"#0F1A2E", border:"1px solid #17253D",
            color:"#94ADC8", borderRadius:8, padding:"8px 24px", cursor:"pointer", fontSize:13 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = (msg, detail = "", opts = {}) =>
    new Promise(resolve => {
      setState({ msg, detail, opts, resolve });
    });

  const dialog = state ? (
    <ConfirmDialog
      msg={state.msg}
      detail={state.detail}
      confirmLabel={state.opts?.confirmLabel || "Delete"}
      confirmColor={state.opts?.confirmColor || "#F87171"}
      onConfirm={() => { setState(null); state.resolve(true); }}
      onCancel={()  => { setState(null); state.resolve(false); }}
    />
  ) : null;

  return [confirm, dialog];
}
