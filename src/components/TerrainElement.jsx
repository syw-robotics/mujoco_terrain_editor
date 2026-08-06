import { forwardRef } from 'react';
import { Edges } from '@react-three/drei';
import { getPreset } from '../data/presets';
import useSceneStore from '../store/useSceneStore';

const TerrainElement = forwardRef(function TerrainElement({ element, selected = false }, ref) {
  const selectElement = useSceneStore((state) => state.selectElement);
  const preset = getPreset(element.type);
  if (!preset) return null;

  const rotation = element.rotation.map((degrees) => degrees * Math.PI / 180);
  const geometries = preset.toGeometries(element.params);

  return (
    <group ref={ref} position={element.position} rotation={rotation} scale={element.scale}>
      {geometries.map((geometry, index) => (
        <mesh
          key={`${element.id}-${index}`}
          position={geometry.position}
          rotation={geometry.rotation || [0, 0, 0]}
          castShadow
          receiveShadow
          onClick={(event) => {
            event.stopPropagation();
            selectElement(element.id);
          }}
        >
          <boxGeometry args={geometry.args} />
          <meshStandardMaterial
            color={selected ? '#d7ff45' : element.color}
            roughness={0.72}
            metalness={0.04}
          />
          <Edges
            threshold={15}
            color={selected ? '#efffaf' : '#56615b'}
            opacity={selected ? 1 : 0.42}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
});

export default TerrainElement;
