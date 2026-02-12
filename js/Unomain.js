
    /* =========================================
       12 ARQUÉTIPOS - DATA DEFINITION
       ========================================= */
    const ARCHETYPES_DATA = [
      { key: "atlas",   name: "Atlas",   symbol: "♔", color: "#00f5ff", assistants: ["Cartesius-Estrategista", "Cartesius-Organizador"] },
      { key: "nova",    name: "Nova",    symbol: "✶", color: "#ff4bff", assistants: ["Inspira-Criadora", "Inspira-Pesquisadora"] },
      { key: "vitalis", name: "Vitalis", symbol: "⚑", color: "#39ffb6", assistants: ["Momentum-Motivador", "Momentum-Biohacker"] },
      { key: "pulse",   name: "Pulse",   symbol: "♪", color: "#ff4b6b", assistants: ["Resona-Composer", "Resona-Tuner"] },
      { key: "artemis", name: "Artemis", symbol: "☥", color: "#4caf50", assistants: ["Naviga-Explorador", "Naviga-Guia"] },
      { key: "serena",  name: "Serena",  symbol: "❤", color: "#00bcd4", assistants: ["Ampara-Acolhedora", "Ampara-Suporte"] },
      { key: "kaos",    name: "Kaos",    symbol: "⚡", color: "#ff9100", assistants: ["Disruptor-Crítico", "Disruptor-Inovador"] },
      { key: "genus",   name: "Genus",   symbol: "☯", color: "#795548", assistants: ["Fabricus-Arquitetor", "Fabricus-Construtor"] },
      { key: "lumine",  name: "Lumine",  symbol: "✧", color: "#ffeb3b", assistants: ["Lumen-Radiante", "Lumen-Harmônica"] },
      { key: "aion",    name: "Aion",    symbol: "∞", color: "#9c27b0", assistants: ["Aion-Orquestrador", "Aion-Transmutador"] },
      { key: "rhea",    name: "Rhea",    symbol: "⚜", color: "#e91e63", assistants: ["Rhea-Vínculo", "Rhea-Alento"] },
      { key: "horus",   name: "Horus",   symbol: "𓂀", color: "#2196f3", assistants: ["Horus-Visão", "Horus-Execução"] }
    ];

    const UNO = {
      state: {
        currentArch: 'atlas',
        user: '',
        key: ''
      },

      Store: {
        get: (k) => localStorage.getItem(k),
        set: (k,v) => localStorage.setItem(k,v),
        init: () => {
          UNO.state.user = UNO.Store.get('di_userName') || '';
          UNO.state.key  = UNO.Store.get('di_apiKey') || '';
          UNO.state.currentArch = UNO.Store.get('uno_arch') || 'atlas';
          
          document.getElementById('cfgName').value = UNO.state.user;
          document.getElementById('cfgKey').value = UNO.state.key;
        }
      },

      UI: {
        toggleHeader: (show) => {
          if(show) document.body.classList.add('show-header');
          else document.body.classList.remove('show-header');
        },

        nav: (target) => {
          // Hide all views
          document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
          // Show target
          const v = document.getElementById('v-'+target);
          if(v) v.classList.add('active');
          
          // Update tabs
          document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
          const activeBtn = document.querySelector(`.tab-btn[data-target="${target}"]`);
          if(activeBtn) activeBtn.classList.add('active');
        },

        renderArchSelector: () => {
          const container = document.getElementById('archListRow');
          container.innerHTML = ARCHETYPES_DATA.map(arch => `
            <div class="arch-chip ${arch.key === UNO.state.currentArch ? 'active' : ''}" 
                 onclick="UNO.UI.setArch('${arch.key}')">
              <span>${arch.symbol}</span>
              <span>${arch.name}</span>
            </div>
          `).join('');
        },

        setArch: (key) => {
          const arch = ARCHETYPES_DATA.find(a => a.key === key);
          if(!arch) return;
          
          UNO.state.currentArch = key;
          UNO.Store.set('uno_arch', key);
          
          // Update CSS Variables
          document.documentElement.style.setProperty('--arch-color', arch.color);
          document.documentElement.style.setProperty('--arch-glow', arch.color.replace(')', ', 0.3)')); // Hack simples pra alpha
          
          // Update UI Text
          document.getElementById('displayName').innerText = arch.name;
          document.getElementById('displaySymbol').innerText = arch.symbol;
          document.getElementById('displayAssistants').innerText = arch.assistants.join(" + ");
          
          // Refresh list active state
          UNO.UI.renderArchSelector();
        },
        
        feedback: (msg) => {
          // Simple toast could go here
          console.log("System:", msg);
        }
      },

      /* ORB SYSTEM 2.0 - SMOOTH PARTICLES */
      Orb: {
        init: () => {
          const canvas = document.getElementById('bg-canvas');
          const ctx = canvas.getContext('2d');
          
          let width, height;
          const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
          };
          window.addEventListener('resize', resize);
          resize();

          // Particle System
          const particles = [];
          const count = 35; 
          
          for(let i=0; i<count; i++){
            particles.push({
              x: Math.random() * width,
              y: Math.random() * height,
              radius: Math.random() * 3 + 1,
              speed: Math.random() * 0.005 + 0.002,
              angle: Math.random() * Math.PI * 2,
              amp: Math.random() * 50 + 20 // Amplitude do movimento
            });
          }

          function animate() {
            ctx.clearRect(0, 0, width, height);
            
            // Get current color from CSS variable for syncing
            const style = getComputedStyle(document.documentElement);
            const color = style.getPropertyValue('--arch-color').trim();
            
            ctx.fillStyle = color;
            
            particles.forEach(p => {
              // Smooth Sine Wave Motion
              p.angle += p.speed;
              const x = p.x + Math.cos(p.angle) * p.amp;
              const y = p.y + Math.sin(p.angle) * p.amp * 0.5; // Elliptical

              // Draw soft circle
              ctx.beginPath();
              ctx.arc(x, y, p.radius, 0, Math.PI * 2);
              ctx.globalAlpha = 0.4; // Transparency
              ctx.fill();
            });
            
            requestAnimationFrame(animate);
          }
          animate();
        }
      },

      init: () => {
        UNO.Store.init();
        UNO.UI.renderArchSelector();
        UNO.UI.setArch(UNO.state.currentArch);
        UNO.Orb.init();
        lucide.createIcons(); // Initialize Icons

        // Save Button Logic
        document.getElementById('btnSaveBrain').onclick = () => {
          const u = document.getElementById('cfgName').value;
          const k = document.getElementById('cfgKey').value;
          UNO.Store.set('di_userName', u);
          UNO.Store.set('di_apiKey', k);
          alert('Dados salvos no cérebro local.');
        };
        
        // Chat demo
        document.getElementById('btnSendChat').onclick = () => {
           const inp = document.getElementById('chatInput');
           if(!inp.value) return;
           const container = document.getElementById('chat-container');
           container.innerHTML += `<div class="card" style="background:var(--arch-glow); align-self:flex-end; max-width:80%; color:#fff">${inp.value}</div>`;
           inp.value = '';
           setTimeout(() => {
             container.innerHTML += `<div class="card" style="background:rgba(255,255,255,0.05); align-self:flex-start; max-width:80%">Processando via ${UNO.state.currentArch}...</div>`;
             container.scrollTop = container.scrollHeight;
           }, 500);
        };
      }
    };

    // Boot
    window.addEventListener('DOMContentLoaded', UNO.init);
  