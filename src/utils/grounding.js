import * as THREE from 'three';
import { getPreset } from '../data/presets.js';

const corner = new THREE.Vector3();
const childEuler = new THREE.Euler();
const childQuaternion = new THREE.Quaternion();
const elementEuler = new THREE.Euler();
const elementQuaternion = new THREE.Quaternion();

export function getGroundOffset(element) {
  const preset = getPreset(element.type);
  if (!preset) return element.position?.[2] || 0;

  const geometries = preset.toGeometries(element.params);
  const scale = element.scale || [1, 1, 1];
  const rotation = element.rotation || [0, 0, 0];
  elementEuler.set(...rotation.map((degree) => degree * Math.PI / 180));
  elementQuaternion.setFromEuler(elementEuler);
  let minimumZ = Infinity;

  for (const geometry of geometries) {
    const half = geometry.args.map((value) => value / 2);
    childEuler.set(...(geometry.rotation || [0, 0, 0]));
    childQuaternion.setFromEuler(childEuler);

    for (const xSign of [-1, 1]) {
      for (const ySign of [-1, 1]) {
        for (const zSign of [-1, 1]) {
          corner.set(xSign * half[0], ySign * half[1], zSign * half[2]);
          corner.applyQuaternion(childQuaternion);
          corner.add(new THREE.Vector3(...geometry.position));
          corner.set(corner.x * scale[0], corner.y * scale[1], corner.z * scale[2]);
          corner.applyQuaternion(elementQuaternion);
          minimumZ = Math.min(minimumZ, corner.z);
        }
      }
    }
  }

  return Number((-minimumZ).toFixed(6));
}
