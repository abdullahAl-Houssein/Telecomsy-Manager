import { useState } from "react";
import { fmt, fmtMb, fmtDate, monthLabel, IS, LBL, REQ_STATUS, CYCLE_STATUS } from "../../constants";
import { Btn, IBtn, Badge, GovBadge, Stat, Row, Muted, Card, SLabel, CostLine, ToolBar, Modal, DataTable, SearchBox, FI, FS, MiniStat } from "../ui";
import useConfirm from "../../hooks/useConfirm";

export default function Cycles({ api, cycles, setCycles, requests, setRequests, companies, govs, flash, isAdmin, currentCycle, setViewCycle, currentUser }) {
  const [confirm, confirmDialog] = useConfirm();
  const [addModal,setAddModal] = useState(false);
  const todayMonth = new Date().toISOString().slice(0,7);
  const [newMonth,setNewMonth] = useState(todayMonth);
  const [confirmClose,setConfirmClose] = useState(null);
  const [editCycle,setEditCycle] = useState(null);
  const [editMonth,setEditMonth] = useState("");

  const openCycle = () => {
    if (!newMonth) return flash("Select a month","err");
    if (cycles.find(c=>c.month===newMonth)) return flash("Cycle for this month already exists","err");
    const today=new Date().toISOString().slice(0,10);
    api.addCycle({month:newMonth,status:"open",openedAt:today,openedBy:currentUser?.name||"admin"})
      .then(c=>{ setCycles(p=>[...p,c]); flash("Cycle opened for "+monthLabel(newMonth)); setAddModal(false); setNewMonth(todayMonth); })
      .catch(e=>flash(e.message,"err"));
  };

  const saveCycleEdit = () => {
    if (!editMonth) return flash("Select a month","err");
    if (cycles.find(c=>c.month===editMonth && c.id!==editCycle.id)) return flash("A cycle for this month already exists","err");
    const cyc=editCycle;
    api.updateCycle(cyc.id,{status:cyc.status,closedAt:cyc.closedAt||null,openedAt:cyc.openedAt})
      .then(()=>{ setCycles(p=>p.map(c=>c.id===cyc.id?{...c,month:editMonth}:c)); flash("Cycle updated"); setEditCycle(null); setEditMonth(""); })
      .catch(e=>flash(e.message,"err"));
  };

  const closeCycle = id => {
    const today=new Date().toISOString().slice(0,10);
    const cyc=cycles.find(c=>c.id===id);
    api.updateCycle(id,{status:"closed",closedAt:today,openedAt:cyc?.openedAt||today})
      .then(()=>{ setCycles(p=>p.map(c=>c.id===id?{...c,status:"closed",closedAt:today}:c)); flash("Cycle closed"); setConfirmClose(null); })
      .catch(e=>flash(e.message,"err"));
  };

  const reopenCycle = id => {
    if (hasOpen) return flash("Close the currently open cycle first","err");
    const cyc=cycles.find(c=>c.id===id);
    api.updateCycle(id,{status:"open",closedAt:null,openedAt:cyc?.openedAt||new Date().toISOString().slice(0,10)})
      .then(()=>{ setCycles(p=>p.map(c=>c.id===id?{...c,status:"open",closedAt:null}:c)); flash("Cycle re-opened"); })
      .catch(e=>flash(e.message,"err"));
  };

  const deleteCycle = async (id) => {
    const cyc=cycles.find(c=>c.id===id);
    const reqs=requests.filter(r=>r.cycleId===id);
    const detail = reqs.length>0
      ? `This cycle has ${reqs.length} request(s) that will also be deleted.`
      : monthLabel(cyc?.month||"")+" will be permanently removed.";
    const ok = await confirm("Delete cycle "+monthLabel(cyc?.month||"")+"?", detail);
    if (!ok) return;
    api.deleteCycle(id)
      .then(()=>{ setCycles(p=>p.filter(c=>c.id!==id)); setRequests(p=>p.filter(r=>r.cycleId!==id)); flash("Cycle deleted"); })
      .catch(e=>flash(e.message,"err"));
  };

  const hasOpen = cycles.some(c=>c.status==="open");

  return (
    <div>
      {confirmDialog}
      <ToolBar right={isAdmin ? <Btn onClick={()=>setAddModal(true)}>+ Open New Cycle</Btn> : null}>
        <Muted>{cycles.length} cycles total</Muted>
      </ToolBar>

      {addModal && (
        <Modal title="Open New Monthly Cycle" onClose={()=>setAddModal(false)}>
          {hasOpen && (
            <div style={{background:"#2D2006",border:"1px solid #78500A",borderRadius:8,padding:"10px 14px",marginBottom:14,color:"#FBBF24",fontSize:13}}>
              ⚠️ There is already an open cycle. Close it before opening a new one.
            </div>
          )}
          <div style={{marginBottom:14}}>
            <label style={LBL}>Select Month *</label>
            <input type="month" value={newMonth} onChange={e=>setNewMonth(e.target.value)} style={IS}/>
          </div>
          <Row gap={10} mt={4}>
            <Btn onClick={openCycle}>Open Cycle</Btn>
            <Btn ghost onClick={()=>setAddModal(false)}>Cancel</Btn>
          </Row>
        </Modal>
      )}

      {confirmClose && (
        <Modal title={"Close Cycle — "+monthLabel(confirmClose.month)} onClose={()=>setConfirmClose(null)}>
          <div style={{fontSize:13,color:"#C9D5E8",marginBottom:14,lineHeight:1.7}}>
            You are about to <b style={{color:"#F87171"}}>close</b> the cycle for <b>{monthLabel(confirmClose.month)}</b>.
            <br/>After closing, no new requests can be submitted for this month.
            <br/><br/>
            <b>Requests in this cycle:</b> {requests.filter(r=>r.cycleId===confirmClose.id).length} total,{" "}
            {requests.filter(r=>r.cycleId===confirmClose.id&&r.status==="pending").length} still pending.
          </div>
          {requests.filter(r=>r.cycleId===confirmClose.id&&r.status==="pending").length>0 && (
            <div style={{background:"#2D2006",border:"1px solid #78500A",borderRadius:8,padding:"10px 14px",marginBottom:14,color:"#FBBF24",fontSize:13}}>
              ⚠️ There are pending requests. Consider approving or rejecting them before closing.
            </div>
          )}
          <Row gap={10} mt={4}>
            <Btn onClick={()=>closeCycle(confirmClose.id)}>Confirm Close</Btn>
            <Btn ghost onClick={()=>setConfirmClose(null)}>Cancel</Btn>
          </Row>
        </Modal>
      )}

      {editCycle && (
        <Modal title={"Edit Cycle — "+monthLabel(editCycle.month)} onClose={()=>setEditCycle(null)}>
          <div style={{marginBottom:14}}>
            <label style={LBL}>New Month *</label>
            <input type="month" value={editMonth} onChange={e=>setEditMonth(e.target.value)} style={IS}/>
          </div>
          <Row gap={10} mt={4}>
            <Btn onClick={saveCycleEdit}>Save Changes</Btn>
            <Btn ghost onClick={()=>setEditCycle(null)}>Cancel</Btn>
          </Row>
        </Modal>
      )}

      {editCycle && (
        <Modal title={"Edit Cycle — "+monthLabel(editCycle.month)} onClose={()=>setEditCycle(null)}>
          <div style={{marginBottom:14}}>
            <label style={LBL}>New Month *</label>
            <input type="month" value={editMonth} onChange={e=>setEditMonth(e.target.value)} style={IS}/>
          </div>
          <Row gap={10} mt={4}>
            <Btn onClick={saveCycleEdit}>Save Changes</Btn>
            <Btn ghost onClick={()=>setEditCycle(null)}>Cancel</Btn>
          </Row>
        </Modal>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {[...cycles].reverse().map(c=>{
          const cReqs    = requests.filter(r=>r.cycleId===c.id);
          const approved = cReqs.filter(r=>r.status==="approved");
          const pending  = cReqs.filter(r=>r.status==="pending");
          const revenue  = approved.reduce((s,r)=>s+r.total,0);
          const isOpen   = c.status==="open";
          const isCurrent = currentCycle?.id===c.id;

          return (
            <div key={c.id} style={{background:"#0C1222",border:`1px solid ${isCurrent?"#1A6FA8":"#17253D"}`,
              borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",display:"flex",alignItems:"center",gap:16,
                background:isCurrent?"linear-gradient(90deg,#112040,#0C1222)":"none"}}>
                <div style={{fontSize:24}}>📅</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:16,color:"#D4E3F5"}}>{monthLabel(c.month)}</span>
                    <Badge sc={CYCLE_STATUS[c.status]}>{c.status}</Badge>
                    {isCurrent && <span style={{fontSize:10,background:"#1A6FA8",color:"#fff",padding:"1px 7px",borderRadius:3,fontWeight:600}}>VIEWING</span>}
                  </div>
                  <div style={{fontSize:12,color:"#3A5070"}}>
                    Opened: {fmtDate(c.openedAt)}
                    {c.closedAt && " · Closed: "+fmtDate(c.closedAt)}
                    {" · By: "+c.openedBy}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,textAlign:"center"}}>
                  {[["Requests",cReqs.length],["Approved",approved.length],["Pending",pending.length],["Revenue",fmt(revenue)]].map(([l,v])=>(
                    <div key={l}>
                      <div style={{fontFamily:"'DM Mono'",fontSize:14,fontWeight:600,color:"#5BB5F5"}}>{v}</div>
                      <div style={{fontSize:10,color:"#3A5070"}}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  <button onClick={()=>setViewCycle(c.id)}
                    style={{background:"#112040",border:"1px solid #17253D",borderRadius:6,color:"#5BB5F5",padding:"5px 12px",cursor:"pointer",fontSize:12}}>
                    View
                  </button>
                  {isOpen && isAdmin && (
                    <button onClick={()=>setConfirmClose(c)}
                      style={{background:"#2D0909",border:"1px solid #7F1D1D",borderRadius:6,color:"#F87171",padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>
                      Close
                    </button>
                  )}
                  {!isOpen && isAdmin && (
                    <button onClick={()=>reopenCycle(c.id)}
                      style={{background:"#052E1C",border:"1px solid #065F46",borderRadius:6,color:"#34D399",padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>
                      Re-open
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={()=>{setEditCycle(c);setEditMonth(c.month);}}
                      style={{background:"#112040",border:"1px solid #17253D",borderRadius:6,color:"#5BB5F5",padding:"5px 8px",cursor:"pointer",fontSize:12}}>
                      ✏️
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={()=>{setEditCycle(c);setEditMonth(c.month);}}
                      style={{background:"#112040",border:"1px solid #17253D",borderRadius:6,color:"#5BB5F5",padding:"5px 8px",cursor:"pointer",fontSize:12}}>
                      ✏️
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={()=>deleteCycle(c.id)}
                      style={{background:"#1A0505",border:"1px solid #4A1010",borderRadius:6,color:"#EF4444",padding:"5px 8px",cursor:"pointer",fontSize:12}}>
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {/* Company breakdown */}
              {cReqs.length>0 && (
                <div style={{padding:"12px 20px",borderTop:"1px solid #17253D"}}>
                  <div style={{fontSize:11,color:"#3A5070",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Company Summary</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {companies.map(co=>{
                      const coReqs=cReqs.filter(r=>r.companyId===co.id);
                      if (!coReqs.length) return null;
                      const total=coReqs.filter(r=>r.status==="approved").reduce((s,r)=>s+r.total,0);
                      const totalMb=coReqs.reduce((s,r)=>s+r.totalPackageMb,0);
                      return (
                        <div key={co.id} style={{background:"#060A14",borderRadius:8,padding:"8px 12px",border:"1px solid #17253D"}}>
                          <div style={{fontWeight:600,fontSize:12,marginBottom:3}}>{co.name}</div>
                          <div style={{fontSize:11,color:"#3A5070"}}>{fmtMb(totalMb)} · {coReqs.length} gov{coReqs.length!==1?"s":""}</div>
                          <div style={{fontFamily:"'DM Mono'",fontSize:12,color:"#5BB5F5",marginTop:2}}>{fmt(total)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PRICING AUDIT — verifies all request costs against current tier table
// ─────────────────────────────────────────────────────────────────────────────
