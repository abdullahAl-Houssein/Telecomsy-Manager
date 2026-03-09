import { useState, useMemo } from "react";
import { fmt, fmtMb, fmtDate, monthLabel, IS, LBL, REQ_STATUS, CYCLE_STATUS, calcPrice, uid } from "../../constants";
import { Btn, IBtn, Badge, GovBadge, Stat, Row, Muted, Card, SLabel, CostLine, ToolBar, Modal, DataTable, SearchBox, FI, FS, MiniStat } from "../ui";
import useConfirm from "../../hooks/useConfirm";

function PricingAudit({ requests, setRequests, companies, govs, cycles, tiers, flash }) {
  const [open, setOpen] = useState(false);

  // For each cycle, group requests by company. Recalculate what they should cost.
  const rows = useMemo(()=>{
    const result = [];
    for (const cy of [...cycles].sort((a,b)=>a.month.localeCompare(b.month))) {
      const cyReqs = requests.filter(r=>r.cycleId===cy.id && r.status!=="rejected");
      // Group by company
      const coIds = [...new Set(cyReqs.map(r=>r.companyId))];
      for (const cid of coIds) {
        const coReqs = cyReqs.filter(r=>r.companyId===cid);
        const grandTotalMb = coReqs.reduce((s,r)=>s+r.totalPackageMb,0);
        const {tier} = calcPrice(grandTotalMb, tiers);
        const co = companies.find(c=>c.id===cid);
        for (const r of coReqs) {
          const expectedSpeed = r.totalPackageMb * (tier?.ppm||0);
          const expectedTotal = expectedSpeed + r.portCost;
          const diff = Math.abs(expectedTotal - r.total);
          const ok = diff < 0.01;
          const gov = govs.find(g=>g.id===r.govId);
          result.push({r, cy, co, gov, tier, grandTotalMb, expectedSpeed, expectedTotal, ok, diff});
        }
      }
    }
    return result;
  },[requests,companies,govs,cycles,tiers]);

  const errors = rows.filter(x=>!x.ok);

  const fixAll = () => {
    setRequests(prev=>prev.map(r=>{
      if (r.status==="rejected") return r;
      // find grand total for this company/cycle
      const coReqs=prev.filter(x=>x.cycleId===r.cycleId&&x.companyId===r.companyId&&x.status!=="rejected");
      const grandTotalMb=coReqs.reduce((s,x)=>s+x.totalPackageMb,0);
      const {tier}=calcPrice(grandTotalMb,tiers);
      const speedCost=r.totalPackageMb*(tier?.ppm||0);
      const total=speedCost+r.portCost;
      const tierCode=tier?.code||r.tierCode;
      return {...r,speedCost,total,tierCode};
    }));
    flash("All request costs recalculated");
  };

  return (
    <div style={{background:"#0C1222",border:"1px solid "+(errors.length?"#7F1D1D":"#17253D"),borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setOpen(s=>!s)}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>{errors.length?"⚠️":"✅"}</span>
          <div style={{textAlign:"left"}}>
            <div style={{fontWeight:700,fontSize:14}}>Pricing Audit — All Requests</div>
            <div style={{fontSize:11,color:errors.length?"#F87171":"#34D399"}}>
              {errors.length ? errors.length+" pricing discrepanc"+( errors.length===1?"y":"ies")+" found" : "All "+rows.length+" request amounts verified ✓"}
            </div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {errors.length>0 && (
            <button onClick={e=>{e.stopPropagation();fixAll();}}
              style={{background:"#1A6FA8",border:"none",borderRadius:6,color:"#fff",padding:"5px 14px",cursor:"pointer",fontSize:12,fontWeight:600}}>
              ⚡ Fix All
            </button>
          )}
          <span style={{color:"#3A5070",fontSize:18}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open && (
        <div style={{borderTop:"1px solid #17253D",overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#060A14"}}>
                {["Cycle","Company","Gov","Package","Grand Total","Tier","Rate","Expected Cost","Stored Cost","Port Fees","Status"].map(h=>(
                  <th key={h} style={{padding:"7px 10px",textAlign:"left",color:"#3A5070",fontSize:10,
                    fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",borderBottom:"1px solid #17253D",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({r,cy,co,gov,tier,grandTotalMb,expectedSpeed,expectedTotal,ok,diff},i)=>(
                <tr key={i} style={{borderBottom:"1px solid #0F1A2A",background:ok?"transparent":"#1A050520"}}>
                  <td style={{padding:"7px 10px",fontFamily:"'DM Mono'",color:"#94ADC8"}}>{monthLabel(cy.month)}</td>
                  <td style={{padding:"7px 10px",color:"#C9D5E8",fontWeight:ok?400:600}}>{co?.name||"?"}</td>
                  <td style={{padding:"7px 10px"}}><GovBadge>{gov?.name||"?"}</GovBadge></td>
                  <td style={{padding:"7px 10px",fontFamily:"'DM Mono'",color:"#94ADC8"}}>{fmtMb(r.totalPackageMb)}</td>
                  <td style={{padding:"7px 10px",fontFamily:"'DM Mono'",color:"#5BB5F5"}}>{fmtMb(grandTotalMb)}</td>
                  <td style={{padding:"7px 10px",fontFamily:"'DM Mono'",fontWeight:700,color:"#FBBF24"}}>{tier?.code||"?"}</td>
                  <td style={{padding:"7px 10px",fontFamily:"'DM Mono'",color:"#34D399"}}>${tier?.ppm?.toFixed(2)||"?"}</td>
                  <td style={{padding:"7px 10px",fontFamily:"'DM Mono'",color:ok?"#34D399":"#FBBF24",fontWeight:600}}>{fmt(expectedTotal)}</td>
                  <td style={{padding:"7px 10px",fontFamily:"'DM Mono'",color:ok?"#94ADC8":"#F87171"}}>{fmt(r.total)}</td>
                  <td style={{padding:"7px 10px",fontFamily:"'DM Mono'",color:"#3A5070"}}>{r.portCost>0?fmt(r.portCost):"—"}</td>
                  <td style={{padding:"7px 10px"}}>
                    {ok
                      ? <span style={{color:"#34D399",fontSize:11}}>✓ OK</span>
                      : <span style={{color:"#F87171",fontSize:11,fontWeight:700}}>⚠ Δ{fmt(diff)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PRICING  — with tier explanation
// ─────────────────────────────────────────────────────────────────────────────

export default function Pricing({ api, tiers, setTiers, portPrices, setPortPrices, flash, isAdmin, requests, setRequests, companies, govs, cycles }) {
  const [mb,setMb]       = useState(15000);
  const [editTier,setET] = useState(null);
  const [editPP,setEPP]  = useState(false);
  const [td,setTd]       = useState({});
  const [pp,setPp]       = useState({});
  const [sortK,setSK]    = useState("from");
  const [sortD,setSD]    = useState(1);
  const [showExplain,setSE] = useState(false);

  const {cost,tier} = useMemo(()=>calcPrice(mb,tiers),[mb,tiers]);

  // Flat-rate breakdown: just show which tier is active and total x rate
  const breakdown = useMemo(()=>{
    if (mb<=0) return [];
    const sorted=[...tiers].sort((a,b)=>a.from-b.from);
    let matched=sorted[0];
    for (const t of sorted) { if (mb>t.from) matched=t; }
    return [{ code:matched.code, ppm:matched.ppm, subtotal:mb*matched.ppm }];
  },[mb,tiers]);

  const saveTier = () => {
    const d={...td,id:editTier==="new"?uid():td.id,from:Number(td.from),to:Number(td.to),step:Number(td.step),ppm:Number(td.ppm)};
    let newTiers;
    if(editTier==="new") newTiers=[...tiers,d].sort((a,b)=>a.from-b.from);
    else newTiers=tiers.map(t=>t.id===d.id?d:t);
    api.saveTiers(newTiers)
      .then(()=>{ setTiers(newTiers); setET(null); flash("Tier saved"); })
      .catch(e=>flash(e.message,"err"));
  };
  const savePP = () => {
    const prices={first1G:Number(pp.first1G),extra1G:Number(pp.extra1G),port10G:Number(pp.port10G)};
    api.savePortPrices(prices)
      .then(()=>{ setPortPrices(prices); setEPP(false); flash("Port prices updated"); })
      .catch(e=>flash(e.message,"err"));
  };
  const sort = k => { if(sortK===k) setSD(d=>-d); else {setSK(k);setSD(1);} };
  const arr  = k => sortK===k?(sortD===1?" ↑":" ↓"):"";

  const sortedTiers = [...tiers].sort((a,b)=>{ const av=a[sortK],bv=b[sortK]; return av<bv?-sortD:av>bv?sortD:0; });

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>

      {/* ── How Tiers Work explanation ── */}
      <div style={{background:"#0C1222",border:"1px solid #17253D",borderRadius:12,overflow:"hidden"}}>
        <button onClick={()=>setSE(s=>!s)} style={{width:"100%",background:"none",border:"none",cursor:"pointer",
          padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",color:"#C9D5E8"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>📖</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontWeight:700,fontSize:14}}>How the Speed Tier Pricing Works</div>
              <div style={{fontSize:11,color:"#3A5070"}}>Click to {showExplain?"hide":"read"} the full explanation</div>
            </div>
          </div>
          <span style={{color:"#3A5070",fontSize:18}}>{showExplain?"▲":"▼"}</span>
        </button>

        {showExplain && (
          <div style={{padding:"0 20px 20px",borderTop:"1px solid #17253D"}}>
            <div style={{background:"#060A14",borderRadius:10,padding:"16px 18px",marginTop:16,lineHeight:1.8,fontSize:13,color:"#94ADC8"}}>
              <div style={{fontWeight:700,fontSize:14,color:"#D4E3F5",marginBottom:10}}>Cumulative Tier Pricing — Step by Step</div>
              <p style={{marginBottom:12}}>
                The pricing system uses a <b style={{color:"#5BB5F5"}}>flat-rate tier model</b>.
                The total Mbps across <b style={{color:"#5BB5F5"}}>all governorates combined</b> determines which tier the company falls into,
                and the cost is simply <b style={{color:"#FBBF24"}}>total Mbps × that tier's rate</b>.
              </p>

              <div style={{borderLeft:"3px solid #1A6FA8",paddingLeft:14,marginBottom:14}}>
                <div style={{fontWeight:700,color:"#C9D5E8",marginBottom:6}}>Example — Single Governorate</div>
                <ul style={{listStyle:"none",padding:0}}>
                  <li style={{marginBottom:4}}>• Company installs <b style={{color:"#5BB5F5"}}>30,000 Mbps</b> in Aleppo</li>
                  <li style={{marginBottom:4}}>• 30,000 Mbps falls in Tier D (25,000–50,000) → rate = <b style={{color:"#FBBF24"}}>$1.90/Mbps</b></li>
                  <li style={{marginBottom:4}}>• Cost = 30,000 × $1.90 = <b style={{color:"#34D399"}}>$57,000</b></li>
                </ul>
              </div>

              <div style={{borderLeft:"3px solid #1A6FA8",paddingLeft:14,marginBottom:14}}>
                <div style={{fontWeight:700,color:"#C9D5E8",marginBottom:6}}>Example — Multiple Governorates (Combined Pricing)</div>
                <ul style={{listStyle:"none",padding:0}}>
                  <li style={{marginBottom:4}}>• Same company also installs <b style={{color:"#5BB5F5"}}>30,000 Mbps</b> in Idlib</li>
                  <li style={{marginBottom:4}}>• Grand total = 30,000 + 30,000 = <b style={{color:"#5BB5F5"}}>60,000 Mbps</b></li>
                  <li style={{marginBottom:4}}>• 60,000 Mbps falls in Tier C (50,000–75,000) → rate = <b style={{color:"#FBBF24"}}>$1.85/Mbps</b></li>
                  <li style={{marginBottom:4}}>• Total cost = 60,000 × $1.85 = <b style={{color:"#34D399"}}>$111,000</b></li>
                  <li style={{marginBottom:6,color:"#3A5070",fontSize:12}}>Each governorate's request is billed proportionally based on its share of the grand total.</li>
                </ul>
              </div>

              <div style={{borderLeft:"3px solid #34D399",paddingLeft:14,marginBottom:4}}>
                <div style={{fontWeight:700,color:"#C9D5E8",marginBottom:6}}>Key Rules</div>
                <ul style={{listStyle:"none",padding:0}}>
                  <li style={{marginBottom:4}}>✅ Cost = <b style={{color:"#5BB5F5"}}>Total Mbps × Rate of the tier reached</b> (flat, not cumulative).</li>
                  <li style={{marginBottom:4}}>✅ All governorates for a company in the same cycle are <b style={{color:"#5BB5F5"}}>combined</b> to determine the tier.</li>
                  <li style={{marginBottom:4}}>✅ The <b style={{color:"#5BB5F5"}}>Step</b> column is the minimum Mbps increment to move between tiers.</li>
                  <li style={{marginBottom:4}}>✅ Tiers A and A2 have no step — any amount can be ordered.</li>
                </ul>
              </div>
            </div>

            {/* Visual tier ladder */}
            <div style={{marginTop:16}}>
              <div style={{fontSize:11,color:"#3A5070",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px",fontWeight:600}}>Tier Ladder</div>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                {tiers.map((t,i)=>{
                  const width=Math.min(100,Math.max(8,(t.to-t.from)/4000*100));
                  return (
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:26,fontFamily:"'DM Mono'",fontSize:11,fontWeight:700,color:"#FBBF24",flexShrink:0,textAlign:"right"}}>{t.code}</div>
                      <div style={{flex:1,height:22,background:"#060A14",borderRadius:4,overflow:"hidden",border:"1px solid #17253D"}}>
                        <div style={{height:"100%",width:width+"%",
                          background:`linear-gradient(90deg,#1A6FA8,#0B3D6B)`,
                          display:"flex",alignItems:"center",paddingLeft:8,minWidth:80}}>
                          <span style={{fontSize:10,color:"#fff",fontFamily:"'DM Mono'",whiteSpace:"nowrap"}}>
                            {t.from.toLocaleString()} → {t.to.toLocaleString()} Mbps
                          </span>
                        </div>
                      </div>
                      <div style={{width:60,fontFamily:"'DM Mono'",fontSize:11,color:"#34D399",flexShrink:0}}>${t.ppm.toFixed(2)}/Mb</div>
                      {t.step>0&&<div style={{width:70,fontSize:10,color:"#3A5070",flexShrink:0}}>step: {t.step.toLocaleString()}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main grid ── */}
      <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:20}}>
        <div>
          <Card title="Speed Tier Table" headerRight={isAdmin ? (
            <button onClick={()=>{setTd({code:"",from:0,to:0,step:0,ppm:0});setET("new");}}
              style={{background:"none",border:"1px solid #17253D",color:"#5BB5F5",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:11}}>+ Add Tier</button>
          ) : null}>
            <div style={{display:"flex",gap:2,marginBottom:10,flexWrap:"wrap"}}>
              {[["code","Code"],["from","From"],["to","To"],["ppm","$/Mb"]].map(([k,l])=>(
                <button key={k} onClick={()=>sort(k)} style={{background:sortK===k?"#112040":"none",border:"1px solid #17253D",
                  borderRadius:6,padding:"3px 9px",color:sortK===k?"#5BB5F5":"#3A5070",fontSize:10,cursor:"pointer"}}>
                  {l}{arr(k)}
                </button>
              ))}
            </div>
            <DataTable
              cols={["Code","Range","Step","$/Mbps","Min Order",isAdmin?"":""].filter(x=>x!=="")}
              rows={sortedTiers.map(t=>{
                const minOrder = t.step>0 ? t.from+t.step : t.from+1;
                return [
                  <span key="c" style={{fontFamily:"'DM Mono'",fontWeight:700,color:"#FBBF24",fontSize:14}}>{t.code}</span>,
                  <span key="r" style={{fontFamily:"'DM Mono'",fontSize:11,color:"#94ADC8"}}>
                    {t.from.toLocaleString()} → {t.to.toLocaleString()} Mbps
                  </span>,
                  <span key="s" style={{color:"#3A5070",fontSize:12}}>{t.step?t.step.toLocaleString()+" Mbps":"—"}</span>,
                  <span key="p" style={{fontFamily:"'DM Mono'",color:"#34D399",fontWeight:600}}>${t.ppm.toFixed(2)}</span>,
                  <span key="m" style={{fontFamily:"'DM Mono'",fontSize:11,color:"#5BB5F5"}}>
                    {t.step>0?fmtMb(minOrder):"Any"}
                  </span>,
                  isAdmin ? <Row key="a" gap={4}>
                    <IBtn onClick={()=>{setTd({...t});setET(t.id);}}>✏️</IBtn>
                    <IBtn onClick={()=>{ const newT=tiers.filter(x=>x.id!==t.id); api.saveTiers(newT).then(()=>{setTiers(newT);flash("Deleted");}).catch(e=>flash(e.message,"err")); }}>🗑️</IBtn>
                  </Row> : null,
                ].filter(x=>x!==null&&x!=="");
              })}
            />
          </Card>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card title="Port Installation Fees" headerRight={isAdmin ? (
            <button onClick={()=>{setPp({...portPrices});setEPP(true);}}
              style={{background:"none",border:"1px solid #17253D",color:"#5BB5F5",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:11}}>Edit</button>
          ) : null}>
            {[["1G — first in area",portPrices.first1G,"One-time fee for the first 1G port in an area"],
              ["1G — additional",portPrices.extra1G,"Each extra 1G port in the same area"],
              ["10G Port",portPrices.port10G,"Flat fee for any 10G port"]].map(([l,v,hint])=>(
              <div key={l} style={{padding:"10px 0",borderBottom:"1px solid #17253D"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:13}}>{l}</span>
                  <span style={{fontFamily:"'DM Mono'",color:"#5BB5F5",fontWeight:600}}>{fmt(v)}</span>
                </div>
                <div style={{fontSize:11,color:"#3A5070"}}>{hint}</div>
              </div>
            ))}
          </Card>

          {/* Interactive calculator with breakdown */}
          <Card title="Price Calculator">
            <label style={LBL}>Enter Total Speed (Mbps)</label>
            <input type="number" value={mb} min={0} step={100}
              onChange={e=>setMb(Number(e.target.value))}
              style={{...IS,fontFamily:"'DM Mono'",marginBottom:12}}/>
            <div style={{fontSize:11,color:"#3A5070",marginBottom:10}}>{mb.toLocaleString()} Mbps = {(mb/1000).toFixed(2)} Gbps</div>

            {breakdown.length>0 && (
              <div style={{background:"#060A14",borderRadius:8,padding:"10px 12px",marginBottom:10}}>
                <div style={{fontSize:10,color:"#3A5070",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Cost Breakdown by Tier</div>
                {breakdown.map((b,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"5px 0",fontSize:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontFamily:"'DM Mono'",fontWeight:700,color:"#FBBF24",fontSize:11,
                        background:"#2D2006",border:"1px solid #78500A",padding:"1px 5px",borderRadius:3}}>{b.code}</span>
                      <span style={{color:"#3A5070"}}>{mb.toLocaleString()} Mbps × ${b.ppm.toFixed(2)}/Mbps</span>
                    </div>
                    <span style={{fontFamily:"'DM Mono'",color:"#34D399",fontWeight:600}}>{fmt(b.subtotal)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{background:"#112040",border:"1px solid #1A6FA840",borderRadius:8,padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#3A5070",marginBottom:4}}>
                <span>Active Tier</span>
                <span style={{fontFamily:"'DM Mono'",color:"#FBBF24",fontWeight:700,fontSize:14}}>{tier?.code||"—"}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:24,color:"#D4E3F5"}}>
                <span>Total Cost</span>
                <span style={{fontFamily:"'DM Mono'",color:"#5BB5F5"}}>{fmt(cost)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Pricing Audit Table ── */}
      <PricingAudit requests={requests} setRequests={setRequests} companies={companies} govs={govs} cycles={cycles} tiers={tiers} flash={flash}/>

      {editTier && (
        <Modal title={editTier==="new"?"Add Tier":"Edit Tier"} onClose={()=>setET(null)}>
          <FI label="Code"          val={td.code||""} set={v=>setTd(p=>({...p,code:v}))} placeholder="e.g. H, G, F..."/>
          <FI label="From (Mbps)"   val={td.from}     set={v=>setTd(p=>({...p,from:v}))}/>
          <FI label="To (Mbps)"     val={td.to}       set={v=>setTd(p=>({...p,to:v}))}/>
          <FI label="Step (Mbps)"   val={td.step}     set={v=>setTd(p=>({...p,step:v}))} placeholder="Minimum order increment (0 = any)"/>
          <FI label="Price/Mbps $"  val={td.ppm}      set={v=>setTd(p=>({...p,ppm:v}))}/>
          <div style={{background:"#060A14",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#3A5070"}}>
            Flat-rate pricing: this tier's rate applies to the FULL package if grand total falls within this range.
          </div>
          <Row gap={10} mt={4}><Btn onClick={saveTier}>Save</Btn><Btn ghost onClick={()=>setET(null)}>Cancel</Btn></Row>
        </Modal>
      )}
      {editPP && (
        <Modal title="Edit Port Installation Fees" onClose={()=>setEPP(false)}>
          <FI label="1G First Port ($)"      val={pp.first1G} set={v=>setPp(p=>({...p,first1G:v}))} placeholder="150"/>
          <FI label="1G Additional Port ($)" val={pp.extra1G} set={v=>setPp(p=>({...p,extra1G:v}))} placeholder="500"/>
          <FI label="10G Port ($)"           val={pp.port10G} set={v=>setPp(p=>({...p,port10G:v}))} placeholder="1200"/>
          <Row gap={10} mt={4}><Btn onClick={savePP}>Save</Btn><Btn ghost onClick={()=>setEPP(false)}>Cancel</Btn></Row>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  BRANCHES
// ─────────────────────────────────────────────────────────────────────────────
