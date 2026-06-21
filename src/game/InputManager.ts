import * as THREE from 'three';

export class InputManager {
  private readonly pressedKeys = new Set<string>();
  private readonly moveVector = new THREE.Vector2();
  private readonly pointerNdc = new THREE.Vector2();
  private throwRequested = false;
  private flashlightToggleRequested = false;
  private ddgiDebugRequested = false;
  private directLightDebugRequested = false;
  private brightnessDebugRequested = false;

  constructor(private readonly element: HTMLElement) {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clear);
    this.element.addEventListener('pointermove', this.handlePointerMove);
    this.element.addEventListener('pointerdown', this.handlePointerDown);
    this.element.addEventListener('contextmenu', this.preventContextMenu);
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clear);
    this.element.removeEventListener('pointermove', this.handlePointerMove);
    this.element.removeEventListener('pointerdown', this.handlePointerDown);
    this.element.removeEventListener('contextmenu', this.preventContextMenu);
  }

  getMovement() {
    const x =
      Number(this.isPressed('KeyD') || this.isPressed('ArrowRight')) -
      Number(this.isPressed('KeyA') || this.isPressed('ArrowLeft'));
    const y =
      Number(this.isPressed('KeyS') || this.isPressed('ArrowDown')) -
      Number(this.isPressed('KeyW') || this.isPressed('ArrowUp'));

    this.moveVector.set(x, y);

    if (this.moveVector.lengthSq() > 1) {
      this.moveVector.normalize();
    }

    return this.moveVector;
  }

  isActionPressed() {
    return this.isPressed('KeyE');
  }

  isRestartPressed() {
    return this.isPressed('KeyR');
  }

  getPointerNdc() {
    return this.pointerNdc;
  }

  consumeThrowPressed() {
    const wasRequested = this.throwRequested;
    this.throwRequested = false;
    return wasRequested;
  }

  consumeFlashlightTogglePressed() {
    const wasRequested = this.flashlightToggleRequested;
    this.flashlightToggleRequested = false;
    return wasRequested;
  }

  consumeDdgiDebugPressed() {
    const wasRequested = this.ddgiDebugRequested;
    this.ddgiDebugRequested = false;
    return wasRequested;
  }

  consumeDirectLightDebugPressed() {
    const wasRequested = this.directLightDebugRequested;
    this.directLightDebugRequested = false;
    return wasRequested;
  }

  consumeBrightnessDebugPressed() {
    const wasRequested = this.brightnessDebugRequested;
    this.brightnessDebugRequested = false;
    return wasRequested;
  }

  private isPressed(code: string) {
    return this.pressedKeys.has(code);
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    this.pressedKeys.add(event.code);

    if (event.code === 'KeyQ') {
      this.throwRequested = true;
      event.preventDefault();
    }

    if (event.code === 'F2') {
      this.ddgiDebugRequested = true;
      event.preventDefault();
    }

    if (event.code === 'KeyP' && !event.repeat) {
      this.ddgiDebugRequested = true;
      event.preventDefault();
    }

    if (event.code === 'KeyR' && !event.repeat) {
      this.directLightDebugRequested = true;
      event.preventDefault();
    }

    if (event.code === 'KeyB' && !event.repeat) {
      this.brightnessDebugRequested = true;
      event.preventDefault();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code);
  };

  private readonly clear = () => {
    this.pressedKeys.clear();
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    const rect = this.element.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.pointerNdc.set(x, y);
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (event.button === 0) {
      this.flashlightToggleRequested = true;
    }
  };

  private readonly preventContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
}
