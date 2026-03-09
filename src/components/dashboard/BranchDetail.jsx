import { fmt, fmtMb, monthLabel } from "../../constants";
import { Card, DataTable } from "../ui";
import BarChart from "../charts/BarChart";

export default function BranchDetail({ gov, govs, areas, companies, ports, requests, cycles }) {
  const govAreas = areas.filter(a => a.govId === gov.id);
  const govPorts = ports.filter(p => govAreas.some(a => a.id === p.areaId));
  const govReqs  = requests.filter(r => r.govId === gov.id);
  const approved = govReqs.filter(r => r.status === "approved");
  const pending  = govReqs.filter(r => r.status === "pending");
  const revenue  = approved.reduce((s, r) => s + r.total, 0);
  const totalMb  = approved.reduce((s, r) => s + r.totalPackageMb, 0);

  const last6 = [...cycles].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  const revChart = last6.map(c => ({
    label: c.month.slice(5),
    value: requests.filter(r => r.cycleId === c.id && r.govId === gov.id && r.status === "approved")
                   .reduce((s, r) => s + r.total, 0),
  }));

  const areaSpeedChart = govAreas.map(a => ({
    label: a.name.split(" ")[0],
    value: approved.filter(r => ports.filter(p => p.areaId === a.id)
      .some(p => r.portPackages?.some(pp => pp.portId === p.id)))
      .reduce((s, r) => s + r.totalPackageMb, 0),
  })).filter(a => a.value > 0).slice(0, 8);

  const activeCoIds = [...new Set(govReqs.map(r => r.companyId))];
  const activeCos = activeCoIds.map(cid => {
    const co        = companies.find(c => c.id === cid);
    const coReqs    = govReqs.filter(r => r.companyId === cid);
    const coApproved = coReqs.filter(r => r.status === "approved");
    return {
      co, reqs: coReqs.length, approved: coApproved.length,
      mb:      coApproved.reduce((s, r) => s + r.totalPackageMb, 0),
      revenue: coApproved.reduce((s, r) => s + r.total, 0),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const areaData = govAreas.map(a => ({
    area: a, portCount: govPorts.filter(p => p.areaId === a.id).length,
  }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:20, color:"#D4E3F5" }}>🏛 {gov.name}</div>
          <div style={{ fontSize:12, color:"#3A5070" }}>
            {govAreas.length} areas · {govPorts.length} ports · {activeCoIds.length} companies
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
        {[
          { label:"Total Revenue",      val:fmt(revenue),     color:"#C084FC" },
          { label:"Total Speed",        val:fmtMb(totalMb),   color:"#5BB5F5" },
          { label:"Approved Requests",  val:approved.length,  color:"#34D399" },
          { label:"Pending Requests",   val:pending.length,   color:"#FBBF24" },
          { label:"Active Ports",       val:govPorts.length,  color:"#34D399" },
        ].map(k => (
          <div key={k.label} style={{ background:"#0C1222", border:"1px solid #17253D", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontFamily:"'DM Mono'", fontSize:20, fontWeight:500, color:k.color, marginBottom:4 }}>{k.val}</div>
            <div style={{ fontSize:11, color:"#3A5070" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card title={"Monthly Revenue — " + gov.name}>
          {revChart.every(d => d.value === 0)
            ? <div style={{ color:"#3A5070", fontSize:13, padding:"16px 0" }}>No approved revenue yet.</div>
            : <BarChart data={revChart} color="#C084FC" height={90}
                fmt={v => "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits:0, maximumFractionDigits:0 })}
                fmtTooltip={v => "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}/>}
        </Card>
        <Card title={"Speed by Area — " + gov.name}>
          {areaSpeedChart.length === 0
            ? <div style={{ color:"#3A5070", fontSize:13, padding:"16px 0" }}>No approved speed data yet.</div>
            : <BarChart data={areaSpeedChart} color="#5BB5F5" height={90}
                fmt={v => v >= 1000 ? (v/1000).toFixed(0)+"G" : v+"M"}
                fmtTooltip={v => v >= 1000 ? (v/1000).toFixed(2)+" Gbps" : v.toLocaleString()+" Mbps"}/>}
        </Card>
      </div>

      {/* Companies table */}
      <Card title="Companies in This Branch">
        {activeCos.length === 0
          ? <div style={{ color:"#3A5070", fontSize:13, padding:"8px 0" }}>No company requests in this branch yet.</div>
          : <DataTable
              cols={["Company","Requests","Approved","Total Speed","Revenue"]}
              rows={activeCos.map(({ co, reqs, approved:app, mb, revenue:rev }) => [
                <span key="n" style={{ fontWeight:600 }}>{co?.name||"?"}</span>,
                reqs,
                <span key="a" style={{ color:"#34D399", fontWeight:600 }}>{app}</span>,
                <span key="m" style={{ fontFamily:"'DM Mono'", color:"#5BB5F5" }}>{fmtMb(mb)}</span>,
                <span key="r" style={{ fontFamily:"'DM Mono'", color:"#C084FC", fontWeight:600 }}>{fmt(rev)}</span>,
              ])}
            />
        }
      </Card>

      {/* Areas table */}
      <Card title="Areas & Ports">
        <DataTable
          cols={["Area","Note","Ports"]}
          rows={areaData.map(({ area, portCount }) => [
            <span key="n" style={{ fontWeight:600 }}>{area.name}</span>,
            <span key="no" style={{ color:"#3A5070", fontSize:12 }}>{area.note||"—"}</span>,
            <span key="p" style={{ fontFamily:"'DM Mono'", color:"#34D399", fontWeight:600 }}>{portCount}</span>,
          ])}
        />
      </Card>
    </div>
  );
}
