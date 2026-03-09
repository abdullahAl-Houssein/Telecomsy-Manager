import { useState } from "react";
import { fmt, fmtMb, fmtDate, monthLabel, IS, LBL, REQ_STATUS, CYCLE_STATUS } from "../../constants";
import { Btn, IBtn, Badge, GovBadge, Stat, Row, Muted, Card, SLabel, CostLine, ToolBar, Modal, DataTable, SearchBox, FI, FS, MiniStat } from "../ui";
import useConfirm from "../../hooks/useConfirm";

export default function Areas({ api, areas, setAreas, govs, ports, companies, flash, isViewer, currentUser }) {
  const [confirm, confirmDialog] = useConfirm();
  const [modal,setModal] = useState(null);
  const [ed,setEd]       = useState({});
  const [filterGov,setFilterGov] = useState("all");
  const [search,setSearch]       = useState("");
  const close = () => setModal(null);

  const visGovId = currentUser.role==="manager" ? currentUser.govId : null;
  const govOpts  = govs.map(g=>({value:g.id,label:g.name}));

  const displayed = areas.filter(a=>{
    if (visGovId && a.govId!==visGovId) return false;
    if (filterGov!=="all" && a.govId!==Number(filterGov)) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openAdd  = (govId) => { setEd({name:"",govId:govId||visGovId||govs[0]?.id||"",note:""}); setModal("add"); };
  const openEdit = a => { setEd({...a}); setModal("edit"); };
  const del = async (id) => {
    if (ports.some(p=>p.areaId===id)) return flash("Cannot delete — ports exist in this area","err");
    const a=areas.find(x=>x.id===id);
    const ok=await confirm("Delete this area?",`"${a?.name||"This area"}" will be permanently removed.`);
    if(!ok) return;
    api.deleteArea(id)
      .then(()=>{ setAreas(p=>p.filter(a=>a.id!==id)); flash("Area deleted"); })
      .catch(e=>flash(e.message,"err"));
  };
  const save = () => {
    if (!ed.name?.trim()) return flash("Area name required","err");
    if (!ed.govId) return flash("Select a governorate","err");
    const d = {name:ed.name.trim(), govId:Number(ed.govId), note:ed.note||""};
    if (modal==="add") {
      api.addArea(d)
        .then(a=>{ setAreas(p=>[...p,a]); flash("Area added"); close(); })
        .catch(e=>flash(e.message,"err"));
    } else {
      api.updateArea(ed.id,d)
        .then(()=>{ setAreas(p=>p.map(a=>a.id===ed.id?{...a,...d}:a)); flash("Updated"); close(); })
        .catch(e=>flash(e.message,"err"));
    }
  };

  const govGroups = govs
    .filter(g=>visGovId ? g.id===visGovId : (filterGov==="all" || g.id===Number(filterGov)))
    .map(g=>({ gov:g, items:displayed.filter(a=>a.govId===g.id) }));

  return (
    <div>
      <ToolBar right={!isViewer ? <Btn onClick={()=>openAdd(null)}>+ Add Area</Btn> : null}>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <Muted>{displayed.length} areas</Muted>
          <SearchBox val={search} set={setSearch} placeholder="Search areas..."/>
          {!visGovId && (
            <select value={filterGov} onChange={e=>setFilterGov(e.target.value)} style={{...IS,width:"auto",padding:"5px 10px",fontSize:12}}>
              <option value="all">All Governorates</option>
              {govs.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>
      </ToolBar>

      {confirmDialog}
      {modal && (
        <Modal title={modal==="add"?"Add Area":"Edit Area"} onClose={close}>
          <FI label="Area Name *" val={ed.name} set={v=>setEd(p=>({...p,name:v}))} placeholder="e.g. Ansari, Sulaymaniyah..."/>
          {!visGovId && <FS label="Governorate *" val={ed.govId} set={v=>setEd(p=>({...p,govId:v}))} opts={govOpts}/>}
          <FI label="Note / Description" val={ed.note||""} set={v=>setEd(p=>({...p,note:v}))} placeholder="Optional"/>
          <Row gap={10} mt={16}><Btn onClick={save}>Save</Btn><Btn ghost onClick={close}>Cancel</Btn></Row>
        </Modal>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        {govGroups.map(({gov,items})=>(
          <div key={gov.id} style={{background:"#0C1222",border:"1px solid #17253D",borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:"1px solid #17253D",display:"flex",justifyContent:"space-between",
              alignItems:"center",background:"linear-gradient(90deg,#112040,#0C1222)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:18}}>🗺</span>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:"#D4E3F5"}}>{gov.name}</div>
                  <div style={{fontSize:11,color:"#3A5070"}}>{items.length} area{items.length!==1?"s":""}</div>
                </div>
              </div>
              {!isViewer && (
                <button onClick={()=>openAdd(gov.id)}
                  style={{background:"none",border:"1px dashed #17253D",color:"#5BB5F5",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:12}}>
                  + Add to {gov.name}
                </button>
              )}
            </div>
            {items.length===0 ? (
              <div style={{padding:24,textAlign:"center",color:"#1E3050",fontSize:13}}>No areas defined yet</div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:1,background:"#17253D"}}>
                {items.map(a=>{
                  const ap = ports.filter(p=>p.areaId===a.id);
                  const coIds = [...new Set(ap.map(p=>p.companyId))];
                  const acos = coIds.map(id=>companies.find(c=>c.id===id)).filter(Boolean);
                  return (
                    <div key={a.id} style={{background:"#0C1222",padding:"14px 16px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:14,marginBottom:3}}>🔷 {a.name}</div>
                          {a.note && <div style={{fontSize:11,color:"#3A5070",marginBottom:4}}>{a.note}</div>}
                          <div style={{fontSize:11,color:"#3A5070"}}>{ap.length} port{ap.length!==1?"s":""}</div>
                          {acos.length>0 && <div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:5}}>
                            {acos.map(c=><span key={c.id} style={{background:"#060A14",border:"1px solid #17253D",borderRadius:4,padding:"1px 6px",fontSize:10,color:"#7A95B0"}}>{c.name}</span>)}
                          </div>}
                        </div>
                        {!isViewer && <div style={{display:"flex",gap:4,flexShrink:0,marginLeft:8}}>
                          <IBtn onClick={()=>openEdit(a)}>✏️</IBtn>
                          <IBtn onClick={()=>del(a.id)}>🗑️</IBtn>
                        </div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PORTS
// ─────────────────────────────────────────────────────────────────────────────
