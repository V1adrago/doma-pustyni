import { CONFIG } from './config.js';

export class UI {
  constructor(playerEconomy, enemyEconomy, towerManager, factionManager = null) {
    this._playerEco  = playerEconomy;
    this._enemyEco   = enemyEconomy;
    this._towerMgr   = towerManager;
    this._factionMgr = factionManager;

    this._timer       = document.getElementById('timer');
    this._matchStatus = document.getElementById('match-status');

    this._pSpices  = document.getElementById('player-spices');
    this._pBank    = document.getElementById('player-bank');
    this._pIncome  = document.getElementById('player-income');
    this._pEngInfo = document.getElementById('player-engineer-info');

    this._eSpices  = document.getElementById('enemy-spices');
    this._eBank    = document.getElementById('enemy-bank');
    this._eIncome  = document.getElementById('enemy-income');
    this._eEngInfo = document.getElementById('enemy-engineer-info');

    this._towerEls = {};
    Object.keys(towerManager.towers).forEach(id => {
      this._towerEls[id] = document.getElementById(`status-${id}`);
    });

    this._pShield = document.getElementById('player-shield-badge');
    this._eShield = document.getElementById('enemy-shield-badge');
  }

  // ── Called once per game start ──────────────────────────────────────────────

  configure(config) {
    const pTitle = document.getElementById('player-panel-title');
    const eTitle = document.getElementById('enemy-panel-title');

    const fBadge = id => id === 'honor' ? ' · Дом Чести' : '';

    if (config.mode === '2p') {
      pTitle.textContent = `▲ Игрок 1${fBadge(config.playerFaction)}`;
      eTitle.textContent = `▼ Игрок 2${fBadge(config.enemyFaction)}`;
    } else {
      pTitle.textContent = `▲ Игрок${fBadge(config.playerFaction)}`;
      eTitle.textContent = '▼ Противник';
    }
    pTitle.className = 'panel-title player-color';
    eTitle.className = 'panel-title enemy-color';

    // Reset shield badges
    if (this._pShield) this._pShield.classList.add('hidden');
    if (this._eShield) this._eShield.classList.add('hidden');
  }

  // ── Called every frame ──────────────────────────────────────────────────────

  update(elapsed, matchRunning, factionManager = null) {
    const fm = factionManager ?? this._factionMgr;
    this._updateTimer(elapsed, matchRunning, fm);
    this._updateEconomy();
    this._updateTowers();
    this._updateShieldBadges(fm);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _updateTimer(elapsed, matchRunning, fm) {
    this._timer.classList.remove('overtime');
    const remaining = Math.max(0, CONFIG.matchDurationSeconds - elapsed);
    const m = Math.floor(remaining / 60);
    const s = Math.floor(remaining % 60);
    this._timer.textContent = `${m}:${s.toString().padStart(2, '0')}`;

    if (!matchRunning || remaining <= 0) {
      this._matchStatus.textContent = 'КОНЕЦ';
      this._matchStatus.style.color = '#EC7063';
    } else if (elapsed >= 120) {
      this._matchStatus.textContent = 'ФИНАЛ';
      this._matchStatus.style.color = '#EC7063';
    } else if (elapsed >= 60) {
      this._matchStatus.textContent = 'СТАДИЯ 2';
      this._matchStatus.style.color = '#F39C12';
    } else {
      this._matchStatus.textContent = 'БОЙ';
      this._matchStatus.style.color = '#F4A520';
    }
  }

  _updateEconomy() {
    const p = this._playerEco;
    const e = this._enemyEco;

    this._pSpices.textContent = Math.floor(p.spices);
    this._pBank.textContent   = p.spiceBank;
    this._pIncome.textContent = p.incomePerMinute;
    this._pEngInfo.textContent = p.engineerStage > 0
      ? `Стадия ${p.engineerStage} (+${p.engineerIncome}/мин)`
      : '—';
    this._pEngInfo.style.color = p.engineerStage > 0 ? '#7DCEA0' : '#888';

    this._eSpices.textContent = Math.floor(e.spices);
    this._eBank.textContent   = e.spiceBank;
    this._eIncome.textContent = e.incomePerMinute;
    this._eEngInfo.textContent = e.engineerStage > 0
      ? `Стадия ${e.engineerStage} (+${e.engineerIncome}/мин)`
      : '—';
    this._eEngInfo.style.color = e.engineerStage > 0 ? '#7DCEA0' : '#888';
  }

  _updateTowers() {
    Object.entries(this._towerMgr.towers).forEach(([id, tower]) => {
      const el = this._towerEls[id];
      if (!el) return;
      if (tower.alive) {
        const pct = Math.round((tower.hp / tower.maxHp) * 100);
        el.className = `tower-item alive${tower.isCitadel ? ' citadel' : ''}`;
        el.title = `${tower.hp} HP (${pct}%)`;
      } else {
        el.className = 'tower-item destroyed';
        el.title = '';
      }
    });
  }

  _updateShieldBadges(fm) {
    if (!fm) return;
    if (this._pShield) this._pShield.classList.toggle('hidden', !fm.shieldActive.player);
    if (this._eShield) this._eShield.classList.toggle('hidden', !fm.shieldActive.enemy);
  }
}
