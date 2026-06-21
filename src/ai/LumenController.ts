import * as THREE from 'three';

type LumenAgent = {
  group: THREE.Group;
  tendrils: THREE.Object3D[];
  waypoints: THREE.Vector3[];
  targetIndex: number;
  currentTarget: THREE.Vector3;
  indirectScore: number;
  directScore: number;
  mode: 'patrol' | 'hunt-isaac' | 'seek-light' | 'seek-probe';
  stuckSeconds: number;
};

export type LumenAttractionTarget = {
  label: 'isaac' | 'neon' | 'console';
  position: THREE.Vector3;
  score: number;
  indirect: number;
  direct: number;
};

export type LumenProbeTarget = {
  position: THREE.Vector3;
  score: number;
  indirect: number;
  direct: number;
};

const CONTACT_RADIUS = 0.85;
const LUMEN_RADIUS = 0.45;
const PATROL_SPEED = 2.2;
const LIGHT_SEEK_THRESHOLD = 0.45;
const WAYPOINT_REACHED_DISTANCE = 0.35;
const STUCK_DISTANCE_EPSILON = 0.015;
const STUCK_TIMEOUT_SECONDS = 1.2;

const lumenMaterial = new THREE.MeshStandardMaterial({
  color: 0x90ffb8,
  emissive: 0x2aff70,
  emissiveIntensity: 0.85,
  roughness: 0.35,
});

export class LumenController {
  readonly group = new THREE.Group();

  private readonly agents: LumenAgent[] = [];
  private readonly roamRoute = [
    new THREE.Vector3(-27.0, 0, -17.0),
    new THREE.Vector3(-22.0, 0, -17.0),
    new THREE.Vector3(-16.0, 0, -14.0),
    new THREE.Vector3(-13.0, 0, -5.0),
    new THREE.Vector3(-18.0, 0, -1.8),
    new THREE.Vector3(-26.0, 0, 4.8),
    new THREE.Vector3(-26.0, 0, 16.0),
    new THREE.Vector3(-16.0, 0, 16.0),
    new THREE.Vector3(-13.0, 0, 11.5),
    new THREE.Vector3(-6.0, 0, 12.8),
    new THREE.Vector3(-4.0, 0, 16.5),
    new THREE.Vector3(3.0, 0, 15.5),
    new THREE.Vector3(6.5, 0, 12.8),
    new THREE.Vector3(4.0, 0, 6.0),
    new THREE.Vector3(1.2, 0, 1.8),
    new THREE.Vector3(-1.5, 0, -3.0),
    new THREE.Vector3(-4.0, 0, -8.5),
    new THREE.Vector3(-4.0, 0, -17.0),
    new THREE.Vector3(4.0, 0, -17.0),
    new THREE.Vector3(6.4, 0, -8.5),
    new THREE.Vector3(14.0, 0, -8.0),
    new THREE.Vector3(16.0, 0, -17.0),
    new THREE.Vector3(26.0, 0, -17.0),
    new THREE.Vector3(25.5, 0, -4.2),
    new THREE.Vector3(15.0, 0, -3.0),
    new THREE.Vector3(13.0, 0, 4.8),
    new THREE.Vector3(16.0, 0, 13.0),
    new THREE.Vector3(26.0, 0, 16.0),
    new THREE.Vector3(25.5, 0, 4.5),
    new THREE.Vector3(13.2, 0, 1.2),
    new THREE.Vector3(6.0, 0, 1.8),
  ];

  constructor() {
    this.group.name = 'LumenController';
    this.agents.push(
      this.createAgent(new THREE.Vector3(-24.0, 0, 14.0), 6),
      this.createAgent(new THREE.Vector3(-4.0, 0, -14.0), 17),
      this.createAgent(new THREE.Vector3(14.0, 0, 12.5), 26),
      this.createAgent(new THREE.Vector3(24.5, 0, -15.0), 22),
      this.createAgent(new THREE.Vector3(25.0, 0, 14.5), 28),
      this.createAgent(new THREE.Vector3(-22.5, 0, -14.8), 1),
      this.createAgent(new THREE.Vector3(-25.5, 0, 5.5), 5),
      this.createAgent(new THREE.Vector3(-15.0, 0, 15.0), 7),
      this.createAgent(new THREE.Vector3(-13.5, 0, -4.6), 3),
      this.createAgent(new THREE.Vector3(3.5, 0, 15.0), 11),
    );
  }

  update(
    deltaSeconds: number,
    elapsedSeconds: number,
    playerPosition: THREE.Vector3,
    visibleLightTargets: (lumen: THREE.Group) => LumenAttractionTarget[],
    strongestVisibleProbe: (lumen: THREE.Group) => LumenProbeTarget | null,
    isWalkable: (x: number, z: number, radius: number) => boolean,
  ) {
    let playerCaught = false;

    for (const agent of this.agents) {
      this.updateTarget(agent, visibleLightTargets, strongestVisibleProbe);
      this.moveTowardTarget(agent, deltaSeconds, isWalkable);
      agent.group.position.y = Math.sin(elapsedSeconds * 1.7 + agent.targetIndex) * 0.16;
      agent.group.rotation.y = elapsedSeconds * 0.7;
      this.animateLumenBody(agent, elapsedSeconds);

      if (agent.group.position.distanceTo(playerPosition) <= CONTACT_RADIUS) {
        playerCaught = true;
      }
    }

    return playerCaught;
  }

  getDebugText() {
    const strongest = this.agents.reduce(
      (best, agent) => (agent.indirectScore > best.indirectScore ? agent : best),
      this.agents[0],
    );

    return `Lumen ${strongest.mode} · global target · indirect ${strongest.indirectScore.toFixed(2)} · direct ${strongest.directScore.toFixed(2)}`;
  }

  private updateTarget(
    agent: LumenAgent,
    visibleLightTargets: (lumen: THREE.Group) => LumenAttractionTarget[],
    strongestVisibleProbe: (lumen: THREE.Group) => LumenProbeTarget | null,
  ) {
    const strongestTarget = this.findStrongestTarget(visibleLightTargets(agent.group));

    if (strongestTarget && strongestTarget.score >= LIGHT_SEEK_THRESHOLD) {
      agent.currentTarget = strongestTarget.position.clone();
      agent.indirectScore = strongestTarget.indirect;
      agent.directScore = strongestTarget.direct;
      agent.mode = strongestTarget.label === 'isaac' ? 'hunt-isaac' : 'seek-light';
      return;
    }

    const probeTarget = strongestVisibleProbe(agent.group);
    if (probeTarget && probeTarget.score >= LIGHT_SEEK_THRESHOLD) {
      agent.currentTarget = probeTarget.position.clone();
      agent.indirectScore = probeTarget.indirect;
      agent.directScore = probeTarget.direct;
      agent.mode = 'seek-probe';
      return;
    }

    agent.currentTarget = agent.waypoints[agent.targetIndex];
    agent.indirectScore = 0;
    agent.directScore = 0;
    agent.mode = 'patrol';
  }

  private findStrongestTarget(attractionTargets: LumenAttractionTarget[]) {
    let bestTarget: LumenAttractionTarget | null = null;

    for (const target of attractionTargets) {
      if (!bestTarget || target.score > bestTarget.score) {
        bestTarget = target;
      }
    }

    return bestTarget;
  }

  private moveTowardTarget(
    agent: LumenAgent,
    deltaSeconds: number,
    isWalkable: (x: number, z: number, radius: number) => boolean,
  ) {
    const target = agent.currentTarget;
    const waypointTarget = agent.waypoints[agent.targetIndex];
    const isPatrolling = target === waypointTarget;

    const offset = agent.currentTarget.clone().sub(agent.group.position);
    offset.y = 0;

    const distance = offset.length();

    if (distance < WAYPOINT_REACHED_DISTANCE) {
      if (isPatrolling) {
        this.advancePatrolTarget(agent);
      }
      return;
    }

    const movement = offset.normalize().multiplyScalar(PATROL_SPEED * deltaSeconds);
    const previousPosition = agent.group.position.clone();
    this.tryMove(agent, movement.x, 0, isWalkable);
    this.tryMove(agent, 0, movement.z, isWalkable);

    if (!isPatrolling) {
      return;
    }

    const movedDistance = previousPosition.distanceTo(agent.group.position);
    if (movedDistance < STUCK_DISTANCE_EPSILON) {
      agent.stuckSeconds += deltaSeconds;
      if (agent.stuckSeconds >= STUCK_TIMEOUT_SECONDS) {
        this.advancePatrolTarget(agent);
      }
      return;
    }

    agent.stuckSeconds = 0;
  }

  private advancePatrolTarget(agent: LumenAgent) {
    agent.targetIndex = (agent.targetIndex + 1) % agent.waypoints.length;
    agent.currentTarget = agent.waypoints[agent.targetIndex];
    agent.stuckSeconds = 0;
  }

  private tryMove(
    agent: LumenAgent,
    dx: number,
    dz: number,
    isWalkable: (x: number, z: number, radius: number) => boolean,
  ) {
    const nextX = agent.group.position.x + dx;
    const nextZ = agent.group.position.z + dz;

    if (isWalkable(nextX, nextZ, LUMEN_RADIUS)) {
      agent.group.position.x = nextX;
      agent.group.position.z = nextZ;
    }
  }

  private createAgent(spawnPosition: THREE.Vector3, startIndex: number): LumenAgent {
    const waypoints = this.createRoamWaypoints(startIndex);
    const group = new THREE.Group();
    group.name = 'Lumen';
    group.position.copy(spawnPosition);

    const tendrils = this.createAlienBody(group);

    const light = new THREE.PointLight(0x2aff70, 4, 4, 2);
    light.position.set(0, 0.9, 0);
    group.add(light);

    this.group.add(group);

    return {
      group,
      tendrils,
      waypoints,
      targetIndex: 1,
      currentTarget: waypoints[1],
      indirectScore: 0,
      directScore: 0,
      mode: 'patrol',
      stuckSeconds: 0,
    };
  }

  private createAlienBody(group: THREE.Group) {
    const tendrils: THREE.Object3D[] = [];

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 28, 16),
      lumenMaterial,
    );
    core.name = 'LumenCore';
    core.position.y = 0.76;
    core.scale.set(1.05, 0.82, 1.18);
    group.add(core);

    const membrane = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 28, 16),
      new THREE.MeshStandardMaterial({
        color: 0x7effc5,
        emissive: 0x1cff75,
        emissiveIntensity: 0.35,
        roughness: 0.22,
        metalness: 0.05,
        transparent: true,
        opacity: 0.34,
      }),
    );
    membrane.name = 'LumenMembrane';
    membrane.position.y = 0.76;
    membrane.scale.set(1.05, 0.78, 1.2);
    group.add(membrane);

    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x06140a,
      emissive: 0xb8ffd1,
      emissiveIntensity: 0.3,
      roughness: 0.18,
    });

    for (const x of [-0.16, 0.16]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), eyeMaterial);
      eye.position.set(x, 0.9, -0.46);
      eye.scale.set(1, 0.85, 0.55);
      group.add(eye);
    }

    const crestMaterial = new THREE.MeshStandardMaterial({
      color: 0xc8ffd8,
      emissive: 0x50ff90,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });

    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.3, 8),
        crestMaterial,
      );
      spike.position.set(Math.sin(angle) * 0.32, 1.1, Math.cos(angle) * 0.32);
      spike.rotation.z = Math.sin(angle) * 0.45;
      spike.rotation.x = -Math.cos(angle) * 0.45;
      group.add(spike);
      tendrils.push(spike);
    }

    const tendrilMaterial = new THREE.MeshStandardMaterial({
      color: 0x45f48c,
      emissive: 0x12bb55,
      emissiveIntensity: 0.62,
      roughness: 0.34,
      metalness: 0.02,
    });

    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const tendril = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.055, 0.54, 5, 8),
        tendrilMaterial,
      );
      tendril.name = 'LumenTendril';
      tendril.position.set(Math.sin(angle) * 0.38, 0.34, Math.cos(angle) * 0.38);
      tendril.rotation.z = Math.sin(angle) * 0.85;
      tendril.rotation.x = Math.cos(angle) * 0.85;
      group.add(tendril);
      tendrils.push(tendril);
    }

    const underGlow = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.025, 8, 32),
      new THREE.MeshBasicMaterial({
        color: 0x52ff91,
        transparent: true,
        opacity: 0.58,
      }),
    );
    underGlow.name = 'LumenUnderGlow';
    underGlow.position.y = 0.28;
    underGlow.rotation.x = Math.PI / 2;
    group.add(underGlow);
    tendrils.push(underGlow);

    return tendrils;
  }

  private animateLumenBody(agent: LumenAgent, elapsedSeconds: number) {
    agent.tendrils.forEach((part, index) => {
      const phase = elapsedSeconds * 2.3 + index * 0.9;
      part.rotation.y = Math.sin(phase) * 0.28;
      part.scale.y = 1 + Math.sin(phase + 0.6) * 0.08;
    });
  }

  private createRoamWaypoints(startIndex: number) {
    return this.roamRoute.map((_, index) =>
      this.roamRoute[(startIndex + index) % this.roamRoute.length].clone(),
    );
  }
}
