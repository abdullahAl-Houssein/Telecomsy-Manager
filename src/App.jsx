import { useState, useEffect, useRef } from "react";
import { APP_VERSION, LOGO_IMG, API_BASE, DEFAULT_TIERS, DEFAULT_PORT_PRICES, ROLE_PERMS, IS, monthLabel } from "./constants";
import api, { loadDB, setCurrentUserId } from "./api/client";

import LoginScreen  from "./components/LoginScreen";
import Dashboard    from "./components/dashboard/Dashboard";
import Companies    from "./components/companies/Companies";
import Ports        from "./components/ports/Ports";
import Requests     from "./components/requests/Requests";
import Pricing      from "./components/pricing/Pricing";
import Branches     from "./components/branches/Branches";
import Areas        from "./components/areas/Areas";
import Cycles       from "./components/cycles/Cycles";
import Users        from "./components/users/Users";

const NOTIF_CFG = {
  cycle_opened:    { icon:"📅", color:"#34D399", label:"Cycle Opened"     },
  cycle_closed:    { icon:"🔴", color:"#F87171", label:"Cycle Closed"     },
  cycle_reopened:  { icon:"🟢", color:"#34D399", label:"Cycle Re-opened"  },
  new_request:     { icon:"📋", color:"#FBBF24", label:"New Request"      },
  port_request:    { icon:"🔌", color:"#5BB5F5", label:"Port Request"     },
  request_approved:{ icon:"✅", color:"#34D399", label:"Request Approved" },
  request_rejected:{ icon:"❌", color:"#F87171", label:"Request Rejected" },
  port_approved:   { icon:"🔌", color:"#34D399", label:"Port Approved"    },
  port_rejected:   { icon:"❌", color:"#F87171", label:"Port Rejected"    },
  repriced:        { icon:"🔄", color:"#C084FC", label:"Repriced"         },
  request_deleted: { icon:"🗑️", color:"#F87171", label:"Request Deleted"   },
  request_edited:  { icon:"✏️", color:"#FBBF24", label:"Request Edited"    },
};

function playNotifSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const isGood  = ["request_approved","port_approved","cycle_opened","cycle_reopened","repriced"].includes(type);
    const isAlert = ["cycle_closed","request_rejected","port_rejected"].includes(type);
    osc.type = "sine";
    if (isGood) {
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.setValueAtTime(780, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    } else if (isAlert) {
      osc.frequency.setValueAtTime(340, ctx.currentTime);
      osc.frequency.setValueAtTime(260, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    } else {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    }
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch(_) {}
}

function NotifPanel({ notifs, unread, onClose, onClear, onMarkRead }) {
  return (
    <div style={{ position:"fixed", top:0, right:0, bottom:0, width:340, zIndex:8000,
      background:"#0C1222", borderLeft:"1px solid #17253D", display:"flex", flexDirection:"column",
      boxShadow:"-8px 0 32px #00000080", animation:"slideInRight .2s ease" }}>
      <div style={{ padding:"16px 18px", borderBottom:"1px solid #17253D", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>🔔</span>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"#D4E3F5" }}>Notifications</div>
            <div style={{ fontSize:11, color:"#3A5070" }}>{notifs.length} total · {unread} unread</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {unread > 0 && (
            <button onClick={onMarkRead} style={{ background:"#0A1525", border:"1px solid #17253D", borderRadius:7,
              color:"#5BB5F5", fontSize:11, padding:"4px 10px", cursor:"pointer", fontWeight:600 }}>
              Mark all read
            </button>
          )}
          {notifs.length > 0 && (
            <button onClick={onClear} style={{ background:"#1A0808", border:"1px solid #3A1010", borderRadius:7,
              color:"#F87171", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
              Clear all
            </button>
          )}
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#3A5070",
            cursor:"pointer", fontSize:22, lineHeight:1, padding:"0 4px" }}>×</button>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {notifs.length === 0 ? (
          <div style={{ padding:"56px 24px", textAlign:"center", color:"#2A4060" }}>
            <div style={{ fontSize:36, marginBottom:14 }}>🔕</div>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>No notifications yet</div>
            <div style={{ fontSize:12 }}>Events will appear here in real time</div>
          </div>
        ) : (
          [...notifs].reverse().map(n => {
            const cfg = NOTIF_CFG[n.type] || { icon:"•", color:"#94ADC8", label:n.type };
            return (
              <div key={n.id} style={{ padding:"12px 18px", borderBottom:"1px solid #0F1A2A",
                background:n.read?"transparent":"#0A1525", display:"flex", gap:10, alignItems:"flex-start" }}>
                <div style={{ width:7, height:7, borderRadius:"50%", flexShrink:0, marginTop:6,
                  background:n.read?"#1A2A3A":cfg.color,
                  boxShadow:n.read?"none":`0 0 6px ${cfg.color}` }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:14 }}>{cfg.icon}</span>
                    <span style={{ fontSize:10, fontWeight:700, color:cfg.color, textTransform:"uppercase", letterSpacing:.5 }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize:12, color:"#94ADC8", lineHeight:1.55 }}>{n.msg}</div>
                  <div style={{ fontSize:10, color:"#2A4060", marginTop:5 }}>
                    {new Date(n.ts).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                    {" · "}
                    {new Date(n.ts).toLocaleDateString("en-GB")}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try { const s = localStorage.getItem("tsy_user"); return s ? JSON.parse(s) : null; } catch(e) { return null; }
  });
  const [govs,       setGovs]       = useState([]);
  const [areas,      setAreas]      = useState([]);
  const [companies,  setCompanies]  = useState([]);
  const [ports,      setPorts]      = useState([]);
  const [requests,   setRequests]   = useState([]);
  const [cycles,     setCycles]     = useState([]);
  const [tiers,      setTiers]      = useState(DEFAULT_TIERS);
  const [portPrices, setPortPrices] = useState(DEFAULT_PORT_PRICES);
  const [users,      setUsers]      = useState([]);
  const [page,       setPage]       = useState(() => {
    try { return localStorage.getItem("tsy_page") || "dashboard"; } catch(e) { return "dashboard"; }
  });
  const navigate     = p => { setPage(p); try { localStorage.setItem("tsy_page", p); } catch(e) {} };
  const [collapsed,  setCollapsed]  = useState(false);
  const [toast,      setToast]      = useState(null);
  const [dbLoading,  setDbLoading]  = useState(true);
  const [notifs,     setNotifs]     = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [soundOn,    setSoundOn]    = useState(true);
  const notifId = useRef(0);
  const unread  = notifs.filter(n => !n.read).length;


  useEffect(() => {
    loadDB().then(data => {
      if (!data) { setDbLoading(false); return; }
      if (Array.isArray(data.govs))      setGovs(data.govs);
      if (Array.isArray(data.areas))     setAreas(data.areas);
      if (Array.isArray(data.companies)) setCompanies(data.companies);
      if (Array.isArray(data.ports))     setPorts(data.ports);
      if (Array.isArray(data.requests))  setRequests(data.requests.map(r => ({...r,newPorts:Array.isArray(r.newPorts)?r.newPorts:[],portStatus:r.portStatus||null})));
      if (Array.isArray(data.tiers))     setTiers(data.tiers);
      if (data.portPrices)               setPortPrices(data.portPrices);
      if (Array.isArray(data.users))     setUsers(data.users);
      if (Array.isArray(data.cycles))    setCycles(data.cycles);
      setDbLoading(false);
    }).catch(() => setDbLoading(false));
  }, []);

  // Load saved notifications from DB once user is known
  useEffect(() => {
    if (!currentUser) return;
    setCurrentUserId(currentUser.id);
    api.getNotifications(currentUser.id).then(rows => {
      if (!Array.isArray(rows)) return;
      setNotifs(rows.map(n => ({ id:n.id, type:n.type, msg:n.msg, ts:n.ts, read:n.read })));
      notifId.current = rows.reduce((max,n) => Math.max(max,n.id), 0);
    }).catch(() => {});
  }, [currentUser?.id]);

  const activeCycle  = cycles.find(c => c.status === "open") || cycles[cycles.length-1] || null;
  const [viewCycle, setViewCycle] = useState(null);
  const currentCycle = viewCycle ? cycles.find(c => c.id === viewCycle) : activeCycle;
  const flash = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),5000); };
  const resetData = () => {
    if (!window.confirm("Reset ALL data? Cannot be undone.")) return;
    api.reset().then(()=>window.location.reload()).catch(e=>flash(e.message,"err"));
  };

  // SSE
  useEffect(() => {
    if (!currentUser) return;
    let es; let retry;
    const connect = () => {
      es = new EventSource(`${API_BASE}/api/events?userId=${currentUser.id}`);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "connected") return;
          // notification already saved in DB by server; just add to local state
          const n = { id:data.id||++notifId.current, type:data.type, msg:data.msg, ts:data.ts||new Date().toISOString(), read:false };
          setNotifs(prev => { if(prev.find(x=>x.id===n.id)) return prev; return [...prev.slice(-199), n]; });
          if (soundOn) playNotifSound(data.type);
          const isGood = ["cycle_opened","cycle_reopened","request_approved","port_approved","repriced"].includes(data.type);
          setToast({msg:data.msg, type:isGood?"ok":"err"});
          setTimeout(()=>setToast(null),5000);
          loadDB().then(db=>{
            if(!db) return;
            if(db.requests)  setRequests(db.requests.map(r=>({...r,newPorts:Array.isArray(r.newPorts)?r.newPorts:[],portStatus:r.portStatus||null})));
            if(db.cycles)    setCycles(db.cycles);
            if(db.ports)     setPorts(db.ports);
            if(db.companies) setCompanies(db.companies);
          });
        } catch(_){}
      };
      es.onerror = () => { es.close(); retry=setTimeout(connect,5000); };
    };
    connect();
    return () => { es?.close(); clearTimeout(retry); };
  }, [currentUser?.id, soundOn]);

  if (dbLoading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#080C16",flexDirection:"column",gap:16}}>
      <div style={{fontFamily:"'DM Mono'",fontSize:14,color:"#3A5070"}}>Connecting to server...</div>
      <div style={{width:200,height:3,background:"#17253D",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:"60%",background:"#5BB5F5",borderRadius:2,animation:"pulse 1s ease-in-out infinite"}}/>
      </div>
      <div style={{fontSize:11,color:"#2A4060",marginTop:4}}>Make sure the server is running on port 3001</div>
    </div>
  );

  if (!currentUser || users.length === 0) {
    return <LoginScreen users={users} onLogin={u=>{setCurrentUser(u);navigate("dashboard");try{localStorage.setItem("tsy_user",JSON.stringify(u));}catch(e){}}}/>;
  }
  const validatedUser = users.find(u=>u.id===currentUser.id&&u.username===currentUser.username)||null;
  if (!validatedUser) {
    try{localStorage.removeItem("tsy_user");}catch(e){}
    return <LoginScreen users={users} onLogin={u=>{setCurrentUser(u);navigate("dashboard");try{localStorage.setItem("tsy_user",JSON.stringify(u));}catch(e){}}}/>;
  }
  if (validatedUser !== currentUser) setCurrentUser(validatedUser);

  const perms      = ROLE_PERMS[currentUser.role]||[];
  const canSee     = p => perms.includes(p);
  const isAdmin    = currentUser.role==="superadmin";
  const isViewer   = currentUser.role==="viewer";
  const isCycleOpen= currentCycle?.status==="open";

  const NAV = [
    {id:"dashboard",icon:"◈", label:"Dashboard"},
    {id:"companies",icon:"🏢",label:"Companies"},
    {id:"ports",    icon:"⬡", label:"Ports"},
    {id:"requests", icon:"📋",label:"Requests"},
    {id:"pricing",  icon:"💲",label:"Pricing"},
    {id:"branches", icon:"🗺",label:"Branches"},
    {id:"areas",    icon:"🔷",label:"Areas"},
    {id:"cycles",   icon:"📅",label:"Cycles"},
    {id:"users",    icon:"👥",label:"Users"},
  ].filter(n=>canSee(n.id));

  const shared = {
    api, govs,setGovs, areas,setAreas, companies,setCompanies, ports,setPorts,
    requests,setRequests, cycles,setCycles, tiers,setTiers, portPrices,setPortPrices,
    users,setUsers, flash, setPage:navigate, currentUser, isAdmin, isViewer,
    currentCycle, isCycleOpen, viewCycle, setViewCycle,
  };

  const openNotifPanel = () => {
    setShowNotifs(s=>!s);
    setNotifs(prev=>prev.map(n=>({...n,read:true})));
  };

  return (
    <div style={{display:"flex",height:"100vh",background:"#080C16",color:"#C9D5E8",fontFamily:"'DM Sans','Segoe UI',sans-serif",overflow:"hidden"}}>

      {/* SIDEBAR */}
      <aside style={{width:collapsed?60:234,transition:"width .22s cubic-bezier(.4,0,.2,1)",flexShrink:0,
        background:"#0C1222",borderRight:"1px solid #17253D",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:100}}>

        {/* Logo */}
        <div style={{padding:"14px 12px",borderBottom:"1px solid #17253D",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,borderRadius:10,flexShrink:0,overflow:"hidden",
            background:"linear-gradient(135deg,#1A3A5C,#0D2340)",border:"1px solid #2A5080",
            display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px #00000040"}}>
            <img src={LOGO_IMG} alt="TELECOMSY" style={{width:30,height:30,objectFit:"contain",filter:"drop-shadow(0 1px 3px #00000060)"}}/>
          </div>
          {!collapsed && (
            <div style={{overflow:"hidden",flex:1}}>
              <div style={{fontWeight:700,fontSize:13,color:"#D4E3F5",whiteSpace:"nowrap"}}>TELECOMSY</div>
              <div style={{fontSize:10,color:"#3A5070",letterSpacing:"1px",textTransform:"uppercase",display:"flex",alignItems:"center",gap:5}}>
                Supply Office v{APP_VERSION}
                <span style={{background:API_BASE?"#052E1C":"#17253D",color:API_BASE?"#34D399":"#3A5070",
                  border:"1px solid "+(API_BASE?"#065F46":"#1E3050"),borderRadius:3,padding:"0px 4px",fontSize:9}}>
                  {API_BASE?"REST API":"LOCAL"}
                </span>
              </div>
            </div>
          )}
          <button onClick={()=>setCollapsed(c=>!c)} style={{background:"none",border:"none",color:"#3A5070",
            cursor:"pointer",fontSize:16,padding:4,flexShrink:0,marginLeft:"auto"}}>
            {collapsed?"›":"‹"}
          </button>
        </div>

        {/* Cycle selector */}
        {!collapsed && (
          <div style={{padding:"10px 12px",borderBottom:"1px solid #0F1A2A"}}>
            {activeCycle ? (
              <>
                <div style={{fontSize:10,color:"#3A5070",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Viewing Cycle</div>
                {cycles.length>1 && (
                  <select value={viewCycle||""} onChange={e=>setViewCycle(e.target.value?Number(e.target.value):null)}
                    style={{...IS,fontSize:10,padding:"3px 6px"}}>
                    <option value="">Current ({activeCycle?monthLabel(activeCycle.month):"—"})</option>
                    {[...cycles].reverse().map(c=>(
                      <option key={c.id} value={c.id}>{monthLabel(c.month)} ({c.status})</option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <div style={{fontSize:11,color:"#F87171"}}>No open cycle</div>
            )}
          </div>
        )}

        {/* Nav links */}
        <nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>navigate(n.id)}
              onMouseEnter={e=>{if(page!==n.id)e.currentTarget.style.background="#0F1B2D";}}
              onMouseLeave={e=>{if(page!==n.id)e.currentTarget.style.background="none";}}
              style={{display:"flex",alignItems:"center",gap:11,width:"100%",
                padding:collapsed?"10px":"9px 12px",borderRadius:9,border:"none",cursor:"pointer",marginBottom:3,
                background:  page===n.id?"linear-gradient(90deg,#1A6FA828,#1A6FA810)":"none",
                color:       page===n.id?"#5BB5F5":"#4A6580",
                borderLeft:  page===n.id?"2px solid #5BB5F5":"2px solid transparent",
                fontSize:13,fontWeight:page===n.id?600:400,
                textAlign:"left",whiteSpace:"nowrap",overflow:"hidden",transition:"all .15s",
                justifyContent:collapsed?"center":"flex-start"}}>
              <span style={{fontSize:16,flexShrink:0,opacity:page===n.id?1:.7}}>{n.icon}</span>
              {!collapsed&&<span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{n.label}</span>}
            </button>
          ))}
        </nav>

        {/* ── Notifications button ── */}
        <div style={{padding:"8px 10px",borderTop:"1px solid #17253D",borderBottom:"1px solid #0F1A2A"}}>
          <button onClick={openNotifPanel}
            onMouseEnter={e=>{if(!showNotifs)e.currentTarget.style.background="#0F1B2D";}}
            onMouseLeave={e=>{if(!showNotifs)e.currentTarget.style.background=unread>0?"#071828":"none";}}
            style={{width:"100%",background:showNotifs?"#0F1B2D":unread>0?"#071828":"none",
              border:showNotifs?"1px solid #1A6FA8":unread>0?"1px solid #1A3A5A":"1px solid transparent",
              borderRadius:9,padding:collapsed?"10px":"9px 12px",cursor:"pointer",
              display:"flex",alignItems:"center",gap:11,
              justifyContent:collapsed?"center":"flex-start",transition:"all .15s",
              color:showNotifs?"#5BB5F5":unread>0?"#FBBF24":"#4A6580"}}>
            <span style={{fontSize:16,flexShrink:0,position:"relative"}}>
              🔔
              {unread>0 && (
                <span style={{position:"absolute",top:-5,right:-7,background:"#EF4444",color:"#fff",
                  borderRadius:"50%",width:15,height:15,fontSize:8,fontWeight:800,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  border:"1.5px solid #0C1222",animation:"pulse 2s ease-in-out infinite"}}>
                  {unread>9?"9+":unread}
                </span>
              )}
            </span>
            {!collapsed && (
              <span style={{fontSize:13,fontWeight:showNotifs?600:400,flex:1,textAlign:"left"}}>
                Notifications
              </span>
            )}
            {!collapsed && unread>0 && (
              <span style={{background:"#EF4444",color:"#fff",borderRadius:10,padding:"1px 7px",
                fontSize:10,fontWeight:700,flexShrink:0}}>
                {unread}
              </span>
            )}
          </button>
          {/* Sound toggle */}
          {!collapsed && (
            <button onClick={()=>setSoundOn(s=>!s)}
              onMouseEnter={e=>e.currentTarget.style.background="#0F1B2D"}
              onMouseLeave={e=>e.currentTarget.style.background="none"}
              style={{width:"100%",marginTop:4,background:"none",border:"none",borderRadius:7,
                padding:"6px 12px",cursor:"pointer",fontSize:11,color:"#2A4060",
                display:"flex",alignItems:"center",gap:7,transition:"all .15s"}}>
              <span style={{fontSize:13}}>{soundOn?"🔊":"🔇"}</span>
              <span>{soundOn?"Sound On":"Sound Off"}</span>
            </button>
          )}
        </div>

        {/* User + sign out */}
        <div style={{padding:"12px 10px"}}>
          {!collapsed && (
            <div style={{background:"#080C16",borderRadius:10,padding:"10px 12px",marginBottom:8,border:"1px solid #17253D"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,
                  background:currentUser.role==="superadmin"?"linear-gradient(135deg,#5A1A8A,#7C3AED)":
                    currentUser.role==="manager"?"linear-gradient(135deg,#1A5A8A,#1A6FA8)":
                    "linear-gradient(135deg,#1A6A4A,#059669)"}}>
                  {currentUser.name[0]}
                </div>
                <div style={{overflow:"hidden"}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#C9D5E8",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{currentUser.name}</div>
                  <div style={{fontSize:10,color:"#3A5070",textTransform:"capitalize"}}>{currentUser.role}</div>
                </div>
              </div>
            </div>
          )}
          <button onClick={()=>{setCurrentUser(null);try{localStorage.removeItem("tsy_user");}catch(e){}}}
            style={{width:"100%",background:"#0F0808",border:"1px solid #2A1010",borderRadius:9,
              color:"#F87171",padding:"8px",cursor:"pointer",fontSize:12,fontWeight:600,
              display:"flex",alignItems:"center",justifyContent:"center",gap:6}}
            onMouseEnter={e=>e.currentTarget.style.background="#1F0808"}
            onMouseLeave={e=>e.currentTarget.style.background="#0F0808"}>
            <span>⏏</span>{!collapsed&&<span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <header style={{height:56,background:"linear-gradient(90deg,#0C1222,#0A1020)",borderBottom:"1px solid #17253D",
          display:"flex",alignItems:"center",padding:"0 24px",flexShrink:0,gap:14,boxShadow:"0 1px 12px #00000030"}}>
          <span style={{fontWeight:700,fontSize:15,color:"#C9D5E8",letterSpacing:"-.1px"}}>
            {NAV.find(n=>n.id===page)?.label||"Dashboard"}
          </span>
          {currentCycle && (
            <span style={{fontSize:11,
              background:currentCycle.status==="open"?"#052E1C":"#2D0909",
              border:`1px solid ${currentCycle.status==="open"?"#065F46":"#7F1D1D"}`,
              color:currentCycle.status==="open"?"#34D399":"#F87171",
              padding:"2px 10px",borderRadius:20,fontFamily:"'DM Mono'",fontWeight:600}}>
              {currentCycle.status==="open"?"🟢":"🔴"} {monthLabel(currentCycle.month)}
            </span>
          )}
          <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
            {/* Bell in header */}
            <button onClick={openNotifPanel} style={{position:"relative",background:"none",border:"none",
              cursor:"pointer",padding:"6px 8px",color:"#4A6580",borderRadius:8,transition:"all .15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="#0F1B2D"}
              onMouseLeave={e=>e.currentTarget.style.background="none"}>
              <span style={{fontSize:18}}>🔔</span>
              {unread>0 && (
                <span style={{position:"absolute",top:2,right:2,background:"#EF4444",color:"#fff",
                  borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:800,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  border:"2px solid #0A1020"}}>
                  {unread>9?"9+":unread}
                </span>
              )}
            </button>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px",background:"#0C1A2E",borderRadius:20,border:"1px solid #17253D"}}>
              <div style={{width:7,height:7,borderRadius:"50%",
                background:currentUser.role==="superadmin"?"#C084FC":currentUser.role==="manager"?"#5BB5F5":"#34D399",
                boxShadow:`0 0 6px ${currentUser.role==="superadmin"?"#C084FC":currentUser.role==="manager"?"#5BB5F5":"#34D399"}`}}/>
              <span style={{fontSize:12,color:"#94ADC8",fontWeight:600}}>{currentUser.name}</span>
            </div>
          </div>
        </header>

        <main style={{flex:1,overflow:"auto",padding:22}}>
          {page==="dashboard" &&                        <Dashboard  {...shared}/>}
          {page==="companies" && canSee("companies") && <Companies  {...shared}/>}
          {page==="ports"     && canSee("ports")     && <Ports      {...shared}/>}
          {page==="requests"  && canSee("requests")  && <Requests   {...shared}/>}
          {page==="pricing"   && canSee("pricing")   && <Pricing    {...shared}/>}
          {page==="branches"  && canSee("branches")  && <Branches   {...shared}/>}
          {page==="areas"     && canSee("areas")     && <Areas      {...shared}/>}
          {page==="cycles"    && canSee("cycles")    && <Cycles     {...shared}/>}
          {page==="users"     && canSee("users")     && <Users      {...shared}/>}
        </main>
      </div>

      {/* NOTIFICATION PANEL */}
      {showNotifs && (
        <NotifPanel
          notifs={notifs}
          unread={unread}
          onClose={()=>setShowNotifs(false)}
          onClear={()=>{ setNotifs([]); api.clearNotifications().catch(()=>{}); }}
          onMarkRead={()=>{ setNotifs(prev=>prev.map(n=>({...n,read:true}))); api.markAllRead(currentUser.id).catch(()=>{}); }}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div style={{position:"fixed",bottom:24,right:showNotifs?364:24,zIndex:9999,
          background:toast.type==="ok"?"#071F14":"#1F0707",
          border:`1px solid ${toast.type==="ok"?"#0A5A30":"#5A1010"}`,
          color:toast.type==="ok"?"#34D399":"#F87171",
          padding:"12px 20px",borderRadius:12,fontSize:13,fontWeight:500,
          boxShadow:"0 8px 32px #00000090",animation:"toastIn .25s cubic-bezier(.2,.8,.3,1)",
          maxWidth:360,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>{toast.type==="ok"?"✅":"❌"}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#080C16}
        ::-webkit-scrollbar-thumb{background:#17253D;border-radius:3px}
        input,select,textarea{outline:none}
        @keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
        @keyframes fadeIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .hrow:hover td{background:#0F1B2D}
        .sortable{cursor:pointer;user-select:none}
        .sortable:hover{color:#5BB5F5 !important}
      `}</style>
    </div>
  );
}
