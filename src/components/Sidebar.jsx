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
    <aside className="app-sidebar">
      <div className="ui-pane-heading">
        <h3>{t('terrainComponents')}</h3>
      </div>
      <section className="app-section">
        <p className="ui-kicker">{t('basicGeometry')}</p>
        <div className="app-preset-grid">
          {PRESETS.map(({ type, label, Icon, getSummary, defaultParams }) => (
            <div
              className="app-preset"
              draggable
              key={type}
              onDragStart={(event) => handleDragStart(event, type)}
              onDoubleClick={() => useSceneStore.getState().addElement(type)}
              title={t('addPresetTitle')}
            >
              <div className="app-preset-icon"><Icon size={18} strokeWidth={1.5} /></div>
              <div className="app-preset-name">{localize(label, language)}</div>
              <div className="app-preset-meta">{getSummary(defaultParams, language)}</div>
            </div>
          ))}
        </div>
        <p className="ui-hint app-note">{t('addPresetHint')}</p>
      </section>
      <section className="app-section app-scene-section">
        <div className="app-section-title">
          <p className="ui-kicker">{t('sceneHierarchy')}</p>
          <span className="ui-mono app-count">{elements.length}</span>
        </div>
        <div className="app-scene-list">
          {elements.length === 0 && <p className="ui-hint">{t('emptyScene')}</p>}
          {elements.map((element) => {
            const preset = getPreset(element.type);
            const Icon = preset?.Icon || MousePointer2;
            const selected = selectedIds.includes(element.id);
            return (
              <button
                type="button"
                className={`app-scene-item${selected ? ' is-selected' : ''}${selectedId === element.id ? ' is-primary' : ''}`}
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
