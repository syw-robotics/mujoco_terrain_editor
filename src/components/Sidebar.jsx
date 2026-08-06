import { MousePointer2 } from 'lucide-react';
import { PRESETS, getPreset } from '../data/presets';
import useSceneStore from '../store/useSceneStore';

function Sidebar() {
  const elements = useSceneStore((state) => state.elements);
  const selectedId = useSceneStore((state) => state.selectedId);
  const selectElement = useSceneStore((state) => state.selectElement);

  const handleDragStart = (event, type) => {
    event.dataTransfer.setData('application/x-terrain-preset', type);
    event.dataTransfer.setData('text/plain', type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <aside className="panel sidebar">
      <div className="panel-header">
        <h2 className="panel-title">地形组件</h2>
        <span className="panel-count">04</span>
      </div>
      <section className="section">
        <p className="section-label">基础几何</p>
        <div className="preset-grid">
          {PRESETS.map(({ type, label, Icon, summary }) => (
            <div
              className="preset-card"
              draggable
              key={type}
              onDragStart={(event) => handleDragStart(event, type)}
              onDoubleClick={() => useSceneStore.getState().addElement(type)}
              title="拖入视口，或双击添加到原点"
            >
              <div className="preset-icon"><Icon size={23} strokeWidth={1.4} /></div>
              <div className="preset-name">{label}</div>
              <div className="preset-size">{summary}</div>
            </div>
          ))}
        </div>
        <p className="hint">拖拽组件到视口中的目标位置。双击可快速添加到坐标原点。</p>
      </section>
      <section className="section" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <p className="section-label">场景层级 · {elements.length}</p>
        <div className="scene-list">
          {elements.length === 0 && <div className="empty-list">场景为空</div>}
          {elements.map((element) => {
            const preset = getPreset(element.type);
            const Icon = preset?.Icon || MousePointer2;
            return (
              <button
                className={`scene-item ${selectedId === element.id ? 'active' : ''}`}
                key={element.id}
                onClick={() => selectElement(element.id)}
              >
                <Icon size={14} strokeWidth={1.5} />
                <span>{element.name}</span>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

export default Sidebar;
