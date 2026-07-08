import * as THREE from 'three';
import type { MapDef } from '../data/maps';
import { texArrow, texContainer, texMetal, texNoise, texSign, texTrack, texWater } from './TextureFactory';

// ============================================================
// Ambiente por bioma: céu gradiente, luzes, chão com rolagem de
// UV (geometria estática) e adereços laterais reciclados.
// ============================================================

const ENV_HORIZON = 165;

function shaderSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#3f7fd4') },
      bottom: { value: new THREE.Color('#f5c98a') },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 w = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 bottom; varying vec3 vDir;
      void main() {
        float h = smoothstep(-0.05, 0.45, vDir.y);
        gl_FragColor = vec4(mix(bottom, top, h), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 20, 12), mat);
  sky.renderOrder = -10;
  return sky;
}

export class EnvironmentSystem {
  group = new THREE.Group();
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  private ground: THREE.Mesh;
  private groundMat: THREE.MeshLambertMaterial;
  private track: THREE.Mesh;
  private trackMat: THREE.MeshLambertMaterial;
  private fog: THREE.Fog;
  private theme!: MapDef;

  private props: { key: string; mesh: THREE.Object3D }[] = [];
  private propPools = new Map<string, THREE.Object3D[]>();
  private propGroup = new THREE.Group();
  private spawnAcc = 0;
  private density = 1;
  /** props com loop de animação (NPCs, giroflex, faíscas, borboletas…) */
  private animated = new Map<THREE.Object3D, { kind: string; phase: number }>();
  private darkness = 0;
  private baseFogFar = 150;
  private fogBoost = 1;
  private blinkers: THREE.Object3D[] = [];

  constructor(private scene: THREE.Scene) {
    this.sky = shaderSky();
    this.skyMat = this.sky.material as THREE.ShaderMaterial;
    this.group.add(this.sky);

    this.hemi = new THREE.HemisphereLight('#cfe4ff', '#8a5a3a', 1.1);
    this.group.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff2d8', 2.6);
    this.sun.position.set(9, 20, 8);
    this.sun.castShadow = false;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 12;
    sc.bottom = -48;
    sc.near = 2;
    sc.far = 70;
    this.sun.shadow.bias = -0.002;
    this.sun.target.position.set(0, 0, -14);
    this.group.add(this.sun);
    this.group.add(this.sun.target);

    this.groundMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 420), this.groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set(0, -0.02, -140);
    this.ground.receiveShadow = true;
    this.group.add(this.ground);

    this.trackMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    this.track = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 420), this.trackMat);
    this.track.rotation.x = -Math.PI / 2;
    this.track.position.set(0, 0, -140);
    this.track.receiveShadow = true;
    this.group.add(this.track);

    this.fog = new THREE.Fog('#d9b184', 30, 150);
    this.scene.fog = this.fog;
    this.group.add(this.propGroup);
    this.scene.add(this.group);
  }

  private qualityFogScale = 1;

  setQuality(density: number, shadows: boolean, shadowSize: number) {
    this.density = density;
    // qualidade baixa reduz a distância de desenho (GDD: fallback leve)
    this.qualityFogScale = density < 0.6 ? 0.8 : 1;
    this.sun.castShadow = shadows;
    if (shadows) {
      this.sun.shadow.mapSize.set(shadowSize, shadowSize);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
    this.applyFog();
  }

  setFogBoost(v: number) {
    this.fogBoost = v;
    this.applyFog();
  }

  /** 0 = normal, 1 = apagão total (evento de falha de iluminação) */
  setDarkness(v: number) {
    this.darkness = v;
    this.applyLights();
  }

  private applyFog() {
    const dk = 1 - this.darkness * 0.55;
    this.fog.far = Math.max(28, this.baseFogFar * this.fogBoost * dk * this.qualityFogScale);
    this.fog.near = this.theme?.theme.dark ? 6 : 24 * this.fogBoost;
  }

  private applyLights() {
    const t = this.theme.theme;
    const dk = 1 - this.darkness * 0.92;
    this.hemi.intensity = t.hemiIntensity * dk;
    this.sun.intensity = t.sunIntensity * dk;
    const fogC = new THREE.Color(t.fog);
    fogC.multiplyScalar(1 - this.darkness * 0.8);
    this.fog.color.copy(fogC);
    const top = new THREE.Color(t.skyTop).multiplyScalar(1 - this.darkness * 0.85);
    const bot = new THREE.Color(t.skyBottom).multiplyScalar(1 - this.darkness * 0.85);
    (this.skyMat.uniforms.top.value as THREE.Color).copy(top);
    (this.skyMat.uniforms.bottom.value as THREE.Color).copy(bot);
  }

  applyTheme(map: MapDef) {
    this.theme = map;
    const t = map.theme;
    this.baseFogFar = t.fogFar;
    this.darkness = 0;
    this.fogBoost = 1;
    this.hemi.color.set(t.hemi);
    this.hemi.groundColor.set(t.hemiGround);
    this.sun.color.set(t.sun);
    const g = texNoise(t.ground, t.groundDetail, 20, 128);
    g.repeat.set(22, 80);
    this.groundMat.map = g;
    this.groundMat.needsUpdate = true;
    const tk = texTrack(t.track, t.trackLine, t.trackStyle);
    tk.repeat.set(1, 60);
    this.trackMat.map = tk;
    this.trackMat.needsUpdate = true;
    this.applyLights();
    this.applyFog();
    this.clearProps();
    this.spawnAcc = 0;
    // preenche o cenário inicial
    for (let z = -12; z > -ENV_HORIZON; z -= 6) this.spawnRow(z);
  }

  // ------------------------------------------------------------
  update(dt: number, speed: number, time: number) {
    const dz = speed * dt;
    if (this.groundMat.map) this.groundMat.map.offset.y = (this.groundMat.map.offset.y + (dz * 80) / 420) % 1;
    if (this.trackMat.map) this.trackMat.map.offset.y = (this.trackMat.map.offset.y + (dz * 60) / 420) % 1;

    for (let i = this.props.length - 1; i >= 0; i--) {
      const p = this.props[i];
      p.mesh.position.z += dz;
      if (p.mesh.position.z > 30) {
        this.releaseProp(p);
        this.props.splice(i, 1);
      }
    }
    this.spawnAcc += dz;
    while (this.spawnAcc >= 6) {
      this.spawnAcc -= 6;
      this.spawnRow(-ENV_HORIZON);
    }
    const blinkOn = Math.sin(time * 6) > -0.2;
    for (const b of this.blinkers) b.visible = blinkOn;
    this.animateProps(dt, time);
  }

  private clearProps() {
    for (const p of this.props) this.releaseProp(p);
    this.props = [];
    this.blinkers = [];
  }

  private releaseProp(p: { key: string; mesh: THREE.Object3D }) {
    this.animated.delete(p.mesh);
    p.mesh.visible = false;
    p.mesh.removeFromParent();
    let pool = this.propPools.get(p.key);
    if (!pool) {
      pool = [];
      this.propPools.set(p.key, pool);
    }
    if (pool.length < 30) pool.push(p.mesh);
    const bi = this.blinkers.findIndex((b) => {
      let found = false;
      p.mesh.traverse((o) => {
        if (o === b) found = true;
      });
      return found;
    });
    if (bi >= 0) this.blinkers.splice(bi, 1);
  }

  private acquireProp(key: string): THREE.Object3D {
    const pool = this.propPools.get(key);
    if (pool && pool.length > 0) {
      const m = pool.pop()!;
      m.visible = true;
      return m;
    }
    return this.makeProp(key);
  }

  private placeProp(key: string, x: number, z: number, rotY = 0): THREE.Object3D {
    const m = this.acquireProp(key);
    m.position.set(x, 0, z);
    m.rotation.y = rotY;
    this.propGroup.add(m);
    this.props.push({ key, mesh: m });
    // registra props com loop de animação
    if (key.startsWith('npc:') || ['giroflex', 'sparks', 'butterfly', 'tunnelLight', 'fan'].includes(key)) {
      this.animated.set(m, { kind: key, phase: Math.random() * 10 });
    }
    return m;
  }

  /** loops curtos de vida do ambiente (2 a 5s, conforme GDD) */
  private animateProps(dt: number, time: number) {
    for (const [mesh, a] of this.animated) {
      const t = time + a.phase;
      if (a.kind.startsWith('npc:')) {
        const role = a.kind.slice(4);
        let armL: THREE.Object3D | undefined;
        let armR: THREE.Object3D | undefined;
        let head: THREE.Object3D | undefined;
        for (const c of mesh.children) {
          if (c.name === 'armL') armL = c;
          else if (c.name === 'armR') armR = c;
          else if (c.name === 'head') head = c;
        }
        switch (role) {
          case 'sinalizador': // gesto de pare/siga com bastão
            if (armR) armR.rotation.x = -2.2 + Math.sin(t * 1.6) * 0.5;
            if (head) head.rotation.y = Math.sin(t * 0.8) * 0.4;
            break;
          case 'tecnica': // observa e anota
            if (armL) armL.rotation.x = -1.1;
            if (head) head.rotation.x = 0.25 + Math.sin(t * 1.2) * 0.15;
            break;
          case 'mecanico': // aperta parafuso
            if (armR) armR.rotation.x = -0.7 + Math.sin(t * 5) * 0.35;
            break;
          case 'brigadista': // checa área
            if (head) head.rotation.y = Math.sin(t * 0.7) * 0.6;
            if (armR) armR.rotation.x = -0.4;
            break;
          case 'ambiental': // coleta amostra
            if (armL) armL.rotation.x = -0.9 + Math.sin(t * 2) * 0.3;
            if (head) head.rotation.x = 0.3;
            break;
          case 'geologo': // observa talude e fotografa
            if (head) head.rotation.x = -0.25 + Math.sin(t * 0.9) * 0.1;
            if (armR) armR.rotation.x = -1.6 + Math.sin(t * 0.9) * 0.2;
            break;
        }
      } else if (a.kind === 'giroflex') {
        for (const c of mesh.children) {
          if (c.name === 'rotor') {
            c.rotation.y += dt * 7;
            c.visible = Math.sin(t * 10) > -0.6;
          }
        }
      } else if (a.kind === 'sparks') {
        for (const c of mesh.children) {
          if (c.name.startsWith('spark')) {
            c.visible = Math.random() > 0.55;
            c.position.y = 1.0 + Math.random() * 0.3;
          }
        }
      } else if (a.kind === 'butterfly') {
        mesh.position.y = Math.sin(t * 1.8) * 0.4;
        for (const c of mesh.children) {
          if (c.name === 'flapL') c.rotation.z = 0.4 + Math.sin(t * 14) * 0.7;
          if (c.name === 'flapR') c.rotation.z = -0.4 - Math.sin(t * 14) * 0.7;
        }
      } else if (a.kind === 'tunnelLight') {
        // piscada rítmica das luminárias (tensão do túnel)
        mesh.visible = Math.sin(t * 9) > -0.85;
      } else if (a.kind === 'fan') {
        for (const c of mesh.children) {
          if (c.name === 'blade') c.rotation.z += dt * 4;
        }
      }
    }
  }

  private spawnRow(z: number) {
    const id = this.theme.id;
    const r = Math.random;
    const rowIdx = Math.floor(-z / 6);
    // elementos contínuos obrigatórios do bioma
    if (id === 'tunel') {
      this.placeProp('arch', 0, z);
      if (rowIdx % 2 === 0) this.placeProp('timberFrame', 0, z);
      else this.placeProp('tunnelLight', 0, z);
      if (rowIdx % 3 === 0) this.placeProp('lantern', rowIdx % 6 === 0 ? -5.2 : 5.2, z);
    }
    if (id === 'correia') {
      this.placeProp('rail', -4.35, z);
      this.placeProp('rail', 4.35, z);
    }
    if (id === 'ambiental' && rowIdx % 2 === 0) this.placeProp('channel', 5.4, z);
    // nuvens nos mapas a céu aberto
    if (id !== 'tunel' && r() < 0.06) this.placeProp('cloud', (r() > 0.5 ? 1 : -1) * (16 + r() * 40), z);
    // decals de piso: nenhum trecho pode parecer chapado (GDD complementar)
    if (r() < this.density * 0.5) this.placeProp('decal', (r() > 0.5 ? 1 : -1) * (4.3 + r() * 3.2), z);

    // dois lados independentes por linha = cenário mais denso
    for (const side of [-1, 1]) {
      if (r() > this.density * 0.72) continue;
      const near = 5.4 + r() * 3;
      const far = 11 + r() * 14;
      const roll = r();
      const npcRot = -side * (Math.PI / 2); // NPC de frente para a pista
      switch (id) {
        case 'patio': {
          if (roll < 0.18) this.placeProp('mound', side * far, z);
          else if (roll < 0.28) this.placeProp('container', side * (far + 2), z, r() * 0.4);
          else if (roll < 0.36) this.placeProp('lightTower', side * near, z);
          else if (roll < 0.44) this.placeProp(r() > 0.5 ? 'signSpeed' : r() > 0.5 ? 'sp:epi' : 'sp:oper', side * near, z);
          else if (roll < 0.54) this.placeProp('rockPile', side * near, z);
          else if (roll < 0.64) this.placeProp('oreCart', side * (near + 1.4), z);
          else if (roll < 0.7) this.placeProp('crystal', side * (near + 0.8), z);
          else if (roll < 0.76) this.placeProp('craneTall', side * (far + 8), z);
          else if (roll < 0.82) this.placeProp('grassDry', side * (near + 2 + r() * 4), z);
          else if (roll < 0.88) this.placeProp(r() > 0.5 ? 'npc:sinalizador' : 'npc:geologo', side * (near + 0.6), z, npcRot);
          else if (roll < 0.93) this.placeProp('lightShaft', side * (8 + r() * 6), z);
          else if (r() < this.density * 0.5) this.placeProp('gantry', 0, z);
          break;
        }
        case 'correia': {
          if (roll < 0.24) this.placeProp('roller', side * near, z);
          else if (roll < 0.38) this.placeProp('gantry', 0, z);
          else if (roll < 0.5) this.placeProp('lamp', side * near, z);
          else if (roll < 0.6) this.placeProp('oreCart', side * (near + 1.2), z);
          else if (roll < 0.7) this.placeProp('container', side * far, z);
          else if (roll < 0.78) this.placeProp('barrelStack', side * near, z);
          else if (roll < 0.85) this.placeProp(r() > 0.5 ? 'sp:oper' : 'sp:epi', side * near, z);
          else if (roll < 0.91) this.placeProp(r() > 0.5 ? 'npc:mecanico' : 'npc:tecnica', side * (near + 0.6), z, npcRot);
          else if (roll < 0.95) this.placeProp('giroflex', side * near, z);
          else this.placeProp('sparks', side * (near + 1.5), z);
          break;
        }
        case 'oficina': {
          if (roll < 0.28) this.placeProp('wall', side * 8.2, z);
          else if (roll < 0.42) this.placeProp('bench', side * near, z);
          else if (roll < 0.52) this.placeProp('crane', 0, z);
          else if (roll < 0.62) this.placeProp('shelf', side * 7.6, z);
          else if (roll < 0.72) this.placeProp('barrelStack', side * near, z);
          else if (roll < 0.79) this.placeProp(r() > 0.5 ? 'sp:emerg' : r() > 0.5 ? 'sp:proib' : 'sp:oper', side * near, z);
          else if (roll < 0.86) this.placeProp(r() > 0.5 ? 'npc:mecanico' : 'npc:brigadista', side * (near + 0.6), z, npcRot);
          else if (roll < 0.92) this.placeProp('giroflex', side * near, z);
          else if (roll < 0.97) this.placeProp('sparks', side * (near + 1.2), z);
          else this.placeProp('lamp', side * near, z);
          break;
        }
        case 'acesso': {
          if (roll < 0.26) this.placeProp('talude', side * (far + 4), z);
          else if (roll < 0.38) this.placeProp('rockPile', side * near, z);
          else if (roll < 0.48) this.placeProp(r() > 0.5 ? 'signSpeed' : 'sp:proib', side * near, z);
          else if (roll < 0.58) this.placeProp('parkedTruck', side * (far + 4), z, side > 0 ? Math.PI : 0);
          else if (roll < 0.66) this.placeProp('lightTower', side * near, z);
          else if (roll < 0.73) this.placeProp('craneTall', side * (far + 10), z);
          else if (roll < 0.81) this.placeProp('grassDry', side * (near + 2 + r() * 5), z);
          else if (roll < 0.88) this.placeProp(r() > 0.5 ? 'npc:sinalizador' : 'npc:geologo', side * (near + 0.6), z, npcRot);
          else if (roll < 0.94) this.placeProp('lightShaft', side * (9 + r() * 6), z);
          else this.placeProp('crystal', side * (near + 1), z);
          break;
        }
        case 'tunel': {
          if (roll < 0.26) this.placeProp('pipes', side * 5.6, z);
          else if (roll < 0.38) this.placeProp('fan', side * 5.4, z);
          else if (roll < 0.56) this.placeProp('crystal', side * (4.6 + r() * 1.2), z);
          else if (roll < 0.68) this.placeProp('oreCart', side * 5.0, z);
          else if (roll < 0.78) this.placeProp('barrelStack', side * 5.2, z);
          else if (roll < 0.85) this.placeProp('sp:emerg', side * 5.2, z);
          else if (roll < 0.9) this.placeProp('npc:brigadista', side * 5.0, z, npcRot);
          break;
        }
        case 'ambiental': {
          if (roll < 0.28) this.placeProp('tree', side * (near + 2 + r() * 8), z);
          else if (roll < 0.44) this.placeProp('bush', side * (near + r() * 5), z);
          else if (roll < 0.54) this.placeProp('flowers', side * (near + r() * 3), z);
          else if (roll < 0.62) this.placeProp('grassGreen', side * (near + 1 + r() * 4), z);
          else if (roll < 0.7) this.placeProp(r() > 0.5 ? 'signEco' : 'sp:emerg', side * near, z);
          else if (roll < 0.8) this.placeProp('basin', side * (far + 2), z);
          else if (roll < 0.87) this.placeProp('npc:ambiental', side * (near + 0.6), z, npcRot);
          else if (roll < 0.94) this.placeProp('butterfly', side * (3.8 + r() * 3), z);
          else this.placeProp('bird', side * far, z);
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------
  // Fábricas de props (compartilham materiais/geometrias simples)
  // ------------------------------------------------------------
  private pm = new Map<string, THREE.Material>();
  private pg = new Map<string, THREE.BufferGeometry>();

  private mat(key: string, create: () => THREE.Material): THREE.Material {
    let m = this.pm.get(key);
    if (!m) {
      m = create();
      this.pm.set(key, m);
    }
    return m;
  }
  private geo(key: string, create: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.pg.get(key);
    if (!g) {
      g = create();
      this.pg.set(key, g);
    }
    return g;
  }
  private m(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    const ms = new THREE.Mesh(g, m);
    ms.position.set(x, y, z);
    return ms;
  }

  private makeProp(key: string): THREE.Object3D {
    const g = new THREE.Group();
    const lam = (k: string, o: THREE.MeshLambertMaterialParameters) => this.mat(k, () => new THREE.MeshLambertMaterial(o));
    const bas = (k: string, o: THREE.MeshBasicMaterialParameters) => this.mat(k, () => new THREE.MeshBasicMaterial(o));
    switch (key) {
      case 'mound': {
        const oreM = lam('ore', { map: texNoise('#8a4a22', '#5c2f12', 12) });
        const c = this.m(this.geo('mound', () => new THREE.ConeGeometry(4.4, 4.5, 9)), oreM, 0, 2.2);
        c.rotation.y = Math.random() * 3;
        g.add(c);
        break;
      }
      case 'container': {
        const colors = ['#3f6fb5', '#2f9e44', '#c8402f', '#e8a800'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        g.add(this.m(this.geo('cont', () => new THREE.BoxGeometry(3, 2.6, 6.2)), this.mat(`cont:${color}`, () => new THREE.MeshLambertMaterial({ map: texContainer(color) })), 0, 1.3));
        break;
      }
      case 'lightTower': {
        const dark = lam('pDark', { color: '#3a3f47' });
        g.add(this.m(this.geo('ltPole', () => new THREE.CylinderGeometry(0.09, 0.14, 7.5, 6)), dark, 0, 3.75));
        const lampM = bas('pLamp', { color: '#fff2b0' });
        const lamp = this.m(this.geo('ltLamp', () => new THREE.BoxGeometry(0.8, 0.3, 0.4)), lampM, 0, 7.3);
        g.add(lamp);
        this.blinkers.push(lamp);
        break;
      }
      case 'signSpeed': {
        const dark = lam('pDark', { color: '#3a3f47' });
        g.add(this.m(this.geo('ssPole', () => new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6)), dark, 0, 1.2));
        g.add(this.m(this.geo('ssPlate', () => new THREE.BoxGeometry(1.0, 1.0, 0.06)), bas('signV', { map: texSign('40', '#f2f2f2', '#c0392b', '#c0392b') }), 0, 2.6));
        break;
      }
      case 'rockPile': {
        const rockM = lam('pRock', { map: texNoise('#5c5850', '#3d3a34', 10) });
        for (let i = 0; i < 3; i++) {
          const r = this.m(this.geo('pRockG', () => new THREE.DodecahedronGeometry(0.7, 0)), rockM, (Math.random() - 0.5) * 1.6, 0.5, (Math.random() - 0.5) * 1.4);
          r.rotation.set(Math.random(), Math.random(), Math.random());
          r.scale.setScalar(0.6 + Math.random() * 0.8);
          g.add(r);
        }
        break;
      }
      case 'gantry': {
        const metal = lam('pMetal', { map: texMetal('#5f6670') });
        g.add(this.m(this.geo('gtLeg', () => new THREE.BoxGeometry(0.5, 6.4, 0.5)), metal, -8.5, 3.2));
        g.add(this.m(this.geo('gtLeg', () => new THREE.BoxGeometry(0.5, 6.4, 0.5)), metal, 8.5, 3.2));
        g.add(this.m(this.geo('gtBeam', () => new THREE.BoxGeometry(18, 1.1, 1.4)), metal, 0, 6.4));
        const beltM = lam('pBelt', { color: '#23262b' });
        g.add(this.m(this.geo('gtBelt', () => new THREE.BoxGeometry(17, 0.3, 1.0)), beltM, 0, 7.1));
        break;
      }
      case 'rail': {
        const metal = lam('pMetal', { map: texMetal('#5f6670') });
        g.add(this.m(this.geo('grPost', () => new THREE.BoxGeometry(0.1, 1.15, 0.1)), metal, 0, 0.57));
        g.add(this.m(this.geo('grBar', () => new THREE.BoxGeometry(0.08, 0.08, 6.2)), lam('pYellow', { color: '#f2b705' }), 0, 1.1));
        g.add(this.m(this.geo('grBar', () => new THREE.BoxGeometry(0.08, 0.08, 6.2)), lam('pYellow', { color: '#f2b705' }), 0, 0.6));
        break;
      }
      case 'roller': {
        const metal = lam('pMetal', { map: texMetal('#5f6670') });
        g.add(this.m(this.geo('rlBase', () => new THREE.BoxGeometry(1.6, 0.9, 0.5)), metal, 0, 0.45));
        const roll = this.m(this.geo('rlRoll', () => new THREE.CylinderGeometry(0.28, 0.28, 1.5, 10)), lam('pDark', { color: '#3a3f47' }), 0, 1.05);
        roll.rotation.z = Math.PI / 2;
        g.add(roll);
        break;
      }
      case 'lamp': {
        const dark = lam('pDark', { color: '#3a3f47' });
        g.add(this.m(this.geo('lpPole', () => new THREE.CylinderGeometry(0.06, 0.09, 3.6, 6)), dark, 0, 1.8));
        g.add(this.m(this.geo('lpHead', () => new THREE.BoxGeometry(0.5, 0.2, 0.3)), bas('pLamp', { color: '#fff2b0' }), 0, 3.6));
        break;
      }
      case 'wall': {
        const wallM = lam('pWall', { map: texContainer('#7d838c') });
        g.add(this.m(this.geo('wlWall', () => new THREE.BoxGeometry(0.5, 5.4, 6.2)), wallM, 0, 2.7));
        g.add(this.m(this.geo('wlWin', () => new THREE.BoxGeometry(0.2, 1.4, 3.2)), bas('pWin', { color: '#ffe9b0' }), -0.25, 3.4));
        break;
      }
      case 'bench': {
        const metal = lam('pMetal', { map: texMetal('#5f6670') });
        g.add(this.m(this.geo('bnTop', () => new THREE.BoxGeometry(2.4, 0.15, 1.0)), lam('pWood', { map: texNoise('#9c7442', '#6d4c2a', 8) }), 0, 0.95));
        g.add(this.m(this.geo('bnLeg', () => new THREE.BoxGeometry(2.2, 0.9, 0.8)), metal, 0, 0.45));
        g.add(this.m(this.geo('bnTool', () => new THREE.BoxGeometry(0.5, 0.3, 0.4)), lam('pRed', { color: '#c8402f' }), 0.5, 1.15));
        break;
      }
      case 'crane': {
        const yellow = lam('pYellow', { color: '#f2b705' });
        const metal = lam('pMetal', { map: texMetal('#5f6670') });
        g.add(this.m(this.geo('crLeg', () => new THREE.BoxGeometry(0.6, 7.2, 0.6)), metal, -8, 3.6));
        g.add(this.m(this.geo('crLeg', () => new THREE.BoxGeometry(0.6, 7.2, 0.6)), metal, 8, 3.6));
        g.add(this.m(this.geo('crBeam', () => new THREE.BoxGeometry(17, 0.9, 0.9)), yellow, 0, 7.2));
        g.add(this.m(this.geo('crHook', () => new THREE.BoxGeometry(0.35, 1.6, 0.35)), metal, Math.random() * 8 - 4, 6.2));
        break;
      }
      case 'shelf': {
        const metal = lam('pMetal', { map: texMetal('#5f6670') });
        g.add(this.m(this.geo('shFrame', () => new THREE.BoxGeometry(0.8, 3.6, 4.2)), metal, 0, 1.8));
        g.add(this.m(this.geo('shBox', () => new THREE.BoxGeometry(0.85, 0.6, 1.0)), lam('pCrate', { map: texNoise('#b08a52', '#8a6a3c', 6) }), 0, 2.4, 0.8));
        break;
      }
      case 'talude': {
        const oreM = lam('pTalude', { map: texNoise('#96683c', '#6d4526', 14) });
        const w = this.m(this.geo('tlWedge', () => new THREE.ConeGeometry(9, 8, 4)), oreM, 0, 3.4);
        w.rotation.y = Math.PI / 4;
        w.scale.set(1.6, 1, 1);
        g.add(w);
        break;
      }
      case 'parkedTruck': {
        const body = lam('ptBody', { color: '#e8a800' });
        const dark = lam('pDark', { color: '#3a3f47' });
        g.add(this.m(this.geo('ptBed', () => new THREE.BoxGeometry(4.5, 2.2, 3)), body, 0, 2.2));
        g.add(this.m(this.geo('ptCab', () => new THREE.BoxGeometry(1.6, 1.6, 2.4)), body, 2.6, 1.6));
        for (const wx of [-1.6, 0, 2.4]) {
          const w = this.m(this.geo('ptWheel', () => new THREE.CylinderGeometry(0.9, 0.9, 0.7, 10)), dark, wx, 0.9, 1.4);
          w.rotation.x = Math.PI / 2;
          g.add(w);
          const w2 = w.clone();
          w2.position.z = -1.4;
          g.add(w2);
        }
        break;
      }
      case 'arch': {
        const rockM = lam('pTunnel', { map: texNoise('#3d3a33', '#26241f', 10) });
        const shell = this.m(
          this.geo('archShell', () => new THREE.CylinderGeometry(7.2, 7.2, 6.4, 14, 1, true, 0, Math.PI)),
          rockM,
          0,
          0.4,
        );
        shell.rotation.z = Math.PI / 2;
        shell.rotation.y = Math.PI / 2;
        (rockM as THREE.MeshLambertMaterial).side = THREE.BackSide;
        g.add(shell);
        break;
      }
      case 'tunnelLight': {
        const lampM = bas('tnLamp', { color: '#ffd9a0' });
        g.add(this.m(this.geo('tnLampG', () => new THREE.BoxGeometry(0.8, 0.15, 0.3)), lampM, 0, 6.4));
        break;
      }
      case 'pipes': {
        const metal = lam('pPipe', { map: texMetal('#6d5a3a') });
        const p1 = this.m(this.geo('tpPipe', () => new THREE.CylinderGeometry(0.2, 0.2, 6.2, 8)), metal, 0, 2.4);
        p1.rotation.x = Math.PI / 2;
        g.add(p1);
        const p2 = this.m(this.geo('tpPipe2', () => new THREE.CylinderGeometry(0.12, 0.12, 6.2, 8)), metal, 0.4, 2.9);
        p2.rotation.x = Math.PI / 2;
        g.add(p2);
        break;
      }
      case 'fan': {
        const dark = lam('pDark', { color: '#3a3f47' });
        g.add(this.m(this.geo('fnRing', () => new THREE.TorusGeometry(0.9, 0.14, 8, 14)), dark, 0, 3.4));
        const blade = this.m(this.geo('fnBlade', () => new THREE.BoxGeometry(1.5, 0.22, 0.08)), lam('pGrey', { color: '#9aa0a8' }), 0, 3.4);
        blade.name = 'blade';
        g.add(blade);
        const blade2 = blade.clone();
        blade2.rotation.z = Math.PI / 2;
        blade2.name = 'blade';
        g.add(blade2);
        break;
      }
      case 'tree': {
        const trunk = lam('pTrunk', { color: '#6d4c2f' });
        const leaf = lam('pLeaf', { color: '#2f7a3d' });
        g.add(this.m(this.geo('trTrunk', () => new THREE.CylinderGeometry(0.18, 0.26, 1.6, 7)), trunk, 0, 0.8));
        const c1 = this.m(this.geo('trLeaf', () => new THREE.ConeGeometry(1.5, 2.6, 8)), leaf, 0, 2.6);
        g.add(c1);
        const c2 = this.m(this.geo('trLeaf2', () => new THREE.ConeGeometry(1.1, 2.0, 8)), leaf, 0, 3.6);
        g.add(c2);
        g.scale.setScalar(0.8 + Math.random() * 0.7);
        break;
      }
      case 'bush': {
        const leaf = lam('pBush', { color: '#3d8a4a' });
        g.add(this.m(this.geo('bsBall', () => new THREE.SphereGeometry(0.6, 8, 6)), leaf, 0, 0.5));
        g.add(this.m(this.geo('bsBall2', () => new THREE.SphereGeometry(0.45, 8, 6)), leaf, 0.5, 0.4));
        break;
      }
      case 'signEco': {
        const dark = lam('pDark', { color: '#3a3f47' });
        g.add(this.m(this.geo('ecPole', () => new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6)), dark, 0, 1.1));
        g.add(this.m(this.geo('ecPlate', () => new THREE.BoxGeometry(1.1, 0.8, 0.06)), bas('signEcoM', { map: texSign('ÁREA\nPROTEGIDA', '#2f9e44', '#ffffff', '#ffffff') }), 0, 2.4));
        break;
      }
      case 'basin': {
        const conc = lam('pConc', { map: texNoise('#9aa0a8', '#7d838c', 10) });
        g.add(this.m(this.geo('bsWall', () => new THREE.BoxGeometry(6.4, 0.7, 4.4)), conc, 0, 0.35));
        const water = this.m(this.geo('bsWater', () => new THREE.BoxGeometry(5.8, 0.1, 3.8)), bas('pWater', { map: texWater() }), 0, 0.72);
        g.add(water);
        break;
      }
      case 'channel': {
        const conc = lam('pConc', { map: texNoise('#9aa0a8', '#7d838c', 10) });
        g.add(this.m(this.geo('chSide', () => new THREE.BoxGeometry(0.3, 0.4, 6.2)), conc, -0.9, 0.2));
        g.add(this.m(this.geo('chSide', () => new THREE.BoxGeometry(0.3, 0.4, 6.2)), conc, 0.9, 0.2));
        g.add(this.m(this.geo('chWater', () => new THREE.BoxGeometry(1.5, 0.12, 6.2)), bas('pWater', { map: texWater() }), 0, 0.1));
        break;
      }
      case 'bird': {
        const white = lam('pBird', { color: '#eef2f5' });
        const b = this.m(this.geo('bdBody', () => new THREE.SphereGeometry(0.16, 6, 5)), white, 0, 6 + Math.random() * 3);
        g.add(b);
        const w1 = this.m(this.geo('bdWing', () => new THREE.BoxGeometry(0.5, 0.04, 0.16)), white, 0, b.position.y + 0.05);
        g.add(w1);
        break;
      }
      case 'crystal': {
        // cristais coloridos — o "brilho de mina" da referência visual
        const colors = ['#b563f2', '#4dd7f2', '#ffce3a'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const cm = this.mat(`pCrys:${color}`, () => new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.55 }));
        for (let i = 0; i < 3; i++) {
          const cr = this.m(this.geo('pCrysG', () => new THREE.ConeGeometry(0.22, 0.85, 5)), cm, (Math.random() - 0.5) * 0.9, 0.3, (Math.random() - 0.5) * 0.7);
          cr.rotation.set((Math.random() - 0.5) * 0.7, Math.random() * 3, (Math.random() - 0.5) * 0.7);
          cr.scale.setScalar(0.6 + Math.random() * 0.9);
          g.add(cr);
        }
        const base = this.m(this.geo('pCrysBase', () => new THREE.DodecahedronGeometry(0.5, 0)), lam('pRock', { map: texNoise('#5c5850', '#3d3a34', 10) }), 0, 0.2);
        base.scale.set(1.3, 0.5, 1.1);
        g.add(base);
        break;
      }
      case 'lantern': {
        const dark = lam('pDark', { color: '#3a3f47' });
        g.add(this.m(this.geo('lnPole', () => new THREE.CylinderGeometry(0.05, 0.07, 2.6, 6)), dark, 0, 1.3));
        g.add(this.m(this.geo('lnArm', () => new THREE.BoxGeometry(0.5, 0.06, 0.06)), dark, 0.22, 2.55));
        const glow = this.m(
          this.geo('lnGlow', () => new THREE.SphereGeometry(0.16, 8, 6)),
          this.mat('lnGlowM', () => new THREE.MeshBasicMaterial({ color: '#ffcf7d' })),
          0.42,
          2.42,
        );
        g.add(glow);
        const cap = this.m(this.geo('lnCap', () => new THREE.ConeGeometry(0.22, 0.16, 8)), dark, 0.42, 2.6);
        g.add(cap);
        break;
      }
      case 'timberFrame': {
        // pórtico de madeira estilo mina antiga
        const wood = lam('pTimber', { map: texNoise('#8a5a30', '#5c3a1c', 8) });
        const beamG = this.geo('tfBeam', () => new THREE.BoxGeometry(0.55, 7.0, 0.55));
        const l = this.m(beamG, wood, -4.6, 3.2);
        l.rotation.z = 0.12;
        g.add(l);
        const rgt = this.m(beamG, wood, 4.6, 3.2);
        rgt.rotation.z = -0.12;
        g.add(rgt);
        g.add(this.m(this.geo('tfTop', () => new THREE.BoxGeometry(10.4, 0.6, 0.6)), wood, 0, 6.4));
        g.add(this.m(this.geo('tfBrace', () => new THREE.BoxGeometry(2.6, 0.35, 0.4)), wood, -3.4, 5.6));
        g.add(this.m(this.geo('tfBrace', () => new THREE.BoxGeometry(2.6, 0.35, 0.4)), wood, 3.4, 5.6));
        break;
      }
      case 'oreCart': {
        // vagoneta com minério dourado brilhando
        const metal = lam('pCartMetal', { map: texMetal('#4a5560') });
        const gold = this.mat('pGold', () => new THREE.MeshLambertMaterial({ color: '#ffce3a', emissive: '#a8761a', emissiveIntensity: 0.6 }));
        const body = this.m(this.geo('ocBody', () => new THREE.BoxGeometry(1.5, 0.9, 2.0)), metal, 0, 0.85);
        body.rotation.y = (Math.random() - 0.5) * 0.5;
        g.add(body);
        const rim = this.m(this.geo('ocRim', () => new THREE.BoxGeometry(1.66, 0.14, 2.16)), lam('pDark', { color: '#3a3f47' }), 0, 1.3);
        rim.rotation.y = body.rotation.y;
        g.add(rim);
        for (let i = 0; i < 4; i++) {
          const n = this.m(this.geo('ocNug', () => new THREE.DodecahedronGeometry(0.28, 0)), gold, (Math.random() - 0.5) * 0.8, 1.42, (Math.random() - 0.5) * 1.2);
          n.rotation.set(Math.random(), Math.random(), Math.random());
          g.add(n);
        }
        const wheelG = this.geo('ocWheel', () => new THREE.CylinderGeometry(0.24, 0.24, 0.1, 10));
        for (const wz of [-0.6, 0.6])
          for (const wx of [-0.7, 0.7]) {
            const w = this.m(wheelG, lam('pDark', { color: '#3a3f47' }), wx, 0.24, wz);
            w.rotation.z = Math.PI / 2;
            g.add(w);
          }
        const ocBlob = this.m(this.geo('blobG', () => new THREE.CircleGeometry(1, 12)), this.mat('blobM', () => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false })), 0, 0.015);
        ocBlob.rotation.x = -Math.PI / 2;
        ocBlob.scale.set(1.3, 1.6, 1);
        g.add(ocBlob);
        break;
      }
      case 'craneTall': {
        // guindaste alto de fundo (silhueta industrial)
        const yellow = lam('pCrane', { color: '#e8a800' });
        const dark = lam('pDark', { color: '#3a3f47' });
        g.add(this.m(this.geo('ctBase', () => new THREE.BoxGeometry(2.2, 1.4, 2.2)), dark, 0, 0.7));
        g.add(this.m(this.geo('ctMast', () => new THREE.BoxGeometry(0.9, 14, 0.9)), yellow, 0, 8));
        const jib = this.m(this.geo('ctJib', () => new THREE.BoxGeometry(11, 0.7, 0.7)), yellow, 3.4, 14.6);
        jib.rotation.z = 0.05;
        g.add(jib);
        g.add(this.m(this.geo('ctCw', () => new THREE.BoxGeometry(1.8, 1.2, 1.2)), dark, -2.6, 14.2));
        const cableX = 6.5 + Math.random() * 1.5;
        g.add(this.m(this.geo('ctCable', () => new THREE.BoxGeometry(0.08, 6, 0.08)), dark, cableX, 11.6));
        const hook = this.m(this.geo('ctHook', () => new THREE.BoxGeometry(0.5, 0.7, 0.5)), yellow, cableX, 8.3);
        g.add(hook);
        break;
      }
      case 'cloud': {
        const cm = this.mat('pCloud', () => new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false, transparent: true, opacity: 0.92 }));
        const y = 22 + Math.random() * 12;
        const s = 2.4 + Math.random() * 2.6;
        const ball = this.geo('pCloudG', () => new THREE.SphereGeometry(1, 8, 6));
        for (const [dx, dy, sc] of [
          [0, 0, 1],
          [-1.3, -0.15, 0.7],
          [1.25, -0.1, 0.75],
        ]) {
          const b = this.m(ball, cm, dx * s, y + dy * s);
          b.scale.set(s * sc, s * sc * 0.55, s * sc * 0.8);
          g.add(b);
        }
        break;
      }
      case 'barrelStack': {
        const drumG = this.geo('pDrum', () => new THREE.CylinderGeometry(0.34, 0.34, 0.9, 10));
        const colors = ['#3f6fb5', '#c8402f', '#2f9e44'];
        for (let i = 0; i < 3; i++) {
          const dm = this.mat(`pDrum:${colors[i]}`, () => new THREE.MeshLambertMaterial({ color: colors[i] }));
          const d = this.m(drumG, dm, i === 2 ? 0.34 : (i - 0.5) * 0.72, i === 2 ? 1.32 : 0.45, 0);
          g.add(d);
        }
        break;
      }
      case 'flowers': {
        const stemM = lam('pStem', { color: '#2f7a3d' });
        const petals = ['#f25a8a', '#ffd23f', '#f2f2f2', '#b563f2'];
        for (let i = 0; i < 4; i++) {
          const x = (Math.random() - 0.5) * 1.6;
          const zz = (Math.random() - 0.5) * 1.2;
          g.add(this.m(this.geo('pStemG', () => new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4)), stemM, x, 0.2, zz));
          const color = petals[Math.floor(Math.random() * petals.length)];
          const pm = this.mat(`pPetal:${color}`, () => new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 }));
          g.add(this.m(this.geo('pPetalG', () => new THREE.SphereGeometry(0.09, 6, 5)), pm, x, 0.42, zz));
        }
        break;
      }
      case 'giroflex': {
        const dark = lam('pDark', { color: '#3a3f47' });
        g.add(this.m(this.geo('gfPole', () => new THREE.CylinderGeometry(0.05, 0.07, 1.9, 6)), dark, 0, 0.95));
        const rotor = this.m(this.geo('gfRotor', () => new THREE.BoxGeometry(0.18, 0.12, 0.18)), bas('gfLight', { color: '#ff8c1a' }), 0, 2.0);
        rotor.name = 'rotor';
        g.add(rotor);
        g.add(this.m(this.geo('gfCap', () => new THREE.CylinderGeometry(0.12, 0.14, 0.06, 8)), dark, 0, 2.1));
        break;
      }
      case 'sparks': {
        // ponto de solda fake — bursts controlados no fundo (GDD)
        const dark = lam('pDark', { color: '#3a3f47' });
        g.add(this.m(this.geo('spBase', () => new THREE.BoxGeometry(0.5, 0.9, 0.5)), dark, 0, 0.45));
        const sparkM = bas('sparkM', { color: '#ffe9a0' });
        for (let i = 0; i < 3; i++) {
          const s = this.m(this.geo('spDot', () => new THREE.BoxGeometry(0.06, 0.06, 0.06)), sparkM, (Math.random() - 0.5) * 0.3, 1.0, (Math.random() - 0.5) * 0.3);
          s.name = `spark${i}`;
          g.add(s);
        }
        break;
      }
      case 'butterfly': {
        const colors = ['#f2b705', '#b563f2', '#4dd7f2'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const wm = this.mat(`bfW:${color}`, () => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
        const wingG = this.geo('bfWing', () => new THREE.PlaneGeometry(0.16, 0.12));
        const fl = this.m(wingG, wm, -0.07, 1.3);
        fl.name = 'flapL';
        g.add(fl);
        const fr = this.m(wingG, wm, 0.07, 1.3);
        fr.name = 'flapR';
        g.add(fr);
        g.add(this.m(this.geo('bfBody', () => new THREE.BoxGeometry(0.03, 0.03, 0.1)), lam('pDark', { color: '#3a3f47' }), 0, 1.3));
        break;
      }
      case 'lightShaft': {
        // facho de luz falso atravessando a poeira (GDD: sem luz real)
        const sm = this.mat('shaftM', () => new THREE.MeshBasicMaterial({
          color: '#fff2d0',
          transparent: true,
          opacity: 0.09,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }));
        const p = this.m(this.geo('shaftG', () => new THREE.PlaneGeometry(2.6, 9)), sm, 0, 4.2);
        p.rotation.z = 0.35;
        p.rotation.y = 0.4;
        g.add(p);
        break;
      }
      case 'decal': {
        // decals de piso: óleo, pneu, tinta, ferrugem (quebra o visual chapado)
        const roll = Math.random();
        if (roll < 0.3) {
          const oil = this.m(this.geo('blobG', () => new THREE.CircleGeometry(1, 12)), this.mat('oilM', () => new THREE.MeshBasicMaterial({ color: '#14120c', transparent: true, opacity: 0.5, depthWrite: false })), 0, 0.03);
          oil.rotation.x = -Math.PI / 2;
          oil.scale.set(0.9 + Math.random(), 0.5 + Math.random() * 0.6, 1);
          g.add(oil);
        } else if (roll < 0.58) {
          const tm = this.mat('tireM', () => new THREE.MeshBasicMaterial({ color: '#1c1a16', transparent: true, opacity: 0.35, depthWrite: false }));
          for (const off of [-0.4, 0.4]) {
            const t = this.m(this.geo('tireG', () => new THREE.PlaneGeometry(0.28, 4.2)), tm, off, 0.03);
            t.rotation.x = -Math.PI / 2;
            t.rotation.z = (Math.random() - 0.5) * 0.5;
            g.add(t);
          }
        } else if (roll < 0.8) {
          const am = this.mat('paintM', () => new THREE.MeshBasicMaterial({ map: texArrow('#f2d16b'), transparent: true, opacity: 0.75, depthWrite: false }));
          const a = this.m(this.geo('paintG', () => new THREE.PlaneGeometry(1.1, 1.1)), am, 0, 0.03);
          a.rotation.x = -Math.PI / 2;
          a.rotation.z = Math.PI;
          g.add(a);
        } else {
          const r2 = this.m(this.geo('blobG', () => new THREE.CircleGeometry(1, 12)), this.mat('rustM', () => new THREE.MeshBasicMaterial({ color: '#6d3a1c', transparent: true, opacity: 0.35, depthWrite: false })), 0, 0.03);
          r2.rotation.x = -Math.PI / 2;
          r2.scale.setScalar(0.4 + Math.random() * 0.5);
          g.add(r2);
        }
        break;
      }
      case 'grassGreen':
      case 'grassDry': {
        const colors = key === 'grassGreen' ? ['#3d8a4a', '#5aa855', '#2f7a3d'] : ['#b0a060', '#9a8a4d', '#c4b070'];
        const coneG = this.geo('grassG', () => new THREE.ConeGeometry(0.05, 0.5, 4));
        for (let i = 0; i < 5; i++) {
          const color = colors[Math.floor(Math.random() * colors.length)];
          const gm = this.mat(`grM:${color}`, () => new THREE.MeshLambertMaterial({ color }));
          const blade = this.m(coneG, gm, (Math.random() - 0.5) * 0.8, 0.22, (Math.random() - 0.5) * 0.6);
          blade.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
          blade.scale.setScalar(0.7 + Math.random() * 0.7);
          g.add(blade);
        }
        break;
      }
      default: {
        // placas por categoria: sp:epi / sp:proib / sp:emerg / sp:oper
        if (key.startsWith('sp:')) {
          const style = key.slice(3);
          const SETS: Record<string, { texts: string[]; bg: string; fg: string }> = {
            epi: { texts: ['USE EPI', 'PEDESTRE\nPELA FAIXA', 'CAMINHO\nSEGURO', 'PASSARELA\nOBRIGATÓRIA'], bg: '#2F80ED', fg: '#ffffff' },
            proib: { texts: ['ACESSO\nRESTRITO', 'NÃO\nULTRAPASSE', 'ÁREA\nISOLADA'], bg: '#f2f2f2', fg: '#C0392B' },
            emerg: { texts: ['ROTA DE\nFUGA', 'PONTO DE\nENCONTRO', 'EXTINTOR'], bg: '#2f9e44', fg: '#ffffff' },
            oper: { texts: ['CT-01', 'BRITAGEM', 'OFICINA', 'TAG 2012'], bg: '#5f6670', fg: '#ffd23f' },
          };
          const set = SETS[style] ?? SETS.oper;
          const text = set.texts[Math.floor(Math.random() * set.texts.length)];
          const dark = lam('pDark', { color: '#3a3f47' });
          g.add(this.m(this.geo('spPole', () => new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6)), dark, 0, 1.15));
          const pm = this.mat(`spm:${style}:${text}`, () => new THREE.MeshBasicMaterial({ map: texSign(text, set.bg, set.fg, set.fg) }));
          g.add(this.m(this.geo('spPlate', () => new THREE.BoxGeometry(0.95, 0.95, 0.05)), pm, 0, 2.5));
          break;
        }
        // coadjuvantes: npc:<função> — sempre atrás de barreira (GDD)
        if (key.startsWith('npc:')) {
          this.buildNpc(key.slice(4), g);
          break;
        }
        break;
      }
    }
    return g;
  }

  /** trabalhador coadjuvante estilizado com rosto simples, EPI e barreira à frente */
  private buildNpc(role: string, g: THREE.Group) {
    const cfg: Record<string, { helmet: string; suit: string; vest: string }> = {
      sinalizador: { helmet: '#f2b705', suit: '#2e5d8f', vest: '#ff8c1a' },
      tecnica: { helmet: '#f5f5f5', suit: '#1f8a7d', vest: '#ffd23f' },
      mecanico: { helmet: '#5b6570', suit: '#4a4f57', vest: '#ff8c1a' },
      brigadista: { helmet: '#d63a2f', suit: '#3a3f47', vest: '#ff5a3c' },
      ambiental: { helmet: '#2f9e44', suit: '#2b6a4d', vest: '#b7f34d' },
      geologo: { helmet: '#ff8c1a', suit: '#b0895a', vest: '#ffd23f' },
    };
    const c = cfg[role] ?? cfg.sinalizador;
    const mSuit = this.mat(`nSuit:${c.suit}`, () => new THREE.MeshLambertMaterial({ color: c.suit }));
    const mVest = this.mat(`nVest:${c.vest}`, () => new THREE.MeshLambertMaterial({ color: c.vest, emissive: c.vest, emissiveIntensity: 0.15 }));
    const mHelm = this.mat(`nHelm:${c.helmet}`, () => new THREE.MeshLambertMaterial({ color: c.helmet }));
    const mSkin = this.mat('nSkin', () => new THREE.MeshLambertMaterial({ color: '#c98d5e' }));
    const mDark = this.mat('pDark2', () => new THREE.MeshLambertMaterial({ color: '#2b2f36' }));
    const mStripe = this.mat('nStripe', () => new THREE.MeshLambertMaterial({ color: '#f5f7f8', emissive: '#cfd8de', emissiveIntensity: 0.5 }));

    g.add(this.m(this.geo('nLegs', () => new THREE.BoxGeometry(0.3, 0.46, 0.2)), mDark, 0, 0.23));
    g.add(this.m(this.geo('nTorso', () => new THREE.BoxGeometry(0.38, 0.42, 0.22)), mSuit, 0, 0.67));
    g.add(this.m(this.geo('nVestG', () => new THREE.BoxGeometry(0.42, 0.3, 0.26)), mVest, 0, 0.7));
    g.add(this.m(this.geo('nStripeG', () => new THREE.BoxGeometry(0.43, 0.05, 0.27)), mStripe, 0, 0.72));

    const mkArm = (side: number, name: string) => {
      const a = new THREE.Group();
      a.name = name;
      a.position.set(0.25 * side, 0.85, 0);
      a.add(this.m(this.geo('nArm', () => new THREE.BoxGeometry(0.11, 0.36, 0.13)), mSuit, 0, -0.16));
      g.add(a);
      return a;
    };
    const armL = mkArm(-1, 'armL');
    const armR = mkArm(1, 'armR');

    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = 1.08;
    g.add(head);
    head.add(this.m(this.geo('nHead', () => new THREE.BoxGeometry(0.27, 0.26, 0.26)), mSkin, 0, 0));
    // olhos simples (GDD: nada de rosto vazio)
    for (const ex of [-0.06, 0.06]) {
      head.add(this.m(this.geo('nEye', () => new THREE.BoxGeometry(0.035, 0.04, 0.02)), mDark, ex, 0.02, 0.13));
    }
    head.add(this.m(this.geo('nDome', () => new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), mHelm, 0, 0.1));
    head.add(this.m(this.geo('nBrim', () => new THREE.CylinderGeometry(0.21, 0.22, 0.03, 12)), mHelm, 0, 0.1));

    // acessório por função
    if (role === 'sinalizador') {
      const baton = this.m(this.geo('nBaton', () => new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6)), this.mat('nBatonM', () => new THREE.MeshBasicMaterial({ color: '#ff8c1a' })), 0, -0.4);
      armR.add(baton);
    } else if (role === 'tecnica') {
      armL.add(this.m(this.geo('nBoard', () => new THREE.BoxGeometry(0.18, 0.24, 0.02)), this.mat('nBoardM', () => new THREE.MeshLambertMaterial({ color: '#eef2f5' })), 0, -0.36, 0.08));
    } else if (role === 'mecanico') {
      armR.add(this.m(this.geo('nTool', () => new THREE.BoxGeometry(0.06, 0.26, 0.05)), mDark, 0, -0.4));
    } else if (role === 'brigadista') {
      g.add(this.m(this.geo('nExt', () => new THREE.CylinderGeometry(0.07, 0.07, 0.26, 8)), this.mat('nExtM', () => new THREE.MeshLambertMaterial({ color: '#d63a2f' })), 0.12, 0.66, -0.16));
    } else if (role === 'ambiental') {
      armL.add(this.m(this.geo('nBag', () => new THREE.BoxGeometry(0.14, 0.18, 0.1)), this.mat('nBagM', () => new THREE.MeshLambertMaterial({ color: '#2f9e44' })), 0, -0.38));
    } else if (role === 'geologo') {
      armR.add(this.m(this.geo('nHammer', () => new THREE.BoxGeometry(0.16, 0.06, 0.06)), mDark, 0, -0.4));
    }

    // barreira de proteção à frente (NPC nunca "solto" perto da pista)
    const railM = this.mat('pYellow', () => new THREE.MeshLambertMaterial({ color: '#f2b705' }));
    const postM = this.mat('pMetal2', () => new THREE.MeshLambertMaterial({ map: texMetal('#5f6670') }));
    for (const px of [-0.8, 0.8]) {
      g.add(this.m(this.geo('nPost', () => new THREE.BoxGeometry(0.08, 1.0, 0.08)), postM, px, 0.5, 0.7));
    }
    g.add(this.m(this.geo('nBar', () => new THREE.BoxGeometry(1.7, 0.07, 0.07)), railM, 0, 0.95, 0.7));
    g.add(this.m(this.geo('nBar', () => new THREE.BoxGeometry(1.7, 0.07, 0.07)), railM, 0, 0.55, 0.7));

    // sombra falsa (ancora o NPC no chão)
    const blob = this.m(this.geo('blobG', () => new THREE.CircleGeometry(1, 12)), this.mat('blobM', () => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false })), 0, 0.015);
    blob.rotation.x = -Math.PI / 2;
    blob.scale.setScalar(0.55);
    g.add(blob);
  }

  dispose() {
    this.clearProps();
    this.scene.remove(this.group);
    this.pm.forEach((m) => m.dispose());
    this.pg.forEach((g) => g.dispose());
    (this.sky.geometry as THREE.BufferGeometry).dispose();
    this.skyMat.dispose();
    this.ground.geometry.dispose();
    this.groundMat.dispose();
    this.track.geometry.dispose();
    this.trackMat.dispose();
  }
}
