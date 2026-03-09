import { useState } from "react";
import { fmt, fmtMb, fmtDate, monthLabel, TIER_COLOR } from "../../constants";
import BarChart from "../charts/BarChart";
import BranchDetail from "./BranchDetail";

export default function Dashboard({ companies, ports, requests, cycles, govs, areas, setPage, currentCycle }) {
  const [branchDetail, setBranchDetail] = useState(null);

  if (branchDetail) {
    const gov = govs.find(g => g.id === branchDetail);
    if (gov) return (
      <BranchDetail gov={gov} govs={govs} areas={areas} companies={companies}
        ports={ports} requests={requests} cycles={cycles}
        setPage={() => setBranchDetail(null)}/>
    );
  }

  const cycleReqs  = currentCycle ? requests.filter(r => r.cycleId === currentCycle.id) : [];
  const approved   = cycleReqs.filter(r => r.status === "approved");
  const pending    = cycleReqs.filter(r => r.status === "pending");
  const allRevenue = approved.reduce((s, r) => s + r.total, 0);
  const totalPorts = ports.length;
  const totalMbAll = approved.filter(r => r.totalPackageMb > 0).reduce((s, r) => s + r.totalPackageMb, 0);

  const coTotals = companies.map(co => {
    const coR     = cycleReqs.filter(r => r.companyId === co.id);
    const appR    = coR.filter(r => r.status === "approved");
    const pkgMb   = appR.filter(r => r.totalPackageMb > 0).reduce((s, r) => s + r.totalPackageMb, 0);
    const pkgRev  = appR.filter(r => r.totalPackageMb > 0).reduce((s, r) => s + r.speedCost, 0);
    const portRev = appR.filter(r => r.totalPackageMb === 0).reduce((s, r) => s + r.portCost, 0);
    const totalDue = pkgRev + portRev;
    const tierCode = appR.find(r => r.totalPackageMb > 0)?.tierCode || "—";
    return { co, coR, appR, pkgMb, pkgRev, portRev, totalDue, tierCode };
  }).filter(x => x.coR.length > 0).sort((a, b) => b.totalDue - a.totalDue);

  const branchStats = govs.map(g => {
    const gAreas       = areas.filter(a => a.govId === g.id);
    const gReqs        = cycleReqs.filter(r => r.govId === g.id);
    const gApp         = gReqs.filter(r => r.status === "approved");
    const totalMb      = gApp.filter(r => r.totalPackageMb > 0).reduce((s, r) => s + r.totalPackageMb, 0);
    const rev          = gApp.reduce((s, r) => s + r.total, 0);
    const portCount    = ports.filter(p => gAreas.some(a => a.id === p.areaId)).length;
    const pendingCount = gReqs.filter(r => r.status === "pending").length;
    return { g, totalMb, rev, portCount, reqCount: gReqs.length, pendingCount, areaCount: gAreas.length };
  });

  const speedChartData = branchStats.map(b => ({ label: b.g.name.slice(0, 7), value: b.totalMb }));
  const revChartData   = branchStats.map(b => ({ label: b.g.name.slice(0, 7), value: b.rev }));
  const last8          = [...cycles].sort((a, b) => a.month.localeCompare(b.month)).slice(-8);
  const trendData      = last8.map(c => ({
    label: c.month.slice(2).replace("-", "/"),
    value: requests.filter(r => r.cycleId === c.id && r.status === "approved").reduce((s, r) => s + r.total, 0),
  }));
  const coSpeedData = coTotals.slice(0, 8).map(x => ({ label: x.co.name.slice(0, 8), value: x.pkgMb }));

  const fmtRev = v => "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits:0, maximumFractionDigits:0 });
  const fmtRevTip = v => "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const fmtSpd = v => v >= 1000 ? (v/1000).toFixed(1)+"G" : v+"M";
  const fmtSpdTip = v => v >= 1000 ? (v/1000).toFixed(2)+" Gbps" : v.toLocaleString()+" Mbps";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {/* Cycle banner */}
      {currentCycle && (
        <div style={{
          background: currentCycle.status === "open" ? "#031A0E" : "#1A0808",
          border: `1px solid ${currentCycle.status === "open" ? "#065F46" : "#7F1D1D"}`,
          borderRadius:12, padding:"14px 20px", display:"flex", alignItems:"center", gap:16,
          boxShadow: `0 0 24px ${currentCycle.status === "open" ? "#065F4620" : "#7F1D1D20"}`,
        }}>
          <div style={{
            width:10, height:10, borderRadius:5, flexShrink:0,
            background: currentCycle.status === "open" ? "#34D399" : "#F87171",
            boxShadow: `0 0 8px ${currentCycle.status === "open" ? "#34D399" : "#F87171"}`,
          }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:14, letterSpacing:.3,
              color: currentCycle.status === "open" ? "#34D399" : "#F87171" }}>
              {currentCycle.status === "open" ? "CYCLE OPEN" : "CYCLE CLOSED"} — {monthLabel(currentCycle.month).toUpperCase()}
            </div>
            <div style={{ fontSize:11, color:"#3A5070", marginTop:3, display:"flex", gap:16, flexWrap:"wrap" }}>
              <span>Opened {fmtDate(currentCycle.openedAt)}</span>
              {currentCycle.closedAt && <span>Closed {fmtDate(currentCycle.closedAt)}</span>}
              <span style={{ color:"#FBBF24" }}>{pending.length} pending</span>
              <span style={{ color:"#34D399" }}>{approved.length} approved</span>
            </div>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
        {[
          { label:"Companies",    val:companies.length,  icon:"🏢", color:"#5BB5F5", sub:companies.length+" active",          go:"companies" },
          { label:"Total Ports",  val:totalPorts,        icon:"🔌", color:"#34D399", sub:govs.length+" branches",              go:"ports"     },
          { label:"Pending",      val:pending.length,    icon:"⏳", color:"#FBBF24", sub:"need approval",                     go:"requests"  },
          { label:"Total Speed",  val:fmtMb(totalMbAll), icon:"⚡", color:"#5BB5F5", sub:"this cycle (approved)",              go:null        },
          { label:"Cycle Revenue",val:fmt(allRevenue),   icon:"💰", color:"#C084FC", sub:approved.length+" approved requests", go:null        },
        ].map(k => (
          <div key={k.label} onClick={() => k.go && setPage(k.go)}
            style={{
              background:"#0C1222", border:"1px solid #17253D", borderRadius:12, padding:"14px 16px",
              cursor:k.go?"pointer":"default", transition:"border-color .15s,transform .1s",
              position:"relative", overflow:"hidden",
            }}
            onMouseEnter={e => { if (k.go) { e.currentTarget.style.borderColor = k.color; e.currentTarget.style.transform = "translateY(-1px)"; }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#17253D"; e.currentTarget.style.transform = "none"; }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:k.color, borderRadius:"12px 12px 0 0", opacity:.7 }}/>
            <div style={{ fontSize:20, marginBottom:8, marginTop:4 }}>{k.icon}</div>
            <div style={{ fontFamily:"'DM Mono'", fontSize:20, fontWeight:700, color:k.color, lineHeight:1 }}>{k.val}</div>
            <div style={{ fontSize:12, color:"#94ADC8", marginTop:4, fontWeight:600 }}>{k.label}</div>
            <div style={{ fontSize:10, color:"#3A5070", marginTop:2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {[
          { title:"Speed by Branch",   data:speedChartData, color:"#5BB5F5", fmt:fmtSpd,  tip:fmtSpdTip, legend:"#5BB5F5", legendFmt:b=>fmtMb(b.totalMb), legendKey:"totalMb" },
          { title:"Revenue by Branch", data:revChartData,   color:"#C084FC", fmt:fmtRev,  tip:fmtRevTip, legend:"#C084FC", legendFmt:b=>fmt(b.rev),        legendKey:"rev"     },
        ].map(({ title, data, color, fmt:f, tip, legend, legendFmt, legendKey }) => (
          <div key={title} style={{ background:"#0C1222", border:"1px solid #17253D", borderRadius:12, padding:"16px 18px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#94ADC8", textTransform:"uppercase", letterSpacing:.8 }}>{title}</div>
              <div style={{ fontSize:10, color:"#3A5070" }}>{currentCycle ? monthLabel(currentCycle.month) : "current cycle"}</div>
            </div>
            {data.every(d => d.value === 0)
              ? <div style={{ color:"#3A5070", fontSize:13, padding:"24px 0", textAlign:"center" }}>No data yet.</div>
              : <BarChart data={data} color={color} height={110} fmt={f} fmtTooltip={tip}/>}
            <div style={{ display:"flex", gap:16, marginTop:8, flexWrap:"wrap" }}>
              {branchStats.map(b => (
                <div key={b.g.id} style={{ fontSize:10, color:"#3A5070" }}>
                  <span style={{ color:legend, fontFamily:"'DM Mono'", fontWeight:700 }}>{legendFmt(b)}</span>
                  {" "}{b.g.name}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Charts row 2 */}
      <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16 }}>
        <div style={{ background:"#0C1222", border:"1px solid #17253D", borderRadius:12, padding:"16px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#94ADC8", textTransform:"uppercase", letterSpacing:.8 }}>Monthly Revenue Trend</div>
            <div style={{ fontSize:10, color:"#3A5070" }}>last {last8.length} cycles</div>
          </div>
          {trendData.every(d => d.value === 0)
            ? <div style={{ color:"#3A5070", fontSize:13, padding:"24px 0", textAlign:"center" }}>No revenue history yet.</div>
            : <BarChart data={trendData} color="#34D399" height={110} fmt={fmtRev} fmtTooltip={fmtRevTip}/>}
        </div>
        <div style={{ background:"#0C1222", border:"1px solid #17253D", borderRadius:12, padding:"16px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#94ADC8", textTransform:"uppercase", letterSpacing:.8 }}>Speed by Company</div>
            <div style={{ fontSize:10, color:"#3A5070" }}>current cycle</div>
          </div>
          {coSpeedData.every(d => d.value === 0)
            ? <div style={{ color:"#3A5070", fontSize:13, padding:"24px 0", textAlign:"center" }}>No approved requests yet.</div>
            : <BarChart data={coSpeedData} color="#F97316" height={110} fmt={fmtSpd} fmtTooltip={fmtSpdTip}/>}
        </div>
      </div>

      {/* Branch cards */}
      <div>
        <div style={{ fontSize:11, color:"#3A5070", fontWeight:700, textTransform:"uppercase", letterSpacing:".8px", marginBottom:10 }}>
          🏛 Branches — click for details
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:12 }}>
          {branchStats.map(({ g, totalMb, rev, portCount, reqCount, pendingCount, areaCount }) => (
            <div key={g.id} onClick={() => setBranchDetail(g.id)}
              style={{ background:"#0C1222", border:"1px solid #17253D", borderRadius:12, padding:"16px 18px", cursor:"pointer", transition:"all .15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#5BB5F5"; e.currentTarget.style.background = "#0F1A2E"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#17253D"; e.currentTarget.style.background = "#0C1222"; e.currentTarget.style.transform = "none"; }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                <div style={{ fontWeight:700, fontSize:15, color:"#D4E3F5" }}>🏛 {g.name}</div>
                <div style={{ display:"flex", gap:5 }}>
                  {pendingCount > 0 && (
                    <span style={{ fontSize:10, color:"#FBBF24", background:"#2D2006", border:"1px solid #78500A", padding:"1px 7px", borderRadius:10 }}>{pendingCount} pending</span>
                  )}
                  <span style={{ fontSize:10, color:"#3A5070", background:"#112040", padding:"1px 7px", borderRadius:10 }}>{reqCount} reqs</span>
                </div>
              </div>
              {[
                { label:"Speed",   val:totalMb, max:Math.max(...branchStats.map(b => b.totalMb), 1), color:"#5BB5F5", fmt:v => fmtMb(v)  },
                { label:"Revenue", val:rev,     max:Math.max(...branchStats.map(b => b.rev),     1), color:"#C084FC", fmt:v => fmt(v)    },
              ].map(bar => (
                <div key={bar.label} style={{ marginBottom:7 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:10, color:"#3A5070" }}>{bar.label}</span>
                    <span style={{ fontSize:10, fontFamily:"'DM Mono'", color:bar.color, fontWeight:600 }}>{bar.val > 0 ? bar.fmt(bar.val) : "—"}</span>
                  </div>
                  <div style={{ height:4, background:"#0A1422", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${Math.round((bar.val/bar.max)*100)}%`, background:bar.color, borderRadius:2, opacity:.8 }}/>
                  </div>
                </div>
              ))}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, borderTop:"1px solid #17253D", paddingTop:10, marginTop:4 }}>
                {[{ label:"PORTS", val:portCount, color:"#34D399" }, { label:"AREAS", val:areaCount, color:"#94ADC8" }].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize:9, color:"#3A5070", marginBottom:2 }}>{s.label}</div>
                    <div style={{ fontFamily:"'DM Mono'", fontSize:13, color:s.color, fontWeight:700 }}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:8, fontSize:10, color:"#3A5070", display:"flex", justifyContent:"flex-end", alignItems:"center", gap:4 }}>
                View details <span style={{ color:"#5BB5F5" }}>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Company totals table */}
      <div style={{ background:"#0C1222", border:"1px solid #17253D", borderRadius:12, padding:"16px 18px" }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#94ADC8", textTransform:"uppercase", letterSpacing:.8, marginBottom:14 }}>
          Company Totals — {currentCycle ? monthLabel(currentCycle.month) : "All Cycles"}
        </div>
        {coTotals.length === 0
          ? <div style={{ color:"#3A5070", fontSize:13, padding:"12px 0" }}>No requests in this cycle yet.</div>
          : <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #1A2E4A" }}>
                  {["Company","Mbps","Tier","Packages","Port Fees","Total Due"].map(h => (
                    <th key={h} style={{ padding:"6px 10px", textAlign:h==="Company"?"left":"right",
                      color:"#3A5070", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coTotals.map(({ co, pkgMb, pkgRev, portRev, totalDue, tierCode }, i) => (
                  <tr key={co.id} style={{ borderBottom:"1px solid #0F1A2A", background:i%2===0?"transparent":"#060A1440" }}>
                    <td style={{ padding:"9px 10px", fontWeight:600, color:"#C9D5E8" }}>{co.name}</td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono'", color:"#5BB5F5" }}>{fmtMb(pkgMb)}</td>
                    <td style={{ padding:"9px 10px", textAlign:"right" }}>
                      <span style={{ fontFamily:"'DM Mono'", fontWeight:700, padding:"1px 8px", borderRadius:4,
                        background:(TIER_COLOR[tierCode]||"#94ADC8")+"20", color:TIER_COLOR[tierCode]||"#94ADC8" }}>{tierCode}</span>
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono'", color:"#5BB5F5" }}>{fmt(pkgRev)}</td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono'", color:portRev>0?"#C084FC":"#2A4060" }}>{portRev>0?fmt(portRev):"—"}</td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono'", fontWeight:700, color:"#34D399", fontSize:13 }}>{fmt(totalDue)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop:"2px solid #1A2E4A" }}>
                  <td colSpan={3} style={{ padding:"8px 10px", fontSize:11, color:"#3A5070", fontWeight:600 }}>TOTAL</td>
                  <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'DM Mono'", color:"#5BB5F5", fontWeight:700 }}>{fmt(coTotals.reduce((s,x)=>s+x.pkgRev,0))}</td>
                  <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'DM Mono'", color:"#C084FC", fontWeight:700 }}>{fmt(coTotals.reduce((s,x)=>s+x.portRev,0))}</td>
                  <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'DM Mono'", color:"#34D399", fontWeight:700, fontSize:14 }}>{fmt(coTotals.reduce((s,x)=>s+x.totalDue,0))}</td>
                </tr>
              </tbody>
            </table>
        }
      </div>
    </div>
  );
}
