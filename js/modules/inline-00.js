/* FUSION CORE KERNEL (V8 - ARCHITECTURE READY)
   • Single Source of Truth (STATE)
   • Integrated Background Engine
   • System Role Awareness
   • Event-Driven Sync
*/

lucide.createIcons();

// --- DOM REFERENCES ---
const els = {
  // Core UI
  card: document.getElementById('mainCard'),
  header: document.getElementById('cardHeader'),
  avatarTgt: document.getElementById('avatarTarget'),
  input: document.getElementById('inputUser'),
  
  // Text & Labels
  lblHello: document.getElementById('lblHello'),
  lblName: document.getElementById('lblName'),
  clock: document.getElementById('clockTime'),
  
  // Status & Previews
  smallPreview: document.getElementById('smallPreview'),
  smallMiniAvatar: document.getElementById('smallMiniAvatar'),
  smallText: document.getElementById('smallText'),
  smallIdent: document.getElementById('smallIdent'),
  
  // Activation / Meta
  actCard: document.getElementById('activationCard'),
  actPre: document.getElementById('actPre'),
  actName: document.getElementById('actName'),
  actMiniAvatar: document.getElementById('actMiniAvatar'),
  actBadge: document.getElementById('actBadge'),
  
  // Navigation & Modes
  btnModeCard: document.getElementById('btnModeCard'),
  btnModeOrb: document.getElementById('btnModeOrb'),
  btnModeHud: document.getElementById('btnModeHud'),
  orbMenuTrigger: document.getElementById('orbMenuTrigger'),
  hudMenuBtn: document.getElementById('hudMenuBtn'),
  snapZone: document.getElementById('snap-zone'),
  
  // Keys & Security UI
  keysModal: document.getElementById('keysModal'),
  keyList: document.getElementById('keyList'),
  keyName: document.getElementById('keyNameInput'),
  keyToken: document.getElementById('keyTokenInput'),
  addKeyBtn: document.getElementById('addKeyBtn'),
  closeKeysBtn: document.getElementById('closeKeysBtn'),
  lockVaultBtn: document.getElementById('lockVaultBtn'),
  vaultStatusText: document.getElementById('vaultStatusText'),
  vaultModal: document.getElementById('vaultModal'),
  vaultPass: document.getElementById('vaultPassInput'),
  vaultUnlock: document.getElementById('vaultUnlockBtn'),
  vaultCancel: document.getElementById('vaultCancelBtn'),
  
  // System Config
  systemCard: document.getElementById('systemCard'),
  saveSystemBtn: document.getElementById('saveSystemBtn'),
  copyActBtn: document.getElementById('copyActBtn'),
  
  // Background specific (Dynamic)
  bgInput: document.getElementById('bgUploadInput') // Will be checked dynamically
};

// --- CORE HELPERS (SYNC & EVENTS) ---

// 1. Centralized DI Sync (External Comms & Persistence)
function syncDi(key, value) {
    if(!key) return;
    try {
        localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
        // Barramento para Iframe Pai / Host / Extensões
        window.dispatchEvent(new CustomEvent('di:updated', { detail: { key, value } }));
    } catch(e) { console.warn('Storage Quota or Parse Error', e); }
}

// 2. Internal Event Bus (Reactive UI)
function emitUpdate() {
    window.dispatchEvent(new CustomEvent('app:update'));
}

// 3. Listener Central de UI
window.addEventListener('app:update', () => {
    updateInterface(STATE.user);
    renderKeysList();
    BgEngine.render(); // Renderiza o background ativo
});

// --- CRYPTO UTILS ---
const CRYPTO = {
  algo: { name: 'AES-GCM', length: 256 },
  pbkdf2: { name: 'PBKDF2', hash: 'SHA-256', iterations: 100000 },
  async getKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return window.crypto.subtle.deriveKey({ ...this.pbkdf2, salt: salt }, keyMaterial, this.algo, false, ["encrypt", "decrypt"]);
  },
  async encrypt(data, password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.getKey(password, salt);
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encoded);
    const bundle = { s: Array.from(salt), iv: Array.from(iv), d: Array.from(new Uint8Array(encrypted)) };
    return JSON.stringify(bundle);
  },
  async decrypt(bundleStr, password) {
    try {
      const bundle = JSON.parse(bundleStr);
      const salt = new Uint8Array(bundle.s);
      const iv = new Uint8Array(bundle.iv);
      const data = new Uint8Array(bundle.d);
      const key = await this.getKey(password, salt);
      const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch(e) { throw new Error("Senha incorreta ou dados corrompidos"); }
  }
};

// --- DATA STATE (PERSISTENCE) ---
const STORAGE_KEY = 'fusion_os_data_v2';
const UI_STATE_KEY = 'fusion_os_ui_state';

// CORE STATE: A Fonte de Verdade
let STATE = {
  keys: [], 
  user: 'Convidado',
  systemRole: 'Standard Assistant', // NOVO: Comportamento do Agente
  isEncrypted: false,
  encryptedData: null,
  bg: { // NOVO: Gerenciamento de Background Integrado
      active: null, 
      store: [] // {id, data (base64/url), name}
  }
};
let SESSION_PASSWORD = null;

// Initial Sync Load Helpers
let apiKey = localStorage.getItem('di_apiKey') || '';
let modelName = localStorage.getItem('di_modelName') || 'nvidia/nemotron-3-nano-30b-a3b:free';
let userName = localStorage.getItem('di_userName') || '';
let infodoseName = localStorage.getItem('di_infodoseName') || '';

// --- GESTURE STATE (PHYSICS/UI) ---
let gestureState = {
    isOrb: false,
    isHud: false,
    isDragging: false,
    timer: null,
    startX: 0,
    startY: 0,
    dragOffsetX: 0,
    dragOffsetY: 0,
    pointerId: null
};

// --- BACKGROUND ENGINE (PLUGIN LOGIC) ---
const BgEngine = {
    init: () => {
        // Garante que existe o elemento de background no DOM
        let bgEl = document.getElementById('app-background');
        if(!bgEl) {
            bgEl = document.createElement('div');
            bgEl.id = 'app-background';
            bgEl.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;background-size:cover;background-position:center;transition:background-image 0.5s ease;pointer-events:none;`;
            document.body.prepend(bgEl);
        }
        // Carrega do LocalStorage separado se existir (para persistência cross-session fora do cofre)
        const savedBg = localStorage.getItem('di_bgActive');
        if(savedBg && !STATE.bg.active) STATE.bg.active = savedBg;
        
        const savedStore = localStorage.getItem('di_bgStore');
        if(savedStore) {
             try { STATE.bg.store = JSON.parse(savedStore); } catch(e){}
        }
    },
    render: () => {
        const bgEl = document.getElementById('app-background');
        if(!STATE.bg.active) {
            bgEl.style.backgroundImage = '';
            bgEl.style.backgroundColor = '#080b12'; // Fallback dark
            return;
        }
        
        // Verifica se é URL direta ou ID do store
        const fromStore = STATE.bg.store.find(i => i.id === STATE.bg.active);
        if(fromStore) {
            bgEl.style.backgroundImage = `url('${fromStore.data}')`;
        } else if (STATE.bg.active.startsWith('http') || STATE.bg.active.startsWith('data:')) {
            bgEl.style.backgroundImage = `url('${STATE.bg.active}')`;
        }
    },
    upload: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const res = e.target.result;
                const id = 'bg_' + Date.now();
                const item = { id, data: res, name: file.name };
                
                // Limite de segurança simples para LS (aprox 2MB por img para não explodir)
                if(res.length > 2500000) {
                    showToaster('Imagem muito grande para armazenamento local.', 'error');
                    reject('File too large');
                    return;
                }

                STATE.bg.store.push(item);
                STATE.bg.active = id;
                
                // Persistência
                syncDi('di_bgStore', STATE.bg.store);
                syncDi('di_bgActive', id);
                
                emitUpdate();
                resolve(item);
            };
            reader.readAsDataURL(file);
        });
    }
};

// --- PERSISTENCE LOGIC ---
function saveUIState() {
    const mode = gestureState.isOrb ? 'orb' : (gestureState.isHud ? 'hud' : 'card');
    const uiState = {
        mode: mode,
        left: els.card.style.left,
        top: els.card.style.top
    };
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(uiState));
}

function loadUIState() {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if(!raw) return;
    try {
        const ui = JSON.parse(raw);
        if (ui.mode === 'orb' || ui.mode === 'hud') {
            els.card.style.transition = 'none'; 
            if (ui.mode === 'orb') {
                if(ui.left) els.card.style.left = ui.left;
                if(ui.top) els.card.style.top = ui.top;
                CardAPI.setMode('orb', true);
            } else {
                CardAPI.setMode('hud', true);
            }
            setTimeout(() => els.card.style.transition = '', 200);
        }
    } catch(e) { console.error("UI Load Error", e); }
}

function saveData() {
  const payload = { keys: STATE.keys, user: STATE.user, systemRole: STATE.systemRole };
  // Nota: BG Store é salvo separadamente via syncDi para não pesar na criptografia crítica
  
  if (SESSION_PASSWORD) {
    CRYPTO.encrypt(payload, SESSION_PASSWORD).then(enc => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ isEncrypted: true, data: enc }));
      STATE.isEncrypted = true;
      STATE.encryptedData = enc;
      updateSecurityUI();
    });
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ isEncrypted: false, data: payload }));
  }
}

async function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  
  // Load System Role External (Sync check)
  const extRole = localStorage.getItem('di_systemRole');
  if(extRole) STATE.systemRole = extRole;

  if (!raw) {
      emitUpdate(); return;
  }

  const parsed = JSON.parse(raw);
  if (parsed.isEncrypted) {
    STATE.isEncrypted = true;
    STATE.encryptedData = parsed.data;
    updateSecurityUI();
  } else {
    STATE.keys = parsed.data.keys || [];
    STATE.user = parsed.data.user || 'Convidado';
    if(parsed.data.systemRole) STATE.systemRole = parsed.data.systemRole;
    
    // CRITICAL: Restore di_apiKey from active key
    const active = STATE.keys.find(k=>k.active);
    if(active && active.token) {
       syncDi('di_apiKey', active.token);
       apiKey = active.token;
    }
    
    // CRITICAL: Restore di_userName
    if(STATE.user !== 'Convidado') {
       syncDi('di_userName', STATE.user);
       userName = STATE.user;
       if(document.getElementById('inputUser')) document.getElementById('inputUser').value = STATE.user;
    }
    
    // CRITICAL: Sync System Role
    syncDi('di_systemRole', STATE.systemRole);

    emitUpdate(); // Trigger UI refresh
  }
  
  // Update System Config Inputs
  if(document.getElementById('apiKeyInput')) document.getElementById('apiKeyInput').value = apiKey;
  if(document.getElementById('infodoseNameInput')) document.getElementById('infodoseNameInput').value = infodoseName;
  if(document.getElementById('modelSelect')) document.getElementById('modelSelect').value = modelName;
  if(document.getElementById('systemRoleInput')) document.getElementById('systemRoleInput').value = STATE.systemRole;
}

const hashStr = s => { let h=0xdeadbeef; for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),2654435761);} return (h^h>>>16)>>>0; };
const createSvg = (id,sz) => `<svg viewBox="0 0 100 100" width="${sz}" height="${sz}"><defs><linearGradient id="g${id}"><stop offset="0%" stop-color="#00f2ff"/><stop offset="100%" stop-color="#bd00ff"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="#080b12" stroke="rgba(255,255,255,0.1)"/><circle cx="50" cy="50" r="20" fill="url(#g${id})" opacity="0.9"/></svg>`;
const createMiniSvg = (name,sz=30) => {
  const s = hashStr(name||'D'); const h1=s%360; const h2=(s*37)%360;
  const grad = `<linearGradient id="gm${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1},90%,50%)"/><stop offset="1" stop-color="hsl(${h2},90%,50%)"/></linearGradient>`;
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 32 32"><defs>${grad}</defs><rect width="32" height="32" rx="8" fill="#0a1016"/><circle cx="16" cy="16" r="6" fill="url(#gm${s})"/></svg>`;
};

function updateInterface(name){
  const safe = name || 'Convidado';
  els.lblName.innerText = safe;
  els.input.value = safe;
  const activeKey = STATE.keys.find(k=>k.active);
  els.smallIdent.innerText = activeKey ? activeKey.name : '--';
  els.actBadge.innerText = activeKey ? `key:${activeKey.name}` : 'v:--';
  els.smallMiniAvatar.innerHTML = createMiniSvg(safe);
  els.actMiniAvatar.innerHTML = createMiniSvg(safe,36);
  els.actName.innerText = safe;
  els.avatarTgt.innerHTML = createSvg('Main',64);
  const phrases = ["Foco estável.","Ritmo criativo.","Percepção sutil."];
  els.smallText.innerText = activeKey ? `${activeKey.name} [ATIVO]` : (safe==='Convidado'?'Aguardando...':`${safe} · ${phrases[safe.length%phrases.length]}`);
  const line = `+${'-'.repeat(safe.length+4)}+`;
  els.actPre.innerText = `${line}\n| ${safe.toUpperCase()} |\n${line}\nID: ${hashStr(safe).toString(16)}`;
}

function updateSecurityUI() {
  if (SESSION_PASSWORD) {
    els.vaultStatusText.innerText = "Cofre Protegido (Destrancado)"; els.lockVaultBtn.innerText = "TRANCAR";
  } else if (STATE.isEncrypted) {
    els.vaultStatusText.innerText = "Cofre Trancado"; els.lockVaultBtn.innerText = "REDEFINIR";
  } else {
    els.vaultStatusText.innerText = "Cofre Aberto (Sem senha)"; els.lockVaultBtn.innerText = "CRIAR SENHA";
  }
}

function renderKeysList(){
  els.keyList.innerHTML = '';
  if(STATE.keys.length===0){ els.keyList.innerHTML = '<div style="color:rgba(255,255,255,0.3);text-align:center;padding:20px">Nenhuma chave armazenada.</div>'; return; }
  STATE.keys.forEach(k=>{
    const div = document.createElement('div');
    div.className = `key-item ${k.active?'active-item':''}`;
    div.innerHTML = `
      <div class="meta" style="flex:1"><div style="font-weight:700;font-size:0.9rem">${escapeHtml(k.name)}</div></div>
      <div class="actions">
        ${!k.active ? `<button class="small-btn" onclick="CardAPI.setActiveKey('${k.id}')">ATIVAR</button>` : `<span style="font-size:0.7rem;font-weight:700;color:var(--neon-cyan);margin-right:10px">ATIVA</span>`}
        <button class="small-btn danger" onclick="CardAPI.removeKey('${k.id}')"><i data-lucide="trash-2" style="width:14px"></i></button>
      </div>`;
    els.keyList.appendChild(div);
  });
  lucide.createIcons();
}

function addKey() {
  const name = els.keyName.value.trim();
  const token = els.keyToken.value.trim();
  if(!name){ showToaster('Nome obrigatório','error'); return; }
  const newKey = { id: Date.now().toString(36), name, token, active: STATE.keys.length===0 };
  STATE.keys.push(newKey);
  
  if(newKey.active && newKey.token) {
    syncDi('di_apiKey', newKey.token);
    apiKey = newKey.token;
  }
  
  saveData(); 
  emitUpdate(); 
  els.keyName.value=''; els.keyToken.value='';
  showToaster('Chave adicionada!', 'success');
}

// --- GLOBAL API (CardAPI) - The Kernel Interface ---
window.CardAPI = {
    // Key Management
    removeKey: (id) => {
        if(confirm('Remover chave permanentemente?')){
            STATE.keys = STATE.keys.filter(k=>k.id!==id);
            saveData(); emitUpdate();
        }
    },
    setActiveKey: (id) => {
        let activatedToken = null;
        STATE.keys.forEach(k=> {
            k.active = (k.id===id);
            if(k.active) activatedToken = k.token;
        });
        if(activatedToken) {
            syncDi('di_apiKey', activatedToken);
            apiKey = activatedToken;
            if(document.getElementById('apiKeyInput')) document.getElementById('apiKeyInput').value = activatedToken;
            showToaster('Chave sincronizada.', 'success');
        }
        saveData(); emitUpdate();
    },
    // Mode Management
    setMode: (mode, isInitialLoad = false) => {
        updateModeButtons(mode);
        if(mode === 'card') {
            revertToCard();
        } else if (mode === 'orb') {
            gestureState.isOrb = true; gestureState.isHud = false;
            els.card.classList.add('orb', 'closed');
            els.card.classList.remove('hud', 'content-visible');
            els.card.style.transform = 'none';
        } else if (mode === 'hud') {
            gestureState.isHud = true; gestureState.isOrb = false;
            els.card.classList.add('hud', 'closed'); 
            els.card.classList.remove('orb', 'content-visible');
            els.card.style.top = ''; els.card.style.left = ''; els.card.style.transform = '';
        }
        if(!isInitialLoad) saveUIState();
    },
    // Background Management
    triggerBgUpload: () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => {
            if(e.target.files && e.target.files[0]) {
                BgEngine.upload(e.target.files[0])
                    .then(() => showToaster('Background atualizado', 'success'))
                    .catch(err => console.error(err));
            }
        };
        document.body.appendChild(fileInput);
        fileInput.click();
        setTimeout(() => fileInput.remove(), 1000);
    },
    clearBackground: () => {
        STATE.bg.active = null;
        syncDi('di_bgActive', '');
        emitUpdate();
        showToaster('Background removido', 'success');
    }
};

// Aliases
window.removeKey = CardAPI.removeKey;
window.setActiveKey = CardAPI.setActiveKey;
window.setMode = CardAPI.setMode;

// --- VAULT EVENTS ---
function openManager() {
  if (STATE.isEncrypted && !SESSION_PASSWORD) { els.vaultModal.style.display='flex'; els.vaultPass.focus(); } 
  else { els.keysModal.style.display='flex'; }
}
els.vaultUnlock.addEventListener('click', async () => {
  const pass = els.vaultPass.value;
  try {
    const decrypted = await CRYPTO.decrypt(STATE.encryptedData, pass);
    SESSION_PASSWORD = pass; 
    STATE.keys = decrypted.keys; 
    STATE.user = decrypted.user;
    if(decrypted.systemRole) STATE.systemRole = decrypted.systemRole;

    const active = STATE.keys.find(k=>k.active);
    if(active && active.token) { syncDi('di_apiKey', active.token); apiKey = active.token; }
    if(STATE.user) { syncDi('di_userName', STATE.user); userName = STATE.user; }
    if(STATE.systemRole) { syncDi('di_systemRole', STATE.systemRole); }
    
    els.vaultModal.style.display='none'; els.keysModal.style.display='flex'; els.vaultPass.value='';
    renderKeysList(); updateSecurityUI(); showToaster('Cofre destrancado.', 'success');
  } catch(e) { showToaster('Senha incorreta.', 'error'); }
});
els.lockVaultBtn.addEventListener('click', () => {
   if (!SESSION_PASSWORD && !STATE.isEncrypted) {
     const newPass = prompt("Defina uma senha para o Cofre:");
     if(newPass) { SESSION_PASSWORD=newPass; saveData(); showToaster("Cofre trancado.", 'success'); }
   } else if (SESSION_PASSWORD) {
     SESSION_PASSWORD=null; els.keysModal.style.display='none'; showToaster("Sessão do cofre encerrada.", 'success');
   } else {
     showToaster("Cofre já criptografado. Desbloqueie para redefinir.", 'error');
   }
   updateSecurityUI();
});
els.vaultCancel.addEventListener('click', ()=> els.vaultModal.style.display='none');
els.closeKeysBtn.addEventListener('click', ()=> els.keysModal.style.display='none');
els.addKeyBtn.addEventListener('click', addKey);

// --- CINEMATIC GESTURES ---
const HUD_SNAP_THRESHOLD = 60;
const SWIPE_DOWN_THRESHOLD = 80;
const LONG_PRESS_MS = 350;

els.card.addEventListener('pointerdown', handleStart, { passive: false });
window.addEventListener('pointermove', handleMove, { passive: false });
window.addEventListener('pointerup', handleEnd, { passive: false });

els.avatarTgt.addEventListener('click', (e)=>{ if(!gestureState.isOrb && !gestureState.isHud) openManager(); });
els.orbMenuTrigger.addEventListener('click', (e)=>{ e.stopPropagation(); CardAPI.setMode('card'); toggleSection('systemCard', true); });
els.hudMenuBtn.addEventListener('click', (e)=>{ e.stopPropagation(); CardAPI.setMode('card'); toggleSection('systemCard', true); });
els.header.addEventListener('click', (e) => {
    if(gestureState.isHud && !gestureState.isDragging && !e.target.closest('.hud-menu-btn')) {
         CardAPI.setMode('card'); toggleSection('systemCard', true);
    }
});
els.card.addEventListener('contextmenu', (e)=>{
    if(gestureState.isOrb || gestureState.isHud) { e.preventDefault(); CardAPI.setMode('card'); }
});

function handleStart(e) {
  if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || (e.target.tagName === 'BUTTON' && !e.target.closest('.orb-menu-trigger'))) return;
  if(!gestureState.isOrb && !gestureState.isHud && !els.header.contains(e.target)) return;
  gestureState.startX = e.clientX; gestureState.startY = e.clientY; gestureState.pointerId = e.pointerId;
  if(gestureState.isOrb || gestureState.isHud) {
      gestureState.isDragging = true;
      try { els.card.setPointerCapture(e.pointerId); } catch(err){}
      const rect = els.card.getBoundingClientRect();
      gestureState.dragOffsetX = e.clientX - rect.left; gestureState.dragOffsetY = e.clientY - rect.top;
      els.card.style.transition = 'none'; return;
  }
  gestureState.timer = setTimeout(() => { transmuteToOrb(e); saveUIState(); }, LONG_PRESS_MS);
}

function handleMove(e) {
  if(!gestureState.isOrb && !gestureState.isHud && gestureState.timer) {
      const dx = e.clientX - gestureState.startX; const dy = e.clientY - gestureState.startY;
      if (Math.hypot(dx, dy) > 12 && (dy < -10 || Math.abs(dx) > 18)) { 
          clearTimeout(gestureState.timer); gestureState.timer = null;
          transmuteToOrb(e); 
          const rect = els.card.getBoundingClientRect();
          gestureState.dragOffsetX = e.clientX - rect.left; gestureState.dragOffsetY = e.clientY - rect.top;
          try { els.card.setPointerCapture(e.pointerId); } catch(err){}
          els.card.style.transition = 'none';
      }
  }
  if(!gestureState.isDragging) return;
  e.preventDefault();
  if(gestureState.isOrb) {
      const x = e.clientX - gestureState.dragOffsetX; const y = e.clientY - gestureState.dragOffsetY;
      els.card.style.left = `${x}px`; els.card.style.top = `${y}px`;
      if(y < HUD_SNAP_THRESHOLD) els.snapZone.classList.add('active'); else els.snapZone.classList.remove('active');
  } else if (gestureState.isHud) {
      const deltaY = e.clientY - gestureState.startY;
      if(deltaY > 0) {
         els.card.style.transform = `translateX(-50%) translateY(${deltaY * 0.4}px)`;
         if(deltaY > SWIPE_DOWN_THRESHOLD) els.snapZone.classList.add('active'); else els.snapZone.classList.remove('active');
      }
  }
}

function handleEnd(e) {
  if(gestureState.timer){ clearTimeout(gestureState.timer); gestureState.timer=null; }
  if(gestureState.isDragging) {
      gestureState.isDragging = false;
      try { els.card.releasePointerCapture && els.card.releasePointerCapture(gestureState.pointerId); } catch(err){}
      els.card.style.transition = ''; els.snapZone.classList.remove('active');
      if(gestureState.isOrb) {
          const rect = els.card.getBoundingClientRect();
          if(rect.top < HUD_SNAP_THRESHOLD) CardAPI.setMode('hud'); else saveUIState();
      } else if (gestureState.isHud) {
          if ((e.clientY - gestureState.startY) > SWIPE_DOWN_THRESHOLD) {
              els.card.style.left = `${e.clientX - 34}px`; els.card.style.top = `${e.clientY - 10}px`; CardAPI.setMode('orb');
          } else els.card.style.transform = `translateX(-50%) translateY(0)`;
      }
  } else {
      if(!gestureState.isOrb && !gestureState.isHud && els.header.contains(e.target)) toggleCardState();
  }
  gestureState.pointerId = null;
}

function transmuteToOrb(eOrX) {
  let x, y, ev;
  if(eOrX && eOrX.clientX !== undefined) { ev = eOrX; x = ev.clientX; y = ev.clientY; } else return;
  if(navigator.vibrate) navigator.vibrate(40);
  els.card.classList.add('orb','closed'); els.card.classList.remove('content-visible');
  els.card.style.left = (x - 34) + 'px'; els.card.style.top = (y - 34) + 'px';
  gestureState.isOrb=true; gestureState.isHud=false; gestureState.isDragging = true;
  if(ev && ev.pointerId) {
      gestureState.pointerId = ev.pointerId;
      try { els.card.setPointerCapture(ev.pointerId); } catch(e){}
      const rect = els.card.getBoundingClientRect();
      gestureState.dragOffsetX = x - rect.left; gestureState.dragOffsetY = y - rect.top;
  }
  updateModeButtons('orb');
}

function revertToCard() {
  gestureState.isOrb=false; gestureState.isHud=false;
  els.card.style.transition='all 0.5s var(--ease-smooth)'; els.card.style.left=''; els.card.style.top=''; els.card.style.width=''; els.card.style.height=''; els.card.style.transform='';
  els.card.classList.remove('orb','hud','closed'); setTimeout(()=>els.card.classList.add('content-visible'),300);
}

function updateModeButtons(mode) {
    [els.btnModeCard, els.btnModeOrb, els.btnModeHud].forEach(b=>b.classList.remove('active-mode'));
    if(mode==='card') els.btnModeCard.classList.add('active-mode');
    if(mode==='orb') els.btnModeOrb.classList.add('active-mode');
    if(mode==='hud') els.btnModeHud.classList.add('active-mode');
}

function toggleCardState() {
  if(els.card.classList.contains('animating')) return;
  const isClosed=els.card.classList.contains('closed'); els.card.classList.add('animating');
  if(isClosed) { els.card.classList.remove('closed'); els.card.animate([{transform:'scale(0.95)',opacity:0.8},{transform:'scale(1)',opacity:1}],{duration:400}).onfinish=()=>{els.card.classList.remove('animating');els.card.classList.add('content-visible');} }
  else { els.card.classList.remove('content-visible'); els.card.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(10px)',opacity:1}],{duration:200}).onfinish=()=>{els.card.classList.add('closed');els.card.classList.remove('animating');} }
}

function escapeHtml(s){ return s ? s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : ''; }
function showToaster(txt,type='default'){ const t=document.createElement('div'); t.className=`toaster ${type}`; t.innerText=txt; document.getElementById('toasterWrap').appendChild(t); setTimeout(()=>t.classList.add('show'),10); setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},2500); }
function toggleSection(id, forceOpen = false){ 
    const el = document.getElementById(id);
    const h = el.classList.contains('activation-hidden'); 
    if(forceOpen && !h) return; 
    el.classList.toggle('activation-hidden', !forceOpen && !h); el.classList.toggle('activation-open', forceOpen || h); 
}

// Logic Init
els.input.addEventListener('input', (e)=>{ 
   STATE.user=e.target.value; 
   syncDi('di_userName', STATE.user); 
   emitUpdate(); saveData(); 
});

els.copyActBtn.addEventListener('click', async () => {
    try {
      const txt = document.getElementById('actPre').innerText;
      await navigator.clipboard.writeText(txt);
      showToaster('Ativação copiada', 'success');
    } catch(e){ showToaster('Erro ao copiar ativação', 'error'); }
});

els.saveSystemBtn.addEventListener('click', () => {
     infodoseName = document.getElementById('infodoseNameInput').value.trim();
     const newKey = document.getElementById('apiKeyInput').value.trim();
     const newModel = document.getElementById('modelSelect').value.trim();
     const newRole = document.getElementById('systemRoleInput').value.trim(); // Get new role
     
     if(newKey) {
         apiKey = newKey;
         syncDi('di_apiKey', apiKey);
         if(typeof STATE !== 'undefined') {
             const active = STATE.keys.find(k=>k.active);
             if(active) { active.token = newKey; saveData(); }
         }
     }
     
     modelName = newModel || modelName;
     syncDi('di_modelName', modelName);
     syncDi('di_infodoseName', infodoseName);
     
     if(newRole) {
         STATE.systemRole = newRole;
         syncDi('di_systemRole', STATE.systemRole);
         saveData();
     }
     
     toggleSection('systemCard', false);
     showToaster('Sistema reconfigurado.', 'success');
});

// SYSTEM KERNEL BOOT
// 1. Init internal engines
BgEngine.init();

// 2. Load Data & State
loadData(); 

// 3. UI Hydration (Next Frame)
requestAnimationFrame(() => {
    loadUIState();
    els.card.classList.add('active'); 
    els.avatarTgt.classList.add('shown'); 
});

setInterval(()=>{ els.clock.innerText = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); },1000);
