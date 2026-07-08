import * as THREE from 'three';
import type { EpiId, PowerUpId } from '../state/types';
import { texBelt, texCard, texHazard, texMetal, texNoise, texSign, texWater, texArrow, registerPaletteMaterial } from './TextureFactory';

// ============================================================
// Fábricas de meshes + pools de reutilização (zero alocação por
// frame). Todos os objetos têm origem na base (y=0 no chão).
// ============================================================

const mats = new Map<string, THREE.Material>();
function sharedMat(key: string, create: () => THREE.Material): THREE.Material {
  let m = mats.get(key);
  if (!m) {
    m = create();
    mats.set(key, m);
  }
  return m;
}

function lambert(key: string, opts: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
  return sharedMat(key, () => new THREE.MeshLambertMaterial(opts)) as THREE.MeshLambertMaterial;
}
function basic(key: string, opts: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  return sharedMat(key, () => new THREE.MeshBasicMaterial(opts)) as THREE.MeshBasicMaterial;
}

const geo = new Map<string, THREE.BufferGeometry>();
function sharedGeo(key: string, create: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geo.get(key);
  if (!g) {
    g = create();
    geo.set(key, g);
  }
  return g;
}

function box(key: string, w: number, h: number, d: number): THREE.BufferGeometry {
  return sharedGeo(key, () => new THREE.BoxGeometry(w, h, d));
}
function cyl(key: string, rt: number, rb: number, h: number, seg = 10): THREE.BufferGeometry {
  return sharedGeo(key, () => new THREE.CylinderGeometry(rt, rb, h, seg));
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const ms = new THREE.Mesh(g, m);
  ms.position.set(x, y, z);
  ms.castShadow = shadow;
  return ms;
}

// ------------------------------------------------------------
// Fábricas de obstáculos fixos
// ------------------------------------------------------------

function makeCone(): THREE.Group {
  const g = new THREE.Group();
  const mOrange = lambert('cone', { color: '#ff7b1a' });
  const mWhite = lambert('coneW', { color: '#f2f2f2', emissive: '#888888', emissiveIntensity: 0.15 });
  g.add(mesh(cyl('coneBody', 0.07, 0.26, 0.72), mOrange, 0, 0.38));
  g.add(mesh(cyl('coneBand', 0.17, 0.2, 0.14), mWhite, 0, 0.34));
  g.add(mesh(box('coneBase', 0.5, 0.06, 0.5), mOrange, 0, 0.03));
  return g;
}

function makeCavalete(): THREE.Group {
  const g = new THREE.Group();
  const mHaz = lambert('hazTex', { map: texHazard() });
  const mLeg = lambert('metalDark', { color: '#3a3f47' });
  g.add(mesh(box('cavTop', 1.5, 0.3, 0.08), mHaz, 0, 0.82));
  const legG = box('cavLeg', 0.07, 0.9, 0.07);
  for (const s of [-1, 1]) {
    const l1 = mesh(legG, mLeg, 0.62 * s, 0.45, 0.12);
    l1.rotation.x = 0.22;
    g.add(l1);
    const l2 = mesh(legG, mLeg, 0.62 * s, 0.45, -0.12);
    l2.rotation.x = -0.22;
    g.add(l2);
  }
  return g;
}

function makeTambor(): THREE.Group {
  const g = new THREE.Group();
  const body = lambert('drum', { color: '#3f6fb5' });
  const ring = lambert('drumRing', { color: '#2a4a7a' });
  g.add(mesh(cyl('drumBody', 0.36, 0.36, 0.95, 12), body, 0, 0.48));
  g.add(mesh(cyl('drumR', 0.38, 0.38, 0.05, 12), ring, 0, 0.25));
  g.add(mesh(cyl('drumR', 0.38, 0.38, 0.05, 12), ring, 0, 0.72));
  return g;
}

function makeCaixa(): THREE.Group {
  const g = new THREE.Group();
  const body = lambert('toolbox', { color: '#c8402f' });
  const lid = lambert('toolboxLid', { color: '#a33224' });
  const handle = lambert('metalDark', { color: '#3a3f47' });
  g.add(mesh(box('tbBody', 0.95, 0.5, 0.6), body, 0, 0.25));
  g.add(mesh(box('tbLid', 0.97, 0.16, 0.62), lid, 0, 0.56));
  g.add(mesh(box('tbHandle', 0.3, 0.05, 0.08), handle, 0, 0.68));
  return g;
}

function makePalete(): THREE.Group {
  const g = new THREE.Group();
  const wood = lambert('wood', { map: texNoise('#9c7442', '#6d4c2a', 10) });
  g.add(mesh(box('palBase', 1.15, 0.14, 1.0), wood, 0, 0.07));
  g.add(mesh(box('palBase2', 1.15, 0.14, 1.0), wood, 0, 0.24));
  g.add(mesh(box('palBox', 0.8, 0.7, 0.75), lambert('palCrate', { map: texNoise('#b08a52', '#8a6a3c', 6) }), 0, 0.68));
  return g;
}

function makeBloco(): THREE.Group {
  const g = new THREE.Group();
  const conc = lambert('concrete', { map: texNoise('#9aa0a8', '#7d838c', 12) });
  g.add(mesh(box('blocoBase', 1.55, 1.1, 0.85), conc, 0, 0.55));
  g.add(mesh(box('blocoTop', 1.2, 1.5, 0.6), conc, 0, 1.6));
  const haz = lambert('hazTex', { map: texHazard() });
  g.add(mesh(box('blocoHaz', 1.57, 0.24, 0.87), haz, 0, 0.9));
  return g;
}

function makeBobina(): THREE.Group {
  const g = new THREE.Group();
  const wood = lambert('woodSpool', { map: texNoise('#a3794a', '#7c5a33', 8) });
  const disc = cyl('spoolDisc', 0.95, 0.95, 0.12, 16);
  const d1 = mesh(disc, wood, 0, 0.95, -0.42);
  d1.rotation.x = Math.PI / 2;
  g.add(d1);
  const d2 = mesh(disc, wood, 0, 0.95, 0.42);
  d2.rotation.x = Math.PI / 2;
  g.add(d2);
  const core = mesh(cyl('spoolCore', 0.45, 0.45, 0.78, 12), lambert('cable', { color: '#2c3e50' }), 0, 0.95);
  core.rotation.x = Math.PI / 2;
  g.add(core);
  return g;
}

function makeIsolamento(): THREE.Group {
  const g = new THREE.Group();
  const post = lambert('postY', { color: '#f2b705' });
  for (const s of [-1, 1]) {
    g.add(mesh(cyl('isoPost', 0.05, 0.06, 2.1, 8), post, 0.85 * s, 1.05));
    g.add(mesh(cyl('isoBase', 0.2, 0.24, 0.1, 8), post, 0.85 * s, 0.05));
  }
  const tape = lambert('hazTex', { map: texHazard() });
  const t1 = mesh(box('isoTape', 1.7, 0.22, 0.03), tape, 0, 1.5, 0, false);
  g.add(t1);
  const t2 = mesh(box('isoTape', 1.7, 0.22, 0.03), tape, 0, 0.85, 0, false);
  g.add(t2);
  const signM = basic('isoSign', { map: texSign('ÁREA\nISOLADA', '#f2b705', '#20242b', '#20242b') });
  g.add(mesh(box('isoSignB', 0.55, 0.55, 0.03), signM, 0, 1.15, 0.02, false));
  return g;
}

function makeTubulacao(): THREE.Group {
  const g = new THREE.Group();
  const metal = lambert('pipeMetal', { map: texMetal('#8a6d3a') });
  const pipe = mesh(cyl('pipeBig', 0.28, 0.28, 2.0, 12), metal, 0, 1.55);
  pipe.rotation.z = Math.PI / 2;
  g.add(pipe);
  const sup = lambert('metalDark', { color: '#3a3f47' });
  for (const s of [-1, 1]) g.add(mesh(box('pipeSup', 0.12, 1.62, 0.12), sup, 0.9 * s, 0.81));
  const haz = lambert('hazTex', { map: texHazard() });
  g.add(mesh(box('pipeHaz', 0.5, 0.14, 0.3), haz, 0, 1.55, 0, false));
  return g;
}

function makePlaca(): THREE.Group {
  const g = new THREE.Group();
  const signM = basic('placaCaida', { map: texSign('CUIDADO', '#f2b705', '#20242b', '#20242b') });
  const plate = mesh(box('placaPlate', 1.0, 0.7, 0.05), signM, 0, 0.32, 0, true);
  plate.rotation.x = -1.15;
  g.add(plate);
  const pole = mesh(cyl('placaPole', 0.04, 0.04, 0.9, 6), lambert('metalDark', { color: '#3a3f47' }), 0, 0.12, -0.35);
  pole.rotation.x = 1.3;
  g.add(pole);
  return g;
}

function makeDormente(): THREE.Group {
  const g = new THREE.Group();
  const wood = lambert('dormente', { map: texNoise('#6d4c2a', '#4a3118', 8) });
  g.add(mesh(box('dormB', 1.6, 0.24, 0.26), wood, 0, 0.12));
  g.add(mesh(box('dormB2', 1.3, 0.24, 0.26), wood, 0.1, 0.36, 0.05));
  return g;
}

// ------------------------------------------------------------
// Equipamentos móveis / riscos especiais
// ------------------------------------------------------------

function makeCaminhao(): THREE.Group {
  const g = new THREE.Group();
  const body = lambert('truckBody', { color: '#f2b705' });
  const dark = lambert('metalDark', { color: '#3a3f47' });
  const cab = lambert('truckCab', { color: '#e8a800' });
  const glass = lambert('truckGlass', { color: '#9fd4e8', emissive: '#4d7a8a', emissiveIntensity: 0.3 });
  // caçamba + chassi (caminhão fora de estrada estilizado, orientado ao longo do X)
  g.add(mesh(box('tkChassis', 5.6, 0.5, 2.2), dark, 0, 1.0));
  const bed = mesh(box('tkBed', 3.4, 1.5, 2.4), body, -1.0, 2.1);
  bed.rotation.z = 0.06;
  g.add(bed);
  g.add(mesh(box('tkCab', 1.6, 1.5, 2.0), cab, 1.9, 2.0));
  g.add(mesh(box('tkGlass', 0.5, 0.6, 1.4), glass, 2.55, 2.25));
  const wheel = cyl('tkWheel', 0.65, 0.65, 0.5, 12);
  const wm = lambert('tire', { color: '#1c1f24' });
  for (const wx of [-2.2, -0.8, 1.9])
    for (const wz of [-0.95, 0.95]) {
      const w = mesh(wheel, wm, wx, 0.65, wz);
      w.rotation.x = Math.PI / 2;
      g.add(w);
    }
  const beacon = new THREE.Mesh(sharedGeo('tkBeacon', () => new THREE.SphereGeometry(0.14, 8, 6)), basic('beaconOrange', { color: '#ff8c1a' }));
  beacon.position.set(1.9, 2.95, 0);
  g.add(beacon);
  return g;
}

function makeVagao(): THREE.Group {
  const g = new THREE.Group();
  const body = lambert('wagon', { map: texMetal('#5f6670') });
  const dark = lambert('metalDark', { color: '#3a3f47' });
  g.add(mesh(box('wgBody', 1.7, 1.1, 2.6), body, 0, 1.05));
  g.add(mesh(box('wgTop', 1.5, 0.35, 2.4), lambert('oreLoad', { map: texNoise('#7a4a22', '#5c3312', 8) }), 0, 1.75));
  const wheel = cyl('wgWheel', 0.3, 0.3, 0.12, 10);
  for (const wz of [-0.85, 0.85])
    for (const wx of [-0.75, 0.75]) {
      const w = mesh(wheel, dark, wx, 0.3, wz);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    }
  const light = new THREE.Mesh(sharedGeo('wgLight', () => new THREE.SphereGeometry(0.12, 8, 6)), basic('headlight', { color: '#fff2b0' }));
  light.position.set(0, 1.3, 1.35);
  g.add(light);
  return g;
}

function makePortao(): THREE.Group {
  // portão industrial: colisor cobre 2 faixas; porta desce animada pelo updater
  const g = new THREE.Group();
  const frameM = lambert('gateFrame', { map: texMetal('#4c545e') });
  g.add(mesh(box('gatePost', 0.35, 3.4, 0.35), frameM, -3.6, 1.7));
  g.add(mesh(box('gatePost', 0.35, 3.4, 0.35), frameM, 3.6, 1.7));
  g.add(mesh(box('gateTop', 7.6, 0.4, 0.5), frameM, 0, 3.5));
  const door = new THREE.Mesh(box('gateDoor', 7.0, 2.6, 0.18), lambert('hazTex', { map: texHazard() }));
  door.position.set(0, 4.6, 0); // começa erguida; updater a desce
  door.castShadow = true;
  door.name = 'door';
  g.add(door);
  const lightM = sharedMat('beaconRed', () => {
    const mm = new THREE.MeshBasicMaterial({ color: '#e5484d' });
    registerPaletteMaterial(mm, 'danger');
    return mm;
  });
  const light = new THREE.Mesh(sharedGeo('gateLight', () => new THREE.SphereGeometry(0.16, 8, 6)), lightM);
  light.position.set(0, 3.85, 0);
  light.name = 'light';
  g.add(light);
  return g;
}

function makeBraco(): THREE.Group {
  // braço mecânico de oficina — vão baixo: passa rolando
  const g = new THREE.Group();
  const dark = lambert('metalDark', { color: '#3a3f47' });
  const orange = lambert('armOrange', { color: '#ff8c1a' });
  g.add(mesh(box('armBase', 0.8, 2.6, 0.8), dark, -3.4, 1.3));
  const arm = new THREE.Mesh(box('armBeam', 6.4, 0.35, 0.45), orange);
  arm.position.set(0.2, 2.0, 0);
  arm.castShadow = true;
  arm.name = 'beam';
  g.add(arm);
  const claw = new THREE.Mesh(box('armClaw', 0.5, 0.7, 0.5), dark);
  claw.position.set(3.2, 1.6, 0);
  claw.name = 'claw';
  g.add(claw);
  return g;
}

function makeRocha(): THREE.Group {
  const g = new THREE.Group();
  const rock = lambert('rock', { map: texNoise('#5c5850', '#3d3a34', 10) });
  const m = new THREE.Mesh(sharedGeo('rockGeo', () => new THREE.DodecahedronGeometry(0.55, 0)), rock);
  m.position.y = 0.5;
  m.castShadow = true;
  m.name = 'rock';
  g.add(m);
  return g;
}

// ------------------------------------------------------------
// Zonas de piso (decals) e sinalização
// ------------------------------------------------------------

const planeGeo = () => sharedGeo('plane1', () => new THREE.PlaneGeometry(1, 1));

function makeZoneWet(): THREE.Group {
  const g = new THREE.Group();
  const m = sharedMat('wetMat', () => {
    const mm = new THREE.MeshBasicMaterial({ map: texWater(), transparent: true, opacity: 0.7 });
    registerPaletteMaterial(mm, 'water');
    return mm;
  });
  const p = new THREE.Mesh(planeGeo(), m);
  p.rotation.x = -Math.PI / 2;
  p.position.y = 0.02;
  p.scale.set(2.0, 5.4, 1);
  g.add(p);
  return g;
}

function makeZoneSpill(): THREE.Group {
  const g = new THREE.Group();
  const stain = basic('spillStain', { color: '#3d2f1a', transparent: true, opacity: 0.85 });
  const p = new THREE.Mesh(planeGeo(), stain);
  p.rotation.x = -Math.PI / 2;
  p.position.y = 0.02;
  p.scale.set(1.9, 5.2, 1);
  g.add(p);
  const border = sharedMat('spillBorder', () => {
    const mm = new THREE.MeshBasicMaterial({ color: '#e5484d' });
    registerPaletteMaterial(mm, 'danger');
    return mm;
  });
  const b = new THREE.Mesh(planeGeo(), border);
  b.rotation.x = -Math.PI / 2;
  b.position.y = 0.015;
  b.scale.set(2.15, 5.5, 1);
  g.add(b);
  const signM = basic('spillSign', { map: texSign('RISCO\nVAZAMENTO', '#f2f2f2', '#c0392b', '#c0392b') });
  const s = new THREE.Mesh(box('spillSignB', 0.6, 0.6, 0.04), signM);
  s.position.set(-0.85, 0.85, -2.9);
  g.add(s);
  const pole = mesh(cyl('spillPole', 0.03, 0.03, 0.6, 6), lambert('metalDark', { color: '#3a3f47' }), -0.85, 0.28, -2.9);
  g.add(pole);
  return g;
}

function makeZoneConveyor(): THREE.Group {
  const g = new THREE.Group();
  const belt = new THREE.Mesh(planeGeo(), new THREE.MeshBasicMaterial({ map: texBelt() }));
  belt.rotation.x = -Math.PI / 2;
  belt.position.y = 0.04;
  belt.scale.set(2.1, 7.5, 1);
  belt.name = 'belt';
  g.add(belt);
  const side = lambert('beltSide', { map: texMetal('#4c545e') });
  g.add(mesh(box('beltSideB', 0.14, 0.24, 7.5), side, -1.1, 0.12));
  g.add(mesh(box('beltSideB', 0.14, 0.24, 7.5), side, 1.1, 0.12));
  return g;
}

function makeZoneDust(): THREE.Group {
  const g = new THREE.Group();
  const m = basic('dustDecal', { color: '#c9a76a', transparent: true, opacity: 0.28 });
  const p = new THREE.Mesh(planeGeo(), m);
  p.rotation.x = -Math.PI / 2;
  p.position.y = 0.02;
  p.scale.set(7.4, 26, 1);
  g.add(p);
  return g;
}

function makeArrowDecal(): THREE.Group {
  const g = new THREE.Group();
  const m = sharedMat('arrowMat', () => {
    const mm = new THREE.MeshBasicMaterial({ map: texArrow(), transparent: true, opacity: 0.95, depthWrite: false });
    registerPaletteMaterial(mm, 'safe');
    return mm;
  });
  const p = new THREE.Mesh(planeGeo(), m);
  p.rotation.x = -Math.PI / 2;
  p.rotation.z = Math.PI; // aponta para -Z (frente do jogador)
  p.position.y = 0.05;
  p.scale.set(1.3, 1.3, 1);
  g.add(p);
  return g;
}

function makeBeaconLight(): THREE.Group {
  const g = new THREE.Group();
  const pole = mesh(cyl('bcPole', 0.05, 0.06, 1.5, 8), lambert('metalDark', { color: '#3a3f47' }), 0, 0.75);
  g.add(pole);
  const m = new THREE.MeshBasicMaterial({ color: '#ff8c1a' });
  const lightMesh = new THREE.Mesh(sharedGeo('bcBulb', () => new THREE.SphereGeometry(0.16, 8, 6)), m);
  lightMesh.position.y = 1.62;
  lightMesh.name = 'bulb';
  g.add(lightMesh);
  return g;
}

function makeWarnSign(text: string): THREE.Group {
  const g = new THREE.Group();
  const pole = mesh(cyl('wsPole', 0.05, 0.05, 1.9, 8), lambert('metalDark', { color: '#3a3f47' }), 0, 0.95);
  g.add(pole);
  const m = basic(`ws:${text}`, { map: texSign(text, '#f2b705', '#20242b', '#20242b') });
  g.add(mesh(box('wsPlate', 1.0, 1.0, 0.05), m, 0, 2.2, 0, false));
  return g;
}

function makeShadowDisc(): THREE.Group {
  const g = new THREE.Group();
  const m = sharedMat('fallWarn', () => {
    const mm = new THREE.MeshBasicMaterial({ color: '#e5484d', transparent: true, opacity: 0.55, depthWrite: false });
    registerPaletteMaterial(mm, 'danger');
    return mm;
  });
  const p = new THREE.Mesh(sharedGeo('disc', () => new THREE.CircleGeometry(0.7, 16)), m);
  p.rotation.x = -Math.PI / 2;
  p.position.y = 0.04;
  g.add(p);
  return g;
}

// ------------------------------------------------------------
// Itens coletáveis
// ------------------------------------------------------------

function makeCoin(): THREE.Group {
  const g = new THREE.Group();
  const m = sharedMat('coinMat', () => {
    const mm = new THREE.MeshLambertMaterial({ color: '#ffce3a', emissive: '#b8821e', emissiveIntensity: 0.75 });
    registerPaletteMaterial(mm, 'coin');
    return mm;
  });
  const c = new THREE.Mesh(sharedGeo('coinGeo', () => new THREE.DodecahedronGeometry(0.32, 0)), m);
  c.position.y = 1.0;
  c.name = 'spin';
  g.add(c);
  return g;
}

function epiModel(epi: EpiId): THREE.Group {
  const g = new THREE.Group();
  const yellow = lambert('epiYellow', { color: '#f2b705', emissive: '#8a6a00', emissiveIntensity: 0.25 });
  const dark = lambert('epiDark', { color: '#2c3038' });
  const orange = lambert('epiOrange', { color: '#ff8c1a', emissive: '#8a4a00', emissiveIntensity: 0.25 });
  const white = lambert('epiWhite', { color: '#eef2f5' });
  const green = lambert('epiGreen', { color: '#3ddc84' });
  switch (epi) {
    case 'capacete': {
      g.add(mesh(sharedGeo('epiHelm', () => new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), yellow, 0, 0));
      g.add(mesh(cyl('epiBrim', 0.3, 0.31, 0.05, 12), yellow, 0, 0));
      break;
    }
    case 'oculos': {
      g.add(mesh(box('epiGogA', 0.42, 0.14, 0.1), dark, 0, 0.02));
      g.add(mesh(box('epiGogB', 0.46, 0.05, 0.04), yellow, 0, 0.12));
      break;
    }
    case 'luvas': {
      g.add(mesh(box('epiGlove', 0.16, 0.3, 0.1), orange, -0.12, 0));
      g.add(mesh(box('epiGlove', 0.16, 0.3, 0.1), orange, 0.12, 0.04));
      break;
    }
    case 'botas': {
      g.add(mesh(box('epiBootA', 0.16, 0.24, 0.32), dark, -0.12, 0));
      g.add(mesh(box('epiBootA', 0.16, 0.24, 0.32), dark, 0.14, 0));
      g.add(mesh(box('epiBootB', 0.36, 0.08, 0.34), yellow, 0.01, 0.16));
      break;
    }
    case 'auricular': {
      const arc = new THREE.Mesh(sharedGeo('epiArc', () => new THREE.TorusGeometry(0.2, 0.035, 6, 12, Math.PI)), dark);
      g.add(arc);
      g.add(mesh(sharedGeo('epiPad', () => new THREE.SphereGeometry(0.09, 8, 6)), orange, -0.2, 0));
      g.add(mesh(sharedGeo('epiPad', () => new THREE.SphereGeometry(0.09, 8, 6)), orange, 0.2, 0));
      break;
    }
    case 'mascara': {
      g.add(mesh(sharedGeo('epiMask', () => new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI)), white, 0, 0));
      g.add(mesh(cyl('epiFilter', 0.07, 0.07, 0.08, 8), green, 0, -0.06, 0.18));
      break;
    }
    case 'colete': {
      g.add(mesh(box('epiVest', 0.4, 0.46, 0.14), orange, 0, 0));
      g.add(mesh(box('epiVstr', 0.42, 0.06, 0.16), white, 0, 0.08));
      g.add(mesh(box('epiVstr', 0.42, 0.06, 0.16), white, 0, -0.1));
      break;
    }
    case 'radio': {
      g.add(mesh(box('epiRadio', 0.2, 0.36, 0.1), dark, 0, 0));
      g.add(mesh(cyl('epiAnt', 0.015, 0.015, 0.22, 4), dark, 0.06, 0.28));
      g.add(mesh(box('epiRadDot', 0.12, 0.05, 0.11), green, 0, 0.1));
      break;
    }
  }
  return g;
}

function makeEpi(epi: EpiId): THREE.Group {
  const g = new THREE.Group();
  const model = epiModel(epi);
  model.position.y = 1.15;
  model.name = 'spin';
  g.add(model);
  const ringM = sharedMat('epiRing', () => new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(sharedGeo('epiRingG', () => new THREE.RingGeometry(0.34, 0.44, 20)), ringM);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  g.add(ring);
  return g;
}

function makeCardItem(): THREE.Group {
  const g = new THREE.Group();
  const m = basic('cardMat', { map: texCard() });
  const c = new THREE.Mesh(box('cardGeo', 0.5, 0.62, 0.05), m);
  c.position.y = 1.15;
  c.name = 'spin';
  g.add(c);
  return g;
}

const PU_COLORS: Record<PowerUpId, string> = {
  escudo: '#ffd23f',
  radio: '#4dabf7',
  botas: '#b7f34d',
  mascara: '#9fb2c8',
  inspecao: '#b563f2',
  caminho: '#3ddc84',
  dds: '#ff8c1a',
  drone: '#4dd7f2',
};

function makePowerup(pu: PowerUpId): THREE.Group {
  const g = new THREE.Group();
  const color = PU_COLORS[pu];
  const crate = new THREE.Mesh(
    box('puCrate', 0.55, 0.55, 0.55),
    lambert(`puMat:${pu}`, { color, emissive: color, emissiveIntensity: 0.35 }),
  );
  crate.position.y = 1.1;
  crate.name = 'spin';
  g.add(crate);
  const frame = new THREE.Mesh(box('puFrame', 0.62, 0.62, 0.62), lambert('metalDark', { color: '#3a3f47' }));
  frame.position.y = 1.1;
  frame.scale.setScalar(1.001);
  frame.name = 'spin2';
  g.add(frame);
  frame.visible = false; // simplificação visual; mantido para futura arte
  return g;
}

// ------------------------------------------------------------
// Pools
// ------------------------------------------------------------

export class Pools {
  private pools = new Map<string, THREE.Object3D[]>();
  created = 0;

  acquire(key: string): THREE.Object3D {
    const list = this.pools.get(key);
    if (list && list.length > 0) {
      const o = list.pop()!;
      o.visible = true;
      return o;
    }
    this.created++;
    return this.make(key);
  }

  release(key: string, obj: THREE.Object3D) {
    obj.visible = false;
    obj.removeFromParent();
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    obj.scale.set(1, 1, 1);
    let list = this.pools.get(key);
    if (!list) {
      list = [];
      this.pools.set(key, list);
    }
    if (list.length < 40) list.push(obj);
  }

  private make(key: string): THREE.Object3D {
    const [kind, a, b] = key.split(':');
    if (kind === 'ob') {
      switch (a) {
        case 'cone': return makeCone();
        case 'cavalete': return makeCavalete();
        case 'tambor': return makeTambor();
        case 'caixa': return makeCaixa();
        case 'palete': return makePalete();
        case 'bloco': return makeBloco();
        case 'bobina': return makeBobina();
        case 'isolamento': return makeIsolamento();
        case 'tubulacao': return makeTubulacao();
        case 'placa': return makePlaca();
        case 'dormente': return makeDormente();
      }
    }
    if (kind === 'hz') {
      switch (a) {
        case 'caminhao': return makeCaminhao();
        case 'vagao': return makeVagao();
        case 'portao': return makePortao();
        case 'braco': return makeBraco();
        case 'rocha': return makeRocha();
      }
    }
    if (kind === 'zone') {
      switch (a) {
        case 'wet': return makeZoneWet();
        case 'spill': return makeZoneSpill();
        case 'conveyor': return makeZoneConveyor();
        case 'dust': return makeZoneDust();
      }
    }
    if (kind === 'item') {
      if (a === 'coin') return makeCoin();
      if (a === 'epi') return makeEpi(b as EpiId);
      if (a === 'card') return makeCardItem();
      if (a === 'pu') return makePowerup(b as PowerUpId);
    }
    if (kind === 'fx') {
      if (a === 'beacon') return makeBeaconLight();
      if (a === 'arrow') return makeArrowDecal();
      if (a === 'shadow') return makeShadowDisc();
      if (a === 'sign') return makeWarnSign(b.replace(/_/g, '\n'));
    }
    console.warn('[Pools] chave desconhecida', key);
    return new THREE.Group();
  }
}
