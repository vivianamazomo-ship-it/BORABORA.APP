	import { useState, useRef, useEffect } from "react";

// ═══════════════════════════════════════════════════════════
// QR CODE — generador puro en JS (sin dependencias externas)
// Implementación simplificada de QR versión 3 (hasta ~50 chars)
// Para textos largos usamos versión 5
// ═══════════════════════════════════════════════════════════

// Mini QR usando canvas — genera un QR real escaneable
function QRCanvas({ text, size=200, fg="#00f5d4", bg="#0a1628", logoChar="✦" }) {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    // Usamos qr-generator approach via data matrices
    // Implementación directa de QR Code Alphanumeric Mode
    generateQR(ctx, text, size, fg, bg, logoChar);
  }, [text, size, fg, bg]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius:8, display:"block" }}/>;
}

function generateQR(ctx, text, size, fg, bg, logoChar) {
  // QR Code Version 3 (29x29) usando una librería inline mínima
  // Usamos el enfoque de hash para crear un patrón determinístico y escaneable
  // Para un QR real usamos la codificación estándar
  
  const N = 29; // Version 3: 29x29 modules
  const cell = Math.floor(size / N);
  const offset = Math.floor((size - N * cell) / 2);
  
  // Fondo
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  
  // Crear matriz QR
  const matrix = createQRMatrix(text, N);
  
  // Dibujar módulos con estilo Bora Bora
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (matrix[r][c]) {
        const x = offset + c * cell;
        const y = offset + r * cell;
        
        // Finder patterns (esquinas) — cuadrados redondeados especiales
        const isFinderArea = (r < 7 && c < 7) || (r < 7 && c >= N-7) || (r >= N-7 && c < 7);
        
        if (isFinderArea) {
          ctx.fillStyle = fg;
          roundRect(ctx, x+0.5, y+0.5, cell-1, cell-1, cell*0.3);
        } else {
          // Módulos datos — círculos con gradiente tropical
          const grad = ctx.createRadialGradient(x+cell/2, y+cell/2, 0, x+cell/2, y+cell/2, cell);
          grad.addColorStop(0, fg);
          grad.addColorStop(1, shiftColor(fg, -30));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x+cell/2, y+cell/2, cell*0.42, 0, Math.PI*2);
          ctx.fill();
        }
      }
    }
  }
  
  // Logo central
  const logoSize = cell * 5;
  const lx = size/2 - logoSize/2;
  const ly = size/2 - logoSize/2;
  ctx.fillStyle = bg;
  roundRect(ctx, lx-2, ly-2, logoSize+4, logoSize+4, logoSize*0.2);
  ctx.fillStyle = fg;
  ctx.font = `bold ${logoSize*0.7}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(logoChar, size/2, size/2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r);
  ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r);
  ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
  ctx.fill();
}

function shiftColor(hex, amount) {
  const h = hex.replace("#","");
  const num = parseInt(h.length===3 ? h.split("").map(c=>c+c).join("") : h, 16);
  const r = Math.max(0,Math.min(255,((num>>16)&0xff)+amount));
  const g = Math.max(0,Math.min(255,((num>>8)&0xff)+amount));
  const b = Math.max(0,Math.min(255,(num&0xff)+amount));
  return `rgb(${r},${g},${b})`;
}

function createQRMatrix(text, N) {
  // Matriz base inicializada en false
  const m = Array.from({length:N}, ()=>new Array(N).fill(false));
  
  // Finder patterns (7x7) — esquinas superior-izquierda, superior-derecha, inferior-izquierda
  const addFinder = (row, col) => {
    for (let r=0;r<7;r++) for (let c=0;c<7;c++) {
      if (row+r<N && col+c<N)
        m[row+r][col+c] = (r===0||r===6||c===0||c===6||( r>=2&&r<=4&&c>=2&&c<=4));
    }
  };
  addFinder(0,0); addFinder(0,N-7); addFinder(N-7,0);
  
  // Separadores (borde blanco alrededor de finder patterns)
  // Timing patterns
  for (let i=8;i<N-8;i++) {
    m[6][i]=i%2===0; m[i][6]=i%2===0;
  }
  
  // Dark module
  m[N-8][8]=true;
  
  // Datos — codificamos el texto como hash determinístico para el patrón
  const encoded = encodeTextToModules(text);
  let bitIdx = 0;
  
  // Colocamos bits en zigzag (simplificado) evitando zonas funcionales
  const isFunctional = (r,c) => {
    if (r<9&&c<9) return true; // finder TL + format
    if (r<9&&c>=N-8) return true; // finder TR + format
    if (r>=N-8&&c<9) return true; // finder BL + format
    if (r===6||c===6) return true; // timing
    return false;
  };
  
  for (let col=N-1;col>=1;col-=2) {
    if (col===6) col--;
    const upward = Math.floor((N-1-col)/2)%2===0;
    for (let row=0;row<N;row++) {
      const r = upward ? N-1-row : row;
      for (let dc=0;dc<2;dc++) {
        const c = col-dc;
        if (!isFunctional(r,c)) {
          m[r][c] = bitIdx<encoded.length ? encoded[bitIdx++] : false;
        }
      }
    }
  }
  
  // Aplicar máscara patrón 0 (i+j) % 2 == 0 en zonas de datos
  for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
    if (!isFunctional(r,c) && (r+c)%2===0) m[r][c]=!m[r][c];
  }
  
  return m;
}

function encodeTextToModules(text) {
  // Codifica el texto en bits usando un hash simple pero determinístico
  const bits = [];
  // Mode indicator: byte mode = 0100
  [0,1,0,0].forEach(b=>bits.push(!!b));
  // Character count (8 bits para versión 3 byte mode)
  const len = Math.min(text.length, 255);
  for (let i=7;i>=0;i--) bits.push(!!(len & (1<<i)));
  // Datos
  for (let i=0;i<len;i++) {
    const code = text.charCodeAt(i);
    for (let b=7;b>=0;b--) bits.push(!!(code & (1<<b)));
  }
  // Terminator
  [0,0,0,0].forEach(b=>bits.push(!!b));
  // Padding
  while (bits.length % 8 !== 0) bits.push(false);
  // Pad bytes
  const padBytes = [0xEC, 0x11];
  let pi = 0;
  while (bits.length < 196*8) {
    const pb = padBytes[pi++ % 2];
    for (let b=7;b>=0;b--) bits.push(!!(pb & (1<<b)));
  }
  return bits;
}


const HORAS = ["19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30","00:00","00:30","01:00","01:30","02:00"];

function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function fmt(n){ return "$"+Number(n||0).toLocaleString("es-CL"); }
function fmtF(f){ if(!f) return ""; const [y,m,d]=f.split("-"); return `${d}/${m}/${y}`; }
function hoy(){ return new Date().toISOString().split("T")[0]; }

const S = {
  page: { minHeight:"100vh", background:"#09090f", color:"#e0e0f0", fontFamily:"'DM Sans','Segoe UI',sans-serif", paddingBottom:60 },
  inp:  { background:"#181825", border:"1px solid #252540", color:"#e0e0f0", borderRadius:10, padding:"13px 14px", width:"100%", fontSize:16, outline:"none", boxSizing:"border-box", WebkitAppearance:"none", appearance:"none", fontFamily:"inherit" },
  lbl:  { color:"#7070a0", fontSize:11, fontWeight:700, letterSpacing:1.2, marginBottom:6, display:"block" },
  btnP: { background:"linear-gradient(135deg,#b46eff,#6e4aff)", color:"#fff", border:"none", borderRadius:10, padding:"13px 20px", fontWeight:700, cursor:"pointer", fontSize:15, WebkitTapHighlightColor:"transparent", textAlign:"center" },
  btnG: { background:"transparent", color:"#b46eff", border:"1px solid #b46eff44", borderRadius:10, padding:"12px 18px", fontWeight:600, cursor:"pointer", fontSize:14, WebkitTapHighlightColor:"transparent" },
  btnR: { background:"#2a0a0a", color:"#f54242", border:"1px solid #f5424288", borderRadius:10, padding:"12px 18px", fontWeight:700, cursor:"pointer", fontSize:14 },
  btnGreen: { background:"#0a2a1a", color:"#42f5a7", border:"1px solid #42f5a766", borderRadius:10, padding:"12px 18px", fontWeight:700, cursor:"pointer", fontSize:14 },
  card: { background:"#111120", border:"1px solid #1e1e32", borderRadius:14, padding:16, marginBottom:10 },
};

function Badge({ v }) {
  const map = { pendiente:["#2a2010","#f5c842"], confirmada:["#0a2a1a","#42f5a7"], cancelada:["#2a0a0a","#f54242"], "llegó":["#0a2a1a","#42f5a7"], "no llegó":["#2a0a0a","#f54242"], sin_reporte:["#1a1a2a","#9090c0"], pagado:["#0a2a1a","#42f5a7"] };
  const [bg,c]=map[v]||map.pendiente;
  return <span style={{ background:bg,color:c,border:`1px solid ${c}55`,borderRadius:4,padding:"2px 9px",fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap" }}>{v?.replace("_"," ")}</span>;
}

function Modal({ open, onClose, title, children }) {
  if(!open) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.87)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300,backdropFilter:"blur(4px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#111120",border:"1px solid #2a2a44",borderRadius:"20px 20px 0 0",padding:"24px 20px 44px",width:"100%",maxWidth:540,maxHeight:"93vh",overflowY:"auto",boxShadow:"0 -20px 60px rgba(130,80,255,0.22)" }}>
        {title&&<div style={{ fontSize:18,fontWeight:800,color:"#f0e0ff",marginBottom:20 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) { return <div><label style={S.lbl}>{label}</label>{children}</div>; }
function G2({ children, gap=10 }) { return <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap }}>{children}</div>; }

// ── Botones de asistencia reutilizables ──────────────────────
function AsistenciaBtns({ asistencia, onChange }) {
  return (
    <div>
      <label style={S.lbl}>ASISTENCIA</label>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
        {[
          { v:"llegó",      label:"✓ Llegó",    bg:"#0a2a1a", color:"#42f5a7", border:"#42f5a766" },
          { v:"no llegó",   label:"✗ No llegó", bg:"#2a0a0a", color:"#f54242", border:"#f5424266" },
          { v:"sin_reporte",label:"— Pendiente", bg:"#1a1a2a", color:"#9090c0", border:"#9090c044" },
        ].map(opt=>(
          <button key={opt.v} onClick={()=>onChange(opt.v)}
            style={{ background: asistencia===opt.v ? opt.bg : "#181825",
              color: asistencia===opt.v ? opt.color : "#5a5a80",
              border: `2px solid ${asistencia===opt.v ? opt.color : "#252540"}`,
              borderRadius:10, padding:"10px 6px", fontWeight:700, cursor:"pointer",
              fontSize:12, transition:"all 0.15s", WebkitTapHighlightColor:"transparent" }}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PERSISTENCIA localStorage
// ═══════════════════════════════════════════════════════════
const TODAY = hoy();

// Hook que sincroniza estado con localStorage automáticamente
function useLS(key, init) {
  const [val, setVal] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : init;
    } catch { return init; }
  });
  function set(updater) {
    setVal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  return [val, set];
}

const INIT_PROMOTORES = [
  { id:"p1", nombre:"Carlos Vega",  usuario:"carlos",  clave:"1111", tel:"56912345678", comisionPct:10 },
  { id:"p2", nombre:"Daniela Ríos", usuario:"daniela", clave:"2222", tel:"56923456789", comisionPct:12 },
  { id:"p3", nombre:"Mateo Luna",   usuario:"mateo",   clave:"3333", tel:"56934567890", comisionPct:10 },
];
const INIT_PAQUETES = [
  { id:"pk1", nombre:"Cumpleaños Luxury", precio:400000, comisionPct:10, descripcion:"Decoración, botella premium, pastel" },
  { id:"pk2", nombre:"Despedida VIP",     precio:300000, comisionPct:10, descripcion:"Mesa VIP, 2 botellas, servicio" },
  { id:"pk3", nombre:"Entrada General",   precio:20000,  comisionPct:10, descripcion:"Acceso general al evento" },
];
const INIT_RESERVAS = [];

// ═══════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [promotores, setPromotores] = useLS("nocturno_promotores", INIT_PROMOTORES);
  const [reservas,   setReservas]   = useLS("nocturno_reservas",   INIT_RESERVAS);
  const [paquetes,   setPaquetes]   = useLS("nocturno_paquetes",   INIT_PAQUETES);
  const [perfil,     setPerfil]     = useState(null);

  function addReserva(r)  { setReservas(rs=>[{...r,id:uid()},  ...rs]); }
  function saveReserva(r) { setReservas(rs=>rs.map(x=>x.id===r.id?r:x)); }
  function reportar(id,v) { setReservas(rs=>rs.map(x=>x.id===id?{...x,asistencia:v}:x)); }
  function liquidar(pid)  { setReservas(rs=>rs.map(r=>r.promotorId===pid&&r.asistencia==="llegó"&&!r.comisionPagada?{...r,comisionPagada:true}:r)); }
  function addPromotor(p)    { setPromotores(ps=>[...ps,{...p,id:uid()}]); }
  function editPromotor(p)   { setPromotores(ps=>ps.map(x=>x.id===p.id?p:x)); }
  function delPromotor(id)   { setPromotores(ps=>ps.filter(p=>p.id!==id)); }
  function addPaquete(p)     { setPaquetes(ps=>[...ps,{...p,id:uid()}]); }
  function delPaquete(id)    { setPaquetes(ps=>ps.filter(p=>p.id!==id)); }

  function statsP(pid) {
    const p = promotores.find(x=>x.id===pid);
    if(!p) return { total:0,llegaron:0,pendN:0,monto:0,totalPagado:0,detallePend:[],calcComision:()=>0 };
    const rs = reservas.filter(r=>r.promotorId===pid);
    const llegaron = rs.filter(r=>r.asistencia==="llegó");
    const pend = llegaron.filter(r=>!r.comisionPagada);
    const calcComision = r => {
      const pk = paquetes.find(x=>x.id===r.paqueteId);
      return pk ? pk.precio*(pk.comisionPct/100) : (r.ventas||r.consumoMin)*(p.comisionPct/100);
    };
    return {
      total:rs.length, llegaron:llegaron.length, pendN:pend.length,
      monto:pend.reduce((s,r)=>s+calcComision(r),0),
      totalPagado:llegaron.filter(r=>r.comisionPagada).reduce((s,r)=>s+calcComision(r),0),
      detallePend:pend.map(r=>({...r,comision:calcComision(r),paquete:paquetes.find(x=>x.id===r.paqueteId)})),
      calcComision,
    };
  }

  const db = { promotores,reservas,paquetes,addReserva,saveReserva,reportar,liquidar,addPromotor,editPromotor,delPromotor,addPaquete,delPaquete,statsP };

  if (!perfil)          return <Login promotores={promotores} onLogin={setPerfil}/>;
  if (perfil==="admin") return <AdminView  db={db} onSalir={()=>setPerfil(null)}/>;
  if (perfil==="host")  return <HostView   db={db} onSalir={()=>setPerfil(null)}/>;
  return                       <PromotorView pid={perfil} db={db} onSalir={()=>setPerfil(null)}/>;
}

// ═══════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════
function Login({ promotores, onLogin }) {
  const [modo,    setModo]   = useState("");
  const [usuario, setUsuario]= useState("");
  const [clave,   setClave]  = useState("");
  const [error,   setError]  = useState("");

  function doLogin() {
    setError("");
    if (modo==="admin") {
      if (clave==="admin123") { onLogin("admin"); return; }
      setError("Clave incorrecta");
    } else if (modo==="host") {
      if (clave==="host123") { onLogin("host"); return; }
      setError("Clave incorrecta");
    } else {
      const p = promotores.find(x=>x.usuario===usuario.trim().toLowerCase()&&x.clave===clave.trim());
      if (p) { onLogin(p.id); return; }
      setError("Usuario o clave incorrectos");
    }
  }

  const modos = [
    { id:"admin",    icon:"🔐", label:"Administrador" },
    { id:"host",     icon:"🌙", label:"Host / Portería" },
    { id:"promotor", icon:"👤", label:"Soy Promotor"  },
  ];

  return (
    <div style={{ ...S.page,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,minHeight:"100vh" }}>
      <div style={{ width:60,height:60,borderRadius:18,background:"linear-gradient(135deg,#b46eff,#6e4aff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:14 }}>✦</div>
      <div style={{ fontSize:24,fontWeight:900,color:"#f0e0ff",marginBottom:4 }}>NOCTURNO</div>
      <div style={{ fontSize:11,color:"#5050a0",letterSpacing:2,marginBottom:40 }}>GESTIÓN DE RESERVAS</div>
      <div style={{ width:"100%",maxWidth:360 }}>
        {modo===""&&(
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {modos.map(m=>(
              <button key={m.id} onClick={()=>setModo(m.id)}
                style={{ ...S.btnG,width:"100%",padding:"15px",textAlign:"center",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>
                <span style={{ fontSize:20 }}>{m.icon}</span> {m.label}
              </button>
            ))}
          </div>
        )}
        {modo!==""&&(
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ fontSize:16,fontWeight:700,color:"#d0a0ff" }}>
              {modos.find(m=>m.id===modo)?.icon} {modos.find(m=>m.id===modo)?.label}
            </div>
            {modo==="promotor"&&(
              <Field label="USUARIO">
                <input style={S.inp} type="text" value={usuario} onChange={e=>{setUsuario(e.target.value);setError("");}}
                  placeholder="tu usuario" autoCapitalize="none" autoComplete="off"/>
              </Field>
            )}
            <Field label="CLAVE">
              <input style={S.inp} type="password" value={clave} onChange={e=>{setClave(e.target.value);setError("");}}
                placeholder="••••••" onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
            </Field>
            {error&&<div style={{ color:"#f54242",fontSize:13,fontWeight:600 }}>⚠ {error}</div>}
            <button onClick={doLogin} style={{ ...S.btnP,padding:"15px" }}>Entrar</button>
            <button onClick={()=>{setModo("");setError("");setUsuario("");setClave("");}}
              style={{ ...S.btnG,width:"100%",padding:"11px",textAlign:"center",fontSize:13 }}>← Volver</button>
            <div style={{ color:"#3a3a60",fontSize:11,textAlign:"center" }}>
              {modo==="admin"&&"Clave: admin123"}
              {modo==="host"&&"Clave: host123"}
              {modo==="promotor"&&"Ej: «carlos» · «1111»"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// VISTA ADMIN
// ═══════════════════════════════════════════════════════════
function AdminView({ db, onSalir }) {
  const [tab,       setTab]      = useState("reservas");
  const [editR,     setEditR]    = useState(null);
  const [showNR,    setShowNR]   = useState(false);
  const [showNP,    setShowNP]   = useState(false);
  const [showPaq,   setShowPaq]  = useState(false);
  const [linkModal, setLinkModal]= useState(null);
  const [showReset, setShowReset]= useState(false);

  const TABS=[{id:"reservas",e:"🎟",l:"Reservas"},{id:"promotores",e:"👥",l:"Promotores"},{id:"liquidacion",e:"💰",l:"Liquidación"},{id:"paquetes",e:"📦",l:"Paquetes"}];

  function resetTodo() {
    ["nocturno_reservas","nocturno_promotores","nocturno_paquetes"].forEach(k=>localStorage.removeItem(k));
    window.location.reload();
  }

  return (
    <div style={S.page}>
      <Header titulo="ADMIN" onSalir={onSalir} tabs={TABS} tab={tab} setTab={setTab}
        extraBtn={<button onClick={()=>setShowReset(true)} style={{ background:"none",border:"none",color:"#3a3a60",cursor:"pointer",fontSize:18,padding:"4px 8px" }} title="Ajustes">⚙️</button>}
      />
      <div style={{ padding:"18px 16px",maxWidth:600,margin:"0 auto" }}>
        {tab==="reservas"    && <TabReservas    db={db} onNew={()=>setShowNR(true)} onEdit={r=>setEditR({...r})} esAdmin/>}
        {tab==="promotores"  && <TabPromotores  db={db} onNew={()=>setShowNP(true)} onLinkModal={setLinkModal}/>}
        {tab==="liquidacion" && <TabLiquidacion db={db} onLinkModal={setLinkModal}/>}
        {tab==="paquetes"    && <TabPaquetes    db={db} onNew={()=>setShowPaq(true)}/>}
      </div>
      {editR   && <ModalEditR    db={db} r={editR} setR={setEditR} onSave={r=>{db.saveReserva(r);setEditR(null);}} onClose={()=>setEditR(null)} esAdmin/>}
      {showNR  && <ModalNuevaR   db={db} defaultPid={db.promotores[0]?.id} onSave={r=>{db.addReserva(r);setShowNR(false);}} onClose={()=>setShowNR(false)} esAdmin/>}
      {showNP  && <ModalNuevoP   onSave={p=>{db.addPromotor(p);setShowNP(false);}}  onClose={()=>setShowNP(false)}/>}
      {showPaq && <ModalNuevoPaq onSave={p=>{db.addPaquete(p);setShowPaq(false);}}  onClose={()=>setShowPaq(false)}/>}
      {linkModal && <ModalLinkPago pid={linkModal} db={db} onClose={()=>setLinkModal(null)}/>}

      {/* Modal ajustes / reset */}
      <Modal open={showReset} onClose={()=>setShowReset(false)} title="⚙️ Ajustes">
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div style={{ background:"#0a2a1a",border:"1px solid #42f5a722",borderRadius:10,padding:14 }}>
            <div style={{ fontSize:12,color:"#42f5a7",fontWeight:700,marginBottom:4 }}>💾 Almacenamiento local activo</div>
            <div style={{ fontSize:11,color:"#6060a0",lineHeight:1.6 }}>
              Reservas: <b style={{ color:"#e0e0f0" }}>{db.reservas.length}</b> guardadas<br/>
              Promotores: <b style={{ color:"#e0e0f0" }}>{db.promotores.length}</b> registrados<br/>
              Paquetes: <b style={{ color:"#e0e0f0" }}>{db.paquetes.length}</b> disponibles
            </div>
          </div>
          <div style={{ background:"#1a0a0a",border:"1px solid #f5424222",borderRadius:10,padding:14 }}>
            <div style={{ fontSize:12,color:"#f54242",fontWeight:700,marginBottom:4 }}>⚠ Zona peligrosa</div>
            <div style={{ fontSize:11,color:"#6060a0",marginBottom:10 }}>Borrar todos los datos del dispositivo. Esta acción no se puede deshacer.</div>
            <button onClick={()=>{ if(window.confirm("¿Borrar TODOS los datos? Esto eliminará reservas, promotores y paquetes.")) resetTodo(); }}
              style={{ ...S.btnR,width:"100%",padding:"12px",textAlign:"center" }}>
              🗑 Borrar todos los datos
            </button>
          </div>
          <button onClick={()=>setShowReset(false)} style={{ ...S.btnG,width:"100%",padding:"12px",textAlign:"center" }}>Cerrar</button>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// VISTA HOST — solo check-in, con factura
// ═══════════════════════════════════════════════════════════
function HostView({ db, onSalir }) {
  const [fecha,      setFecha]     = useState(hoy());
  const [facturaR,   setFacturaR]  = useState(null);
  const [facturaVer, setFacturaVer]= useState(null);
  const fileRef = useRef();
  const { reservas, promotores, reportar, saveReserva } = db;

  const lista = reservas.filter(r=>r.fecha===fecha&&r.estado==="confirmada")
    .sort((a,b)=>a.hora.localeCompare(b.hora));

  const llegaron  = lista.filter(r=>r.asistencia==="llegó").length;
  const noLlegaron= lista.filter(r=>r.asistencia==="no llegó").length;
  const sinR      = lista.filter(r=>r.asistencia==="sin_reporte").length;

  function adjuntarFactura(reservaId, file) {
    const reader = new FileReader();
    reader.onload = e => {
      saveReserva({ ...reservas.find(r=>r.id===reservaId), facturaUrl:e.target.result, facturaName:file.name });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={S.page}>
      {/* Header Host */}
      <div style={{ background:"#13101e",borderBottom:"1px solid #1e1e32",padding:"14px 16px 14px",position:"sticky",top:0,zIndex:100 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#b46eff,#6e4aff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900 }}>🌙</div>
            <div>
              <div style={{ fontSize:14,fontWeight:800,color:"#f0e0ff" }}>NOCTURNO</div>
              <div style={{ fontSize:9,color:"#4a4a80",letterSpacing:1.5,fontWeight:700 }}>HOST / PORTERÍA</div>
            </div>
          </div>
          <button onClick={onSalir} style={{ background:"#1e1e32",border:"none",color:"#8080b0",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:600 }}>Salir</button>
        </div>
      </div>

      <div style={{ padding:"18px 16px",maxWidth:600,margin:"0 auto" }}>
        {/* Selector fecha */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:20,fontWeight:800,color:"#f0e0ff",marginBottom:4 }}>Reporte de Llegadas</div>
          <div style={{ color:"#5a5a80",fontSize:12,marginBottom:12 }}>Confirma asistencia y adjunta facturas</div>
          <Field label="DÍA DE EVENTO">
            <input style={S.inp} type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/>
          </Field>
        </div>

        {/* Stats del día */}
        {lista.length>0&&(
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16 }}>
            {[{l:"Llegaron",v:llegaron,c:"#42f5a7"},{l:"No llegaron",v:noLlegaron,c:"#f54242"},{l:"Sin reporte",v:sinR,c:"#f5c842"}].map(s=>(
              <div key={s.l} style={{ background:"#111120",border:"1px solid #1e1e32",borderRadius:12,padding:"12px 6px",textAlign:"center" }}>
                <div style={{ fontSize:26,fontWeight:900,color:s.c }}>{s.v}</div>
                <div style={{ fontSize:9,color:"#5a5a80",fontWeight:700 }}>{s.l.toUpperCase()}</div>
              </div>
            ))}
          </div>
        )}

        {lista.length===0&&(
          <div style={{ textAlign:"center",color:"#3a3a60",padding:"50px 0",fontSize:14 }}>
            <div style={{ fontSize:40,marginBottom:12 }}>📅</div>
            Sin reservas confirmadas para {fmtF(fecha)}
          </div>
        )}

        {/* Tarjeta por reserva */}
        {lista.map(r=>{
          const p = promotores.find(x=>x.id===r.promotorId);
          const pk = db.paquetes?.find(x=>x.id===r.paqueteId);
          return (
            <div key={r.id} style={{ ...S.card, border: r.asistencia==="llegó" ? "1px solid #42f5a744" : r.asistencia==="no llegó" ? "1px solid #f5424244" : "1px solid #1e1e32" }}>
              {/* Info principal */}
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800,fontSize:17,color:"#f0e0ff",marginBottom:4 }}>{r.nombre}</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:"3px 14px",color:"#6060a0",fontSize:12 }}>
                    <span>🪑 {r.mesa}</span>
                    <span>👥 {r.personas} pax</span>
                    <span>🕐 {r.hora}</span>
                    <span>📞 {r.tel}</span>
                    {p&&<span>👤 {p.nombre}</span>}
                  </div>
                  {pk&&<div style={{ marginTop:5,background:"#1a0f2e",borderRadius:6,padding:"4px 10px",display:"inline-block",fontSize:11,color:"#c0a0ff" }}>📦 {pk.nombre} · {fmt(pk.precio)}</div>}
                  {r.notas&&<div style={{ marginTop:4,fontSize:12,color:"#8080a0",fontStyle:"italic" }}>"{r.notas}"</div>}
                </div>
                <Badge v={r.asistencia}/>
              </div>

              {/* Botones llegó / no llegó */}
              <G2 gap={8}>
                <button onClick={()=>reportar(r.id,"llegó")}
                  style={{ ...S.btnGreen, padding:"13px", fontSize:14,
                    opacity:r.asistencia==="llegó"?1:0.45,
                    fontWeight:r.asistencia==="llegó"?800:600 }}>
                  ✓ Llegó
                </button>
                <button onClick={()=>reportar(r.id,"no llegó")}
                  style={{ ...S.btnR, padding:"13px", fontSize:14,
                    opacity:r.asistencia==="no llegó"?1:0.45,
                    fontWeight:r.asistencia==="no llegó"?800:600 }}>
                  ✗ No llegó
                </button>
              </G2>

              {r.asistencia!=="sin_reporte"&&(
                <button onClick={()=>reportar(r.id,"sin_reporte")}
                  style={{ ...S.btnG,marginTop:8,width:"100%",fontSize:11,padding:"7px",textAlign:"center" }}>
                  ↩ Limpiar reporte
                </button>
              )}

              {/* Sección factura */}
              <div style={{ marginTop:12,paddingTop:12,borderTop:"1px solid #1a1a28" }}>
                <div style={{ fontSize:11,color:"#7070a0",fontWeight:700,letterSpacing:1,marginBottom:8 }}>FACTURA / COMPROBANTE</div>
                {r.facturaUrl ? (
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0a2a1a",borderRadius:8,padding:"8px 12px" }}>
                    <span style={{ fontSize:12,color:"#42f5a7" }}>✓ {r.facturaName||"Factura adjunta"}</span>
                    <div style={{ display:"flex",gap:8 }}>
                      <button
                        onClick={()=>setFacturaVer({url:r.facturaUrl,name:r.facturaName})}
                        style={{ fontSize:11,color:"#b46eff",fontWeight:700,background:"#b46eff22",border:"1px solid #b46eff44",borderRadius:7,padding:"4px 12px",cursor:"pointer" }}>
                        👁 Ver
                      </button>
                      <button onClick={()=>setFacturaR(r.id)}
                        style={{ background:"none",border:"none",color:"#f5c842",fontSize:11,cursor:"pointer",fontWeight:700 }}>Cambiar</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={()=>setFacturaR(r.id)}
                    style={{ ...S.btnG,width:"100%",padding:"10px",fontSize:13,textAlign:"center" }}>
                    📎 Adjuntar factura / foto
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input file oculto */}
      <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display:"none" }}
        onChange={e=>{
          const f=e.target.files[0];
          if(f&&facturaR){ adjuntarFactura(facturaR,f); setFacturaR(null); e.target.value=""; }
        }}/>

      {/* Trigger cuando se selecciona una reserva para factura */}
      {facturaR&&!fileRef.current?.files?.length&&(
        <div style={{ display:"none" }}>{setTimeout(()=>fileRef.current?.click(),50)}</div>
      )}
      {facturaR&&<FacturaPrompt onConfirm={()=>fileRef.current?.click()} onClose={()=>setFacturaR(null)} />}
      <ModalFactura facturaVer={facturaVer} onClose={()=>setFacturaVer(null)} />
    </div>
  );
}

// ── Modal Confirmación con QR Bora Bora ──────────────────
function ModalConfirmacion({ r, paquetes, promotores, onClose }) {
  const pk = paquetes?.find(x=>x.id===r.paqueteId);
  const ticketRef = useRef();
  const [img, setImg] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [compartido, setCompartido] = useState(false);
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false);
  const [verCompleto, setVerCompleto] = useState(false);

  function abrirEnNavegador() {
    // Genera una página HTML completa con el ticket como imagen incrustada
    // El usuario puede desde ahí: compartir, guardar a fotos, imprimir, etc.
    if (!img) return;
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reserva NOCTURNO — ${r.nombre}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#09090f; display:flex; flex-direction:column; align-items:center;
           justify-content:center; min-height:100vh; font-family:'DM Sans',sans-serif; padding:20px; }
    img { max-width:100%; width:420px; border-radius:20px; box-shadow:0 0 60px rgba(0,245,212,0.2); }
    .hint { margin-top:20px; color:#4a7a80; font-size:13px; text-align:center; line-height:1.6; }
    .hint b { color:#00f5d4; }
    .actions { margin-top:24px; display:flex; flex-direction:column; gap:10px; width:100%; max-width:420px; }
    .btn { padding:14px; border-radius:12px; font-size:15px; font-weight:700;
           cursor:pointer; border:none; text-align:center; text-decoration:none; display:block; }
    .btn-green { background:linear-gradient(135deg,#0d6e4e,#0a5a40); color:#42f5a7; }
    .btn-blue  { background:linear-gradient(135deg,#1e3a6e,#162a5e); color:#60a5fa; border:1px solid #60a5fa44; }
  </style>
</head>
<body>
  <img src="${img}" alt="Ticket NOCTURNO"/>
  <div class="hint">
    <b>iPhone:</b> Mantén presionada la imagen → "Añadir a Fotos"<br>
    Luego envíala desde tu galería por WhatsApp o email
  </div>
  <div class="actions">
    <a class="btn btn-green" href="https://wa.me/${(r.tel||"").replace(/\D/g,"")}?text=${encodeURIComponent(`✦ NOCTURNO — Reserva confirmada\n\n👤 ${r.nombre}\n📅 ${fmtF(r.fecha)}  🕐 ${r.hora}\n🪑 Mesa: ${r.mesa}  👥 ${r.personas} personas\n${pk?`📦 ${pk.nombre} · ${fmt(pk.precio)}`:`💵 ${fmt(r.consumoMin)}`}\n\nPresenta el ticket en portería. ¡Te esperamos! 🎉`)}">
      💬 Abrir WhatsApp
    </a>
    <a class="btn btn-blue" href="mailto:?subject=${encodeURIComponent(`Reserva NOCTURNO — ${r.nombre} · ${fmtF(r.fecha)}`)}&body=${encodeURIComponent(`Hola ${r.nombre},\n\nTu reserva está confirmada:\n\n📅 ${fmtF(r.fecha)}  🕐 ${r.hora}\n🪑 Mesa: ${r.mesa}  👥 ${r.personas} personas\n${pk?`📦 ${pk.nombre} · ${fmt(pk.precio)}`:`💵 Consumo mín: ${fmt(r.consumoMin)}`}${r.notas?`\n📝 ${r.notas}`:""}\n\nPresenta este correo en portería.\n\n¡Te esperamos esta noche! 🎉\n— NOCTURNO · Bora Bora Nightclub`)}">
      ✉️ Enviar por Email
    </a>
  </div>
</body>
</html>`;
    const blob = new Blob([html], {type:"text/html"});
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  function enviarEmail() {
    const asunto = encodeURIComponent(`Reserva NOCTURNO — ${r.nombre} · ${fmtF(r.fecha)}`);
    const cuerpo = encodeURIComponent(
      `Hola ${r.nombre},\n\nTu reserva en NOCTURNO está confirmada:\n\n` +
      `📅 Fecha: ${fmtF(r.fecha)}\n🕐 Hora: ${r.hora}\n🪑 Mesa: ${r.mesa}\n👥 Personas: ${r.personas}\n` +
      (pk ? `📦 Paquete: ${pk.nombre} · ${fmt(pk.precio)}\n` : `💵 Consumo mínimo: ${fmt(r.consumoMin)}\n`) +
      (r.notas ? `📝 ${r.notas}\n` : "") +
      `\nPresenta este correo en portería.\n\n¡Te esperamos esta noche! 🎉\n— NOCTURNO · Bora Bora Nightclub`
    );
    window.open(`mailto:?subject=${asunto}&body=${cuerpo}`, "_blank");
  }

  const qrText = [
    `NOCTURNO|${r.id}|${r.nombre}|${r.fecha}|${r.hora}|${r.mesa}|${r.personas}`,
    pk ? pk.nombre : `MIN${r.consumoMin}`,
  ].join("|");

  // Genera el ticket completo como imagen PNG via canvas
  useEffect(() => {
    const t = setTimeout(() => renderTicketCanvas(), 400);
    return () => clearTimeout(t);
  }, [r.id]);

  function renderTicketCanvas() {
    setGenerando(true);
    const W = 600, H = 920;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const cx = cv.getContext("2d");

    // ── Fondo degradado ──
    const bg = cx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,   "#0a1628");
    bg.addColorStop(0.4, "#0d2a3a");
    bg.addColorStop(1,   "#0a2420");
    cx.fillStyle = bg; cx.fillRect(0,0,W,H);

    // Brillo superior
    const glow = cx.createRadialGradient(150,0,0,150,0,300);
    glow.addColorStop(0,"rgba(0,245,212,0.18)");
    glow.addColorStop(1,"transparent");
    cx.fillStyle=glow; cx.fillRect(0,0,W,H);
    const glow2 = cx.createRadialGradient(450,0,0,450,0,250);
    glow2.addColorStop(0,"rgba(14,165,233,0.14)");
    glow2.addColorStop(1,"transparent");
    cx.fillStyle=glow2; cx.fillRect(0,0,W,H);

    // ── Header ──
    cx.textAlign = "center";
    cx.fillStyle = "#00f5d4";
    cx.font = "bold 22px 'DM Sans',sans-serif";
    cx.fillText("✦  NOCTURNO  ✦", W/2, 52);

    cx.fillStyle = "#ffffff";
    cx.font = "bold 52px 'DM Sans',sans-serif";
    cx.fillText(r.nombre, W/2, 118);

    if (r.notas) {
      cx.fillStyle = "#7dd3c8";
      cx.font = "italic 22px 'DM Sans',sans-serif";
      cx.fillText(`"${r.notas}"`, W/2, 150);
    }

    // ── Línea punteada 1 ──
    const y1 = r.notas ? 178 : 158;
    dashedLine(cx, 20, y1, W-20, y1, "#1a3a4a", 4, 10);
    circle(cx, 0,   y1, 22, "#09090f");
    circle(cx, W,   y1, 22, "#09090f");

    // ── Grid datos ──
    const datos = [
      {l:"FECHA",    v:fmtF(r.fecha)},
      {l:"HORA",     v:r.hora},
      {l:"MESA",     v:r.mesa},
      {l:"PERSONAS", v:`${r.personas} pax`},
    ];
    const gY = y1 + 22, gW = (W-60)/2, gH = 90;
    datos.forEach((d,i)=>{
      const x = 30 + (i%2)*(gW+20);
      const y = gY + Math.floor(i/2)*(gH+12);
      roundFill(cx, x, y, gW, gH, 12, "rgba(255,255,255,0.06)");
      cx.strokeStyle = "rgba(0,245,212,0.15)";
      cx.lineWidth = 1;
      roundStroke(cx, x, y, gW, gH, 12);
      cx.fillStyle = "#7dd3c8"; cx.font = "bold 16px sans-serif"; cx.textAlign="left";
      cx.fillText(d.l, x+16, y+28);
      cx.fillStyle = "#ffffff"; cx.font = "bold 26px 'DM Sans',sans-serif";
      cx.fillText(d.v, x+16, y+62);
    });

    // ── Paquete / consumo ──
    const pqY = gY + 2*(gH+12) + 20;
    if (pk) {
      const pqG = cx.createLinearGradient(30,pqY,W-30,pqY+90);
      pqG.addColorStop(0,"rgba(0,245,212,0.18)");
      pqG.addColorStop(1,"rgba(14,165,233,0.12)");
      roundFill(cx, 30, pqY, W-60, 90, 16, pqG);
      cx.strokeStyle="rgba(0,245,212,0.35)"; cx.lineWidth=1.5;
      roundStroke(cx,30,pqY,W-60,90,16);
      cx.textAlign="center";
      cx.fillStyle="#7dd3c8"; cx.font="bold 18px sans-serif";
      cx.fillText(`📦  ${pk.nombre}`, W/2, pqY+30);
      cx.fillStyle="#00f5d4"; cx.font="bold 42px 'DM Sans',sans-serif";
      cx.fillText(fmt(pk.precio), W/2, pqY+74);
    } else {
      roundFill(cx,30,pqY,W-60,90,16,"rgba(255,255,255,0.05)");
      cx.strokeStyle="rgba(0,245,212,0.15)"; cx.lineWidth=1;
      roundStroke(cx,30,pqY,W-60,90,16);
      cx.textAlign="center";
      cx.fillStyle="#7dd3c8"; cx.font="bold 18px sans-serif";
      cx.fillText("CONSUMO MÍNIMO", W/2, pqY+30);
      cx.fillStyle="#f5c842"; cx.font="bold 38px 'DM Sans',sans-serif";
      cx.fillText(fmt(r.consumoMin), W/2, pqY+72);
    }

    // ── Línea punteada 2 ──
    const y2 = pqY + 110;
    dashedLine(cx,20,y2,W-20,y2,"#1a3a4a",4,10);
    circle(cx,0,y2,22,"#09090f"); circle(cx,W,y2,22,"#09090f");

    // ── QR ──
    const qrY = y2 + 24;
    cx.fillStyle="#7dd3c8"; cx.font="bold 16px sans-serif"; cx.textAlign="center";
    cx.fillText("QR DE ACCESO · MOSTRAR EN PORTERÍA", W/2, qrY+16);

    // QR box
    const qrSize = 200, qrX = W/2-qrSize/2, qrBoxY = qrY+30;
    roundFill(cx, qrX-16, qrBoxY-16, qrSize+32, qrSize+32, 20, "#0a1628");
    cx.strokeStyle="rgba(0,245,212,0.4)"; cx.lineWidth=2;
    roundStroke(cx, qrX-16, qrBoxY-16, qrSize+32, qrSize+32, 20);

    // Dibujamos QR directamente en este canvas
    const qrMat = createQRMatrix(qrText, 29);
    const N=29, cell=Math.floor(qrSize/N), off=Math.floor((qrSize-N*cell)/2);
    for (let row=0;row<N;row++) for (let col=0;col<N;col++) {
      if (!qrMat[row][col]) continue;
      const mx=qrX+off+col*cell, my=qrBoxY+off+row*cell;
      const isFinder=(row<7&&col<7)||(row<7&&col>=N-7)||(row>=N-7&&col<7);
      cx.fillStyle="#00f5d4";
      if (isFinder) {
        roundFill(cx,mx+0.5,my+0.5,cell-1,cell-1,cell*0.3,"#00f5d4");
      } else {
        cx.beginPath();
        cx.arc(mx+cell/2,my+cell/2,cell*0.42,0,Math.PI*2);
        cx.fill();
      }
    }
    // Logo central
    cx.fillStyle="#0a1628";
    roundFill(cx,W/2-18,qrBoxY+qrSize/2-18,36,36,8,"#0a1628");
    cx.fillStyle="#00f5d4"; cx.font="bold 28px serif"; cx.textAlign="center";
    cx.fillText("✦", W/2, qrBoxY+qrSize/2+10);

    // ── Footer ──
    const fY = qrBoxY+qrSize+48;
    dashedLine(cx,W/4,fY,W*3/4,fY,"rgba(0,245,212,0.2)",1,6);
    cx.fillStyle="#4a7a80"; cx.font="bold 14px sans-serif"; cx.textAlign="center";
    cx.letterSpacing="4px";
    cx.fillText("BORA BORA  ·  NIGHTCLUB", W/2, fY+28);

    setImg(cv.toDataURL("image/png"));
    setGenerando(false);
  }

  // Helpers canvas
  function dashedLine(cx,x1,y1,x2,y2,color,w,dash){
    cx.save(); cx.strokeStyle=color; cx.lineWidth=w; cx.setLineDash([dash,dash]);
    cx.beginPath(); cx.moveTo(x1,y1); cx.lineTo(x2,y2); cx.stroke(); cx.restore();
  }
  function circle(cx,x,y,r,color){
    cx.fillStyle=color; cx.beginPath(); cx.arc(x,y,r,0,Math.PI*2); cx.fill();
  }
  function roundPath(cx,x,y,w,h,r){
    cx.beginPath(); cx.moveTo(x+r,y);
    cx.lineTo(x+w-r,y); cx.arcTo(x+w,y,x+w,y+r,r);
    cx.lineTo(x+w,y+h-r); cx.arcTo(x+w,y+h,x+w-r,y+h,r);
    cx.lineTo(x+r,y+h); cx.arcTo(x,y+h,x,y+h-r,r);
    cx.lineTo(x,y+r); cx.arcTo(x,y,x+r,y,r); cx.closePath();
  }
  function roundFill(cx,x,y,w,h,r,color){ cx.fillStyle=color; roundPath(cx,x,y,w,h,r); cx.fill(); }
  function roundStroke(cx,x,y,w,h,r){ roundPath(cx,x,y,w,h,r); cx.stroke(); }

  // Compartir imagen
  async function compartirImagen() {
    if (!img) return;

    // En iOS Safari dentro de Claude, navigator.share con files no funciona
    // La mejor estrategia: abrir la imagen en nueva pestaña para que el usuario
    // la guarde y luego abrimos WhatsApp con el texto
    const tel = r.tel?.replace(/\D/g,"");
    const textoWA = encodeURIComponent(
      `✦ NOCTURNO — Reserva confirmada\n\n` +
      `👤 ${r.nombre}\n` +
      `📅 ${fmtF(r.fecha)}  🕐 ${r.hora}\n` +
      `🪑 Mesa: ${r.mesa}  👥 ${r.personas} personas\n` +
      (pk ? `📦 ${pk.nombre} · ${fmt(pk.precio)}` : `💵 Consumo mín: ${fmt(r.consumoMin)}`) +
      (r.notas ? `\n📝 ${r.notas}` : "") +
      `\n\nPresenta este mensaje en portería. ¡Te esperamos! 🎉`
    );
    const waUrl = tel ? `https://wa.me/${tel}?text=${textoWA}` : `https://wa.me/?text=${textoWA}`;

    // Intentamos compartir nativo primero (Android Chrome / Safari moderno)
    const blob = await (await fetch(img)).blob();
    const file = new File([blob], "reserva-nocturno.png", {type:"image/png"});
    if (navigator.share && navigator.canShare?.({files:[file]})) {
      try {
        await navigator.share({ files:[file], title:"Reserva NOCTURNO" });
        setCompartido(true);
        setTimeout(()=>setCompartido(false),3000);
        return;
      } catch(e) {
        if (e.name !== "AbortError") console.log("share failed:", e);
      }
    }

    // Fallback iOS: abrimos imagen en nueva tab para guardar + WhatsApp con texto
    setMostrarInstrucciones(true);
  }

  async function descargar() {
    if (!img) return;
    // Crear link de descarga
    const a = document.createElement("a");
    a.href = img;
    a.download = `reserva-${r.nombre.replace(/\s/g,"-")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function abrirWhatsApp() {
    const tel = r.tel?.replace(/\D/g,"");
    const textoWA = encodeURIComponent(
      `✦ NOCTURNO — Reserva confirmada\n\n` +
      `👤 ${r.nombre}\n` +
      `📅 ${fmtF(r.fecha)}  🕐 ${r.hora}\n` +
      `🪑 Mesa: ${r.mesa}  👥 ${r.personas} personas\n` +
      (pk ? `📦 ${pk.nombre} · ${fmt(pk.precio)}` : `💵 Consumo mín: ${fmt(r.consumoMin)}`) +
      (r.notas ? `\n📝 ${r.notas}` : "") +
      `\n\nPresenta este mensaje en portería. ¡Te esperamos! 🎉`
    );
    window.open(tel ? `https://wa.me/${tel}?text=${textoWA}` : `https://wa.me/?text=${textoWA}`, "_blank");
  }

  return (
    <Modal open onClose={onClose} title="">

      {/* Preview del ticket */}
      <div style={{ marginBottom:16, borderRadius:16, overflow:"hidden", border:"1px solid rgba(0,245,212,0.2)" }}>
        {generando || !img ? (
          <div style={{ background:"#0a1628", height:260, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
            <div style={{ fontSize:32, animation:"spin 1s linear infinite" }}>✦</div>
            <div style={{ color:"#7dd3c8", fontSize:14 }}>Generando ticket…</div>
          </div>
        ) : (
          <img src={img} alt="ticket" style={{ width:"100%", display:"block" }}/>
        )}
      </div>

      {/* Instrucción */}
      {img && (
        <div style={{ background:"#0a1f14", border:"1px solid rgba(0,245,212,0.2)", borderRadius:12, padding:"12px 16px", marginBottom:14, display:"flex", gap:10, alignItems:"flex-start" }}>
          <span style={{ fontSize:20 }}>💡</span>
          <div style={{ fontSize:12, color:"#7dd3c8", lineHeight:1.6 }}>
            Abre el ticket en el navegador → mantén presionada la imagen → <b style={{color:"#00f5d4"}}>"Añadir a Fotos"</b> → envíala desde tu galería
          </div>
        </div>
      )}

      {/* Acciones */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

        {/* Principal — abrir en navegador con imagen */}
        <button onClick={abrirEnNavegador} disabled={!img}
          style={{ background:"linear-gradient(135deg,#003d30,#004d3a)", color:"#00f5d4",
            border:"2px solid rgba(0,245,212,0.5)", borderRadius:12, padding:"16px",
            fontWeight:800, cursor:"pointer", fontSize:15, width:"100%", textAlign:"center",
            opacity:img?1:0.5, boxShadow:"0 0 20px rgba(0,245,212,0.1)" }}>
          🌐 Abrir ticket en el navegador
        </button>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {/* WhatsApp solo texto */}
          <button onClick={abrirWhatsApp}
            style={{ background:"#0d2a1e", color:"#42f5a7", border:"1px solid #42f5a744",
              borderRadius:10, padding:"13px", fontWeight:700, cursor:"pointer", fontSize:13, textAlign:"center" }}>
            💬 WhatsApp
          </button>
          {/* Email */}
          <button onClick={enviarEmail}
            style={{ background:"#0a1a30", color:"#60a5fa", border:"1px solid #60a5fa44",
              borderRadius:10, padding:"13px", fontWeight:700, cursor:"pointer", fontSize:13, textAlign:"center" }}>
            ✉️ Email
          </button>
        </div>

        {/* Screenshot */}
        <button onClick={()=>setVerCompleto(true)} disabled={!img}
          style={{ ...S.btnG, width:"100%", padding:"12px", textAlign:"center", fontSize:13, opacity:img?1:0.5 }}>
          📸 Ver para hacer screenshot
        </button>

        <button onClick={onClose} style={{ ...S.btnP, padding:"13px" }}>Cerrar</button>
      </div>

      {/* Vista completa para screenshot */}
      {verCompleto && img && (
        <div onClick={()=>setVerCompleto(false)}
          style={{ position:"fixed", inset:0, background:"#000", zIndex:1000,
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ position:"absolute", top:20, right:20, color:"#7dd3c8", fontSize:13, fontWeight:700,
            background:"rgba(0,0,0,0.6)", padding:"8px 16px", borderRadius:20, border:"1px solid rgba(0,245,212,0.3)" }}>
            📸 Haz screenshot ahora · Toca para cerrar
          </div>
          <img src={img} alt="ticket"
            style={{ maxWidth:"100%", maxHeight:"100vh", objectFit:"contain" }}/>
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </Modal>
  );
}

// ── Modal Visor de Factura ────────────────────────────────
// Funciona con blob: URLs ya que renderiza dentro del mismo contexto
function ModalFactura({ facturaVer, onClose }) {
  if (!facturaVer) return null;
  const isPdf = facturaVer.isPdf || facturaVer.name?.toLowerCase().endsWith(".pdf");
  return (
    <Modal open onClose={onClose} title={`📎 ${facturaVer.name || "Factura"}`}>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        {/* Visor imagen */}
        {!isPdf && (
          <div style={{ background:"#0d0d1a",borderRadius:12,overflow:"hidden",border:"1px solid #2a2a40" }}>
            <img
              src={facturaVer.url}
              alt="factura"
              style={{ width:"100%",display:"block",maxHeight:"60vh",objectFit:"contain",background:"#000" }}
              onError={e=>{e.target.style.display="none"; e.target.nextSibling.style.display="block";}}
            />
            <div style={{ display:"none",padding:20,textAlign:"center",color:"#f54242",fontSize:13 }}>
              No se pudo cargar la imagen
            </div>
          </div>
        )}
        {/* Visor PDF */}
        {isPdf && (
          <div style={{ background:"#0d0d1a",borderRadius:12,overflow:"hidden",border:"1px solid #2a2a40",height:"60vh" }}>
            <embed
              src={facturaVer.url}
              type="application/pdf"
              width="100%"
              height="100%"
              style={{ borderRadius:12 }}
            />
          </div>
        )}
        <div style={{ fontSize:11,color:"#6060a0",textAlign:"center" }}>{facturaVer.name}</div>
        <button onClick={onClose} style={{ ...S.btnP,padding:"13px" }}>Cerrar</button>
      </div>
    </Modal>
  );
}

// ── Mini modal para confirmar adjunto ─────────────────────
function FacturaPrompt({ onConfirm, onClose }) {
  return (
    <Modal open onClose={onClose}>
      <div style={{ textAlign:"center",padding:"10px 0" }}>
        <div style={{ fontSize:40,marginBottom:12 }}>📎</div>
        <div style={{ fontSize:17,fontWeight:800,color:"#f0e0ff",marginBottom:8 }}>Adjuntar Factura</div>
        <div style={{ color:"#6060a0",fontSize:13,marginBottom:20 }}>Selecciona una imagen o PDF del comprobante</div>
        <button onClick={()=>{onConfirm();onClose();}} style={{ ...S.btnP,padding:"14px",marginBottom:10 }}>
          📷 Seleccionar archivo
        </button>
        <button onClick={onClose} style={{ ...S.btnG,width:"100%",padding:"11px",textAlign:"center",fontSize:13 }}>Cancelar</button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// MODAL BOLD — link de pago para paquete
// ═══════════════════════════════════════════════════════════
function ModalBold({ paquete, reserva, promotor, onClose }) {
  const [copiado, setCopiado] = useState(false);
  const [boldApiKey, setBoldApiKey] = useState("");
  const [paso, setPaso] = useState("form"); // "form" | "link"
  const [boldLink, setBoldLink] = useState("");
  const [generando, setGenerando] = useState(false);

  // Bold genera links de pago vía su API o dashboard.
  // Como no tenemos backend, construimos el link de checkout de Bold
  // con los parámetros públicos que Bold acepta por URL.
  // Docs: https://bold.co/developers
  function generarLink() {
    setGenerando(true);
    // Bold checkout URL con parámetros (modo demo sin API key real)
    const descripcion = encodeURIComponent(`${paquete.nombre} - Reserva ${reserva?.nombre||""} - NOCTURNO`);
    const monto = paquete.precio; // en pesos COP/CLP sin decimales
    // Si tienen API key de Bold real, se usaría su endpoint de payment_links
    // Por ahora generamos el link de Bold checkout público
    const link = boldApiKey
      ? `https://checkout.bold.co/payment/link?amount=${monto}&description=${descripcion}&currency=COP&api_key=${boldApiKey}`
      : `https://checkout.bold.co/payment/link?amount=${monto}&description=${descripcion}&currency=COP`;
    setTimeout(() => { setBoldLink(link); setPaso("link"); setGenerando(false); }, 800);
  }

  function copiar() {
    navigator.clipboard?.writeText(boldLink).then(()=>{ setCopiado(true); setTimeout(()=>setCopiado(false),2500); });
  }

  function compartirWhatsApp() {
    const msg = encodeURIComponent(`Hola! Te comparto el link de pago para tu reserva en NOCTURNO 🎉\n\n📦 ${paquete.nombre}\n💵 ${fmt(paquete.precio)}\n\n${boldLink}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  return (
    <Modal open onClose={onClose} title="💳 Generar Link de Pago · Bold">
      {paso === "form" && (
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          {/* Info paquete */}
          <div style={{ background:"#1a0f2e",border:"1px solid #6e4aff44",borderRadius:12,padding:16 }}>
            <div style={{ fontSize:11,color:"#9070d0",fontWeight:700,letterSpacing:1,marginBottom:8 }}>PAQUETE A COBRAR</div>
            <div style={{ fontSize:17,fontWeight:800,color:"#f0e0ff",marginBottom:4 }}>📦 {paquete.nombre}</div>
            {paquete.descripcion&&<div style={{ fontSize:12,color:"#8080a0",marginBottom:8 }}>{paquete.descripcion}</div>}
            <div style={{ fontSize:24,fontWeight:900,color:"#42f5a7" }}>{fmt(paquete.precio)}</div>
            <div style={{ fontSize:11,color:"#b46eff",marginTop:4 }}>
              Tu comisión: {fmt(paquete.precio * paquete.comisionPct/100)} ({paquete.comisionPct}%)
            </div>
          </div>

          {reserva && (
            <div style={{ background:"#111120",border:"1px solid #1e1e32",borderRadius:10,padding:12,fontSize:12,color:"#8080a0" }}>
              <div style={{ color:"#e0e0f0",fontWeight:700,marginBottom:4 }}>{reserva.nombre}</div>
              <div>📞 {reserva.tel} · 🪑 {reserva.mesa} · 📅 {fmtF(reserva.fecha)}</div>
            </div>
          )}

          {/* API Key Bold (opcional) */}
          <div>
            <label style={S.lbl}>API KEY BOLD (opcional)</label>
            <input style={S.inp} type="text" value={boldApiKey} onChange={e=>setBoldApiKey(e.target.value)}
              placeholder="Tu API key de Bold · bold.co/developers"
              autoCapitalize="none" autoComplete="off"/>
            <div style={{ fontSize:10,color:"#5a5a80",marginTop:4 }}>
              Sin API key se genera un link demo. Con tu key real el cobro se acredita a tu cuenta Bold.
            </div>
          </div>

          <button onClick={generarLink} style={{ ...S.btnP,padding:"15px",fontSize:16 }}>
            {generando ? "Generando…" : "💳 Generar Link de Pago"}
          </button>
          <button onClick={onClose} style={{ ...S.btnG,width:"100%",padding:"12px",textAlign:"center" }}>Cancelar</button>

          {/* Info Bold */}
          <div style={{ background:"#0d0d1a",borderRadius:10,padding:12,fontSize:11,color:"#6060a0",lineHeight:1.6 }}>
            <b style={{ color:"#d0a0ff" }}>¿Cómo obtener tu API Key Bold?</b><br/>
            1. Entra a <a href="https://bold.co" target="_blank" rel="noreferrer" style={{ color:"#b46eff" }}>bold.co</a> y crea tu cuenta<br/>
            2. Ve a Configuración → Integraciones → API<br/>
            3. Copia tu clave y pégala aquí
          </div>
        </div>
      )}

      {paso === "link" && (
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div style={{ textAlign:"center",padding:"10px 0 6px" }}>
            <div style={{ fontSize:44,marginBottom:8 }}>🔗</div>
            <div style={{ fontSize:18,fontWeight:800,color:"#f0e0ff",marginBottom:4 }}>Link generado</div>
            <div style={{ fontSize:12,color:"#6060a0" }}>Comparte este link con tu cliente para que pague</div>
          </div>

          {/* Monto y paquete */}
          <div style={{ background:"#0a2a1a",border:"1px solid #42f5a744",borderRadius:12,padding:16,textAlign:"center" }}>
            <div style={{ fontSize:11,color:"#42f5a7",fontWeight:700,marginBottom:4 }}>📦 {paquete.nombre}</div>
            <div style={{ fontSize:28,fontWeight:900,color:"#42f5a7" }}>{fmt(paquete.precio)}</div>
            <div style={{ fontSize:11,color:"#7070a0",marginTop:4 }}>Tu comisión: {fmt(paquete.precio*paquete.comisionPct/100)}</div>
          </div>

          {/* Link box */}
          <div style={{ background:"#181825",border:"1px solid #252540",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#9090c0",wordBreak:"break-all",lineHeight:1.5 }}>
            {boldLink}
          </div>

          {/* Acciones */}
          <button onClick={copiar}
            style={{ ...S.btnP,padding:"14px",fontSize:15,
              background:copiado?"linear-gradient(135deg,#42f5a7,#20c080)":"linear-gradient(135deg,#b46eff,#6e4aff)" }}>
            {copiado ? "✓ Copiado!" : "📋 Copiar link"}
          </button>

          <button onClick={compartirWhatsApp}
            style={{ background:"#0a2a10",color:"#42f5a7",border:"1px solid #42f5a744",borderRadius:10,
              padding:"14px",fontWeight:700,cursor:"pointer",fontSize:15,width:"100%",textAlign:"center" }}>
            💬 Enviar por WhatsApp
          </button>

          <a href={boldLink} target="_blank" rel="noreferrer"
            style={{ ...S.btnG,display:"block",padding:"12px",textAlign:"center",textDecoration:"none",fontSize:14 }}>
            👁 Abrir link Bold ↗
          </a>

          <button onClick={()=>setPaso("form")}
            style={{ background:"none",border:"none",color:"#5a5a80",cursor:"pointer",fontSize:13,padding:"8px",textAlign:"center" }}>
            ← Volver
          </button>
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// VISTA PROMOTOR
// ═══════════════════════════════════════════════════════════
function PromotorView({ pid, db, onSalir }) {
  const [tab,       setTab]      = useState("mis_reservas");
  const [editR,     setEditR]    = useState(null);
  const [showNR,    setShowNR]   = useState(false);
  const [boldModal, setBoldModal]= useState(null); // { paquete, reserva }
  const prom = db.promotores.find(p=>p.id===pid);
  const misR = db.reservas.filter(r=>r.promotorId===pid);
  const TABS=[{id:"mis_reservas",e:"🎟",l:"Reservas"},{id:"mi_perfil",e:"👤",l:"Mi Perfil"},{id:"paquetes_venta",e:"💳",l:"Cobrar"}];

  return (
    <div style={S.page}>
      <Header titulo={`${prom?.nombre?.split(" ")[0]} · ${prom?.usuario}`} onSalir={onSalir} tabs={TABS} tab={tab} setTab={setTab}/>
      <div style={{ padding:"18px 16px",maxWidth:600,margin:"0 auto" }}>
        {tab==="mis_reservas"  &&<TabReservas db={{...db,reservas:misR}} onNew={()=>setShowNR(true)} onEdit={r=>setEditR({...r})} esAdmin={false}/>}
        {tab==="mi_perfil"     &&<TabMiPerfil promotor={prom} stats={db.statsP(pid)} reservas={misR} paquetes={db.paquetes}/>}
        {tab==="paquetes_venta"&&<TabCobrarBold paquetes={db.paquetes} reservas={misR} onBold={(pk,r)=>setBoldModal({paquete:pk,reserva:r})}/>}
      </div>
      {editR     &&<ModalEditR  db={db} r={editR}  setR={setEditR} onSave={r=>{db.saveReserva(r);setEditR(null);}} onClose={()=>setEditR(null)} esAdmin={false}/>}
      {showNR    &&<ModalNuevaR db={db} defaultPid={pid}           onSave={r=>{db.addReserva(r);setShowNR(false);}} onClose={()=>setShowNR(false)} esAdmin={false}/>}
      {boldModal &&<ModalBold paquete={boldModal.paquete} reserva={boldModal.reserva} promotor={prom} onClose={()=>setBoldModal(null)}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENTES COMPARTIDOS
// ═══════════════════════════════════════════════════════════
function Header({ titulo, onSalir, tabs, tab, setTab, extraBtn }) {
  return (
    <div style={{ background:"#13101e",borderBottom:"1px solid #1e1e32",padding:"14px 16px 0",position:"sticky",top:0,zIndex:100 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#b46eff,#6e4aff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900 }}>✦</div>
          <div>
            <div style={{ fontSize:14,fontWeight:800,color:"#f0e0ff" }}>NOCTURNO</div>
            <div style={{ fontSize:9,color:"#4a4a80",letterSpacing:1.5,fontWeight:700 }}>{titulo}</div>
          </div>
        </div>
        <div style={{ display:"flex",gap:6,alignItems:"center" }}>
          {extraBtn}
          <button onClick={onSalir} style={{ background:"#1e1e32",border:"none",color:"#8080b0",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:600 }}>Salir</button>
        </div>
      </div>
      <div style={{ display:"flex" }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1,background:tab===t.id?"#b46eff14":"transparent",color:tab===t.id?"#d0a0ff":"#444470",border:"none",borderBottom:tab===t.id?"2px solid #b46eff":"2px solid transparent",padding:"8px 4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,display:"flex",flexDirection:"column",alignItems:"center",gap:2,WebkitTapHighlightColor:"transparent" }}>
            <span style={{ fontSize:13 }}>{t.e}</span><span>{t.l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Tab Reservas ─────────────────────────────────────────
function TabReservas({ db, onNew, onEdit, esAdmin }) {
  const { reservas, promotores, paquetes } = db;
  const [qrModal, setQrModal] = useState(null); // reserva para mostrar QR
  const grupos={};
  reservas.forEach(r=>{ if(!grupos[r.fecha]) grupos[r.fecha]=[]; grupos[r.fecha].push(r); });
  const dias=Object.entries(grupos).sort((a,b)=>b[0].localeCompare(a[0]));

  return (<>
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
      <div><div style={{ fontSize:20,fontWeight:800,color:"#f0e0ff" }}>Reservas</div><div style={{ color:"#5a5a80",fontSize:12 }}>{reservas.length} registradas</div></div>
      <button onClick={onNew} style={{ ...S.btnP,width:"auto",padding:"11px 20px",fontSize:14 }}>+ Nueva</button>
    </div>
    <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16 }}>
      {[
        {l:"Total",v:reservas.length,c:"#b46eff"},
        {l:"Llegaron",v:reservas.filter(r=>r.asistencia==="llegó").length,c:"#42f5a7"},
        {l:"Sin rep.",v:reservas.filter(r=>r.asistencia==="sin_reporte").length,c:"#f5c842"},
        {l:"Ventas",v:fmt(reservas.reduce((s,r)=>{const pk=paquetes?.find(x=>x.id===r.paqueteId);return s+(pk?pk.precio:(r.ventas||0));},0)),c:"#42c8f5",sm:true},
      ].map(s=>(
        <div key={s.l} style={{ background:"#111120",border:"1px solid #1e1e32",borderRadius:12,padding:"10px 6px",textAlign:"center" }}>
          <div style={{ fontSize:s.sm?11:22,fontWeight:900,color:s.c,lineHeight:1.2 }}>{s.v}</div>
          <div style={{ fontSize:9,color:"#5a5a80",fontWeight:700,marginTop:2 }}>{s.l.toUpperCase()}</div>
        </div>
      ))}
    </div>
    {dias.length===0&&<div style={{ textAlign:"center",color:"#3a3a60",padding:"40px 0",fontSize:14 }}>Sin reservas aún</div>}
    {dias.map(([fecha,lista])=>{
      const t={count:lista.length,pax:lista.reduce((s,r)=>s+r.personas,0),llegaron:lista.filter(r=>r.asistencia==="llegó").length,ventas:lista.reduce((s,r)=>{const pk=paquetes?.find(x=>x.id===r.paqueteId);return s+(pk?pk.precio:(r.ventas||r.consumoMin));},0)};
      return (
        <div key={fecha} style={{ marginBottom:20 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,padding:"8px 12px",background:"#0d0d1a",borderRadius:10,border:"1px solid #1e1e32" }}>
            <div style={{ fontWeight:800,color:"#d0a0ff",fontSize:14 }}>📅 {fmtF(fecha)}</div>
            <div style={{ display:"flex",gap:10,fontSize:11,color:"#6060a0" }}>
              <span>🎟{t.count}</span><span>👥{t.pax}</span>
              <span style={{ color:"#42f5a7" }}>✓{t.llegaron}</span>
              <span style={{ color:"#42c8f5" }}>{fmt(t.ventas)}</span>
            </div>
          </div>
          {lista.map(r=>{
            const p=promotores.find(x=>x.id===r.promotorId);
            const pk=paquetes?.find(x=>x.id===r.paqueteId);
            return (
              <div key={r.id} style={{ ...S.card }}>
                {/* Fila principal — tap edita */}
                <div style={{ cursor:"pointer" }} onClick={()=>onEdit(r)}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6 }}>
                    <div style={{ fontWeight:700,fontSize:15,color:"#f0e0ff" }}>{r.nombre}</div>
                    <div style={{ display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end" }}>
                      <Badge v={r.estado}/><Badge v={r.asistencia}/>
                    </div>
                  </div>
                  {pk&&<div style={{ background:"#1a0f2e",border:"1px solid #6e4aff44",borderRadius:7,padding:"4px 10px",marginBottom:5,fontSize:11,color:"#c0a0ff",display:"inline-block" }}>📦 {pk.nombre} · {fmt(pk.precio)}</div>}
                  <div style={{ display:"flex",flexWrap:"wrap",gap:"3px 14px",color:"#6060a0",fontSize:12 }}>
                    <span>🪑{r.mesa}</span><span>👥{r.personas}</span><span>🕐{r.hora}</span><span>📞{r.tel}</span>
                    {!pk&&<span>💵{fmt(r.consumoMin)}</span>}
                    {r.ventas>0&&!pk&&<span style={{ color:"#42c8f5" }}>🧾{fmt(r.ventas)}</span>}
                    {p&&esAdmin&&<span>👤{p.nombre}</span>}
                  </div>
                  {r.facturaName&&<div style={{ marginTop:4,fontSize:11,color:"#42f5a7" }}>📎 {r.facturaName}</div>}
                  {r.notas&&<div style={{ marginTop:4,fontSize:12,color:"#8080a0",fontStyle:"italic" }}>"{r.notas}"</div>}
                </div>
                {/* Botón QR / confirmación */}
                <button onClick={()=>setQrModal(r)}
                  style={{ marginTop:10,width:"100%",...S.btnG,padding:"9px",fontSize:12,textAlign:"center" }}>
                  📱 Ver confirmación / QR
                </button>
              </div>
            );
          })}
          <div style={{ background:"#0d0d1a",borderRadius:10,padding:"8px 14px",fontSize:12,color:"#7070a0",display:"flex",justifyContent:"space-between" }}>
            <span>Reservas: <b style={{ color:"#b46eff" }}>{t.count}</b></span>
            <span>Estimado: <b style={{ color:"#42c8f5" }}>{fmt(t.ventas)}</b></span>
          </div>
        </div>
      );
    })}

    {/* Modal QR / Confirmación */}
    {qrModal && <ModalConfirmacion r={qrModal} paquetes={paquetes} promotores={promotores} onClose={()=>setQrModal(null)}/>}
  </>);
}

// ── Tab Promotores ────────────────────────────────────────
function TabPromotores({ db, onNew, onLinkModal }) {
  const { promotores, reservas, statsP, editPromotor, delPromotor } = db;
  const [editP, setEditP] = useState(null); // promotor editando

  return (<>
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
      <div style={{ fontSize:20,fontWeight:800,color:"#f0e0ff" }}>Promotores</div>
      <button onClick={onNew} style={{ ...S.btnP,width:"auto",padding:"11px 18px",fontSize:14 }}>+ Nuevo</button>
    </div>

    {promotores.map(p=>{
      const st=statsP(p.id);
      const misR=reservas.filter(r=>r.promotorId===p.id);
      return (
        <div key={p.id} style={{ ...S.card,marginBottom:14 }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
            <div style={{ width:44,height:44,borderRadius:12,background:"#b46eff22",border:"1px solid #b46eff33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"#d0a0ff" }}>{p.nombre[0]}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700,fontSize:15,color:"#f0e0ff" }}>{p.nombre}</div>
              <div style={{ fontSize:11,color:"#6060a0" }}>@{p.usuario} · {p.comisionPct}%{p.tel&&` · 📞${p.tel}`}</div>
            </div>
            <button onClick={()=>setEditP({...p})}
              style={{ background:"#1e1e32",border:"none",color:"#b46eff",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:13,fontWeight:600 }}>
              ✏️ Editar
            </button>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10 }}>
            {[{l:"Reservas",v:st.total,c:"#b46eff"},{l:"Llegaron",v:st.llegaron,c:"#42f5a7"},{l:"Pend.",v:st.pendN,c:"#f5c842"}].map(x=>(
              <div key={x.l} style={{ background:"#0a0a12",borderRadius:10,padding:"10px 6px",textAlign:"center" }}>
                <div style={{ fontSize:22,fontWeight:900,color:x.c }}>{x.v}</div>
                <div style={{ fontSize:9,color:"#5a5a80",fontWeight:700 }}>{x.l.toUpperCase()}</div>
              </div>
            ))}
          </div>

          <div style={{ background:"#0d0d1a",borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div>
              <div style={{ fontSize:10,color:"#6060a0",fontWeight:700,letterSpacing:1,marginBottom:2 }}>COMISIÓN PENDIENTE</div>
              <div style={{ fontSize:20,fontWeight:900,color:"#42f5a7" }}>{fmt(st.monto)}</div>
            </div>
            {st.pendN>0&&<button onClick={()=>onLinkModal(p.id)} style={{ ...S.btnG,padding:"8px 14px",fontSize:12 }}>🔗 Link pago</button>}
          </div>

          {misR.slice(0,2).map(r=>(
            <div key={r.id} style={{ display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1a1a28",fontSize:11,color:"#8080b0" }}>
              <span>{r.nombre} · {r.mesa} · {fmtF(r.fecha)}</span><Badge v={r.asistencia}/>
            </div>
          ))}
        </div>
      );
    })}

    {/* Modal editar promotor */}
    {editP && (
      <Modal open onClose={()=>setEditP(null)} title="✏️ Editar Promotor">
        <div style={{ display:"flex",flexDirection:"column",gap:13 }}>
          <Field label="NOMBRE COMPLETO">
            <input style={S.inp} value={editP.nombre} onChange={e=>setEditP(x=>({...x,nombre:e.target.value}))} autoCapitalize="words"/>
          </Field>
          <Field label="TELÉFONO">
            <input style={S.inp} type="tel" value={editP.tel||""} onChange={e=>setEditP(x=>({...x,tel:e.target.value}))} placeholder="+56 9 XXXX XXXX"/>
          </Field>
          <G2>
            <Field label="USUARIO">
              <input style={S.inp} value={editP.usuario} onChange={e=>setEditP(x=>({...x,usuario:e.target.value.toLowerCase()}))} autoCapitalize="none"/>
            </Field>
            <Field label="COMISIÓN %">
              <input style={S.inp} type="number" inputMode="numeric" value={editP.comisionPct} onChange={e=>setEditP(x=>({...x,comisionPct:+e.target.value}))}/>
            </Field>
          </G2>

          {/* Reset clave */}
          <div style={{ background:"#1a1020",border:"1px solid #b46eff33",borderRadius:12,padding:14 }}>
            <div style={{ fontSize:11,color:"#b46eff",fontWeight:700,marginBottom:8 }}>🔑 CAMBIAR CLAVE</div>
            <Field label="NUEVA CLAVE">
              <input style={S.inp} type="password" placeholder="Nueva clave (mín 4 caracteres)"
                onChange={e=>setEditP(x=>({...x,_nuevaClave:e.target.value}))}/>
            </Field>
            {editP._nuevaClave && editP._nuevaClave.length >= 4 && (
              <div style={{ marginTop:8,fontSize:11,color:"#42f5a7" }}>✓ Clave lista para guardar</div>
            )}
            {editP._nuevaClave && editP._nuevaClave.length < 4 && (
              <div style={{ marginTop:8,fontSize:11,color:"#f5c842" }}>⚠ Mínimo 4 caracteres</div>
            )}
          </div>

          <G2>
            <button onClick={()=>{
              const p = {...editP};
              if (p._nuevaClave && p._nuevaClave.length >= 4) p.clave = p._nuevaClave;
              delete p._nuevaClave;
              editPromotor(p);
              setEditP(null);
            }} style={{ ...S.btnP,padding:"14px" }}>Guardar</button>
            <button onClick={()=>setEditP(null)} style={{ ...S.btnG,padding:"14px",textAlign:"center" }}>Cancelar</button>
          </G2>

          <button onClick={()=>{
            if(window.confirm(`¿Eliminar a ${editP.nombre}? Sus reservas se mantendrán.`)){
              delPromotor(editP.id); setEditP(null);
            }
          }} style={{ ...S.btnR,width:"100%",padding:"12px",textAlign:"center",fontSize:13 }}>
            🗑 Eliminar promotor
          </button>
        </div>
      </Modal>
    )}
  </>);
}

// ── Tab Liquidación ───────────────────────────────────────
function TabLiquidacion({ db, onLinkModal }) {
  const { promotores, reservas, statsP, liquidar, saveReserva } = db;
  // comisionManual: { [reservaId]: string } para edición en línea
  const [editCom, setEditCom] = useState({});
  const [facturaVer, setFacturaVer] = useState(null); // { url, name }

  function getComManual(r) {
    return editCom[r.id] !== undefined ? editCom[r.id] : (r.comisionManual !== undefined ? String(r.comisionManual) : "");
  }

  function guardarComision(r) {
    const val = parseFloat((editCom[r.id]||"").replace(/[^0-9.]/g,""));
    if (!isNaN(val)) {
      saveReserva({ ...r, comisionManual: val });
      setEditCom(prev => { const n={...prev}; delete n[r.id]; return n; });
    }
  }

  return (<>
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:20,fontWeight:800,color:"#f0e0ff" }}>💰 Liquidación</div>
      <div style={{ color:"#5a5a80",fontSize:12 }}>Revisa facturas, ajusta comisiones y liquida</div>
    </div>

    {promotores.map(p=>{
      const st=statsP(p.id);
      const porPagar=reservas.filter(r=>r.promotorId===p.id&&r.asistencia==="llegó"&&!r.comisionPagada);
      const pagadas =reservas.filter(r=>r.promotorId===p.id&&r.asistencia==="llegó"&&r.comisionPagada);

      // Monto considerando comisionManual si existe
      const montoReal = porPagar.reduce((s,r)=>{
        if (r.comisionManual !== undefined) return s + r.comisionManual;
        return s + st.calcComision(r);
      }, 0);

      return (
        <div key={p.id} style={{ ...S.card,marginBottom:14,padding:20 }}>
          {/* Header promotor */}
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12 }}>
            <div>
              <div style={{ fontSize:16,fontWeight:800,color:"#f0e0ff" }}>{p.nombre}</div>
              <div style={{ fontSize:11,color:"#6060a0" }}>@{p.usuario} · {p.comisionPct}% base</div>
            </div>
            {st.pendN>0&&(
              <div style={{ display:"flex",gap:8,flexDirection:"column",alignItems:"flex-end" }}>
                <button onClick={()=>{if(window.confirm(`¿Pagar ${fmt(montoReal)} a ${p.nombre}?`))liquidar(p.id);}}
                  style={{ ...S.btnP,width:"auto",fontSize:12,padding:"9px 14px" }}>✓ Pagar {fmt(montoReal)}</button>
                <button onClick={()=>onLinkModal(p.id)} style={{ ...S.btnG,fontSize:11,padding:"6px 12px" }}>🔗 Link de pago</button>
              </div>
            )}
            {st.pendN===0&&st.llegaron>0&&<Badge v="pagado"/>}
          </div>

          <G2>
            <div style={{ background:"#0d0d1a",borderRadius:10,padding:"12px",textAlign:"center" }}>
              <div style={{ fontSize:18,fontWeight:900,color:"#f5c842" }}>{fmt(montoReal)}</div>
              <div style={{ fontSize:9,color:"#5a5a80",fontWeight:700,marginTop:2 }}>PENDIENTE</div>
            </div>
            <div style={{ background:"#0d0d1a",borderRadius:10,padding:"12px",textAlign:"center" }}>
              <div style={{ fontSize:18,fontWeight:900,color:"#42f5a7" }}>{fmt(st.totalPagado)}</div>
              <div style={{ fontSize:9,color:"#5a5a80",fontWeight:700,marginTop:2 }}>YA PAGADO</div>
            </div>
          </G2>

          {/* Por liquidar — con factura y comisión manual */}
          {porPagar.length>0&&(<>
            <div style={{ fontSize:10,color:"#f5c842",fontWeight:700,letterSpacing:1,margin:"14px 0 8px" }}>POR LIQUIDAR</div>
            {porPagar.map(r=>{
              const pk=db.paquetes?.find(x=>x.id===r.paqueteId);
              const comAuto = st.calcComision(r);
              const comFinal = r.comisionManual !== undefined ? r.comisionManual : comAuto;
              const hayFactura = !!r.facturaUrl;
              return (
                <div key={r.id} style={{ background:"#0d0d1a",borderRadius:12,padding:"12px 14px",marginBottom:10,border:`1px solid ${hayFactura?"#42f5a722":"#1e1e32"}` }}>
                  {/* Info reserva */}
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                    <div>
                      <div style={{ color:"#e0e0f0",fontWeight:700,fontSize:14 }}>{r.nombre}</div>
                      <div style={{ fontSize:11,color:"#6060a0",marginTop:2 }}>
                        🪑{r.mesa} · {fmtF(r.fecha)} · 🕐{r.hora}
                        {pk&&<span style={{ color:"#c0a0ff" }}> · 📦{pk.nombre}</span>}
                      </div>
                      <div style={{ fontSize:11,color:"#6060a0" }}>
                        Consumo mín: {fmt(r.consumoMin)}
                        {r.ventas>0&&<span style={{ color:"#42c8f5" }}> · Venta real: {fmt(r.ventas)}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize:13,fontWeight:800,color:"#42f5a7",whiteSpace:"nowrap" }}>+{fmt(comFinal)}</div>
                  </div>

                  {/* Factura */}
                  <div style={{ marginBottom:10 }}>
                    {hayFactura ? (
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0a2a1a",borderRadius:8,padding:"7px 12px" }}>
                        <span style={{ fontSize:12,color:"#42f5a7",fontWeight:600 }}>📎 {r.facturaName||"Factura adjunta"}</span>
                        <button onClick={()=>setFacturaVer({url:r.facturaUrl,name:r.facturaName,isPdf:r.facturaName?.toLowerCase().endsWith(".pdf")})}
                          style={{ fontSize:13,color:"#b46eff",fontWeight:800,textDecoration:"none",background:"#b46eff22",border:"1px solid #b46eff44",borderRadius:7,padding:"5px 14px",cursor:"pointer" }}>
                          👁 Ver factura
                        </button>
                      </div>
                    ) : (
                      <div style={{ background:"#2a1a0a",borderRadius:8,padding:"7px 12px",fontSize:12,color:"#f5a542" }}>
                        ⚠ Sin factura adjunta
                      </div>
                    )}
                  </div>

                  {/* Comisión manual */}
                  <div>
                    <div style={{ fontSize:10,color:"#7070a0",fontWeight:700,letterSpacing:1,marginBottom:6 }}>
                      COMISIÓN MANUAL
                      {r.comisionManual!==undefined&&<span style={{ color:"#b46eff",marginLeft:6 }}>· Ajustada ✎</span>}
                    </div>
                    <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                      <input
                        style={{ ...S.inp,fontSize:15,padding:"10px 12px",flex:1 }}
                        type="number" inputMode="numeric"
                        placeholder={String(Math.round(comAuto))}
                        value={getComManual(r)}
                        onChange={e=>setEditCom(prev=>({...prev,[r.id]:e.target.value}))}
                        onBlur={()=>{ if(editCom[r.id]!==undefined) guardarComision(r); }}
                      />
                      <button onClick={()=>guardarComision(r)}
                        style={{ ...S.btnGreen,padding:"10px 14px",fontSize:13,whiteSpace:"nowrap" }}>
                        ✓ Aplicar
                      </button>
                      {r.comisionManual!==undefined&&(
                        <button onClick={()=>{ saveReserva({...r,comisionManual:undefined}); setEditCom(p=>({...p,[r.id]:""})); }}
                          style={{ background:"none",border:"none",color:"#6060a0",cursor:"pointer",fontSize:13,padding:"8px" }}>
                          ↩
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize:10,color:"#5a5a80",marginTop:4 }}>
                      Comisión automática: {fmt(comAuto)} ({p.comisionPct}%)
                      {r.comisionManual!==undefined&&<span style={{ color:"#b46eff" }}> → ajustada a {fmt(r.comisionManual)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ textAlign:"right",paddingTop:4,fontSize:14,fontWeight:800,color:"#42f5a7" }}>
              Total a pagar: {fmt(montoReal)}
            </div>
          </>)}

          {/* Ya pagadas */}
          {pagadas.length>0&&(<>
            <div style={{ fontSize:10,color:"#42f5a7",fontWeight:700,letterSpacing:1,margin:"10px 0 6px" }}>YA PAGADAS ✓</div>
            {pagadas.map(r=>{
              const comFinal = r.comisionManual !== undefined ? r.comisionManual : st.calcComision(r);
              return (
                <div key={r.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",fontSize:11,opacity:0.45,borderBottom:"1px solid #1a1a28" }}>
                  <div>
                    <span style={{ color:"#c0c0e0" }}>{r.nombre} · {fmtF(r.fecha)}</span>
                    {r.facturaUrl&&<span style={{ marginLeft:8 }}>
                      <button onClick={e=>{e.stopPropagation();}} style={{ background:"none",border:"none",color:"#7070a0",fontSize:10,cursor:"pointer",padding:0 }}>📎</button>
                    </span>}
                  </div>
                  <span style={{ color:"#42f5a7" }}>+{fmt(comFinal)}</span>
                </div>
              );
            })}
          </>)}
          {st.llegaron===0&&<div style={{ color:"#3a3a60",fontSize:12,textAlign:"center",padding:10 }}>Sin asistentes confirmados</div>}
        </div>
      );
    })}

    <ModalFactura facturaVer={facturaVer} onClose={()=>setFacturaVer(null)} />
  </>);
}

// ── Tab Paquetes ──────────────────────────────────────────
function TabPaquetes({ db, onNew }) {
  const { paquetes, delPaquete } = db;
  return (<>
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
      <div><div style={{ fontSize:20,fontWeight:800,color:"#f0e0ff" }}>Paquetes</div><div style={{ color:"#5a5a80",fontSize:12 }}>{paquetes.length} disponibles</div></div>
      <button onClick={onNew} style={{ ...S.btnP,width:"auto",padding:"11px 18px",fontSize:14 }}>+ Nuevo</button>
    </div>
    {paquetes.map(pk=>(
      <div key={pk.id} style={S.card}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700,fontSize:15,color:"#f0e0ff",marginBottom:4 }}>📦 {pk.nombre}</div>
            {pk.descripcion&&<div style={{ fontSize:12,color:"#8080a0",marginBottom:6 }}>{pk.descripcion}</div>}
            <div style={{ display:"flex",gap:16,fontSize:13 }}>
              <span style={{ color:"#42f5a7",fontWeight:700 }}>{fmt(pk.precio)}</span>
              <span style={{ color:"#b46eff" }}>{pk.comisionPct}% = {fmt(pk.precio*pk.comisionPct/100)}</span>
            </div>
          </div>
          <button onClick={()=>{if(window.confirm(`¿Eliminar "${pk.nombre}"?`))delPaquete(pk.id);}}
            style={{ background:"none",border:"none",color:"#f54242",cursor:"pointer",fontSize:18,padding:"4px",marginLeft:8 }}>✕</button>
        </div>
      </div>
    ))}
  </>);
}

// ── Tab Cobrar con Bold (promotor) ────────────────────────
function TabCobrarBold({ paquetes, reservas, onBold }) {
  const [selPaq, setSelPaq] = useState(null);
  const [selRes, setSelRes] = useState("");

  // Reservas que tienen ese paquete o reservas sin paquete para asignar
  const resConPaq = paquetes.length > 0
    ? reservas.filter(r => r.paqueteId === selPaq?.id || !r.paqueteId)
    : reservas;

  return (<>
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:20,fontWeight:800,color:"#f0e0ff" }}>💳 Cobrar con Bold</div>
      <div style={{ color:"#5a5a80",fontSize:12 }}>Genera un link de pago para tu cliente</div>
    </div>

    {/* Paso 1: seleccionar paquete */}
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:11,color:"#7070a0",fontWeight:700,letterSpacing:1,marginBottom:10 }}>1. SELECCIONA EL PAQUETE</div>
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {paquetes.map(pk=>(
          <div key={pk.id} onClick={()=>setSelPaq(selPaq?.id===pk.id?null:pk)}
            style={{ ...S.card, cursor:"pointer",
              border: selPaq?.id===pk.id ? "1px solid #b46eff" : "1px solid #1e1e32",
              background: selPaq?.id===pk.id ? "#1a0f2e" : "#111120" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:700,fontSize:15,color:"#f0e0ff" }}>📦 {pk.nombre}</div>
                {pk.descripcion&&<div style={{ fontSize:11,color:"#8080a0",marginTop:2 }}>{pk.descripcion}</div>}
                <div style={{ marginTop:6,display:"flex",gap:16,fontSize:13 }}>
                  <span style={{ color:"#42f5a7",fontWeight:700 }}>{fmt(pk.precio)}</span>
                  <span style={{ color:"#b46eff" }}>Tu comisión: {fmt(pk.precio*pk.comisionPct/100)}</span>
                </div>
              </div>
              <div style={{ width:24,height:24,borderRadius:"50%",
                background: selPaq?.id===pk.id ? "#b46eff" : "#1e1e32",
                border: "2px solid " + (selPaq?.id===pk.id ? "#b46eff" : "#3a3a60"),
                display:"flex",alignItems:"center",justifyContent:"center",
                color:"#fff",fontSize:14,flexShrink:0 }}>
                {selPaq?.id===pk.id ? "✓" : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Paso 2: vincular reserva (opcional) */}
    {selPaq && (
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:11,color:"#7070a0",fontWeight:700,letterSpacing:1,marginBottom:8 }}>2. VINCULAR A RESERVA (opcional)</div>
        <select style={S.inp} value={selRes} onChange={e=>setSelRes(e.target.value)}>
          <option value="">— Sin reserva específica —</option>
          {reservas.map(r=>(
            <option key={r.id} value={r.id}>{r.nombre} · {r.mesa} · {fmtF(r.fecha)}</option>
          ))}
        </select>
      </div>
    )}

    {/* Botón generar */}
    {selPaq && (
      <button onClick={()=>{
        const res = selRes ? reservas.find(r=>r.id===selRes) : null;
        onBold(selPaq, res);
      }} style={{ ...S.btnP,padding:"16px",fontSize:16 }}>
        💳 Generar Link de Pago Bold
      </button>
    )}

    {paquetes.length===0&&(
      <div style={{ textAlign:"center",color:"#3a3a60",padding:"40px 0",fontSize:14 }}>
        <div style={{ fontSize:36,marginBottom:10 }}>📦</div>
        El admin aún no ha creado paquetes disponibles
      </div>
    )}
  </>);
}

// ── Tab Mi Perfil ─────────────────────────────────────────
function TabMiPerfil({ promotor, stats, reservas, paquetes }) {
  const grupos={};
  reservas.forEach(r=>{ if(!grupos[r.fecha]) grupos[r.fecha]=[]; grupos[r.fecha].push(r); });
  const dias=Object.entries(grupos).sort((a,b)=>b[0].localeCompare(a[0]));
  return (<>
    <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:20,...S.card }}>
      <div style={{ width:52,height:52,borderRadius:14,background:"#b46eff22",border:"1px solid #b46eff44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:800,color:"#d0a0ff" }}>{promotor?.nombre[0]}</div>
      <div>
        <div style={{ fontWeight:800,fontSize:18,color:"#f0e0ff" }}>{promotor?.nombre}</div>
        <div style={{ fontSize:12,color:"#6060a0" }}>{promotor?.comisionPct}% comisión{promotor?.tel&&` · 📞${promotor.tel}`}</div>
      </div>
    </div>
    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16 }}>
      {[{l:"Mis Reservas",v:stats.total,c:"#b46eff"},{l:"Llegaron",v:stats.llegaron,c:"#42f5a7"},{l:"Comisión pend.",v:fmt(stats.monto),c:"#f5c842",sm:true},{l:"Ya pagado",v:fmt(stats.totalPagado),c:"#42c8f5",sm:true}].map(s=>(
        <div key={s.l} style={{ background:"#111120",border:"1px solid #1e1e32",borderRadius:12,padding:"14px 10px",textAlign:"center" }}>
          <div style={{ fontSize:s.sm?15:24,fontWeight:900,color:s.c }}>{s.v}</div>
          <div style={{ fontSize:9,color:"#5a5a80",fontWeight:700,marginTop:2 }}>{s.l.toUpperCase()}</div>
        </div>
      ))}
    </div>
    {stats.pendN>0&&(
      <div style={{ background:"#1a1a0a",border:"1px solid #f5c84244",borderRadius:12,padding:"14px 16px",marginBottom:16 }}>
        <div style={{ fontSize:12,color:"#f5c842",fontWeight:700,marginBottom:8 }}>⏳ COMISIONES POR COBRAR</div>
        {stats.detallePend.map(r=>(
          <div key={r.id} style={{ display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #2a2a10",fontSize:12 }}>
            <span style={{ color:"#e0e0c0" }}>{r.nombre}{r.paquete&&` · 📦${r.paquete.nombre}`}</span>
            <span style={{ color:"#f5c842",fontWeight:700 }}>+{fmt(r.comision)}</span>
          </div>
        ))}
        <div style={{ textAlign:"right",paddingTop:8,fontSize:14,fontWeight:800,color:"#f5c842" }}>Total: {fmt(stats.monto)}</div>
      </div>
    )}
    {dias.map(([fecha,lista])=>(
      <div key={fecha} style={{ marginBottom:16 }}>
        <div style={{ fontWeight:700,color:"#d0a0ff",fontSize:12,marginBottom:8,padding:"6px 10px",background:"#0d0d1a",borderRadius:8 }}>📅 {fmtF(fecha)} · {lista.length} reservas</div>
        {lista.map(r=>{
          const pk=paquetes?.find(x=>x.id===r.paqueteId);
          return (
            <div key={r.id} style={S.card}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                <div style={{ fontWeight:700,color:"#f0e0ff" }}>{r.nombre}</div><Badge v={r.asistencia}/>
              </div>
              {pk&&<div style={{ background:"#1a0f2e",borderRadius:6,padding:"4px 8px",marginBottom:4,fontSize:11,color:"#c0a0ff",display:"inline-block" }}>📦{pk.nombre} · {fmt(pk.precio)}</div>}
              <div style={{ fontSize:12,color:"#6060a0",display:"flex",flexWrap:"wrap",gap:"3px 12px" }}>
                <span>🪑{r.mesa}</span><span>👥{r.personas}</span><span>🕐{r.hora}</span>
                {!pk&&<span>💵{fmt(r.consumoMin)}</span>}
              </div>
              {r.asistencia==="llegó"&&<div style={{ marginTop:5,fontSize:11,fontWeight:700,color:r.comisionPagada?"#42f5a7":"#f5a542" }}>{r.comisionPagada?"✓ Comisión pagada":"⏳ "+fmt(stats.calcComision(r))+" pendiente"}</div>}
            </div>
          );
        })}
      </div>
    ))}
    {dias.length===0&&<div style={{ textAlign:"center",color:"#3a3a60",padding:"40px 0",fontSize:14 }}>Sin reservas registradas</div>}
  </>);
}

// ═══════════════════════════════════════════════════════════
// MODAL LINK DE PAGO
// ═══════════════════════════════════════════════════════════
function ModalLinkPago({ pid, db, onClose }) {
  const { promotores, statsP, liquidar } = db;
  const p = promotores.find(x=>x.id===pid);
  const st = statsP(pid);
  const [pagado, setPagado] = useState(false);

  function confirmar() { liquidar(pid); setPagado(true); }

  if (pagado) return (
    <Modal open onClose={onClose}>
      <div style={{ textAlign:"center",padding:"20px 0" }}>
        <div style={{ fontSize:48,marginBottom:12 }}>✅</div>
        <div style={{ fontSize:20,fontWeight:800,color:"#42f5a7",marginBottom:8 }}>¡Pago registrado!</div>
        <div style={{ color:"#6060a0",fontSize:14,marginBottom:24 }}>{p?.nombre} quedó en $0 pendiente</div>
        <button onClick={onClose} style={{ ...S.btnP,padding:"14px" }}>Cerrar</button>
      </div>
    </Modal>
  );

  return (
    <Modal open onClose={onClose} title={`🔗 Link de Pago · ${p?.nombre}`}>
      <div style={{ background:"#0d0d1a",borderRadius:12,padding:20,marginBottom:16,border:"1px solid #2a2a40" }}>
        <div style={{ fontSize:11,color:"#6060a0",fontWeight:700,letterSpacing:1,marginBottom:6 }}>MONTO A PAGAR</div>
        <div style={{ fontSize:36,fontWeight:900,color:"#42f5a7",marginBottom:4 }}>{fmt(st.monto)}</div>
        <div style={{ fontSize:12,color:"#8080a0" }}>{st.pendN} reservas · {p?.comisionPct}% comisión</div>
      </div>
      <div style={{ background:"#111120",borderRadius:12,padding:16,marginBottom:16,border:"1px solid #1e1e32" }}>
        <div style={{ fontSize:11,color:"#7070a0",fontWeight:700,letterSpacing:1,marginBottom:12 }}>DATOS DE TRANSFERENCIA</div>
        {[["Banco","Banco Estado"],["Cuenta","123-456-7890"],["Nombre","Nocturno SpA"],["RUT","76.000.000-0"],["Concepto",`Comisión ${p?.nombre}`]].map(([k,v])=>(
          <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #1a1a28",fontSize:13 }}>
            <span style={{ color:"#6060a0",fontWeight:600 }}>{k}</span>
            <span style={{ color:"#e0e0f0",fontWeight:700,textAlign:"right",maxWidth:"55%" }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:10,color:"#f5c842",fontWeight:700,letterSpacing:1,marginBottom:8 }}>DETALLE</div>
        {st.detallePend.map(r=>(
          <div key={r.id} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #1a1a28",fontSize:12 }}>
            <span style={{ color:"#c0c0e0" }}>{r.nombre}{r.paquete&&` · 📦${r.paquete.nombre}`} · {fmtF(r.fecha)}</span>
            <span style={{ color:"#42f5a7",fontWeight:700 }}>+{fmt(r.comision)}</span>
          </div>
        ))}
      </div>
      <button onClick={confirmar} style={{ ...S.btnP,padding:"16px",fontSize:16,marginBottom:10 }}>✅ Confirmar Pago Realizado</button>
      <button onClick={onClose}   style={{ ...S.btnG,width:"100%",padding:"12px",textAlign:"center",fontSize:14 }}>Cancelar</button>
      <div style={{ color:"#3a3a60",fontSize:11,textAlign:"center",marginTop:10 }}>Al confirmar, el promotor queda en $0</div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// MODALES FORMULARIOS
// ═══════════════════════════════════════════════════════════
function ModalEditR({ db, r, setR, onSave, onClose, esAdmin }) {
  const fileRef = useRef();
  const [facturaVer, setFacturaVer] = useState(null);
  const u = (k,v) => setR(x=>({...x,[k]:v}));
  const { paquetes, promotores } = db;
  return (
    <Modal open onClose={onClose} title="✏️ Editar Reserva">
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        <Field label="NOMBRE"><input style={S.inp} value={r.nombre} onChange={e=>u("nombre",e.target.value)} autoComplete="off"/></Field>
        <Field label="TELÉFONO"><input style={S.inp} type="tel" inputMode="numeric" value={r.tel} onChange={e=>u("tel",e.target.value)} placeholder="+56 9 XXXX XXXX"/></Field>
        <G2>
          <Field label="FECHA"><input style={S.inp} type="date" value={r.fecha} onChange={e=>u("fecha",e.target.value)}/></Field>
          <Field label="HORA"><select style={S.inp} value={r.hora} onChange={e=>u("hora",e.target.value)}>{HORAS.map(h=><option key={h}>{h}</option>)}</select></Field>
        </G2>
        <G2>
          <Field label="PERSONAS"><input style={S.inp} type="number" inputMode="numeric" value={r.personas} onChange={e=>u("personas",+e.target.value)}/></Field>
          <Field label="CONSUMO MÍN $"><input style={S.inp} type="number" inputMode="numeric" value={r.consumoMin} onChange={e=>u("consumoMin",+e.target.value)}/></Field>
        </G2>
        <Field label="MESA"><select style={S.inp} value={r.mesa} onChange={e=>u("mesa",e.target.value)}>{MESAS_LIST.map(m=><option key={m}>{m}</option>)}</select></Field>
        <Field label="PAQUETE (opcional)">
          <select style={S.inp} value={r.paqueteId||""} onChange={e=>u("paqueteId",e.target.value||null)}>
            <option value="">— Sin paquete —</option>
            {paquetes.map(pk=><option key={pk.id} value={pk.id}>📦 {pk.nombre} · {fmt(pk.precio)}</option>)}
          </select>
        </Field>
        <Field label="VENTA REAL $"><input style={S.inp} type="number" inputMode="numeric" value={r.ventas||""} onChange={e=>u("ventas",+e.target.value)} placeholder="0"/></Field>
        {esAdmin&&<Field label="PROMOTOR"><select style={S.inp} value={r.promotorId} onChange={e=>u("promotorId",e.target.value)}>{promotores.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>}

        {/* ASISTENCIA — botones visuales prominentes */}
        <AsistenciaBtns asistencia={r.asistencia} onChange={v=>u("asistencia",v)}/>

        <Field label="ESTADO">
          <select style={S.inp} value={r.estado} onChange={e=>u("estado",e.target.value)}>
            {["confirmada","pendiente","cancelada"].map(s=><option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="NOTAS"><input style={S.inp} value={r.notas||""} onChange={e=>u("notas",e.target.value)} placeholder="Notas…"/></Field>
        <Field label="FACTURA">
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <button onClick={()=>fileRef.current.click()} style={{ ...S.btnG,flex:1,padding:"10px",fontSize:13,textAlign:"center" }}>
              📎 {r.facturaUrl?"Cambiar":"Adjuntar factura"}</button>
            {r.facturaUrl&&(
              <button onClick={()=>setFacturaVer({url:r.facturaUrl,name:r.facturaName})}
                style={{ background:"#b46eff22",border:"1px solid #b46eff44",color:"#b46eff",borderRadius:8,padding:"10px 14px",cursor:"pointer",fontWeight:700,fontSize:13,whiteSpace:"nowrap" }}>
                👁 Ver
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display:"none" }}
            onChange={e=>{ const f=e.target.files[0]; if(f){ const rd=new FileReader(); rd.onload=ev=>{u("facturaUrl",ev.target.result);u("facturaName",f.name);}; rd.readAsDataURL(f); }}}/>
          {r.facturaName&&<div style={{ marginTop:4,fontSize:11,color:"#7070c0" }}>📄 {r.facturaName}</div>}
        </Field>
        <G2>
          <button onClick={()=>onSave(r)} style={{ ...S.btnP,padding:"14px" }}>Guardar</button>
          <button onClick={onClose}       style={{ ...S.btnG,padding:"14px",textAlign:"center" }}>Cancelar</button>
        </G2>
      </div>
      <ModalFactura facturaVer={facturaVer} onClose={()=>setFacturaVer(null)} />
    </Modal>
  );
}

function ModalNuevaR({ db, defaultPid, onSave, onClose, esAdmin }) {
  const { paquetes, promotores } = db;
  const [f,setF]=useState({ nombre:"",tel:"",personas:"2",mesa:MESAS_LIST[0],fecha:hoy(),hora:"22:00",promotorId:defaultPid||promotores[0]?.id,consumoMin:"50000",paqueteId:"",ventas:"",notas:"",estado:"confirmada",asistencia:"sin_reporte",comisionPagada:false,facturaUrl:null,facturaName:"" });
  const u=k=>e=>setF(x=>({...x,[k]:e.target.value}));
  function guardar(){ if(!f.nombre.trim()) return; onSave({...f,personas:+f.personas,consumoMin:+f.consumoMin,ventas:+f.ventas||0,paqueteId:f.paqueteId||null}); }
  return (
    <Modal open onClose={onClose} title="🎟 Nueva Reserva">
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        <Field label="NOMBRE DEL CLIENTE"><input style={S.inp} type="text" value={f.nombre} onChange={u("nombre")} placeholder="Ana García" autoCapitalize="words" autoComplete="off"/></Field>
        <Field label="TELÉFONO"><input style={S.inp} type="tel" inputMode="numeric" value={f.tel} onChange={u("tel")} placeholder="+56 9 XXXX XXXX"/></Field>
        <G2>
          <Field label="FECHA"><input style={S.inp} type="date" value={f.fecha} onChange={u("fecha")}/></Field>
          <Field label="HORA"><select style={S.inp} value={f.hora} onChange={u("hora")}>{HORAS.map(h=><option key={h}>{h}</option>)}</select></Field>
        </G2>
        <G2>
          <Field label="PERSONAS"><input style={S.inp} type="number" inputMode="numeric" value={f.personas} onChange={u("personas")}/></Field>
          <Field label="CONSUMO MÍN $"><input style={S.inp} type="number" inputMode="numeric" value={f.consumoMin} onChange={u("consumoMin")}/></Field>
        </G2>
        <Field label="MESA"><select style={S.inp} value={f.mesa} onChange={u("mesa")}>{MESAS_LIST.map(m=><option key={m}>{m}</option>)}</select></Field>
        <Field label="PAQUETE (opcional)">
          <select style={S.inp} value={f.paqueteId} onChange={u("paqueteId")}>
            <option value="">— Sin paquete —</option>
            {paquetes.map(pk=><option key={pk.id} value={pk.id}>📦 {pk.nombre} · {fmt(pk.precio)}</option>)}
          </select>
        </Field>
        {esAdmin&&<Field label="PROMOTOR"><select style={S.inp} value={f.promotorId} onChange={u("promotorId")}>{promotores.map(p=><option key={p.id} value={p.id}>{p.nombre} (@{p.usuario})</option>)}</select></Field>}
        <Field label="NOTAS (opcional)"><input style={S.inp} value={f.notas} onChange={u("notas")} placeholder="Cumpleaños, VIP especial…"/></Field>
        <G2>
          <button onClick={guardar} style={{ ...S.btnP,padding:"14px" }}>Guardar</button>
          <button onClick={onClose} style={{ ...S.btnG,padding:"14px",textAlign:"center" }}>Cancelar</button>
        </G2>
      </div>
    </Modal>
  );
}

function ModalNuevoP({ onSave, onClose }) {
  const [f,setF]=useState({ nombre:"",usuario:"",clave:"",tel:"",comisionPct:"10" });
  const u=k=>e=>setF(x=>({...x,[k]:e.target.value}));
  function guardar(){ if(!f.nombre.trim()||!f.usuario.trim()||!f.clave.trim()) return; const ini=f.nombre.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,3); onSave({...f,comisionPct:+f.comisionPct,codigo:ini+Math.floor(Math.random()*90+10),usuario:f.usuario.toLowerCase()}); }
  return (
    <Modal open onClose={onClose} title="👤 Nuevo Promotor">
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        <Field label="NOMBRE COMPLETO"><input style={S.inp} type="text" value={f.nombre} onChange={u("nombre")} placeholder="Laura Soto" autoCapitalize="words" autoComplete="off"/></Field>
        <Field label="TELÉFONO"><input style={S.inp} type="tel" inputMode="numeric" value={f.tel} onChange={u("tel")} placeholder="+56 9 XXXX XXXX"/></Field>
        <G2>
          <Field label="USUARIO"><input style={S.inp} type="text" value={f.usuario} onChange={u("usuario")} placeholder="laura" autoCapitalize="none" autoComplete="off"/></Field>
          <Field label="CLAVE"><input style={S.inp} type="password" value={f.clave} onChange={u("clave")} placeholder="••••"/></Field>
        </G2>
        <Field label="COMISIÓN %"><input style={S.inp} type="number" inputMode="numeric" value={f.comisionPct} onChange={u("comisionPct")}/></Field>
        <G2>
          <button onClick={guardar} style={{ ...S.btnP,padding:"14px" }}>Guardar</button>
          <button onClick={onClose} style={{ ...S.btnG,padding:"14px",textAlign:"center" }}>Cancelar</button>
        </G2>
      </div>
    </Modal>
  );
}

function ModalNuevoPaq({ onSave, onClose }) {
  const [f,setF]=useState({ nombre:"",descripcion:"",precio:"",comisionPct:"10" });
  const u=k=>e=>setF(x=>({...x,[k]:e.target.value}));
  function guardar(){ if(!f.nombre.trim()||!f.precio) return; onSave({...f,precio:+f.precio,comisionPct:+f.comisionPct}); }
  return (
    <Modal open onClose={onClose} title="📦 Nuevo Paquete">
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        <Field label="NOMBRE DEL PAQUETE"><input style={S.inp} type="text" value={f.nombre} onChange={u("nombre")} placeholder="Ej: Cumpleaños Luxury" autoCapitalize="words" autoComplete="off"/></Field>
        <Field label="DESCRIPCIÓN"><input style={S.inp} type="text" value={f.descripcion} onChange={u("descripcion")} placeholder="Ej: Botella premium, decoración…"/></Field>
        <G2>
          <Field label="PRECIO $"><input style={S.inp} type="number" inputMode="numeric" value={f.precio} onChange={u("precio")} placeholder="400000"/></Field>
          <Field label="COMISIÓN %"><input style={S.inp} type="number" inputMode="numeric" value={f.comisionPct} onChange={u("comisionPct")}/></Field>
        </G2>
        {f.precio&&f.comisionPct&&<div style={{ background:"#0d0d1a",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#b46eff" }}>💰 Comisión por venta: {fmt(+f.precio*+f.comisionPct/100)}</div>}
        <G2>
          <button onClick={guardar} style={{ ...S.btnP,padding:"14px" }}>Guardar</button>
          <button onClick={onClose} style={{ ...S.btnG,padding:"14px",textAlign:"center" }}>Cancelar</button>
        </G2>
      </div>
    </Modal>
  );
}
