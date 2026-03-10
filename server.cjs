// ============================================================
//  TELECOMSY Supply Office — REST API Server v5.0
//  + Persistent notifications in DB (all users, excludes sender)
// ============================================================
const express  = require("express");
const cors     = require("cors");
const Database = require("better-sqlite3");
const path     = require("path");

const app  = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, "telecomsy.db");

app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "10mb" }));

// ── SSE clients Map ──────────────────────────────────────────────────────────
const sseClients = new Map(); // String(userId) -> res

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
  const userId = String(req.query.userId || "anon_" + Date.now());
  sseClients.set(userId, res);
  console.log(`SSE connect: user ${userId} (${sseClients.size} online)`);
  res.write(`data: ${JSON.stringify({ type:"connected" })}\n\n`);
  req.on("close", () => {
    sseClients.delete(userId);
    console.log(`SSE disconnect: user ${userId} (${sseClients.size} online)`);
  });
});

// push SSE to one user
function pushToUser(userId, payload) {
  const res = sseClients.get(String(userId));
  if (res) {
    try { res.write(`data: ${JSON.stringify(payload)}\n\n`); }
    catch(e) { sseClients.delete(String(userId)); }
  }
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF");

const SUPERUSER = { id:9999, username:"superadmin", password:"Telecom@2025", role:"superadmin", name:"Super Administrator" };

// ── Schema ───────────────────────────────────────────────────────────────────
function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS govs (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS areas (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      name   TEXT NOT NULL,
      gov_id INTEGER NOT NULL,
      note   TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS companies (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      name    TEXT NOT NULL,
      contact TEXT DEFAULT '',
      phone   TEXT DEFAULT '',
      email   TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS ports (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      area_id    INTEGER NOT NULL,
      type       TEXT NOT NULL,
      port_index INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS cycles (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      month     TEXT NOT NULL UNIQUE,
      status    TEXT NOT NULL DEFAULT 'open',
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opened_by TEXT NOT NULL DEFAULT 'admin'
    );
    CREATE TABLE IF NOT EXISTS requests (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id         INTEGER NOT NULL,
      company_id       INTEGER NOT NULL,
      gov_id           INTEGER NOT NULL,
      month            TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pending',
      port_status      TEXT DEFAULT NULL,
      total_package_mb INTEGER NOT NULL DEFAULT 0,
      speed_cost       REAL NOT NULL DEFAULT 0,
      port_cost        REAL NOT NULL DEFAULT 0,
      total            REAL NOT NULL DEFAULT 0,
      tier_code        TEXT NOT NULL DEFAULT 'H',
      created_at       TEXT NOT NULL,
      notes            TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS request_port_packages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      port_id    INTEGER NOT NULL,
      mb         INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS request_new_ports (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      area_id    INTEGER NOT NULL,
      type       TEXT NOT NULL,
      port_index INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS tiers (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      code    TEXT NOT NULL UNIQUE,
      from_mb INTEGER NOT NULL DEFAULT 0,
      to_mb   INTEGER NOT NULL DEFAULT 0,
      step    INTEGER NOT NULL DEFAULT 0,
      ppm     REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS port_prices (
      id       INTEGER PRIMARY KEY,
      first_1g REAL NOT NULL DEFAULT 150,
      extra_1g REAL NOT NULL DEFAULT 500,
      port_10g REAL NOT NULL DEFAULT 1200
    );
    CREATE TABLE IF NOT EXISTS users (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role     TEXT NOT NULL DEFAULT 'viewer',
      name     TEXT NOT NULL DEFAULT '',
      gov_id   INTEGER
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT NOT NULL,
      msg         TEXT NOT NULL,
      ts          TEXT NOT NULL,
      sender_id   INTEGER,
      read_by     TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS _meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // migrations
  try {
    const cols = db.prepare("PRAGMA table_info(requests)").all().map(c=>c.name);
    if (!cols.includes("port_status")) db.exec("ALTER TABLE requests ADD COLUMN port_status TEXT DEFAULT NULL");
  } catch(_){}
  try {
    const cols = db.prepare("PRAGMA table_info(notifications)").all().map(c=>c.name);
    if (!cols.includes("sender_id")) db.exec("ALTER TABLE notifications ADD COLUMN sender_id INTEGER");
    if (!cols.includes("read_by"))   db.exec("ALTER TABLE notifications ADD COLUMN read_by TEXT NOT NULL DEFAULT '[]'");
  } catch(_){}

  // Remove old demo data
  try {
    const demoNames = ["Al-Furat Networks","Levant ISP","Northern Connect","AAAA","QQQQ"];
    for (const name of demoNames) {
      const co = db.prepare("SELECT id FROM companies WHERE name=?").get(name);
      if (co) {
        db.prepare("DELETE FROM request_port_packages WHERE request_id IN (SELECT id FROM requests WHERE company_id=?)").run(co.id);
        db.prepare("DELETE FROM request_new_ports WHERE request_id IN (SELECT id FROM requests WHERE company_id=?)").run(co.id);
        db.prepare("DELETE FROM requests WHERE company_id=?").run(co.id);
        db.prepare("DELETE FROM ports WHERE company_id=?").run(co.id);
        db.prepare("DELETE FROM companies WHERE id=?").run(co.id);
      }
    }
  } catch(e) { console.warn("Demo cleanup:", e.message); }
}

// ── Notifications helpers ─────────────────────────────────────────────────────
// Save to DB and push SSE to all users EXCEPT sender
function notify(type, msg, senderId = null) {
  const ts  = new Date().toISOString();
  const r   = db.prepare("INSERT INTO notifications (type,msg,ts,sender_id,read_by) VALUES (?,?,?,?,?)").run(type, msg, ts, senderId || null, "[]");
  const notif = { id: r.lastInsertRowid, type, msg, ts, senderId, readBy: [] };
  const payload = JSON.stringify({ ...notif, event:"notification" });

  // Push to ALL currently connected SSE clients except the sender
  let sent = 0;
  for (const [uid, res] of sseClients) {
    if (senderId && String(uid) === String(senderId)) continue;
    try { res.write(`data: ${payload}\n\n`); sent++; }
    catch(e) { sseClients.delete(uid); }
  }
  console.log(`NOTIFY [${type}] → DB saved, pushed to ${sent} online client(s)`);
  return notif;
}

// ── GET /api/notifications — fetch all notifications for a user ──────────────
app.get("/api/notifications", (req, res) => {
  try {
    const userId = Number(req.query.userId);
    const rows = db.prepare("SELECT * FROM notifications ORDER BY ts DESC LIMIT 200").all();
    const result = rows.map(n => ({
      id:       n.id,
      type:     n.type,
      msg:      n.msg,
      ts:       n.ts,
      senderId: n.sender_id,
      read:     JSON.parse(n.read_by || "[]").includes(userId),
    }));
    res.json(result);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ── POST /api/notifications/read — mark all as read for a user ───────────────
app.post("/api/notifications/read", (req, res) => {
  try {
    const { userId } = req.body;
    const rows = db.prepare("SELECT id, read_by FROM notifications").all();
    const upd  = db.prepare("UPDATE notifications SET read_by=? WHERE id=?");
    const tx   = db.transaction(() => {
      for (const r of rows) {
        const rb = JSON.parse(r.read_by || "[]");
        if (!rb.includes(userId)) {
          rb.push(userId);
          upd.run(JSON.stringify(rb), r.id);
        }
      }
    });
    tx();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ── DELETE /api/notifications — clear all (admin only) ───────────────────────
app.delete("/api/notifications", (_req, res) => {
  try {
    db.prepare("DELETE FROM notifications").run();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ── Seed ─────────────────────────────────────────────────────────────────────
function seedIfFirstRun() {
  if (db.prepare("SELECT value FROM _meta WHERE key='seeded'").get()) return;
  console.log("First run — seeding...");
  const today = new Date().toISOString();
  db.exec(`
    INSERT INTO govs (name) VALUES ('Idlib'),('Aleppo'),('Raqqa');
    INSERT INTO tiers (code,from_mb,to_mb,step,ppm) VALUES
      ('H',0,2000,200,2.25),('G',2000,5000,300,2.15),
      ('F',5000,10000,500,2.05),('E',10000,25000,500,1.95),
      ('D',25000,50000,600,1.90),('C',50000,75000,800,1.85),
      ('B',75000,100000,1000,1.80),('A',100000,150000,0,1.75),
      ('A2',150000,400000,0,1.55);
    INSERT INTO port_prices (id,first_1g,extra_1g,port_10g) VALUES (1,150,500,1200);
    INSERT INTO _meta VALUES ('seeded','true');
  `);
  const month = today.slice(0,7);
  db.prepare("INSERT INTO cycles (month,status,opened_at,opened_by) VALUES (?,?,?,?)").run(month,"open",today.slice(0,10),"system");
  console.log("Seed done.");
}

function ensureSuperuser() {
  db.prepare(`
    INSERT INTO users (id,username,password,role,name,gov_id) VALUES (?,?,?,?,?,NULL)
    ON CONFLICT(id) DO UPDATE SET
      username=excluded.username,password=excluded.password,
      role=excluded.role,name=excluded.name,gov_id=NULL
  `).run(SUPERUSER.id,SUPERUSER.username,SUPERUSER.password,SUPERUSER.role,SUPERUSER.name);
}

// ── Request reader ────────────────────────────────────────────────────────────
function readRequest(id) {
  const r = db.prepare(`SELECT id, cycle_id as cycleId, company_id as companyId, gov_id as govId,
    month, status, port_status as portStatus, total_package_mb as totalPackageMb,
    speed_cost as speedCost, port_cost as portCost, total, tier_code as tierCode,
    created_at as createdAt, notes FROM requests WHERE id=?`).get(id);
  if (!r) return null;
  r.portPackages = db.prepare("SELECT port_id as portId, mb FROM request_port_packages WHERE request_id=?").all(id);
  r.newPorts     = db.prepare("SELECT area_id as areaId, type, port_index as portIndex FROM request_new_ports WHERE request_id=?").all(id);
  return r;
}

// ── GET /api/db ───────────────────────────────────────────────────────────────
app.get("/api/db", (_,res) => {
  try {
    const govs      = db.prepare("SELECT * FROM govs ORDER BY id").all();
    const areas     = db.prepare("SELECT id, name, gov_id as govId, note FROM areas ORDER BY id").all();
    const companies = db.prepare("SELECT * FROM companies ORDER BY id").all();
    const ports     = db.prepare("SELECT id, company_id as companyId, area_id as areaId, type, port_index as portIndex FROM ports ORDER BY id").all();
    const cycles    = db.prepare("SELECT id, month, status, opened_at as openedAt, closed_at as closedAt, opened_by as openedBy FROM cycles ORDER BY month").all();
    const reqRows   = db.prepare(`SELECT id, cycle_id as cycleId, company_id as companyId, gov_id as govId,
      month, status, port_status as portStatus, total_package_mb as totalPackageMb,
      speed_cost as speedCost, port_cost as portCost, total, tier_code as tierCode,
      created_at as createdAt, notes FROM requests ORDER BY created_at DESC`).all();
    const pkgs = db.prepare("SELECT request_id, port_id as portId, mb FROM request_port_packages").all();
    const nps  = db.prepare("SELECT request_id, area_id as areaId, type, port_index as portIndex FROM request_new_ports").all();
    const requests = reqRows.map(r=>({...r,
      portPackages: pkgs.filter(p=>p.request_id===r.id).map(p=>({portId:p.portId,mb:p.mb})),
      newPorts:     nps.filter(p=>p.request_id===r.id).map(p=>({areaId:p.areaId,type:p.type,portIndex:p.portIndex})),
    }));
    const tiers      = db.prepare("SELECT id, code, from_mb as 'from', to_mb as 'to', step, ppm FROM tiers ORDER BY from_mb").all();
    const portPrices = db.prepare("SELECT first_1g as first1G, extra_1g as extra1G, port_10g as port10G FROM port_prices LIMIT 1").get()||{first1G:150,extra1G:500,port10G:1200};
    const users      = db.prepare("SELECT id, username, password, role, name, gov_id as govId FROM users ORDER BY id").all();
    res.json({ govs, areas, companies, ports, cycles, requests, tiers, portPrices, users });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ── GOVS ──────────────────────────────────────────────────────────────────────
app.post("/api/govs",       (req,res) => { try { const {name}=req.body; const r=db.prepare("INSERT INTO govs (name) VALUES (?)").run(name); res.json({id:r.lastInsertRowid,name}); } catch(e){res.status(400).json({error:e.message});}});
app.put("/api/govs/:id",    (req,res) => { try { db.prepare("UPDATE govs SET name=? WHERE id=?").run(req.body.name,req.params.id); res.json({ok:true}); } catch(e){res.status(400).json({error:e.message});}});
app.delete("/api/govs/:id", (req,res) => { try { const id=Number(req.params.id); const r=db.prepare("DELETE FROM govs WHERE id=?").run(id); if(!r.changes) return res.status(404).json({error:"Not found"}); res.json({ok:true,deleted:id}); } catch(e){res.status(400).json({error:e.message});}});

// ── AREAS ─────────────────────────────────────────────────────────────────────
app.post("/api/areas",       (req,res) => { try { const {name,govId,note}=req.body; const r=db.prepare("INSERT INTO areas (name,gov_id,note) VALUES (?,?,?)").run(name,govId,note||""); res.json({id:r.lastInsertRowid,name,govId,note:note||""}); } catch(e){res.status(400).json({error:e.message});}});
app.put("/api/areas/:id",    (req,res) => { try { const {name,govId,note}=req.body; db.prepare("UPDATE areas SET name=?,gov_id=?,note=? WHERE id=?").run(name,govId,note||"",req.params.id); res.json({ok:true}); } catch(e){res.status(400).json({error:e.message});}});
app.delete("/api/areas/:id", (req,res) => { try { const id=Number(req.params.id); const r=db.prepare("DELETE FROM areas WHERE id=?").run(id); if(!r.changes) return res.status(404).json({error:"Not found"}); res.json({ok:true,deleted:id}); } catch(e){res.status(400).json({error:e.message});}});

// ── COMPANIES ─────────────────────────────────────────────────────────────────
app.post("/api/companies",       (req,res) => { try { const {name,contact,phone,email}=req.body; const r=db.prepare("INSERT INTO companies (name,contact,phone,email) VALUES (?,?,?,?)").run(name,contact||"",phone||"",email||""); res.json({id:r.lastInsertRowid,name,contact:contact||"",phone:phone||"",email:email||""}); } catch(e){res.status(400).json({error:e.message});}});
app.put("/api/companies/:id",    (req,res) => { try { const {name,contact,phone,email}=req.body; db.prepare("UPDATE companies SET name=?,contact=?,phone=?,email=? WHERE id=?").run(name,contact||"",phone||"",email||"",req.params.id); res.json({ok:true}); } catch(e){res.status(400).json({error:e.message});}});
app.delete("/api/companies/:id", (req,res) => { try { const id=Number(req.params.id); db.prepare("DELETE FROM ports WHERE company_id=?").run(id); const r=db.prepare("DELETE FROM companies WHERE id=?").run(id); if(!r.changes) return res.status(404).json({error:"Not found"}); res.json({ok:true,deleted:id}); } catch(e){res.status(400).json({error:e.message});}});

// ── PORTS ─────────────────────────────────────────────────────────────────────
app.post("/api/ports",       (req,res) => { try { const {companyId,areaId,type}=req.body; const ex=db.prepare("SELECT COUNT(*) as n FROM ports WHERE company_id=? AND area_id=?").get(companyId,areaId).n; const r=db.prepare("INSERT INTO ports (company_id,area_id,type,port_index) VALUES (?,?,?,?)").run(companyId,areaId,type,ex+1); res.json({id:r.lastInsertRowid,companyId,areaId,type,portIndex:ex+1}); } catch(e){res.status(400).json({error:e.message});}});
app.put("/api/ports/:id",    (req,res) => { try { const {companyId,areaId,type,portIndex}=req.body; db.prepare("UPDATE ports SET company_id=?,area_id=?,type=?,port_index=? WHERE id=?").run(companyId,areaId,type,portIndex,req.params.id); res.json({ok:true}); } catch(e){res.status(400).json({error:e.message});}});
app.delete("/api/ports/:id", (req,res) => { try { const id=Number(req.params.id); const r=db.prepare("DELETE FROM ports WHERE id=?").run(id); if(!r.changes) return res.status(404).json({error:"Not found"}); res.json({ok:true,deleted:id}); } catch(e){res.status(400).json({error:e.message});}});

// ── CYCLES ────────────────────────────────────────────────────────────────────
app.post("/api/cycles", (req,res) => {
  try {
    const {month,status,openedAt,openedBy,_userId}=req.body;
    const r=db.prepare("INSERT INTO cycles (month,status,opened_at,opened_by) VALUES (?,?,?,?)").run(month,status||"open",openedAt,openedBy||"admin");
    const cy={id:r.lastInsertRowid,month,status:status||"open",openedAt,closedAt:null,openedBy:openedBy||"admin"};
    notify("cycle_opened",`📅 Cycle ${month} has been OPENED by ${openedBy||"admin"}`, _userId||null);
    res.json(cy);
  } catch(e){res.status(400).json({error:e.message});}
});
app.put("/api/cycles/:id", (req,res) => {
  try {
    const {status,closedAt,openedAt,_userId}=req.body;
    const old=db.prepare("SELECT * FROM cycles WHERE id=?").get(req.params.id);
    db.prepare("UPDATE cycles SET status=?,closed_at=?,opened_at=? WHERE id=?").run(status,closedAt||null,openedAt||null,req.params.id);
    if(old && old.status!==status) {
      if(status==="closed")  notify("cycle_closed",   `🔴 Cycle ${old.month} has been CLOSED`, _userId||null);
      if(status==="open")    notify("cycle_reopened",  `🟢 Cycle ${old.month} has been RE-OPENED`, _userId||null);
    }
    res.json({ok:true});
  } catch(e){res.status(400).json({error:e.message});}
});
app.delete("/api/cycles/:id", (req,res) => { try { const id=Number(req.params.id); const r=db.prepare("DELETE FROM cycles WHERE id=?").run(id); if(!r.changes) return res.status(404).json({error:"Not found"}); res.json({ok:true,deleted:id}); } catch(e){res.status(400).json({error:e.message});}});

// ── Pricing helpers ───────────────────────────────────────────────────────────
function findTier(tiers, grandMb) {
  let matched = tiers[0];
  for (const t of tiers) { if (grandMb > t.from) matched = t; }
  return matched;
}
function repriceCompany(cycleId, companyId) {
  const tiers = db.prepare("SELECT id, code, from_mb as 'from', to_mb as 'to', ppm FROM tiers ORDER BY from_mb").all();
  const reqs  = db.prepare("SELECT id, total_package_mb, port_cost FROM requests WHERE cycle_id=? AND company_id=? AND status!='rejected' AND total_package_mb>0").all(cycleId, companyId);
  const grandMb  = reqs.reduce((s,r)=>s+r.total_package_mb, 0);
  const matched  = findTier(tiers, grandMb);
  const ppm      = matched ? matched.ppm : 0;
  const tierCode = matched ? matched.code : "H";
  const update   = db.prepare("UPDATE requests SET speed_cost=?, total=?, tier_code=? WHERE id=?");
  for (const r of reqs) { const sc=r.total_package_mb*ppm; update.run(sc, sc+(r.port_cost||0), tierCode, r.id); }
  return { ppm, tierCode, grandMb };
}

// ── REQUESTS ──────────────────────────────────────────────────────────────────
app.post("/api/requests", (req,res) => {
  try {
    const {cycleId,companyId,govId,month,totalPackageMb,speedCost,portCost,total,tierCode,notes,portPackages,newPorts,_userId}=req.body;
    const today=new Date().toISOString().slice(0,10);
    let newId;
    const tx=db.transaction(()=>{
      const r=db.prepare(`INSERT INTO requests (cycle_id,company_id,gov_id,month,status,total_package_mb,speed_cost,port_cost,total,tier_code,created_at,notes) VALUES (?,?,?,?,'pending',?,?,?,?,?,?,?)`)
        .run(cycleId,companyId,govId,month,totalPackageMb||0,speedCost||0,portCost||0,total||0,tierCode||"H",today,notes||"");
      newId=r.lastInsertRowid;
      for(const pp of (portPackages||[])) db.prepare("INSERT INTO request_port_packages (request_id,port_id,mb) VALUES (?,?,?)").run(newId,pp.portId,pp.mb);
      for(const np of (newPorts||[])) {
        const ex=db.prepare("SELECT COUNT(*) as n FROM ports WHERE company_id=? AND area_id=?").get(companyId,np.areaId).n;
        db.prepare("INSERT INTO request_new_ports (request_id,area_id,type,port_index) VALUES (?,?,?,?)").run(newId,np.areaId,np.type,ex+1);
      }
      if ((totalPackageMb||0)>0) repriceCompany(cycleId, companyId);
    });
    tx();
    const co  = db.prepare("SELECT name FROM companies WHERE id=?").get(companyId);
    const gov = db.prepare("SELECT name FROM govs WHERE id=?").get(govId);
    const sender = _userId || null;
    if ((totalPackageMb||0)>0) {
      notify("new_request", `📋 New request: ${co?.name||"?"} — ${gov?.name||"?"} (${((totalPackageMb||0)/1000).toFixed(1)} Gbps)`, sender);
    } else if ((newPorts||[]).length>0) {
      notify("port_request", `🔌 Port opening request: ${co?.name||"?"} — ${gov?.name||"?"}`, sender);
    }
    res.json(readRequest(newId));
  } catch(e){res.status(400).json({error:e.message});}
});

app.put("/api/requests/:id/status", (req,res) => {
  try {
    const {status,_userId}=req.body;
    const id=Number(req.params.id);
    db.prepare("UPDATE requests SET status=? WHERE id=?").run(status,id);
    const r=db.prepare("SELECT cycle_id,company_id,total_package_mb,gov_id FROM requests WHERE id=?").get(id);
    if(r && r.total_package_mb>0) repriceCompany(r.cycle_id, r.company_id);
    const co  = db.prepare("SELECT name FROM companies WHERE id=?").get(r?.company_id);
    const gov = db.prepare("SELECT name FROM govs WHERE id=?").get(r?.gov_id);
    const sender = _userId || null;
    if(status==="approved") notify("request_approved", `✅ Request #${id} APPROVED — ${co?.name||"?"} (${gov?.name||"?"})`, sender);
    if(status==="rejected") notify("request_rejected", `❌ Request #${id} REJECTED — ${co?.name||"?"} (${gov?.name||"?"})`, sender);
    res.json(readRequest(id));
  } catch(e){res.status(400).json({error:e.message});}
});

app.put("/api/requests/:id/port-status", (req,res) => {
  try {
    const {portStatus,skipPortCreation,_userId}=req.body;
    const reqId=Number(req.params.id);
    const r=db.prepare("SELECT * FROM requests WHERE id=?").get(reqId);
    if(!r) return res.status(404).json({error:"Not found"});
    if(r.port_status==="approved") return res.json({request:readRequest(reqId),newPorts:[]});
    const tx=db.transaction(()=>{
      let newPorts=[]; let portCost=r.port_cost||0;
      if(portStatus==="approved"){
        const pp=db.prepare("SELECT first_1g,extra_1g,port_10g FROM port_prices LIMIT 1").get()||{first_1g:150,extra_1g:500,port_10g:1200};
        const npRows=db.prepare("SELECT area_id,type FROM request_new_ports WHERE request_id=?").all(reqId);
        if(!skipPortCreation && npRows.length>0){
          portCost=0;
          for(const np of npRows){
            const ex=db.prepare("SELECT COUNT(*) as n FROM ports WHERE company_id=? AND area_id=?").get(r.company_id,np.area_id).n;
            const ins=db.prepare("INSERT INTO ports (company_id,area_id,type,port_index) VALUES (?,?,?,?)").run(r.company_id,np.area_id,np.type,ex+1);
            newPorts.push({id:ins.lastInsertRowid,companyId:r.company_id,areaId:np.area_id,type:np.type,portIndex:ex+1});
            portCost+=np.type==="10G"?pp.port_10g:ex===0?pp.first_1g:pp.extra_1g;
          }
        }
        const finalPortCost=portCost||r.port_cost||0;
        db.prepare("UPDATE requests SET port_status='approved',port_cost=?,total=? WHERE id=?").run(finalPortCost,r.speed_cost+finalPortCost,reqId);
      } else {
        db.prepare("UPDATE requests SET port_status='rejected' WHERE id=?").run(reqId);
      }
      return newPorts;
    });
    const newPorts=tx();
    const co  = db.prepare("SELECT name FROM companies WHERE id=?").get(r.company_id);
    const gov = db.prepare("SELECT name FROM govs WHERE id=?").get(r.gov_id);
    const sender = _userId || null;
    if(portStatus==="approved") notify("port_approved", `🔌 Port #${reqId} APPROVED — ${co?.name||"?"} (${gov?.name||"?"})`, sender);
    if(portStatus==="rejected") notify("port_rejected", `❌ Port #${reqId} REJECTED — ${co?.name||"?"}`, sender);
    res.json({request:readRequest(reqId),newPorts});
  } catch(e){res.status(400).json({error:e.message});}
});

app.post("/api/requests/reprice", (req,res) => {
  try {
    const {cycleId,companyId,_userId}=req.body;
    if(!cycleId||!companyId) return res.status(400).json({error:"cycleId and companyId required"});
    const result=repriceCompany(cycleId,companyId);
    const updated=db.prepare("SELECT id,speed_cost as speedCost,total,tier_code as tierCode FROM requests WHERE cycle_id=? AND company_id=? AND status!='rejected' AND total_package_mb>0").all(cycleId,companyId);
    const co=db.prepare("SELECT name FROM companies WHERE id=?").get(companyId);
    notify("repriced", `🔄 Pricing updated — ${co?.name||"?"} → Tier ${result.tierCode}`, _userId||null);
    res.json({ok:true,...result,updated});
  } catch(e){res.status(500).json({error:e.message});}
});

app.post("/api/requests/reprice-all", (req,res) => {
  try {
    const {cycleId}=req.body;
    if(!cycleId) return res.status(400).json({error:"cycleId required"});
    const companies=db.prepare("SELECT DISTINCT company_id FROM requests WHERE cycle_id=? AND status!='rejected' AND total_package_mb>0").all(cycleId);
    const results=[];
    for(const c of companies){ const r=repriceCompany(cycleId,c.company_id); results.push({companyId:c.company_id,...r}); }
    const updated=db.prepare("SELECT id,company_id as companyId,speed_cost as speedCost,total,tier_code as tierCode FROM requests WHERE cycle_id=? AND status!='rejected' AND total_package_mb>0").all(cycleId);
    res.json({ok:true,results,updated});
  } catch(e){res.status(500).json({error:e.message});}
});

app.put("/api/requests/:id", (req,res) => {
  try {
    const id=Number(req.params.id);
    const {totalPackageMb,speedCost,portCost,total,tierCode,notes,portPackages,newPorts,_userId}=req.body;
    const existing = db.prepare("SELECT company_id, gov_id FROM requests WHERE id=?").get(id);
    const tx=db.transaction(()=>{
      db.prepare("UPDATE requests SET total_package_mb=?,speed_cost=?,port_cost=?,total=?,tier_code=?,notes=? WHERE id=?").run(totalPackageMb||0,speedCost||0,portCost||0,total||0,tierCode||"H",notes||"",id);
      db.prepare("DELETE FROM request_port_packages WHERE request_id=?").run(id);
      for(const pp of (portPackages||[])) db.prepare("INSERT INTO request_port_packages (request_id,port_id,mb) VALUES (?,?,?)").run(id,pp.portId,pp.mb);
      db.prepare("DELETE FROM request_new_ports WHERE request_id=?").run(id);
      for(const np of (newPorts||[])) db.prepare("INSERT INTO request_new_ports (request_id,area_id,type,port_index) VALUES (?,?,?,?)").run(id,np.areaId,np.type,np.portIndex||1);
    });
    tx();
    if (existing) {
      const co  = db.prepare("SELECT name FROM companies WHERE id=?").get(existing.company_id);
      const gov = db.prepare("SELECT name FROM govs WHERE id=?").get(existing.gov_id);
      notify("request_edited", `✏️ Request #${id} EDITED — ${co?.name||"?"} (${gov?.name||"?"})`, _userId||null);
    }
    res.json(readRequest(id));
  } catch(e){res.status(400).json({error:e.message});}
});

app.delete("/api/requests/:id", (req,res) => {
  try {
    const id=Number(req.params.id);
    const _userId = req.query._userId ? Number(req.query._userId) : null;
    const existing = db.prepare("SELECT company_id, gov_id, total_package_mb FROM requests WHERE id=?").get(id);
    db.prepare("DELETE FROM request_port_packages WHERE request_id=?").run(id);
    db.prepare("DELETE FROM request_new_ports WHERE request_id=?").run(id);
    const r=db.prepare("DELETE FROM requests WHERE id=?").run(id);
    if(!r.changes) return res.status(404).json({error:"Not found"});
    if (existing) {
      const co  = db.prepare("SELECT name FROM companies WHERE id=?").get(existing.company_id);
      const gov = db.prepare("SELECT name FROM govs WHERE id=?").get(existing.gov_id);
      notify("request_deleted", `🗑️ Request #${id} DELETED — ${co?.name||"?"} (${gov?.name||"?"})`, _userId);
    }
    res.json({ok:true,deleted:id});
  } catch(e){res.status(400).json({error:e.message});}
});

// ── TIERS & PORT PRICES ───────────────────────────────────────────────────────
app.put("/api/tiers", (req,res) => {
  try {
    const tiers=req.body;
    const tx=db.transaction(()=>{ db.prepare("DELETE FROM tiers").run(); for(const t of tiers) db.prepare("INSERT INTO tiers (code,from_mb,to_mb,step,ppm) VALUES (?,?,?,?,?)").run(t.code,t.from,t.to,t.step,t.ppm); });
    tx(); res.json({ok:true});
  } catch(e){res.status(400).json({error:e.message});}
});
app.put("/api/port-prices", (req,res) => {
  try { const {first1G,extra1G,port10G}=req.body; db.prepare("INSERT OR REPLACE INTO port_prices (id,first_1g,extra_1g,port_10g) VALUES (1,?,?,?)").run(first1G,extra1G,port10G); res.json({ok:true}); }
  catch(e){res.status(400).json({error:e.message});}
});

// ── USERS ─────────────────────────────────────────────────────────────────────
app.post("/api/users",       (req,res) => { try { const {username,password,role,name,govId}=req.body; const r=db.prepare("INSERT INTO users (username,password,role,name,gov_id) VALUES (?,?,?,?,?)").run(username,password,role||"viewer",name,govId||null); res.json({id:r.lastInsertRowid,username,password,role:role||"viewer",name,govId:govId||null}); } catch(e){res.status(400).json({error:e.message});}});
app.put("/api/users/:id",    (req,res) => { try { if(Number(req.params.id)===9999) return res.status(403).json({error:"Cannot modify superadmin"}); const {username,password,role,name,govId}=req.body; db.prepare("UPDATE users SET username=?,password=?,role=?,name=?,gov_id=? WHERE id=?").run(username,password,role,name,govId||null,req.params.id); res.json({ok:true}); } catch(e){res.status(400).json({error:e.message});}});
app.delete("/api/users/:id", (req,res) => { try { const id=Number(req.params.id); if(id===9999) return res.status(403).json({error:"Cannot delete superadmin"}); const r=db.prepare("DELETE FROM users WHERE id=?").run(id); if(!r.changes) return res.status(404).json({error:"Not found"}); res.json({ok:true,deleted:id}); } catch(e){res.status(400).json({error:e.message});}});

// ── RESET ─────────────────────────────────────────────────────────────────────
app.post("/api/reset", (_,res) => {
  try {
    db.exec(`DELETE FROM request_new_ports; DELETE FROM request_port_packages; DELETE FROM requests;
      DELETE FROM ports; DELETE FROM cycles; DELETE FROM areas; DELETE FROM companies;
      DELETE FROM govs; DELETE FROM tiers; DELETE FROM port_prices;
      DELETE FROM users WHERE id!=9999; DELETE FROM notifications; DELETE FROM _meta;`);
    seedIfFirstRun(); ensureSuperuser(); res.json({ok:true});
  } catch(e){res.status(500).json({error:e.message});}
});

app.post("/api/db/sync", (req,res) => {
  try {
    const {ports=[],areas=[],companies=[],govs=[]} = req.body;
    const tx=db.transaction(()=>{
      if(govs.length>0||req.body._clearGovs){ db.prepare("DELETE FROM govs").run(); for(const g of govs) db.prepare("INSERT INTO govs (id,name) VALUES (?,?)").run(g.id,g.name); }
      if(areas.length>0||req.body._clearAreas){ db.prepare("DELETE FROM areas").run(); for(const a of areas) db.prepare("INSERT INTO areas (id,name,gov_id,note) VALUES (?,?,?,?)").run(a.id,a.name,a.govId,a.note||""); }
      if(companies.length>0||req.body._clearCompanies){ db.prepare("DELETE FROM ports").run(); db.prepare("DELETE FROM companies").run(); for(const c of companies) db.prepare("INSERT INTO companies (id,name,contact,phone,email) VALUES (?,?,?,?,?)").run(c.id,c.name,c.contact||"",c.phone||"",c.email||""); for(const p of ports) db.prepare("INSERT INTO ports (id,company_id,area_id,type,port_index) VALUES (?,?,?,?,?)").run(p.id,p.companyId,p.areaId,p.type,p.portIndex); }
    });
    tx(); res.json({ok:true});
  } catch(e){res.status(500).json({error:e.message});}
});

app.get("/api/health", (_,res) => {
  const counts={};
  for(const t of ["govs","companies","ports","requests","users","cycles","notifications"])
    counts[t]=db.prepare("SELECT COUNT(*) as n FROM "+t).get().n;
  res.json({ok:true, version:"5.0.0", counts});
});

// ── Serve frontend (production) ─────────────────────────────────────────────
const fs   = require("fs");
// Try multiple possible dist locations
const distPath = [
  path.join(__dirname, "dist"),
  path.join(process.cwd(), "dist"),
  "/app/dist"
].find(p => fs.existsSync(p));

if (distPath) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({error:"Not found"});
    res.sendFile(path.join(distPath, "index.html"));
  });
  console.log("Serving frontend from: " + distPath);
} else {
  console.warn("WARNING: dist folder not found! Run npm run build first.");
  app.get("/", (req, res) => res.send("TELECOMSY API running. Frontend not built."));
}

// ── Boot ──────────────────────────────────────────────────────────────────────
createTables();
seedIfFirstRun();
ensureSuperuser();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\nTELECOMSY API v5.0 → http://0.0.0.0:${PORT}`);
  console.log(`DB: ${DB_PATH}`);
  console.log(`Superadmin: ${SUPERUSER.username} / ${SUPERUSER.password}`);
  console.log(`Notifications: persistent DB + SSE push\n`);
});
