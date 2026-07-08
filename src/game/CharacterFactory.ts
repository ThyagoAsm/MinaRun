import * as THREE from 'three';
import { skinById } from '../data/characters';
import type { SkinId } from '../state/types';

// ============================================================
// Personagem 3D estilizado (proporções cartoon: cabeça grande,
// capacete avantajado, corpo troncudo) construído por primitivas.
// Original, leve e com peças nomeadas para animação procedural.
// ============================================================

export type Expression = 'neutral' | 'effort' | 'scared' | 'happy';

export interface CharacterRig {
  root: THREE.Group;
  spin: THREE.Group; // gira na rolagem
  hips: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Group;
  lamp: THREE.SpotLight | null;
  materials: THREE.Material[];
  /** troca a expressão facial (menu, corrida, susto, comemoração) */
  setExpression(e: Expression): void;
  dispose(): void;
}

// geometrias compartilhadas (criadas uma única vez)
const G = {
  leg: new THREE.BoxGeometry(0.21, 0.46, 0.24),
  boot: new THREE.BoxGeometry(0.26, 0.17, 0.38),
  bootTip: new THREE.BoxGeometry(0.24, 0.09, 0.14),
  torso: new THREE.BoxGeometry(0.56, 0.5, 0.34),
  belly: new THREE.BoxGeometry(0.5, 0.2, 0.3),
  vest: new THREE.BoxGeometry(0.62, 0.4, 0.4),
  stripeH: new THREE.BoxGeometry(0.63, 0.07, 0.41),
  stripeV: new THREE.BoxGeometry(0.09, 0.4, 0.41),
  belt: new THREE.BoxGeometry(0.6, 0.09, 0.38),
  pouch: new THREE.BoxGeometry(0.14, 0.16, 0.1),
  arm: new THREE.BoxGeometry(0.17, 0.4, 0.19),
  glove: new THREE.BoxGeometry(0.2, 0.16, 0.21),
  head: new THREE.BoxGeometry(0.42, 0.4, 0.4),
  hair: new THREE.BoxGeometry(0.44, 0.14, 0.42),
  helmetDome: new THREE.SphereGeometry(0.31, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  helmetBrim: new THREE.CylinderGeometry(0.37, 0.385, 0.05, 16),
  helmetCrest: new THREE.BoxGeometry(0.1, 0.06, 0.4),
  lampBox: new THREE.BoxGeometry(0.1, 0.08, 0.06),
  goggles: new THREE.BoxGeometry(0.4, 0.1, 0.06),
  goggleStrap: new THREE.BoxGeometry(0.44, 0.06, 0.42),
  eye: new THREE.BoxGeometry(0.1, 0.1, 0.03),
  pupil: new THREE.BoxGeometry(0.045, 0.05, 0.02),
  brow: new THREE.BoxGeometry(0.11, 0.028, 0.02),
  mouth: new THREE.BoxGeometry(0.11, 0.035, 0.02),
  nose: new THREE.BoxGeometry(0.05, 0.05, 0.04),
  radio: new THREE.BoxGeometry(0.09, 0.14, 0.06),
  antenna: new THREE.CylinderGeometry(0.01, 0.01, 0.14, 4),
  // acessórios
  board: new THREE.BoxGeometry(0.2, 0.28, 0.03),
  extinguisher: new THREE.CylinderGeometry(0.09, 0.09, 0.3, 10),
  wrench: new THREE.BoxGeometry(0.07, 0.34, 0.06),
  bag: new THREE.BoxGeometry(0.22, 0.28, 0.14),
  flagPole: new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5),
  flag: new THREE.BoxGeometry(0.16, 0.11, 0.01),
  band: new THREE.TorusGeometry(0.315, 0.025, 6, 16),
  canteen: new THREE.CylinderGeometry(0.08, 0.08, 0.16, 10),
};

function lam(color: string, mats: THREE.Material[], emissive?: string, ei = 0.5): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color });
  if (emissive) {
    m.emissive = new THREE.Color(emissive);
    m.emissiveIntensity = ei;
  }
  mats.push(m);
  return m;
}

export function buildCharacter(skinId: SkinId, withLamp: boolean): CharacterRig {
  const def = skinById(skinId);
  const c = def.colors;
  const materials: THREE.Material[] = [];

  const mSuit = lam(c.suit, materials);
  const mPants = lam(c.pants, materials);
  const mVest = lam(c.vest, materials, c.vest, 0.18);
  const mStripe = lam('#f5f7f8', materials, '#cfd8de', 0.7);
  const mSkin = lam(c.skin, materials);
  const mHair = lam('#5c3a22', materials);
  const mHelmet = lam(c.helmet, materials);
  const mHelmetDark = lam(shade(c.helmet, 0.78), materials);
  const mAccent = lam(c.accent, materials);
  const mDark = lam('#2b2f36', materials);
  const mBoot = lam('#6d4527', materials);
  const mBelt = lam('#8a5a30', materials);
  const mLamp = lam('#fff6cc', materials, '#ffe9a0', 1.3);

  const root = new THREE.Group();
  // o modelo é construído com a frente em +Z; o jogo corre para -Z,
  // então o rig nasce virado 180° (rosto/peito/botas para a frente real)
  root.rotation.y = Math.PI;
  const spin = new THREE.Group();
  spin.position.y = 0.5;
  root.add(spin);
  const hips = new THREE.Group();
  hips.position.y = 0.1; // altura do quadril: 0.6
  spin.add(hips);

  // pernas troncudas (pivô no quadril)
  const mkLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(0.14 * side, 0, 0);
    const leg = new THREE.Mesh(G.leg, mPants);
    leg.position.y = -0.24;
    leg.castShadow = true;
    g.add(leg);
    const boot = new THREE.Mesh(G.boot, mBoot);
    boot.position.set(0, -0.5, 0.03);
    g.add(boot);
    const tip = new THREE.Mesh(G.bootTip, mDark);
    tip.position.set(0, -0.54, 0.2);
    g.add(tip);
    hips.add(g);
    return g;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  // torso + colete com listras refletivas (verticais e horizontal)
  const torso = new THREE.Mesh(G.torso, mSuit);
  torso.position.y = 0.28;
  torso.castShadow = true;
  hips.add(torso);
  const belly = new THREE.Mesh(G.belly, mSuit);
  belly.position.y = 0.05;
  hips.add(belly);
  const vest = new THREE.Mesh(G.vest, mVest);
  vest.position.y = 0.34;
  hips.add(vest);
  for (const sx of [-0.15, 0.15]) {
    const sv = new THREE.Mesh(G.stripeV, mStripe);
    sv.position.set(sx, 0.34, 0);
    hips.add(sv);
  }
  const sh = new THREE.Mesh(G.stripeH, mStripe);
  sh.position.y = 0.24;
  hips.add(sh);

  // cinto de ferramentas com bolsas
  const belt = new THREE.Mesh(G.belt, mBelt);
  belt.position.y = -0.02;
  hips.add(belt);
  for (const [px, pz] of [
    [-0.24, 0.16],
    [0.24, 0.16],
    [0.26, -0.12],
  ]) {
    const p = new THREE.Mesh(G.pouch, mBoot);
    p.position.set(px, -0.06, pz);
    hips.add(p);
  }

  // rádio comunicador no peito
  const radio = new THREE.Mesh(G.radio, mDark);
  radio.position.set(-0.19, 0.44, 0.21);
  hips.add(radio);
  const ant = new THREE.Mesh(G.antenna, mDark);
  ant.position.set(-0.19, 0.56, 0.21);
  hips.add(ant);

  // braços (pivô no ombro) — luvas grandes
  const mkArm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(0.37 * side, 0.46, 0);
    const arm = new THREE.Mesh(G.arm, mSuit);
    arm.position.y = -0.18;
    arm.castShadow = true;
    g.add(arm);
    const glove = new THREE.Mesh(G.glove, mAccent);
    glove.position.y = -0.42;
    g.add(glove);
    hips.add(g);
    return g;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  // cabeçona + cabelo + capacete avantajado + óculos
  const head = new THREE.Group();
  head.position.y = 0.78;
  hips.add(head);
  const skull = new THREE.Mesh(G.head, mSkin);
  skull.castShadow = true;
  head.add(skull);
  const hair = new THREE.Mesh(G.hair, mHair);
  hair.position.set(0, 0.02, -0.03);
  hair.scale.set(1.02, 1, 1.02);
  head.add(hair);
  const dome = new THREE.Mesh(G.helmetDome, mHelmet);
  dome.position.y = 0.14;
  dome.castShadow = true;
  head.add(dome);
  const brim = new THREE.Mesh(G.helmetBrim, mHelmetDark);
  brim.position.set(0, 0.14, 0.03);
  head.add(brim);
  const crest = new THREE.Mesh(G.helmetCrest, mHelmet);
  crest.position.y = 0.42;
  head.add(crest);
  const lampBox = new THREE.Mesh(G.lampBox, mLamp);
  lampBox.position.set(0, 0.26, 0.28);
  head.add(lampBox);
  // óculos de proteção apoiados no capacete (deixa o rosto visível)
  const strap = new THREE.Mesh(G.goggleStrap, mDark);
  strap.position.y = 0.17;
  strap.scale.set(1.02, 0.8, 1.02);
  head.add(strap);
  const goggles = new THREE.Mesh(G.goggles, mDark);
  goggles.position.set(0, 0.185, 0.26);
  goggles.rotation.x = 0.25;
  head.add(goggles);
  const lens = new THREE.Mesh(G.goggles, lam('#9fd4e8', materials, '#4d7a8a', 0.5));
  lens.scale.set(0.85, 0.6, 0.9);
  lens.position.set(0, 0.185, 0.272);
  lens.rotation.x = 0.25;
  head.add(lens);

  // ---------- rosto expressivo (GDD: olhos, sobrancelhas, boca) ----------
  const mWhite = lam('#f7f9fa', materials);
  const mPupil = lam('#26221c', materials);
  const face = new THREE.Group();
  face.position.set(0, 0, 0.195);
  head.add(face);
  const eyeL = new THREE.Mesh(G.eye, mWhite);
  eyeL.position.set(-0.1, 0.03, 0);
  face.add(eyeL);
  const eyeR = new THREE.Mesh(G.eye, mWhite);
  eyeR.position.set(0.1, 0.03, 0);
  face.add(eyeR);
  const pupilL = new THREE.Mesh(G.pupil, mPupil);
  pupilL.position.set(-0.1, 0.02, 0.012);
  face.add(pupilL);
  const pupilR = new THREE.Mesh(G.pupil, mPupil);
  pupilR.position.set(0.1, 0.02, 0.012);
  face.add(pupilR);
  const browL = new THREE.Mesh(G.brow, mHair);
  browL.position.set(-0.1, 0.115, 0.008);
  face.add(browL);
  const browR = new THREE.Mesh(G.brow, mHair);
  browR.position.set(0.1, 0.115, 0.008);
  face.add(browR);
  const nose = new THREE.Mesh(G.nose, mSkin);
  nose.position.set(0, -0.04, 0.02);
  face.add(nose);
  const mouth = new THREE.Mesh(G.mouth, mPupil);
  mouth.position.set(0, -0.125, 0.005);
  face.add(mouth);

  const setExpression = (e: Expression) => {
    switch (e) {
      case 'neutral':
        browL.rotation.z = 0;
        browR.rotation.z = 0;
        browL.position.y = browR.position.y = 0.115;
        eyeL.scale.setScalar(1);
        eyeR.scale.setScalar(1);
        mouth.scale.set(1, 1, 1);
        mouth.position.y = -0.125;
        break;
      case 'effort': // concentrado: sobrancelhas fechadas, boca firme
        browL.rotation.z = -0.3;
        browR.rotation.z = 0.3;
        browL.position.y = browR.position.y = 0.1;
        eyeL.scale.setScalar(0.92);
        eyeR.scale.setScalar(0.92);
        mouth.scale.set(1.3, 0.7, 1);
        mouth.position.y = -0.125;
        break;
      case 'scared': // susto: olhos arregalados, boca aberta
        browL.rotation.z = 0.28;
        browR.rotation.z = -0.28;
        browL.position.y = browR.position.y = 0.14;
        eyeL.scale.setScalar(1.3);
        eyeR.scale.setScalar(1.3);
        mouth.scale.set(0.9, 2.6, 1);
        mouth.position.y = -0.14;
        break;
      case 'happy': // comemoração: sorriso largo
        browL.rotation.z = 0.12;
        browR.rotation.z = -0.12;
        browL.position.y = browR.position.y = 0.13;
        eyeL.scale.setScalar(1.05);
        eyeR.scale.setScalar(1.05);
        mouth.scale.set(1.7, 1.3, 1);
        mouth.position.y = -0.115;
        break;
    }
  };
  setExpression('neutral');

  // acessório da skin
  switch (def.accessory) {
    case 'prancheta': {
      const b = new THREE.Mesh(G.board, mAccent);
      b.position.set(-0.32, 0.02, 0.14);
      b.rotation.x = 0.3;
      hips.add(b);
      break;
    }
    case 'extintor': {
      const e = new THREE.Mesh(G.extinguisher, lam('#d63a2f', materials));
      e.position.set(0.14, 0.28, -0.26);
      hips.add(e);
      break;
    }
    case 'chave': {
      const w = new THREE.Mesh(G.wrench, mAccent);
      w.position.set(0, 0.3, -0.24);
      w.rotation.z = 0.8;
      hips.add(w);
      break;
    }
    case 'bolsa': {
      const b = new THREE.Mesh(G.bag, lam('#6d4c2f', materials));
      b.position.set(0.3, 0.1, -0.06);
      hips.add(b);
      break;
    }
    case 'bandeira': {
      const p = new THREE.Mesh(G.flagPole, mDark);
      p.position.set(0.2, 0.5, -0.24);
      hips.add(p);
      const f = new THREE.Mesh(G.flag, lam('#ff8c1a', materials, '#ff8c1a', 0.4));
      f.position.set(0.28, 0.68, -0.24);
      hips.add(f);
      break;
    }
    case 'faixa': {
      const b = new THREE.Mesh(G.band, lam('#e3b341', materials, '#e3b341', 0.5));
      b.rotation.x = Math.PI / 2;
      b.position.y = 0.17;
      head.add(b);
      break;
    }
    case 'cantil': {
      const ct = new THREE.Mesh(G.canteen, lam('#2f9e44', materials));
      ct.position.set(0.28, -0.02, 0.1);
      hips.add(ct);
      break;
    }
  }

  // lanterna do capacete (túnel / apagão)
  let lamp: THREE.SpotLight | null = null;
  if (withLamp) {
    lamp = new THREE.SpotLight('#ffe9b0', 0, 26, 0.5, 0.45, 1.2);
    lamp.position.set(0, 0.2, 0.2);
    const target = new THREE.Object3D();
    target.position.set(0, -0.5, 8); // local +Z = frente real (rig virado)
    head.add(target);
    lamp.target = target;
    head.add(lamp);
  }

  return {
    root,
    spin,
    hips,
    legL,
    legR,
    armL,
    armR,
    head,
    lamp,
    materials,
    setExpression,
    dispose() {
      materials.forEach((m) => m.dispose());
      root.removeFromParent();
    },
  };
}

/** escurece uma cor hex por um fator (0..1) */
function shade(hexColor: string, factor: number): string {
  const c = new THREE.Color(hexColor);
  c.multiplyScalar(factor);
  return `#${c.getHexString()}`;
}
