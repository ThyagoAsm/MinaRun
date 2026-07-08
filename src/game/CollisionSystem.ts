import type { CrashCause } from '../state/types';
import { LANE_X, type Chunk, type ProceduralMap, type RunItem, type RunObstacle, type RunZone } from './ProceduralMap';
import type { PlayerController } from './PlayerController';

// ============================================================
// Colisão AABB previsível com tolerâncias "justas":
// hitbox do jogador menor que o visual + folga nas laterais.
// ============================================================

export interface CollisionEvents {
  onCrash(cause: CrashCause): void;
  onPickup(item: RunItem): void;
  onZoneEnter(zone: RunZone): void;
  onZoneExit(zone: RunZone): void;
  onZoneAvoided(zone: RunZone): void;
  onNearMiss(ob: RunObstacle): void;
  onDodgeMoving(ob: RunObstacle): void;
  onIsolationRespected(): void;
}

const EPS = 0.05;

export class CollisionSystem {
  /** invulnerabilidade breve após o escudo absorver impacto */
  invulnT = 0;

  reset() {
    this.invulnT = 0;
  }

  update(dt: number, map: ProceduralMap, player: PlayerController, magnet: boolean, ev: CollisionEvents) {
    if (this.invulnT > 0) this.invulnT -= dt;
    const px = player.x;
    const pLow = player.baseY;
    const pHigh = player.baseY + player.halfH * 2;
    const pHalfW = player.halfW;
    const pHalfD = player.halfD;
    const pickY = player.baseY + 1.0;

    for (const chunk of map.chunks) {
      const rz = chunk.root.position.z;
      if (rz < -(chunk.len + 30) || rz - chunk.len > 30) continue;

      // ---------- obstáculos ----------
      for (const ob of chunk.obstacles) {
        const wz = rz + ob.z;
        // contabiliza desvio/quase-acidente quando o obstáculo passa
        if (!ob.dodged && wz > 1.6) {
          ob.dodged = true;
          if (ob.active !== false && player.anim !== 'crash') {
            if (ob.moving) ev.onDodgeMoving(ob);
            if (ob.cause === 'isolamento') ev.onIsolationRespected();
            const cx = LANE_X[ob.lane] + ob.xOffset;
            const sameLane = Math.abs(px - cx) < ob.halfX + 0.5;
            if (sameLane && (ob.kind === 'low' || ob.kind === 'over')) ev.onNearMiss(ob);
          }
          continue;
        }
        if (!ob.active || wz > 2.5 || wz < -3.5) continue;
        const cx = LANE_X[ob.lane] + ob.xOffset;
        if (Math.abs(px - cx) >= pHalfW + ob.halfX - EPS) continue;
        if (Math.abs(wz) >= pHalfD + ob.halfZ - EPS) continue;
        const oLow = ob.yBase;
        const oHigh = ob.yBase + ob.halfY * 2;
        if (pLow < oHigh - EPS && pHigh > oLow + EPS) {
          if (this.invulnT > 0) continue;
          ev.onCrash(ob.cause);
          return;
        }
      }

      // ---------- zonas ----------
      for (const zone of chunk.zones) {
        const wz = rz + zone.z;
        const inLane = zone.lane === -1 || Math.abs(px - LANE_X[zone.lane]) < 1.15;
        const insideZ = Math.abs(wz) < zone.halfZ;
        const inside = insideZ && inLane;
        if (inside && !zone.entered) {
          zone.entered = true;
          zone.resolved = true;
          ev.onZoneEnter(zone);
        } else if (!insideZ && zone.entered) {
          zone.entered = false;
          ev.onZoneExit(zone);
        }
        if (!zone.resolved && wz > zone.halfZ + 1.5) {
          zone.resolved = true;
          ev.onZoneAvoided(zone);
        }
      }

      // ---------- itens ----------
      for (const it of chunk.items) {
        if (it.taken) continue;
        const wz = rz + it.z;
        if (magnet && it.kind === 'coin' && wz > -13 && wz < 0.5) {
          it.magnet = true;
        }
        if (it.magnet) {
          it.x += (px - it.x) * Math.min(1, dt * 9);
          it.mesh.position.x = it.x;
          if (it.spin) it.spin.position.y += (1.0 - it.spin.position.y) * Math.min(1, dt * 9);
        }
        const reach = it.magnet ? 1.5 : 0.95;
        if (Math.abs(wz) > (it.magnet ? 1.6 : 1.0)) continue;
        if (Math.abs(px - it.x) > reach) continue;
        const itemY = it.spin ? it.spin.position.y : it.y;
        if (Math.abs(itemY - pickY) > 1.05) continue;
        it.taken = true;
        it.mesh.visible = false;
        ev.onPickup(it);
      }
    }
  }

  /** varre se alguma zona do tipo continua sob o jogador (pós-reset de efeito) */
  playerInsideZone(map: ProceduralMap, player: PlayerController, kind: RunZone['kind']): boolean {
    for (const chunk of map.chunks) {
      const rz = chunk.root.position.z;
      for (const zone of chunk.zones) {
        if (zone.kind !== kind) continue;
        const wz = rz + zone.z;
        const inLane = zone.lane === -1 || Math.abs(player.x - LANE_X[zone.lane]) < 1.15;
        if (Math.abs(wz) < zone.halfZ && inLane) return true;
      }
    }
    return false;
  }
}

export type { Chunk };
