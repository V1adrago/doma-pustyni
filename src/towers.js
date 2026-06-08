import * as THREE from 'three';
import { HONOR_TOWER_COLORS } from './factions.js';

function makeHpSprite(barWidth) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 8;
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(barWidth, barWidth * (8 / 64), 1);
  sprite.renderOrder = 10;
  return { sprite, canvas, texture };
}

function drawHpBar(canvas, texture, ratio) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);
  const color = ratio > 0.5 ? '#22cc55' : ratio > 0.25 ? '#ffaa00' : '#ee3322';
  ctx.fillStyle = color;
  ctx.fillRect(1, 1, Math.max(0, Math.round((w - 2) * ratio)), h - 2);
  texture.needsUpdate = true;
}

function lerpHex(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r  = Math.round(ar + (br - ar) * t);
  const g  = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

const COL_PLAYER    = 0x2563c4;
const COL_PLAYER_CAP = 0x1a4080;
const COL_ENEMY     = 0xb02020;
const COL_ENEMY_CAP  = 0x6e1010;
const COL_DESTROYED  = 0x484848;
const COL_CAP_DEAD   = 0x303030;
const COL_BASE       = 0x7a6035;

const TOWER_MAX_HP = { side: 1300, citadel: 2200 };

// Tower layout
//   Player (bottom, positive Z): citadel at z=13, side towers at z=11
//   Enemy  (top,    negative Z): citadel at z=-13, side towers at z=-11
const TOWER_DEFS = [
  { id: 'player_left',    x: -6, z:  11, isCitadel: false, side: 'player' },
  { id: 'player_citadel', x:  0, z:  13, isCitadel: true,  side: 'player' },
  { id: 'player_right',   x:  6, z:  11, isCitadel: false, side: 'player' },
  { id: 'enemy_left',     x: -6, z: -11, isCitadel: false, side: 'enemy'  },
  { id: 'enemy_citadel',  x:  0, z: -13, isCitadel: true,  side: 'enemy'  },
  { id: 'enemy_right',    x:  6, z: -11, isCitadel: false, side: 'enemy'  },
];

export class TowerManager {
  constructor(scene) {
    this.scene = scene;
    this.towers   = {};   // id → { alive, isCitadel, side, hp, maxHp }
    this.meshData = {};   // id → mesh + material refs + damage state
    this.hitTargets = []; // flat list of body meshes for raycasting

    TOWER_DEFS.forEach(def => this._buildTower(def));
  }

  _buildTower({ id, x, z, isCitadel, side }) {
    const isPlayer = side === 'player';
    const bodyColor = isPlayer ? COL_PLAYER : COL_ENEMY;
    const capColor  = isPlayer ? COL_PLAYER_CAP : COL_ENEMY_CAP;

    const group = new THREE.Group();
    group.userData.tiltDir = Math.random() > 0.5 ? 1 : -1;

    // ── Base hexagonal slab ──────────────────────────────────────────────────
    const baseR    = isCitadel ? 2.1 : 1.5;
    const baseGeo  = new THREE.CylinderGeometry(baseR * 0.9, baseR, 0.45, 6);
    const baseMat  = new THREE.MeshLambertMaterial({ color: COL_BASE });
    const base     = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.225;
    base.receiveShadow = true;
    group.add(base);

    // ── Tower body ───────────────────────────────────────────────────────────
    const towerH  = isCitadel ? 5.0 : 3.2;
    const botR    = isCitadel ? 1.4 : 0.9;
    const topR    = isCitadel ? 1.1 : 0.7;
    const segments = 6;

    const bodyGeo = new THREE.CylinderGeometry(topR, botR, towerH, segments);
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const body    = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.45 + towerH / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // ── Tower cap ────────────────────────────────────────────────────────────
    const capH   = isCitadel ? 1.8 : 1.1;
    const capGeo = new THREE.ConeGeometry(topR + 0.2, capH, segments);
    const capMat = new THREE.MeshLambertMaterial({ color: capColor });
    const cap    = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.45 + towerH + capH / 2;
    cap.castShadow = true;
    group.add(cap);

    // ── Battlements (citadel only) ────────────────────────────────────────────
    const battlements = [];
    if (isCitadel) {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const bGeo  = new THREE.BoxGeometry(0.25, 0.4, 0.25);
        const bMat  = new THREE.MeshLambertMaterial({ color: bodyColor });
        const bMesh = new THREE.Mesh(bGeo, bMat);
        bMesh.position.set(
          Math.cos(angle) * topR,
          0.45 + towerH + 0.2,
          Math.sin(angle) * topR,
        );
        group.add(bMesh);
        battlements.push(bMesh);
      }
    }

    // ── Garrison shield sphere (citadels only, Дом Чести mechanic) ───────────
    let shieldMesh = null;
    let shieldMat  = null;
    if (isCitadel) {
      const shieldY = 0.45 + towerH / 2;

      const shieldGeo = new THREE.SphereGeometry(2.6, 16, 10);
      shieldMat = new THREE.MeshBasicMaterial({
        color: 0xffd060,
        transparent: true,
        opacity: 0,
        side: THREE.FrontSide,
        depthWrite: false,
      });
      shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
      shieldMesh.position.y = shieldY;
      shieldMesh.visible = false;
      group.add(shieldMesh);

      const wireGeo = new THREE.SphereGeometry(2.65, 12, 8);
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xffe080,
        transparent: true,
        opacity: 0,
        wireframe: true,
        depthWrite: false,
      });
      const wireMesh = new THREE.Mesh(wireGeo, wireMat);
      wireMesh.position.y = shieldY;
      wireMesh.visible = false;
      group.add(wireMesh);

      shieldMesh.userData.wireMesh = wireMesh;
      shieldMesh.userData.wireMat  = wireMat;
    }

    group.position.set(x, 0, z);
    this.scene.add(group);

    body.userData.towerId = id;

    const maxHp = isCitadel ? TOWER_MAX_HP.citadel : TOWER_MAX_HP.side;

    const barWidth = isCitadel ? 3.0 : 2.5;
    const barY     = 0.45 + towerH + 1.0;
    const { sprite: hpSprite, canvas: hpCanvas, texture: hpTex } = makeHpSprite(barWidth);
    hpSprite.position.set(0, barY, 0);
    group.add(hpSprite);
    drawHpBar(hpCanvas, hpTex, 1);

    this.towers[id]   = { alive: true, isCitadel, side, hp: maxHp, maxHp };
    this.meshData[id] = {
      group, bodyMat, capMat, body, hpSprite, hpCanvas, hpTex,
      shieldMesh, shieldMat, battlements, ruinsGroup: null,
      baseBodyColor: bodyColor, baseCapColor: capColor,
      towerH, botR, topR, capH,
    };
    this.hitTargets.push(body);
  }

  refreshHpBar(id) {
    const tower = this.towers[id];
    const { hpCanvas, hpTex } = this.meshData[id];
    drawHpBar(hpCanvas, hpTex, Math.max(0, tower.hp) / tower.maxHp);
  }

  // Called every time a tower takes damage — updates colors, tilt, battlements.
  updateDamageVisual(id) {
    const tower = this.towers[id];
    if (!tower?.alive) return;
    const ratio  = tower.hp / tower.maxHp; // 1=full, 0=dead
    const damage = 1 - ratio;              // 0=none, 1=destroyed
    const { bodyMat, capMat, group, baseBodyColor, baseCapColor, battlements } = this.meshData[id];

    // Color darkening: starts at 30% damage, full at 100%
    const colT = damage > 0.3 ? Math.min(1, (damage - 0.3) / 0.7) : 0;
    const newBody = lerpHex(baseBodyColor, COL_DESTROYED, colT * 0.9);
    const newCap  = lerpHex(baseCapColor,  COL_CAP_DEAD,  colT * 0.9);
    bodyMat.color.setHex(newBody);
    capMat.color.setHex(newCap);
    battlements.forEach(b => b.material.color.setHex(newBody));

    // Tilt: starts at 40% damage, max ~6° at death
    const tiltT = damage > 0.4 ? Math.min(1, (damage - 0.4) / 0.6) : 0;
    group.rotation.z = tiltT * 0.10 * (group.userData.tiltDir || 1);

    // Battlements fall off as HP drops (citadel only)
    if (battlements.length > 0) {
      const keep = Math.ceil(battlements.length * ratio * 1.4);
      battlements.forEach((b, i) => { b.visible = i < keep; });
    }
  }

  // Builds a ruins mesh group at the tower's position and adds it to the scene.
  _buildRuins(id) {
    const md   = this.meshData[id];
    const { group, towerH, botR, topR, capH } = md;
    const isCitadel = this.towers[id].isCitadel;

    const ruinsGroup = new THREE.Group();
    ruinsGroup.position.copy(group.position);

    // ── Rubble mound ──────────────────────────────────────────────────────────
    const moundR   = isCitadel ? 1.85 : 1.3;
    const moundGeo = new THREE.CylinderGeometry(moundR * 0.62, moundR, 0.42, 8);
    const moundMat = new THREE.MeshLambertMaterial({ color: 0x6b5530 });
    const mound    = new THREE.Mesh(moundGeo, moundMat);
    mound.position.y = 0.21;
    mound.receiveShadow = true;
    ruinsGroup.add(mound);

    // ── Broken stone chunks (pseudo-random but deterministic per id) ──────────
    const stoneCount = isCitadel ? 5 : 3;
    for (let i = 0; i < stoneCount; i++) {
      const seed = i * 7 + id.charCodeAt(i % id.length) * 3;
      const w = 0.28 + (seed % 11) * 0.03;
      const h = 0.18 + (seed % 7)  * 0.025;
      const d = 0.22 + (seed % 9)  * 0.03;
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshLambertMaterial({ color: 0x3d3028 });
      const mesh = new THREE.Mesh(geo, mat);
      const angle = (i / stoneCount) * Math.PI * 2 + seed * 0.08;
      const dist  = 0.3 + (seed % 13) * 0.05;
      mesh.position.set(
        Math.cos(angle) * dist,
        h / 2 + 0.22,
        Math.sin(angle) * dist
      );
      mesh.rotation.set(
        ((seed % 9) - 4) * 0.09,
        seed * 0.4,
        ((seed % 7) - 3) * 0.07
      );
      mesh.castShadow = true;
      ruinsGroup.add(mesh);
    }

    // ── Low broken stump ──────────────────────────────────────────────────────
    const stumpH   = isCitadel ? 0.65 : 0.40;
    const stumpGeo = new THREE.CylinderGeometry(topR * 0.72, botR * 0.88, stumpH, 6);
    const stumpMat = new THREE.MeshLambertMaterial({ color: 0x3a3028 });
    const stump    = new THREE.Mesh(stumpGeo, stumpMat);
    stump.position.y = 0.45 + stumpH / 2;
    stump.castShadow = true;
    ruinsGroup.add(stump);

    // ── Fallen cap piece (lying on its side) ──────────────────────────────────
    const fcGeo = new THREE.ConeGeometry(topR + 0.18, capH * 0.88, 6);
    const fcMat = new THREE.MeshLambertMaterial({ color: COL_CAP_DEAD });
    const fc    = new THREE.Mesh(fcGeo, fcMat);
    const fcSeed  = id.charCodeAt(0) + id.charCodeAt(id.length - 1) * 17;
    const fcAngle = fcSeed * 0.23;
    const fcDist  = isCitadel ? 1.1 : 0.75;
    fc.position.set(
      Math.cos(fcAngle) * fcDist,
      capH * 0.21,
      Math.sin(fcAngle) * fcDist
    );
    fc.rotation.x = Math.PI * 0.48 + (fcSeed % 5) * 0.02;
    fc.rotation.z = (fcSeed % 7 - 3) * 0.04;
    fc.castShadow = true;
    ruinsGroup.add(fc);

    // ── Extra large fragment for citadel (broken wall chunk) ─────────────────
    if (isCitadel) {
      const wGeo = new THREE.BoxGeometry(0.55, 0.8, 0.3);
      const wMat = new THREE.MeshLambertMaterial({ color: 0x48382a });
      const wall = new THREE.Mesh(wGeo, wMat);
      wall.position.set(-fcDist * 0.7, 0.4, fcDist * 0.5);
      wall.rotation.set(0.15, 1.1, 0.3);
      wall.castShadow = true;
      ruinsGroup.add(wall);
    }

    this.scene.add(ruinsGroup);
    md.ruinsGroup = ruinsGroup;
  }

  // Damage a tower by amount. Returns true if this call destroyed it.
  damageTower(id, amount) {
    const tower = this.towers[id];
    if (!tower?.alive) return false;
    tower.hp -= amount;
    if (tower.hp <= 0) tower.hp = 0;
    this.refreshHpBar(id);
    this.updateDamageVisual(id);
    if (tower.hp <= 0) return this.destroyTower(id);
    return false;
  }

  // Returns true if tower was actually destroyed (was alive before).
  destroyTower(id) {
    const tower = this.towers[id];
    if (!tower || !tower.alive) return false;

    tower.alive = false;

    const md = this.meshData[id];
    md.group.visible = false;
    md.hpSprite.visible = false;

    this._buildRuins(id);

    return true;
  }

  resetAll() {
    TOWER_DEFS.forEach(def => {
      const { id, side, isCitadel } = def;
      const isPlayer = side === 'player';
      const bodyColor = isPlayer ? COL_PLAYER : COL_ENEMY;
      const capColor  = isPlayer ? COL_PLAYER_CAP : COL_ENEMY_CAP;

      const maxHp = isCitadel ? TOWER_MAX_HP.citadel : TOWER_MAX_HP.side;
      this.towers[id].alive = true;
      this.towers[id].hp    = maxHp;
      this.towers[id].maxHp = maxHp;

      const md = this.meshData[id];

      // Restore stored base colors (overridden by applyFactionColors if needed)
      md.baseBodyColor = bodyColor;
      md.baseCapColor  = capColor;

      md.bodyMat.color.setHex(bodyColor);
      md.bodyMat.transparent = false;
      md.bodyMat.opacity = 1;
      md.capMat.color.setHex(capColor);
      md.capMat.transparent = false;
      md.capMat.opacity = 1;

      // Restore group
      md.group.rotation.z = 0;
      md.group.visible = true;
      md.hpSprite.visible = true;
      this.refreshHpBar(id);

      // Restore battlements
      md.battlements.forEach(b => {
        b.visible = true;
        b.material.color.setHex(bodyColor);
      });

      // Remove ruins from scene and dispose
      if (md.ruinsGroup) {
        this.scene.remove(md.ruinsGroup);
        md.ruinsGroup.traverse(child => {
          if (child.isMesh) {
            child.geometry.dispose();
            child.material.dispose();
          }
        });
        md.ruinsGroup = null;
      }
    });

    for (const side of ['player', 'enemy']) {
      this.deactivateShieldVisual(side);
    }
  }

  // ── Faction color support ─────────────────────────────────────────────────

  applyFactionColors(side, factionId) {
    const isPlayer = side === 'player';
    const newBody = factionId === 'honor' ? HONOR_TOWER_COLORS.body : (isPlayer ? COL_PLAYER : COL_ENEMY);
    const newCap  = factionId === 'honor' ? HONOR_TOWER_COLORS.cap  : (isPlayer ? COL_PLAYER_CAP : COL_ENEMY_CAP);

    for (const suffix of ['left', 'citadel', 'right']) {
      const id = `${side}_${suffix}`;
      const md = this.meshData[id];
      const { bodyMat, capMat, group } = md;

      bodyMat.color.setHex(newBody);
      capMat.color.setHex(newCap);

      // Update stored base colors so damage lerping uses faction color as start
      md.baseBodyColor = newBody;
      md.baseCapColor  = newCap;

      const prevBody = isPlayer ? COL_PLAYER : COL_ENEMY;
      group.traverse(child => {
        if (!child.isMesh || child.material === bodyMat || child.material === capMat) return;
        if (child.material?.isMeshLambertMaterial && !child.material.transparent) {
          const hex = child.material.color.getHex();
          if (hex === prevBody || hex === newBody || hex === HONOR_TOWER_COLORS.body) {
            child.material.color.setHex(newBody);
          }
        }
      });
    }
  }

  // ── Garrison shield visual ────────────────────────────────────────────────

  activateShieldVisual(side) {
    const md = this.meshData[`${side}_citadel`];
    if (!md?.shieldMesh) return;
    md.shieldMesh.visible = true;
    const wire = md.shieldMesh.userData.wireMesh;
    if (wire) wire.visible = true;
  }

  deactivateShieldVisual(side) {
    const md = this.meshData[`${side}_citadel`];
    if (!md?.shieldMesh) return;
    md.shieldMesh.visible = false;
    if (md.shieldMat) md.shieldMat.opacity = 0;
    const wire = md.shieldMesh.userData.wireMesh;
    if (wire) {
      wire.visible = false;
      wire.userData.wireMat && (wire.userData.wireMat.opacity = 0);
      md.shieldMesh.userData.wireMat && (md.shieldMesh.userData.wireMat.opacity = 0);
    }
  }

  isShieldVisualActive(side) {
    return this.meshData[`${side}_citadel`]?.shieldMesh?.visible ?? false;
  }

  // Animate shield opacity pulse — call every frame with current timestamp (ms)
  updateShieldPulse(timestamp) {
    const t = timestamp * 0.0025;
    for (const side of ['player', 'enemy']) {
      const { shieldMesh, shieldMat } = this.meshData[`${side}_citadel`] ?? {};
      if (!shieldMesh?.visible || !shieldMat) continue;
      const pulse = 0.18 + Math.abs(Math.sin(t)) * 0.22;
      shieldMat.opacity = pulse;
      const wireMat = shieldMesh.userData.wireMat;
      if (wireMat) wireMat.opacity = pulse * 1.5;
    }
  }

  // Returns live tower state objects (shared reference — mutations are reflected)
  getPlayerTowerState() {
    return {
      left:    this.towers['player_left'],
      citadel: this.towers['player_citadel'],
      right:   this.towers['player_right'],
    };
  }

  getEnemyTowerState() {
    return {
      left:    this.towers['enemy_left'],
      citadel: this.towers['enemy_citadel'],
      right:   this.towers['enemy_right'],
    };
  }
}
