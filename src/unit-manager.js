import * as THREE from 'three';
import { Unit, LANE_X, RESOURCE_NODE_POS, tickVfx,
         spawnSlash, spawnThrust, spawnBolt, spawnImpact,
         spawnDronePulse, spawnEngineerRing, spawnShieldFlash } from './units.js';
import { CARD_DEFS } from './cards.js';

const TOWER_DATA = {
  player_left:    { x: -6, z:  11, y: 4.0, damage: 40, cooldown: 1.5, range: 5.2, side: 'player' },
  player_citadel: { x:  0, z:  13, y: 5.5, damage: 55, cooldown: 1.4, range: 6.2, side: 'player' },
  player_right:   { x:  6, z:  11, y: 4.0, damage: 40, cooldown: 1.5, range: 5.2, side: 'player' },
  enemy_left:     { x: -6, z: -11, y: 4.0, damage: 40, cooldown: 1.5, range: 5.2, side: 'enemy'  },
  enemy_citadel:  { x:  0, z: -13, y: 5.5, damage: 55, cooldown: 1.4, range: 6.2, side: 'enemy'  },
  enemy_right:    { x:  6, z: -11, y: 4.0, damage: 40, cooldown: 1.5, range: 5.2, side: 'enemy'  },
};

const LANE_TOWER_CHAIN = {
  player: {
    left:   ['enemy_left',  'enemy_citadel'],
    center: ['enemy_citadel'],
    right:  ['enemy_right', 'enemy_citadel'],
  },
  enemy: {
    left:   ['player_left',  'player_citadel'],
    center: ['player_citadel'],
    right:  ['player_right', 'player_citadel'],
  },
};

function dist2D(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function calcUnitDamage(attacker, target) {
  if (attacker.cardId === 'archer') {
    return target.def.unitType === 'air' ? attacker.def.airDamage : attacker.def.attackDamage;
  }
  if (attacker.cardId === 'spearman') {
    const ac = target.def.armorClass;
    if (ac === 'heavy' || ac === 'assault') return 65;
  }
  return attacker.def.attackDamage;
}

// Spawn attack VFX from a squad member's world position toward the target.
function _spawnMemberAttackVfx(scene, cardId, fromPos, toPos) {
  switch (cardId) {
    case 'scout':
      spawnSlash(scene, fromPos.clone(), 0xffee88, 0.7);
      break;
    case 'swordsman':
      spawnSlash(scene, fromPos.clone(), 0xaaccff, 0.9);
      break;
    case 'assault':
      spawnImpact(scene, toPos.clone(), 0xcc8844, true);
      break;
    case 'spearman':
      spawnThrust(scene, fromPos.clone(), toPos.clone());
      break;
    case 'heavy':
      spawnSlash(scene, fromPos.clone(), 0xcc88cc, 1.2);
      spawnImpact(scene, toPos.clone(), 0xbbaa88, false);
      break;
    case 'guard':
      spawnSlash(scene, fromPos.clone(), 0xffd700, 1.0);
      break;
    case 'archer': {
      const from = fromPos.clone(); from.y += 0.5;
      const to   = toPos.clone();   to.y   += 0.4;
      spawnBolt(scene, from, to, 0xffff66);
      break;
    }
    case 'drone':
      spawnDronePulse(scene, fromPos.clone(), toPos.clone());
      break;
  }
}

// Spawn tower-hit VFX (impact at tower position, one per active member).
function _spawnMemberTowerVfx(scene, cardId, towerPos) {
  switch (cardId) {
    case 'assault': spawnImpact(scene, towerPos, 0xcc6622, true);  break;
    case 'heavy':   spawnImpact(scene, towerPos, 0xaa8866, true);  break;
    default:        spawnImpact(scene, towerPos, 0xbbaa88, false); break;
  }
}

const FLASH_DURATION            = 0.18;
const SUB_TARGET_CHECK_INTERVAL = 0.25; // seconds between per-member sub-target re-evaluations
const MIN_BENEFIT_DISTANCE      = 0.45; // min distance advantage for an alt target to trigger peel

function getMemberWorldPos(unit, member) {
  return new THREE.Vector3(
    unit.position.x + member.currentOffset.x,
    unit.position.y,
    unit.position.z + member.currentOffset.z,
  );
}

export class UnitManager {
  constructor(scene, factionManager = null) {
    this.scene          = scene;
    this.factionManager = factionManager;
    this.units          = [];
    this._towerTimers   = Object.fromEntries(Object.keys(TOWER_DATA).map(id => [id, 0]));
    this._shotFlashes   = [];
    this._pendingSpawns = [];
  }

  _createShotFlash(td, target) {
    const pts = [
      new THREE.Vector3(td.x, td.y, td.z),
      new THREE.Vector3(target.position.x, target.position.y, target.position.z),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this._shotFlashes.push({ line, timeLeft: FLASH_DURATION });
  }

  spawn(cardId, side, lane, deployPoint = null) {
    const delay = CARD_DEFS[cardId]?.deployRules?.deployDelay ?? 0;
    if (delay > 0) {
      const ghost = this._createGhost(side, deployPoint);
      this._pendingSpawns.push({ cardId, side, lane, deployPoint, timer: delay, totalDelay: delay, ghost });
      return null;
    }
    const unit = new Unit(this.scene, cardId, side, lane, deployPoint);
    this.units.push(unit);
    return unit;
  }

  _createGhost(side, deployPoint) {
    const group = new THREE.Group();
    const color = side === 'player' ? 0x44aaff : 0xff4422;

    const ringGeo = new THREE.RingGeometry(0.4, 0.85, 18);
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const ring    = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    const bodyGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.9, 8);
    const bodyMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28 });
    const body    = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0;
    group.add(body);

    group.position.set(deployPoint?.x ?? 0, 0.04, deployPoint?.z ?? 0);
    this.scene.add(group);
    return group;
  }

  _destroyGhost(ghost) {
    this.scene.remove(ghost);
    for (const child of ghost.children) {
      child.geometry.dispose();
      child.material.dispose();
    }
  }

  update(delta, towerManager, onTowerDestroyed, onEngineerArrived) {
    const fm  = this.factionManager;
    const now = performance.now() / 1000;

    // ── Pending (delayed) spawns ────────────────────────────────────────────
    for (let i = this._pendingSpawns.length - 1; i >= 0; i--) {
      const p = this._pendingSpawns[i];
      p.timer -= delta;

      // Pulse ring and body
      const phase = (1 - p.timer / p.totalDelay) * Math.PI * 8;
      p.ghost.children[0].material.opacity = 0.45 + 0.3  * Math.sin(phase);
      p.ghost.children[1].material.opacity = 0.12 + 0.12 * Math.sin(phase * 0.5);

      if (p.timer <= 0) {
        this._destroyGhost(p.ghost);
        const unit = new Unit(this.scene, p.cardId, p.side, p.lane, p.deployPoint);
        this.units.push(unit);
        this._pendingSpawns.splice(i, 1);
      }
    }

    // ── Tower shooting ──────────────────────────────────────────────────────
    for (const [towerId, td] of Object.entries(TOWER_DATA)) {
      const tower = towerManager.towers[towerId];
      if (!tower?.alive) continue;

      this._towerTimers[towerId] = Math.max(0, this._towerTimers[towerId] - delta);
      if (this._towerTimers[towerId] > 0) continue;

      const enemySide = td.side === 'player' ? 'enemy' : 'player';
      let target = null, minDist = Infinity;

      for (const u of this.units) {
        if (!u.alive || u.side !== enemySide) continue;
        const d = dist2D(td.x, td.z, u.position.x, u.position.z);
        if (d <= td.range && d < minDist) { minDist = d; target = u; }
      }

      if (target) {
        this._createShotFlash(td, target);
        let dmg = td.damage;
        if (fm) dmg = fm.applyBattleOrderDefense(target, dmg, towerManager);
        target.takeDamage(dmg);
        target.onHit(this.scene);
        this._towerTimers[towerId] = td.cooldown;
        if (target.hp <= 0) target.remove();
      }
    }

    // ── Unit AI ─────────────────────────────────────────────────────────────
    for (const unit of this.units) {
      if (!unit.alive) continue;
      unit.attackTimer = Math.max(0, unit.attackTimer - delta);

      // Micro-animations
      unit.updateVisual(delta, now);
      // Squad model positions (always update so peeling/returning is smooth even while turning)
      unit.updateSquadMemberPositions(delta);

      // ── Engineer ────────────────────────────────────────────────────────
      if (unit.cardId === 'engineer') {
        const dx = RESOURCE_NODE_POS.x - unit.position.x;
        const dz = RESOURCE_NODE_POS.z - unit.position.z;
        const d  = Math.sqrt(dx * dx + dz * dz);
        if (d <= 1.5) {
          spawnEngineerRing(this.scene, unit.position.clone());
          unit.remove();
          onEngineerArrived(unit.side);
        } else {
          unit.position.x += (dx / d) * unit.def.speed * delta;
          unit.position.z += (dz / d) * unit.def.speed * delta;
        }
        continue;
      }

      // ── Turning state: unit stopped, waiting to face a target behind it ─
      if (unit.isTurning) {
        unit.turnTimer = Math.max(0, unit.turnTimer - delta);
        if (unit.turnTimer <= 0) {
          unit.isTurning = false;
        }
        // Do not move or attack while turning
        continue;
      }

      // ── Find target tower ───────────────────────────────────────────────
      const chain = LANE_TOWER_CHAIN[unit.side][unit.lane];
      let targetTowerId = null;
      for (const tid of chain) {
        if (towerManager.towers[tid]?.alive) { targetTowerId = tid; break; }
      }
      if (!targetTowerId) continue;

      const tp       = TOWER_DATA[targetTowerId];
      const dToTower = dist2D(unit.position.x, unit.position.z, tp.x, tp.z);

      // While the first (non-citadel) enemy tower on this lane is alive, the unit
      // is locked to its lane X and may not cross into adjacent lanes.
      // Once that tower falls (or for center-lane units), X movement is freed.
      const blockingTowerId = chain.length > 1 ? chain[0] : null;
      const pathBlocked = blockingTowerId ? towerManager.towers[blockingTowerId]?.alive === true : false;

      // ── Find closest enemy unit (aggro radius = range + 2.5) ───────────
      const aggroRadius = Math.max(unit.def.range * 1.5, 2.5);
      let closestEnemy = null, closestDist = Infinity;
      for (const e of this.units) {
        if (!e.alive || e.side === unit.side) continue;
        if (!unit.def.targetTypes.includes(e.def.unitType)) continue;
        const d = dist2D(unit.position.x, unit.position.z, e.position.x, e.position.z);
        if (d < closestDist) { closestDist = d; closestEnemy = e; }
      }

      const enemyInRange   = closestEnemy && closestDist <= unit.def.range;
      const enemyInAggro   = closestEnemy && closestDist <= aggroRadius;
      const towerInRange   = dToTower <= unit.def.range;

      // Engineer inside aggro radius = sticky threat: unit won't switch to tower,
      // chases regardless of direction.
      const engineerThreat = closestEnemy?.cardId === 'engineer' && enemyInAggro;

      // True only when the closest enemy is in the same direction as the target tower.
      // Engineers are always "ahead" — units pursue them even if they've passed by.
      const closestEnemyIsAhead = !!closestEnemy &&
        (closestEnemy.cardId === 'engineer' ||
          (closestEnemy.position.z - unit.position.z) * (tp.z - unit.position.z) >= 0);

      // ── Squad sub-target picking (per-member peel toward a closer enemy) ─
      if (unit.squadLeashRadius > 0 && unit.def.peelChance > 0 && closestEnemy) {
        const activeCount = unit.getActiveSquadCount();
        for (let mi = 0; mi < activeCount; mi++) {
          const member = unit.squadMembers[mi];
          // Expire dead sub-targets
          if (member.subTarget && (!member.subTarget.alive || member.subTarget.hp <= 0)) {
            member.subTarget = null;
            member.state = member.state === 'peeling' ? 'returning' : 'formation';
          }
          member.nextSubTargetCheck = Math.max(0, member.nextSubTargetCheck - delta);
          if (member.nextSubTargetCheck > 0) continue;
          member.nextSubTargetCheck = SUB_TARGET_CHECK_INTERVAL;

          const mx = unit.position.x + member.currentOffset.x;
          const mz = unit.position.z + member.currentOffset.z;
          const mainD = dist2D(mx, mz, closestEnemy.position.x, closestEnemy.position.z);

          let bestAlt = null, bestAltD = Infinity;
          for (const e of this.units) {
            if (!e.alive || e.side === unit.side || e === closestEnemy) continue;
            if (!unit.def.targetTypes.includes(e.def.unitType)) continue;
            const d = dist2D(mx, mz, e.position.x, e.position.z);
            if (d < bestAltD) { bestAltD = d; bestAlt = e; }
          }

          if (bestAlt && (mainD - bestAltD) >= MIN_BENEFIT_DISTANCE) {
            if (Math.random() < unit.def.peelChance) {
              member.subTarget = bestAlt;
              member.state = 'peeling';
            }
          } else if (!member.subTarget) {
            member.state = 'formation';
          }
        }
      }

      // ── Check if we need to turn toward this enemy ─────────────────────
      if (
        enemyInAggro &&
        closestEnemyIsAhead &&
        unit.def.turnDelay > 0 &&
        unit._turningTarget !== closestEnemy &&
        !unit.isTargetInFront(closestEnemy) &&
        !engineerThreat  // engineers are urgent — no turn delay
      ) {
        unit.isTurning      = true;
        unit.turnTimer      = unit.def.turnDelay;
        unit._turningTarget = closestEnemy;
        continue;
      }

      if (enemyInRange) {
        if (unit.attackTimer === 0) {
          // Each active squad member attacks its own target (subTarget || main target)
          const activeCount = unit.getActiveSquadCount();
          for (let mi = 0; mi < activeCount; mi++) {
            const member  = unit.squadMembers[mi];
            const mTarget = (member.subTarget?.alive && member.subTarget.hp > 0)
              ? member.subTarget : closestEnemy;

            let dmg = calcUnitDamage(unit, mTarget) / activeCount;
            if (fm) dmg = fm.applyBattleOrderDefense(mTarget, dmg, towerManager);
            mTarget.takeDamage(dmg);
            mTarget.onHit(this.scene);
            _spawnMemberAttackVfx(this.scene, unit.cardId,
              getMemberWorldPos(unit, member), mTarget.position.clone());
            if (mTarget.hp <= 0) mTarget.remove();
          }

          const cdMult = fm ? fm.getBattleOrderCooldownMult(unit, towerManager) : 1.0;
          unit.attackTimer = unit.def.attackCooldown * cdMult;
        }
      } else if (towerInRange && !engineerThreat) {
        if (unit.attackTimer === 0) {
          const defSide     = targetTowerId.startsWith('player') ? 'player' : 'enemy';
          const isCitadel   = towerManager.towers[targetTowerId]?.isCitadel;
          const towerPos    = new THREE.Vector3(tp.x, 0.5, tp.z);
          const activeCount = unit.getActiveSquadCount();

          // Each active member deals buildingDamage to the tower
          for (let mi = 0; mi < activeCount; mi++) {
            let dmg = unit.def.buildingDamage / activeCount;
            if (fm && isCitadel) dmg = fm.applyShieldReduction(defSide, dmg);
            _spawnMemberTowerVfx(this.scene, unit.cardId, towerPos);
            const destroyed = towerManager.damageTower(targetTowerId, dmg);
            if (destroyed) {
              onTowerDestroyed(targetTowerId);
              break; // tower gone — remaining members have nothing to hit
            } else if (fm && isCitadel) {
              const citadel = towerManager.towers[targetTowerId];
              fm.checkCitadelShield(defSide, citadel.hp, citadel.maxHp);
            }
          }

          const cdMult = fm ? fm.getBattleOrderCooldownMult(unit, towerManager) : 1.0;
          unit.attackTimer = unit.def.attackCooldown * cdMult;
        }
      } else {
        // Move toward target tower, or toward the closest enemy if it is ahead.
        // Behind-enemies are ignored: unit keeps advancing instead of turning back.
        let destX = tp.x, destZ = tp.z, dist = dToTower;
        if (enemyInAggro && closestEnemyIsAhead) {
          destX = closestEnemy.position.x;
          destZ = closestEnemy.position.z;
          dist  = closestDist;
        }
        if (dist > 0.01) {
          if (pathBlocked) {
            // Enemy tower on this lane is alive: keep X pinned to lane, advance only along Z
            unit.position.x = LANE_X[unit.lane];
            const dz = destZ - unit.position.z;
            const absZ = Math.abs(dz);
            if (absZ > 0.01) {
              unit.position.z += (dz / absZ) * unit.def.speed * delta;
            }
          } else {
            // Path to citadel is open: free X+Z movement
            unit.position.x += ((destX - unit.position.x) / dist) * unit.def.speed * delta;
            unit.position.z += ((destZ - unit.position.z) / dist) * unit.def.speed * delta;
          }
        }
      }
    }

    // Purge dead units
    this.units = this.units.filter(u => u.alive);

    // Tick VFX pool
    tickVfx(this.scene, now);

    // Fade shot flashes
    for (let i = this._shotFlashes.length - 1; i >= 0; i--) {
      const f = this._shotFlashes[i];
      f.timeLeft -= delta;
      f.line.material.opacity = Math.max(0, f.timeLeft / FLASH_DURATION) * 0.9;
      if (f.timeLeft <= 0) {
        this.scene.remove(f.line);
        f.line.geometry.dispose();
        f.line.material.dispose();
        this._shotFlashes.splice(i, 1);
      }
    }
  }

  reset() {
    for (const u of this.units) u.remove();
    this.units = [];
    for (const id of Object.keys(this._towerTimers)) this._towerTimers[id] = 0;
    for (const f of this._shotFlashes) {
      this.scene.remove(f.line);
      f.line.geometry.dispose();
      f.line.material.dispose();
    }
    this._shotFlashes = [];
    for (const p of this._pendingSpawns) this._destroyGhost(p.ghost);
    this._pendingSpawns = [];
  }
}
