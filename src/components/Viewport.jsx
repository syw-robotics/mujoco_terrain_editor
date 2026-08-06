import { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import GroundPlane from './GroundPlane';
import TerrainElement from './TerrainElement';
import TransformGizmo from './TransformGizmo';
import useSceneStore from '../store/useSceneStore';

function Scene() {
  const elements = useSceneStore((state) => state.elements);
  const selectedId = useSceneStore((state) => state.selectedId);
  const selected = elements.find((element) => element.id === selectedId);

  return (
    <>
      <color attach="background" args={['#101412']} />
      <fog attach="fog" args={['#101412', 19, 42]} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#dceee4', '#141712', 0.65]} />
      <directionalLight
        position={[-7, -9, 14]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <GroundPlane />
      {elements.filter((element) => element.id !== selectedId).map((element) => (
        <TerrainElement key={element.id} element={element} />
      ))}
      {selected && <TransformGizmo key={selected.id} element={selected} />}
      <OrbitControls makeDefault target={[0, 0, 0.5]} minDistance={2} maxDistance={42} />
      <GizmoHelper alignment="bottom-right" margin={[74, 74]}>
        <GizmoViewport
          hideNegativeAxes
          scale={[40, -40, 40]}
          axisColors={['#f06460', '#6fc66f', '#638fe3']}
          labelColor="white"
        />
      </GizmoHelper>
    </>
  );
}

function Viewport() {
  const containerRef = useRef(null);
  const cameraRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const addElement = useSceneStore((state) => state.addElement);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const type = event.dataTransfer.getData('application/x-terrain-preset')
      || event.dataTransfer.getData('text/plain');
    const camera = cameraRef.current;
    const container = containerRef.current;
    if (!type || !camera || !container) return;

    const rect = container.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const point = new THREE.Vector3();
    const ground = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    if (raycaster.ray.intersectPlane(ground, point)) {
      addElement(type, [point.x, point.y, 0]);
    }
  };

  return (
    <section
      ref={containerRef}
      className={`viewport ${dragActive ? 'drag-active' : ''}`}
      onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
      }}
      onDrop={handleDrop}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [8, -10, 7.5], up: [0, 0, 1], fov: 46, near: 0.1, far: 100 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={({ camera, gl }) => {
          camera.up.set(0, 0, 1);
          cameraRef.current = camera;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}><Scene /></Suspense>
      </Canvas>
      <div className="viewport-badge">
        Z-UP · GRID 1.0 M &nbsp; <span className="axis-key"><b>X</b> <b>Y</b> <b>Z</b></span>
      </div>
    </section>
  );
}

export default Viewport;
