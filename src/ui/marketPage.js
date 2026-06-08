import './marketPage.css';
import { loadWallet, addMetaSpices, addWaterRings } from '../services/wallet-service.js';
import {
  CHEST_DEFS, loadContracts, saveContracts, openChest,
  ROUTE_NODES, getClaimedRouteNodes, claimRouteNode,
} from '../services/market-service.js';
import { loadProfile } from '../services/profile-service.js';

export class MarketPage {
  constructor(container) {
    this._el = container;
    this._render();
  }

  refresh() { this._render(); }

  /* ── Render ─────────────────────────────── */

  _render() {
    const wallet    = loadWallet();
    const profile   = loadProfile();
    const contracts = loadContracts();
    const claimed   = getClaimedRouteNodes();
    const wins      = profile.wins ?? 0;
    const pityCount = wallet.caravanPity ?? 0;
    const pityPct   = Math.round((pityCount / 10) * 100);

    this._el.innerHTML = `
      <div class="mp-layout">
        ${this._walletHTML(wallet)}
        ${this._bannerHTML()}
        ${this._chestsHTML(wallet, pityCount, pityPct)}
        ${this._contractsHTML(contracts)}
        ${this._routeHTML(wins, claimed)}
      </div>`;

    this._bindEvents();
  }

  _walletHTML(w) {
    return `
      <div class="mp-wallet">
        <div class="mp-wallet-item">
          <span class="mp-wallet-icon">💧</span>
          <div class="mp-wallet-info">
            <div class="mp-wallet-value" id="mp-water-val">${w.waterRings.toLocaleString('ru-RU')}</div>
            <div class="mp-wallet-label">Водных колец</div>
          </div>
        </div>
        <div class="mp-wallet-divider"></div>
        <div class="mp-wallet-item">
          <span class="mp-wallet-icon">🌶</span>
          <div class="mp-wallet-info">
            <div class="mp-wallet-value">${(w.metaSpices || 0).toLocaleString('ru-RU')}</div>
            <div class="mp-wallet-label">Запасы специй</div>
          </div>
        </div>
      </div>`;
  }

  _bannerHTML() {
    return `
      <div class="mp-banner">
        <div class="mp-banner-icon">🐪</div>
        <div class="mp-banner-content">
          <div class="mp-banner-title">Каравaнный рынок</div>
          <div class="mp-banner-sub">Торговля в сердце пустыни</div>
        </div>
      </div>`;
  }

  _chestsHTML(wallet, pityCount, pityPct) {
    const cards = CHEST_DEFS.map(c => {
      const can = wallet.waterRings >= c.cost;
      return `
        <div class="mp-chest mp-chest--${c.rarity}${can ? '' : ' mp-chest--locked'}">
          <div class="mp-chest-icon">${c.icon}</div>
          <div class="mp-chest-name">${c.name}</div>
          <div class="mp-chest-desc">${c.desc}</div>
          <button class="mp-chest-btn${can ? '' : ' mp-chest-btn--locked'}"
                  data-chest="${c.id}" ${can ? '' : 'disabled'}>
            💧 ${c.cost}
          </button>
        </div>`;
    }).join('');

    return `
      <div class="mp-section">
        <div class="mp-section-header">
          <span class="mp-section-title">Тайники</span>
          <span class="mp-section-badge mp-pity-badge">
            <span class="mp-pity-icon">⚖</span>
            <span>След каравана: ${pityCount}/10</span>
          </span>
        </div>
        <div class="mp-pity-bar-wrap">
          <div class="mp-pity-bar-fill" style="width:${pityPct}%"></div>
        </div>
        <div class="mp-chests-grid">${cards}</div>
      </div>`;
  }

  _contractsHTML(contracts) {
    const items = contracts.map(c => {
      const pct  = Math.min(100, Math.round((c.progress / c.total) * 100));
      const done = c.progress >= c.total;
      const btnCls = (done && !c.claimed) ? 'mp-contract-btn--ready' : '';
      return `
        <div class="mp-contract${c.claimed ? ' mp-contract--done' : ''}">
          <div class="mp-contract-info">
            <div class="mp-contract-title">${c.title}</div>
            <div class="mp-contract-desc">${c.desc}</div>
            <div class="mp-contract-bar-wrap">
              <div class="mp-contract-bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="mp-contract-progress">${c.progress} / ${c.total}</div>
          </div>
          <button class="mp-contract-btn ${btnCls}"
                  data-contract="${c.id}"
                  ${(done && !c.claimed) ? '' : 'disabled'}>
            ${c.claimed ? '✓' : (done ? 'Забрать' : '...')}
          </button>
        </div>`;
    }).join('');

    return `
      <div class="mp-section">
        <div class="mp-section-header">
          <span class="mp-section-title">Контракты</span>
          <span class="mp-section-badge">Ежедневные</span>
        </div>
        <div class="mp-contracts-list">${items}</div>
      </div>`;
  }

  _routeHTML(wins, claimed) {
    const items = ROUTE_NODES.map(node => {
      const reached     = wins >= node.winsRequired;
      const canClaim    = reached && !claimed.includes(node.id);
      const wasClaimed  = claimed.includes(node.id);
      const isNextNode  = !reached && ROUTE_NODES.find(n => wins < n.winsRequired)?.id === node.id;

      let rightEl = `<div class="mp-route-node-reward">💧 ${node.reward.amount}</div>`;
      if (canClaim) {
        rightEl = `<button class="mp-route-node-claim-btn" data-route="${node.id}">Забрать</button>`;
      } else if (wasClaimed) {
        rightEl = `<div class="mp-route-node-reward" style="color:#4a9a4a">✓ Получено</div>`;
      }

      return `
        <div class="mp-route-node${reached ? ' mp-route-node--reached' : ''}${isNextNode ? ' mp-route-node--next' : ''}">
          <div class="mp-route-node-icon">${node.icon}</div>
          <div class="mp-route-node-info">
            <div class="mp-route-node-name">${node.name}</div>
            <div class="mp-route-node-req">${wasClaimed ? '✓ Достигнуто' : (reached ? `${node.winsRequired} побед` : `${node.winsRequired} побед`)}</div>
          </div>
          ${rightEl}
        </div>`;
    }).join('');

    return `
      <div class="mp-section">
        <div class="mp-section-header">
          <span class="mp-section-title">Маршрут каравана</span>
          <span class="mp-section-badge">${wins} побед</span>
        </div>
        <div class="mp-route">${items}</div>
      </div>`;
  }

  /* ── Events ─────────────────────────────── */

  _bindEvents() {
    this._el.querySelectorAll('[data-chest]:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => this._handleChestOpen(btn.dataset.chest));
    });
    this._el.querySelectorAll('.mp-contract-btn--ready').forEach(btn => {
      btn.addEventListener('click', () => this._handleContractClaim(btn.dataset.contract));
    });
    this._el.querySelectorAll('[data-route]').forEach(btn => {
      btn.addEventListener('click', () => this._handleRouteClaim(btn.dataset.route));
    });
  }

  _handleChestOpen(chestId) {
    const result = openChest(chestId);
    if (!result || result.error === 'not_enough') {
      this._toast('Недостаточно Водных колец!');
      return;
    }
    const { reward } = result;
    let text = '';
    if (reward.type === 'metaSpices') text = `+${reward.amount} Запасов специй 🌶`;
    else if (reward.type === 'waterRings') text = `+${reward.amount} Водных колец 💧`;
    else if (reward.type === 'card_frag') text = `Фрагмент карты: ${reward.name}`;
    this._rewardModal(text, reward.guaranteed ? '⚖ Гарантированная редкость!' : null);
    this._render();
  }

  _handleContractClaim(contractId) {
    const contracts = loadContracts();
    const c = contracts.find(x => x.id === contractId);
    if (!c || c.claimed || c.progress < c.total) return;
    c.claimed = true;
    saveContracts(contracts);
    if (c.reward.type === 'metaSpices') addMetaSpices(c.reward.amount);
    else if (c.reward.type === 'waterRings') addWaterRings(c.reward.amount);
    this._toast(`Контракт выполнен! ${c.desc}`);
    this._render();
  }

  _handleRouteClaim(nodeId) {
    const reward = claimRouteNode(nodeId);
    if (!reward) return;
    let text = '';
    if (reward.type === 'waterRings') text = `+${reward.amount} Водных колец 💧`;
    if (reward.type === 'metaSpices') text = `+${reward.amount} Запасов специй 🌶`;
    this._toast(`Локация открыта! ${text}`);
    this._render();
  }

  /* ── UI helpers ─────────────────────────── */

  _toast(msg) {
    const t = document.createElement('div');
    t.className = 'mp-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('mp-toast--show'), 10);
    setTimeout(() => {
      t.classList.remove('mp-toast--show');
      setTimeout(() => t.remove(), 300);
    }, 2500);
  }

  _rewardModal(rewardText, bonusText) {
    const m = document.createElement('div');
    m.className = 'mp-reward-modal';
    m.innerHTML = `
      <div class="mp-reward-card">
        <div class="mp-reward-icon">✨</div>
        <div class="mp-reward-title">Тайник открыт!</div>
        <div class="mp-reward-text">${rewardText}</div>
        ${bonusText ? `<div class="mp-reward-bonus">${bonusText}</div>` : ''}
        <button class="mp-reward-close">Забрать</button>
      </div>`;
    document.body.appendChild(m);
    setTimeout(() => m.classList.add('mp-reward-modal--show'), 10);
    m.querySelector('.mp-reward-close').addEventListener('click', () => {
      m.classList.remove('mp-reward-modal--show');
      setTimeout(() => m.remove(), 300);
    });
  }
}
