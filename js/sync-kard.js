/* FUSION CORE LOGIC (V9 - THE MASTER)
   - Responsável por ditar o nome do usuário e o modelo para o Chat
*/

const STORAGE_KEY = 'fusion_os_data_v2';

// O Fusion é o primeiro a rodar e carregar os dados
async function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  
  const parsed = JSON.parse(raw);
  if (parsed.isEncrypted) {
    // Se estiver trancado, o Fusion espera a senha para liberar os dados pro Chat
    STATE.isEncrypted = true;
    STATE.encryptedData = parsed.data;
  } else {
    STATE.keys = parsed.data.keys || [];
    STATE.user = parsed.data.user || 'Convidado';
    
    // --- O FUSION IMPÕE AS REGRAS AQUI ---
    if (window.DI) {
        // 1. Impõe o Nome
        window.DI.set('di_userName', STATE.user);
        
        // 2. Impõe a Key Ativa
        const active = STATE.keys.find(k => k.active);
        if (active) window.DI.set('di_apiKey', active.token);
    }
    
    updateInterface(STATE.user);
    renderKeysList();
  }
}

// Quando o usuário muda o nome no Card do Fusion
els.input.addEventListener('input', (e) => { 
    const newName = e.target.value;
    STATE.user = newName;
    
    // Manda pro DI (O Chat vai ouvir e mudar na hora)
    if (window.DI) window.DI.set('di_userName', newName);
    
    updateInterface(newName);
    saveData(); 
});

// Quando o usuário muda o modelo no painel de Sistema do Fusion
els.saveSystemBtn.addEventListener('click', () => {
    const newInfodoseName = document.getElementById('infodoseNameInput').value.trim();
    const newModel = document.getElementById('modelSelect').value.trim();
    const newKey = document.getElementById('apiKeyInputSystem').value.trim();
    
    if (window.DI) {
        if (newModel) window.DI.set('di_modelName', newModel);
        if (newInfodoseName) window.DI.set('di_infodoseName', newInfodoseName);
        if (newKey) {
            window.DI.set('di_apiKey', newKey);
            // Atualiza a chave no estado interno do Fusion também
            const active = STATE.keys.find(k => k.active);
            if (active) active.token = newKey;
        }
    }
    
    saveData();
    showToaster('Fusion: Sistema Sincronizado', 'success');
});

// Função para ativar uma chave (Mestre)
window.setActiveKey = (id) => {
    STATE.keys.forEach(k => {
        k.active = (k.id === id);
        if (k.active && window.DI) {
            // O Fusion ordena que o Chat use esta chave agora
            window.DI.set('di_apiKey', k.token);
        }
    });
    saveData();
    renderKeysList();
    updateInterface(STATE.user);
    showToaster('Chave enviada para o Chat', 'success');
};

// ... restante da lógica de UI (drag, orb, etc) mantida do v8 ...

