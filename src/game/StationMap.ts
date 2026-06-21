import * as THREE from 'three';
import { DirectLightSample } from '../gi/DDGIManager';
import { Bounds2D, intersectsCircleAabb } from './math';

type WallSpec = {
  center: [number, number];
  size: [number, number];
};

type PropSpec = {
  position: [number, number];
  size: [number, number, number];
  color: number;
};

const WALL_HEIGHT = 2.4;
const WALL_THICKNESS = 0.35;
const DARK_SURFACE_MULTIPLIER = 0.055;
const wallEdgeMaterial = new THREE.LineBasicMaterial({
  color: 0x7890a0,
  transparent: true,
  opacity: 0.72,
});

const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x29313c,
  roughness: 0.82,
  metalness: 0.18,
});

const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x171d25,
  roughness: 0.74,
  metalness: 0.12,
});

const trimMaterial = new THREE.MeshStandardMaterial({
  color: 0x3a4652,
  roughness: 0.55,
  metalness: 0.35,
});

export class StationMap {
  readonly group = new THREE.Group();
  readonly colliders: Bounds2D[] = [];
  readonly bounds: Bounds2D = {
    minX: -30,
    maxX: 30,
    minZ: -20,
    maxZ: 20,
  };
  private readonly indirectVisibleProps: THREE.Mesh<
    THREE.BoxGeometry,
    THREE.MeshStandardMaterial
  >[] = [];
  private readonly lightReactiveMeshes: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >[] = [];
  private readonly visibilityRaycaster = new THREE.Raycaster();
  private floatingProp: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> | null = null;
  private readonly floatingPropHome = new THREE.Vector3();

  constructor() {
    this.group.name = 'StationMap';
    this.createFloors();
    this.createWalls();
    this.createProps();
    this.createFacilities();
    this.createLabels();
  }

  isWalkable(x: number, z: number, radius: number) {
    if (
      x - radius < this.bounds.minX ||
      x + radius > this.bounds.maxX ||
      z - radius < this.bounds.minZ ||
      z + radius > this.bounds.maxZ
    ) {
      return false;
    }

    return !this.colliders.some((collider) =>
      intersectsCircleAabb(x, z, radius, collider),
    );
  }

  private createFloors() {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(60, 0.25, 40),
      floorMaterial,
    );
    floor.position.y = -0.125;
    floor.receiveShadow = true;
    floor.material = floor.material.clone();
    floor.material.color.multiplyScalar(DARK_SURFACE_MULTIPLIER);
    this.group.add(floor);

    const zoneSpecs: PropSpec[] = [
      { position: [-23, -14], size: [12, 0.03, 9], color: 0x202b39 },
      { position: [-22, 11], size: [13, 0.03, 11], color: 0x1d2733 },
      { position: [-3, -13], size: [15, 0.035, 9], color: 0x222a32 },
      { position: [1, 2], size: [16, 0.03, 10], color: 0x1b2530 },
      { position: [18, -13], size: [14, 0.03, 10], color: 0x202832 },
      { position: [22, 11], size: [13, 0.03, 12], color: 0x1f2a34 },
    ];

    zoneSpecs.forEach((zone) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(zone.size[0], zone.size[1], zone.size[2]),
        new THREE.MeshStandardMaterial({
          color: zone.color,
          roughness: 0.8,
          metalness: 0.1,
        }),
      );
      mesh.position.set(zone.position[0], 0.02, zone.position[1]);
      mesh.receiveShadow = true;
      mesh.material.color.multiplyScalar(DARK_SURFACE_MULTIPLIER);
      this.group.add(mesh);
    });
  }

  private createWalls() {
    const walls: WallSpec[] = [
      { center: [0, -20.25], size: [60, WALL_THICKNESS] },
      { center: [0, 20.25], size: [60, WALL_THICKNESS] },
      { center: [-30.25, 0], size: [WALL_THICKNESS, 40] },
      { center: [30.25, 0], size: [WALL_THICKNESS, 40] },
      { center: [-20, -11.2], size: [WALL_THICKNESS, 11.0] },
      { center: [-20, 8.9], size: [WALL_THICKNESS, 12.2] },
      { center: [-10, -15.8], size: [WALL_THICKNESS, 8.4] },
      { center: [-10, 0.2], size: [WALL_THICKNESS, 10.7] },
      { center: [-10, 16.4], size: [WALL_THICKNESS, 7.2] },
      { center: [0, -10.9], size: [WALL_THICKNESS, 10.1] },
      { center: [0, 9.2], size: [WALL_THICKNESS, 10.0] },
      { center: [10, -15.1], size: [WALL_THICKNESS, 9.7] },
      { center: [10, 2.6], size: [WALL_THICKNESS, 10.5] },
      { center: [10, 17.6], size: [WALL_THICKNESS, 5.1] },
      { center: [20, -12.3], size: [WALL_THICKNESS, 10.2] },
      { center: [20, 6.7], size: [WALL_THICKNESS, 11.4] },
      { center: [-27.1, -12], size: [6.0, WALL_THICKNESS] },
      { center: [-10.0, -12], size: [14.2, WALL_THICKNESS] },
      { center: [10.4, -12], size: [11.0, WALL_THICKNESS] },
      { center: [26.5, -12], size: [7.0, WALL_THICKNESS] },
      { center: [-25.2, 0], size: [9.8, WALL_THICKNESS] },
      { center: [-8.5, 0], size: [8.9, WALL_THICKNESS] },
      { center: [7.5, 0], size: [7.2, WALL_THICKNESS] },
      { center: [23.0, 0], size: [14.1, WALL_THICKNESS] },
      { center: [-25.6, 10], size: [8.8, WALL_THICKNESS] },
      { center: [-8.0, 10], size: [12.2, WALL_THICKNESS] },
      { center: [12.1, 10], size: [12.4, WALL_THICKNESS] },
      { center: [27.0, 10], size: [6.4, WALL_THICKNESS] },
    ];

    walls.forEach((wall) => this.addWall(wall));
  }

  private createProps() {
    const props: PropSpec[] = [
      { position: [-17.0, -15.2], size: [2.1, 0.7, 0.9], color: 0x2e7b86 },
      { position: [-23.5, -5.3], size: [1.4, 1.0, 1.1], color: 0x59616c },
      { position: [-27.2, 14.5], size: [1.8, 1.1, 1.0], color: 0x384552 },
      { position: [-15.8, 15.0], size: [1.3, 1.3, 1.6], color: 0x46515a },
      { position: [-4.2, -16.7], size: [1.6, 0.9, 1.3], color: 0x4a5864 },
      { position: [3.5, -17.2], size: [2.3, 0.8, 1.0], color: 0x344452 },
      { position: [-4.8, -4.4], size: [1.2, 1.5, 1.2], color: 0x58636f },
      { position: [4.4, -4.7], size: [1.5, 1.0, 1.7], color: 0x3d4c58 },
      { position: [-4.1, 5.2], size: [2.1, 0.8, 1.0], color: 0x2f6f7d },
      { position: [5.6, 6.6], size: [1.4, 1.2, 1.4], color: 0x535f6b },
      { position: [16.2, -16.2], size: [2.2, 0.9, 1.1], color: 0x3a4752 },
      { position: [25.8, -15.0], size: [1.4, 1.4, 1.4], color: 0x46515a },
      { position: [15.5, -4.7], size: [1.6, 1.1, 1.1], color: 0x52606c },
      { position: [26.0, -4.6], size: [2.0, 0.8, 1.2], color: 0x314b58 },
      { position: [16.2, 14.0], size: [1.5, 1.0, 1.7], color: 0x4a5660 },
      { position: [25.4, 15.4], size: [1.3, 1.3, 1.2], color: 0x5d6670 },
      { position: [23.2, 4.5], size: [2.4, 0.9, 1.0], color: 0x384552 },
    ];

    props.forEach((prop) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(prop.size[0], prop.size[1], prop.size[2]),
        new THREE.MeshStandardMaterial({
          color: prop.color,
          emissive: 0x000000,
          emissiveIntensity: 0,
          roughness: 0.68,
          metalness: 0.22,
        }),
      );
      mesh.position.set(prop.position[0], prop.size[1] / 2, prop.position[1]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.registerLightReactiveMesh(mesh);
      this.group.add(mesh);
      this.indirectVisibleProps.push(mesh);
      this.colliders.push({
        minX: prop.position[0] - prop.size[0] / 2,
        maxX: prop.position[0] + prop.size[0] / 2,
        minZ: prop.position[1] - prop.size[2] / 2,
        maxZ: prop.position[1] + prop.size[2] / 2,
      });
    });

    this.floatingProp = this.indirectVisibleProps[1] ?? null;
    if (this.floatingProp) {
      this.floatingPropHome.copy(this.floatingProp.position);
    }
  }

  private createFacilities() {
    this.addBunkBed(-24.5, 6.1, Math.PI / 2);
    this.addBunkBed(-17.0, 13.2, 0);
    this.addBunkBed(24.3, 13.2, 0);
    this.addConsoleBank(-25.2, -8.4, 0);
    this.addConsoleBank(-3.2, 7.2, Math.PI);
    this.addConsoleBank(22.6, -7.0, -Math.PI / 2);
    this.addStorageRack(-16.6, -6.1, Math.PI / 2);
    this.addStorageRack(6.4, -8.2, 0);
    this.addStorageRack(23.6, 6.8, Math.PI / 2);
    this.addOxygenTankCluster(-2.2, -6.6);
    this.addOxygenTankCluster(15.4, 6.4);
    this.addWorkTable(-15.2, 5.4, 0.2);
    this.addWorkTable(14.8, -4.4, -0.3);
    this.addMedicalPod(4.2, 15.8, -Math.PI / 2);
  }

  private addBunkBed(x: number, z: number, rotationY: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    const frame = this.createFacilityMesh(
      new THREE.BoxGeometry(2.15, 0.22, 0.95),
      0x56616c,
      [0, 0.38, 0],
      group,
    );
    frame.castShadow = true;

    this.createFacilityMesh(
      new THREE.BoxGeometry(1.85, 0.16, 0.78),
      0x27364a,
      [0, 0.58, 0],
      group,
    );
    this.createFacilityMesh(
      new THREE.BoxGeometry(0.42, 0.16, 0.72),
      0xb9c2cd,
      [-0.62, 0.73, 0],
      group,
    );
    this.createFacilityMesh(
      new THREE.BoxGeometry(2.15, 0.08, 0.08),
      0x8fa1ad,
      [0, 0.88, -0.5],
      group,
    );

    this.group.add(group);
    this.addRotatedCollider(x, z, 2.15, 0.95, rotationY);
  }

  private addConsoleBank(x: number, z: number, rotationY: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    this.createFacilityMesh(
      new THREE.BoxGeometry(1.8, 0.85, 0.55),
      0x29333f,
      [0, 0.43, 0],
      group,
    );
    this.createFacilityMesh(
      new THREE.BoxGeometry(1.45, 0.08, 0.38),
      0x3a9bb0,
      [0, 0.9, -0.06],
      group,
    );
    this.createFacilityMesh(
      new THREE.BoxGeometry(0.34, 0.06, 0.24),
      0x9d5cff,
      [-0.52, 0.96, -0.08],
      group,
    );
    this.createFacilityMesh(
      new THREE.BoxGeometry(0.34, 0.06, 0.24),
      0x82e6a8,
      [0.52, 0.96, -0.08],
      group,
    );

    this.group.add(group);
    this.addRotatedCollider(x, z, 1.8, 0.55, rotationY);
  }

  private addStorageRack(x: number, z: number, rotationY: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    this.createFacilityMesh(
      new THREE.BoxGeometry(1.8, 1.55, 0.42),
      0x364250,
      [0, 0.78, 0],
      group,
    );

    for (let i = 0; i < 3; i += 1) {
      this.createFacilityMesh(
        new THREE.BoxGeometry(1.62, 0.08, 0.5),
        0x8aa0ad,
        [0, 0.34 + i * 0.45, 0],
        group,
      );
    }

    this.createFacilityMesh(
      new THREE.BoxGeometry(0.42, 0.34, 0.34),
      0xa86c4b,
      [-0.48, 0.55, 0.02],
      group,
    );
    this.createFacilityMesh(
      new THREE.BoxGeometry(0.5, 0.3, 0.32),
      0x536b7a,
      [0.45, 1.0, 0.02],
      group,
    );

    this.group.add(group);
    this.addRotatedCollider(x, z, 1.8, 0.5, rotationY);
  }

  private addOxygenTankCluster(x: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    for (let i = 0; i < 3; i += 1) {
      const tank = this.createFacilityMesh(
        new THREE.CylinderGeometry(0.18, 0.18, 1.25, 14),
        i === 1 ? 0x6fb2c7 : 0x798895,
        [-0.38 + i * 0.38, 0.66, 0],
        group,
      );
      tank.rotation.z = Math.PI / 2;
    }

    this.createFacilityMesh(
      new THREE.BoxGeometry(1.35, 0.12, 0.32),
      0x2d3640,
      [0, 0.23, 0],
      group,
    );

    this.group.add(group);
    this.colliders.push({
      minX: x - 0.75,
      maxX: x + 0.75,
      minZ: z - 0.35,
      maxZ: z + 0.35,
    });
  }

  private addWorkTable(x: number, z: number, rotationY: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    this.createFacilityMesh(
      new THREE.BoxGeometry(1.75, 0.16, 0.95),
      0x67727d,
      [0, 0.72, 0],
      group,
    );

    for (const legX of [-0.72, 0.72]) {
      for (const legZ of [-0.34, 0.34]) {
        this.createFacilityMesh(
          new THREE.BoxGeometry(0.12, 0.68, 0.12),
          0x384451,
          [legX, 0.36, legZ],
          group,
        );
      }
    }

    this.createFacilityMesh(
      new THREE.BoxGeometry(0.52, 0.1, 0.34),
      0xd6d0a0,
      [-0.32, 0.86, 0.05],
      group,
    );
    this.createFacilityMesh(
      new THREE.BoxGeometry(0.34, 0.18, 0.28),
      0x4cbac5,
      [0.48, 0.9, -0.08],
      group,
    );

    this.group.add(group);
    this.addRotatedCollider(x, z, 1.75, 0.95, rotationY);
  }

  private addMedicalPod(x: number, z: number, rotationY: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    this.createFacilityMesh(
      new THREE.BoxGeometry(2.15, 0.5, 0.95),
      0x3d4957,
      [0, 0.35, 0],
      group,
    );
    this.createFacilityMesh(
      new THREE.BoxGeometry(1.75, 0.18, 0.62),
      0xc7d4dd,
      [0, 0.7, 0],
      group,
    );
    this.createFacilityMesh(
      new THREE.BoxGeometry(0.46, 0.08, 0.46),
      0xe15c6c,
      [0.72, 0.84, 0],
      group,
    );

    this.group.add(group);
    this.addRotatedCollider(x, z, 2.15, 0.95, rotationY);
  }

  private createFacilityMesh(
    geometry: THREE.BufferGeometry,
    color: number,
    position: [number, number, number],
    parent: THREE.Group,
  ) {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.66,
        metalness: 0.18,
      }),
    );
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.registerLightReactiveMesh(mesh);
    parent.add(mesh);
    return mesh;
  }

  private addRotatedCollider(
    x: number,
    z: number,
    width: number,
    depth: number,
    rotationY: number,
  ) {
    const cos = Math.abs(Math.cos(rotationY));
    const sin = Math.abs(Math.sin(rotationY));
    const rotatedWidth = width * cos + depth * sin;
    const rotatedDepth = width * sin + depth * cos;

    this.colliders.push({
      minX: x - rotatedWidth / 2,
      maxX: x + rotatedWidth / 2,
      minZ: z - rotatedDepth / 2,
      maxZ: z + rotatedDepth / 2,
    });
  }

  private createLabels() {
    const guideLight = new THREE.PointLight(0x5ac8ff, 18, 18, 1.8);
    guideLight.position.set(-23, 2.2, -14.5);
    this.group.add(guideLight);

    const reactorGlow = new THREE.PointLight(0xff4f8b, 9, 12, 1.6);
    reactorGlow.position.set(23, 2.2, 12.5);
    this.group.add(reactorGlow);
  }

  private addWall(wall: WallSpec) {
    const [width, depth] = wall.size;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, WALL_HEIGHT, depth),
      wallMaterial,
    );
    mesh.position.set(wall.center[0], WALL_HEIGHT / 2, wall.center[1]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.registerLightReactiveMesh(mesh);
    this.group.add(mesh);
    this.addWallEdges(mesh);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.05, 0.08, depth + 0.05),
      trimMaterial,
    );
    cap.position.set(wall.center[0], WALL_HEIGHT + 0.04, wall.center[1]);
    cap.castShadow = true;
    cap.receiveShadow = true;
    this.registerLightReactiveMesh(cap);
    this.group.add(cap);
    this.addWallEdges(cap);

    this.colliders.push({
      minX: wall.center[0] - width / 2,
      maxX: wall.center[0] + width / 2,
      minZ: wall.center[1] - depth / 2,
      maxZ: wall.center[1] + depth / 2,
    });
  }

  updateLightingVisibility(
    sampleIrradiance: (position: THREE.Vector3) => THREE.Vector3,
    directLights: DirectLightSample[],
    observerPosition?: THREE.Vector3,
    brightnessDebug = false,
  ) {
    for (const mesh of this.lightReactiveMeshes) {
      const worldPosition = mesh.getWorldPosition(new THREE.Vector3());
      const indirect = sampleIrradiance(worldPosition);
      const direct = this.computeDirectReveal(worldPosition, mesh, directLights);
      const observerVisibility = brightnessDebug
        ? 1
        : observerPosition
        ? Number(this.canObserverSeeMesh(observerPosition, worldPosition, mesh))
        : 1;
      const reveal = Math.max(
        brightnessDebug ? 0.78 : 0,
        THREE.MathUtils.clamp(
          indirect.length() * 0.5 + direct.length() * 0.08,
          0,
          1,
        ) * observerVisibility,
      );

      const baseColor = mesh.userData.baseColor as THREE.Color;
      const visibleColor = baseColor.clone().multiplyScalar(
        THREE.MathUtils.lerp(DARK_SURFACE_MULTIPLIER, 1, reveal),
      );
      mesh.material.color.copy(visibleColor);
      mesh.material.emissive.setHex(0x000000);
      mesh.material.emissiveIntensity = 0;
    }
  }

  updateIndirectVisibility(sampleIrradiance: (position: THREE.Vector3) => THREE.Vector3) {
    this.updateLightingVisibility(sampleIrradiance, []);
  }

  updateLowGravityProps(lowGravity: boolean, elapsedSeconds: number) {
    if (!this.floatingProp) return;

    if (lowGravity) {
      this.floatingProp.position.y = this.floatingPropHome.y + Math.sin(elapsedSeconds * 1.8) * 0.55;
      this.floatingProp.position.x = this.floatingPropHome.x + Math.sin(elapsedSeconds * 0.7) * 0.7;
      this.floatingProp.rotation.y = elapsedSeconds * 0.6;
    } else {
      this.floatingProp.position.y = 0.35;
      this.floatingProp.position.x = this.floatingPropHome.x;
      this.floatingProp.position.z = this.floatingPropHome.z;
      this.floatingProp.rotation.y = 0;
    }
  }

  private registerLightReactiveMesh(
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
  ) {
    mesh.material = mesh.material.clone();
    mesh.userData.baseColor = mesh.material.color.clone();
    mesh.material.color.multiplyScalar(DARK_SURFACE_MULTIPLIER);
    mesh.material.emissive.setHex(0x000000);
    mesh.material.emissiveIntensity = 0;
    this.lightReactiveMeshes.push(mesh);
  }

  private addWallEdges(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      wallEdgeMaterial,
    );
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    edges.scale.copy(mesh.scale);
    edges.renderOrder = 2;
    this.group.add(edges);
  }

  private computeDirectReveal(
    point: THREE.Vector3,
    targetMesh: THREE.Object3D,
    directLights: DirectLightSample[],
  ) {
    const result = new THREE.Vector3();

    for (const light of directLights) {
      if (light.intensity <= 0) continue;

      const fromLightToPoint = point.clone().sub(light.position);
      const distance = fromLightToPoint.length();
      if (distance <= 0.001 || distance > light.radius) continue;

      const direction = fromLightToPoint.normalize();
      let spotTerm = 1;

      if (light.direction && light.spotCosine !== undefined) {
        const coneDot = light.direction.dot(direction);
        if (coneDot < light.spotCosine) continue;
        spotTerm = THREE.MathUtils.smoothstep(coneDot, light.spotCosine, 1);
      }

      if (!this.canLightReachMesh(light.position, direction, distance, targetMesh)) {
        continue;
      }

      const attenuation = (light.intensity * spotTerm) / (1 + distance * distance * 0.16);
      result.add(
        new THREE.Vector3(light.color.r, light.color.g, light.color.b).multiplyScalar(
          attenuation,
        ),
      );
    }

    return result;
  }

  private canLightReachMesh(
    lightPosition: THREE.Vector3,
    direction: THREE.Vector3,
    distance: number,
    targetMesh: THREE.Object3D,
  ) {
    const origin = lightPosition.clone().addScaledVector(direction, 0.08);
    this.visibilityRaycaster.set(origin, direction);
    this.visibilityRaycaster.far = Math.max(distance + 0.08, 0.001);

    const hit = this.visibilityRaycaster.intersectObject(this.group, true)[0];
    return !hit || hit.object === targetMesh || this.isDescendantOf(hit.object, targetMesh);
  }

  private canObserverSeeMesh(
    observerPosition: THREE.Vector3,
    targetPosition: THREE.Vector3,
    targetMesh: THREE.Object3D,
  ) {
    const origin = observerPosition.clone().add(new THREE.Vector3(0, 0.75, 0));
    const target = targetPosition.clone();
    target.y = Math.max(target.y, 0.35);
    const toTarget = target.sub(origin);
    const distance = toTarget.length();

    if (distance < 0.001) return true;

    const direction = toTarget.normalize();
    this.visibilityRaycaster.set(origin, direction);
    this.visibilityRaycaster.far = Math.max(distance - 0.08, 0.001);

    const hit = this.visibilityRaycaster.intersectObject(this.group, true)[0];
    return !hit || hit.object === targetMesh || this.isDescendantOf(hit.object, targetMesh);
  }

  private isDescendantOf(object: THREE.Object3D, parent: THREE.Object3D) {
    let current: THREE.Object3D | null = object;

    while (current) {
      if (current === parent) return true;
      current = current.parent;
    }

    return false;
  }
}
