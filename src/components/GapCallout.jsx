import { useEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useSceneStore from '../store/useSceneStore';
import { findFacingGap } from '../utils/gap.js';
import { paletteFor } from '../../ui/scenePalette.js';

const OFFSET = 0.32;
const TICK = 0.16;
const THICKNESS = 0.02;
const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);
const plane = new THREE.Plane();
const hitPoint = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function axisPoint(axis, along, cross, z) {
  return axis === 0 ? [along, cross, z] : [cross, along, z];
}

function Bar({ start, end, color }) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const length = Math.max(a.distanceTo(b), 0.001);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const direction = b.clone().sub(a);
  if (direction.lengthSq() < 1e-10) direction.set(1, 0, 0);
  else direction.normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
  return (
    <mesh position={mid} quaternion={quaternion} renderOrder={30} raycast={() => null}>
      <boxGeometry args={[length, THICKNESS, THICKNESS]} />
      <meshBasicMaterial color={color} depthTest={false} />
    </mesh>
  );
}

function formatGap(value) {
  return `${Number(Math.max(0, value).toFixed(3))} m`;
}

function GapCallout({ anchor, mover }) {
  const measurement = findFacingGap(anchor, mover);
  const theme = useSceneStore((state) => state.theme);
  const setPairGap = useSceneStore((state) => state.setPairGap);
  const setTransforming = useSceneStore((state) => state.setTransforming);
  const color = paletteFor(theme).accent;
  const dragRef = useRef(null);
  const controls = useThree((state) => state.controls);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);

  useEffect(() => () => {
    dragRef.current?.stop();
  }, []);

  if (!measurement) return null;

  const { axis, gap, moverSign, anchorEdge, moverEdge, overlapMax, z } = measurement;
  const cross = overlapMax + OFFSET;
  const height = z + 0.05;
  const start = axisPoint(axis, anchorEdge, cross, height);
  const end = axisPoint(axis, moverEdge, cross, height);
  const mid = axisPoint(axis, (anchorEdge + moverEdge) / 2, cross, height);
  const halfTick = TICK / 2;
  const cursor = axis === 0 ? 'ew-resize' : 'ns-resize';
  const span = Math.max(Math.abs(moverEdge - anchorEdge), 0.4);

  const project = (nativeEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    pointer.set(
      ((nativeEvent.clientX - rect.left) / rect.width) * 2 - 1,
      -((nativeEvent.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    plane.set(PLANE_NORMAL, -height);
    return raycaster.ray.intersectPlane(plane, hitPoint) ? hitPoint : null;
  };

  const onPointerDown = (event) => {
    event.stopPropagation();
    dragRef.current?.stop();
    const point = project(event.nativeEvent);
    if (!point) return;
    const startCursor = point.getComponent(axis);
    const startGap = gap;
    const sign = moverSign;
    const dragAxis = axis;
    const pointerId = event.nativeEvent.pointerId;
    const onMove = (nativeEvent) => {
      const nextPoint = project(nativeEvent);
      if (!nextPoint) return;
      const cursorDelta = nextPoint.getComponent(dragAxis) - startCursor;
      setPairGap(anchor.id, mover.id, dragAxis, Math.max(0, startGap + sign * cursorDelta));
    };
    // Capture phase: the dimension mesh stops pointerup, so a bubble
    // listener on window never sees the release.
    const endDrag = () => {
      if (dragRef.current?.onMove !== onMove) return;
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', endDrag, true);
      window.removeEventListener('pointercancel', endDrag, true);
      if (gl.domElement.hasPointerCapture?.(pointerId)) {
        gl.domElement.releasePointerCapture(pointerId);
      }
      if (controls) controls.enabled = true;
      gl.domElement.style.cursor = '';
      useSceneStore.getState().endHistoryTransaction();
      window.setTimeout(() => setTransforming(false), 0);
    };
    dragRef.current = { stop: endDrag, onMove };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', endDrag, true);
    window.addEventListener('pointercancel', endDrag, true);
    try {
      gl.domElement.setPointerCapture(pointerId);
    } catch {
      // Synthetic or already-released pointers cannot be captured.
    }
    useSceneStore.getState().beginHistoryTransaction();
    setTransforming(true);
    if (controls) controls.enabled = false;
    gl.domElement.style.cursor = cursor;
  };

  return (
    <group>
      <Bar start={start} end={end} color={color} />
      <Bar
        start={axisPoint(axis, anchorEdge, cross - halfTick, height)}
        end={axisPoint(axis, anchorEdge, cross + halfTick, height)}
        color={color}
      />
      <Bar
        start={axisPoint(axis, moverEdge, cross - halfTick, height)}
        end={axisPoint(axis, moverEdge, cross + halfTick, height)}
        color={color}
      />
      <mesh
        position={mid}
        onPointerDown={onPointerDown}
        onPointerUp={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onPointerOver={() => {
          if (!dragRef.current) gl.domElement.style.cursor = cursor;
        }}
        onPointerOut={() => {
          if (!dragRef.current) gl.domElement.style.cursor = '';
        }}
      >
        <boxGeometry args={axis === 0 ? [span, 0.28, 0.2] : [0.28, span, 0.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Html position={mid} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
        <div className="app-gap-label">{formatGap(gap)}</div>
      </Html>
    </group>
  );
}

export default GapCallout;
