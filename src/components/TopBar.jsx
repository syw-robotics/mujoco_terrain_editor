import { Box, Copy, Download, Maximize2, Move3D, Rotate3D, Trash2 } from 'lucide-react';
import useSceneStore from '../store/useSceneStore';
import { downloadXML } from '../utils/xmlExporter';

const MODES = [
  { mode: 'translate', label: '移动', key: 'W', Icon: Move3D },
  { mode: 'rotate', label: '旋转', key: 'E', Icon: Rotate3D },
  { mode: 'scale', label: '缩放', key: 'R', Icon: Maximize2 },
];

function TopBar() {
  const elements = useSceneStore((state) => state.elements);
  const selectedId = useSceneStore((state) => state.selectedId);
  const transformMode = useSceneStore((state) => state.transformMode);
  const setTransformMode = useSceneStore((state) => state.setTransformMode);
  const clearAll = useSceneStore((state) => state.clearAll);
  const duplicateElement = useSceneStore((state) => state.duplicateElement);

  const handleClear = () => {
    if (elements.length && window.confirm(`确定清空场景中的 ${elements.length} 个元素吗？`)) clearAll();
  };

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><Box size={15} strokeWidth={1.8} /></div>
        <div>
          <div className="brand-title">MuJoCo Terrain Editor</div>
          <div className="brand-version">MTE / 0.1</div>
        </div>
      </div>
      <div className="toolbar-separator" />
      <div className="mode-switch">
        {MODES.map(({ mode, label, key, Icon }) => (
          <button
            key={mode}
            className={`mode-btn ${transformMode === mode ? 'active' : ''}`}
            onClick={() => setTransformMode(mode)}
            title={`${label} (${key})`}
          >
            <Icon size={14} strokeWidth={1.7} /><span>{label}</span>
          </button>
        ))}
      </div>
      <div className="spacer" />
      <span className="element-total">{String(elements.length).padStart(2, '0')} OBJECTS</span>
      <button
        className="icon-btn"
        disabled={!selectedId}
        onClick={() => duplicateElement(selectedId)}
        title="复制选中元素 (Ctrl+D)"
        style={{ opacity: selectedId ? 1 : 0.35 }}
      ><Copy size={15} /></button>
      <button className="icon-btn" onClick={handleClear} title="清空场景"><Trash2 size={15} /></button>
      <button
        className="primary-btn"
        onClick={() => downloadXML(elements)}
        title="导出可由 MuJoCo 加载的 MJCF 文件"
      ><Download size={14} strokeWidth={2.2} /> 导出 XML</button>
    </header>
  );
}

export default TopBar;
