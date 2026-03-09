import { useState } from "react";
import { fmt, fmtMb, fmtDate, monthLabel, IS, LBL, REQ_STATUS, CYCLE_STATUS } from "../../constants";
import { Btn, IBtn, Badge, GovBadge, Stat, Row, Muted, Card, SLabel, CostLine, ToolBar, Modal, DataTable, SearchBox, FI, FS, MiniStat } from "../ui";
import useConfirm from "../../hooks/useConfirm";

export default function Branches({ api, govs, setGovs, areas, companies, ports, flash, isAdmin }) {
  const [addModal,setAdd] = useState(false);
  const [nv,setNv]        = useState("");

  return (
    <div>
      <ToolBar right={isAdmin ? <Btn onClick={()=>setAdd(true)}>+ Add Branch</Btn> : null}>
        <Muted>{govs.length} branches</Muted>
      </ToolBar>
      {addModal && (
        <Modal title="Add Branch (Governorate)" onClose={()=>setAdd(false)}>
          <FI label="Governorate Name *" val={nv} set={setNv} placeholder="e.g. Homs, Damascus..."/>
          <Row gap={10} mt={12}>
            <Btn onClick={()=>{if(!nv.trim())return;api.addGov(nv.trim()).then(g=>{setGovs(p=>[...p,g]);setAdd(false);setNv("");flash("Branch added");}).catch(e=>flash(e.message,"err"));}}>Add</Btn>
            <Btn ghost onClick={()=>setAdd(false)}>Cancel</Btn>
          </Row>
        </Modal>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {govs.map(g=>{
          const ga=areas.filter(a=>a.govId===g.id);
          // companies active in this gov (via ports)
          const gPorts=ports.filter(p=>{ const a=areas.find(x=>x.id===p.areaId); return a?.govId===g.id; });
          const gCoIds=[...new Set(gPorts.map(p=>p.companyId))];
          const gCos=gCoIds.map(id=>companies.find(c=>c.id===id)).filter(Boolean);
          return (
            <div key={g.id} style={{background:"#0C1222",border:"1px solid #17253D",borderRadius:12,padding:20}}>
              <div style={{fontSize:26,marginBottom:10}}>🗺</div>
              <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>{g.name}</div>
              <div style={{fontSize:11,color:"#5BB5F5",marginBottom:12}}>Supply Office Branch</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                <Stat label="Areas"     val={ga.length}/>
                <Stat label="Companies" val={gCos.length}/>
              </div>
              <div style={{fontSize:10,color:"#3A5070",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Areas</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>
                {ga.map(a=><span key={a.id} style={{background:"#060A14",border:"1px solid #1A6FA840",borderRadius:4,padding:"2px 8px",fontSize:11,color:"#5BB5F5"}}>🔷 {a.name}</span>)}
              </div>
              <div style={{fontSize:10,color:"#3A5070",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Active Companies</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {gCos.map(c=><span key={c.id} style={{background:"#060A14",border:"1px solid #17253D",borderRadius:4,padding:"2px 8px",fontSize:11,color:"#7A95B0"}}>{c.name}</span>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  USERS
// ─────────────────────────────────────────────────────────────────────────────
