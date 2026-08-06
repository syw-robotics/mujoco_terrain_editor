import { useEffect, useRef, useState } from 'react';
import { BoxSelect, Copy, Dices, Pipette, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { getPreset } from '../data/presets';
import useSceneStore from '../store/useSceneStore';
import { makeUniqueXmlName, sanitizeXmlNameDraft } from '../utils/xmlNames.js';
import { localize, translate } from '../i18n';
import { ROTATION_SNAP_DEGREES, TRANSLATION_SNAP } from '../editorConfig';
import { randomTerrainColor } from '../utils/terrainColors.js';

const AXES = ['X', 'Y', 'Z'];

function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  return Number(value.toFixed(6)).toString();
}

function NumericInput({ value, onChange, step = 0.1, min, max, integer = false, axis, disabled = false }) {
  // Keep a textual draft separate from the numeric store value so users can
  // temporarily type incomplete values such as "-" or "0." without resets.
  const [draft, setDraft] = useState(() => formatNumber(value));
  const focusedRef = useRef(false);
  const cancelBlurRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(formatNumber(value));
  }, [value]);

  const commit = (rawValue = draft) => {
    let parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setDraft(formatNumber(value));
      return;
    }
    if (integer) parsed = Math.round(parsed);
    if (min !== undefined) parsed = Math.max(min, parsed);
    if (max !== undefined) parsed = Math.min(max, parsed);
    setDraft(formatNumber(parsed));
    onChange(parsed);
  };

  const handleChange = (event) => {
    const nextDraft = event.target.value;
    setDraft(nextDraft);
    const parsed = Number(nextDraft);
    if (
      nextDraft.trim() !== ''
      && Number.isFinite(parsed)
      && (min === undefined || parsed >= min)
      && (max === undefined || parsed <= max)
    ) {
      onChange(integer ? Math.round(parsed) : parsed);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setDraft(formatNumber(value));
      cancelBlurRef.current = true;
      event.currentTarget.blur();
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (disabled) return;
      event.preventDefault();
      const direction = event.key === 'ArrowUp' ? 1 : -1;
      const base = Number.isFinite(Number(draft)) ? Number(draft) : value;
      commit(String(base + direction * step));
    }
  };

  return (
    <label className={axis ? 'axis-input' : undefined}>
      {axis && <span>{axis}</span>}
      <input
        className="number-input"
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        value={draft}
        disabled={disabled}
        onFocus={() => {
          focusedRef.current = true;
          cancelBlurRef.current = false;
          useSceneStore.getState().beginHistoryTransaction();
        }}
        onBlur={(event) => {
          focusedRef.current = false;
          if (!cancelBlurRef.current) commit(event.currentTarget.value);
          cancelBlurRef.current = false;
          useSceneStore.getState().endHistoryTransaction();
        }}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onWheel={(event) => event.currentTarget.blur()}
        aria-label={axis}
      />
    </label>
  );
}

function VectorInput({ label, hint, value, onChange, step = 0.1, min, disabledIndices = [] }) {
  return (
    <div className="field">
      <div className="field-label"><span>{label}</span>{hint && <code>{hint}</code>}</div>
      <div className="vector-row">
        {AXES.map((axis, index) => (
          <NumericInput
            key={axis}
            axis={axis}
            value={value[index]}
            step={step}
            min={min}
            disabled={disabledIndices.includes(index)}
            onChange={(nextValue) => {
              const next = [...value];
              next[index] = nextValue;
              onChange(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ParameterInput({ label, unit = 'M', value, onChange, min = 0.01, max, step = 0.1, integer = false }) {
  return (
    <div className="field">
      <div className="field-label"><span>{label}</span>{unit && <code>{unit}</code>}</div>
      <NumericInput
        value={value}
        step={step}
        min={min}
        max={max}
        integer={integer}
        onChange={onChange}
      />
    </div>
  );
}

function PropertiesPanel() {
  const elements = useSceneStore((state) => state.elements);
  const selectedId = useSceneStore((state) => state.selectedId);
  const updateElement = useSceneStore((state) => state.updateElement);
  const removeElement = useSceneStore((state) => state.removeElement);
  const duplicateElement = useSceneStore((state) => state.duplicateElement);
  const rotateElement90 = useSceneStore((state) => state.rotateElement90);
  const colorPickTargetId = useSceneStore((state) => state.colorPickTargetId);
  const startColorPicking = useSceneStore((state) => state.startColorPicking);
  const cancelColorPicking = useSceneStore((state) => state.cancelColorPicking);
  const language = useSceneStore((state) => state.language);
  const t = (key, variables) => translate(language, key, variables);
  const element = elements.find((item) => item.id === selectedId);

  if (!element) {
    return (
      <aside className="panel properties">
        <div className="panel-header"><h2 className="panel-title">{t('inspector')}</h2></div>
        <div className="property-empty">
          <BoxSelect size={31} strokeWidth={1.25} />
          <strong>{t('noSelection')}</strong>
          <p>{t('noSelectionHint')}</p>
        </div>
      </aside>
    );
  }

  const preset = getPreset(element.type);
  const Icon = preset.Icon;
  const patch = (field, value) => updateElement(element.id, { [field]: value });
  const updateParam = (key, value) => patch('params', { ...element.params, [key]: value });
  const commitName = (value) => {
    const otherNames = elements.filter((item) => item.id !== element.id).map((item) => item.name);
    patch('name', makeUniqueXmlName(value, otherNames, preset.xmlName));
  };

  return (
    <aside className="panel properties">
      <div className="panel-header">
        <h2 className="panel-title">{t('inspector')}</h2>
      </div>
      <section className="section">
        <div className="field">
          <div className="field-label"><span>{t('geomName')}</span><code>MJCF</code></div>
          <input
            className="text-input"
            value={element.name}
            maxLength={64}
            spellCheck={false}
            onFocus={() => useSceneStore.getState().beginHistoryTransaction()}
            onChange={(event) => patch('name', sanitizeXmlNameDraft(event.target.value))}
            onBlur={(event) => {
              commitName(event.target.value);
              useSceneStore.getState().endHistoryTransaction();
            }}
          />
        </div>
        <div className="type-chip">
          <span className="type-chip-icon"><Icon size={14} /></span>
          {localize(preset.label, language)}
        </div>
      </section>
      <section className="section">
        <p className="section-label">{t('transform')}</p>
        <label className="ground-lock">
          <input
            type="checkbox"
            checked={element.groundLocked}
            onChange={(event) => patch('groundLocked', event.target.checked)}
          />
          <span className="ground-lock-box" />
          <span>
            <strong>{t('groundLock')}</strong>
            <small>{t('groundLockHint')}</small>
          </span>
        </label>
        <VectorInput
          label={t('position')}
          hint={element.groundLocked ? 'Z AUTO' : `M · ${TRANSLATION_SNAP}`}
          value={element.position}
          step={TRANSLATION_SNAP}
          disabledIndices={element.groundLocked ? [2] : []}
          onChange={(value) => patch('position', value)}
        />
        <VectorInput
          label={t('rotation')}
          hint={`DEG · ${ROTATION_SNAP_DEGREES}`}
          value={element.rotation}
          step={ROTATION_SNAP_DEGREES}
          onChange={(value) => patch('rotation', value)}
        />
        <div className="quick-rotate-row">
          <button
            onClick={() => rotateElement90(element.id, 1)}
            title={`${t('rotateLeft90')} (Shift+[)`}
          >
            <RotateCcw size={14} /> {t('rotateLeft90')}
          </button>
          <button
            onClick={() => rotateElement90(element.id, -1)}
            title={`${t('rotateRight90')} (Shift+])`}
          >
            <RotateCw size={14} /> {t('rotateRight90')}
          </button>
        </div>
      </section>
      <section className="section">
        <p className="section-label">{t('geometryParameters')}</p>
        {preset.parameters.map((parameter) => (
          <ParameterInput
            key={parameter.key}
            {...parameter}
            label={localize(parameter.label, language)}
            value={element.params[parameter.key]}
            onChange={(next) => updateParam(parameter.key, next)}
          />
        ))}
        <div className="field" style={{ marginBottom: 0 }}>
          <div className="field-label"><span>{t('displayColor')}</span></div>
          <div className="color-row">
            <div className="color-control">
              <input
                type="color"
                value={element.color}
                onFocus={() => useSceneStore.getState().beginHistoryTransaction()}
                onBlur={() => useSceneStore.getState().endHistoryTransaction()}
                onChange={(event) => patch('color', event.target.value)}
              />
              <code>{element.color.toUpperCase()}</code>
            </div>
            <button
              className="random-color-btn"
              onClick={() => patch('color', randomTerrainColor(element.color))}
              title={t('randomColor')}
              aria-label={t('randomColor')}
            >
              <Dices size={15} /> {t('randomColor')}
            </button>
            <button
              className={`random-color-btn ${colorPickTargetId === element.id ? 'active' : ''}`}
              disabled={elements.length < 2}
              onClick={() => {
                if (colorPickTargetId === element.id) cancelColorPicking();
                else startColorPicking(element.id);
              }}
              title={colorPickTargetId === element.id ? t('cancelColorPick') : t('pickColorHint')}
              aria-pressed={colorPickTargetId === element.id}
            >
              <Pipette size={15} /> {t('pickColor')}
            </button>
          </div>
        </div>
      </section>
      <section className="section">
        <button className="secondary-btn" onClick={() => duplicateElement(element.id)}>
          <Copy size={14} /> {t('duplicateElement')}
        </button>
        <button className="danger-btn" onClick={() => removeElement(element.id)}>
          <Trash2 size={14} /> {t('deleteElement')}
        </button>
      </section>
    </aside>
  );
}

export default PropertiesPanel;
