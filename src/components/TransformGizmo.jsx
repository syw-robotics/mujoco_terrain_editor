import { useLayoutEffect, useRef } from 'react';
import { TransformControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import TerrainElement from './TerrainElement';
import useSceneStore from '../store/useSceneStore';
import { GIZMO_SIZE, ROTATION_SNAP_DEGREES, TRANSLATION_SNAP } from '../editorConfig';

const ROTATION_SNAP = THREE.MathUtils.degToRad(ROTATION_SNAP_DEGREES);
const AXIS_COLORS = {
  x: '#ff4d48',
  y: '#54d66d',
  z: '#5f91ff',
};

function AxisMaterial({ color, opacity = 1, doubleSided = false }) {
  return (
    <meshBasicMaterial
      color={color}
      opacity={opacity}
      transparent={opacity < 1}
      depthTest={false}
      depthWrite={false}
      toneMapped={false}
      side={doubleSided ? THREE.DoubleSide : THREE.FrontSide}
    />
  );
}

function useMarkerFollow(objectRef, followRotation = true) {
  const markerRef = useRef();
  const cameraPosition = useRef(new THREE.Vector3());
  const objectPosition = useRef(new THREE.Vector3());
  const objectQuaternion = useRef(new THREE.Quaternion());

  // Keep the custom visual attached to the real object while preserving a
  // nearly constant screen size as the camera moves or zooms.
  useFrame(({ camera }) => {
    const marker = markerRef.current;
    const object = objectRef.current;
    if (!marker || !object) return;

    object.getWorldPosition(objectPosition.current);
    object.getWorldQuaternion(objectQuaternion.current);
    camera.getWorldPosition(cameraPosition.current);
    marker.position.copy(objectPosition.current);
    if (followRotation) marker.quaternion.copy(objectQuaternion.current);
    else marker.quaternion.identity();

    const distance = objectPosition.current.distanceTo(cameraPosition.current);
    const perspectiveFactor = camera.isPerspectiveCamera
      ? Math.min(1.9 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / camera.zoom, 7)
      : 1 / camera.zoom;
    marker.scale.setScalar(distance * perspectiveFactor * GIZMO_SIZE / 7);
    marker.visible = true;
  });

  return markerRef;
}

function AxisArrow({ color, length }) {
  return (
    <mesh renderOrder={10002}>
      <coneGeometry args={[0.075, length, 16]} />
      <AxisMaterial color={color} />
    </mesh>
  );
}

function TranslationMarker({ objectRef, showZ, accent }) {
  const markerRef = useMarkerFollow(objectRef, false);

  const shaftLength = 0.78;
  const arrowLength = 0.2;
  const endpoint = shaftLength + arrowLength / 2;
  const shaftRadius = 0.012;

  return (
    <group ref={markerRef} visible={false} renderOrder={10000}>
      <mesh position={[shaftLength / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]} renderOrder={10001}>
        <cylinderGeometry args={[shaftRadius, shaftRadius, shaftLength, 8]} />
        <AxisMaterial color={AXIS_COLORS.x} />
      </mesh>
      <group position={[endpoint, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <AxisArrow color={AXIS_COLORS.x} length={arrowLength} />
      </group>

      <mesh position={[0, shaftLength / 2, 0]} renderOrder={10001}>
        <cylinderGeometry args={[shaftRadius, shaftRadius, shaftLength, 8]} />
        <AxisMaterial color={AXIS_COLORS.y} />
      </mesh>
      <group position={[0, endpoint, 0]}>
        <AxisArrow color={AXIS_COLORS.y} length={arrowLength} />
      </group>

      {showZ && (
        <>
          <mesh position={[0, 0, shaftLength / 2]} rotation={[Math.PI / 2, 0, 0]} renderOrder={10001}>
            <cylinderGeometry args={[shaftRadius, shaftRadius, shaftLength, 8]} />
            <AxisMaterial color={AXIS_COLORS.z} />
          </mesh>
          <group position={[0, 0, endpoint]} rotation={[Math.PI / 2, 0, 0]}>
            <AxisArrow color={AXIS_COLORS.z} length={arrowLength} />
          </group>
        </>
      )}

      <mesh position={[0.18, 0.18, 0.002]} renderOrder={10000}>
        <planeGeometry args={[0.32, 0.32]} />
        <AxisMaterial color={accent} opacity={0.28} doubleSided />
      </mesh>
      {showZ && (
        <>
          <mesh position={[0.002, 0.18, 0.18]} rotation={[0, Math.PI / 2, 0]} renderOrder={10000}>
            <planeGeometry args={[0.32, 0.32]} />
            <AxisMaterial color={AXIS_COLORS.x} opacity={0.25} doubleSided />
          </mesh>
          <mesh position={[0.18, 0.002, 0.18]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10000}>
            <planeGeometry args={[0.32, 0.32]} />
            <AxisMaterial color={AXIS_COLORS.y} opacity={0.25} doubleSided />
          </mesh>
        </>
      )}
    </group>
  );
}

function TransformGizmo({ elements }) {
  const controlsRef = useRef();
  const objectRef = useRef();
  const boundsRef = useRef(new THREE.Box3());
  const transformMode = useSceneStore((state) => state.transformMode);
  const updateElement = useSceneStore((state) => state.updateElement);
  const moveElements = useSceneStore((state) => state.moveElements);
  const setTransforming = useSceneStore((state) => state.setTransforming);
  const theme = useSceneStore((state) => state.theme);
  const multiSelection = elements.length > 1;
  const element = elements[elements.length - 1];
  const effectiveMode = multiSelection ? 'translate' : transformMode;
  const groundConstrained = multiSelection
    ? elements.some((item) => item.groundLocked)
    : element.groundLocked;
  const pivot = elements.reduce((center, item) => [
    center[0] + item.position[0] / elements.length,
    center[1] + item.position[1] / elements.length,
    center[2] + item.position[2] / elements.length,
  ], [0, 0, 0]);

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    const gizmo = controls?.gizmo;
    if (!gizmo) return undefined;

    const originalUpdate = gizmo.updateMatrixWorld;
    const disabledPickers = new Map();
    const positiveAxisPickers = [];
    const positivePlanePickers = [];
    const disablePicker = (picker) => {
      if (disabledPickers.has(picker)) return;
      disabledPickers.set(picker, picker.raycast);
      picker.raycast = () => {};
    };

    // Keep only pickers that point toward the custom marker's positive axes.
    // Some TransformControls versions provide positive/negative meshes,
    // while others provide one mesh and flip its scale toward the camera.
    for (const picker of gizmo.picker.translate.children) {
      const axisIndex = { X: 0, Y: 1, Z: 2 }[picker.name];
      if (axisIndex !== undefined) {
        picker.geometry.computeBoundingBox();
        const center = picker.geometry.boundingBox.getCenter(new THREE.Vector3());
        if (center.getComponent(axisIndex) < 0) disablePicker(picker);
        else positiveAxisPickers.push({ picker, axisIndex });
      }
      if (picker.name === 'XY' || picker.name === 'YZ' || picker.name === 'XZ') {
        positivePlanePickers.push(picker);
      }
    }

    // Drei does not expose per-axis picker disabling. Ground lock therefore
    // disables the hidden TransformControls raycasters while our own marker
    // remains purely visual. Keep this isolated because it relies on Three.js
    // TransformControls' internal picker layout.
    if (groundConstrained) {
      for (const picker of gizmo.picker.rotate.children) {
        if (picker.name === 'Z') continue;
        disablePicker(picker);
      }
      for (const picker of gizmo.picker.translate.children) {
        if (picker.name === 'X' || picker.name === 'Y' || picker.name === 'XY') continue;
        disablePicker(picker);
      }
    }

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
      originalUpdate.call(gizmo, ...args);

      for (const { picker, axisIndex } of positiveAxisPickers) {
        if (disabledPickers.has(picker) || !picker.visible) continue;
        for (let index = 0; index < 3; index += 1) {
          const hitScale = index === axisIndex ? 1.75 : 1.25;
          const scale = picker.scale.getComponent(index);
          picker.scale.setComponent(index, (index === axisIndex ? Math.abs(scale) : scale) * hitScale);
        }
        // TransformControls already updated its children before this custom
        // hit-area scale is applied, so refresh the picker matrix explicitly.
        picker.updateMatrixWorld(true);
      }

      for (const picker of positivePlanePickers) {
        if (disabledPickers.has(picker) || !picker.visible) continue;
        picker.scale.x = Math.abs(picker.scale.x) * 1.45;
        picker.scale.y = Math.abs(picker.scale.y) * 1.45;
        picker.updateMatrixWorld(true);
      }

      // Three.js 默认会在拖动时绘制贯穿场景的正负辅助轴。
      // 编辑器只保留从物体中心出发的正半轴手柄。
      for (const helperGroup of Object.values(gizmo.helper)) {
        for (const helper of helperGroup.children) helper.visible = false;
      }
      gizmo.gizmo.translate.visible = false;
    };

    return () => {
      gizmo.updateMatrixWorld = originalUpdate;
      for (const [picker, raycast] of disabledPickers) picker.raycast = raycast;
    };
  }, [groundConstrained]);

  const syncTransform = () => {
    const object = controlsRef.current?.object;
    if (!object) return;
    if (multiSelection) {
      moveElements(
        elements.map((item) => item.id),
        [object.position.x - pivot[0], object.position.y - pivot[1], object.position.z - pivot[2]],
      );
      return;
    }
    updateElement(element.id, {
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [
        object.rotation.x * 180 / Math.PI,
        object.rotation.y * 180 / Math.PI,
        object.rotation.z * 180 / Math.PI,
      ],
    });
  };

  const enforceGroundLock = () => {
    const object = controlsRef.current?.object;
    if (!object || multiSelection || !element.groundLocked) return;
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
    // Defer the flag reset past the pointer-up click so GroundPlane does not
    // immediately clear the selection at the end of a transform drag.
    window.setTimeout(() => setTransforming(false), 0);
  };

  return (
    <>
      {multiSelection ? (
        <group ref={objectRef} position={pivot}>
          {elements.map((item) => (
            <TerrainElement
              key={item.id}
              element={{
                ...item,
                position: [
                  item.position[0] - pivot[0],
                  item.position[1] - pivot[1],
                  item.position[2] - pivot[2],
                ],
              }}
              selected
            />
          ))}
        </group>
      ) : (
        <TerrainElement ref={objectRef} element={element} selected />
      )}
      {effectiveMode === 'translate' && (
        <TranslationMarker
          objectRef={objectRef}
          showZ={!groundConstrained}
          accent={theme === 'dark' ? '#60a5fa' : '#2563eb'}
        />
      )}
      <TransformControls
        ref={controlsRef}
        object={objectRef}
        mode={effectiveMode}
        space={effectiveMode === 'translate' ? 'world' : 'local'}
        size={GIZMO_SIZE}
        showX={!(groundConstrained && effectiveMode === 'rotate')}
        showY={!(groundConstrained && effectiveMode === 'rotate')}
        showZ={effectiveMode === 'rotate' || !groundConstrained}
        translationSnap={TRANSLATION_SNAP}
        rotationSnap={ROTATION_SNAP}
        onObjectChange={enforceGroundLock}
        onMouseDown={() => setTransforming(true)}
        onMouseUp={finishTransform}
      />
    </>
  );
}

export default TransformGizmo;
