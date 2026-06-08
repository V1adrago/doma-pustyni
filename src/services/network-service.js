// Network service — Socket.IO client wrapper for online multiplayer.
// Connects to the game server, manages room and match events.

import { io } from 'socket.io-client';

// In dev mode Vite runs on :5173, server on :3000 → connect directly.
// In production both are served from the same origin.
const SERVER_URL = import.meta.env?.DEV
  ? 'http://localhost:3000'
  : window.location.origin;

const _state = {
  socket:     null,
  roomId:     null,
  role:       null,   // 'host' | 'guest'
  playerSide: null,   // 'bottom' (host) | 'top' (guest)
  connected:  false,
  lastError:  null,
};

const _cb = {
  onRoomState:      null,
  onMatchStart:     null,
  onOpponentAction: null,
  onHostSnapshot:   null,
  onNetworkError:   null,
};

// ── Connect / disconnect ──────────────────────────────────────────────────────

export function connectNetwork(onConnected) {
  if (_state.socket?.connected) {
    onConnected?.();
    return;
  }

  if (_state.socket) {
    // Socket exists but not yet connected
    _state.socket.once('connect', () => onConnected?.());
    _state.socket.connect();
    return;
  }

  _state.socket = io(SERVER_URL, {
    transports:          ['websocket'],
    reconnectionAttempts: 3,
  });

  _state.socket.once('connect', () => {
    _state.connected = true;
    console.log('[Network] connected to', SERVER_URL);
    onConnected?.();
  });

  _state.socket.on('disconnect', () => {
    _state.connected = false;
  });

  _state.socket.on('connect_error', (err) => {
    _state.lastError = { code: 'connect_error', message: err.message };
    _cb.onNetworkError?.(_state.lastError);
  });

  // ── Server → client events ────────────────────────────────────────────────

  _state.socket.on('room_created', ({ roomId, role }) => {
    _state.roomId     = roomId;
    _state.role       = role;
    _state.playerSide = 'bottom';
  });

  _state.socket.on('room_joined', ({ roomId, role }) => {
    _state.roomId     = roomId;
    _state.role       = role;
    _state.playerSide = 'top';
  });

  _state.socket.on('room_state',    (s)  => _cb.onRoomState?.(s));
  _state.socket.on('player_joined', ()   => {});   // room_state follows immediately
  _state.socket.on('both_ready',    ()   => {});   // room_state carries ready flags

  _state.socket.on('match_start', (data) => {
    _cb.onMatchStart?.(data);
  });

  _state.socket.on('opponent_action', (cmd) => {
    _cb.onOpponentAction?.(cmd);
  });

  _state.socket.on('host_snapshot', (snap) => {
    _cb.onHostSnapshot?.(snap);
  });

  _state.socket.on('opponent_surrendered', (data) => {
    _cb.onNetworkError?.({ code: 'opponent_surrendered', ...data });
  });

  _state.socket.on('opponent_disconnected', (data) => {
    _cb.onNetworkError?.({ code: 'opponent_disconnected', ...data });
  });

  _state.socket.on('room_error', (err) => {
    _state.lastError = err;
    _cb.onNetworkError?.(err);
  });
}

export function disconnectNetwork() {
  _state.socket?.disconnect();
  _state.socket     = null;
  _state.roomId     = null;
  _state.role       = null;
  _state.playerSide = null;
  _state.connected  = false;
  _state.lastError  = null;
}

// ── Room actions ──────────────────────────────────────────────────────────────

export function createOnlineRoom() {
  _state.socket?.emit('create_room');
}

export function joinOnlineRoom(roomId) {
  _state.socket?.emit('join_room', { roomId: roomId.toUpperCase() });
}

export function leaveOnlineRoom(roomId) {
  _state.socket?.emit('leave_room', { roomId });
  _state.roomId = null;
}

export function setReady(roomId, ready) {
  _state.socket?.emit('player_ready', { roomId, ready });
}

export function startOnlineMatch(roomId) {
  _state.socket?.emit('start_match', { roomId });
}

// ── In-match actions ──────────────────────────────────────────────────────────

export function sendPlayCard(command) {
  _state.socket?.emit('play_card', command);
}

export function sendHostSnapshot(snapshot) {
  _state.socket?.emit('host_snapshot', snapshot);
}

export function sendSurrender(roomId) {
  _state.socket?.emit('surrender', { roomId });
}

// ── Callbacks registration ────────────────────────────────────────────────────

export function onRoomState(cb)      { _cb.onRoomState      = cb; }
export function onMatchStart(cb)     { _cb.onMatchStart      = cb; }
export function onOpponentAction(cb) { _cb.onOpponentAction  = cb; }
export function onHostSnapshot(cb)   { _cb.onHostSnapshot    = cb; }
export function onNetworkError(cb)   { _cb.onNetworkError    = cb; }

export function getNetworkState() {
  return {
    socket:     _state.socket,
    roomId:     _state.roomId,
    role:       _state.role,
    playerSide: _state.playerSide,
    connected:  _state.connected,
    lastError:  _state.lastError,
  };
}
