import * as THREE from 'three';
import { CARD_DEFS } from './cards.js';

export const LANE_X = { left: -6, center: 0, right: 6 };
const SPAWN_Z = { player: 14.5, enemy: -14.5 };

// ── HP Bar ───────────────────────────────────────────────────────────────────

function makeNameSprite(name, side) {
  const W = 256, H = 36;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  // dark pill background
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.beginPath();
  ctx.roundRect(2, 2, W - 4, H - 4, 6);
  ctx.fill();
  // colored border
  ctx.strokeStyle = side === 'player' ? '#6699ff' : '#ff6644';
  ctx.lineWidth = 2;
  ctx.stroke();
  // white text
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, W / 2, H / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.2, 0.44, 1);
  sprite.renderOrder = 11;
  return sprite;
}

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

export const RESOURCE_NODE_POS = { x: 0, z: 0 };

const UNIT_COLOR = {
  player: { ground: 0x2266dd, air: 0x44aaff },
  enemy:  { ground: 0xcc2222, air: 0xff6644 },
};

// ── Unit mesh builders ───────────────────────────────────────────────────────

function buildEngineer(side) {
  const color = UNIT_COLOR[side].ground;
  const g = new THREE.Group();

  const bodyGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.55, 7);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  g.add(body);

  const headGeo = new THREE.SphereGeometry(0.18, 6, 5);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xd4a060 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.40;
  head.castShadow = true;
  g.add(head);

  const packGeo = new THREE.BoxGeometry(0.20, 0.28, 0.14);
  const packMat = new THREE.MeshLambertMaterial({ color: 0x4a3a20 });
  const pack = new THREE.Mesh(packGeo, packMat);
  pack.position.set(0, 0.06, 0.22);
  g.add(pack);

  const antGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.28, 4);
  const antMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const ant = new THREE.Mesh(antGeo, antMat);
  ant.position.set(0.12, 0.62, 0);
  g.add(ant);

  const contGeo = new THREE.BoxGeometry(0.14, 0.12, 0.14);
  const contMat = new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: 0xaa5500, emissiveIntensity: 0.6 });
  const cont = new THREE.Mesh(contGeo, contMat);
  cont.position.set(-0.18, 0.08, 0);
  g.add(cont);

  g._indicatorMesh = cont;
  return g;
}

function buildScout(side) {
  const color = UNIT_COLOR[side].ground;
  const g = new THREE.Group();

  const bodyGeo = new THREE.CapsuleGeometry(0.18, 0.40, 3, 7);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  g.add(body);

  const hoodGeo = new THREE.ConeGeometry(0.18, 0.22, 6);
  const hoodMat = new THREE.MeshLambertMaterial({ color: 0x8b6a30 });
  const hood = new THREE.Mesh(hoodGeo, hoodMat);
  hood.position.y = 0.40;
  g.add(hood);

  const bladeGeo = new THREE.BoxGeometry(0.06, 0.32, 0.04);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.set(0.22, 0.10, 0);
  blade.rotation.z = 0.3;
  g.add(blade);

  return g;
}

function buildSwordsman(side) {
  const color = UNIT_COLOR[side].ground;
  const g = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.52, 0.72, 0.42);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  g.add(body);

  const helmGeo = new THREE.BoxGeometry(0.38, 0.28, 0.36);
  const helmMat = new THREE.MeshLambertMaterial({ color: 0x556699 });
  const helm = new THREE.Mesh(helmGeo, helmMat);
  helm.position.y = 0.50;
  g.add(helm);

  const shldGeo = new THREE.BoxGeometry(0.70, 0.16, 0.36);
  const shldMat = new THREE.MeshLambertMaterial({ color: 0x445588 });
  const shld = new THREE.Mesh(shldGeo, shldMat);
  shld.position.y = 0.36;
  g.add(shld);

  const saberGeo = new THREE.BoxGeometry(0.05, 0.50, 0.04);
  const saberMat = new THREE.MeshLambertMaterial({ color: 0xddddcc });
  const saber = new THREE.Mesh(saberGeo, saberMat);
  saber.position.set(0.30, 0.08, 0);
  saber.rotation.z = -0.25;
  g.add(saber);

  const embGeo = new THREE.CircleGeometry(0.07, 5);
  const embMat = new THREE.MeshLambertMaterial({ color: 0xffcc44 });
  const emb = new THREE.Mesh(embGeo, embMat);
  emb.position.set(0, 0.10, -0.22);
  emb.rotation.y = Math.PI;
  g.add(emb);

  return g;
}

function buildAssault(side) {
  const color = UNIT_COLOR[side].ground;
  const g = new THREE.Group();

  const torsoGeo = new THREE.BoxGeometry(0.72, 0.88, 0.62);
  const torsoMat = new THREE.MeshLambertMaterial({ color });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.castShadow = true;
  g.add(torso);

  const lShldGeo = new THREE.BoxGeometry(0.28, 0.22, 0.56);
  const shldMat  = new THREE.MeshLambertMaterial({ color: 0x884422 });
  const lShld = new THREE.Mesh(lShldGeo, shldMat);
  lShld.position.set(-0.48, 0.38, 0);
  g.add(lShld);
  const rShld = new THREE.Mesh(lShldGeo, shldMat);
  rShld.position.set( 0.48, 0.38, 0);
  g.add(rShld);

  const helmGeo = new THREE.BoxGeometry(0.48, 0.30, 0.46);
  const helmMat = new THREE.MeshLambertMaterial({ color: 0x663311 });
  const helm = new THREE.Mesh(helmGeo, helmMat);
  helm.position.y = 0.60;
  g.add(helm);

  const hammerHeadGeo = new THREE.BoxGeometry(0.38, 0.26, 0.26);
  const hammerMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const hammerHead = new THREE.Mesh(hammerHeadGeo, hammerMat);
  hammerHead.position.set(0.52, -0.12, 0);
  g.add(hammerHead);

  const handleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.55, 5);
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x4a3a20 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(0.36, -0.04, 0);
  handle.rotation.z = Math.PI / 2;
  g.add(handle);

  return g;
}

function buildArcher(side) {
  const color = UNIT_COLOR[side].ground;
  const g = new THREE.Group();

  const bodyGeo = new THREE.CapsuleGeometry(0.19, 0.55, 3, 7);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  g.add(body);

  const hoodGeo = new THREE.ConeGeometry(0.22, 0.28, 6);
  const hoodMat = new THREE.MeshLambertMaterial({ color: 0x5a7a3a });
  const hood = new THREE.Mesh(hoodGeo, hoodMat);
  hood.position.y = 0.52;
  g.add(hood);

  const rifleGeo = new THREE.BoxGeometry(0.08, 0.08, 0.62);
  const rifleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const rifle = new THREE.Mesh(rifleGeo, rifleMat);
  rifle.position.set(0.25, 0.18, 0);
  g.add(rifle);

  const sightGeo = new THREE.BoxGeometry(0.06, 0.06, 0.12);
  const sightMat = new THREE.MeshLambertMaterial({ color: 0x226622 });
  const sight = new THREE.Mesh(sightGeo, sightMat);
  sight.position.set(0.25, 0.25, -0.08);
  g.add(sight);

  return g;
}

function buildSpearman(side) {
  const color = UNIT_COLOR[side].ground;
  const g = new THREE.Group();

  const bodyGeo = new THREE.CapsuleGeometry(0.19, 0.72, 3, 7);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  g.add(body);

  const shieldGeo = new THREE.BoxGeometry(0.06, 0.34, 0.28);
  const shieldMat = new THREE.MeshLambertMaterial({ color: 0x6a5a30 });
  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.set(-0.28, 0.08, 0);
  g.add(shield);

  const shaftGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.20, 5);
  const shaftMat = new THREE.MeshLambertMaterial({ color: 0x6a4a20 });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.set(0.28, 0.28, 0);
  shaft.rotation.z = 0.18;
  g.add(shaft);

  const tipGeo = new THREE.ConeGeometry(0.06, 0.22, 4);
  const tipMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  const tip = new THREE.Mesh(tipGeo, tipMat);
  tip.position.set(0.42, 0.96, 0);
  tip.rotation.z = 0.18;
  g.add(tip);

  return g;
}

function buildDrone(side) {
  const color = UNIT_COLOR[side].air;
  const g = new THREE.Group();

  const bodyGeo = new THREE.OctahedronGeometry(0.30, 0);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(1.6, 0.45, 1.0);
  body.castShadow = true;
  g.add(body);

  const finGeo = new THREE.BoxGeometry(0.28, 0.04, 0.10);
  const finMat = new THREE.MeshLambertMaterial({ color: 0x334466 });
  const offsets = [
    [ 0.32, 0, 0], [-0.32, 0, 0],
    [0, 0,  0.20], [0, 0, -0.20],
  ];
  for (const [x, y, z] of offsets) {
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(x, y, z);
    if (z !== 0) fin.rotation.y = Math.PI / 2;
    g.add(fin);
  }

  const eyeGeo = new THREE.SphereGeometry(0.07, 5, 4);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x00ffaa, emissive: 0x00aa55, emissiveIntensity: 0.8 });
  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.set(0, -0.10, 0);
  g.add(eye);

  return g;
}

function buildHeavy(side) {
  const color = UNIT_COLOR[side].ground;
  const g = new THREE.Group();

  const torsoGeo = new THREE.BoxGeometry(0.96, 1.00, 0.80);
  const torsoMat = new THREE.MeshLambertMaterial({ color });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.castShadow = true;
  g.add(torso);

  const helmGeo = new THREE.BoxGeometry(0.62, 0.38, 0.58);
  const helmMat = new THREE.MeshLambertMaterial({ color: 0x553344 });
  const helm = new THREE.Mesh(helmGeo, helmMat);
  helm.position.y = 0.70;
  g.add(helm);

  const lPlateGeo = new THREE.BoxGeometry(0.30, 0.24, 0.66);
  const plateMat  = new THREE.MeshLambertMaterial({ color: 0x442233 });
  const lPlate = new THREE.Mesh(lPlateGeo, plateMat);
  lPlate.position.set(-0.62, 0.40, 0);
  g.add(lPlate);
  const rPlate = new THREE.Mesh(lPlateGeo, plateMat);
  rPlate.position.set( 0.62, 0.40, 0);
  g.add(rPlate);

  const maceGeo = new THREE.SphereGeometry(0.22, 6, 4);
  const maceMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const mace = new THREE.Mesh(maceGeo, maceMat);
  mace.position.set(0.62, -0.12, 0);
  mace.scale.set(1, 0.70, 0.70);
  g.add(mace);

  const handleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.60, 5);
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x4a3a20 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(0.40, -0.08, 0);
  handle.rotation.z = Math.PI / 2;
  g.add(handle);

  return g;
}

function buildGuard(side) {
  const color = UNIT_COLOR[side].ground;
  const g = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.62, 0.88, 0.52);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  g.add(body);

  const helmGeo = new THREE.BoxGeometry(0.44, 0.30, 0.44);
  const helmMat = new THREE.MeshLambertMaterial({ color: 0xb8860b });
  const helm = new THREE.Mesh(helmGeo, helmMat);
  helm.position.y = 0.60;
  g.add(helm);

  const crestGeo = new THREE.BoxGeometry(0.08, 0.24, 0.42);
  const crestMat = new THREE.MeshLambertMaterial({ color: 0xd4a017, emissive: 0x664400, emissiveIntensity: 0.3 });
  const crest = new THREE.Mesh(crestGeo, crestMat);
  crest.position.y = 0.84;
  g.add(crest);

  const shieldGeo = new THREE.BoxGeometry(0.52, 0.70, 0.10);
  const shieldMat = new THREE.MeshLambertMaterial({ color: 0xd4a017, emissive: 0x553300, emissiveIntensity: 0.2 });
  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.set(0.22, 0.04, -0.36);
  shield.rotation.y = 0.18;
  shield.castShadow = true;
  g.add(shield);

  g._shieldMesh = shield;
  g._crestMesh  = crest;
  return g;
}

function buildMesh(def, side) {
  switch (def.armorClass) {
    case 'engineer':  return buildEngineer(side);
    case 'light':     return def.id === 'scout' ? buildScout(side) : buildDrone(side);
    case 'medium':    return buildSwordsman(side);
    case 'assault':   return buildAssault(side);
    case 'ranged':    return buildArcher(side);
    case 'antiHeavy': return buildSpearman(side);
    case 'heavy':     return buildHeavy(side);
    case 'guard':     return buildGuard(side);
    default:
      if (def.unitType === 'air') return buildDrone(side);
      return buildSwordsman(side);
  }
}

// ── VFX Pool ─────────────────────────────────────────────────────────────────

const _vfxPool = [];

function _cleanVfx(scene, now) {
  for (let i = _vfxPool.length - 1; i >= 0; i--) {
    const v = _vfxPool[i];
    const age = now - v.born;
    const t = Math.min(1, age / v.ttl);
    v.update(t);
    if (age >= v.ttl) {
      scene.remove(v.obj);
      v.obj.traverse(c => {
        if (c.isMesh) { c.geometry?.dispose(); c.material?.dispose(); }
        if (c.isLine) { c.geometry?.dispose(); c.material?.dispose(); }
      });
      _vfxPool.splice(i, 1);
    }
  }
}

function _addVfx(scene, obj, ttl, updateFn) {
  scene.add(obj);
  _vfxPool.push({ obj, ttl, born: performance.now() / 1000, update: updateFn });
}

export function spawnSlash(scene, pos, color, scale = 1.0) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.7 * scale, Math.sin(a) * 0.5 * scale, 0));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
  const arc = new THREE.Line(geo, mat);
  g.add(arc);
  g.position.copy(pos);
  g.position.y += 0.6;
  g.rotation.x = -0.3;
  _addVfx(scene, g, 0.28, t => { mat.opacity = 1 - t; g.scale.setScalar(1 + t * 0.5); });
}

export function spawnThrust(scene, from, to) {
  const pts = [from.clone(), to.clone()];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: 0xccccff, transparent: true, opacity: 1 });
  const line = new THREE.Line(geo, mat);
  _addVfx(scene, line, 0.20, t => { mat.opacity = 1 - t; });
}

export function spawnBolt(scene, from, to, color = 0xffff88) {
  const g = new THREE.Group();
  const dir = to.clone().sub(from).normalize();
  const geo = new THREE.CylinderGeometry(0.04, 0.04, 0.40, 4);
  const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  g.add(mesh);
  g.position.copy(from);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  _addVfx(scene, g, 0.35, t => {
    g.position.lerpVectors(from, to, t);
    mat.emissiveIntensity = 0.8 + Math.sin(t * Math.PI) * 0.4;
  });
}

export function spawnImpact(scene, pos, color = 0xccaa88, isBig = false) {
  const g = new THREE.Group();
  const cnt = isBig ? 5 : 3;
  const mats = [];
  for (let i = 0; i < cnt; i++) {
    const a = (i / cnt) * Math.PI * 2;
    const r = (0.3 + Math.random() * 0.3) * (isBig ? 1.6 : 1.0);
    const geo = new THREE.SphereGeometry(0.10 + Math.random() * 0.08, 4, 3);
    const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.8 });
    mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
    g.add(m);
  }
  g.position.copy(pos);
  g.position.y = 0.1;
  _addVfx(scene, g, isBig ? 0.50 : 0.32, t => {
    for (const m of mats) { m.opacity = (1 - t) * 0.8; }
    g.position.y = 0.1 + t * (isBig ? 0.8 : 0.4);
  });
}

export function spawnEngineerRing(scene, pos) {
  const geo = new THREE.RingGeometry(0.4, 0.7, 16);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffcc00, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(pos);
  ring.position.y = 0.15;
  _addVfx(scene, ring, 1.0, t => {
    ring.scale.setScalar(1 + t * 3.5);
    mat.opacity = (1 - t) * 0.9;
  });
}

export function spawnDeathDust(scene, pos) {
  const g = new THREE.Group();
  const mats = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const geo = new THREE.SphereGeometry(0.12 + Math.random() * 0.12, 4, 3);
    const mat = new THREE.MeshLambertMaterial({ color: 0xbba080, transparent: true, opacity: 0.7 });
    mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
    g.add(m);
  }
  g.position.copy(pos);
  _addVfx(scene, g, 0.6, t => {
    for (const m of mats) m.opacity = (1 - t) * 0.7;
    g.position.y = t * 0.6;
    g.scale.setScalar(1 + t * 1.5);
  });
}

export function spawnDronePulse(scene, from, to) {
  const pts = [from.clone(), to.clone()];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: 0x44ffcc, transparent: true, opacity: 1 });
  const line = new THREE.Line(geo, mat);
  _addVfx(scene, line, 0.22, t => { mat.opacity = 1 - t; mat.linewidth = 2; });
}

export function spawnShieldFlash(scene, shieldMesh) {
  if (!shieldMesh) return;
  const origIntensity = shieldMesh.material.emissiveIntensity;
  const dummy = new THREE.Group();
  _addVfx(scene, dummy, 0.30, t => {
    shieldMesh.material.emissiveIntensity = origIntensity + (1 - t) * 1.5;
  });
}

export function tickVfx(scene, now) {
  _cleanVfx(scene, now);
}

// ── Squad formation layout ────────────────────────────────────────────────────

const SQUAD_FORMATIONS = {
  1: [[0, 0, 0]],
  2: [[-0.28, 0, 0], [0.28, 0, 0]],
  3: [[0, 0, -0.22], [-0.30, 0, 0.22], [0.30, 0, 0.22]],
  4: [[0, 0, -0.32], [-0.32, 0, 0], [0.32, 0, 0], [0, 0, 0.32]],
};

// Scale each individual model down when there are multiple in the squad
const SQUAD_SCALE = { 1: 1.0, 2: 0.72, 3: 0.62 };

// ── Unit class ────────────────────────────────────────────────────────────────

export class Unit {
  constructor(scene, cardId, side, lane, deployPoint = null) {
    const def        = CARD_DEFS[cardId];
    this.scene       = scene;
    this.cardId      = cardId;
    this.def         = def;
    this.side        = side;
    this.lane        = lane;
    this.hp          = def.hp;
    this.maxHp       = def.hp;
    this.attackTimer = 0;
    this.alive       = true;
    this._time       = 0;

    // Turning state: unit stops and delays attack when target is behind
    this.isTurning      = false;
    this.turnTimer      = 0;
    this._turningTarget = null; // enemy unit reference that triggered the turn

    // Root group — external API (position, mesh.position) stays intact
    this.mesh = new THREE.Group();
    const y = def.unitType === 'air' ? 2.8 : 0.9;
    const spawnX = LANE_X[lane];
    const spawnZ = deployPoint ? deployPoint.z : SPAWN_Z[side];
    this.mesh.position.set(spawnX, y, spawnZ);
    scene.add(this.mesh);

    // Squad visual layer
    this.squadSize   = def.squadSize || 1;
    this.squadModels = [];
    this.squadGroup  = new THREE.Group();
    this.mesh.add(this.squadGroup);
    this._buildSquadVisual(def);
    this.lastVisibleSquadCount = this.squadSize;

    // Squad member combat tracking (sub-target, peel, per-member attack)
    this.squadLeashRadius = this.squadSize === 3 ? 1.15 : this.squadSize === 2 ? 0.85 : 0;
    const _offs  = SQUAD_FORMATIONS[this.squadSize] ?? [[0, 0, 0]];
    const _zFlip = this.side === 'player' ? 1 : -1;
    this.squadMembers = this.squadModels.map((model, i) => {
      const [ox, , oz] = _offs[i] ?? [0, 0, 0];
      const lo = new THREE.Vector3(ox, 0, oz * _zFlip);
      return { index: i, model, localOffset: lo, currentOffset: lo.clone(),
               subTarget: null, state: 'formation', isActive: true, nextSubTargetCheck: 0 };
    });

    // Single shared HP bar above the whole squad
    const { sprite, canvas, texture } = makeHpSprite(0.9);
    sprite.position.set(0, 1.2, 0);
    this.mesh.add(sprite);
    this._hpSprite = sprite;
    this._hpCanvas = canvas;
    this._hpTex    = texture;
    drawHpBar(canvas, texture, 1);

    // Unit name label above HP bar
    const nameSprite = makeNameSprite(def.name, side);
    nameSprite.position.set(0, 1.65, 0);
    this.mesh.add(nameSprite);

    // Cache per-model animation refs
    this._crestMeshes     = this.squadModels.map(m => m._crestMesh     ?? null).filter(Boolean);
    this._indicatorMeshes = this.squadModels.map(m => m._indicatorMesh ?? null).filter(Boolean);
    // Keep first-model refs for single-model backward compat
    this._shieldMesh    = this.squadModels[0]?._shieldMesh    ?? null;
    this._indicatorMesh = this.squadModels[0]?._indicatorMesh ?? null;
  }

  // Build individual model copies placed in formation inside squadGroup
  _buildSquadVisual(def) {
    const size    = this.squadSize;
    const scale   = SQUAD_SCALE[size] ?? 1.0;
    const offsets = SQUAD_FORMATIONS[size] ?? [[0, 0, 0]];
    // For enemy side, flip Z so the "front" model faces the player
    const zFlip   = this.side === 'player' ? 1 : -1;

    for (let i = 0; i < size; i++) {
      const model    = buildMesh(def, this.side);
      const [ox, oy, oz] = offsets[i];
      model.position.set(ox, oy, oz * zFlip);
      model.scale.setScalar(scale);
      this.squadGroup.add(model);
      this.squadModels.push(model);
    }
  }

  get position() { return this.mesh.position; }

  // How many squad models are currently active based on HP thresholds
  getActiveSquadCount() {
    if (this.hp <= 0) return 0;
    const r = this.hp / this.maxHp;
    if (this.squadSize === 3) return r > 0.66 ? 3 : r > 0.33 ? 2 : 1;
    if (this.squadSize === 2) return r > 0.50 ? 2 : 1;
    return 1;
  }

  // Returns true if target is in the forward hemisphere of this unit's movement direction.
  // Player units move toward -Z; enemy units move toward +Z.
  isTargetInFront(target) {
    const dz = target.position.z - this.position.z;
    return this.side === 'player' ? dz < 0 : dz > 0;
  }

  refreshHp() {
    drawHpBar(this._hpCanvas, this._hpTex, Math.max(0, this.hp) / this.maxHp);
  }

  // Central damage entry point — keeps squad visuals in sync
  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.refreshHp();
    this.updateSquadByHp();
  }

  // Hide squad models proportionally to HP loss; sync member.isActive; spawn dust
  updateSquadByHp() {
    const visibleCount = this.getActiveSquadCount();
    if (visibleCount === this.lastVisibleSquadCount) return;

    // Hide models from the back of the formation first (high index disappears first)
    for (let i = visibleCount; i < this.lastVisibleSquadCount; i++) {
      const model = this.squadModels[i];
      if (!model.visible) continue;
      model.visible = false;
      const wp = this.mesh.position.clone();
      wp.x += model.position.x;
      wp.z += model.position.z;
      spawnDeathDust(this.scene, wp);
      // Deactivate the corresponding squad member
      const member = this.squadMembers?.[i];
      if (member) { member.subTarget = null; member.state = 'formation'; member.isActive = false; }
    }

    this.lastVisibleSquadCount = visibleCount;
  }

  // Smoothly lerp squad model positions: toward formation slot or peeling toward sub-target
  updateSquadMemberPositions(delta) {
    if (this.squadLeashRadius === 0) return; // single-model unit, nothing to move
    const LERP = 5.0;
    for (const member of this.squadMembers) {
      if (!member.isActive) continue;
      let tx = member.localOffset.x, tz = member.localOffset.z;
      if (member.state === 'peeling' && member.subTarget?.alive) {
        const wx = this.mesh.position.x + member.currentOffset.x;
        const wz = this.mesh.position.z + member.currentOffset.z;
        const dx = member.subTarget.position.x - wx;
        const dz = member.subTarget.position.z - wz;
        const d  = Math.sqrt(dx * dx + dz * dz);
        if (d > 0.01) {
          tx = member.localOffset.x + (dx / d) * this.squadLeashRadius;
          tz = member.localOffset.z + (dz / d) * this.squadLeashRadius;
        }
      }
      member.currentOffset.x += (tx - member.currentOffset.x) * Math.min(1, LERP * delta);
      member.currentOffset.z += (tz - member.currentOffset.z) * Math.min(1, LERP * delta);
      member.model.position.x = member.currentOffset.x;
      member.model.position.z = member.currentOffset.z;
    }
  }

  // Called each frame: micro-animations on the squad group and per model
  updateVisual(delta, time) {
    if (!this.alive) return;
    this._time += delta;
    const t = this._time;

    // Group-level animation (whole formation moves together)
    switch (this.cardId) {
      case 'scout':
        this.squadGroup.rotation.z = Math.sin(t * 8) * 0.06;
        break;
      case 'swordsman':
      case 'spearman':
        this.squadGroup.rotation.z = Math.sin(t * 4) * 0.03;
        break;
      case 'assault':
        this.squadGroup.rotation.z = Math.sin(t * 2.5) * 0.02;
        break;
      case 'heavy':
        this.squadGroup.rotation.z = Math.sin(t * 1.8) * 0.04;
        break;
      case 'drone':
        this.mesh.position.y = 2.8 + Math.sin(t * 2.2) * 0.18;
        break;
      case 'engineer':
        for (const ind of this._indicatorMeshes) {
          ind.material.emissiveIntensity = 0.4 + Math.abs(Math.sin(t * 3)) * 0.8;
        }
        break;
      case 'guard':
        for (const crest of this._crestMeshes) {
          crest.material.emissiveIntensity = 0.15 + Math.abs(Math.sin(t * 1.5)) * 0.2;
        }
        break;
    }

    // Per-model phase offset — gives each member a slight individual sway
    if (this.squadSize > 1) {
      for (let i = 0; i < this.squadModels.length; i++) {
        const model = this.squadModels[i];
        if (!model.visible) continue;
        const phase = i * 0.5;
        switch (this.cardId) {
          case 'scout':
            model.rotation.z = Math.sin(t * 8 + phase) * 0.04;
            break;
          case 'swordsman':
          case 'spearman':
          case 'assault':
          case 'guard':
          case 'archer':
            model.rotation.z = Math.sin(t * 4 + phase) * 0.025;
            break;
        }
      }
    }
  }

  // VFX when hit: flash all visible guard shields
  onHit(scene) {
    if (this.cardId === 'guard') {
      for (const model of this.squadModels) {
        if (model.visible && model._shieldMesh) {
          spawnShieldFlash(scene, model._shieldMesh);
        }
      }
    }
  }

  // Remove from scene and dispose GPU resources
  // Death dust is emitted by updateSquadByHp() — not here — to avoid double dust
  remove() {
    this.alive = false;
    this._hpSprite.material.map.dispose();
    this._hpSprite.material.dispose();
    this.scene.remove(this.mesh);
    this.mesh.traverse(child => {
      if (child.isMesh) {
        child.geometry?.dispose();
        child.material?.dispose();
      }
    });
  }
}
