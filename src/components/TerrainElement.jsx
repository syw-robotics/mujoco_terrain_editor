import { forwardRef } from 'react';
import { Edges } from '@react-three/drei';
import { getPreset } from '../data/presets';
import useSceneStore from '../store/useSceneStore';

const TerrainElement = forwardRef(function TerrainElement({ element, selected = false }, ref) {
  const selectElement = useSceneStore((state) => state.selectElement);
  const colorPickTargetId = useSceneStore((state) => state.colorPickTargetId);
  const applyColorFromElement = useSceneStore((state) => state.applyColorFromElement);
  const theme = useSceneStore((state) => state.theme);
  const dark = theme === 'dark';
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
          rotation={geometry.shape === 'cylinder' ? [Math.PI / 2, 0, 0] : (geometry.rotation || [0, 0, 0])}
          castShadow
          receiveShadow
          onClick={(event) => {
            event.stopPropagation();
            if (colorPickTargetId) applyColorFromElement(element.id);
            else selectElement(element.id, event.shiftKey || event.ctrlKey || event.metaKey);
          }}
        >
          {geometry.shape === 'cylinder' ? (
            <cylinderGeometry args={[geometry.args[0], geometry.args[0], geometry.args[1], 48]} />
          ) : (
            <boxGeometry args={geometry.args} />
          )}
          <meshStandardMaterial
            color={element.color}
            emissive={selected ? (dark ? '#60a5fa' : '#2563eb') : '#000000'}
            emissiveIntensity={selected ? 0.12 : 0}
            roughness={0.72}
            metalness={0.04}
          />
          <Edges
            threshold={15}
            color={selected ? (dark ? '#bfdbfe' : '#123f9c') : (dark ? '#64748b' : '#6f8194')}
            opacity={selected ? 1 : 0.42}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
});

export default TerrainElement;
