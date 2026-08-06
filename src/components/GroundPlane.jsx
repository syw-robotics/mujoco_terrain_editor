import { Grid } from '@react-three/drei';
import useSceneStore from '../store/useSceneStore';

function GroundPlane() {
  const selectElement = useSceneStore((state) => state.selectElement);
  return (
    <>
      <mesh
        position={[0, 0, -0.055]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          if (useSceneStore.getState().isTransforming) return;
          selectElement(null);
        }}
      >
        <boxGeometry args={[60, 60, 0.1]} />
        <meshStandardMaterial color="#151a17" roughness={0.92} metalness={0.02} />
      </mesh>
      <Grid
        args={[60, 60]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0.002]}
        cellSize={1}
        cellThickness={0.45}
        cellColor="#39433e"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#5c6962"
        fadeDistance={32}
        fadeStrength={1.1}
        infiniteGrid
      />
    </>
  );
}

export default GroundPlane;
