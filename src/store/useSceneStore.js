import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { getPreset } from '../data/presets.js';
import { getGroundOffset } from '../utils/grounding.js';
import { sanitizeXmlName } from '../utils/xmlNames.js';

const COLORS = ['#c8d3cb', '#bdcc98', '#d7b78a', '#91b9b2', '#b4a8cf'];

function sanitizeElement(element) {
  const preset = getPreset(element?.type);
  if (!preset) return null;
  return {
    id: typeof element.id === 'string' ? element.id : nanoid(8),
    type: preset.type,
    name: sanitizeXmlName(element.name, preset.xmlName),
    position: validVector(element.position, [0, 0, 0]),
    rotation: validVector(element.rotation, [0, 0, 0]),
    scale: validVector(element.scale, [1, 1, 1]).map((value) => Math.max(0.1, value)),
    groundLocked: element.groundLocked !== false,
    color: /^#[0-9a-f]{6}$/i.test(element.color) ? element.color : '#c8d3cb',
    params: Object.fromEntries(
      Object.entries(preset.defaultParams).map(([key, fallback]) => [
        key,
        Number.isFinite(Number(element.params?.[key])) ? Number(element.params[key]) : fallback,
      ]),
    ),
  };
}

function validVector(value, fallback) {
  if (!Array.isArray(value) || value.length !== 3) return [...fallback];
  return value.map((item, index) => Number.isFinite(Number(item)) ? Number(item) : fallback[index]);
}

const useSceneStore = create((set, get) => ({
  elements: [],
  selectedId: null,
  transformMode: 'translate',
  isTransforming: false,

  addElement: (presetType, position = [0, 0, 0]) => {
    const preset = getPreset(presetType);
    if (!preset) return;
    const sameTypeCount = get().elements.filter((item) => item.type === presetType).length;
    const params = { ...preset.defaultParams };
    const groundPosition = validVector(position, [0, 0, 0]);
    const centerPosition = [
      groundPosition[0],
      groundPosition[1],
      groundPosition[2] + preset.getGroundOffset(params),
    ];
    const element = {
      id: nanoid(8),
      type: presetType,
      name: `${preset.xmlName}_${sameTypeCount + 1}`,
      position: [
        Math.round(centerPosition[0] * 20) / 20,
        Math.round(centerPosition[1] * 20) / 20,
        Number(centerPosition[2].toFixed(6)),
      ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      groundLocked: true,
      color: COLORS[get().elements.length % COLORS.length],
      params,
    };
    set((state) => ({ elements: [...state.elements, element], selectedId: element.id }));
  },

  updateElement: (id, patch) => set((state) => ({
    elements: state.elements.map((element) => {
      if (element.id !== id) return element;
      const next = { ...element, ...patch };
      if (next.groundLocked) {
        next.position = [next.position[0], next.position[1], getGroundOffset(next)];
      }
      return next;
    }),
  })),

  removeElement: (id) => set((state) => ({
    elements: state.elements.filter((element) => element.id !== id),
    selectedId: state.selectedId === id ? null : state.selectedId,
  })),

  duplicateElement: (id) => {
    const source = get().elements.find((element) => element.id === id);
    if (!source) return;
    const copy = {
      ...source,
      id: nanoid(8),
      name: `${source.name}_copy`,
      position: [source.position[0] + 0.5, source.position[1] - 0.5, source.position[2]],
      rotation: [...source.rotation],
      scale: [...source.scale],
      params: { ...source.params },
    };
    set((state) => ({ elements: [...state.elements, copy], selectedId: copy.id }));
  },

  selectElement: (id) => set({ selectedId: id }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  setTransforming: (isTransforming) => set({ isTransforming }),
  clearAll: () => set({ elements: [], selectedId: null, isTransforming: false }),
  loadElements: (elements) => {
    const sanitized = Array.isArray(elements) ? elements.map(sanitizeElement).filter(Boolean) : [];
    sanitized.forEach((element) => {
      if (element.groundLocked) element.position[2] = getGroundOffset(element);
    });
    set({ elements: sanitized, selectedId: null });
  },
}));

export default useSceneStore;
