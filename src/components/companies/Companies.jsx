import { useState, useMemo } from "react";
import { fmt, fmtMb, fmtDate, monthLabel, IS, LBL, REQ_STATUS, CYCLE_STATUS, calcPrice } from "../../constants";
import { Btn, IBtn, Badge, GovBadge, Stat, Row, Muted, Card, SLabel, CostLine, ToolBar, Modal, DataTable, SearchBox, FI, FS, MiniStat } from "../ui";
import useConfirm from "../../hooks/useConfirm";
import { exportCompanies } from "../../utils/exports";

function CoOverview({ co, ports, areas, govs, requests, cycles, currentCycle }) {
  // Group ports by governorate
  const coPorts = ports.filter(p=>p.companyId===co.id);
  const govGroups = govs.map(g=>{
    const gAreas = areas.filter(a=>a.govId===g.id);
    const gPorts = coPorts.filter(p=>gAreas.some(a=>a.id===p.areaId));
    if (!gPorts.length) return null;
    const totalMb = requests.filter(r=>r.companyId===co.id&&r.govId===g.id&&r.status!=="rejected")
      .reduce((s,r)=>s+r.totalPackageMb,0);
    return { gov:g, gPorts, totalMb };
  }).filter(Boolean);

  // All-time monthly history
  const history = cycles.map(c=>{
    const cReqs = requests.filter(r=>r.companyId===co.id&&r.cycleId===c.id);
    const approved = cReqs.filter(r=>r.status==="approved");
    return { cycle:c, reqs:cReqs, totalMb:cReqs.reduce((s,r)=>s+r.totalPackageMb,0), due:approved.reduce((s,r)=>s+r.total,0) };
  }).filter(x=>x.reqs.length>0).reverse();

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Per-gov breakdown */}
      <div>
        <SLabel>Active Governorates & Ports</SLabel>
        {govGroups.length===0 && <div style={{color:"#3A5070",fontSize:13}}>No ports installed yet.</div>}
        {govGroups.map(({gov,gPorts,totalMb})=>(
          <div key={gov.id} style={{background:"#060A14",borderRadius:8,padding:"12px 14px",marginBottom:8,border:"1px solid #17253D"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontWeight:600,fontSize:13,color:"#D4E3F5"}}>
                <span style={{marginRight:8}}>🏛</span>{gov.name}
              </div>
              <span style={{fontFamily:"'DM Mono'",fontSize:12,color:"#5BB5F5",fontWeight:600}}>{fmtMb(totalMb)} total</span>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {gPorts.map(p=>{
                const area=areas.find(a=>a.id===p.areaId);
                return (
                  <div key={p.id} style={{background:"#0C1222",border:"1px solid #17253D",borderRadius:6,padding:"4px 10px",fontSize:11}}>
                    <span style={{color:p.type==="10G"?"#FBBF24":"#34D399",fontWeight:700,marginRight:5}}>{p.type}</span>
                    <span style={{color:"#94ADC8"}}>{area?.name||"?"} #{p.portIndex}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Cycle history */}
      {history.length>0 && (
        <div>
          <SLabel>Monthly History</SLabel>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"#060A14"}}>
                  {["Month","Status","Total Mbps","Govs","Requests","Amount Due"].map(h=>(
                    <th key={h} style={{padding:"7px 12px",textAlign:"left",color:"#3A5070",fontSize:10,
                      fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",borderBottom:"1px solid #17253D"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(({cycle,reqs,totalMb,due})=>(
                  <tr key={cycle.id} style={{borderBottom:"1px solid #0F1A2A",
                    background:currentCycle?.id===cycle.id?"#112040":"transparent"}}>
                    <td style={{padding:"8px 12px",fontWeight:600,color:currentCycle?.id===cycle.id?"#5BB5F5":"#C9D5E8"}}>
                      {monthLabel(cycle.month)}
                      {currentCycle?.id===cycle.id&&<span style={{marginLeft:6,fontSize:9,background:"#1A6FA8",color:"#fff",padding:"1px 5px",borderRadius:3}}>NOW</span>}
                    </td>
                    <td style={{padding:"8px 12px"}}><Badge sc={CYCLE_STATUS[cycle.status]}>{cycle.status}</Badge></td>
                    <td style={{padding:"8px 12px",fontFamily:"'DM Mono'",color:"#94ADC8"}}>{fmtMb(totalMb)}</td>
                    <td style={{padding:"8px 12px",color:"#94ADC8"}}>{new Set(reqs.map(r=>r.govId)).size}</td>
                    <td style={{padding:"8px 12px",color:"#94ADC8"}}>{reqs.length}</td>
                    <td style={{padding:"8px 12px",fontFamily:"'DM Mono'",color:"#FBBF24",fontWeight:600}}>{fmt(due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Company Ports tab ─────────────────────────────────────────────────────────

function CoPorts({ co, ports, setPorts, areas, govs, flash, isViewer, portPrices }) {
  const [modal,setModal] = useState(null);
  const [ed,setEd]       = useState({});
  const coPorts = ports.filter(p=>p.companyId===co.id);

  const areaOpts = [{value:"",label:"-- Select Area --"}].concat(
    areas.map(a=>{ const g=govs.find(x=>x.id===a.govId); return {value:a.id,label:a.name+(g?" ("+g.name+")":"")}; })
  );

  const portIdxInArea = (aid,excl=null) => ports.filter(p=>p.companyId===co.id&&p.areaId===aid&&p.id!==excl).length+1;
  const feeFor = (aid,type,excl=null) => type==="10G" ? portPrices.port10G : portIdxInArea(aid,excl)===1 ? portPrices.first1G : portPrices.extra1G;

  const openAdd  = () => { setEd({companyId:companies[0]?.id||"",areaId:"",type:"1G",confirm:false}); setModal("add"); };
  const openEdit = p => { setEd({...p}); setModal("edit"); };
  const del      = id => { setPorts(p=>p.filter(pt=>pt.id!==id)); flash("Port removed"); };
  const save = () => {
    if (!ed.areaId||!ed.type) return flash("Fill all fields","err");
    const pi=portIdxInArea(Number(ed.areaId),ed.id);
    setPorts(p=>p.map(pt=>pt.id===ed.id?{...pt,areaId:Number(ed.areaId),type:ed.type,portIndex:pi}:pt));
    flash("Port updated"); setModal(null);
  };

  // Group by gov
  const govGroups = govs.map(g=>{
    const gAreas=areas.filter(a=>a.govId===g.id);
    const gPorts=coPorts.filter(p=>gAreas.some(a=>a.id===p.areaId));
    return {gov:g,gPorts};
  }).filter(x=>x.gPorts.length>0);

  const grandTotalPorts = coPorts.length;
  const total1G = coPorts.filter(p=>p.type==="1G").length;
  const total10G = coPorts.filter(p=>p.type==="10G").length;

  return (
    <div>
      {modal==="edit" && (
        <Modal title="Edit Port" onClose={()=>setModal(null)}>
          <FS label="Area *"      val={ed.areaId} set={v=>setEd(p=>({...p,areaId:v}))} opts={areaOpts}/>
          <FS label="Port Type *" val={ed.type}    set={v=>setEd(p=>({...p,type:v}))}   opts={["1G","10G"]}/>
          <div style={{background:"#060A14",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#5BB5F5"}}>
            Fee: {fmt(feeFor(Number(ed.areaId),ed.type,ed.id))}
          </div>
          <Row gap={10} mt={4}><Btn onClick={save}>Save</Btn><Btn ghost onClick={()=>setModal(null)}>Cancel</Btn></Row>
        </Modal>
      )}

      {/* Summary bar */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
        <Stat label="Total Ports" val={grandTotalPorts}/>
        <Stat label="1G Ports"    val={total1G}/>
        <Stat label="10G Ports"   val={total10G}/>
      </div>

      {govGroups.length===0 && <div style={{color:"#3A5070",fontSize:13}}>No ports installed.</div>}

      {govGroups.map(({gov,gPorts})=>(
        <div key={gov.id} style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#4A6580",textTransform:"uppercase",letterSpacing:".5px",
            marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
            <span>🏛</span>{gov.name}
            <span style={{color:"#17253D",fontWeight:400}}>({gPorts.length} port{gPorts.length!==1?"s":""})</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {gPorts.map(p=>{
              const area=areas.find(a=>a.id===p.areaId);
              const fee=feeFor(p.areaId,p.type,null);
              return (
                <div key={p.id} style={{background:"#060A14",border:"1px solid #17253D",borderRadius:7,
                  padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontFamily:"'DM Mono'",fontSize:12,fontWeight:700,
                      color:p.type==="10G"?"#FBBF24":"#34D399",
                      background:p.type==="10G"?"#2D2006":"#052E1C",
                      border:"1px solid "+(p.type==="10G"?"#78500A":"#065F46"),
                      padding:"2px 8px",borderRadius:4}}>{p.type}</span>
                    <div>
                      <div style={{fontWeight:600,fontSize:13}}>
                        🔌 {area?.name||"?"} — Port #{p.portIndex}
                      </div>
                      <div style={{fontSize:11,color:"#3A5070"}}>Installation fee: {fmt(fee)}</div>
                    </div>
                  </div>
                  {!isViewer && (
                    <div style={{display:"flex",gap:5}}>
                      <IBtn onClick={()=>openEdit(p)}>✏️</IBtn>
                      <IBtn onClick={()=>del(p.id)}>🗑️</IBtn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Company Requests tab ──────────────────────────────────────────────────────

function CoRequests({ api, co, requests, setRequests, govs, ports, areas, tiers, portPrices, cycles, flash, isViewer, isCycleOpen, currentCycle }) {
  const [confirmCo, confirmCoDialog] = useConfirm();
  const [editReq,setEditReq] = useState(null);
  const [filterCycle,setFC] = useState("all");
  const [filterStatus,setFS] = useState("all");

  // Port-only requests belong to the company directly — exclude from requests list
  const coReqs = requests.filter(r=>r.companyId===co.id && !(r.totalPackageMb===0 && r.newPorts?.length>0));

  const cycleOpts = [{value:"all",label:"All Cycles"}].concat(
    cycles.map(c=>({value:String(c.id),label:monthLabel(c.month)+" ("+c.status+")"}))
  );

  const displayed = coReqs.filter(r=>{
    if (filterCycle!=="all" && r.cycleId!==Number(filterCycle)) return false;
    if (filterStatus!=="all" && r.status!==filterStatus) return false;
    return true;
  }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));

  const setStatus = (id, st) => {
    const req = requests.find(r=>r.id===id);
    api.setRequestStatus(id, st)
      .then(updated=>{
        setRequests(prev=>prev.map(r=>r.id===id?{...updated,portPackages:updated.portPackages||[],newPorts:updated.newPorts||[]}:r));
        // Reprice all siblings server-side after any status change
        if (req && currentCycle) {
          api.repriceRequests(currentCycle.id, req.companyId).then(res=>{
            if (!res.updated) return;
            setRequests(prev=>prev.map(r=>{
              const u=res.updated.find(u=>u.id===r.id);
              return u ? {...r, speedCost:u.speedCost, total:u.total, tierCode:u.tierCode} : r;
            }));
          }).catch(()=>{});
        }
        flash("Request "+st);
      })
      .catch(e=>flash(e.message,"err"));
  };

  const delReq = async (id) => {
    const r=requests.find(x=>x.id===id);
    const co=companies.find(c=>c.id===r?.companyId);
    const ok=await confirmCo("Delete request #"+id+"?",`${co?.name||""} request will be permanently removed.`);
    if(!ok) return;
    api.deleteRequest(id)
      .then(()=>{ setRequests(p=>p.filter(r=>r.id!==id)); flash("Request deleted"); })
      .catch(e=>flash(e.message,"err"));
  };

  // Grand totals for this company across all shown requests
  const totalMb  = displayed.filter(r=>r.status!=="rejected").reduce((s,r)=>s+r.totalPackageMb,0);
  const totalDue = displayed.filter(r=>r.status==="approved").reduce((s,r)=>s+r.total,0);

  return (
    <div>
      {confirmCoDialog}
      {editReq && (
        <ReqEditModal req={editReq} govs={govs} ports={ports} areas={areas} tiers={tiers}
          onSave={updated=>{ api.updateRequest(updated.id,{totalPackageMb:updated.totalPackageMb,speedCost:updated.speedCost,portCost:updated.portCost,total:updated.total,tierCode:updated.tierCode,notes:updated.notes||"",portPackages:updated.portPackages||[],newPorts:updated.newPorts||[]}).then(saved=>{ setRequests(p=>p.map(r=>r.id===updated.id?{...saved,portPackages:saved.portPackages||[],newPorts:saved.newPorts||[]}:r)); setEditReq(null); flash("Request updated"); }).catch(e=>flash(e.message,"err")); }}
          onClose={()=>setEditReq(null)}/>
      )}

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <select value={filterCycle} onChange={e=>setFC(e.target.value)} style={{...IS,width:"auto",padding:"5px 10px",fontSize:12}}>
          {cycleOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFS(e.target.value)} style={{...IS,width:"auto",padding:"5px 10px",fontSize:12}}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <div style={{marginLeft:"auto",display:"flex",gap:16,fontSize:12}}>
          <span><span style={{color:"#3A5070"}}>Total Mbps: </span><b style={{fontFamily:"'DM Mono'",color:"#5BB5F5"}}>{fmtMb(totalMb)}</b></span>
          <span><span style={{color:"#3A5070"}}>Amount Due: </span><b style={{fontFamily:"'DM Mono'",color:"#FBBF24"}}>{fmt(totalDue)}</b></span>
        </div>
      </div>

      {displayed.length===0 && <div style={{color:"#3A5070",fontSize:13,padding:"20px 0"}}>No requests found.</div>}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {displayed.map(r=>{
          const gov=govs.find(g=>g.id===r.govId);
          const cycle=cycles.find(c=>c.id===r.cycleId);
          const sc=REQ_STATUS[r.status];
          const isEditable = !isViewer && cycle?.status==="open";
          return (
            <div key={r.id} style={{background:"#060A14",border:"1px solid #17253D",borderRadius:8,padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <GovBadge>{gov?.name||"?"}</GovBadge>
                  <span style={{fontFamily:"'DM Mono'",fontSize:11,color:"#3A5070"}}>#{r.id}</span>
                  <span style={{fontSize:11,color:"#3A5070"}}>{cycle?monthLabel(cycle.month):"?"}</span>
                  <Badge sc={sc}>{r.status}</Badge>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  {isEditable && <IBtn onClick={()=>setEditReq(r)}>✏️</IBtn>}
                  {r.status==="pending" && !isViewer && isCycleOpen && <>
                    <IBtn title="Approve package" onClick={()=>setStatus(r.id,"approved")}>✅</IBtn>
                    <IBtn title="Reject package" onClick={()=>setStatus(r.id,"rejected")}>❌</IBtn>
                  </>}

                  {!isViewer && <IBtn onClick={async ()=>{ const ok=await confirmCo("Delete request #"+r.id+"?","This request will be permanently removed."); if(ok){api.deleteRequest(r.id).then(()=>{ setRequests(p=>p.filter(x=>x.id!==r.id)); flash("Deleted"); }).catch(e=>flash(e.message,"err"));} }}>🗑️</IBtn>}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                <MiniStat label="Package"  val={fmtMb(r.totalPackageMb)}/>
                <MiniStat label="Tier"     val={r.tierCode}/>
                <MiniStat label="Speed $"  val={fmt(r.speedCost)}/>
                <MiniStat label="Total"    val={fmt(r.total)}/>
              </div>
              {r.portPackages?.length>0 && (
                <div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:4}}>
                  {r.portPackages.map((pp,i)=>{
                    const pt=ports.find(p=>p.id===pp.portId);
                    const area=areas.find(a=>a.id===pt?.areaId);
                    return (
                      <span key={i} style={{background:"#0C1222",border:"1px solid #17253D",borderRadius:4,
                        padding:"2px 8px",fontSize:10,color:"#7A95B0"}}>
                        🔷 {area?.name||"?"} {fmtMb(pp.mb)}
                      </span>
                    );
                  })}
                </div>
              )}
              {r.newPorts?.length>0 && (
                <div style={{marginTop:4,display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
                  <span style={{fontSize:10,color:"#3A5070"}}>New ports:</span>
                  {r.newPorts.map((np,i)=>{
                    const area=areas.find(a=>a.id===np.areaId);
                    const fee=np.type==="10G"?(portPrices?.port10G||1200):np.portIndex===1?(portPrices?.first1G||150):(portPrices?.extra1G||500);
                    return (
                      <span key={i} style={{
                        background:r.portStatus==="approved"?"#052E1C":r.portStatus==="rejected"?"#2D0909":"#2D2006",
                        border:`1px solid ${r.portStatus==="approved"?"#065F46":r.portStatus==="rejected"?"#7F1D1D":"#78500A"}`,
                        borderRadius:4,padding:"2px 8px",fontSize:10,
                        color:r.portStatus==="approved"?"#34D399":r.portStatus==="rejected"?"#F87171":"#FBBF24"}}>
                        🔌 {area?.name||"?"} ({np.type}) — {fmt(fee)} · {r.portStatus||"pending"}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Request Edit Modal ────────────────────────────────────────────────────────

function ReqEditModal({ req, govs, ports, areas, tiers, onSave, onClose }) {
  const [pkgMb,setPkgMb] = useState(String(req.totalPackageMb));
  const [notes,setNotes] = useState(req.notes||"");
  const [portAlloc,setPA] = useState(()=>{
    const init={};
    req.portPackages.forEach(pp=>{ init[pp.portId]=String(pp.mb); });
    return init;
  });

  const thisGovMb = Number(pkgMb)||0;
  // Flat-rate: cost = thisGovMb x tier rate (tier determined by thisGovMb alone in edit mode)
  const {tier} = useMemo(()=>calcPrice(thisGovMb,tiers),[thisGovMb,tiers]);
  const speedCost = thisGovMb * (tier?.ppm||0);
  const total = speedCost + req.portCost;

  const gov = govs.find(g=>g.id===req.govId);
  const coPorts = ports.filter(p=>p.companyId===req.companyId&&areas.find(a=>a.id===p.areaId)?.govId===req.govId);

  const save = () => {
    const pkgPorts = coPorts.filter(p=>portAlloc[p.id]&&Number(portAlloc[p.id])>0)
      .map(p=>({portId:p.id,mb:Number(portAlloc[p.id])}));
    onSave({...req, totalPackageMb:thisGovMb, speedCost, total, tierCode:tier?.code||req.tierCode,
      portPackages:pkgPorts, notes});
  };

  return (
    <Modal title={"Edit Request #"+req.id} onClose={onClose} wide>
      <div style={{background:"#060A14",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#3A5070"}}>
        Governorate: <b style={{color:"#C9D5E8"}}>{gov?.name}</b> · Date: {fmtDate(req.createdAt)}
      </div>
      <div style={{marginBottom:14}}>
        <label style={LBL}>Total Package (Mbps) *</label>
        <input type="number" value={pkgMb} onChange={e=>setPkgMb(e.target.value)} min={0} step={100}
          style={{...IS,fontFamily:"'DM Mono'"}}/>
        {thisGovMb>0 && <div style={{fontSize:11,color:"#3A5070",marginTop:3}}>= {fmtMb(thisGovMb)} · Tier <b style={{color:"#FBBF24"}}>{tier?.code}</b></div>}
      </div>
      {coPorts.length>0 && (
        <>
          <SLabel>Port Allocations</SLabel>
          {coPorts.map(p=>{
            const area=areas.find(a=>a.id===p.areaId);
            return (
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                <div style={{flex:1,fontSize:13}}>🔌 {area?.name||"?"} ({p.type}) #{p.portIndex}</div>
                <input type="number" placeholder="Mbps" min={0} step={100}
                  value={portAlloc[p.id]||""} onChange={e=>setPA(s=>({...s,[p.id]:e.target.value}))}
                  style={{...IS,width:150,fontFamily:"'DM Mono'"}}/>
              </div>
            );
          })}
        </>
      )}
      <FI label="Notes" val={notes} set={setNotes} placeholder="Optional notes..."/>
      <div style={{background:"#060A14",border:"1px solid #17253D",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
        <CostLine label="Speed cost" val={speedCost}/>
        {req.portCost>0 && <CostLine label="Port fees" val={req.portCost}/>}
        <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid #17253D",fontWeight:700,fontSize:18}}>
          <span>Total</span>
          <span style={{fontFamily:"'DM Mono'",color:"#5BB5F5"}}>{fmt(total)}</span>
        </div>
      </div>
      <Row gap={10} mt={4}><Btn onClick={save}>Save Changes</Btn><Btn ghost onClick={onClose}>Cancel</Btn></Row>
    </Modal>
  );
}

// Tiny mini-stat for company cards

export default function Companies({ api, companies, setCompanies, ports, setPorts, requests, setRequests, govs, areas, cycles, tiers, portPrices, flash, isViewer, currentCycle, isCycleOpen }) {
  const [confirm, confirmDialog] = useConfirm();
  const [modal,setModal]     = useState(null);
  const [ed,setEd]           = useState({});
  const [search,setSearch]   = useState("");
  const [sortK,setSortK]     = useState("name");
  const [sortD,setSortD]     = useState(1);
  const [selected,setSelected] = useState(null);   // company id for drill-down
  const [detailTab,setDTab]  = useState("overview"); // overview | ports | requests

  const close    = () => setModal(null);
  const openAdd  = () => { setEd({name:"",contact:"",phone:"",email:""}); setModal("add"); };
  const openEdit = c => { setEd({...c}); setModal("edit"); };
  const del = async (id) => {
    if (ports.some(p=>p.companyId===id)) return flash("Cannot delete — company has active ports","err");
    const co=companies.find(c=>c.id===id);
    const ok = await confirm("Delete this company?", `${co?.name||"This company"} will be permanently removed.`);
    if (!ok) return;
    api.deleteCompany(id)
      .then(()=>{ setCompanies(p=>p.filter(c=>c.id!==id)); if(selected===id)setSelected(null); flash("Company deleted"); })
      .catch(e=>flash(e.message,"err"));
  };
  const save = () => {
    if (!ed.name?.trim()) return flash("Name is required","err");
    const d={name:ed.name.trim(),contact:ed.contact||"",phone:ed.phone||"",email:ed.email||""};
    if (modal==="add") {
      api.addCompany(d)
        .then(c=>{ setCompanies(p=>[...p,c]); flash("Company added"); close(); })
        .catch(e=>flash(e.message,"err"));
    } else {
      api.updateCompany(ed.id,d)
        .then(()=>{ setCompanies(p=>p.map(c=>c.id===ed.id?{...c,...d}:c)); flash("Updated"); close(); })
        .catch(e=>flash(e.message,"err"));
    }
  };

  const sort  = k => { if(sortK===k) setSortD(d=>-d); else { setSortK(k); setSortD(1); } };
  const arrow = k => sortK===k ? (sortD===1?" ↑":" ↓") : "";

  const enriched = companies.map(co=>{
    const cp       = ports.filter(p=>p.companyId===co.id);
    const coAreaIds= [...new Set(cp.map(p=>p.areaId))];
    const coGovIds = [...new Set(coAreaIds.map(aid=>areas.find(x=>x.id===aid)?.govId).filter(Boolean))];
    const allReqs  = requests.filter(r=>r.companyId===co.id);
    const cycleReqs= currentCycle ? allReqs.filter(r=>r.cycleId===currentCycle.id) : [];
    // Current cycle stats only
    const cycleTotal   = cycleReqs.reduce((s,r)=>s+r.totalPackageMb,0);
    const cycleDue     = cycleReqs.filter(r=>r.status==="approved").reduce((s,r)=>s+r.total,0);
    const cycleReqCount= cycleReqs.length;
    // All-time for reference
    const revAllTime   = allReqs.filter(r=>r.status==="approved").reduce((s,r)=>s+r.total,0);
    return { ...co, ports:cp, coGovIds, allReqs, cycleReqs,
      portCount:cp.length, govCount:coGovIds.length,
      reqCount:cycleReqCount,   // ← current cycle only
      revenue:cycleDue,         // ← current cycle only
      cycleTotal, cycleDue, revAllTime };
  });

  const filtered = enriched
    .filter(c=>!search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.contact||"").toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{
      const av=a[sortK]; const bv=b[sortK];
      const as=typeof av==="number"?av:String(av||"").toLowerCase();
      const bs=typeof bv==="number"?bv:String(bv||"").toLowerCase();
      return as<bs?-sortD:as>bs?sortD:0;
    });

  const selCo = selected ? enriched.find(c=>c.id===selected) : null;

  return (
    <div style={{display:"flex",gap:18,alignItems:"flex-start"}}>

      {/* ── List panel ── */}
      <div style={{flex:selected?"0 0 340px":"1",minWidth:0,transition:"flex .2s"}}>
        <ToolBar right={
          <div style={{display:"flex",gap:6}}>
            <Btn onClick={()=>{exportCompanies(companies,ports,areas,govs,requests,cycles);flash("Companies exported");}} ghost>📥 Export</Btn>
            {!isViewer && <Btn onClick={openAdd}>+ Add Company</Btn>}
          </div>
        }>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <Muted>{filtered.length}/{companies.length} companies</Muted>
            <SearchBox val={search} set={setSearch} placeholder="Search..."/>
          </div>
        </ToolBar>

      {confirmDialog}
        {modal && (
        <Modal title={modal==="add"?"Add Company":"Edit Company"} onClose={close}>
            <FI label="Company Name *" val={ed.name}        set={v=>setEd(p=>({...p,name:v}))}/>
            <FI label="Contact Person" val={ed.contact||""} set={v=>setEd(p=>({...p,contact:v}))}/>
            <FI label="Phone"          val={ed.phone||""}   set={v=>setEd(p=>({...p,phone:v}))}/>
            <FI label="Email"          val={ed.email||""}   set={v=>setEd(p=>({...p,email:v}))}/>
            <div style={{background:"#060A14",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#3A5070"}}>
              Companies are independent and can open ports in any governorate.
            </div>
            <Row gap={10} mt={4}><Btn onClick={save}>Save</Btn><Btn ghost onClick={close}>Cancel</Btn></Row>
          </Modal>
        )}

        <div style={{display:"flex",gap:2,marginBottom:10,flexWrap:"wrap"}}>
          {[["name","Name"],["portCount","Ports"],["govCount","Govs"],["cycleTotal","This Month"],["revenue","Revenue"]].map(([k,l])=>(
            <button key={k} onClick={()=>sort(k)} style={{background:sortK===k?"#112040":"none",border:"1px solid #17253D",
              borderRadius:6,padding:"4px 10px",color:sortK===k?"#5BB5F5":"#3A5070",fontSize:11,cursor:"pointer"}}>
              {l}{arrow(k)}
            </button>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(c=>{
            const isSel = selected===c.id;
            return (
              <div key={c.id} onClick={()=>{ setSelected(isSel?null:c.id); setDTab("overview"); }}
                style={{background:isSel?"#112040":"#0C1222",border:"1px solid "+(isSel?"#1A6FA8":"#17253D"),
                  borderRadius:10,padding:"14px 16px",cursor:"pointer",transition:"all .15s"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,marginBottom:3,color:isSel?"#5BB5F5":"#C9D5E8"}}>{c.name}</div>
                    <div style={{fontSize:11,color:"#3A5070",marginBottom:8}}>
                      {c.govCount} gov{c.govCount!==1?"s":""} · {c.portCount} port{c.portCount!==1?"s":""}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                      <MiniStat label="Requests (cycle)" val={c.reqCount}/>
                      <MiniStat label="Revenue (cycle)"  val={fmt(c.revenue)}/>
                      <MiniStat label="Bandwidth"        val={c.cycleTotal>0?fmtMb(c.cycleTotal):"—"}/>
                    </div>
                  </div>
                  {!isViewer && (
                    <div style={{display:"flex",gap:4,marginLeft:10,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                      <IBtn onClick={()=>openEdit(c)}>✏️</IBtn>
                      <IBtn onClick={()=>del(c.id)}>🗑️</IBtn>
                    </div>
                  )}
                </div>
                {c.contact && <div style={{marginTop:8,fontSize:11,color:"#3A5070",borderTop:"1px solid #17253D",paddingTop:6}}>
                  👤 {c.contact}{c.phone ? " · "+c.phone : ""}
                </div>}
              </div>
            );
          })}
          {filtered.length===0 && <div style={{padding:32,textAlign:"center",color:"#1E3050",fontSize:13}}>No companies found</div>}
        </div>
      </div>

      {/* ── Detail panel ── */}
      {selCo && (
        <div style={{flex:1,minWidth:0,background:"#0C1222",border:"1px solid #1A6FA8",borderRadius:12,overflow:"hidden"}}>
          {/* Header */}
          <div style={{padding:"16px 20px",borderBottom:"1px solid #17253D",background:"linear-gradient(90deg,#112040,#0C1222)",
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700,fontSize:16,color:"#D4E3F5",marginBottom:3}}>{selCo.name}</div>
              <div style={{fontSize:12,color:"#3A5070"}}>
                {selCo.contact && selCo.contact+" · "}
                {selCo.phone && selCo.phone+" · "}
                {selCo.email && selCo.email}
              </div>
            </div>
            <button onClick={()=>setSelected(null)}
              style={{background:"none",border:"none",color:"#3A5070",cursor:"pointer",fontSize:22,lineHeight:1}}>×</button>
          </div>

          {/* KPI row */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"#17253D",borderBottom:"1px solid #17253D"}}>
            {[
              ["Ports",              selCo.portCount,               "#34D399"],
              ["Governorates",       selCo.govCount,                "#5BB5F5"],
              ["Requests (cycle)",   selCo.cycleReqs.length,        "#C084FC"],
              ["Revenue (cycle)",    fmt(selCo.cycleDue),           "#FBBF24"],
            ].map(([l,v,col])=>(
              <div key={l} style={{background:"#0C1222",padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontFamily:"'DM Mono'",fontSize:18,fontWeight:600,color:col,marginBottom:3}}>{v}</div>
                <div style={{fontSize:10,color:"#3A5070",textTransform:"uppercase",letterSpacing:".5px"}}>{l}</div>
              </div>
            ))}
          </div>

          {/* Current cycle strip */}
          {currentCycle && (
            <div style={{padding:"10px 20px",borderBottom:"1px solid #17253D",background:"#060A14",
              display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div style={{fontSize:12,color:"#3A5070"}}>
                Current Cycle: <b style={{color:"#C9D5E8"}}>{monthLabel(currentCycle.month)}</b>
              </div>
              <div style={{display:"flex",gap:16}}>
                <span style={{fontSize:12}}><span style={{color:"#3A5070"}}>Total Mbps: </span><b style={{fontFamily:"'DM Mono'",color:"#5BB5F5"}}>{fmtMb(selCo.cycleTotal)}</b></span>
                <span style={{fontSize:12}}><span style={{color:"#3A5070"}}>Due: </span><b style={{fontFamily:"'DM Mono'",color:"#FBBF24"}}>{fmt(selCo.cycleDue)}</b></span>
                <span style={{fontSize:12}}><span style={{color:"#3A5070"}}>Requests: </span><b style={{color:"#C9D5E8"}}>{selCo.cycleReqs.length}</b></span>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{display:"flex",gap:1,background:"#060A14",borderBottom:"1px solid #17253D"}}>
            {[["overview","Overview"],["ports","Ports"],["requests","Requests"]].map(([t,l])=>(
              <button key={t} onClick={()=>setDTab(t)} style={{
                padding:"10px 20px",border:"none",cursor:"pointer",fontSize:13,fontWeight:detailTab===t?600:400,
                background:detailTab===t?"#0C1222":"transparent",
                color:detailTab===t?"#5BB5F5":"#4A6580",
                borderBottom:detailTab===t?"2px solid #5BB5F5":"2px solid transparent",
              }}>{l}</button>
            ))}
          </div>

          <div style={{padding:20}}>
            {detailTab==="overview" && <CoOverview co={selCo} ports={ports} areas={areas} govs={govs} requests={requests} cycles={cycles} currentCycle={currentCycle}/>}
            {detailTab==="ports"    && <CoPorts    co={selCo} ports={ports} setPorts={setPorts} areas={areas} govs={govs} flash={flash} isViewer={isViewer} portPrices={portPrices}/>}
            {detailTab==="requests" && <CoRequests api={api} co={selCo} requests={requests} setRequests={setRequests} govs={govs} ports={ports} setPorts={setPorts} areas={areas} tiers={tiers} portPrices={portPrices} cycles={cycles} flash={flash} isViewer={isViewer} isCycleOpen={isCycleOpen} currentCycle={currentCycle}/>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Company Overview tab ──────────────────────────────────────────────────────
