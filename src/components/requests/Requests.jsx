import { useState, useEffect, useMemo } from "react";
import { fmt, fmtMb, fmtDate, monthLabel, IS, LBL, REQ_STATUS, CYCLE_STATUS, calcPrice } from "../../constants";
import { Btn, IBtn, Badge, GovBadge, Stat, Row, Muted, Card, SLabel, CostLine, ToolBar, Modal, DataTable, SearchBox, FI, FS, MiniStat } from "../ui";
import useConfirm from "../../hooks/useConfirm";
import { apiFetch } from "../../api/client";
import { exportRequestsByMonth, exportPortOpeningRequests } from "../../utils/exports";

function DetailModal({ api, r, companies, ports, areas, govs, onClose, onStatus, onPortStatus, setRequests, flash, isViewer, portPrices }) {
  const [confirm, confirmDialog] = useConfirm();
  const co=companies.find(c=>c.id===r.companyId);
  const gov=govs.find(g=>g.id===r.govId);
  const hasNewPorts = r.newPorts?.length > 0;
  const portStatusNow = r.portStatus || (hasNewPorts ? "pending" : null);
  const pst = s => ({ background:s==="approved"?"#052E1C":s==="rejected"?"#2D0909":"#2D2006",
    color:s==="approved"?"#34D399":s==="rejected"?"#F87171":"#FBBF24",
    border:`1px solid ${s==="approved"?"#065F46":s==="rejected"?"#7F1D1D":"#78500A"}` });
  const calcPortFee = np => np.type==="10G" ? (portPrices?.port10G||1200) : np.portIndex===1 ? (portPrices?.first1G||150) : (portPrices?.extra1G||500);
  const totalPortFee = (r.newPorts||[]).reduce((s,np)=>s+calcPortFee(np),0);

  return (
    <Modal title={"Request #"+r.id+" — "+(co?.name||"")} onClose={onClose} wide>
      {/* Info grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
        {[["Company",co?.name],["Governorate",gov?.name],["Date",fmtDate(r.createdAt)],
          ["Month",monthLabel(r.month)],["Tier",r.tierCode],
          ["Status",<span key="s" style={{...pst(r.status),padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:700}}>{r.status}</span>]
        ].map(([l,v])=>(
          <div key={l} style={{background:"#060A14",borderRadius:8,padding:"10px 12px",border:"1px solid #0F1A2A"}}>
            <div style={{fontSize:10,color:"#3A5070",marginBottom:3,textTransform:"uppercase",letterSpacing:".5px"}}>{l}</div>
            <div style={{fontWeight:600,fontSize:13}}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── SECTION 1: Package / Speed Request — hidden for port-only requests ── */}
      {r.totalPackageMb > 0 && <div style={{background:"#0A1422",border:"1px solid #17253D",borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:13,color:"#C9D5E8"}}>📦 Package Request</div>
          <span style={{...pst(r.status),padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{r.status}</span>
        </div>
        <div style={{fontSize:12,color:"#3A5070",marginBottom:8}}>
          Total bandwidth (this gov): <b style={{color:"#C9D5E8"}}>{fmtMb(r.totalPackageMb)}</b>
        </div>
        {r.portPackages.length>0 && (
          <div style={{marginBottom:10}}>
            {r.portPackages.map((pp,i)=>{
              const pt=ports.find(p=>p.id===pp.portId);
              const area=areas.find(a=>a.id===pt?.areaId);
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #0F1A2A",fontSize:12}}>
                  <span style={{color:"#7A9AB8"}}>🔷 {area?.name||"?"} ({pt?.type||"?"}) Port #{pt?.portIndex}</span>
                  <span style={{fontFamily:"'DM Mono'",color:"#C9D5E8"}}>{fmtMb(pp.mb)}</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderTop:"1px solid #17253D"}}>
          <span style={{color:"#3A5070",fontSize:13}}>Speed cost</span>
          <span style={{fontFamily:"'DM Mono'",color:"#5BB5F5",fontWeight:700}}>{fmt(r.speedCost)}</span>
        </div>
        {r.status==="pending" && !isViewer && r.totalPackageMb > 0 && (
          <Row gap={8} mt={10}>
            <Btn onClick={()=>{onStatus(r.id,"approved");onClose();}}>✅ Approve Package</Btn>
            <Btn ghost onClick={()=>{onStatus(r.id,"rejected");onClose();}}>❌ Reject Package</Btn>
          </Row>
        )}
      </div>}

      {/* ── SECTION 2: Port Opening Request (if any) ── */}
      {hasNewPorts && (
        <div style={{background:"#0A1422",border:`1px solid ${portStatusNow==="approved"?"#065F46":portStatusNow==="rejected"?"#7F1D1D":"#3A5020"}`,borderRadius:10,padding:16,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:13,color:"#C9D5E8"}}>🔌 Port Opening Request</div>
            <span style={{...pst(portStatusNow||"pending"),padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>
              {portStatusNow||"pending"}
            </span>
          </div>
          {r.newPorts.map((np,i)=>{
            const area=areas.find(a=>a.id===np.areaId);
            const fee=calcPortFee(np);
            return (
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #0F1A2A",fontSize:12}}>
                <div>
                  <span style={{color:"#7A9AB8"}}>🔷 {area?.name||"?"}</span>
                  <span style={{marginLeft:8,background:"#112040",padding:"1px 7px",borderRadius:4,fontSize:11,color:"#5BB5F5"}}>{np.type}</span>
                  <span style={{marginLeft:6,color:"#3A5070"}}>Port #{np.portIndex}</span>
                </div>
                <span style={{fontFamily:"'DM Mono'",color:"#FBBF24",fontWeight:700}}>{fmt(fee)}</span>
              </div>
            );
          })}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderTop:"1px solid #17253D",marginTop:4}}>
            <span style={{color:"#3A5070",fontSize:13}}>Total port fees</span>
            <span style={{fontFamily:"'DM Mono'",color:"#FBBF24",fontWeight:700}}>{fmt(totalPortFee)}</span>
          </div>
          {portStatusNow==="approved" && (
            <div style={{fontSize:12,color:"#34D399",marginTop:8,padding:"6px 10px",background:"#052E1C",borderRadius:6}}>
              ✓ Ports approved & activated — fees added to company account
            </div>
          )}
          {portStatusNow==="rejected" && (
            <div style={{fontSize:12,color:"#F87171",marginTop:8,padding:"6px 10px",background:"#2D0909",borderRadius:6}}>
              ✕ Port request rejected — no fees charged
            </div>
          )}
          {portStatusNow==="pending" && !isViewer && (
            <Row gap={8} mt={10}>
              <Btn onClick={()=>{onPortStatus(r.id,"approved");onClose();}}>✅ Approve Ports</Btn>
              <Btn ghost onClick={()=>{onPortStatus(r.id,"rejected");onClose();}}>❌ Reject Ports</Btn>
            </Row>
          )}
        </div>
      )}

      {/* ── Cost Summary ── */}
      <div style={{background:"#060A14",border:"1px solid #17253D",borderRadius:10,padding:16}}>
        <CostLine label="Speed cost" val={r.speedCost}/>
        {r.portCost>0 && <CostLine label="Port fees (approved)" val={r.portCost}/>}
        {hasNewPorts && portStatusNow==="pending" && totalPortFee>0 && (
          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:12,color:"#FBBF24",opacity:.7}}>
            <span>Port fees (pending approval)</span>
            <span style={{fontFamily:"'DM Mono'"}}>{fmt(totalPortFee)}</span>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid #17253D",fontWeight:700,fontSize:20}}>
          <span>Total</span>
          <span style={{fontFamily:"'DM Mono'",color:"#5BB5F5"}}>{fmt(r.total)}</span>
        </div>
      </div>

      {/* Delete */}
      {!isViewer && (
        <Row gap={10} mt={14}>
          <Btn ghost onClick={async ()=>{
            const ok=await confirm("Delete request #"+r.id+"?","This request will be permanently removed.");
            if(!ok) return;
            api.deleteRequest(r.id).then(()=>{setRequests(p=>p.filter(x=>x.id!==r.id));flash("Request deleted");onClose();}).catch(e=>flash(e.message,"err"));
          }}>🗑️ Delete Request</Btn>
        </Row>
      )}
      {confirmDialog}
    </Modal>
  );
}


function NewReqModal({ api, companies, ports, setPorts, areas, govs, tiers, portPrices, requests, setRequests, flash, currentUser, currentCycle, onClose }) {
  const [cid,      setCid]    = useState(companies[0]?.id||"");
  const [govId,    setGovId]  = useState(currentUser.role==="manager" ? String(currentUser.govId) : "");
  const [pkgMb,    setPkgMb]  = useState("");
  const [portAlloc,setPA]     = useState({});
  // New ports to request — [{areaId, type}]
  const [newPortReqs, setNPR] = useState([]);
  const [submitting, setSub]  = useState(false);

  const co     = companies.find(c=>c.id===Number(cid));
  const selGov = govs.find(g=>g.id===Number(govId));

  const govOpts = currentUser.role==="manager"
    ? govs.filter(g=>g.id===currentUser.govId)
    : govs;

  // Existing ports of this company in selected gov
  const coPorts = ports.filter(p=>{
    if (p.companyId!==Number(cid)) return false;
    if (!govId) return false;
    const a=areas.find(x=>x.id===p.areaId);
    return a?.govId===Number(govId);
  });

  // Areas in selected gov
  const govAreas = areas.filter(a=>a.govId===Number(govId));

  // Dup check
  const dupReq = currentCycle && govId && cid
    ? requests.find(r=>r.cycleId===currentCycle.id && r.companyId===Number(cid) && r.govId===Number(govId) && r.status!=="rejected" && r.totalPackageMb>0)
    : null;

  // Other govs in same cycle (exclude port-only requests)
  const otherGovReqs = currentCycle && cid
    ? requests.filter(r=>r.cycleId===currentCycle.id && r.companyId===Number(cid) && r.govId!==Number(govId) && r.status!=="rejected" && r.totalPackageMb>0)
    : [];
  const otherGovMb = otherGovReqs.reduce((s,r)=>s+r.totalPackageMb,0);

  const thisGovMb  = Number(pkgMb)||0;
  const grandTotal = otherGovMb + thisGovMb;

  // Tier determined by GRAND TOTAL — cost billed = thisGovMb × tier rate
  const {tier} = useMemo(()=>calcPrice(grandTotal,tiers),[grandTotal,tiers]);
  const speedCost = thisGovMb * (tier?.ppm||0);

  // Port fees for newly requested ports
  const calcNewPortFee = (areaId, type, idx) => {
    if (type==="10G") return portPrices?.port10G||1200;
    // Count existing ports in same area + already-queued new port reqs before this index
    const existingInArea = ports.filter(p=>p.companyId===Number(cid)&&p.areaId===Number(areaId)).length;
    const queuedBefore   = newPortReqs.slice(0,idx).filter(np=>np.areaId===areaId).length;
    return (existingInArea+queuedBefore)===0 ? (portPrices?.first1G||150) : (portPrices?.extra1G||500);
  };
  const totalPortFee = newPortReqs.reduce((s,np,i)=>s+(np.free?0:calcNewPortFee(np.areaId,np.type,i)),0);
  const total = speedCost + totalPortFee;

  const addNewPortReq  = () => {
    if (!govId) return flash("Select a governorate first","err");
    setNPR(p=>[...p,{areaId:govAreas[0]?.id||"",type:"1G",free:false}]);
  };
  const removeNewPortReq = i => setNPR(p=>p.filter((_,idx)=>idx!==i));
  const updateNewPortReq = (i,key,val) => setNPR(p=>p.map((np,idx)=>idx===i?{...np,[key]:val}:np));

  // After submit: reprice siblings on server then update local state
  const doReprice = (cId, gId) => {
    return api.repriceRequests(currentCycle.id, Number(cId))
      .then(res=>{
        if (!res.updated) return;
        setRequests(prev=>prev.map(r=>{
          const u=res.updated.find(u=>u.id===r.id);
          return u ? {...r, speedCost:u.speedCost, total:u.total, tierCode:u.tierCode} : r;
        }));
      }).catch(()=>{}); // reprice failure is non-fatal
  };

  const submit = () => {
    if (!cid)                  return flash("Select a company","err");
    if (!govId)                return flash("Select a governorate","err");
    if (!currentCycle)         return flash("No active cycle","err");
    if (dupReq)                return flash(co?.name+" already has a "+dupReq.status+" request in "+selGov?.name+" this cycle!","err");
    if (!pkgMb||thisGovMb<=0) return flash("Enter total package Mbps","err");
    if (newPortReqs.some(np=>!np.areaId)) return flash("Select an area for each new port","err");

    setSub(true);
    const pkgPorts = coPorts.filter(p=>portAlloc[p.id]&&Number(portAlloc[p.id])>0)
      .map(p=>({portId:p.id,mb:Number(portAlloc[p.id])}));

    // Step 1: Create the main package request
    // Server atomically reprices all siblings on insert
    api.addRequest({
      cycleId:currentCycle.id, companyId:Number(cid), govId:Number(govId),
      month:currentCycle.month, totalPackageMb:thisGovMb, speedCost,
      portCost:0, total:speedCost, tierCode:tier?.code||"H", notes:"",
      portPackages:pkgPorts, newPorts:[],
    }).then(saved=>{
      // Step 2: Fetch fresh repriced state for all siblings from server
      return api.repriceRequests(currentCycle.id, Number(cid))
        .then(res=>{
          setRequests(prev=>{
            // Apply updated prices to existing requests
            const withUpdated = prev.map(r=>{
              const u=res.updated?.find(u=>u.id===r.id);
              return u ? {...r, speedCost:u.speedCost, total:u.total, tierCode:u.tierCode} : r;
            });
            // Add the new request (already repriced by server)
            const freshSaved = res.updated?.find(u=>u.id===saved.id)
              ? {...saved, speedCost:res.updated.find(u=>u.id===saved.id).speedCost,
                  total:res.updated.find(u=>u.id===saved.id).total,
                  tierCode:res.updated.find(u=>u.id===saved.id).tierCode}
              : saved;
            return [...withUpdated, {...freshSaved,portPackages:saved.portPackages||[],newPorts:saved.newPorts||[]}];
          });
        })
        .catch(()=>{
          // If reprice call fails, still add the new request
          setRequests(prev=>[...prev, {...saved,portPackages:saved.portPackages||[],newPorts:saved.newPorts||[]}]);
        });
    })
    .then(()=>{
      // Step 3: Create port-opening sub-requests (pending approval)
      const portJobs = newPortReqs.map((np,i)=>{
        const area=areas.find(a=>a.id===Number(np.areaId));
        const fee=np.free?0:calcNewPortFee(np.areaId,np.type,i);
        return api.addRequest({
          cycleId:currentCycle.id, companyId:Number(cid), govId:Number(govId),
          month:currentCycle.month, totalPackageMb:0, speedCost:0,
          portCost:fee, total:fee, tierCode:"H",
          notes:`Port opening request — ${np.type} in ${area?.name||"area"} (${np.free?"free — no charge":"pending approval"})`,
          portPackages:[], newPorts:[{areaId:Number(np.areaId), type:np.type}],
        }).then(portReq=>{
          setRequests(prev=>[...prev,{...portReq,portPackages:[],newPorts:portReq.newPorts||[]}]);
        });
      });
      return Promise.all(portJobs);
    })
    .then(()=>{
      flash("Request submitted"+(newPortReqs.length>0?` + ${newPortReqs.length} port opening request(s) pending approval`:"")+"  — all branches repriced at Tier "+tier?.code);
      onClose();
    })
    .catch(e=>flash(e.message,"err"))
    .finally(()=>setSub(false));
  };

  return (
    <Modal title="New Package Request" onClose={onClose} wide>
      {/* Cycle info */}
      {currentCycle && (
        <div style={{background:"#052E1C",border:"1px solid #065F46",borderRadius:7,padding:"8px 14px",marginBottom:14,fontSize:12,color:"#34D399"}}>
          Cycle: <b>{monthLabel(currentCycle.month)}</b> (open)
        </div>
      )}

      {/* Company + Gov */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div>
          <label style={LBL}>Company *</label>
          <select value={cid} onChange={e=>{setCid(e.target.value);setPA({});setNPR([]);}} style={IS}>
            {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={LBL}>Governorate *</label>
          <select value={govId} onChange={e=>{setGovId(e.target.value);setNPR([]);}} style={IS}>
            <option value="">-- Select Governorate --</option>
            {govOpts.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      {/* Duplicate warning */}
      {dupReq && (
        <div style={{background:"#2D0909",border:"1px solid #7F1D1D",borderRadius:8,padding:"10px 14px",marginBottom:14,color:"#F87171",fontSize:13}}>
          🚫 <b>{co?.name}</b> already has a <b>{dupReq.status}</b> request in <b>{selGov?.name}</b> for this cycle.
        </div>
      )}

      {/* Cross-gov pricing info */}
      {!dupReq && otherGovReqs.length>0 && govId && (
        <div style={{background:"#0A1F35",border:"1px solid #1A4A6B",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,lineHeight:1.7}}>
          <b style={{color:"#5BB5F5"}}>ℹ️ {co?.name}</b> already installed in other govs this cycle:
          <div style={{marginTop:5,display:"flex",flexWrap:"wrap",gap:6}}>
            {otherGovReqs.map(r=>{
              const g=govs.find(x=>x.id===r.govId);
              return <span key={r.id} style={{background:"#112040",padding:"2px 8px",borderRadius:4}}>
                <b style={{color:"#5BB5F5"}}>{g?.name}</b>
                <span style={{color:"#3A5070"}}> {fmtMb(r.totalPackageMb)}</span>
              </span>;
            })}
          </div>
          <div style={{color:"#3A5070",marginTop:4}}>
            Grand total: <b style={{color:"#5BB5F5"}}>{fmtMb(otherGovMb)} + this request</b> — combined for tier pricing.
          </div>
        </div>
      )}

      {/* Package Mbps */}
      <div style={{marginBottom:14}}>
        <label style={LBL}>Total Package for <b style={{color:"#5BB5F5"}}>{selGov?.name||"selected gov"}</b> (Mbps) *</label>
        <input type="number" placeholder="e.g. 5000 = 5 Gbps" min={0} step={100}
          value={pkgMb} onChange={e=>setPkgMb(e.target.value)} style={{...IS,fontFamily:"'DM Mono'"}}/>
        {thisGovMb>0 && <div style={{fontSize:11,color:"#3A5070",marginTop:3}}>= {fmtMb(thisGovMb)}</div>}
      </div>

      {/* Existing port allocations */}
      {coPorts.length>0 && govId && (
        <div style={{marginBottom:14}}>
          <SLabel>Existing Ports — Allocations (Mbps per port, optional)</SLabel>
          {coPorts.map(p=>{
            const area=areas.find(a=>a.id===p.areaId);
            return (
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:8,padding:"8px 10px",background:"#060A14",borderRadius:7,border:"1px solid #17253D"}}>
                <span style={{fontSize:14}}>🔷</span>
                <div style={{flex:1,fontSize:13}}>
                  <b style={{color:"#C9D5E8"}}>{area?.name||"?"}</b>
                  <span style={{color:"#3A5070",marginLeft:6,fontSize:11}}>({p.type}) #{p.portIndex}</span>
                </div>
                <input type="number" placeholder="Mbps" min={0} step={100}
                  value={portAlloc[p.id]||""} onChange={e=>setPA(s=>({...s,[p.id]:e.target.value}))}
                  style={{...IS,width:150,fontFamily:"'DM Mono'"}}/>
              </div>
            );
          })}
        </div>
      )}

      {/* New port requests — go to Port Opening Requests tab, need approval */}
      {govId && (
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <SLabel style={{marginBottom:0}}>Request New Ports (pending approval)</SLabel>
            <button onClick={addNewPortReq} style={{background:"#0A1F35",border:"1px solid #1A4A6B",borderRadius:6,
              color:"#5BB5F5",padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>
              + Add Port
            </button>
          </div>
          {newPortReqs.length===0 && (
            <div style={{fontSize:11,color:"#2A4060",padding:"6px 0"}}>
              No new ports requested. Click "+ Add Port" to request a new port for this company in {selGov?.name||"this gov"}.
            </div>
          )}
          {newPortReqs.map((np,i)=>{
            const fee=calcNewPortFee(np.areaId,np.type,i);
            return (
              <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 100px auto",gap:8,marginBottom:8,alignItems:"center",
                padding:"10px 12px",background:"#060A14",borderRadius:8,border:"1px solid #1A3A5C"}}>
                <div>
                  <label style={{...LBL,marginBottom:3}}>Area</label>
                  <select value={np.areaId} onChange={e=>updateNewPortReq(i,"areaId",e.target.value)} style={IS}>
                    <option value="">-- Area --</option>
                    {govAreas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{...LBL,marginBottom:3}}>Type</label>
                  <select value={np.type} onChange={e=>updateNewPortReq(i,"type",e.target.value)} style={IS}>
                    <option value="1G">1G</option>
                    <option value="10G">10G</option>
                  </select>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#3A5070",marginBottom:4}}>Fee</div>
                  <div style={{fontFamily:"'DM Mono'",fontWeight:700,fontSize:13,
                    color:np.free?"#34D399":"#FBBF24",textDecoration:np.free?"line-through":"none"}}>
                    ${fee.toLocaleString()}
                    {np.free&&<span style={{display:"block",textDecoration:"none",fontSize:10}}>FREE</span>}
                  </div>
                  {/* Free toggle */}
                  <label title={np.free?"Charge fee":"Make free"} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,cursor:"pointer",marginTop:4,userSelect:"none"}}>
                    <div onClick={()=>updateNewPortReq(i,"free",!np.free)} style={{width:28,height:16,borderRadius:8,
                      background:np.free?"#065F46":"#1A2A3A",border:`1px solid ${np.free?"#34D399":"#2A3A4A"}`,
                      position:"relative",transition:"all .2s",flexShrink:0}}>
                      <div style={{position:"absolute",top:1,left:np.free?12:1,width:12,height:12,borderRadius:6,
                        background:np.free?"#34D399":"#3A5070",transition:"left .2s"}}/>
                    </div>
                    <span style={{fontSize:9,color:np.free?"#34D399":"#3A5070"}}>{np.free?"Free":"Fee"}</span>
                  </label>
                  <button onClick={()=>removeNewPortReq(i)} style={{background:"none",border:"none",color:"#F87171",cursor:"pointer",fontSize:16,marginTop:2}}>🗑</button>
                </div>
              </div>
            );
          })}
          {newPortReqs.length>0 && (
            <div style={{fontSize:11,color:"#5A8AB0",padding:"4px 0"}}>
              ⚠ Port requests are <b>pending</b> — they appear in "Port Opening Requests" and must be approved before ports are created.
            </div>
          )}
        </div>
      )}

      {/* Price summary */}
      {(grandTotal>0||newPortReqs.length>0) && (
        <div style={{background:"#060A14",border:"1px solid #17253D",borderRadius:10,padding:16,marginTop:6}}>
          <div style={{fontSize:11,color:"#3A5070",marginBottom:8,lineHeight:1.8}}>
            {thisGovMb>0 && <div>This gov: <b style={{color:"#C9D5E8"}}>{fmtMb(thisGovMb)}</b></div>}
            {otherGovMb>0 && <div>Other govs: <b style={{color:"#C9D5E8"}}>{fmtMb(otherGovMb)}</b> → Grand total: <b style={{color:"#5BB5F5"}}>{fmtMb(grandTotal)}</b></div>}
            {tier && grandTotal>0 && <div>Tier: <b style={{color:"#FBBF24"}}>{tier.code}</b> ({fmtMb(grandTotal)} &gt; {fmtMb(tier.from)}) · Rate: <b style={{color:"#34D399"}}>${tier.ppm.toFixed(2)}/Mbps</b></div>}
            {tier && thisGovMb>0 && <div style={{color:"#5BB5F5"}}>Speed: {fmtMb(thisGovMb)} × ${tier.ppm.toFixed(2)} = <b>{fmt(speedCost)}</b></div>}
          </div>
          {speedCost>0 && <CostLine label="Speed cost (this gov)" val={speedCost}/>}
          {totalPortFee>0 && <CostLine label={`Port fees (${newPortReqs.length} port${newPortReqs.length>1?"s":""}, pending approval)`} val={totalPortFee}/>}
          <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid #17253D",fontWeight:700,fontSize:20,marginTop:8}}>
            <span style={{color:"#C9D5E8"}}>Total</span>
            <span style={{fontFamily:"'DM Mono'",color:"#5BB5F5"}}>{fmt(total)}</span>
          </div>
        </div>
      )}

      <Row gap={10} mt={18}>
        <Btn onClick={submit} disabled={submitting}>{submitting?"Submitting...":"Submit Request"}</Btn>
        <Btn ghost onClick={onClose}>Cancel</Btn>
      </Row>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MONTHLY CYCLES
// ─────────────────────────────────────────────────────────────────────────────

export default function Requests({ api, requests, setRequests, companies, ports, setPorts, areas, govs, tiers, portPrices, cycles, flash, isViewer, isAdmin, currentUser, currentCycle, isCycleOpen }) {
  const [detail,setDetail]       = useState(null);
  const [form,setForm]           = useState(false);
  const [filterGov,setFG]        = useState("all");
  const [filterCo,setFC]         = useState("all");
  const [filterSt,setFS]         = useState("all");
  const [search,setSrch]         = useState("");
  const [sortK,setSK]            = useState("createdAt");
  const [repricing,setRepricing] = useState(false);
  const [sortD,setSD]            = useState(-1);
  const [confirm, confirmDialog]  = useConfirm();

  // Auto-reprice all companies on mount so historical data is always correct
  useEffect(()=>{
    if (!currentCycle) return;
    api.repriceAll(currentCycle.id).then(res=>{
      if (!res.updated?.length) return;
      setRequests(prev=>prev.map(r=>{
        const u=res.updated.find(u=>u.id===r.id);
        return u ? {...r, speedCost:u.speedCost, total:u.total, tierCode:u.tierCode} : r;
      }));
    }).catch(()=>{});
  },[currentCycle?.id]);

  const setStatus = (id, st) => {
    const req = requests.find(r=>r.id===id);
    api.setRequestStatus(id, st)
      .then(updated=>{
        setRequests(prev=>prev.map(r=>r.id===id?{...updated,portPackages:updated.portPackages||[],newPorts:updated.newPorts||[]}:r));
        // Reprice siblings on server
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

  // Approve/reject port opening — server creates ports atomically
  const setPortStatus = (id, pst) => {
    api.setRequestPortStatus(id, pst)
      .then(({request, newPorts:created})=>{
        setRequests(prev=>prev.map(r=>r.id===id?{...request,portPackages:request.portPackages||[],newPorts:request.newPorts||[]}:r));
        if (created?.length) setPorts(p=>[...p,...created]);
        flash("Port request "+pst);
      })
      .catch(e=>flash(e.message,"err"));
  };
  const delReq = async (id) => {
    const r=requests.find(x=>x.id===id);
    const co=companies.find(c=>c.id===r?.companyId);
    const ok = await confirm("Delete this request?", `Request #${id}${co?" for "+co.name:""} will be permanently removed.`);
    if (!ok) return;
    api.deleteRequest(id)
      .then(()=>{ setRequests(p=>p.filter(r=>r.id!==id)); flash("Request #"+id+" deleted"); })
      .catch(e=>flash(e.message,"err"));
  };

  const visibleCycleId = currentCycle?.id;
  // Base: all requests for current cycle
  const cycleReqs = visibleCycleId ? requests.filter(r=>r.cycleId===visibleCycleId) : requests;
  // Package requests (have bandwidth)
  const installReqs = cycleReqs.filter(r=>r.totalPackageMb>0);
  // Port-opening requests (totalPackageMb=0, have newPorts)
  const portOnlyReqs = cycleReqs.filter(r=>r.totalPackageMb===0 && r.newPorts?.length>0);
  // Manager sees only their gov
  const scopedReqs = currentUser.role==="manager" ? installReqs.filter(r=>r.govId===currentUser.govId) : installReqs;
  const scopedPortReqs = currentUser.role==="manager" ? portOnlyReqs.filter(r=>r.govId===currentUser.govId) : portOnlyReqs;

  const sort = k => { if(sortK===k) setSD(d=>-d); else {setSK(k);setSD(1);} };
  const arr  = k => sortK===k?(sortD===1?" ↑":" ↓"):"";

  const displayed = scopedReqs.filter(r=>{
    const co=companies.find(c=>c.id===r.companyId);
    const gov=govs.find(g=>g.id===r.govId);
    if (filterGov!=="all" && r.govId!==Number(filterGov)) return false;
    if (filterCo!=="all"  && r.companyId!==Number(filterCo)) return false;
    if (filterSt!=="all"  && r.status!==filterSt) return false;
    if (search && !co?.name.toLowerCase().includes(search.toLowerCase()) && !gov?.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a,b)=>{
    const av = a[sortK]; const bv = b[sortK];
    const as = typeof av==="number" ? av : String(av||"").toLowerCase();
    const bs = typeof bv==="number" ? bv : String(bv||"").toLowerCase();
    return as<bs?-sortD:as>bs?sortD:0;
  });

  return (
    <div>
      {/* Cycle closed warning */}
      {currentCycle && !isCycleOpen && (
        <div style={{background:"#2D0909",border:"1px solid #7F1D1D",borderRadius:8,padding:"10px 16px",marginBottom:14,fontSize:13,color:"#F87171"}}>
          Cycle {monthLabel(currentCycle.month)} is <b>closed</b>. No new requests can be submitted. Open a new cycle to continue.
        </div>
      )}

      <ToolBar right={<div style={{display:"flex",gap:8}}>
        {!isViewer&&isCycleOpen&&<Btn onClick={()=>setForm(true)}>+ New Request</Btn>}
        {!isViewer && currentCycle && <Btn ghost onClick={async ()=>{
          setRepricing(true);
          try {
            const res = await api.repriceAll(currentCycle.id);
            if (res.updated?.length) {
              setRequests(prev=>prev.map(r=>{ const u=res.updated.find(u=>u.id===r.id); return u?{...r,speedCost:u.speedCost,total:u.total,tierCode:u.tierCode}:r; }));
              flash(`Repriced ${res.results?.length||0} company/ies — all tiers updated`);
            } else { flash("All prices already up to date"); }
          } catch(e){ flash(e.message,"err"); } finally { setRepricing(false); }
        }}>{repricing?"Repricing...":"🔄 Reprice All"}</Btn>}
      </div>}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <Muted>{displayed.length}/{scopedReqs.length} requests</Muted>
          <SearchBox val={search} set={setSrch} placeholder="Search..."/>
          {currentUser.role!=="manager" && (
            <select value={filterGov} onChange={e=>setFG(e.target.value)} style={{...IS,width:"auto",padding:"5px 10px",fontSize:12}}>
              <option value="all">All Govs</option>
              {govs.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <select value={filterCo} onChange={e=>setFC(e.target.value)} style={{...IS,width:"auto",padding:"5px 10px",fontSize:12}}>
            <option value="all">All Companies</option>
            {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterSt} onChange={e=>setFS(e.target.value)} style={{...IS,width:"auto",padding:"5px 10px",fontSize:12}}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </ToolBar>

      {form && <NewReqModal {...{api,companies,ports,setPorts,areas,govs,tiers,portPrices,requests,setRequests,flash,currentUser,currentCycle}} onClose={()=>setForm(false)}/>}
      {detail && <DetailModal r={detail} {...{api,companies,ports,areas,govs,setRequests,setPorts,flash,portPrices}} onClose={()=>setDetail(null)} onStatus={setStatus} onPortStatus={setPortStatus} isViewer={isViewer}/>}

      {/* ── Export Panel ── */}
      <div style={{background:"#0C1222",border:"1px solid #17253D",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:12,color:"#3A5070",fontWeight:600,textTransform:"uppercase",letterSpacing:".5px"}}>📥 Export</span>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn onClick={()=>{
            if (!visibleCycleId) return flash("No active cycle","err");
            exportRequestsByMonth(visibleCycleId,requests,companies,govs,cycles);
            flash("Exported requests for "+monthLabel(currentCycle?.month||""));
          }}>📊 Monthly Requests</Btn>
          <Btn onClick={()=>{
            if (!visibleCycleId) return flash("No active cycle","err");
            const hasNew=scopedPortReqs.length;
            if (!hasNew) return flash("No port opening requests in this cycle","err");
            exportPortOpeningRequests(visibleCycleId,requests,companies,govs,areas,cycles);
            flash("Exported port opening requests");
          }}>🔌 Port Opening Requests</Btn>
        </div>
      </div>

      {/* Sort */}
      <div style={{display:"flex",gap:2,marginBottom:10,flexWrap:"wrap"}}>
        {[["createdAt","Date"],["companyId","Company"],["govId","Gov"],["totalPackageMb","Package"],["total","Total"],["status","Status"]].map(([k,l])=>(
          <button key={k} onClick={()=>sort(k)} style={{background:sortK===k?"#112040":"none",border:"1px solid #17253D",
            borderRadius:6,padding:"4px 10px",color:sortK===k?"#5BB5F5":"#3A5070",fontSize:11,cursor:"pointer"}}>
            {l}{arr(k)}
          </button>
        ))}
      </div>

      <DataTable
        cols={["#","Company","Gov","Date","Package","Tier","Total","Status",""]}
        rows={displayed.map(r=>{
          const co=companies.find(c=>c.id===r.companyId);
          const gov=govs.find(g=>g.id===r.govId);
          const sc=REQ_STATUS[r.status];
          return [
            <span key="id" style={{fontFamily:"'DM Mono'",color:"#3A5070",fontSize:11}}>#{r.id}</span>,
            co?.name||"—",
            <GovBadge key="g">{gov?.name||"—"}</GovBadge>,
            fmtDate(r.createdAt),
            <span key="p" style={{fontFamily:"'DM Mono'"}}>{fmtMb(r.totalPackageMb)}</span>,
            r.totalPackageMb===0
              ? <span key="t" style={{fontSize:10,padding:"1px 7px",borderRadius:4,background:"#112040",color:"#5BB5F5",fontWeight:700,border:"1px solid #1A4A6B"}}>PORT</span>
              : <span key="t" style={{fontFamily:"'DM Mono'",color:"#FBBF24",fontWeight:700}}>{r.tierCode}</span>,
            <span key="c" style={{fontFamily:"'DM Mono'",color:"#5BB5F5",fontWeight:600}}>{fmt(r.total)}</span>,
            <div key="st" style={{display:"flex",flexDirection:"column",gap:3}}>
              <Badge sc={sc}>{r.status}</Badge>

            </div>,
            <Row key="a" gap={5}>
              <IBtn onClick={()=>setDetail(r)}>👁️</IBtn>
              {!isViewer && <IBtn onClick={()=>delReq(r.id)}>🗑️</IBtn>}
            </Row>,
          ];
        })}
      />

      {/* ── PORT OPENING REQUESTS ── */}
      {scopedPortReqs.length>0 && (
        <div style={{marginTop:24}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{fontWeight:700,fontSize:14,color:"#5BB5F5"}}>🔌 Port Opening Requests</div>
            <span style={{background:"#112040",border:"1px solid #1A4A6B",borderRadius:10,padding:"1px 8px",fontSize:11,color:"#5BB5F5"}}>{scopedPortReqs.length}</span>
          </div>
          <DataTable
            cols={["#","Company","Gov","Area / Port","Fee","Status",""]}
            rows={scopedPortReqs.sort((a,b)=>b.id-a.id).map(r=>{
              const co=companies.find(c=>c.id===r.companyId);
              const gov=govs.find(g=>g.id===r.govId);
              const np=r.newPorts?.[0];
              const area=areas.find(a=>a.id===np?.areaId);
              const pst=r.portStatus||"pending";
              const sc={approved:{bg:"#052E1C",text:"#34D399",border:"#065F46"},rejected:{bg:"#2D0909",text:"#F87171",border:"#7F1D1D"},pending:{bg:"#2D2006",text:"#FBBF24",border:"#78500A"}}[pst]||{bg:"#2D2006",text:"#FBBF24",border:"#78500A"};
              return [
                <span key="id" style={{fontFamily:"'DM Mono'",color:"#3A5070",fontSize:11}}>#{r.id}</span>,
                co?.name||"—",
                <GovBadge key="g">{gov?.name||"—"}</GovBadge>,
                <span key="a" style={{fontSize:12}}>{area?.name||"?"} <span style={{color:"#3A5070"}}>({np?.type||"?"})</span></span>,
                <span key="f" style={{fontFamily:"'DM Mono'",color:"#FBBF24",fontWeight:600}}>{fmt(r.total)}</span>,
                <Badge key="s" sc={sc}>{pst}</Badge>,
                <Row key="act" gap={5}>
                  {!isViewer && pst==="pending" && (<>
                    <IBtn title="Approve — creates port" onClick={()=>setPortStatus(r.id,"approved")} style={{background:"#052E1C",border:"1px solid #065F46",color:"#34D399"}}>✓</IBtn>
                    <IBtn title="Reject" onClick={()=>setPortStatus(r.id,"rejected")} style={{background:"#2D0909",border:"1px solid #7F1D1D",color:"#F87171"}}>✕</IBtn>
                  </>)}
                  {!isViewer && <IBtn onClick={()=>delReq(r.id)}>🗑️</IBtn>}
                </Row>,
              ];
            })}
          />
        </div>
      )}
      {/* ── Company Grand Totals Summary ── */}
      {currentCycle && cycleReqs.length>0 && (() => {
        // Group by company
        const coIds = [...new Set(cycleReqs.map(r=>r.companyId))];
        return (
          <div style={{background:"#060D1A",border:"1px solid #17253D",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
            <div style={{fontSize:11,color:"#3A5070",fontWeight:700,textTransform:"uppercase",letterSpacing:".8px",marginBottom:10}}>
              📊 Company Totals — {monthLabel(currentCycle.month)}
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
              {coIds.map(cid=>{
                const co=companies.find(c=>c.id===cid);
                const coReqs=cycleReqs.filter(r=>r.companyId===cid);
                const pkgReqs=coReqs.filter(r=>r.totalPackageMb>0 && r.status!=="rejected");
                const portReqs=coReqs.filter(r=>r.totalPackageMb===0 && r.newPorts?.length>0 && r.portStatus==="approved");
                const grandMb=pkgReqs.reduce((s,r)=>s+r.totalPackageMb,0);
                const pkgTotal=pkgReqs.reduce((s,r)=>s+r.speedCost,0);
                const portTotal=portReqs.reduce((s,r)=>s+r.portCost,0);
                const tierCode=pkgReqs[0]?.tierCode||"—";
                const combined=pkgTotal+portTotal;
                return (
                  <div key={cid} style={{background:"#0C1222",border:"1px solid #1A2E4A",borderRadius:8,padding:"10px 14px",minWidth:200,flex:"1 1 200px"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#C9D5E8",marginBottom:8}}>{co?.name||"?"}</div>
                    <div style={{fontSize:11,color:"#3A5070",display:"grid",gridTemplateColumns:"1fr auto",gap:"3px 16px"}}>
                      <span>Total Mbps</span><span style={{fontFamily:"'DM Mono'",color:"#94ADC8"}}>{(grandMb/1000).toFixed(1)} Gbps</span>
                      <span>Tier</span><span style={{fontFamily:"'DM Mono'",color:"#FBBF24",fontWeight:700}}>{tierCode}</span>
                      <span>Packages</span><span style={{fontFamily:"'DM Mono'",color:"#5BB5F5"}}>{fmt(pkgTotal)}</span>
                      {portTotal>0&&<><span>Port fees</span><span style={{fontFamily:"'DM Mono'",color:"#C084FC"}}>{fmt(portTotal)}</span></>}
                    </div>
                    <div style={{borderTop:"1px solid #1A2E4A",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:11,color:"#3A5070",fontWeight:600}}>TOTAL</span>
                      <span style={{fontFamily:"'DM Mono'",fontSize:15,fontWeight:700,color:"#34D399"}}>{fmt(combined)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}


      {confirmDialog}
    </div>
  );
}

