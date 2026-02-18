/* =========================================================
   DUAL.INFODOSE v9.0 — KOBLLUX VISIO & MEMORIA
   - Slave Sync: O Chat agora obedece às ordens do Fusion Card
   - Central: window.DI como barramento de eventos
========================================================= */

window.DI = {
    get(key, fallback = '') {
        const v = localStorage.getItem(key);
        return (v === null) ? fallback : v;
    },
    set(key, value) {
        const valStr = String(value);
        localStorage.setItem(key, valStr);
        window.dispatchEvent(new CustomEvent('di:change', { detail: { key, value: valStr } }));
    },
    getBool(key, fallback = false) {
        return localStorage.getItem(key) === 'true';
    },
    setBool(key, value) {
        this.set(key, value ? 'true' : 'false');
    },
    // O Chat chama isso para se alinhar ao que o Fusion mandou
    syncFromFusion() {
        const userName = this.get(STORAGE.USER_ID, 'Viajante');
        const modelName = this.get(STORAGE.MODEL, 'auto');
        const infoName = this.get(STORAGE.INFODOSE_NAME, 'KOBLLUX');
        const apiKey = this.get(STORAGE.API_KEY, '');

        // Atualiza os elementos do Chat
        const uiUser = document.getElementById('usernameDisplay');
        if (uiUser) uiUser.textContent = userName;

        const inUser = document.getElementById('inputUserId');
        if (inUser) inUser.value = userName;

        const inModel = document.getElementById('inputModel');
        if (inModel) inModel.value = modelName;
        
        const inKey = document.getElementById('apiKeyInput');
        if (inKey) inKey.value = apiKey;

        const modeIndicator = document.getElementById('modeIndicator');
        if (modeIndicator) modeIndicator.textContent = `${infoName} · ${this.get(STORAGE.SOLAR_MODE, 'NIGHT').toUpperCase()}`;
        
        console.log('[DI] Chat sincronizado com as ordens do Fusion.');
    }
};

const STORAGE = {
    API_KEY: 'di_apiKey',
    MODEL: 'di_modelName',
    SYSTEM_ROLE: 'di_systemRole',
    USER_ID: 'di_userName',
    BG_IMAGE: 'di_bgImage',
    CUSTOM_CSS: 'di_customCss',
    SOLAR_MODE: 'di_solarMode',
    SOLAR_AUTO: 'di_solarAuto',
    INFODOSE_NAME: 'di_infodoseName',
    MESSAGES: 'di_messages'
};

const KODUX = {
    ARQUETIPOS: { "Atlas":{Essencia:"Planejador"}, "Nova":{Essencia:"Inspira"}, "Vitalis":{Essencia:"Momentum"}, "Pulse":{Essencia:"Emocional"}, "Artemis":{Essencia:"Descoberta"}, "Serena":{Essencia:"Cuidado"}, "Kaos":{Essencia:"Transformador"}, "Genus":{Essencia:"Fabricus"}, "Lumine":{Essencia:"Alegria"}, "Solus":{Essencia:"Sabedoria"}, "Rhea":{Essencia:"Vínculo"}, "Aion":{Essencia:"Tempo"} }
};

const App = {
    state: { open: false, messages: [], isAutoSolar: true, solarMode: 'night', isProcessing: false },
    
    init() {
        // Escuta mudanças vindo do Fusion
        window.addEventListener('di:change', (e) => {
            window.DI.syncFromFusion();
            if (e.detail.key === STORAGE.SOLAR_MODE) this.setMode(e.detail.value, false);
        });

        // Primeiro carrega o que tem no DI (que o Fusion já deve ter setado)
        window.DI.syncFromFusion();
        
        this.indexedDB.loadCustomCSS();
        this.indexedDB.loadBackground();
        this.bindEvents();
        this.renderDeck();
        
        // Auto Solar
        if (window.DI.getBool(STORAGE.SOLAR_AUTO, true)) this.autoByTime();
        else this.setMode(window.DI.get(STORAGE.SOLAR_MODE, 'night'), false);
    },

    async handleSend() {
        const input = document.getElementById('userInput');
        const txt = input.value.trim();
        if (!txt || this.state.isProcessing) return;

        input.value = '';
        this.addMessage('user', txt);
        this.state.isProcessing = true;
        
        // Sempre pega a Key e Modelo do DI (Mestre Fusion) na hora de enviar
        const key = window.DI.get(STORAGE.API_KEY);
        const model = window.DI.get(STORAGE.MODEL);

        try {
            document.body.classList.add('loading');
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: [ 
                        { role: 'system', content: document.getElementById('systemRoleInput').value },
                        ...this.state.messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: txt } 
                    ]
                })
            });
            const data = await res.json();
            this.addMessage('ai', data.choices?.[0]?.message?.content || "Sem sinal.");
        } catch (e) { this.showToast("Erro de Conexão", true); } 
        finally { document.body.classList.remove('loading'); this.state.isProcessing = false; }
    },

    addMessage(role, text) {
        const c = document.getElementById('chat-container');
        const d = document.createElement('div'); 
        d.className = `msg-block ${role}`;
        d.innerHTML = role === 'ai' ? marked.parse(text) : text;
        this.state.messages.push({ role: role==='ai'?'assistant':'user', content: text });
        c.appendChild(d); c.scrollTop = c.scrollHeight;
    },

    setMode(m, save = true) {
        document.body.classList.remove('mode-day', 'mode-sunset', 'mode-night');
        document.body.classList.add(`mode-${m}`);
        if(save) window.DI.set(STORAGE.SOLAR_MODE, m);
    },

    autoByTime() {
        const h = new Date().getHours();
        const mode = (h >= 6 && h < 17) ? 'day' : (h >= 17 && h < 19) ? 'sunset' : 'night';
        this.setMode(mode, true);
    },

    bindEvents() {
        document.getElementById('btnSend').onclick = () => this.handleSend();
        document.getElementById('userInput').onkeypress = (e) => { if(e.key === 'Enter') this.handleSend(); };
        document.getElementById('btnSaveConfig').onclick = () => {
            // Configurações do Drawer (Chat) ainda podem salvar no DI
            window.DI.set(STORAGE.SYSTEM_ROLE, document.getElementById('systemRoleInput').value);
            this.indexedDB.saveCustomCSS(document.getElementById('customCssInput').value);
            this.showToast("Configurações do Chat Salvas");
        };
    },

    indexedDB: {
        async getDB() { return new Promise((r,j)=>{const q=indexedDB.open("InfodoseDB",2); q.onsuccess=e=>r(e.target.result);}); },
        async putAsset(i,d){(await this.getDB()).transaction(['assets'],'readwrite').objectStore('assets').put({id:i,...d});},
        async getAsset(i){return new Promise(async r=>(await this.getDB()).transaction(['assets']).objectStore('assets').get(i).onsuccess=e=>r(e.target.result));},
        async saveCustomCSS(c){await this.putAsset(STORAGE.CUSTOM_CSS,{css:c});},
        async loadCustomCSS(){const d=await this.getAsset(STORAGE.CUSTOM_CSS); if(d?.css) document.getElementById('custom-styles').textContent=d.css;},
        async loadBackground(){const d=await this.getAsset(STORAGE.BG_IMAGE); if(d?.blob) document.getElementById('bg-fake-custom').style.backgroundImage=`url('${URL.createObjectURL(d.blob)}')`;}
    },
    showToast(m, err=false) { console.log(m); },
    renderDeck() {} 
};

window.onload = () => App.init();

