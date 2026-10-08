import { Grid } from '@react-three/drei';
import useSceneStore from '../store/useSceneStore';
import { paletteFor } from '../../ui/scenePalette.js';

function GroundPlane() {
  const selectElement = useSceneStore((state) => state.selectElement);
  const cancelColorPicking = useSceneStore((state) => state.cancelColorPicking);
  const theme = useSceneStore((state) => state.theme);
  const palette = paletteFor(theme);
  return (
    <>
      <mesh
        position={[0, 0, -0.055]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          if (useSceneStore.getState().isTransforming) return;
          if (useSceneStore.getState().colorPickTargetId) {
            cancelColorPicking();
            return;
          }
          selectElement(null);
        }}
      >
        <boxGeometry args={[60, 60, 0.1]} />
        <meshStandardMaterial color={palette.ground} roughness={0.92} metalness={0.02} />
      </mesh>
      <Grid
        args={[60, 60]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0.002]}
        cellSize={1}
        cellThickness={0.45}
        cellColor={palette.gridCell}
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor={palette.gridSection}
        fadeDistance={32}
        fadeStrength={1.1}
        infiniteGrid
      />
    </>
  );
}

export default GroundPlane;
