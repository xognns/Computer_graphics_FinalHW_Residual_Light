import * as THREE from 'three';
import { InputManager } from './InputManager';
import { GameStatus } from './GameState';
import { DirectLightSample } from '../gi/DDGIManager';

type GeneratorObjective = {
  id: number;
  group: THREE.Group;
  base: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  core: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  light: THREE.PointLight;
  label: THREE.Sprite;
  prompt: THREE.Sprite;
  position: THREE.Vector3;
  repaired: boolean;
  repairProgress: number;
};

export type ObjectiveUiState = {
  repairedGenerators: number;
  totalGenerators: number;
  prompt: string;
  objective: string;
  repairProgress: number;
  statusMessage: string;
};

const REPAIR_SECONDS = 2.2;
const INTERACTION_RADIUS = 1.65;
const CONSOLE_RADIUS = 1.8;
const DARK_OBJECTIVE_MULTIPLIER = 0.055;

const generatorPositions = [
  new THREE.Vector3(-26.0, 0, -16.0),
  new THREE.Vector3(-24.0, 0, 15.0),
  new THREE.Vector3(-4.5, 0, -16.0),
  new THREE.Vector3(4.5, 0, 13.8),
  new THREE.Vector3(17.0, 0, -16.0),
  new THREE.Vector3(26.0, 0, 15.0),
];

export class ObjectiveManager {
  readonly group = new THREE.Group();
  readonly finalConsole: THREE.Group;

  private readonly generators: GeneratorObjective[];
  private activeRepairTarget: GeneratorObjective | null = null;
  private readonly lightReactiveMeshes: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >[] = [];
  private readonly visibilityRaycaster = new THREE.Raycaster();
  private prompt = '';
  private objective = 'Repair all generators';
  private repairProgress = 0;
  private statusMessage = '';

  constructor() {
    this.group.name = 'ObjectiveManager';
    this.generators = generatorPositions.map((position, index) =>
      this.createGenerator(index + 1, position),
    );
    this.finalConsole = this.createFinalConsole();
    this.finalConsole.position.set(27.0, 0, 17.5);
    this.group.add(this.finalConsole);
  }

  update(
    deltaSeconds: number,
    playerPosition: THREE.Vector3,
    input: InputManager,
    gameStatus: GameStatus,
  ): GameStatus {
    if (gameStatus !== 'playing') {
      this.prompt = input.isRestartPressed() ? 'Restarting is available after refresh' : '';
      this.repairProgress = 0;
      return gameStatus;
    }

    this.prompt = '';
    this.statusMessage = '';
    this.activeRepairTarget = this.findNearestRepairableGenerator(playerPosition);

    if (this.activeRepairTarget) {
      this.updateGeneratorRepair(deltaSeconds, input, this.activeRepairTarget);
      return 'playing';
    }

    this.repairProgress = 0;

    if (this.allGeneratorsRepaired()) {
      this.objective = 'Reach extraction console';
      const consoleDistance = playerPosition.distanceTo(this.finalConsole.position);

      if (consoleDistance <= CONSOLE_RADIUS) {
        this.prompt = 'Hold E to report power restoration';

        if (input.isActionPressed()) {
          this.statusMessage = 'Power restored. Report sent.';
          return 'victory';
        }
      }
    } else if (playerPosition.distanceTo(this.finalConsole.position) <= CONSOLE_RADIUS) {
      this.prompt = 'Repair all generators first';
    }

    return 'playing';
  }

  getUiState(): ObjectiveUiState {
    return {
      repairedGenerators: this.repairedGeneratorCount,
      totalGenerators: this.generators.length,
      prompt: this.prompt,
      objective: this.objective,
      repairProgress: this.repairProgress,
      statusMessage: this.statusMessage,
    };
  }

  getDirectLightSamples() {
    return this.generators
      .filter((generator) => generator.repaired)
      .map((generator) => ({
        position: generator.group.localToWorld(new THREE.Vector3(0, 1.45, 0)),
        color: new THREE.Color(0x62e7ff),
        intensity: 9,
        radius: 8,
      }))
      .concat([
        {
          position: this.finalConsole.localToWorld(new THREE.Vector3(0, 1.6, 0)),
          color: new THREE.Color(0xff4f8b),
          intensity: 3,
          radius: 6,
        },
      ]);
  }

  getAttractionTargets() {
    if (!this.allGeneratorsRepaired()) {
      return [];
    }

    return [
      {
        label: 'console' as const,
        position: this.finalConsole.getWorldPosition(new THREE.Vector3()),
      },
    ];
  }

  getRaycastTargets() {
    const targets: THREE.Object3D[] = [];

    this.group.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        targets.push(object);
      }
    });

    return targets;
  }

  updateLightingVisibility(
    sampleIrradiance: (position: THREE.Vector3) => THREE.Vector3,
    directLights: DirectLightSample[],
    observerPosition: THREE.Vector3,
    occluders: THREE.Object3D[],
    brightnessDebug = false,
  ) {
    for (const mesh of this.lightReactiveMeshes) {
      const worldPosition = mesh.getWorldPosition(new THREE.Vector3());
      const indirect = sampleIrradiance(worldPosition);
      const direct = this.computeDirectReveal(worldPosition, directLights, occluders);
      const observerVisibility = brightnessDebug
        ? 1
        : this.canObserverSeePoint(
          observerPosition,
          worldPosition,
          occluders,
        );
      const reveal = Math.max(
        brightnessDebug ? 0.82 : 0,
        THREE.MathUtils.clamp(
          indirect.length() * 0.55 + direct.length() * 0.1,
          0,
          1,
        ) * observerVisibility,
      );

      const baseColor = mesh.userData.baseColor as THREE.Color;
      mesh.material.color.copy(
        baseColor.clone().multiplyScalar(
          THREE.MathUtils.lerp(DARK_OBJECTIVE_MULTIPLIER, 1, reveal),
        ),
      );
      mesh.material.emissive.setHex(0x000000);
      mesh.material.emissiveIntensity = 0;
    }
  }

  updateGeneratorLightPrompts(
    flashlight: DirectLightSample,
    occluders: THREE.Object3D[],
  ) {
    for (const generator of this.generators) {
      const isLit = this.isGeneratorLitByFlashlight(
        generator,
        flashlight,
        occluders,
      );
      generator.label.visible = isLit;
      generator.prompt.visible = !generator.repaired && isLit;
    }
  }

  private updateGeneratorRepair(
    deltaSeconds: number,
    input: InputManager,
    generator: GeneratorObjective,
  ) {
    this.prompt = `Hold E to repair generator ${generator.id}`;

    if (!input.isActionPressed()) {
      this.repairProgress = generator.repairProgress / REPAIR_SECONDS;
      return;
    }

    generator.repairProgress = Math.min(
      generator.repairProgress + deltaSeconds,
      REPAIR_SECONDS,
    );
    this.repairProgress = generator.repairProgress / REPAIR_SECONDS;

    if (generator.repairProgress >= REPAIR_SECONDS) {
      this.markGeneratorRepaired(generator);
      this.prompt = `Generator ${generator.id} repaired`;
      this.repairProgress = 0;
    }
  }

  private markGeneratorRepaired(generator: GeneratorObjective) {
    generator.repaired = true;
    generator.core.userData.baseColor = new THREE.Color(0xb7f7ff);
    generator.light.intensity = 12;
  }

  private findNearestRepairableGenerator(playerPosition: THREE.Vector3) {
    let nearest: GeneratorObjective | null = null;
    let nearestDistance = Infinity;

    for (const generator of this.generators) {
      if (generator.repaired) continue;

      const distance = playerPosition.distanceTo(generator.position);

      if (distance <= INTERACTION_RADIUS && distance < nearestDistance) {
        nearest = generator;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  private allGeneratorsRepaired() {
    return this.repairedGeneratorCount === this.generators.length;
  }

  private get repairedGeneratorCount() {
    return this.generators.filter((generator) => generator.repaired).length;
  }

  private createGenerator(id: number, position: THREE.Vector3): GeneratorObjective {
    const group = new THREE.Group();
    group.name = `Generator-${id}`;
    group.position.copy(position);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.0, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x303944,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.58,
        metalness: 0.42,
      }),
    );
    base.position.y = 0.5;
    this.registerLightReactiveMesh(base);
    group.add(base);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 1.35, 24),
      new THREE.MeshStandardMaterial({
        color: 0x4a5966,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.36,
        metalness: 0.35,
      }),
    );
    core.position.y = 0.95;
    this.registerLightReactiveMesh(core);
    group.add(core);

    const light = new THREE.PointLight(0x62e7ff, 0, 6.5, 1.7);
    light.position.set(0, 1.45, 0);
    group.add(light);

    const label = this.createTextSprite('GENERATOR', {
      width: 256,
      height: 64,
      fontSize: 30,
      textColor: '#9edcff',
      backgroundColor: 'rgba(8, 18, 28, 0.58)',
    });
    label.name = `Generator-${id}-Label`;
    label.position.set(0, -2, 0);
    label.scale.set(1.22, 0.3, 1);
    label.visible = false;
    group.add(label);

    const prompt = this.createTextSprite('PRESS E', {
      width: 192,
      height: 64,
      fontSize: 32,
      textColor: '#f2fbff',
      backgroundColor: 'rgba(54, 188, 255, 0.52)',
    });
    prompt.name = `Generator-${id}-Prompt`;
    prompt.position.set(0, 3.05, 0);
    prompt.scale.set(0.9, 0.3, 1);
    prompt.visible = false;
    group.add(prompt);

    this.group.add(group);

    return {
      id,
      group,
      base,
      core,
      light,
      label,
      prompt,
      position: group.position,
      repaired: false,
      repairProgress: 0,
    };
  }

  private registerLightReactiveMesh(
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
  ) {
    mesh.material = mesh.material.clone();
    mesh.userData.baseColor = mesh.material.color.clone();
    mesh.material.color.multiplyScalar(DARK_OBJECTIVE_MULTIPLIER);
    mesh.material.emissive.setHex(0x000000);
    mesh.material.emissiveIntensity = 0;
    this.lightReactiveMeshes.push(mesh);
  }

  private computeDirectReveal(
    point: THREE.Vector3,
    directLights: DirectLightSample[],
    occluders: THREE.Object3D[],
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

      if (!this.canReachPoint(light.position, direction, distance, occluders)) continue;

      const attenuation = (light.intensity * spotTerm) / (1 + distance * distance * 0.16);
      result.add(
        new THREE.Vector3(light.color.r, light.color.g, light.color.b).multiplyScalar(
          attenuation,
        ),
      );
    }

    return result;
  }

  private canObserverSeePoint(
    observerPosition: THREE.Vector3,
    targetPosition: THREE.Vector3,
    occluders: THREE.Object3D[],
  ) {
    const origin = observerPosition.clone().add(new THREE.Vector3(0, 0.75, 0));
    const target = targetPosition.clone();
    target.y = Math.max(target.y, 0.35);
    const toTarget = target.sub(origin);
    const distance = toTarget.length();
    if (distance < 0.001) return 1;

    return this.canReachPoint(origin, toTarget.normalize(), Math.max(distance - 0.08, 0.001), occluders)
      ? 1
      : 0;
  }

  private canReachPoint(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    distance: number,
    occluders: THREE.Object3D[],
  ) {
    this.visibilityRaycaster.set(origin.clone().addScaledVector(direction, 0.08), direction);
    this.visibilityRaycaster.far = Math.max(distance - 0.12, 0.001);
    return this.visibilityRaycaster.intersectObjects(occluders, true).length === 0;
  }

  private isGeneratorLitByFlashlight(
    generator: GeneratorObjective,
    flashlight: DirectLightSample,
    occluders: THREE.Object3D[],
  ) {
    if (
      flashlight.intensity <= 0 ||
      !flashlight.direction ||
      flashlight.spotCosine === undefined
    ) {
      return false;
    }

    const target = generator.core.getWorldPosition(new THREE.Vector3()).add(
      new THREE.Vector3(0, 0.25, 0),
    );
    const toTarget = target.sub(flashlight.position);
    const distance = toTarget.length();

    if (distance <= 0.001 || distance > flashlight.radius) {
      return false;
    }

    const direction = toTarget.normalize();
    if (flashlight.direction.dot(direction) < flashlight.spotCosine) {
      return false;
    }

    return this.canReachPoint(flashlight.position, direction, distance, occluders);
  }

  private createTextSprite(
    text: string,
    options: {
      width: number;
      height: number;
      fontSize: number;
      textColor: string;
      backgroundColor: string;
    },
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D context is unavailable');
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = options.backgroundColor;
    this.drawRoundedRect(context, 8, 8, canvas.width - 16, canvas.height - 16, 10);
    context.fill();
    context.font = `700 ${options.fontSize}px Arial, sans-serif`;
    context.fillStyle = options.textColor;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    );
    sprite.raycast = () => {};
    return sprite;
  }

  private drawRoundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  private createFinalConsole() {
    const group = new THREE.Group();
    group.name = 'ExtractionConsole';

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.1, 1.0),
      new THREE.MeshStandardMaterial({
        color: 0x2c3440,
        emissive: 0x160f2e,
        emissiveIntensity: 0.25,
        roughness: 0.52,
        metalness: 0.38,
      }),
    );
    base.position.y = 0.55;
    group.add(base);

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.12, 0.72),
      new THREE.MeshStandardMaterial({
        color: 0xff8fb8,
        emissive: 0xff2e78,
        emissiveIntensity: 0.8,
      }),
    );
    panel.position.set(0, 1.15, -0.18);
    group.add(panel);

    const light = new THREE.PointLight(0xff4f8b, 6, 7, 1.8);
    light.position.set(0, 1.6, 0);
    group.add(light);

    return group;
  }
}
