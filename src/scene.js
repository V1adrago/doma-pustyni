import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a2a1a);
  scene.fog = new THREE.Fog(0x3a2a1a, 45, 80);

  // Tactical top-down angled camera
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
  camera.position.set(0, 30, 24);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enablePan = true;
  controls.minDistance = 18;
  controls.maxDistance = 55;
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.update();

  // Warm ambient (desert sun)
  const ambient = new THREE.AmbientLight(0xfff3cc, 0.55);
  scene.add(ambient);

  // Main sun light
  const sun = new THREE.DirectionalLight(0xffe8a0, 1.3);
  sun.position.set(12, 22, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 100;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  scene.add(sun);

  // Soft fill light from opposite side
  const fill = new THREE.DirectionalLight(0xa0c4ff, 0.25);
  fill.position.set(-8, 10, -12);
  scene.add(fill);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, controls };
}
