import { useLayoutEffect, useRef } from 'react';
import { TransformControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import TerrainElement from './TerrainElement';
import useSceneStore from '../store/useSceneStore';

const TRANSLATION_SNAP = 0.05;
const ROTATION_SNAP = Math.PI / 180;
const SCALE_SNAP = 0.1;
const DEFAULT_GIZMO_SIZE = 0.78;
const SCALE_GIZMO_SIZE = 1.02;
const AXIS_COLORS = {
  x: '#ff4d48',
  y: '#54d66d',
  z: '#5f91ff',
};

function AxisMaterial({ color, opacity = 1 }) {
  return (
    <meshBasicMaterial
      color={color}
      opacity={opacity}
      transparent={opacity < 1}
      depthTest={false}
      depthWrite={false}
      toneMapped={false}
    />
  );
}

function PositiveAxisMarker({ objectRef, mode, showZ }) {
  const markerRef = useRef();
  const cameraPosition = useRef(new THREE.Vector3());
  const objectPosition = useRef(new THREE.Vector3());
  const objectQuaternion = useRef(new THREE.Quaternion());

  useFrame(({ camera }) => {
    const marker = markerRef.current;
    const object = objectRef.current;
    if (!marker || !object) return;

    object.getWorldPosition(objectPosition.current);
    object.getWorldQuaternion(objectQuaternion.current);
    camera.getWorldPosition(cameraPosition.current);
    marker.position.copy(objectPosition.current);
    marker.quaternion.copy(objectQuaternion.current);

    const distance = objectPosition.current.distanceTo(cameraPosition.current);
    const perspectiveFactor = camera.isPerspectiveCamera
      ? Math.min(1.9 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / camera.zoom, 7)
      : 1 / camera.zoom;
    const gizmoSize = mode === 'scale' ? SCALE_GIZMO_SIZE : DEFAULT_GIZMO_SIZE;
    marker.scale.setScalar(distance * perspectiveFactor * gizmoSize / 7);
    marker.visible = true;
  });

  const shaftLength = 0.78;
  const scaleHandleSize = 0.18;
  const arrowLength = 0.2;
  const endpoint = mode === 'scale'
    ? shaftLength + scaleHandleSize / 2
    : shaftLength + arrowLength / 2;
  const shaftRadius = mode === 'scale' ? 0.017 : 0.012;

  const AxisEnd = ({ color }) => mode === 'scale' ? (
    <mesh renderOrder={10002}>
      <boxGeometry args={[scaleHandleSize, scaleHandleSize, scaleHandleSize]} />
      <AxisMaterial color={color} />
    </mesh>
  ) : (
    <mesh renderOrder={10002}>
      <coneGeometry args={[0.075, arrowLength, 16]} />
      <AxisMaterial color={color} />
    </mesh>
  );

  return (
    <group ref={markerRef} visible={false} renderOrder={10000}>
      <mesh position={[shaftLength / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]} renderOrder={10001}>
        <cylinderGeometry args={[shaftRadius, shaftRadius, shaftLength, 8]} />
        <AxisMaterial color={AXIS_COLORS.x} />
      </mesh>
      <group position={[endpoint, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <AxisEnd color={AXIS_COLORS.x} />
      </group>

      <mesh position={[0, shaftLength / 2, 0]} renderOrder={10001}>
        <cylinderGeometry args={[shaftRadius, shaftRadius, shaftLength, 8]} />
        <AxisMaterial color={AXIS_COLORS.y} />
      </mesh>
      <group position={[0, endpoint, 0]}>
        <AxisEnd color={AXIS_COLORS.y} />
      </group>

      {showZ && (
        <>
          <mesh position={[0, 0, shaftLength / 2]} rotation={[Math.PI / 2, 0, 0]} renderOrder={10001}>
            <cylinderGeometry args={[shaftRadius, shaftRadius, shaftLength, 8]} />
            <AxisMaterial color={AXIS_COLORS.z} />
          </mesh>
          <group position={[0, 0, endpoint]} rotation={[Math.PI / 2, 0, 0]}>
            <AxisEnd color={AXIS_COLORS.z} />
          </group>
        </>
      )}

      {mode === 'translate' && (
        <mesh position={[0.13, 0.13, 0.002]} renderOrder={10000}>
          <planeGeometry args={[0.22, 0.22]} />
          <AxisMaterial color="#d7ff45" opacity={0.32} />
        </mesh>
      )}
    </group>
  );
}

function TransformGizmo({ element }) {
  const controlsRef = useRef();
  const objectRef = useRef();
  const boundsRef = useRef(new THREE.Box3());
  const transformMode = useSceneStore((state) => state.transformMode);
  const updateElement = useSceneStore((state) => state.updateElement);
  const setTransforming = useSceneStore((state) => state.setTransforming);

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    const gizmo = controls?.gizmo;
    if (!gizmo) return undefined;

    const originalUpdate = gizmo.updateMatrixWorld;

    gizmo.traverse((object) => {
      object.renderOrder = 10000;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        material.depthTest = false;
        material.depthWrite = false;
        material.transparent = true;
        material.needsUpdate = true;
      }
    });

    gizmo.updateMatrixWorld = (...args) => {
      originalUpdate(...args);

      // Three.js 默认会在拖动时绘制贯穿场景的正负辅助轴。
      // 编辑器只保留从物体中心出发的正半轴手柄。
      for (const helperGroup of Object.values(gizmo.helper)) {
        for (const helper of helperGroup.children) helper.visible = false;
      }
      gizmo.gizmo.translate.visible = false;
      gizmo.gizmo.scale.visible = false;
    };

    return () => {
      gizmo.updateMatrixWorld = originalUpdate;
    };
  }, []);

  const syncTransform = () => {
    const object = controlsRef.current?.object;
    if (!object) return;
    updateElement(element.id, {
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [
        object.rotation.x * 180 / Math.PI,
        object.rotation.y * 180 / Math.PI,
        object.rotation.z * 180 / Math.PI,
      ],
      scale: [
        Math.max(SCALE_SNAP, object.scale.x),
        Math.max(SCALE_SNAP, object.scale.y),
        Math.max(SCALE_SNAP, object.scale.z),
      ],
    });
  };

  const enforceGroundLock = () => {
    const object = controlsRef.current?.object;
    if (!object || !element.groundLocked) return;
    object.updateMatrixWorld(true);
    boundsRef.current.setFromObject(object);
    if (Number.isFinite(boundsRef.current.min.z)) {
      object.position.z -= boundsRef.current.min.z;
      object.updateMatrixWorld(true);
    }
  };

  const finishTransform = () => {
    enforceGroundLock();
    syncTransform();
    window.setTimeout(() => setTransforming(false), 0);
  };

  return (
    <>
      <TerrainElement ref={objectRef} element={element} selected />
      {(transformMode === 'translate' || transformMode === 'scale') && (
        <PositiveAxisMarker
          objectRef={objectRef}
          mode={transformMode}
          showZ={!(element.groundLocked && transformMode === 'translate')}
        />
      )}
      <TransformControls
        ref={controlsRef}
        object={objectRef}
        mode={transformMode}
        space="local"
        size={transformMode === 'scale' ? SCALE_GIZMO_SIZE : DEFAULT_GIZMO_SIZE}
        showZ={!(element.groundLocked && transformMode === 'translate')}
        translationSnap={TRANSLATION_SNAP}
        rotationSnap={ROTATION_SNAP}
        scaleSnap={SCALE_SNAP}
        onObjectChange={enforceGroundLock}
        onMouseDown={() => setTransforming(true)}
        onMouseUp={finishTransform}
      />
    </>
  );
}

export default TransformGizmo;
