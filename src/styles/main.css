/* ── Variables ── */
:root {
  --navy: #0f2a5c;
  --navy2: #1a3d7c;
  --green: #2d8a4e;
  --green2: #3aab62;
  --green-bg: #f0faf3;
  --red: #c0392b;
  --red-bg: #fef2f2;
  --amber: #b7770d;
  --amber-bg: #fffbeb;
  --blue: #1a56db;
  --blue-bg: #eff6ff;
  --bg: #f4f6f9;
  --surface: #ffffff;
  --border: #e2e7ef;
  --text: #111827;
  --text2: #4b5563;
  --text3: #9ca3af;
  --radius: 12px;
  --radius-sm: 8px;
  --shadow: 0 1px 4px rgba(0,0,0,.07), 0 4px 16px rgba(0,0,0,.04);
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'DM Sans', -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
  min-height: 100vh;
}
.hidden { display: none !important; }
.screen { min-height: 100vh; }
.screen.hidden { display: none !important; }

/* ── LOGIN ── */
.login-bg {
  position: fixed; inset: 0;
  background: linear-gradient(135deg, var(--navy) 0%, var(--navy2) 50%, #1a5c2e 100%);
  z-index: 0;
  overflow: hidden;
}
.login-orb {
  position: absolute; border-radius: 50%;
  filter: blur(80px); opacity: .25;
}
.orb1 { width: 400px; height: 400px; background: var(--green2); top: -100px; right: -100px; }
.orb2 { width: 300px; height: 300px; background: #5b9bd5; bottom: -80px; left: -80px; }
.login-card {
  position: relative; z-index: 1;
  background: rgba(255,255,255,.97);
  border-radius: 18px;
  padding: 36px 32px;
  width: 100%; max-width: 380px;
  margin: 0 auto;
  top: 50%; transform: translateY(-50%);
  box-shadow: 0 20px 60px rgba(0,0,0,.3);
}
.login-logo-wrap { text-align: center; margin-bottom: 16px; }
.login-logo { width: 90px; height: 90px; object-fit: contain; }
.login-title { font-size: 20px; font-weight: 600; color: var(--navy); text-align: center; margin-bottom: 4px; }
.login-sub { font-size: 12px; color: var(--text3); text-align: center; margin-bottom: 24px; }
.login-hint { font-size: 12px; color: var(--text3); text-align: center; margin-top: 12px; min-height: 18px; }

/* ── APP SHELL ── */
.app { display: flex; flex-direction: column; min-height: 100vh; max-width: 720px; margin: 0 auto; }

/* ── TOPBAR ── */
.topbar {
  background: var(--navy);
  padding: 10px 16px;
  display: flex; justify-content: space-between; align-items: center;
  position: sticky; top: 0; z-index: 20;
  box-shadow: 0 2px 8px rgba(0,0,0,.2);
}
.topbar-left { display: flex; align-items: center; gap: 10px; }
.topbar-logo { width: 34px; height: 34px; object-fit: contain; border-radius: 6px; background: rgba(255,255,255,.1); padding: 2px; }
.topbar-title { font-size: 14px; font-weight: 600; color: #fff; }
.topbar-sub { font-size: 10px; color: rgba(255,255,255,.55); }
.topbar-right { display: flex; align-items: center; gap: 8px; }
.user-chip { display: flex; align-items: center; gap: 7px; }
.user-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--green2); color: #fff;
  font-size: 12px; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
.user-info { line-height: 1.2; }
.user-name { font-size: 12px; color: #fff; font-weight: 500; }
.user-role { font-size: 10px; color: rgba(255,255,255,.55); text-transform: capitalize; }
.btn-icon { background: none; border: none; cursor: pointer; color: rgba(255,255,255,.7); padding: 4px; border-radius: 6px; display: flex; align-items: center; }
.btn-icon:hover { color: #fff; background: rgba(255,255,255,.1); }

/* ── NAV ── */
.nav {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex; overflow-x: auto; -webkit-overflow-scrolling: touch;
  position: sticky; top: 57px; z-index: 19;
  scrollbar-width: none;
}
.nav::-webkit-scrollbar { display: none; }
.nav-btn {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 11px; font-size: 10.5px; color: var(--text2);
  border: none; background: none; cursor: pointer;
  border-bottom: 2.5px solid transparent;
  white-space: nowrap; min-width: 58px; font-family: inherit;
  transition: color .15s, border-color .15s;
}
.nav-btn svg { color: var(--text3); transition: color .15s; }
.nav-btn.active { color: var(--navy); border-bottom-color: var(--green); font-weight: 500; }
.nav-btn.active svg { color: var(--green); }
.alert-dot { background: var(--red); color: #fff; font-size: 10px; padding: 1px 5px; border-radius: 10px; margin-left: 2px; }

/* ── MAIN ── */
.main { flex: 1; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.tab { display: flex; flex-direction: column; gap: 12px; }
.tab.hidden { display: none; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
.page-title { font-size: 17px; font-weight: 600; color: var(--navy); }
.page-date { font-size: 12px; color: var(--text3); }

/* ── CARDS ── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
}
.card-header { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 12px; }

/* ── METRICS ── */
.metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
@media(min-width:500px) { .metrics { grid-template-columns: repeat(4, 1fr); } }
.metric-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 14px 12px;
  display: flex; align-items: center; gap: 10px;
  box-shadow: var(--shadow);
}
.metric-icon {
  width: 38px; height: 38px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.metric-icon.green { background: var(--green-bg); color: var(--green); }
.metric-icon.red { background: var(--red-bg); color: var(--red); }
.metric-icon.amber { background: var(--amber-bg); color: var(--amber); }
.metric-icon.blue { background: var(--blue-bg); color: var(--blue); }
.metric-val { font-size: 22px; font-weight: 600; font-family: 'DM Mono', monospace; color: var(--navy); }
.metric-label { font-size: 11px; color: var(--text2); margin-top: 1px; }

/* ── FORMS ── */
.form-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
label { font-size: 12px; font-weight: 500; color: var(--text2); }
.input, select {
  width: 100%; padding: 9px 11px; font-size: 13px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); color: var(--text);
  outline: none; font-family: inherit; transition: border-color .15s;
}
.input:focus, select:focus { border-color: var(--green2); box-shadow: 0 0 0 3px rgba(45,138,78,.1); }
.hint { font-size: 12px; color: var(--text3); }

/* ── BUTTONS ── */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 16px; font-size: 13px; font-weight: 500;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); color: var(--text);
  cursor: pointer; font-family: inherit; transition: all .15s;
}
.btn:hover { background: var(--bg); }
.btn:active { opacity: .85; transform: scale(.99); }
.btn-primary { background: var(--navy); color: #fff; border-color: var(--navy); }
.btn-primary:hover { background: var(--navy2); }
.btn-green { background: var(--green); color: #fff; border-color: var(--green); }
.btn-green:hover { background: var(--green2); }
.btn-full { width: 100%; }
.btn-sm { padding: 5px 10px; font-size: 12px; }

/* ── SCANNER ── */
.scan-found {
  background: var(--green-bg); color: var(--green);
  font-size: 13px; font-weight: 600;
  padding: 8px 12px; border-radius: var(--radius-sm);
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 10px;
}
.scan-info-row {
  display: flex; justify-content: space-between;
  font-size: 13px; padding: 5px 0;
  border-bottom: 1px solid var(--border);
}
.scan-info-row:last-child { border-bottom: none; }
.scan-info-row span:first-child { color: var(--text2); }

/* ACTION SELECTOR */
.action-selector { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
.action-label { font-size: 12px; font-weight: 600; color: var(--text2); margin-bottom: 10px; text-transform: uppercase; letter-spacing: .5px; }
.action-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.action-btn {
  display: flex; flex-direction: column; align-items: center;
  padding: 16px 10px; border: 2px solid var(--border);
  border-radius: var(--radius); background: var(--surface);
  cursor: pointer; transition: all .15s; gap: 4px;
}
.action-btn:hover { border-color: var(--navy); background: #f8faff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.08); }
.action-btn.selected-entrada { border-color: var(--green); background: var(--green-bg); }
.action-btn.selected-salida { border-color: var(--red); background: var(--red-bg); }
.action-icon { font-size: 22px; font-weight: 700; }
.action-icon.green { color: var(--green); }
.action-icon.red { color: var(--red); }
.action-text { font-size: 13px; font-weight: 600; color: var(--text); }
.action-sub { font-size: 11px; color: var(--text3); }

/* PIN MODAL */
.modal-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal-card {
  background: var(--surface); border-radius: var(--radius);
  padding: 28px 24px; width: 100%; max-width: 360px;
  box-shadow: 0 20px 60px rgba(0,0,0,.3);
}
.modal-title { font-size: 16px; font-weight: 600; color: var(--navy); margin-bottom: 6px; }
.modal-sub { font-size: 13px; color: var(--text2); margin-bottom: 16px; }

/* ── LISTS ── */
.mov-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid var(--border);
}
.mov-item:last-child { border-bottom: none; }
.mov-dot {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; flex-shrink: 0;
}
.mov-dot.entrada { background: var(--green-bg); color: var(--green); }
.mov-dot.salida { background: var(--red-bg); color: var(--red); }
.mov-body { flex: 1; min-width: 0; }
.mov-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mov-meta { font-size: 11px; color: var(--text2); margin-top: 2px; }
.mov-qty { font-size: 13px; font-weight: 600; white-space: nowrap; font-family: 'DM Mono', monospace; }
.mov-qty.entrada { color: var(--green); }
.mov-qty.salida { color: var(--red); }

.inv-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px solid var(--border); gap: 10px;
}
.inv-item:last-child { border-bottom: none; }
.inv-name { font-size: 13px; font-weight: 500; }
.inv-sub { font-size: 11px; color: var(--text3); margin-top: 2px; }
.inv-stock { font-size: 14px; font-weight: 600; font-family: 'DM Mono', monospace; text-align: right; }
.inv-right { text-align: right; flex-shrink: 0; }

.pedido-item { padding: 10px 0; border-bottom: 1px solid var(--border); }
.pedido-item:last-child { border-bottom: none; }
.pedido-name { font-size: 13px; font-weight: 500; }
.pedido-meta { font-size: 11px; color: var(--text2); margin-top: 2px; }

.user-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid var(--border);
}
.user-item:last-child { border-bottom: none; }
.user-item-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--navy); color: #fff;
  font-size: 13px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.user-item-body { flex: 1; min-width: 0; }
.user-item-name { font-size: 13px; font-weight: 500; }
.user-item-email { font-size: 11px; color: var(--text3); }

.alert-item { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); align-items: flex-start; }
.alert-item:last-child { border-bottom: none; }
.alert-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.alert-icon.danger { background: var(--red-bg); color: var(--red); }
.alert-icon.warn { background: var(--amber-bg); color: var(--amber); }
.alert-name { font-size: 13px; font-weight: 500; }
.alert-detail { font-size: 11px; color: var(--text2); margin-top: 2px; }

/* ── BADGES ── */
.badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 500; }
.badge-ok { background: var(--green-bg); color: var(--green); }
.badge-warn { background: var(--amber-bg); color: var(--amber); }
.badge-danger { background: var(--red-bg); color: var(--red); }
.badge-info { background: var(--blue-bg); color: var(--blue); }
.badge-admin { background: #f3f0ff; color: #6d28d9; }
.badge-supervisor { background: #fff7ed; color: #c2410c; }
.badge-operador { background: var(--green-bg); color: var(--green); }

/* ── ROL SELECT ── */
.rol-select { display: flex; gap: 6px; align-items: center; }
.rol-select select { padding: 4px 8px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border); }

/* ── TOAST ── */
.toast {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: var(--navy); color: #fff;
  padding: 10px 20px; border-radius: var(--radius); font-size: 13px;
  z-index: 999; white-space: nowrap; max-width: 90vw;
  animation: fadein .2s;
}
@keyframes fadein { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
.loading { text-align: center; color: var(--text3); padding: 24px; font-size: 13px; }
.empty { text-align: center; color: var(--text3); padding: 24px; font-size: 13px; }

/* ── NUEVAS CLASES v3 ── */
.offline-banner{background:var(--amber-bg);border:1px solid #fcd34d;border-radius:var(--radius-sm);padding:8px 12px;font-size:12px;color:var(--amber);margin-bottom:12px;text-align:center}
.offline-dot{color:#f59e0b;font-size:16px;margin-right:4px}
.sync-banner{background:var(--amber-bg);border:1px solid #fcd34d;border-radius:var(--radius-sm);padding:10px 14px;font-size:13px;color:var(--amber);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.rep-table{width:100%;border-collapse:collapse;font-size:12px}
.rep-table th{background:var(--navy);color:#fff;padding:6px 8px;text-align:left;font-size:11px}
.rep-table td{padding:5px 8px;border-bottom:1px solid var(--border)}
.rep-table tr:nth-child(even){background:var(--bg)}
.aud-item{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);align-items:flex-start}
.aud-item:last-child{border-bottom:none}
.aud-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.aud-icon.login{background:var(--blue-bg);color:var(--blue)}
.aud-icon.rol{background:#f3f0ff;color:#6d28d9}
.aud-icon.prod{background:var(--green-bg);color:var(--green)}
.aud-icon.mov{background:var(--amber-bg);color:var(--amber)}
.aud-name{font-size:13px;font-weight:500}
.aud-meta{font-size:11px;color:var(--text2);margin-top:2px}

/* ── SCANNER v4 ── */
.action-btns-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.action-icon.blue{color:var(--blue)}
.alta-header{display:flex;gap:12px;align-items:flex-start;padding:14px;background:var(--amber-bg);border:1px solid #fcd34d;border-radius:var(--radius-sm);margin-bottom:14px}
.alta-icon{font-size:28px;flex-shrink:0}
.alta-title{font-size:14px;font-weight:600;color:var(--amber);margin-bottom:3px}
.alta-sub{font-size:12px;color:var(--text2);line-height:1.5}

/* ── FOTOS DE EVIDENCIA v5 ── */
.foto-zona{border:2px dashed var(--border);border-radius:var(--radius-sm);padding:16px;text-align:center;margin:10px 0;cursor:pointer;transition:border-color .15s;background:var(--bg)}
.foto-zona:hover{border-color:var(--green)}
.foto-zona input[type=file]{display:none}
.foto-zona-label{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer}
.foto-zona-icon{font-size:28px}
.foto-zona-text{font-size:13px;font-weight:500;color:var(--text)}
.foto-zona-hint{font-size:11px;color:var(--text3)}
.foto-preview{width:100%;max-height:200px;object-fit:contain;border-radius:var(--radius-sm);margin-top:8px;border:1px solid var(--border)}
.foto-status{font-size:12px;padding:4px 10px;border-radius:20px;font-weight:500;margin-top:6px;display:inline-block}
.foto-status.sin-foto{background:var(--red-bg);color:var(--red)}
.foto-status.con-foto{background:var(--green-bg);color:var(--green)}
.foto-label{font-size:12px;font-weight:500;color:var(--text2);margin-bottom:4px;display:block}
.mov-foto{margin-top:6px}
.mov-foto a{font-size:11px;color:var(--blue);text-decoration:none;display:inline-flex;align-items:center;gap:4px}
.mov-foto a:hover{text-decoration:underline}
.foto-modal{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
.foto-modal img{max-width:100%;max-height:90vh;border-radius:var(--radius);object-fit:contain}
.foto-modal-close{position:absolute;top:16px;right:16px;background:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center}
