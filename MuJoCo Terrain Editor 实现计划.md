# MuJoCo Terrain Editor — Minimal 实现计划

> 纯前端 Web GUI 编辑器，拖拽添加地形组件，导出 MuJoCo XML。
> 无后端，浏览器直接运行，`npm run dev` 启动。

---

## 一、技术选型

| 层级 | 选型 | 理由 |
|------|------|------|
| 构建工具 | **Vite** | 秒级冷启动，HMR 即时生效 |
| UI 框架 | **React 18** | 生态最成熟，与 R3F 原生配合 |
| 3D 引擎 | **Three.js** | WebGL 事实标准 |
| React 3D 绑定 | **@react-three/fiber** | 声明式写法，代码量比命令式少 60% |
| 3D 工具库 | **@react-three/drei** | TransformControls、Grid、OrbitControls 开箱即用 |
| 状态管理 | **Zustand** | 极简（<1KB），API 直观，无 Provider 嵌套 |
| 拖拽 | **HTML5 Drag & Drop** | 原生 API 足够，不需要额外库 |
| XML 生成 | **模板字符串** | MuJoCo XML 结构扁平，无需 XML 解析库 |
| 样式 | **Tailwind CSS** | 原子化 CSS，写 UI 最快 |

---

## 二、项目结构

```
mujoco-terrain-editor/
├── index.html                  # HTML 入口
├── package.json                # 依赖与脚本
├── vite.config.js              # Vite 配置
├── tailwind.config.js          # Tailwind 配置
├── postcss.config.js           # PostCSS 配置
├── src/
│   ├── main.jsx                # React 入口
│   ├── index.css               # 全局样式 + Tailwind 指令
│   ├── App.jsx                 # 主布局：左面板 + 视口 + 右面板
│   ├── store/
│   │   └── useSceneStore.js    # 场景状态管理（Zustand）
│   ├── components/
│   │   ├── Viewport.jsx        # 3D 画布（R3F Canvas）
│   │   ├── Sidebar.jsx         # 左侧：组件库面板
│   │   ├── PropertiesPanel.jsx # 右侧：选中元素属性编辑
│   │   ├── TopBar.jsx          # 顶部：保存/导入/清空
│   │   ├── TerrainElement.jsx  # 单个地形元素的 3D 渲染
│   │   └── GroundPlane.jsx     # 参考地面 + 网格
│   ├── utils/
│   │   ├── xmlExporter.js      # 场景 → MuJoCo XML 字符串
│   │   └── xmlImporter.js      # XML → 场景元素（可选，MVP 可后补）
│   └── data/
│       └── presets.js          # 预设组件定义（box/斜坡/楼梯/平台）
```

---

## 三、核心数据结构

### 3.1 场景元素模型

每个地形元素统一用以下结构描述，所有组件共享同一套 schema：

```javascript
{
  id: "elem_abc123",          // 唯一标识，nanoid 生成
  type: "box",                // 基础类型: box | ramp | stairs | platform
  name: "Box 1",              // 显示名称，用于面板和 XML name 属性
  position: [0, 0, 0],        // [x, y, z]，与 MuJoCo pos 一一对应
  rotation: [0, 0, 0],        // [rx, ry, rz]，欧拉角（度），导出时转 quat
  scale: [1, 1, 1],           // [sx, sy, sz]，缩放系数
  color: "#cccccc",           // 显示颜色，导出为 rgba
  params: {                   // 每种 type 特有的几何参数
    // box:      { width, depth, height }
    // ramp:     { width, depth, height }
    // stairs:   { width, depth, height, steps }
    // platform: { width, depth, thickness }
  }
}
```

### 3.2 Zustand Store

集中管理场景状态，所有组件通过 hook 读写：

```javascript
// src/store/useSceneStore.js
import { create } from 'zustand';
import { nanoid } from 'nanoid';

const useSceneStore = create((set, get) => ({
  // ===== 状态 =====
  elements: [],          // 所有地形元素数组
  selectedId: null,      // 当前选中元素的 ID，null 表示无选中
  transformMode: 'translate',  // 变换模式: translate | rotate | scale

  // ===== 操作 =====

  /** 在指定位置添加一个预设类型的元素 */
  addElement: (presetType, position = [0, 0, 0]) => {
    const preset = PRESETS.find(p => p.type === presetType);
    if (!preset) return;

    const newElement = {
      id: nanoid(8),
      type: presetType,
      name: `${preset.label} ${get().elements.length + 1}`,
      position: [...position],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#a0a0a0',
      params: { ...preset.defaultParams },
    };

    set(state => ({
      elements: [...state.elements, newElement],
      selectedId: newElement.id,  // 添加后自动选中
    }));
  },

  /** 删除指定 ID 的元素 */
  removeElement: (id) => set(state => ({
    elements: state.elements.filter(el => el.id !== id),
    selectedId: state.selectedId === id ? null : state.selectedId,
  })),

  /** 部分更新指定元素（位置、旋转、参数等） */
  updateElement: (id, patch) => set(state => ({
    elements: state.elements.map(el =>
      el.id === id ? { ...el, ...patch } : el
    ),
  })),

  /** 选中指定元素，传 null 取消选中 */
  selectElement: (id) => set({ selectedId: id }),

  /** 切换变换手柄模式 */
  setTransformMode: (mode) => set({ transformMode: mode }),

  /** 清空所有元素 */
  clearAll: () => set({ elements: [], selectedId: null }),

  /** 批量导入元素（用于加载工程文件） */
  loadElements: (elements) => set({ elements, selectedId: null }),
}));

export default useSceneStore;
```

---

## 四、预设组件定义

所有可拖拽的地形组件集中定义在 `presets.js` 中，每个预设包含：
- 显示信息（名称、图标）
- 默认参数
- Three.js 几何体生成函数（用于编辑器内渲染）
- MuJoCo XML 属性生成函数（用于导出）

```javascript
// src/data/presets.js

/**
 * 预设地形组件库
 * 每个预设定义了编辑器渲染和 XML 导出两套逻辑，
 * 新增组件只需在此数组中添加一项即可。
 */
export const PRESETS = [
  // ---------- 方块 ----------
  {
    type: 'box',
    label: '方块',
    icon: '⬛',
    defaultParams: { width: 1, depth: 1, height: 1 },

    /**
     * 生成 Three.js 几何体配置
     * 返回单 mesh 配置或 mesh 数组（复合元素）
     */
    toGeometries: (params) => [{
      args: [params.width, params.depth, params.height],
      position: [0, 0, 0],
    }],

    /**
     * 生成 MuJoCo <geom> 属性对象
     * 注意：MuJoCo 的 size 是半长，Three.js 是全长，需要 /2
     */
    toMujocoGeoms: (elem) => [{
      type: 'box',
      size: `${elem.params.width / 2} ${elem.params.depth / 2} ${elem.params.height / 2}`,
    }],
  },

  // ---------- 斜坡 ----------
  {
    type: 'ramp',
    label: '斜坡',
    icon: '📐',
    defaultParams: { width: 2, depth: 3, height: 1 },

    /**
     * 斜坡实现：一个薄 box 绕 X 轴倾斜
     * 通过子 mesh 的位置和旋转实现倾斜效果
     */
    toGeometries: (params) => {
      // 计算倾斜角度：tan(θ) = height / depth
      const angle = Math.atan2(params.height, params.depth);
      // 斜坡长度（斜边）
      const length = Math.sqrt(params.depth ** 2 + params.height ** 2);
      // 斜坡中点高度
      const midHeight = params.height / 2;
      // 斜坡中点沿深度方向偏移
      const midDepth = params.depth / 2;

      return [{
        args: [params.width, length, 0.05],
        position: [0, midDepth, midHeight],
        rotation: [-angle, 0, 0],  // 绕 X 轴倾斜
      }];
    },

    toMujocoGeoms: (elem) => {
      const { width, depth, height } = elem.params;
      const angle = Math.atan2(height, depth);
      const length = Math.sqrt(depth ** 2 + height ** 2);

      return [{
        type: 'box',
        size: `${width / 2} ${length / 2} 0.025`,
        // MuJoCo 用 euler 或 quat 表示旋转，这里用 euler (rad)
        euler: `${-angle} 0 0`,
        pos: `0 ${depth / 2} ${height / 2}`,
      }];
    },
  },

  // ---------- 楼梯 ----------
  {
    type: 'stairs',
    label: '楼梯',
    icon: '🪜',
    defaultParams: { width: 2, depth: 2, height: 1.5, steps: 5 },

    /**
     * 楼梯是复合元素：N 个 box 阶梯排列
     * 返回 mesh 数组，每个 mesh 有自己的局部位置
     */
    toGeometries: (params) => {
      const { width, depth, height, steps } = params;
      const stepHeight = height / steps;   // 每级高度
      const stepDepth = depth / steps;     // 每级深度
      const meshes = [];

      for (let i = 0; i < steps; i++) {
        // 第 i 级台阶（从低到高）
        const currentHeight = stepHeight * (i + 1);
        const currentDepthOffset = -depth / 2 + stepDepth * (i + 0.5);

        meshes.push({
          args: [width, stepDepth * 0.98, currentHeight],  // *0.98 留缝隙避免 z-fighting
          position: [0, currentDepthOffset, currentHeight / 2],
        });
      }
      return meshes;
    },

    toMujocoGeoms: (elem) => {
      const { width, depth, height, steps } = elem.params;
      const stepHeight = height / steps;
      const stepDepth = depth / steps;
      const geoms = [];

      for (let i = 0; i < steps; i++) {
        const currentHeight = stepHeight * (i + 1);
        const currentDepthOffset = -depth / 2 + stepDepth * (i + 0.5);
        geoms.push({
          type: 'box',
          size: `${width / 2} ${stepDepth / 2} ${currentHeight / 2}`,
          pos: `0 ${currentDepthOffset} ${currentHeight / 2}`,
        });
      }
      return geoms;
    },
  },

  // ---------- 平台 ----------
  {
    type: 'platform',
    label: '平台',
    icon: '🟫',
    defaultParams: { width: 3, depth: 3, thickness: 0.2 },

    toGeometries: (params) => [{
      args: [params.width, params.depth, params.thickness],
      position: [0, 0, 0],
    }],

    toMujocoGeoms: (elem) => [{
      type: 'box',
      size: `${elem.params.width / 2} ${elem.params.depth / 2} ${elem.params.thickness / 2}`,
    }],
  },
];

/** 按类型查找预设，常用操作抽成工具函数 */
export function getPreset(type) {
  return PRESETS.find(p => p.type === type);
}
```

---

## 五、分步实现路线

### Phase 1：项目骨架 + 3D 视口

**目标**：启动后看到带网格的 3D 地面，可旋转缩放。

**步骤**：

1. 初始化项目
   ```bash
   npm create vite@latest mujoco-terrain-editor -- --template react
   cd mujoco-terrain-editor
   npm install
   ```

2. 安装依赖
   ```bash
   npm install three @react-three/fiber @react-three/drei zustand nanoid
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

3. 配置 Tailwind（`tailwind.config.js` 中添加 content 路径）

4. 写 `App.jsx` 三栏布局：
   - 左侧面板 `w-56`（224px）
   - 中间视口 `flex-1`
   - 右侧面板 `w-72`（288px）

5. 写 `Viewport.jsx`：
   - `<Canvas camera={{ position: [8, 8, 6], fov: 50 }}>`
   - `<OrbitControls makeDefault />`（来自 drei）
   - `<Grid args={[20, 20]} cellSize={1} cellThickness={0.5} />`（参考网格）
   - 环境光 + 方向光

6. 写 `GroundPlane.jsx`：
   - 一个大的薄 box 作为地面参考，颜色较暗
   - 不参与选中，仅作视觉参考

**验收**：`npm run dev` 打开页面，看到灰色地面 + 网格，鼠标拖拽可旋转视角。

---

### Phase 2：状态管理 + 元素渲染

**目标**：往 store 添加元素，3D 视口实时渲染。

**步骤**：

1. 写 `useSceneStore.js`（见第三章数据结构）

2. 写 `TerrainElement.jsx`：
   - 从 props 接收 element 对象
   - 根据 `element.type` 找到对应 preset
   - 调用 `preset.toGeometries(params)` 拿到 mesh 配置列表
   - 外层 `<group>` 应用 position / rotation / scale
   - 内层遍历 meshes，每个渲染一个 `<mesh>`
   - 被选中时材质换高亮色

   ```jsx
   // src/components/TerrainElement.jsx
   import { useRef } from 'react';
   import useSceneStore from '../store/useSceneStore';
   import { getPreset } from '../data/presets';

   /**
    * 单个地形元素的 3D 渲染组件
    * 外层 group 负责整体变换，内层 mesh 负责几何细节
    */
   function TerrainElement({ element }) {
     const meshRef = useRef();
     const { selectedId, selectElement } = useSceneStore();
     const isSelected = selectedId === element.id;

     const preset = getPreset(element.type);
     if (!preset) return null;

     const meshes = preset.toGeometries(element.params);

     // 选中时颜色变亮 + 加线框，未选中时用元素自身颜色
     const displayColor = isSelected ? '#4a9eff' : element.color;

     return (
       <group
         position={element.position}
         rotation={element.rotation.map(deg => deg * Math.PI / 180)}
         scale={element.scale}
       >
         {meshes.map((mesh, i) => (
           <mesh
             key={i}
             ref={i === 0 ? meshRef : undefined}
             position={mesh.position}
             rotation={mesh.rotation || [0, 0, 0]}
             onClick={(e) => {
               e.stopPropagation();  // 阻止冒泡到 Canvas
               selectElement(element.id);
             }}
           >
             <boxGeometry args={mesh.args} />
             <meshStandardMaterial
               color={displayColor}
               wireframe={isSelected}  // 选中时显示线框，直观区分
             />
           </mesh>
         ))}
       </group>
     );
   }

   export default TerrainElement;
   ```

3. 在 `Viewport.jsx` 中遍历 `elements` 渲染：
   ```jsx
   const elements = useSceneStore(s => s.elements);
   // ...
   {elements.map(el => (
     <TerrainElement key={el.id} element={el} />
   ))}
   ```

4. 手动在 store 初始化时塞 2~3 个测试元素，验证渲染正确。

**验收**：页面加载后能看到几个 3D 几何体，视角可旋转。

---

### Phase 3：拖拽添加组件

**目标**：从左侧面板拖组件到 3D 视口，在落点生成对应地形元素。

**步骤**：

1. 写 `Sidebar.jsx`：
   - 遍历 `PRESETS` 渲染可拖拽卡片
   - 每张卡片显示图标 + 名称
   - `draggable="true"`，`onDragStart` 中设置 `dataTransfer.setData('presetType', preset.type)`

   ```jsx
   // src/components/Sidebar.jsx
   import { PRESETS } from '../data/presets';

   function Sidebar() {
     /** 拖拽开始：把组件类型写入 dataTransfer，供 drop 端读取 */
     const handleDragStart = (e, presetType) => {
       e.dataTransfer.setData('presetType', presetType);
       e.dataTransfer.effectAllowed = 'copy';
     };

     return (
       <div className="w-56 bg-gray-800 p-4 border-r border-gray-700 overflow-y-auto">
         <h2 className="text-white font-semibold mb-4 text-sm">组件库</h2>
         <div className="space-y-2">
           {PRESETS.map(preset => (
             <div
               key={preset.type}
               draggable
               onDragStart={(e) => handleDragStart(e, preset.type)}
               className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-grab
                          hover:bg-gray-600 transition-colors active:cursor-grabbing"
             >
               <span className="text-2xl">{preset.icon}</span>
               <span className="text-white text-sm">{preset.label}</span>
             </div>
           ))}
         </div>
       </div>
     );
   }

   export default Sidebar;
   ```

2. 在 `Viewport.jsx` 的外层 div 上实现 drop：
   - 需要拿到 Three.js 的 camera 来做射线检测
   - 用 `useThree()` 从 R3F 上下文中获取 camera
   - `onDragOver` 阻止默认行为（否则不触发 drop）
   - `onDrop` 中：
     1. 读取 `presetType`
     2. 将鼠标屏幕坐标转为 NDC（归一化设备坐标）
     3. 用 `Raycaster` 从相机发射射线，与地面（z=0 平面）求交
     4. 调用 `addElement(presetType, [x, y, 0])`

   ```jsx
   // src/components/Viewport.jsx（关键片段）
   import { useRef, useCallback } from 'react';
   import { Canvas, useThree } from '@react-three/fiber';
   import { OrbitControls, Grid } from '@react-three/drei';
   import * as THREE from 'three';
   import useSceneStore from '../store/useSceneStore';
   import TerrainElement from './TerrainElement';
   import GroundPlane from './GroundPlane';

   /**
    * 场景内容组件 —— 放在 Canvas 内部，可以访问 Three.js 上下文
    * 单独抽出来是因为 useThree 必须在 Canvas 子组件中调用
    */
   function SceneContent({ containerRef }) {
     const { camera } = useThree();
     const addElement = useSceneStore(s => s.addElement);
     const raycaster = useRef(new THREE.Raycaster()).current;
     const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)).current;

     /**
      * 处理拖拽释放：计算落点并添加元素
      * 用射线与 z=0 平面求交，得到世界坐标
      */
     const handleDrop = useCallback((e) => {
       const presetType = e.dataTransfer.getData('presetType');
       if (!presetType) return;

       const rect = containerRef.current.getBoundingClientRect();
       // 屏幕坐标 → NDC（-1 ~ 1）
       const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
       const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

       raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
       const intersectPoint = new THREE.Vector3();
       raycaster.ray.intersectPlane(groundPlane, intersectPoint);

       if (intersectPoint) {
         // MuJoCo 坐标系：x 右、y 前、z 上
         addElement(presetType, [intersectPoint.x, intersectPoint.y, 0]);
       }
     }, [camera, addElement, raycaster, groundPlane, containerRef]);

     // 将 drop 事件绑定到容器 DOM
     // 注意：需要在 useEffect 中绑定，因为 containerRef 在首次渲染后才有值
     // 实际实现中可以把 handleDrop 提到 Viewport 组件层，直接绑在 div 上

     return (
       <>
         <ambientLight intensity={0.4} />
         <directionalLight position={[10, 10, 10]} intensity={1} />
         <GroundPlane />
         <Grid
           args={[20, 20]}
           cellSize={1}
           cellThickness={0.5}
           sectionSize={5}
           sectionThickness={1}
           fadeDistance={30}
         />
         {/* 渲染所有地形元素 */}
         <SceneElements />
         {/* 变换手柄放在 Phase 4 实现 */}
         <TransformGizmo />
         <OrbitControls makeDefault />
       </>
     );
   }

   /** 单独抽出来，避免整个 SceneContent 随 elements 重渲染 */
   function SceneElements() {
     const elements = useSceneStore(s => s.elements);
     return (
       <>
         {elements.map(el => (
           <TerrainElement key={el.id} element={el} />
         ))}
       </>
     );
   }

   function Viewport() {
     const containerRef = useRef();
     const addElement = useSceneStore(s => s.addElement);

     // drop 处理放在外层，直接用 DOM 事件，不需要进 Three.js 上下文
     const handleDrop = useCallback((e) => {
       e.preventDefault();
       const presetType = e.dataTransfer.getData('presetType');
       if (!presetType || !containerRef.current) return;

       // 简化版：直接放在原点附近，精确落点需要在 Canvas 内用 raycaster
       // 完整实现见下方说明
       addElement(presetType, [0, 0, 0]);
     }, [addElement]);

     const handleDragOver = (e) => {
       e.preventDefault();  // 必须阻止，否则不触发 drop
       e.dataTransfer.dropEffect = 'copy';
     };

     return (
       <div
         ref={containerRef}
         className="flex-1 relative bg-gray-900"
         onDrop={handleDrop}
         onDragOver={handleDragOver}
       >
         <Canvas
           camera={{ position: [8, 8, 6], fov: 50 }}
           onPointerMissed={() => useSceneStore.getState().selectElement(null)}
         >
           <SceneContent containerRef={containerRef} />
         </Canvas>
       </div>
     );
   }

   export default Viewport;
   ```

   > **关于精确落点**：上面的简化版把新元素放在原点。要实现"拖到哪放哪"，需要在 Canvas 内部用 `useThree` 拿 camera 做 raycasting。可以把 drop 逻辑拆成两部分：
   > 1. 外层 div 捕获 drop 事件，记录鼠标屏幕坐标
   > 2. Canvas 内组件读取这个坐标，用 raycaster 计算世界坐标后添加元素
   >
   > 或者更简单：用 `useThree` + 自定义 `onDrop` 绑定在 canvas DOM 上。

**验收**：从左侧拖 "方块" 到视口，地面上出现一个方块；拖 "楼梯" 出现阶梯状几何体。

---

### Phase 4：选中 + 变换手柄

**目标**：点击选中元素，出现 gizmo 手柄，可拖拽移动/旋转/缩放。

**步骤**：

1. 选中逻辑（已在 `TerrainElement` 的 `onClick` 中实现）
   - 点击 mesh → `selectElement(id)`
   - 点击空白处 → Canvas 的 `onPointerMissed` → `selectElement(null)`

2. 写 `TransformGizmo.jsx`（或直接写在 Viewport 里）：
   - 从 drei 引入 `TransformControls`
   - 只在 `selectedId` 存在时渲染
   - mode 从 store 的 `transformMode` 读取
   - 绑定到选中元素的外层 group 上
   - `onChange` 时更新 store 中对应元素的 position/rotation/scale

   ```jsx
   // src/components/TransformGizmo.jsx
   import { useRef, useEffect } from 'react';
   import { TransformControls } from '@react-three/drei';
   import useSceneStore from '../store/useSceneStore';
   import { getPreset } from '../data/presets';

   /**
    * 变换手柄组件
    * 只在有选中元素时显示，支持平移/旋转/缩放三种模式
    * 通过拖拽手柄实时更新元素的变换参数
    */
   function TransformGizmo() {
     const { selectedId, elements, transformMode, updateElement } = useSceneStore();
     const controlsRef = useRef();

     // 找到当前选中的元素
     const selectedElement = elements.find(el => el.id === selectedId);

     // 没有选中元素时不渲染
     if (!selectedElement) return null;

     /**
      * 手柄拖拽过程中实时更新位置/旋转/缩放
      * 注意：TransformControls 操作的是它包裹的 object 的 matrix，
      * 需要在 onChange 时从 object 上读取 position/rotation/scale 写回 store
      */
     const handleChange = () => {
       if (!controlsRef.current) return;
       const obj = controlsRef.current.object;
       if (!obj) return;

       const patch = {
         position: [obj.position.x, obj.position.y, obj.position.z],
         rotation: [
           obj.rotation.x * 180 / Math.PI,
           obj.rotation.y * 180 / Math.PI,
           obj.rotation.z * 180 / Math.PI,
         ],
         scale: [obj.scale.x, obj.scale.y, obj.scale.z],
       };
       updateElement(selectedId, patch);
     };

     return (
       <TransformControls
         ref={controlsRef}
         mode={transformMode}
         onChange={handleChange}
       >
         {/* 手柄附着的目标：一个空 group，位置与选中元素同步 */}
         <group
           position={selectedElement.position}
           rotation={selectedElement.rotation.map(deg => deg * Math.PI / 180)}
           scale={selectedElement.scale}
         />
       </TransformControls>
     );
   }

   export default TransformGizmo;
   ```

   > **注意**：TransformControls 包裹的 object 和 TerrainElement 是两个独立的 group。
   > 更好的做法是让 TransformControls 直接控制 TerrainElement 的 group，
   > 可以通过 ref 转发或把选中元素单独处理来实现。
   > 最简方案：选中元素时，用 TransformControls 包裹一个"代理 group"，
   > 拖拽代理 → 更新 store → TerrainElement 跟随更新。

3. 顶部模式切换按钮（在 TopBar 或 Sidebar 中）：
   - 三个按钮：移动 / 旋转 / 缩放
   - 点击调用 `setTransformMode(mode)`
   - 当前模式高亮

**验收**：
- 点击方块，出现移动手柄，拖拽可改变位置
- 切换旋转模式，出现旋转手柄，拖拽可旋转
- 点击空白处，手柄消失，取消选中

---

### Phase 5：属性面板

**目标**：右侧面板精确编辑选中元素的所有参数，数值变化实时反映到 3D 视图。

**步骤**：

1. 写 `PropertiesPanel.jsx`：
   - 从 store 读 `selectedId` 和对应 element
   - 无选中时显示"未选中元素"提示
   - 有选中时显示：
     - 名称输入框
     - Position：x / y / z 三个数字输入
     - Rotation：rx / ry / rz 三个数字输入（度）
     - Scale：sx / sy / sz
     - 颜色选择器
     - 几何参数区：根据 `type` 动态渲染不同参数
     - 删除按钮

   ```jsx
   // src/components/PropertiesPanel.jsx
   import useSceneStore from '../store/useSceneStore';
   import { getPreset } from '../data/presets';

   /**
    * 属性面板：精确编辑选中元素的所有参数
    * 所有输入变化立即写回 store，3D 视图实时更新
    */
   function PropertiesPanel() {
     const { selectedId, elements, updateElement, removeElement } = useSceneStore();
     const element = elements.find(el => el.id === selectedId);

     // 未选中任何元素时的空状态
     if (!element) {
       return (
         <div className="w-72 bg-gray-800 p-4 border-l border-gray-700">
           <h2 className="text-white font-semibold mb-4 text-sm">属性</h2>
           <p className="text-gray-400 text-sm">选中一个元素以编辑其属性</p>
         </div>
       );
     }

     const preset = getPreset(element.type);

     /** 通用：更新顶层字段（position/rotation/scale 等） */
     const updateField = (field, value) => {
       updateElement(element.id, { [field]: value });
     };

     /** 更新 params 中的某个参数 */
     const updateParam = (paramKey, value) => {
       updateElement(element.id, {
         params: { ...element.params, [paramKey]: value },
       });
     };

     /** 数字输入行：标签 + 三个轴的输入框 */
     const Vector3Input = ({ label, value, onChange, step = 0.1 }) => (
       <div className="mb-3">
         <label className="text-gray-300 text-xs mb-1 block">{label}</label>
         <div className="flex gap-1">
           {['X', 'Y', 'Z'].map((axis, i) => (
             <div key={axis} className="flex-1">
               <span className="text-gray-500 text-xs">{axis}</span>
               <input
                 type="number"
                 step={step}
                 value={value[i]}
                 onChange={(e) => {
                   const next = [...value];
                   next[i] = parseFloat(e.target.value) || 0;
                   onChange(next);
                 }}
                 className="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded
                            border border-gray-600 focus:border-blue-500 focus:outline-none"
               />
             </div>
           ))}
         </div>
       </div>
     );

     /** 单个数字参数输入行 */
     const NumberInput = ({ label, paramKey, step = 0.1, min = 0.01 }) => (
       <div className="mb-3">
         <label className="text-gray-300 text-xs mb-1 block">{label}</label>
         <input
           type="number"
           step={step}
           min={min}
           value={element.params[paramKey]}
           onChange={(e) => updateParam(paramKey, parseFloat(e.target.value) || min)}
           className="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded
                      border border-gray-600 focus:border-blue-500 focus:outline-none"
         />
       </div>
     );

     return (
       <div className="w-72 bg-gray-800 p-4 border-l border-gray-700 overflow-y-auto">
         <h2 className="text-white font-semibold mb-4 text-sm">属性</h2>

         {/* 名称 */}
         <div className="mb-4">
           <label className="text-gray-300 text-xs mb-1 block">名称</label>
           <input
             type="text"
             value={element.name}
             onChange={(e) => updateField('name', e.target.value)}
             className="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded
                        border border-gray-600 focus:border-blue-500 focus:outline-none"
           />
         </div>

         {/* 类型（只读） */}
         <div className="mb-4 text-gray-400 text-xs">
           类型：<span className="text-white">{preset?.label}</span>
         </div>

         {/* 位置 */}
         <Vector3Input
           label="位置"
           value={element.position}
           onChange={(v) => updateField('position', v)}
         />

         {/* 旋转（度） */}
         <Vector3Input
           label="旋转 (°)"
           value={element.rotation}
           onChange={(v) => updateField('rotation', v)}
           step={1}
         />

         {/* 缩放 */}
         <Vector3Input
           label="缩放"
           value={element.scale}
           onChange={(v) => updateField('scale', v)}
           step={0.1}
         />

         {/* 颜色 */}
         <div className="mb-4">
           <label className="text-gray-300 text-xs mb-1 block">颜色</label>
           <input
             type="color"
             value={element.color}
             onChange={(e) => updateField('color', e.target.value)}
             className="w-full h-8 rounded cursor-pointer border border-gray-600"
           />
         </div>

         {/* 分隔线 */}
         <div className="border-t border-gray-700 my-4" />

         {/* 几何参数（根据类型动态显示） */}
         <h3 className="text-white font-semibold mb-3 text-sm">几何参数</h3>

         {element.type === 'box' && (
           <>
             <NumberInput label="宽度 (X)" paramKey="width" />
             <NumberInput label="深度 (Y)" paramKey="depth" />
             <NumberInput label="高度 (Z)" paramKey="height" />
           </>
         )}

         {element.type === 'ramp' && (
           <>
             <NumberInput label="宽度 (X)" paramKey="width" />
             <NumberInput label="深度 (Y)" paramKey="depth" />
             <NumberInput label="高度 (Z)" paramKey="height" />
           </>
         )}

         {element.type === 'stairs' && (
           <>
             <NumberInput label="宽度 (X)" paramKey="width" />
             <NumberInput label="深度 (Y)" paramKey="depth" />
             <NumberInput label="高度 (Z)" paramKey="height" />
             <NumberInput label="级数" paramKey="steps" step={1} min={1} />
           </>
         )}

         {element.type === 'platform' && (
           <>
             <NumberInput label="宽度 (X)" paramKey="width" />
             <NumberInput label="深度 (Y)" paramKey="depth" />
             <NumberInput label="厚度" paramKey="thickness" />
           </>
         )}

         {/* 分隔线 */}
         <div className="border-t border-gray-700 my-4" />

         {/* 删除按钮 */}
         <button
           onClick={() => removeElement(element.id)}
           className="w-full bg-red-600 hover:bg-red-700 text-white text-sm py-2 rounded
                      transition-colors"
         >
           删除元素
         </button>
       </div>
     );
   }

   export default PropertiesPanel;
   ```

**验收**：
- 选中方块，右侧显示所有参数
- 修改 position 的 X 值，方块在 3D 视图中实时移动
- 修改楼梯的 steps 从 5 改为 10，楼梯级数实时增加
- 点 "删除元素"，方块消失

---

### Phase 6：XML 导出

**目标**：点击保存，下载可直接被 MuJoCo 加载的 XML 文件。

**步骤**：

1. 写 `xmlExporter.js`：
   - 遍历所有元素
   - 每个元素调用对应 preset 的 `toMujocoGeoms`
   - 拼接成完整的 MuJoCo XML 字符串

   ```javascript
   // src/utils/xmlExporter.js
   import { getPreset } from '../data/presets';

   /**
    * 将场景元素数组导出为 MuJoCo XML 字符串
    * 输出格式遵循 MuJoCo MJCF 规范，可直接被 mujoco-py / dm_control 加载
    *
    * @param {Array} elements - 场景元素数组
    * @returns {string} - 完整的 MuJoCo XML 字符串
    */
   export function exportToXML(elements) {
     // 将颜色 hex 转为 MuJoCo 的 rgba 格式（0~1 浮点）
     const hexToRgba = (hex, alpha = 1) => {
       const r = parseInt(hex.slice(1, 3), 16) / 255;
       const g = parseInt(hex.slice(3, 5), 16) / 255;
       const b = parseInt(hex.slice(5, 7), 16) / 255;
       return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${alpha}`;
     };

     // 将对象转为 XML 属性字符串：key1="val1" key2="val2"
     const attrsToString = (attrs) => {
       return Object.entries(attrs)
         .map(([key, value]) => `${key}="${value}"`)
         .join(' ');
     };

     // 生成所有 geom 的 XML 行
     const geomLines = elements.flatMap(elem => {
       const preset = getPreset(elem.type);
       if (!preset) return [];

       const geoms = preset.toMujocoGeoms(elem);
       const rgba = hexToRgba(elem.color);

       // 复合元素（如楼梯）放在同一个 body 下，方便整体定位
       if (geoms.length > 1) {
         const bodyAttrs = attrsToString({
           name: elem.name,
           pos: elem.position.join(' '),
           euler: elem.rotation.map(d => d * Math.PI / 180).join(' '),
         });
         const innerGeoms = geoms.map(g => {
           const geomAttrs = attrsToString({ ...g, rgba });
           return `        <geom ${geomAttrs}/>`;
         }).join('\n');
         return [`      <body ${bodyAttrs}>\n${innerGeoms}\n      </body>`];
       }

       // 单 geom 元素直接输出
       const g = geoms[0];
       const geomAttrs = attrsToString({
         name: elem.name,
         pos: elem.position.join(' '),
         euler: elem.rotation.map(d => d * Math.PI / 180).join(' '),
         ...g,
         rgba,
       });
       return [`      <geom ${geomAttrs}/>`];
     }).join('\n');

     // 组装完整 XML
     return `<?xml version="1.0" encoding="UTF-8"?>
<mujoco model="terrain">
  <compiler angle="radian" coordinate="local"/>
  <option timestep="0.01"/>

  <worldbody>
    <!-- 光照 -->
    <light name="top_light" pos="0 0 10" dir="0 0 -1" diffuse="0.8 0.8 0.8" specular="0.3 0.3 0.3"/>

    <!-- 地形元素（由编辑器生成） -->
${geomLines}
  </worldbody>
</mujoco>
`;
   }

   /**
    * 触发浏览器下载 XML 文件
    * @param {string} filename - 文件名，如 "terrain.xml"
    */
   export function downloadXML(elements, filename = 'terrain.xml') {
     const xmlStr = exportToXML(elements);
     const blob = new Blob([xmlStr], { type: 'application/xml' });
     const url = URL.createObjectURL(blob);

     const a = document.createElement('a');
     a.href = url;
     a.download = filename;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);  // 释放内存
   }
   ```

2. 写 `TopBar.jsx`：
   - "保存 XML" 按钮 → 调用 `downloadXML(elements)`
   - "清空" 按钮 → 确认后 `clearAll()`
   - 变换模式切换（移动/旋转/缩放）
   - 元素计数显示

   ```jsx
   // src/components/TopBar.jsx
   import useSceneStore from '../store/useSceneStore';
   import { downloadXML } from '../utils/xmlExporter';

   function TopBar() {
     const { elements, transformMode, setTransformMode, clearAll } = useSceneStore();

     const handleSave = () => {
       if (elements.length === 0) {
         alert('场景为空，没有可保存的内容');
         return;
       }
       downloadXML(elements, 'terrain.xml');
     };

     const handleClear = () => {
       if (elements.length === 0) return;
       if (confirm('确定要清空所有元素吗？此操作不可撤销。')) {
         clearAll();
       }
     };

     return (
       <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-4">
         {/* 标题 */}
         <h1 className="text-white font-bold text-base">MuJoCo Terrain Editor</h1>

         {/* 分隔 */}
         <div className="flex-1" />

         {/* 变换模式切换 */}
         <div className="flex bg-gray-700 rounded overflow-hidden">
           {[
             { mode: 'translate', label: '移动' },
             { mode: 'rotate', label: '旋转' },
             { mode: 'scale', label: '缩放' },
           ].map(({ mode, label }) => (
             <button
               key={mode}
               onClick={() => setTransformMode(mode)}
               className={`px-3 py-1 text-sm transition-colors ${
                 transformMode === mode
                   ? 'bg-blue-600 text-white'
                   : 'text-gray-300 hover:bg-gray-600'
               }`}
             >
               {label}
             </button>
           ))}
         </div>

         {/* 元素计数 */}
         <span className="text-gray-400 text-sm">
           {elements.length} 个元素
         </span>

         {/* 操作按钮 */}
         <button
           onClick={handleClear}
           className="px-3 py-1 text-sm text-gray-300 hover:text-white
                      hover:bg-gray-700 rounded transition-colors"
         >
           清空
         </button>
         <button
           onClick={handleSave}
           className="px-4 py-1 text-sm bg-green-600 hover:bg-green-700
                      text-white rounded transition-colors font-medium"
         >
           保存 XML
         </button>
       </div>
     );
   }

   export default TopBar;
   ```

**验收**：
- 场景中有几个元素，点 "保存 XML"
- 下载 `terrain.xml` 文件
- 用 MuJoCo 打开文件，能看到和编辑器中一致的地形

---

### Phase 7：打磨细节（可选，按需实现）

以下功能不影响 MVP 可用性，但能显著提升体验：

#### 7.1 撤销 / 重做

用 Zustand 的中间件或手动维护 history 数组：

```javascript
// 在 store 中维护历史栈
history: [],       // 过去的状态，用于撤销
future: [],        // 未来的状态，用于重做

undo: () => { /* 从 history 弹出，当前状态压入 future */ },
redo: () => { /* 从 future 弹出，当前状态压入 history */ },
```

键盘快捷键：`Ctrl+Z` 撤销，`Ctrl+Shift+Z` 重做。

#### 7.2 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `W` | 切换到移动模式 |
| `E` | 切换到旋转模式 |
| `R` | 切换到缩放模式 |
| `Delete` / `Backspace` | 删除选中元素 |
| `Ctrl+D` | 复制选中元素 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |
| `Escape` | 取消选中 |

实现方式：在 `App.jsx` 中加 `useEffect` 监听 `keydown` 事件。

#### 7.3 元素列表

左侧面板加一个 "场景" tab，显示所有元素的列表：
- 每项显示名称 + 类型图标
- 点击选中
- 双击重命名
- 拖拽排序（可选）

#### 7.4 XML 导入

写 `xmlImporter.js`，解析 XML 中的 `<geom>` 元素，反向生成场景元素数组。
注意：导入只能识别编辑器支持的类型（box 等），其他类型忽略或提示。

#### 7.5 工程文件保存 / 加载

除了导出 MuJoCo XML，还支持保存编辑器自身的 JSON 工程文件（包含所有编辑态信息），方便下次继续编辑。

---

## 六、关键技术点 & 注意事项

### 6.1 坐标系

MuJoCo 是 **Z-up**（Z 轴向上），Three.js 默认是 **Y-up**。

**最简方案**：在 Three.js 中也用 Z-up，和 MuJoCo 保持一致。

```jsx
// 在 Canvas 中设置相机 up 方向
<Canvas
  camera={{
    position: [8, -8, 6],
    up: [0, 0, 1],  // Z 轴向上
    fov: 50,
  }}
>
```

OrbitControls 也需要设置 `up` 为 Z 轴，drei 的 OrbitControls 会自动跟随 camera.up。

这样编辑器中的 position `[x, y, z]` 和 MuJoCo 的 `pos` 完全一致，导出时不需要转换。

### 6.2 旋转表示

编辑器内部用**欧拉角（度）**存储，用户容易理解。
导出 XML 时转为弧度（MuJoCo 默认用弧度，除非设置 `angle="degree"`）。

```javascript
// 导出时
euler: elem.rotation.map(deg => (deg * Math.PI / 180).toFixed(6)).join(' '),
```

### 6.3 复合元素的变换

楼梯等复合元素由多个子 mesh 组成，变换时整体移动：

- 外层 `<group>` 应用 position / rotation / scale
- 内层子 mesh 用**局部坐标**定位
- TransformControls 操作外层 group，子元素自动跟随

### 6.4 性能优化

- 地形元素数量通常不多（几十到几百个），Three.js 完全无压力
- 不需要 InstancedMesh，每个元素独立编辑更重要
- Zustand 的选择器优化：`useSceneStore(s => s.elements)` 会导致所有元素变化时都重渲染，可以用 `shallow` 或拆分选择器
- R3F 自动处理 Three.js 对象的复用，不会每次渲染重建几何体

### 6.5 Z-fighting

楼梯的台阶之间如果完全贴合，会出现 z-fighting（闪烁）。
解决方案：每个台阶的深度乘以 0.98，留一点点间隙。

---

## 七、MVP 验收清单

做完 Phase 1~6 后，逐项验证：

- [ ] 启动 `npm run dev`，页面正常加载，无报错
- [ ] 3D 视口显示地面网格，鼠标拖拽可旋转视角，滚轮可缩放
- [ ] 左侧面板显示 4 个可拖拽组件（方块/斜坡/楼梯/平台）
- [ ] 从左侧拖 "方块" 到视口，地面上生成一个方块
- [ ] 拖 "斜坡"，生成倾斜的平面
- [ ] 拖 "楼梯"，生成阶梯状几何体
- [ ] 拖 "平台"，生成一个薄平台
- [ ] 点击方块，出现移动手柄，拖拽可改变位置
- [ ] 顶部切换到旋转模式，出现旋转手柄，拖拽可旋转
- [ ] 切换到缩放模式，拖拽可缩放
- [ ] 点击空白处，取消选中，手柄消失
- [ ] 选中方块，右侧面板显示所有属性
- [ ] 修改 position 的 X 值，方块在 3D 视图中实时移动
- [ ] 修改颜色，方块颜色实时变化
- [ ] 修改楼梯的 steps 数，楼梯级数实时增减
- [ ] 点 "删除元素"，选中元素消失
- [ ] 点 "保存 XML"，下载 `terrain.xml` 文件
- [ ] 用 MuJoCo 打开 XML，地形与编辑器中一致
- [ ] 点 "清空"，确认后所有元素消失

---

## 八、时间线

| 阶段 | 内容 | 预计时间 |
|------|------|----------|
| Phase 1 | 项目骨架 + 3D 视口 | 0.5 天 |
| Phase 2 | 状态管理 + 元素渲染 | 0.5 天 |
| Phase 3 | 拖拽添加 | 0.5 天 |
| Phase 4 | 选中 + 变换手柄 | 0.5 天 |
| Phase 5 | 属性面板 | 0.5 天 |
| Phase 6 | XML 导出 | 0.5 天 |
| **合计** | **可用 MVP** | **3 天** |
| Phase 7 | 撤销/快捷键/导入等打磨 | +1~2 天 |

---

## 九、后续扩展方向

MVP 稳定后，可以考虑的进阶功能：

1. **高度场（hfield）编辑**：笔刷式刷地形高度，支持导入高度图
2. **物理预览**：集成 mujoco.js，在浏览器里直接跑物理模拟
3. **材质系统**：支持不同材质（摩擦系数、 restitution 等）
4. **组件分组 / 图层**：管理复杂场景
5. **测量工具**：距离、角度测量
6. **对齐工具**：对齐到网格、对齐到其他元素
7. **插件系统**：用户自定义预设组件
