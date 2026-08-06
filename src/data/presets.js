import { Box, Layers3, Mountain, PanelsTopLeft } from 'lucide-react';
import { defineTerrainPreset } from './defineTerrainPreset.js';

const RAMP_THICKNESS = 0.08;

export const PRESETS = [
  defineTerrainPreset({
    type: 'box',
    label: '方块',
    xmlName: 'Box',
    Icon: Box,
    parameters: [
      { key: 'width', label: '宽度 / X', unit: 'M', default: 1, min: 0.01, step: 0.05 },
      { key: 'depth', label: '长度 / Y', unit: 'M', default: 1, min: 0.01, step: 0.05 },
      { key: 'height', label: '高度 / Z', unit: 'M', default: 1, min: 0.01, step: 0.05 },
    ],
    getSummary: ({ width, depth, height }) => `${width} × ${depth} × ${height}`,
    getGroundOffset: ({ height }) => height / 2,
    toGeometries: ({ width, depth, height }) => [
      { args: [width, depth, height], position: [0, 0, 0] },
    ],
  }),
  defineTerrainPreset({
    type: 'ramp',
    label: '斜坡',
    xmlName: 'Ramp',
    Icon: Mountain,
    parameters: [
      { key: 'width', label: '坡面宽度', unit: 'M', default: 2, min: 0.01, step: 0.05 },
      { key: 'length', label: '水平长度', unit: 'M', default: 3, min: 0.01, step: 0.05 },
      { key: 'slope', label: '坡度', unit: 'DEG', default: 18.435, min: 0, max: 89, step: 1 },
    ],
    getSummary: ({ slope }) => `${slope.toFixed(1)}° slope`,
    getGroundOffset: ({ length, slope }) => {
      const angle = slope * Math.PI / 180;
      return Math.abs(length * Math.tan(angle)) / 2 + RAMP_THICKNESS * Math.abs(Math.cos(angle)) / 2;
    },
    toGeometries: ({ width, length, slope }) => {
      const angle = slope * Math.PI / 180;
      const surfaceLength = length / Math.max(0.001, Math.cos(angle));
      return [{
        args: [width, surfaceLength, RAMP_THICKNESS],
        position: [0, 0, 0],
        rotation: [angle, 0, 0],
      }];
    },
  }),
  defineTerrainPreset({
    type: 'stairs',
    label: '楼梯',
    xmlName: 'Stairs',
    Icon: Layers3,
    parameters: [
      { key: 'stepWidth', label: '踏步宽度', unit: 'M', default: 2, min: 0.01, step: 0.05 },
      { key: 'stepLength', label: '踏步长度', unit: 'M', default: 0.3, min: 0.01, step: 0.05 },
      { key: 'stepHeight', label: '踏步高度', unit: 'M', default: 0.15, min: 0.01, step: 0.05 },
      { key: 'steps', label: '台阶级数', unit: '', default: 5, min: 1, step: 1, integer: true },
    ],
    getSummary: ({ stepLength, stepHeight }) => `踏步 ${stepLength.toFixed(2)} × ${stepHeight.toFixed(2)} m`,
    getGroundOffset: ({ stepHeight, steps }) => stepHeight * Math.max(1, Math.round(steps)) / 2,
    toGeometries: ({ stepWidth, stepLength, stepHeight, steps: rawSteps }) => {
      const steps = Math.max(1, Math.round(rawSteps));
      const totalLength = stepLength * steps;
      const totalHeight = stepHeight * steps;
      return Array.from({ length: steps }, (_, i) => {
        const currentHeight = stepHeight * (i + 1);
        return {
          args: [stepWidth, stepLength * 0.97, currentHeight],
          position: [0, -totalLength / 2 + stepLength * (i + 0.5), currentHeight / 2 - totalHeight / 2],
        };
      });
    },
  }),
  defineTerrainPreset({
    type: 'platform',
    label: '平台',
    xmlName: 'Platform',
    Icon: PanelsTopLeft,
    parameters: [
      { key: 'width', label: '平台宽度', unit: 'M', default: 3, min: 0.01, step: 0.05 },
      { key: 'depth', label: '平台长度', unit: 'M', default: 3, min: 0.01, step: 0.05 },
      { key: 'height', label: '平台高度', unit: 'M', default: 0.2, min: 0.01, step: 0.05 },
    ],
    getSummary: ({ width, depth, height }) => `${width} × ${depth} × ${height}`,
    getGroundOffset: ({ height }) => height / 2,
    toGeometries: ({ width, depth, height }) => [
      { args: [width, depth, height], position: [0, 0, 0] },
    ],
  }),
];

export const PRESET_REGISTRY = new Map(PRESETS.map((preset) => [preset.type, preset]));
if (PRESET_REGISTRY.size !== PRESETS.length) {
  throw new Error('Terrain preset types must be unique');
}

export function getPreset(type) {
  return PRESET_REGISTRY.get(type);
}
