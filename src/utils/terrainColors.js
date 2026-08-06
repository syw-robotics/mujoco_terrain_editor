export const TERRAIN_COLORS = [
  '#c8d3cb', '#bdcc98', '#d7b78a', '#91b9b2', '#b4a8cf', '#d2a6a1',
  '#9fb6d0', '#c6b17a', '#8fb995', '#c69ab3', '#a8c7d1', '#d0a36f',
  '#9fa8c8', '#b8c38e', '#d3a7c5', '#88b8c6', '#b3a58d', '#9dc1a6',
];

export function terrainColorForIndex(index) {
  return TERRAIN_COLORS[index % TERRAIN_COLORS.length];
}

export function randomTerrainColor(currentColor) {
  const normalizedCurrent = currentColor?.toLowerCase();
  const candidates = TERRAIN_COLORS.filter((color) => color !== normalizedCurrent);
  return candidates[Math.floor(Math.random() * candidates.length)];
}
