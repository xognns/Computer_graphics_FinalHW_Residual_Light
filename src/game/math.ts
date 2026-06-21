export type Bounds2D = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function intersectsCircleAabb(
  x: number,
  z: number,
  radius: number,
  bounds: Bounds2D,
) {
  const closestX = clamp(x, bounds.minX, bounds.maxX);
  const closestZ = clamp(z, bounds.minZ, bounds.maxZ);
  const dx = x - closestX;
  const dz = z - closestZ;

  return dx * dx + dz * dz < radius * radius;
}

