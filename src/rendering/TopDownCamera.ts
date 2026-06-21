import * as THREE from 'three';

const CAMERA_HEIGHT = 17;
const LOOK_AHEAD_Z = -1.8;
const FOLLOW_LERP = 0.12;
const BASE_VIEW_HEIGHT = 17;

export class TopDownCamera {
  readonly camera: THREE.OrthographicCamera;

  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly targetPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();

  constructor(width: number, height: number) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
    this.camera.position.set(0, CAMERA_HEIGHT, 0.01);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    this.resize(width, height);
  }

  update(focus: THREE.Vector3) {
    this.targetPosition.set(focus.x, CAMERA_HEIGHT, focus.z + LOOK_AHEAD_Z);
    this.camera.position.lerp(this.targetPosition, FOLLOW_LERP);

    this.lookTarget.set(focus.x, 0, focus.z);
    this.camera.lookAt(this.lookTarget);
  }

  resize(width: number, height: number) {
    const aspect = width / height;
    const halfHeight = BASE_VIEW_HEIGHT / 2;
    const halfWidth = halfHeight * aspect;

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }

  screenToGround(ndc: THREE.Vector2, target: THREE.Vector3) {
    this.raycaster.setFromCamera(ndc, this.camera);
    this.raycaster.ray.intersectPlane(this.groundPlane, target);
    return target;
  }
}
