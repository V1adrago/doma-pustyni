import { getRoomInviteLink } from './services/room-service.js';
import {
  connectNetwork, createOnlineRoom, joinOnlineRoom, leaveOnlineRoom,
  setReady, startOnlineMatch,
  onRoomState, onMatchStart, onNetworkError,
  getNetworkState,
} from './services/network-service.js';

// RoomScreen — manages #room-overlay.
// onStartOnlineMatch(matchData) called with { role, roomId, seed, hostSide, guestSide }
// onBack() called when user clicks ← Назад

export class RoomScreen {
  constructor(onStartOnlineMatch, onBack) {
    this._onStartOnlineMatch = onStartOnlineMatch;
    this._onBack             = onBack;
    this._roomId             = null;
    this._role               = null;   // 'host' | 'guest'
    this._roomState          = null;
    this._myReady            = false;
    this._matchStarted       = false;

    this._registerCallbacks();
    this._bind();
  }

  // roomId = null → create new room; roomId = 'ABCDEF' → join existing
  show(roomId) {
    this._roomId       = null;
    this._role         = null;
    this._myReady      = false;
    this._matchStarted = false;
    this._roomState    = null;

    document.getElementById('room-overlay').classList.remove('hidden');
    this._setStatus('Подключение к серверу...');
    this._resetUI();

    connectNetwork(() => {
      this._setStatus('');
      if (roomId) {
        // Guest: join existing room
        joinOnlineRoom(roomId);
      } else {
        // Host: create new room
        createOnlineRoom();
      }
    });
  }

  // Hide without changing URL (used on browser Back button).
  hideQuiet() {
    document.getElementById('room-overlay').classList.add('hidden');
    this._cleanup();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _cleanup() {
    if (this._roomId) leaveOnlineRoom(this._roomId);
    this._roomId  = null;
    this._role    = null;
    this._myReady = false;
  }

  _hide() {
    document.getElementById('room-overlay').classList.add('hidden');
    this._cleanup();
    history.pushState(null, '', '/');
  }

  _registerCallbacks() {
    onRoomState((state) => {
      // room_created fires first → we get roomId from room_state
      const net = getNetworkState();
      if (net.roomId && !this._roomId) {
        this._roomId = net.roomId;
        this._role   = net.role;
        _set('room-id-display', this._roomId);
        _set('room-invite-link', getRoomInviteLink(this._roomId));
        history.replaceState(null, '', `/room/${this._roomId}`);
      }
      this._roomState = state;
      this._renderPlayers(state);
      this._updateButtons(state);
    });

    onMatchStart((data) => {
      if (this._matchStarted) return;
      this._matchStarted = true;

      // Hide room screen before handing off
      document.getElementById('room-overlay').classList.add('hidden');
      this._onStartOnlineMatch({ ...data, role: this._role });
    });

    onNetworkError((err) => {
      if (err.code === 'room_not_found') {
        this._setStatus('❌ Комната не найдена. Проверь код или создай новую.');
      } else if (err.code === 'room_full') {
        this._setStatus('❌ Комната заполнена. Войти нельзя.');
      } else if (err.code === 'connect_error') {
        this._setStatus('❌ Нет подключения к серверу. Запущен ли сервер?');
      } else if (err.code === 'opponent_disconnected') {
        this._setStatus('⚠ Противник отключился.');
      }
    });
  }

  _renderPlayers(state) {
    const list = document.getElementById('room-players-list');
    if (!list) return;

    const net = getNetworkState();

    const makeSlot = (player, slotNum, icon, isMe) => {
      if (!player) {
        return `<div class="room-player-slot empty">
          <span class="room-player-icon">${icon}</span>
          <span class="room-player-name">Игрок ${slotNum}</span>
          <span class="room-player-status">Ожидает входа...</span>
        </div>`;
      }
      const you = isMe ? ' (Вы)' : '';
      return `<div class="room-player-slot${player.ready ? ' ready' : ''}">
        <span class="room-player-icon">${icon}</span>
        <span class="room-player-name">${player.name}${you}</span>
        <span class="room-player-status">${player.ready ? '✓ Готов' : 'Ожидает...'}</span>
      </div>`;
    };

    const iAmHost  = net.role === 'host';
    list.innerHTML =
      makeSlot(state.host,  1, '🔵', iAmHost)  +
      makeSlot(state.guest, 2, '🔴', !iAmHost);
  }

  _updateButtons(state) {
    const net = getNetworkState();

    // Ready button: reflect current state
    const readyBtn = document.getElementById('btn-room-ready');
    if (readyBtn) {
      readyBtn.textContent    = this._myReady ? 'Отменить готовность' : 'Готов';
      readyBtn.dataset.active = this._myReady ? '1' : '';
    }

    // Start button: only host + both ready
    const startBtn = document.getElementById('btn-room-start');
    if (startBtn) {
      const bothReady = state?.host?.ready && state?.guest?.ready;
      const isHost    = net.role === 'host';
      startBtn.disabled = !bothReady || !isHost;
      startBtn.title    = !isHost ? 'Ожидание запуска от Host' : '';
    }

    // Hide "add test player" button — not needed in real online
    const addBtn = document.getElementById('btn-room-add-test-player');
    if (addBtn) addBtn.classList.add('hidden');

    // Show hint for guest instead of start button
    let guestHint = document.getElementById('room-guest-hint');
    if (!guestHint) {
      guestHint = document.createElement('div');
      guestHint.id        = 'room-guest-hint';
      guestHint.className = 'room-guest-hint';
      startBtn?.parentElement?.appendChild(guestHint);
    }
    guestHint.textContent = net.role === 'guest' ? 'Ожидание запуска от Host...' : '';
    guestHint.classList.toggle('hidden', net.role !== 'guest');
  }

  _resetUI() {
    _set('room-id-display', '------');
    _set('room-invite-link', '');
    const list = document.getElementById('room-players-list');
    if (list) list.innerHTML = '<div class="room-player-slot empty"><span class="room-player-icon">⚫</span><span class="room-player-name">Подключение...</span><span class="room-player-status"></span></div>';
    const startBtn = document.getElementById('btn-room-start');
    if (startBtn) startBtn.disabled = true;
    document.getElementById('btn-room-add-test-player')?.classList.add('hidden');
  }

  _setStatus(msg) {
    let el = document.getElementById('room-status-msg');
    if (!el) {
      el = document.createElement('div');
      el.id        = 'room-status-msg';
      el.className = 'room-status-msg';
      document.getElementById('room-card')?.prepend(el);
    }
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  }

  _bind() {
    const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);

    on('btn-room-copy-link', () => {
      if (!this._roomId) return;
      const link = getRoomInviteLink(this._roomId);
      navigator.clipboard?.writeText(link).then(() => {
        const btn = document.getElementById('btn-room-copy-link');
        if (!btn) return;
        const orig = btn.textContent;
        btn.textContent = 'Скопировано!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      }).catch(() => prompt('Скопируй ссылку:', link));
    });

    on('btn-room-ready', () => {
      if (!this._roomId) return;
      this._myReady = !this._myReady;
      setReady(this._roomId, this._myReady);
      // UI will update via room_state event from server
    });

    on('btn-room-start', () => {
      const net = getNetworkState();
      if (!this._roomId || net.role !== 'host') return;
      if (!this._roomState?.host?.ready || !this._roomState?.guest?.ready) return;
      startOnlineMatch(this._roomId);
    });

    on('btn-room-back', () => {
      this._hide();
      this._onBack();
    });
  }
}

function _set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
