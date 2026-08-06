import { MousePointer2 } from 'lucide-react';
import { PRESETS, getPreset } from '../data/presets';
import useSceneStore from '../store/useSceneStore';
import { localize, translate } from '../i18n';

function Sidebar() {
  const elements = useSceneStore((state) => state.elements);
  const selectedId = useSceneStore((state) => state.selectedId);
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const selectElement = useSceneStore((state) => state.selectElement);
  const colorPickTargetId = useSceneStore((state) => state.colorPickTargetId);
  const applyColorFromElement = useSceneStore((state) => state.applyColorFromElement);
  const language = useSceneStore((state) => state.language);
  const t = (key) => translate(language, key);

  const handleDragStart = (event, type) => {
    event.dataTransfer.setData('application/x-terrain-preset', type);
    event.dataTransfer.setData('text/plain', type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <aside className="panel sidebar">
      <div className="panel-header">
        <h2 className="panel-title">{t('terrainComponents')}</h2>
      </div>
      <section className="section">
        <p className="section-label">{t('basicGeometry')}</p>
        <div className="preset-grid">
          {PRESETS.map(({ type, label, Icon, getSummary, defaultParams }) => (
            <div
              className="preset-card"
              draggable
              key={type}
              onDragStart={(event) => handleDragStart(event, type)}
              onDoubleClick={() => useSceneStore.getState().addElement(type)}
              title={t('addPresetTitle')}
            >
              <div className="preset-icon"><Icon size={23} strokeWidth={1.4} /></div>
              <div className="preset-name">{localize(label, language)}</div>
              <div className="preset-size">{getSummary(defaultParams, language)}</div>
            </div>
          ))}
        </div>
        <p className="hint">{t('addPresetHint')}</p>
      </section>
      <section className="section" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <p className="section-label">{t('sceneHierarchy')} · {elements.length}</p>
        <div className="scene-list">
          {elements.length === 0 && <div className="empty-list">{t('emptyScene')}</div>}
          {elements.map((element) => {
            const preset = getPreset(element.type);
            const Icon = preset?.Icon || MousePointer2;
            return (
              <button
                className={`scene-item ${selectedIds.includes(element.id) ? 'active' : ''} ${selectedId === element.id ? 'primary' : ''}`}
                key={element.id}
                onClick={(event) => {
                  if (colorPickTargetId) applyColorFromElement(element.id);
                  else selectElement(element.id, event.shiftKey || event.ctrlKey || event.metaKey);
                }}
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
