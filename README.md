# MuJoCo Terrain Editor

[English](README.md) | [简体中文](README-zh.md)

A browser-based 3D terrain editor for MuJoCo. Build simulation environments from boxes, cylinders, ramps, stairs, and platforms, then export them as ready-to-load MJCF XML.

The editor runs entirely in the browser and provides interactive transforms, precise parameter controls, scene persistence through MJCF import/export, and a bilingual light/dark interface.

## Features

- Compose terrain visually with reusable box, cylinder, ramp, stair, and platform primitives.
- Move and rotate objects with 3D transform gizmos or edit their values precisely in the properties panel.
- Select and move multiple objects as a group.
- Keep objects automatically grounded at `Z = 0`, or disable ground locking for unrestricted vertical placement.
- Customize MJCF-compatible geom names and terrain colors.
- Undo, redo, duplicate, and delete objects with toolbar actions or keyboard shortcuts.
- Export the scene as standalone MJCF XML and import it later for continued editing.
- Save changes directly back to an opened XML file in browsers that support the File System Access API.
- Switch between English and Chinese interfaces and light or dark themes.

## Getting Started

Install the dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Usage

1. Drag a terrain primitive from the left sidebar into the viewport. Double-clicking a primitive adds it at the origin.
2. Select an object and use the toolbar to switch between move and rotate modes. Use the properties panel for exact dimensions and transforms.
3. Leave **Ground Lock** enabled to keep the bottom of the object on `Z = 0`, or disable it to edit the height freely.
4. Set the **Geom Name** used for the exported MJCF `<geom name="...">` attribute.
5. Select **Export XML** to download a timestamped file such as `terrain_08_06-21_21_.xml`.
6. Use **Load XML**, or drag an XML file anywhere onto the editor, to restore a scene and continue editing it. After loading a file, supported browsers expose a **Save** action that can overwrite the original file after permission is granted.

The editor protects unsaved changes before loading another file. Direct file saving requires a browser with File System Access API support, such as a current Chromium-based version of Chrome or Edge.

### Viewport Controls

- Left drag: orbit the camera, or manipulate the active transform gizmo.
- Right drag: pan the camera.
- Middle drag or mouse wheel: zoom.
- `Shift` / `Ctrl` / `Cmd` + click: add or remove an object from the current selection.

### Keyboard Shortcuts

| Action | Shortcut |
| --- | --- |
| Move mode | `W` |
| Rotate mode | `E` |
| Duplicate | `Ctrl+D` / `Cmd+D` |
| Undo | `Ctrl+Z` / `Cmd+Z` |
| Redo | `Ctrl+Shift+Z`, `Cmd+Shift+Z`, or `Ctrl/Cmd+Y` |
| Rotate 90° counterclockwise around Z | `Shift+[` |
| Rotate 90° clockwise around Z | `Shift+]` |
| Delete selection | `Delete` |
| Clear selection | `Esc` |

## Editor Conventions

- The scene, transform gizmos, and coordinate indicator use a right-handed, Z-up coordinate system.
- Lengths are expressed in meters and angles in degrees.
- Translation snaps in increments of `0.05 m`; rotation snaps in increments of `1°`.
- Translation gizmos operate in world space, while rotation gizmos operate in the selected object's local space.
- Multi-selection currently supports group translation only.
- MJCF names are restricted to ASCII letters, digits, underscores, hyphens, and periods.

## Terrain Parameters

- **Box:** width, depth, and height.
- **Cylinder:** radius and height.
- **Ramp:** surface width, horizontal length, and slope angle.
- **Stairs:** step width, step length, step height, and step count. Stairs rise along the positive X axis by default.
- **Platform:** width, depth, and height.

Default dimensions and terrain definitions are centralized in [`src/data/presets.js`](src/data/presets.js). Change a parameter's `default` value to update its initial dimensions. To introduce a new terrain type, add a `defineTerrainPreset` configuration; the component library, properties panel, ground-lock behavior, and XML exporter will use it automatically.

Editor-wide snapping increments and gizmo sizes are defined in [`src/editorConfig.js`](src/editorConfig.js).

## Roadmap

- [ ] Add configurable Perlin noise for terrain surfaces, including amplitude, frequency, and random seed controls, with MJCF export as a loadable height field or mesh.
- [ ] Deploy on Github Page.
