import { useState } from "react";
import { IS, LBL, APP_VERSION, LOGO_IMG, API_BASE } from "../constants";

export default function LoginScreen({ users, onLogin }) {
  const [un,setUn]=useState(""); const [pw,setPw]=useState(""); const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const go = () => {
    if (!un||!pw) { setErr(true); return; }
    setLoading(true);
    // Try local users list first (already loaded from server)
    const u = users.find(x=>x.username===un && x.password===pw);
    if (u) { onLogin(u); return; }
    // Fallback: fetch fresh from server (handles case where users loaded before server was ready)
    fetch(API_BASE+"/api/db")
      .then(r=>r.json())
      .then(data=>{
        const fresh = (data.users||[]).find(x=>x.username===un && x.password===pw);
        if (fresh) { onLogin(fresh); }
        else { setErr(true); setLoading(false); }
      })
      .catch(()=>{ setErr(true); setLoading(false); });
  };
  const inputStyle = focused => ({
    ...IS, padding:"11px 16px", fontSize:14, borderRadius:10,
    border:"1px solid "+(err&&!focused?"#7F1D1D":focused?"#3A80C0":"#1E3050"),
    outline:"none", transition:"border-color .2s", background:"#080C16",
  });
  return (
    <div style={{
      width:"100vw", height:"100vh", background:"#060A14",
      display:"flex", fontFamily:"'DM Sans',sans-serif", overflow:"hidden", position:"fixed", inset:0,
    }}>
      {/* Left panel - branding */}
      <div style={{flex:"0 0 42%",background:"linear-gradient(160deg,#0A1628 0%,#061020 60%,#030810 100%)",
        borderRight:"1px solid #17253D",display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",padding:"40px",position:"relative",overflow:"hidden"}}>
        {/* Animated background elements */}
        <div style={{position:"absolute",top:"10%",left:"10%",width:280,height:280,borderRadius:"50%",
          background:"radial-gradient(circle,#1A6FA812,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:"15%",right:"5%",width:200,height:200,borderRadius:"50%",
          background:"radial-gradient(circle,#0B8FA812,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",inset:0,
          backgroundImage:"linear-gradient(#17253D18 1px,transparent 1px),linear-gradient(90deg,#17253D18 1px,transparent 1px)",
          backgroundSize:"32px 32px",pointerEvents:"none"}}/>
        {/* Logo */}
        <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
          <div style={{
            width:130,height:130,borderRadius:28,margin:"0 auto 28px",
            background:"linear-gradient(145deg,#112240,#0A1830)",
            border:"1px solid #2A5080",
            boxShadow:"0 8px 40px #00000070,0 0 0 1px #1A4A7030,inset 0 1px 0 #2A5A9020",
            display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative",
          }}>
            <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 35% 25%,#2A6AA020,transparent 55%)"}}/>
            <img src={LOGO_IMG} alt="TELECOMSY"
              style={{width:100,height:100,objectFit:"contain",position:"relative",zIndex:1,
                filter:"drop-shadow(0 4px 16px #00000090) brightness(1.05)"}}/>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:"#D4E3F5",letterSpacing:".5px",marginBottom:6}}>TELECOMSY</div>
          <div style={{fontSize:12,color:"#3A6090",textTransform:"uppercase",letterSpacing:"2px",marginBottom:40}}>
            Supply Office Portal
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[["◈","Monthly cycle & request management"],["⬡","Port & company tracking"],["💲","Retroactive tier pricing"]].map(([icon,text])=>(
              <div key={text} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 16px",
                background:"#0C1A2E",borderRadius:8,border:"1px solid #17253D",textAlign:"left"}}>
                <span style={{fontSize:14,color:"#5BB5F5"}}>{icon}</span>
                <span style={{fontSize:12,color:"#5A7A9A"}}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - login form */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px",
        background:"linear-gradient(160deg,#080C16 0%,#060A14 100%)"}}>
        <div style={{width:"100%",maxWidth:380,position:"relative",zIndex:1}}>
          <div style={{marginBottom:36}}>
            <div style={{fontSize:28,fontWeight:700,color:"#D4E3F5",marginBottom:8,fontFamily:"'DM Sans',sans-serif"}}>
              Welcome Back
            </div>
            <div style={{fontSize:14,color:"#3A5070",fontFamily:"'DM Sans',sans-serif"}}>
              Sign in to your account to continue
            </div>
          </div>

          <div style={{marginBottom:18}}>
            <label style={{...LBL,fontSize:13,marginBottom:8,color:"#5A7A9A",fontFamily:"'DM Sans',sans-serif"}}>
              Username
            </label>
            <input value={un} onChange={e=>{setUn(e.target.value);setErr(false);}} onKeyDown={e=>e.key==="Enter"&&go()}
              style={inputStyle(false)} placeholder="username" autoFocus dir="ltr"/>
          </div>
          <div style={{marginBottom:24}}>
            <label style={{...LBL,fontSize:13,marginBottom:8,color:"#5A7A9A",fontFamily:"'DM Sans',sans-serif"}}>
              Password
            </label>
            <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr(false);}} onKeyDown={e=>e.key==="Enter"&&go()}
              style={inputStyle(false)} placeholder="••••••••" dir="ltr"/>
          </div>

          {err && (
            <div style={{color:"#F87171",fontSize:13,marginBottom:18,padding:"11px 16px",
              background:"#1A0505",border:"1px solid #7F1D1D",borderRadius:10,
              display:"flex",alignItems:"center",gap:10,fontFamily:"'DM Sans',sans-serif"}}>
              <span style={{fontSize:16}}>⚠️</span>
              <span>Username أو Password غير صحيحة</span>
            </div>
          )}

          <button onClick={go} disabled={loading} style={{
            width:"100%",
            background:loading?"#0F2540":"linear-gradient(135deg,#1A6FA8 0%,#0E5A96 50%,#0A4070 100%)",
            border:"none",borderRadius:12,color:"#fff",padding:"14px",
            fontWeight:700,fontSize:15,cursor:loading?"not-allowed":"pointer",marginBottom:28,
            boxShadow:loading?"none":"0 4px 24px #1A6FA840,0 1px 0 #2A8FD840 inset",
            letterSpacing:".3px",transition:"all .2s",
            fontFamily:"'DM Sans',sans-serif",
          }}>
            {loading ? "Verifying..." : "Sign In →"}
          </button>

          <div style={{textAlign:"center",fontSize:11,color:"#1E3050"}}>
            v{APP_VERSION} · Syria Telecom Supply Office
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MINI BAR CHART (pure SVG — no library)
// ─────────────────────────────────────────────────────────────────────────────

