import { useEffect, useRef, useState } from 'react';
import { BoxSelect, Trash2 } from 'lucide-react';
import { getPreset } from '../data/presets';
import useSceneStore from '../store/useSceneStore';
import { sanitizeXmlName, sanitizeXmlNameDraft } from '../utils/xmlNames.js';

const AXES = ['X', 'Y', 'Z'];

function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  return Number(value.toFixed(6)).toString();
}

function NumericInput({ value, onChange, step = 0.1, min, max, integer = false, axis, disabled = false }) {
  const [draft, setDraft] = useState(() => formatNumber(value));
  const focusedRef = useRef(false);

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
        onFocus={() => { focusedRef.current = true; }}
        onBlur={(event) => {
          focusedRef.current = false;
          commit(event.currentTarget.value);
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
  const element = elements.find((item) => item.id === selectedId);

  if (!element) {
    return (
      <aside className="panel properties">
        <div className="panel-header"><h2 className="panel-title">检查器</h2></div>
        <div className="property-empty">
          <BoxSelect size={31} strokeWidth={1.25} />
          <strong>未选择地形元素</strong>
          <p>点击视口中的对象或场景层级<br />以编辑几何和变换属性</p>
        </div>
      </aside>
    );
  }

  const preset = getPreset(element.type);
  const Icon = preset.Icon;
  const patch = (field, value) => updateElement(element.id, { [field]: value });
  const updateParam = (key, value) => patch('params', { ...element.params, [key]: value });

  return (
    <aside className="panel properties">
      <div className="panel-header">
        <h2 className="panel-title">检查器</h2>
        <span className="panel-count">{element.id}</span>
      </div>
      <section className="section">
        <div className="field">
          <div className="field-label"><span>Geom 名称</span><code>MJCF</code></div>
          <input
            className="text-input"
            value={element.name}
            maxLength={64}
            spellCheck={false}
            onChange={(event) => patch('name', sanitizeXmlNameDraft(event.target.value))}
            onBlur={(event) => patch('name', sanitizeXmlName(event.target.value, preset.xmlName))}
          />
        </div>
        <div className="type-chip">
          <span className="type-chip-icon"><Icon size={14} /></span>
          {preset.label}
        </div>
      </section>
      <section className="section">
        <p className="section-label">变换</p>
        <label className="ground-lock">
          <input
            type="checkbox"
            checked={element.groundLocked}
            onChange={(event) => patch('groundLocked', event.target.checked)}
          />
          <span className="ground-lock-box" />
          <span>
            <strong>自动贴地</strong>
            <small>锁定地形底面到 Z = 0</small>
          </span>
        </label>
        <VectorInput
          label="位置"
          hint={element.groundLocked ? 'Z AUTO' : 'M · 0.05'}
          value={element.position}
          step={0.05}
          disabledIndices={element.groundLocked ? [2] : []}
          onChange={(value) => patch('position', value)}
        />
        <VectorInput label="旋转" hint="DEG · 1" value={element.rotation} step={1} onChange={(value) => patch('rotation', value)} />
        <VectorInput label="缩放" hint="× · 0.1" value={element.scale} step={0.1} min={0.1} onChange={(value) => patch('scale', value)} />
      </section>
      <section className="section">
        <p className="section-label">几何参数</p>
        {preset.parameters.map((parameter) => (
          <ParameterInput
            key={parameter.key}
            {...parameter}
            value={element.params[parameter.key]}
            onChange={(next) => updateParam(parameter.key, next)}
          />
        ))}
        <div className="field" style={{ marginBottom: 0 }}>
          <div className="field-label"><span>显示颜色</span></div>
          <div className="color-control">
            <input type="color" value={element.color} onChange={(event) => patch('color', event.target.value)} />
            <code>{element.color.toUpperCase()}</code>
          </div>
        </div>
      </section>
      <section className="section">
        <button className="danger-btn" onClick={() => removeElement(element.id)}>
          <Trash2 size={14} /> 删除元素
        </button>
      </section>
    </aside>
  );
}

export default PropertiesPanel;
