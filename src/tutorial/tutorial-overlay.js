import './tutorial-overlay.css';

/**
 * TutorialOverlay — spotlight-overlay для тура по меню.
 *
 * API:
 *   const overlay = new TutorialOverlay();
 *   overlay.showSteps(steps, { onDone, onSkip });
 *   overlay.hide();
 *
 * Каждый step: { title, text, targetSelector?, placement? }
 */
export class TutorialOverlay {
  constructor() {
    this._steps     = [];
    this._idx       = 0;
    this._onDone    = null;
    this._onSkip    = null;
    this._el        = null;
    this._spotlight = null;
    this._card      = null;
    this._keyFn     = null;
    this._build();
  }

  _build() {
    // Backdrop + spotlight — отдельный элемент, только затемнение
    this._el = document.createElement('div');
    this._el.className = 'tut-overlay';

    this._spotlight = document.createElement('div');
    this._spotlight.className = 'tut-spotlight tut-spotlight-hidden';
    this._el.appendChild(this._spotlight);
    document.body.appendChild(this._el);

    // Карточка — отдельный элемент прямо в body, не внутри overlay.
    // Это гарантирует, что pointer-events overlay не блокируют кнопки.
    this._card = document.createElement('div');
    this._card.className = 'tut-card tut-card-hidden';
    this._card.innerHTML = `
      <div class="tut-mentor-row">
        <div class="tut-mentor-icon">⚔</div>
        <div class="tut-mentor-label">Наставник</div>
      </div>
      <div class="tut-card-title" id="tut-card-title"></div>
      <div class="tut-card-text"  id="tut-card-text"></div>
      <div class="tut-step-counter" id="tut-step-counter"></div>
      <div class="tut-card-actions">
        <button class="tut-btn tut-btn-skip" id="tut-btn-skip">Пропустить</button>
        <div class="tut-nav">
          <button class="tut-btn tut-btn-back hidden" id="tut-btn-back">‹ Назад</button>
          <button class="tut-btn tut-btn-next" id="tut-btn-next">Далее ›</button>
          <button class="tut-btn tut-btn-done hidden" id="tut-btn-done">Понял!</button>
        </div>
      </div>`;
    document.body.appendChild(this._card);

    this._card.querySelector('#tut-btn-next').addEventListener('click', () => this._next());
    this._card.querySelector('#tut-btn-back').addEventListener('click', () => this._back());
    this._card.querySelector('#tut-btn-done').addEventListener('click', () => this._finish());
    this._card.querySelector('#tut-btn-skip').addEventListener('click', () => this._skip());
  }

  showSteps(steps, { onDone, onSkip } = {}) {
    this._steps  = steps;
    this._idx    = 0;
    this._onDone = onDone;
    this._onSkip = onSkip;

    this._el.classList.add('tut-active');
    this._card.classList.remove('tut-card-hidden');
    this._renderStep();

    this._keyFn = (e) => {
      if (e.key === 'Escape')     this._skip();
      if (e.key === 'ArrowRight') this._idx < this._steps.length - 1 ? this._next() : this._finish();
      if (e.key === 'ArrowLeft')  this._back();
    };
    document.addEventListener('keydown', this._keyFn);
  }

  hide() {
    this._el.classList.remove('tut-active');
    this._card.classList.add('tut-card-hidden');
    this._spotlight.className = 'tut-spotlight tut-spotlight-hidden';
    if (this._keyFn) { document.removeEventListener('keydown', this._keyFn); this._keyFn = null; }
  }

  _renderStep() {
    const step  = this._steps[this._idx];
    const total = this._steps.length;

    this._card.querySelector('#tut-card-title').textContent = step.title || '';
    this._card.querySelector('#tut-card-text').textContent  = step.text  || '';
    this._card.querySelector('#tut-step-counter').textContent =
      total > 1 ? `Шаг ${this._idx + 1} из ${total}` : '';

    const isLast = this._idx === total - 1;
    this._card.querySelector('#tut-btn-back').classList.toggle('hidden', this._idx === 0);
    this._card.querySelector('#tut-btn-next').classList.toggle('hidden', isLast);
    this._card.querySelector('#tut-btn-done').classList.toggle('hidden', !isLast);

    // Анимация появления — перезапускаем через reflow
    this._card.classList.remove('tut-step-anim');
    void this._card.offsetWidth;
    this._card.classList.add('tut-step-anim');

    // Убрать фокус с кнопки чтобы убрать иллюзию "ничего не произошло"
    document.activeElement?.blur?.();

    if (step.targetSelector) {
      // Сначала скроллим к элементу синхронно, потом берём его позицию.
      // Если scrollIntoView 'instant' не поддерживается — fallback через rAF.
      const target = document.querySelector(step.targetSelector);
      if (target) {
        try {
          target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        } catch (_) {
          target.scrollIntoView(false);
        }
      }
      // rAF гарантирует что layout пересчитан после скролла
      requestAnimationFrame(() => this._highlightEl(step.targetSelector));
    } else {
      this._spotlight.className = 'tut-spotlight tut-spotlight-hidden';
      this._card.classList.remove('tut-card-top');
    }
  }

  _highlightEl(selector) {
    const target = document.querySelector(selector);
    if (!target) { this._spotlight.className = 'tut-spotlight tut-spotlight-hidden'; return; }
    const rect = target.getBoundingClientRect();
    const pad  = 8;
    this._spotlight.style.left   = (rect.left - pad) + 'px';
    this._spotlight.style.top    = (rect.top  - pad) + 'px';
    this._spotlight.style.width  = (rect.width  + pad * 2) + 'px';
    this._spotlight.style.height = (rect.height + pad * 2) + 'px';
    this._spotlight.className = 'tut-spotlight';

    // Если цель в нижней половине экрана — карточку наверх, иначе вниз
    const targetMidY = rect.top + rect.height / 2;
    this._card.classList.toggle('tut-card-top', targetMidY > window.innerHeight / 2);
  }

  _next()   { if (this._idx < this._steps.length - 1) { this._idx++; this._renderStep(); } }
  _back()   { if (this._idx > 0) { this._idx--; this._renderStep(); } }
  _finish() { this.hide(); this._onDone?.(); }
  _skip()   { this.hide(); this._onSkip?.(); }
}

/**
 * TutorialBattleHint — карточка наставника в бою.
 *
 * API:
 *   hint.show({ title, text, pauseMode, onDismiss })
 *     pauseMode:  true  → кнопка "Понятно →", игра стоит, onDismiss вызывается при нажатии
 *                 false → авто-таймер по скорости чтения + кнопка "Пропустить"
 *   hint.hide()
 */
export class TutorialBattleHint {
  constructor() {
    this._el          = null;
    this._timer       = null;
    this._rafId       = null;
    this._onDismiss   = null;
    this._startTime   = null;
    this._totalMs     = 0;
    this._build();
  }

  _build() {
    this._el = document.createElement('div');
    this._el.className = 'tut-battle-hint hidden';
    this._el.innerHTML = `
      <div class="tut-battle-top">
        <div class="tut-battle-mentor-icon">⚔</div>
        <div class="tut-battle-body">
          <div class="tut-battle-title">Наставник</div>
          <div class="tut-battle-text"></div>
        </div>
      </div>
      <div class="tut-battle-footer">
        <div class="tut-battle-progress-wrap">
          <div class="tut-battle-progress-bar"></div>
        </div>
        <button class="tut-battle-btn">Понятно →</button>
      </div>`;
    document.body.appendChild(this._el);

    this._el.querySelector('.tut-battle-btn')
      .addEventListener('click', () => this._dismiss());
  }

  show({ title, text, pauseMode = false, actionMode = false, autoDismissMs = 0, onDismiss = null } = {}) {
    this._clearTimers();
    this._onDismiss = onDismiss;

    this._el.querySelector('.tut-battle-title').textContent = title || 'Наставник';
    this._el.querySelector('.tut-battle-text').textContent  = text  || '';

    const btn      = this._el.querySelector('.tut-battle-btn');
    const progWrap = this._el.querySelector('.tut-battle-progress-wrap');
    const progBar  = this._el.querySelector('.tut-battle-progress-bar');

    if (pauseMode || actionMode) {
      // Ручное закрытие — кнопка "Понятно" или "Сделать это"
      btn.textContent        = actionMode ? 'Сделать это →' : 'Понятно →';
      progWrap.style.display = 'none';
      progBar.style.width    = '0%';
    } else {
      // Авто-таймер
      const ms = autoDismissMs > 0
        ? autoDismissMs
        : Math.min(12000, Math.max(4000, Math.ceil((text || '').length / 20) * 1000));
      btn.textContent        = 'Пропустить';
      progWrap.style.display = 'block';
      progBar.style.width    = '0%';
      this._startTime = performance.now();
      this._totalMs   = ms;
      this._tickProgress();
      this._timer = setTimeout(() => this._dismiss(), ms);
    }

    this._el.classList.remove('hidden');
  }

  _tickProgress() {
    if (!this._startTime) return;
    const elapsed = performance.now() - this._startTime;
    const pct     = Math.min(100, (elapsed / this._totalMs) * 100);
    const bar = this._el.querySelector('.tut-battle-progress-bar');
    if (bar) bar.style.width = pct + '%';
    if (pct < 100) {
      this._rafId = requestAnimationFrame(() => this._tickProgress());
    }
  }

  _dismiss() {
    this.hide();
    const cb = this._onDismiss;
    this._onDismiss = null;
    cb?.();
  }

  _clearTimers() {
    if (this._timer)  { clearTimeout(this._timer);          this._timer     = null; }
    if (this._rafId)  { cancelAnimationFrame(this._rafId);  this._rafId     = null; }
    this._startTime = null;
  }

  hide() {
    this._clearTimers();
    this._el.classList.add('hidden');
  }

  get isVisible() { return !this._el.classList.contains('hidden'); }
}
