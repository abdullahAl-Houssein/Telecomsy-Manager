import { useState, useMemo } from "react";
import { fmt, fmtMb, fmtDate, monthLabel, IS, LBL, REQ_STATUS, CYCLE_STATUS } from "../../constants";
import { Btn, IBtn, Badge, GovBadge, Stat, Row, Muted, Card, SLabel, CostLine, ToolBar, Modal, DataTable, SearchBox, FI, FS, MiniStat } from "../ui";
import useConfirm from "../../hooks/useConfirm";
import { apiFetch } from "../../api/client";
import { exportPortsByArea } from "../../utils/exports";

export default function Ports({ api, ports, setPorts, companies, areas, govs, portPrices, flash, isViewer, currentUser, currentCycle, setRequests, cycles, tiers }) {
  const [confirm, confirmDialog] = useConfirm();
  const [modal,setModal]   = useState(null);
  const [ed,setEd]         = useState({});
  const [filterGov,setFG]  = useState("all");
  const [filterCo,setFC]   = useState("all");
  const [search,setSrch]   = useState("");
  const [sortK,setSK]      = useState("company");
  const [sortD,setSD]      = useState(1);
  const close = () => setModal(null);

  // Managers only see ports in their assigned governorate
  const visGovId = currentUser.role==="manager" ? currentUser.govId : null;
  const scopedPorts = visGovId
    ? ports.filter(p=>{ const a=areas.find(x=>x.id===p.areaId); return a?.govId===visGovId; })
    : ports;

  const portIdxInArea = (cid,aid,excl=null) => ports.filter(p=>p.companyId===cid&&p.areaId===aid&&p.id!==excl).length+1;
  const portFee = (cid,aid,type,excl=null) => {
    if (type==="10G") return 1200;
    return portIdxInArea(cid,aid,excl)===1 ? 150 : 500;
  };

  // Area options for selected company (ALL areas — company is independent)
  const selCo = companies.find(c=>c.id===Number(ed.companyId));
  const areaOpts = [{value:"",label:"-- Select Area --"}].concat(
    areas.map(a=>{ const g=govs.find(x=>x.id===a.govId); return {value:a.id, label:a.name+(g?" ("+g.name+")":"")}; })
  );
  const companyOpts = companies.map(c=>({value:c.id,label:c.name}));

  const openAdd  = () => { setEd({companyId:companies[0]?.id||"",areaId:"",type:"1G"}); setFreePort(false); setModal("add"); };
  const openEdit = p => { setEd({...p}); setModal("edit"); };
  const del = async (id) => {
    const p=ports.find(x=>x.id===id);
    const co=companies.find(c=>c.id===p?.companyId);
    const area=areas.find(a=>a.id===p?.areaId);
    const ok=await confirm("Remove this port?",`${co?.name||""} — ${area?.name||""} (${p?.type||""}) will be removed.`);
    if(!ok) return;
    api.deletePort(id)
      .then(()=>{ setPorts(p=>p.filter(pt=>pt.id!==id)); flash("Port removed"); })
      .catch(e=>flash(e.message,"err"));
  };
  // Port opening is now direct — no request/approval flow needed

  // Calculate port fee using live portPrices
  const calcPortOpenFee = (cid, aid, type) => {
    if (type==="10G") return portPrices?.port10G || 1200;
    const existing = ports.filter(p=>p.companyId===cid && p.areaId===aid).length;
    return existing===0 ? (portPrices?.first1G || 150) : (portPrices?.extra1G || 500);
  };

  const [saving,setSaving] = useState(false);
  const [freePort,setFreePort] = useState(false);
  const save = () => {
    if (!ed.companyId||!ed.areaId||!ed.type) return flash("Fill all fields","err");
    const cid=Number(ed.companyId); const aid=Number(ed.areaId);
    setSaving(true);
    if (modal==="add") {
      const fee = freePort ? 0 : calcPortOpenFee(cid, aid, ed.type);
      const area = areas.find(a=>a.id===aid);
      const govId = area?.govId;
      const today = new Date().toISOString().slice(0,10);
      // Step 1: create the port
      api.addPort({companyId:cid,areaId:aid,type:ed.type})
        .then(newPort=>{
          setPorts(p=>[...p,newPort]);
          // Step 2: if there's an active cycle AND fee > 0, record the fee as an approved request
          if (currentCycle && fee > 0 && govId) {
            return api.addRequest({
              cycleId: currentCycle.id,
              companyId: cid,
              govId: govId,
              month: currentCycle.month,
              totalPackageMb: 0,
              speedCost: 0,
              portCost: fee,
              total: fee,
              tierCode: "H",
              notes: `Port opening fee — ${ed.type} port in ${area?.name||"area"} (auto-approved)`,
              portPackages: [],
              newPorts: [{areaId:aid, type:ed.type, portIndex:newPort.portIndex}],
            }).then(req=>{
              return api.setRequestStatus(req.id,"approved")
                .then(()=>apiFetch(`/api/requests/${req.id}/port-status`,{method:"PUT",body:JSON.stringify({portStatus:"approved",skipPortCreation:true})}))
                .then(()=>{
                  const approvedReq = {...req, status:"approved", portStatus:"approved", portCost:fee, total:fee};
                  setRequests(p=>[...p,{...approvedReq,portPackages:[],newPorts:req.newPorts||[]}]);
                });
            });
          }
        })
        .then(()=>{ flash(freePort ? `Port opened — no charge (free)` : `Port opened — fee $${fee.toLocaleString()} added to balance`); close(); })
        .catch(e=>flash(e.message,"err")).finally(()=>setSaving(false));
    } else {
      const pi=portIdxInArea(cid,aid,ed.id);
      api.updatePort(ed.id,{companyId:cid,areaId:aid,type:ed.type,portIndex:pi})
        .then(()=>{ setPorts(p=>p.map(pt=>pt.id===ed.id?{...pt,companyId:cid,areaId:aid,type:ed.type,portIndex:pi}:pt)); flash("Port updated"); close(); })
        .catch(e=>flash(e.message,"err")).finally(()=>setSaving(false));
    }
  };

  const feePreview = useMemo(()=>{
    if (!ed.companyId||!ed.areaId||!ed.type) return null;
    if (modal==="add") {
      const pi=portIdxInArea(Number(ed.companyId),Number(ed.areaId),null);
      if (ed.type==="10G") return portPrices?.port10G||1200;
      return pi===1?(portPrices?.first1G||150):(portPrices?.extra1G||500);
    }
    return portFee(Number(ed.companyId),Number(ed.areaId),ed.type,ed.id);
  },[ed,modal,ports,portPrices]);

  const sort = k => { if(sortK===k) setSD(d=>-d); else {setSK(k);setSD(1);} };
  const arr  = k => sortK===k?(sortD===1?" ↑":" ↓"):"";

  const displayed = scopedPorts.filter(p=>{
    const a=areas.find(x=>x.id===p.areaId);
    const co=companies.find(c=>c.id===p.companyId);
    if (filterGov!=="all" && a?.govId!==Number(filterGov)) return false;
    if (filterCo!=="all"  && p.companyId!==Number(filterCo)) return false;
    if (search && !a?.name.toLowerCase().includes(search.toLowerCase()) && !co?.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).map(p=>{
    const a=areas.find(x=>x.id===p.areaId);
    const g=govs.find(x=>x.id===a?.govId);
    const co=companies.find(c=>c.id===p.companyId);
    return {...p, areaName:a?.name||"?", govName:g?.name||"?", coName:co?.name||"?"};
  }).sort((a,b)=>{
    const av = a[sortK+"Name"]||a[sortK]; const bv = b[sortK+"Name"]||b[sortK];
    const as = typeof av==="number" ? av : String(av||"").toLowerCase();
    const bs = typeof bv==="number" ? bv : String(bv||"").toLowerCase();
    return as<bs?-sortD:as>bs?sortD:0;
  });

  const [exportArea,setExportArea] = useState("");

  return (
    <div>
      <ToolBar right={!isViewer ? <Btn onClick={openAdd}>+ Add Port</Btn> : null}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <Muted>{displayed.length}/{scopedPorts.length} ports{visGovId?" in your branch":""}</Muted>
          <SearchBox val={search} set={setSrch} placeholder="Search area/company..."/>
          {!visGovId && (
            <select value={filterGov} onChange={e=>setFG(e.target.value)} style={{...IS,width:"auto",padding:"5px 10px",fontSize:12}}>
              <option value="all">All Govs</option>
              {govs.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <select value={filterCo} onChange={e=>setFC(e.target.value)} style={{...IS,width:"auto",padding:"5px 10px",fontSize:12}}>
            <option value="all">All Companies</option>
            {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </ToolBar>


      {/* ── Export Panel ── */}
      <div style={{background:"#0C1222",border:"1px solid #17253D",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:12,color:"#3A5070",fontWeight:600,textTransform:"uppercase",letterSpacing:".5px"}}>📥 Export</span>
        <div style={{display:"flex",gap:8,alignItems:"center",flex:1,flexWrap:"wrap"}}>
          <select value={exportArea} onChange={e=>setExportArea(e.target.value)} style={{...IS,width:"auto",padding:"5px 10px",fontSize:12}}>
            <option value="">-- Select Area --</option>
            {areas.filter(a=>!visGovId||a.govId===visGovId).map(a=>{
              const g=govs.find(x=>x.id===a.govId);
              const cnt=ports.filter(p=>p.areaId===a.id).length;
              return <option key={a.id} value={a.id}>{a.name} ({g?.name||""}) — {cnt} ports</option>;
            })}
          </select>
          <Btn onClick={()=>{
            if (!exportArea) return flash("Select an area first","err");
            exportPortsByArea(Number(exportArea),ports,areas,companies,govs);
            flash("Exported ports for "+areas.find(a=>a.id===Number(exportArea))?.name);
          }}>📊 Export Ports by Area</Btn>
        </div>
      </div>



      {confirmDialog}
      {modal && (
        <Modal title={modal==="add"?"Open New Port":"Edit Port"} onClose={close}>
          <FS label="Company *"   val={ed.companyId} set={v=>setEd(p=>({...p,companyId:v,areaId:""}))} opts={companyOpts}/>
          <FS label="Area *"      val={ed.areaId}    set={v=>setEd(p=>({...p,areaId:v}))}    opts={areaOpts}/>
          <FS label="Port Type *" val={ed.type}       set={v=>setEd(p=>({...p,type:v}))}      opts={["1G","10G"]}/>
          {ed.companyId&&ed.areaId&&ed.type&&modal==="add" && (
            <div style={{background:"#060A14",border:"1px solid #1A6FA840",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:12,color:"#5BB5F5",fontWeight:600}}>Port #{portIdxInArea(Number(ed.companyId),Number(ed.areaId),null)}</span>
                <span style={{fontFamily:"'DM Mono'",fontSize:14,fontWeight:700,
                  color:freePort?"#34D399":"#FBBF24",textDecoration:freePort?"line-through":"none"}}>
                  ${calcPortOpenFee(Number(ed.companyId),Number(ed.areaId),ed.type).toLocaleString()}
                  {freePort && <span style={{marginLeft:8,textDecoration:"none",color:"#34D399"}}>FREE</span>}
                </span>
              </div>
              {/* Free port toggle */}
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:8,userSelect:"none"}}>
                <div onClick={()=>setFreePort(f=>!f)} style={{width:36,height:20,borderRadius:10,background:freePort?"#065F46":"#1A2A3A",
                  border:`1px solid ${freePort?"#34D399":"#2A3A4A"}`,position:"relative",transition:"all .2s",flexShrink:0}}>
                  <div style={{position:"absolute",top:2,left:freePort?16:2,width:14,height:14,borderRadius:7,
                    background:freePort?"#34D399":"#3A5070",transition:"left .2s"}}/>
                </div>
                <span style={{fontSize:12,color:freePort?"#34D399":"#4A6580",fontWeight:600}}>
                  {freePort ? "✓ Free — no charge will be recorded" : "Charge standard fee"}
                </span>
              </label>
              {currentCycle && !freePort
                ? <div style={{fontSize:11,color:"#34D399"}}>✓ Fee will be added to {companies.find(c=>c.id===Number(ed.companyId))?.name}'s balance in cycle {monthLabel(currentCycle.month)}</div>
                : freePort ? <div style={{fontSize:11,color:"#34D399"}}>✓ Port will be opened at no charge — no financial record created</div>
                : <div style={{fontSize:11,color:"#FBBF24"}}>⚠ No active cycle — fee will not be recorded</div>
              }
            </div>
          )}
          <Row gap={10} mt={4}>
            <Btn onClick={save}>Open Port</Btn>
            <Btn ghost onClick={close}>Cancel</Btn>
          </Row>
        </Modal>
      )}

      {/* Sort buttons */}
      <div style={{display:"flex",gap:2,marginBottom:10,flexWrap:"wrap"}}>
        {[["co","Company"],["area","Area"],["gov","Gov"],["type","Type"],["portIndex","Port #"]].map(([k,l])=>(
          <button key={k} onClick={()=>sort(k)} style={{background:sortK===k?"#112040":"none",border:"1px solid #17253D",
            borderRadius:6,padding:"4px 10px",color:sortK===k?"#5BB5F5":"#3A5070",fontSize:11,cursor:"pointer"}}>
            {l}{arr(k)}
          </button>
        ))}
      </div>

      <DataTable
        cols={["Company","Gov","Area","Type","Port #","Fee",""]}
        rows={displayed.map(p=>{
          const f=p.type==="10G"?1200:p.portIndex===1?150:500;
          return [
            p.coName,
            <GovBadge key="g">{p.govName}</GovBadge>,
            <span key="a" style={{fontWeight:500}}>🔷 {p.areaName}</span>,
            <span key="t" style={{fontFamily:"'DM Mono'",color:p.type==="10G"?"#FBBF24":"#34D399",fontWeight:600}}>{p.type}</span>,
            "#"+p.portIndex,
            <span key="f" style={{fontFamily:"'DM Mono'",color:"#5BB5F5"}}>{fmt(f)}</span>,
            !isViewer ? <Row key="x" gap={6}><IBtn onClick={()=>openEdit(p)}>✏️</IBtn><IBtn onClick={()=>del(p.id)}>🗑️</IBtn></Row> : null,
          ];
        })}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  REQUESTS
// ─────────────────────────────────────────────────────────────────────────────
