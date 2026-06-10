// Shared tower positions for proximity checks (mirrors TOWER_DATA in unit-manager.js)
export const TOWER_POS = {
  player_left:    { x: -6, z:  11 },
  player_citadel: { x:  0, z:  13 },
  player_right:   { x:  6, z:  11 },
  enemy_left:     { x: -6, z: -11 },
  enemy_citadel:  { x:  0, z: -13 },
  enemy_right:    { x:  6, z: -11 },
};

export const HONOR_TOWER_COLORS = {
  body:       0xd4960a,
  cap:        0x8b5e00,
  battlement: 0xd4960a,
};

export const FACTION_DEFS = {
  none: {
    id:   'none',
    name: 'Без фракции',
  },
  honor: {
    id:   'honor',
    name: 'Дом Чести',
    towerColors: {
      body: 0xd4960a,
      cap:  0x8b5e00,
    },
    // Боевой порядок (passive)
    passiveRange:     7.0,   // max distance to alive own tower for buff to apply
    defenseBonus:     0.08,  // 8% incoming damage reduction
    attackSpeedBonus: 0.05,  // 5% faster attack (cooldown multiplier 0.95)
    // Щит гарнизона (citadel ability)
    shieldThreshold:  0.60,  // triggers when citadel HP drops to ≤60% (lost 40%)
    shieldDuration:   6,     // seconds
    shieldReduction:  0.35,  // 35% damage reduction on citadel while active
  },
  desert_clans: {
    id:   'desert_clans',
    name: 'Пустынные Кланы',
    towerColors: {
      body: 0xb8792d,
      cap:  0xe0b15a,
    },
    // След песка (passive) — усиление в бурях специй
    passive: {
      id:   'sand_trace',
      name: 'След песка',
    },
    // Пока без уникальных боевых механик — применяется через mapEventManager
  },
};

export class FactionManager {
  constructor() {
    this.factions       = { player: 'none', enemy: 'none' };
    this.shieldActive   = { player: false, enemy: false };
    this.shieldTimeLeft = { player: 0, enemy: 0 };
    this.shieldUsed     = { player: false, enemy: false };
  }

  setFaction(side, factionId) {
    this.factions[side] = factionId;
  }

  getFaction(side) {
    return this.factions[side];
  }

  reset() {
    this.shieldActive   = { player: false, enemy: false };
    this.shieldTimeLeft = { player: 0, enemy: 0 };
    this.shieldUsed     = { player: false, enemy: false };
  }

  // Tick shield timers each frame
  update(delta) {
    for (const side of ['player', 'enemy']) {
      if (!this.shieldActive[side]) continue;
      this.shieldTimeLeft[side] -= delta;
      if (this.shieldTimeLeft[side] <= 0) {
        this.shieldTimeLeft[side] = 0;
        this.shieldActive[side]   = false;
      }
    }
  }

  // Call after citadel takes damage. Returns true if shield was newly activated.
  checkCitadelShield(side, citadelHp, citadelMaxHp) {
    if (this.factions[side] !== 'honor') return false;
    if (this.shieldUsed[side]) return false;
    const def = FACTION_DEFS.honor;
    if (citadelHp > 0 && citadelHp / citadelMaxHp <= def.shieldThreshold) {
      this.shieldActive[side]   = true;
      this.shieldTimeLeft[side] = def.shieldDuration;
      this.shieldUsed[side]     = true;
      return true;
    }
    return false;
  }

  // Apply Щит гарнизона reduction to damage dealt to this side's citadel
  applyShieldReduction(side, damage) {
    if (this.factions[side] !== 'honor') return damage;
    if (!this.shieldActive[side]) return damage;
    return damage * (1 - FACTION_DEFS.honor.shieldReduction);
  }

  // Returns true if unit is in the "battle order" zone: own half + near alive friendly tower
  isInBattleOrder(unit, towerManager) {
    if (this.factions[unit.side] !== 'honor') return false;
    const onOwnHalf = unit.side === 'player'
      ? unit.position.z > 0
      : unit.position.z < 0;
    if (!onOwnHalf) return false;

    const def = FACTION_DEFS.honor;
    for (const suffix of ['left', 'citadel', 'right']) {
      const towerId = `${unit.side}_${suffix}`;
      if (!towerManager.towers[towerId]?.alive) continue;
      const pos = TOWER_POS[towerId];
      const dx = unit.position.x - pos.x;
      const dz = unit.position.z - pos.z;
      if (Math.sqrt(dx * dx + dz * dz) <= def.passiveRange) return true;
    }
    return false;
  }

  // Apply Боевой порядок defense: reduce incoming damage to this unit
  applyBattleOrderDefense(unit, damage, towerManager) {
    if (!this.isInBattleOrder(unit, towerManager)) return damage;
    return damage * (1 - FACTION_DEFS.honor.defenseBonus);
  }

  // Get attack cooldown multiplier for Боевой порядок (< 1.0 = faster attacks)
  getBattleOrderCooldownMult(unit, towerManager) {
    if (!this.isInBattleOrder(unit, towerManager)) return 1.0;
    return 1 - FACTION_DEFS.honor.attackSpeedBonus; // 0.95
  }

}
