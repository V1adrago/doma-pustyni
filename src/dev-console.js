// Dev Console — developer overlay for quick match start, unit spawn, speed control.
// Toggle with backtick (`) key or the [🛠 DEV] button.

const UNIT_LIST = [
  { id: 'scout',     name: '⚡ Ищейка Барханов'   },
  { id: 'swordsman', name: '⚔ Клинок Дома'         },
  { id: 'assault',   name: '🛡 Башнелом'            },
  { id: 'archer',    name: '🏹 Песчаный Стрелок'    },
  { id: 'spearman',  name: '🔱 Пикейщик Каравана'  },
  { id: 'drone',     name: '✦ Дюнный Сокол'         },
  { id: 'heavy',     name: '🪖 Латник Пустыни'      },
  { id: 'guard',     name: '⛨ Гвардеец Чести'       },
  { id: 'engineer',  name: '⚙ Инженер Узла'         },
];

const CSS = `
#dc-fab {
  position: fixed;
  top: 8px; left: 8px;
  z-index: 9999;
  background: rgba(10,8,6,0.80);
  color: #9a8060;
  border: 1px solid #3a2a10;
  border-radius: 4px;
  padding: 4px 9px;
  font: 700 11px/1 monospace;
  cursor: pointer;
  letter-spacing: 1px;
  user-select: none;
  transition: background 0.15s, color 0.15s;
}
#dc-fab:hover { background: rgba(40,30,14,0.95); color: #f0c060; border-color: #8a6030; }

#dc-panel {
  position: fixed;
  top: 36px; left: 8px;
  z-index: 9998;
  background: rgba(10,8,5,0.96);
  border: 1px solid #3a2a10;
  border-radius: 6px;
  width: 260px;
  padding: 10px 12px 12px;
  font: 12px/1.5 monospace;
  color: #bbb;
  box-shadow: 0 6px 28px rgba(0,0,0,0.8);
  backdrop-filter: blur(4px);
}
#dc-panel.dc-hidden { display: none; }

.dc-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 9px;
  padding-bottom: 7px;
  border-bottom: 1px solid #2a1e08;
}
.dc-head-title { font: 700 11px/1 monospace; color: #c89040; letter-spacing: 2px; text-transform: uppercase; }
.dc-close { cursor: pointer; color: #5a4020; font-size: 14px; line-height: 1; padding: 0 2px; }
.dc-close:hover { color: #aa6030; }

.dc-sec { margin-bottom: 10px; }
.dc-sec-lbl {
  font: 700 9px/1 monospace;
  color: #7a5a28;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 5px;
}

.dc-row { display: flex; gap: 4px; flex-wrap: wrap; }

.dc-btn {
  background: #181410;
  border: 1px solid #2e2010;
  color: #aaa;
  padding: 5px 8px;
  font: 11px/1 monospace;
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.dc-btn:hover { background: #28200e; border-color: #7a5020; color: #e0c070; }
.dc-btn.dc-on { background: #362610; border-color: #c08030; color: #f0c060; }
.dc-btn.dc-full { width: 100%; text-align: center; margin-top: 2px; }
.dc-btn.dc-danger { border-color: #5a2020; color: #bb6060; }
.dc-btn.dc-danger:hover { background: #281010; color: #ff9090; border-color: #9a3030; }

.dc-select {
  width: 100%;
  background: #181410;
  border: 1px solid #2e2010;
  color: #bbb;
  padding: 4px 6px;
  font: 11px/1 monospace;
  border-radius: 3px;
  margin-bottom: 5px;
  cursor: pointer;
}
.dc-select:focus { outline: 1px solid #7a5020; }
.dc-select option { background: #181410; }

.dc-divider { border: none; border-top: 1px solid #1e1608; margin: 8px 0; }

.dc-status {
  font: 10px/1.6 monospace;
  color: #4a3a20;
  margin-top: 8px;
  padding-top: 7px;
  border-top: 1px solid #1a1208;
}
.dc-status b { color: #7a6030; }
.dc-status .dc-hi { color: #a07030; }
`;

export class DevConsole {
  constructor({ onQuickAI, onQuickVsAI, on2P, onSpawnUnit, onPause, onResume, onSetSpeed, getState }) {
    this._cb = { onQuickAI, onQuickVsAI, on2P, onSpawnUnit, onPause, onResume, onSetSpeed, getState };
    this._visible  = false;
    this._spawnSide = 'player';
    this._spawnLane = 'center';
    this._spawnCard = UNIT_LIST[0].id;
    this._speed     = 1;

    this._injectCSS();
    this._buildFab();
    this._buildPanel();
    this._bindKeys();
  }

  _injectCSS() {
    const s   = document.createElement('style');
    s.id      = 'dc-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  _buildFab() {
    const b = document.createElement('button');
    b.id = 'dc-fab';
    b.textContent = '🛠 DEV';
    b.addEventListener('click', () => this.toggle());
    document.body.appendChild(b);
  }

  _buildPanel() {
    const p = document.createElement('div');
    p.id = 'dc-panel';
    p.classList.add('dc-hidden');

    p.innerHTML = `
      <div class="dc-head">
        <span class="dc-head-title">Dev Console</span>
        <span class="dc-close" id="dc-close" title="Закрыть (\`)">✕</span>
      </div>

      <!-- Запуск матча -->
      <div class="dc-sec">
        <div class="dc-sec-lbl">Запуск матча</div>
        <div class="dc-row">
          <button class="dc-btn" id="dc-ai"  title="AI vs AI без DeckBuilder">AI vs AI</button>
          <button class="dc-btn" id="dc-1p"  title="Игрок (стандартная колода) vs AI">Игрок vs AI</button>
          <button class="dc-btn" id="dc-2p"  title="2 игрока на одном устройстве">2P Лок.</button>
        </div>
      </div>

      <hr class="dc-divider">

      <!-- Спавн юнита -->
      <div class="dc-sec">
        <div class="dc-sec-lbl">Спавн юнита (игнорирует экономику)</div>
        <select class="dc-select" id="dc-unit">
          ${UNIT_LIST.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
        </select>
        <div class="dc-row" style="margin-bottom:4px">
          <button class="dc-btn dc-on" id="dc-s-player">Игрок</button>
          <button class="dc-btn"       id="dc-s-enemy">Враг</button>
        </div>
        <div class="dc-row" style="margin-bottom:5px">
          <button class="dc-btn"       id="dc-l-left"  >← Лево</button>
          <button class="dc-btn dc-on" id="dc-l-center">● Центр</button>
          <button class="dc-btn"       id="dc-l-right" >→ Право</button>
        </div>
        <button class="dc-btn dc-full" id="dc-spawn">＋ Заспавнить</button>
      </div>

      <hr class="dc-divider">

      <!-- Управление -->
      <div class="dc-sec">
        <div class="dc-sec-lbl">Управление матчем</div>
        <div class="dc-row" style="margin-bottom:5px">
          <button class="dc-btn" id="dc-pause">⏸ Пауза</button>
          <button class="dc-btn dc-danger" id="dc-stop">■ Стоп → меню</button>
        </div>
        <div class="dc-sec-lbl" style="margin-top:4px">Скорость симуляции</div>
        <div class="dc-row">
          <button class="dc-btn" id="dc-sp05">×0.5</button>
          <button class="dc-btn dc-on" id="dc-sp1">×1</button>
          <button class="dc-btn" id="dc-sp2">×2</button>
          <button class="dc-btn" id="dc-sp4">×4</button>
        </div>
      </div>

      <div class="dc-status" id="dc-status">— вне матча —</div>
    `;

    document.body.appendChild(p);
    this._panel     = p;
    this._statusEl  = p.querySelector('#dc-status');

    // Close
    p.querySelector('#dc-close').addEventListener('click', () => this.toggle());

    // Quick starts
    p.querySelector('#dc-ai').addEventListener('click', () => this._cb.onQuickAI?.());
    p.querySelector('#dc-1p').addEventListener('click', () => this._cb.onQuickVsAI?.());
    p.querySelector('#dc-2p').addEventListener('click', () => this._cb.on2P?.());

    // Unit select
    const unitSel = p.querySelector('#dc-unit');
    this._spawnCard = unitSel.value;
    unitSel.addEventListener('change', e => { this._spawnCard = e.target.value; });

    // Side toggle
    p.querySelector('#dc-s-player').addEventListener('click', () => this._setSide('player'));
    p.querySelector('#dc-s-enemy' ).addEventListener('click', () => this._setSide('enemy'));

    // Lane toggle
    p.querySelector('#dc-l-left'  ).addEventListener('click', () => this._setLane('left'));
    p.querySelector('#dc-l-center').addEventListener('click', () => this._setLane('center'));
    p.querySelector('#dc-l-right' ).addEventListener('click', () => this._setLane('right'));

    // Spawn
    p.querySelector('#dc-spawn').addEventListener('click', () => {
      const state = this._cb.getState?.();
      if (!state?.matchRunning) {
        this._showStatus('Матч не запущен — сначала выбери режим выше');
        return;
      }
      this._cb.onSpawnUnit?.(this._spawnCard, this._spawnSide, this._spawnLane);
    });

    // Pause / stop
    p.querySelector('#dc-pause').addEventListener('click', () => {
      const st = this._cb.getState?.();
      if (!st?.matchRunning) return;
      if (st.isPaused) { this._cb.onResume?.(); }
      else             { this._cb.onPause?.();  }
    });
    p.querySelector('#dc-stop').addEventListener('click', () => this._cb.onStop?.());

    // Speed
    const speeds = [{ id: 'dc-sp05', v: 0.5 }, { id: 'dc-sp1', v: 1 },
                    { id: 'dc-sp2',  v: 2   }, { id: 'dc-sp4', v: 4 }];
    speeds.forEach(({ id, v }) => {
      p.querySelector(`#${id}`).addEventListener('click', () => this._setSpeed(v, speeds));
    });
  }

  _bindKeys() {
    document.addEventListener('keydown', e => {
      if ((e.key === '`' || e.key === '~' || e.key === 'ё' || e.key === 'Ё') && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  _setSide(side) {
    this._spawnSide = side;
    this._panel.querySelector('#dc-s-player').classList.toggle('dc-on', side === 'player');
    this._panel.querySelector('#dc-s-enemy' ).classList.toggle('dc-on', side === 'enemy');
  }

  _setLane(lane) {
    this._spawnLane = lane;
    ['left', 'center', 'right'].forEach(l => {
      this._panel.querySelector(`#dc-l-${l}`).classList.toggle('dc-on', l === lane);
    });
  }

  _setSpeed(v, speeds) {
    this._speed = v;
    this._cb.onSetSpeed?.(v);
    speeds.forEach(({ id, v: sv }) => {
      this._panel.querySelector(`#${id}`).classList.toggle('dc-on', sv === v);
    });
  }

  _showStatus(msg) {
    if (this._statusEl) this._statusEl.innerHTML = msg;
  }

  toggle() {
    this._visible = !this._visible;
    this._panel.classList.toggle('dc-hidden', !this._visible);
  }

  // Call once per frame from the game loop to refresh status.
  update() {
    if (!this._visible || !this._statusEl) return;
    const st = this._cb.getState?.();
    if (!st) return;

    const { matchRunning, isPaused, mode, elapsed, unitCount } = st;

    // Pause button label
    const pauseBtn = this._panel.querySelector('#dc-pause');
    if (pauseBtn) {
      pauseBtn.textContent    = isPaused ? '▶ Продолжить' : '⏸ Пауза';
      pauseBtn.style.opacity  = matchRunning ? '1' : '0.4';
    }
    const stopBtn = this._panel.querySelector('#dc-stop');
    if (stopBtn) stopBtn.style.opacity = matchRunning ? '1' : '0.4';
    const spawnBtn = this._panel.querySelector('#dc-spawn');
    if (spawnBtn) spawnBtn.style.opacity = matchRunning ? '1' : '0.4';

    if (!matchRunning) {
      this._statusEl.innerHTML = '— <b>вне матча</b> —';
      return;
    }

    const mm = Math.floor(elapsed / 60), ss = Math.floor(elapsed % 60);
    const time = `${mm}:${String(ss).padStart(2, '0')}`;
    const modeLabel = { '1p': '1P vs AI', '2p': 'Лок. 2P', 'ai': 'AI vs AI', 'online': 'Онлайн' }[mode] ?? mode;
    const speedStr = this._speed !== 1 ? ` | <b>×${this._speed}</b>` : '';
    this._statusEl.innerHTML =
      `<b>Режим:</b> <span class="dc-hi">${modeLabel}</span>${speedStr}<br>` +
      `<b>Время:</b> ${time} | <b>Юниты на поле:</b> ${unitCount}`;
  }
}
