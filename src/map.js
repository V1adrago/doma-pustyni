import * as THREE from 'three';

// Ground top surface is at y = 0
const GROUND_Y = 0;

export function createMap(scene) {
  createGround(scene);
  createLanes(scene);
  createBorderWalls(scene);
  createCenterDivider(scene);
  createScatterRocks(scene);
  const node = createCentralNode(scene);
  createZoneLabels(scene);

  return { node };
}

// ─── Ground ───────────────────────────────────────────────────────────────────

function createGround(scene) {
  const geo = new THREE.BoxGeometry(24, 0.6, 36);
  const mat = new THREE.MeshLambertMaterial({ color: 0xc4954a });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.3;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Slightly darker border strip
  const borderGeo = new THREE.BoxGeometry(28, 0.4, 40);
  const borderMat = new THREE.MeshLambertMaterial({ color: 0xa07835 });
  const border = new THREE.Mesh(borderGeo, borderMat);
  border.position.y = -0.5;
  border.receiveShadow = true;
  scene.add(border);
}

// ─── Lane paths ───────────────────────────────────────────────────────────────

function createLanes(scene) {
  const laneXPositions = [-6, 0, 6];
  const laneColors = [0xd4a85a, 0xddb86a, 0xd4a85a];

  laneXPositions.forEach((x, i) => {
    const geo = new THREE.PlaneGeometry(2.4, 34);
    const mat = new THREE.MeshLambertMaterial({
      color: laneColors[i],
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, GROUND_Y + 0.01, 0);
    scene.add(mesh);
  });
}

// ─── Border walls ─────────────────────────────────────────────────────────────

function createBorderWalls(scene) {
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x8b6530 });

  // Left and right walls
  [[-12.5, 36], [12.5, 36]].forEach(([x, depth]) => {
    const geo = new THREE.BoxGeometry(1.2, 1.2, depth);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, 0.3, 0);
    mesh.castShadow = true;
    scene.add(mesh);
  });

  // Top and bottom walls
  [[-18.5, 26], [18.5, 26]].forEach(([z, width]) => {
    const geo = new THREE.BoxGeometry(width, 1.2, 1.2);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(0, 0.3, z);
    mesh.castShadow = true;
    scene.add(mesh);
  });
}

// ─── Center divider ───────────────────────────────────────────────────────────

function createCenterDivider(scene) {
  // Thin line at z=0 to mark the field division
  const geo = new THREE.BoxGeometry(22, 0.12, 0.25);
  const mat = new THREE.MeshLambertMaterial({ color: 0xe8c060, transparent: true, opacity: 0.55 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, GROUND_Y + 0.02, 0);
  scene.add(mesh);
}

// ─── Scatter rocks / dunes for low poly feel ──────────────────────────────────

function createScatterRocks(scene) {
  const positions = [
    [-9,  5.5], [ 9,  5.5],
    [-9, -5.5], [ 9, -5.5],
    [-10, 0],   [ 10, 0],
    [-8,  9],   [  8, -9],
    [-5, -16],  [  5,  16],
    [-10, 14],  [ 10, -14],
    [ -3,  7],  [  3, -7],
  ];

  positions.forEach(([x, z]) => {
    const size = 0.25 + Math.abs(Math.sin(x * z)) * 0.35;
    const geo = new THREE.TetrahedronGeometry(size, 0);
    const col = new THREE.Color(0x9a7040).lerp(new THREE.Color(0xb89060), Math.random());
    const mat = new THREE.MeshLambertMaterial({ color: col });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, size * 0.5, z);
    // Deterministic rotation using position as seed
    mesh.rotation.set(x * 0.5, z * 0.8, (x + z) * 0.3);
    mesh.castShadow = true;
    scene.add(mesh);
  });
}

// ─── Central resource node ────────────────────────────────────────────────────

function createCentralNode(scene) {
  // Hexagonal platform base
  const platformGeo = new THREE.CylinderGeometry(2.2, 2.6, 0.35, 6);
  const platformMat = new THREE.MeshLambertMaterial({ color: 0x8b6820 });
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.position.set(0, 0.175, 0);
  platform.castShadow = true;
  platform.receiveShadow = true;
  scene.add(platform);

  // Inner ring
  const ringGeo = new THREE.TorusGeometry(1.4, 0.12, 4, 6);
  const ringMat = new THREE.MeshLambertMaterial({ color: 0xf4c020 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.38, 0);
  scene.add(ring);

  // Floating octahedron (the node crystal)
  const nodeGeo = new THREE.OctahedronGeometry(0.9, 0);
  const nodeMat = new THREE.MeshLambertMaterial({
    color: 0xf9a020,
    emissive: 0x7a3800,
  });
  const node = new THREE.Mesh(nodeGeo, nodeMat);
  node.position.set(0, 1.6, 0);
  node.castShadow = true;
  scene.add(node);

  // Glow halo (simple flat disc)
  const haloGeo = new THREE.CircleGeometry(1.8, 6);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xf4a520,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.set(0, 0.05, 0);
  scene.add(halo);

  return node; // caller animates this
}

// ─── Zone markers (simple flat plane labels) ──────────────────────────────────

function createZoneLabels(scene) {
  // Player zone marker (bottom)
  addZonePlane(scene, 0x2E86C1, 0, 14.5, 0.18);
  // Enemy zone marker (top)
  addZonePlane(scene, 0xC0392B, 0, -14.5, 0.18);
}

function addZonePlane(scene, color, x, z, opacity) {
  const geo = new THREE.PlaneGeometry(20, 6);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, GROUND_Y + 0.005, z);
  scene.add(mesh);
}
