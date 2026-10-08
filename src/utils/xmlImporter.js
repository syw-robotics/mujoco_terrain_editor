import * as THREE from 'three';
import { getGroundOffset } from './grounding.js';

const METADATA_PREFIX = 'MTE_DATA ';

function numberList(value, fallback) {
  const parsed = String(value ?? '').trim().split(/\s+/).map(Number);
  return parsed.length === fallback.length && parsed.every(Number.isFinite) ? parsed : [...fallback];
}

function radiansToDegrees(values) {
  return values.map((value) => value * 180 / Math.PI);
}

function rgbaToHex(value) {
  const rgba = numberList(value, [0.8, 0.8, 0.8, 1]);
  return `#${rgba.slice(0, 3).map((channel) => {
    const byte = Math.round(Math.min(1, Math.max(0, channel)) * 255);
    return byte.toString(16).padStart(2, '0');
  }).join('')}`;
}

function nodeRotation(node) {
  const quaternion = numberList(node.getAttribute('quat'), [1, 0, 0, 0]);
  if (node.hasAttribute('quat')) {
    const euler = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion(quaternion[1], quaternion[2], quaternion[3], quaternion[0]).normalize(),
    );
    return radiansToDegrees(euler.toArray().slice(0, 3));
  }
  return radiansToDegrees(numberList(node.getAttribute('euler'), [0, 0, 0]));
}

function inferFlatGeom(geom) {
  const geomType = geom.getAttribute('type') || 'box';
  if (geomType !== 'box' && geomType !== 'cylinder') return null;

  const size = geomType === 'cylinder'
    ? numberList(geom.getAttribute('size'), [0.5, 0.5])
    : numberList(geom.getAttribute('size'), [0.5, 0.5, 0.5]);
  const element = {
    type: geomType === 'cylinder' ? 'cylinder' : 'box',
    name: geom.getAttribute('name') || 'Terrain',
    position: numberList(geom.getAttribute('pos'), [0, 0, 0]),
    rotation: nodeRotation(geom),
    scale: [1, 1, 1],
    groundLocked: false,
    color: rgbaToHex(geom.getAttribute('rgba')),
    params: geomType === 'cylinder'
      ? { radius: size[0], height: size[1] * 2 }
      : { width: size[0] * 2, depth: size[1] * 2, height: size[2] * 2 },
  };
  element.groundLocked = Math.abs(element.position[2] - getGroundOffset(element)) < 1e-4;
  return element;
}

function inferLegacyElement(body) {
  const geoms = Array.from(body.children).filter((child) => child.tagName === 'geom');
  if (!geoms.length) return null;

  const firstGeom = geoms[0];
  const name = firstGeom.getAttribute('name') || body.getAttribute('name')?.replace(/_body$/, '') || 'Terrain';
  const position = numberList(body.getAttribute('pos'), [0, 0, 0]);
  const rotation = radiansToDegrees(numberList(body.getAttribute('euler'), [0, 0, 0]));
  const color = rgbaToHex(firstGeom.getAttribute('rgba'));
  const makeElement = (type, params) => ({
    type,
    name,
    position,
    rotation,
    scale: [1, 1, 1],
    groundLocked: false,
    color,
    params,
  });

  let element;
  if (geoms.length > 1) {
    const firstSize = numberList(firstGeom.getAttribute('size'), [1, 1, 1]);
    const secondPosition = numberList(geoms[1]?.getAttribute('pos'), [0, 0, 0]);
    const firstPosition = numberList(firstGeom.getAttribute('pos'), [0, 0, 0]);
    const stepDeltaX = Math.abs(secondPosition[0] - firstPosition[0]);
    const stepDeltaY = Math.abs(secondPosition[1] - firstPosition[1]);
    const progressesAlongX = stepDeltaX >= stepDeltaY;
    const stepLength = (progressesAlongX ? stepDeltaX : stepDeltaY)
      || firstSize[progressesAlongX ? 0 : 1] * 2 / 0.97;
    element = makeElement('stairs', {
      stepWidth: firstSize[progressesAlongX ? 1 : 0] * 2,
      stepLength,
      stepHeight: firstSize[2] * 2,
      steps: geoms.length,
    });
  } else {
    const geomType = firstGeom.getAttribute('type') || 'box';
    const size = geomType === 'cylinder'
      ? numberList(firstGeom.getAttribute('size'), [0.5, 0.5])
      : numberList(firstGeom.getAttribute('size'), [0.5, 0.5, 0.5]);
    const geomRotation = numberList(firstGeom.getAttribute('euler'), [0, 0, 0]);
    if (geomType === 'cylinder') {
      element = makeElement('cylinder', {
        radius: size[0],
        height: size[1] * 2,
      });
    } else if (Math.abs(geomRotation[0]) > 1e-6) {
      const slope = Math.abs(geomRotation[0] * 180 / Math.PI);
      element = makeElement('ramp', {
        width: size[0] * 2,
        length: size[1] * 2 * Math.cos(geomRotation[0]),
        slope,
      });
    } else {
      const type = /^platform(?:_|$)/i.test(name) ? 'platform' : 'box';
      element = makeElement(type, {
        width: size[0] * 2,
        depth: size[1] * 2,
        height: size[2] * 2,
      });
    }
  }

  const expectedGroundZ = getGroundOffset(element);
  element.groundLocked = Math.abs(element.position[2] - expectedGroundZ) < 1e-4;
  return element;
}

function isTerrainContainer(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  if (node.tagName === 'worldbody') return true;
  if (node.tagName !== 'body') return false;
  return Array.from(node.childNodes).some((child) => (
    (child.nodeType === Node.COMMENT_NODE && child.nodeValue.trim().startsWith(METADATA_PREFIX))
    || (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'geom' && child.getAttribute('type') === 'plane')
  ));
}

function* terrainNodes(node) {
  for (const child of node.childNodes) {
    if (isTerrainContainer(child)) yield* terrainNodes(child);
    else yield child;
  }
}

export function importFromXML(xmlText) {
  const documentNode = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parserError = documentNode.querySelector('parsererror');
  if (parserError) throw new Error('Invalid XML document');

  const worldbody = documentNode.querySelector('mujoco > worldbody');
  const root = documentNode.documentElement;
  const container = worldbody
    || (root && (root.tagName === 'body' || root.tagName === 'worldbody') ? root : null);
  if (!container) throw new Error('Missing MuJoCo worldbody');

  const elements = [];
  let pendingMetadata = null;
  let geomsToSkip = 0;
  for (const node of terrainNodes(container)) {
    if (node.nodeType === Node.COMMENT_NODE) {
      const comment = node.nodeValue.trim();
      if (comment.startsWith(METADATA_PREFIX)) {
        geomsToSkip = 0;
        try {
          pendingMetadata = JSON.parse(decodeURIComponent(comment.slice(METADATA_PREFIX.length)));
        } catch {
          throw new Error('Invalid terrain editor metadata');
        }
      }
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const isTerrainGeom = node.tagName === 'geom' && node.getAttribute('type') !== 'plane';
    if (geomsToSkip > 0 && isTerrainGeom) {
      geomsToSkip -= 1;
      continue;
    }
    const metadataElement = pendingMetadata?.version === 1 ? pendingMetadata.element : null;
    let element = null;
    if (node.tagName === 'body') {
      element = metadataElement || inferLegacyElement(node);
    } else if (isTerrainGeom) {
      if (metadataElement) {
        element = metadataElement;
        const geomCount = Math.round(Number(pendingMetadata.geomCount));
        geomsToSkip = Number.isFinite(geomCount) && geomCount > 1 ? geomCount - 1 : 0;
      } else {
        element = inferFlatGeom(node);
      }
    }
    if (element) elements.push(element);
    pendingMetadata = null;
  }

  if (!elements.length) throw new Error('No editable terrain geoms found');
  return elements;
}
