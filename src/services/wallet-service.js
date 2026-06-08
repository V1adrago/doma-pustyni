const STORAGE_KEY = 'doma_pustyni_wallet_v1';

const DEFAULT = {
  waterRings:  0,
  metaSpices:  0,
  caravanPity: 0,
};

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT };
}

function _save(w) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
}

export function loadWallet()        { return _load(); }
export function saveWallet(w)       { _save(w); }

export function getWaterRings()     { return _load().waterRings; }
export function getMetaSpices()     { return _load().metaSpices; }
export function getCaravanPity()    { return _load().caravanPity; }

export function addWaterRings(amount) {
  const w = _load();
  w.waterRings = Math.max(0, w.waterRings + amount);
  _save(w);
  return w.waterRings;
}

export function spendWaterRings(amount) {
  const w = _load();
  if (w.waterRings < amount) return false;
  w.waterRings -= amount;
  _save(w);
  return true;
}

export function addMetaSpices(amount) {
  const w = _load();
  w.metaSpices = Math.max(0, w.metaSpices + amount);
  _save(w);
  return w.metaSpices;
}

export function incrementCaravanPity() {
  const w = _load();
  w.caravanPity = (w.caravanPity + 1) % 10;
  _save(w);
  return w.caravanPity;
}

export function resetCaravanPity() {
  const w = _load();
  w.caravanPity = 0;
  _save(w);
}
