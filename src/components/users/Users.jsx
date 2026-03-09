import { useState } from "react";
import { fmt, fmtMb, fmtDate, monthLabel, IS, LBL, REQ_STATUS, CYCLE_STATUS, ROLE_PERMS } from "../../constants";
import { Btn, IBtn, Badge, GovBadge, Stat, Row, Muted, Card, SLabel, CostLine, ToolBar, Modal, DataTable, SearchBox, FI, FS, MiniStat } from "../ui";
import useConfirm from "../../hooks/useConfirm";

export default function Users({ api, users, setUsers, govs, flash, currentUser }) {
    const [confirm, confirmDialog] = useConfirm();
  const [modal,setModal] = useState(null);
  const [ed,setEd]       = useState({});
  const [search,setSrch] = useState("");
  const close = () => setModal(null);
  const RC = {superadmin:"#C084FC",manager:"#5BB5F5",viewer:"#34D399"};

  const govOptsWithNone = [{value:"",label:"-- None --"}].concat(govs.map(g=>({value:g.id,label:g.name})));

  const openAdd  = () => { setEd({username:"",password:"",name:"",role:"viewer",govId:""}); setModal("add"); };
  const openEdit = u => { setEd({...u}); setModal("edit"); };
  const del = async (id) => {
    if (id===currentUser.id) return flash("Cannot delete yourself","err");
    const u=users.find(x=>x.id===id);
    const ok=await confirm("Delete this user?",`"${u?.name||u?.username||"This user"}" will be permanently removed.`);
    if(!ok) return;
    api.deleteUser(id)
      .then(()=>{ setUsers(p=>p.filter(u=>u.id!==id)); flash("User deleted"); })
      .catch(e=>flash(e.message,"err"));
  };
  const save = () => {
    if (!ed.username||!ed.password||!ed.name) return flash("Fill all required fields","err");
    if (modal==="add"&&users.find(u=>u.username===ed.username)) return flash("Username already exists","err");
    const payload={username:ed.username,password:ed.password,name:ed.name,role:ed.role,govId:ed.role==="manager"?Number(ed.govId)||null:null};
    if (modal==="add") {
      api.addUser(payload)
        .then(u=>{ setUsers(p=>[...p,u]); flash("User created"); close(); })
        .catch(e=>flash(e.message,"err"));
    } else {
      api.updateUser(ed.id,payload)
        .then(()=>{ setUsers(p=>p.map(u=>u.id===ed.id?{...u,...payload}:u)); flash("Updated"); close(); })
        .catch(e=>flash(e.message,"err"));
    }
  };

  const displayed = users.filter(u=>!search||u.name.toLowerCase().includes(search.toLowerCase())||u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <ToolBar right={<Btn onClick={openAdd}>+ Add User</Btn>}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <Muted>{displayed.length} users</Muted>
          <SearchBox val={search} set={setSrch} placeholder="Search users..."/>
        </div>
      </ToolBar>

      {confirmDialog}
      {modal && (
        <Modal title={modal==="add"?"Create User":"Edit User"} onClose={close}>
          <FI label="Full Name *" val={ed.name}     set={v=>setEd(p=>({...p,name:v}))}/>
          <FI label="Username *"  val={ed.username}  set={v=>setEd(p=>({...p,username:v}))}/>
          <FI label="Password *"  val={ed.password}  set={v=>setEd(p=>({...p,password:v}))}/>
          <FS label="Role *"      val={ed.role}      set={v=>setEd(p=>({...p,role:v}))} opts={["superadmin","manager","viewer"]}/>
          {ed.role==="manager" && <FS label="Assigned Gov" val={ed.govId||""} set={v=>setEd(p=>({...p,govId:v}))} opts={govOptsWithNone}/>}
          <div style={{background:"#060A14",borderRadius:8,padding:"10px 14px",marginBottom:14}}>
            <div style={{fontSize:11,color:"#3A5070",marginBottom:6}}>Permissions:</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {(ROLE_PERMS[ed.role]||[]).map(p=>(
                <span key={p} style={{background:"#112040",color:"#5BB5F5",padding:"2px 8px",borderRadius:4,fontSize:11}}>{p}</span>
              ))}
            </div>
          </div>
          <Row gap={10} mt={4}><Btn onClick={save}>Save</Btn><Btn ghost onClick={close}>Cancel</Btn></Row>
        </Modal>
      )}

      <DataTable
        cols={["Name","Username","Role","Gov","Actions"]}
        rows={displayed.map(u=>{
          const gov=govs.find(g=>g.id===u.govId);
          return [
            <div key="n">
              <div style={{fontWeight:600,fontSize:13}}>{u.name}</div>
              {u.id===currentUser.id && <span style={{fontSize:10,color:"#34D399"}}>● You</span>}
              {u.id===9999 && <span style={{fontSize:10,color:"#FBBF24",fontWeight:700}}>🔐 PERMANENT</span>}
            </div>,
            <span key="u" style={{fontFamily:"'DM Mono'",color:"#94ADC8"}}>{u.username}</span>,
            <span key="r" style={{fontFamily:"'DM Mono'",fontWeight:600,color:RC[u.role]||"#C9D5E8"}}>{u.role}</span>,
            gov ? <GovBadge key="g">{gov.name}</GovBadge> : <span key="g" style={{color:"#3A5070",fontSize:12}}>All</span>,
            <Row key="a" gap={6}>
              {u.id!==9999 && <IBtn onClick={()=>openEdit(u)}>✏️</IBtn>}
              {u.id!==currentUser.id && u.id!==9999 && <IBtn onClick={()=>del(u.id)}>🗑️</IBtn>}
              {u.id===9999 && <span style={{fontSize:11,color:"#3A5070",padding:"3px 8px"}}>Protected</span>}
            </Row>,
          ];
        })}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ATOMS
// ─────────────────────────────────────────────────────────────────────────────
