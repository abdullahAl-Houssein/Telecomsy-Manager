// ─────────────────────────────────────────────────────────────────────────────
//  EXCEL / CSV EXPORT UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
import { monthLabel, fmtDate } from "../constants";

function csvRow(cells) {
  return cells.map(c => {
    const s = String(c == null ? "" : c);
    return (s.includes(",") || s.includes('"') || s.includes("\n"))
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(",");
}

function downloadCSV(filename, rows) {
  const bom = "\uFEFF";
  const csv = bom + rows.map(csvRow).join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportPortsByArea(areaId, ports, areas, companies, govs) {
  const area = areas.find(a => a.id === areaId);
  const gov  = govs.find(g => g.id === area?.govId);
  const rows = [
    ["TELECOMSY — Ports by Area"],
    ["Area:", area?.name||"", "Governorate:", gov?.name||""],
    ["Generated:", new Date().toLocaleDateString("en-GB")],
    [],
    ["Port ID","Company","Contact","Area","Governorate","Type","Port #"],
  ];
  ports.filter(p => p.areaId === areaId).forEach(p => {
    const co = companies.find(c => c.id === p.companyId);
    rows.push([p.id, co?.name||"", co?.contact||"", area?.name||"", gov?.name||"", p.type, p.portIndex]);
  });
  rows.push([]); rows.push(["Total ports:", ports.filter(p => p.areaId === areaId).length]);
  downloadCSV("ports-area-" + (area?.name||areaId) + ".csv", rows);
}

export function exportRequestsByMonth(cycleId, requests, companies, govs, cycles) {
  const cy     = cycles.find(c => c.id === cycleId);
  const cyReqs = requests.filter(r => r.cycleId === cycleId);
  const rows   = [
    ["TELECOMSY — Monthly Requests Report"],
    ["Cycle:", cy ? monthLabel(cy.month) : "", "Status:", cy?.status||""],
    ["Generated:", new Date().toLocaleDateString("en-GB")],
    [],
    ["Req ID","Company","Governorate","Status","Package (Mbps)","Tier","Speed Cost ($)","Port Fees ($)","Total ($)","Date"],
  ];
  cyReqs.forEach(r => {
    const co  = companies.find(c => c.id === r.companyId);
    const gov = govs.find(g => g.id === r.govId);
    rows.push([r.id, co?.name||"", gov?.name||"", r.status,
      r.totalPackageMb, r.tierCode,
      r.speedCost.toFixed(2), r.portCost.toFixed(2), r.total.toFixed(2),
      fmtDate(r.createdAt)]);
  });
  rows.push([]); rows.push(["","","","TOTAL APPROVED","","","","",
    cyReqs.filter(r => r.status === "approved").reduce((s,r) => s + r.total, 0).toFixed(2)]);
  downloadCSV("requests-" + (cy ? cy.month : "all") + ".csv", rows);
}

export function exportCompanies(companies, ports, areas, govs, requests, cycles) {
  const rows = [
    ["TELECOMSY — Companies Export"],
    ["Generated:", new Date().toLocaleDateString("en-GB")],
    [],
    ["ID","Company Name","Contact","Phone","Email","Total Ports","Govs Active","Total Requests","Approved Requests","Total Revenue ($)"],
  ];
  companies.forEach(co => {
    const coPorts  = ports.filter(p => p.companyId === co.id);
    const govIds   = [...new Set(coPorts.map(p => areas.find(a => a.id === p.areaId)?.govId).filter(Boolean))];
    const allReqs  = requests.filter(r => r.companyId === co.id);
    const approved = allReqs.filter(r => r.status === "approved");
    const revenue  = approved.reduce((s,r) => s + r.total, 0);
    rows.push([co.id, co.name, co.contact||"", co.phone||"", co.email||"",
      coPorts.length, govIds.map(gid => govs.find(g => g.id === gid)?.name||"").join(" / "),
      allReqs.length, approved.length, revenue.toFixed(2)]);
  });
  rows.push([]); rows.push(["Total companies:", companies.length]);
  downloadCSV("companies-export.csv", rows);
}

export function exportPortOpeningRequests(cycleId, requests, companies, govs, areas, cycles) {
  const cy       = cycles.find(c => c.id === cycleId);
  const portReqs = requests.filter(r => (!cycleId || r.cycleId === cycleId) && r.newPorts?.length > 0);
  const rows     = [
    ["TELECOMSY — Port Opening Requests"],
    ["Cycle:", cy ? monthLabel(cy.month) : "All cycles", "Generated:", new Date().toLocaleDateString("en-GB")],
    [],
    ["Req ID","Company","Governorate","Request Status","Area","Port Type","Port #","Port Fee ($)"],
  ];
  portReqs.forEach(r => {
    const co  = companies.find(c => c.id === r.companyId);
    const gov = govs.find(g => g.id === r.govId);
    r.newPorts.forEach((np, i) => {
      const area = areas.find(a => a.id === np.areaId);
      const fee  = np.type === "10G" ? 1200 : np.portIndex === 1 ? 150 : 500;
      rows.push([
        i===0 ? r.id : "", i===0 ? co?.name||"" : "", i===0 ? gov?.name||"" : "",
        i===0 ? r.status : "",
        area?.name||"", np.type, np.portIndex, fee,
      ]);
    });
  });
  downloadCSV("port-opening-requests-" + (cy ? cy.month : "all") + ".csv", rows);
}
