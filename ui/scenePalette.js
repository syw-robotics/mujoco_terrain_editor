// 3D view colors. Keep these aligned with ui/themes/*.css.

export const scenePalette = {
  light: {
    background: '#fafaf8',
    ground: '#e8e6de',
    gridCell: '#b9b7ab',
    gridSection: '#7f7d72',
    edge: '#c4c3ba',
    edgeSelected: '#26251e',
    accent: '#26251e',
    label: '#26251e',
    sky: '#f7f7f4',
    hemiGround: '#e4e2d8',
  },
  dark: {
    background: '#18170f',
    ground: '#14130f',
    gridCell: '#3a3933',
    gridSection: '#5c5a52',
    edge: '#5c5a52',
    edgeSelected: '#ecebe4',
    accent: '#ecebe4',
    label: '#ecebe4',
    sky: '#2a2923',
    hemiGround: '#100f0c',
  },
};

export function paletteFor(theme) {
  return theme === 'dark' ? scenePalette.dark : scenePalette.light;
}
