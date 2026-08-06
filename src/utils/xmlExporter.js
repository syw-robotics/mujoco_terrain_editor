import { getPreset } from '../data/presets.js';
import { sanitizeXmlName } from './xmlNames.js';

const round = (value) => {
  const normalized = Math.abs(value) < 1e-9 ? 0 : value;
  return Number(normalized.toFixed(6)).toString();
};

const vector = (values) => values.map(round).join(' ');

const escapeXML = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const attrs = (values) => Object.entries(values)
  .filter(([, value]) => value !== undefined && value !== null && value !== '')
  .map(([key, value]) => `${key}="${escapeXML(value)}"`)
  .join(' ');

function hexToRgba(hex) {
  const safe = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#cccccc';
  return [1, 3, 5].map((offset) => round(parseInt(safe.slice(offset, offset + 2), 16) / 255)).join(' ') + ' 1';
}

function editorMetadata(element) {
  const payload = encodeURIComponent(JSON.stringify({
    version: 1,
    element: {
      type: element.type,
      name: element.name,
      position: element.position,
      rotation: element.rotation,
      scale: element.scale,
      groundLocked: element.groundLocked,
      color: element.color,
      params: element.params,
    },
  })).replaceAll('-', '%2D');
  return `    <!-- MTE_DATA ${payload} -->`;
}

function elementBody(element, elementIndex) {
  const preset = getPreset(element.type);
  if (!preset) return '';
  const geometries = preset.toGeometries(element.params);
  const elementNumber = String(elementIndex + 1).padStart(3, '0');
  const namePrefix = sanitizeXmlName(element.name, `${preset.xmlName}_${elementNumber}`);
  const bodyAttrs = attrs({
    name: `${namePrefix}_body`,
    pos: vector(element.position),
    euler: vector(element.rotation.map((degree) => degree * Math.PI / 180)),
  });
  const geoms = geometries.map((geometry, index) => {
    // MuJoCo boxes use half-extents, while cylinders use radius and half-height.
    // Element transforms live on the body; preset-local transforms stay on
    // each geom so composite terrain matches the editor hierarchy.
    const geomType = geometry.shape === 'cylinder' ? 'cylinder' : 'box';
    const size = geomType === 'cylinder'
      ? [geometry.args[0] * Math.max(element.scale[0], element.scale[1]), geometry.args[1] * element.scale[2] / 2]
      : geometry.args.map((length, axis) => length * element.scale[axis] / 2);
    const position = geometry.position.map((value, axis) => value * element.scale[axis]);
    const rotation = geometry.rotation || [0, 0, 0];
    return `      <geom ${attrs({
      name: geometries.length === 1 || index === 0
        ? namePrefix
        : `${namePrefix}_step_${String(index + 1).padStart(2, '0')}`,
      type: geomType,
      size: vector(size),
      pos: vector(position),
      euler: rotation.some((value) => value !== 0) ? vector(rotation) : undefined,
      rgba: hexToRgba(element.color),
      friction: '1 0.005 0.0001',
      condim: '3',
    })}/>`;
  }).join('\n');
  return `${editorMetadata(element)}\n    <body ${bodyAttrs}>\n${geoms}\n    </body>`;
}

export function exportToXML(elements) {
  const terrain = elements.map(elementBody).filter(Boolean).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<mujoco model="terrain">
  <compiler angle="radian" coordinate="local"/>
  <option timestep="0.002" gravity="0 0 -9.81"/>
  <visual>
    <headlight ambient="0.35 0.35 0.35" diffuse="0.7 0.7 0.7" specular="0.2 0.2 0.2"/>
    <rgba haze="0.12 0.15 0.13 1"/>
  </visual>
  <asset>
    <texture name="ground_tex" type="2d" builtin="checker" rgb1="0.16 0.18 0.17" rgb2="0.12 0.14 0.13" width="256" height="256"/>
    <material name="ground_mat" texture="ground_tex" texrepeat="12 12" reflectance="0.05"/>
  </asset>
  <worldbody>
    <light name="key" pos="-6 -8 12" dir="0.35 0.45 -1" diffuse="0.8 0.82 0.8"/>
    <geom name="ground" type="plane" size="30 30 0.1" material="ground_mat" friction="1 0.005 0.0001" condim="3"/>
${terrain}
  </worldbody>
</mujoco>
`;
}

export function downloadXML(elements, filename = 'terrain.xml') {
  const blob = new Blob([exportToXML(elements)], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking on the next task avoids cancelling downloads in stricter browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function timestampedXMLFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `terrain_${pad(date.getMonth() + 1)}_${pad(date.getDate())}-${pad(date.getHours())}_${pad(date.getMinutes())}_.xml`;
}

export async function saveXMLToHandle(elements, fileHandle) {
  if (!fileHandle?.createWritable) throw new Error('Writable file handle unavailable');
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(exportToXML(elements));
    await writable.close();
  } catch (error) {
    if (writable.abort) await writable.abort().catch(() => {});
    throw error;
  }
}
