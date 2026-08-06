import { useEffect, useRef, useState } from 'react';
import { Box, CheckCircle2, Copy, Download, Moon, Move3D, Redo2, Rotate3D, Save, Sun, Trash2, Undo2, Upload } from 'lucide-react';
import useSceneStore from '../store/useSceneStore';
import { downloadXML, saveXMLToHandle, timestampedXMLFilename } from '../utils/xmlExporter';
import { translate } from '../i18n';
import useXmlLoader from '../hooks/useXmlLoader';

const MODES = [
  { mode: 'translate', labelKey: 'move', key: 'W', Icon: Move3D },
  { mode: 'rotate', labelKey: 'rotate', key: 'E', Icon: Rotate3D },
];

function TopBar() {
  const fileInputRef = useRef(null);
  const saveToastTimerRef = useRef(null);
  const [saveToast, setSaveToast] = useState('');
  const elements = useSceneStore((state) => state.elements);
  const selectedId = useSceneStore((state) => state.selectedId);
  const selectedCount = useSceneStore((state) => state.selectedIds.length);
  const transformMode = useSceneStore((state) => state.transformMode);
  const setTransformMode = useSceneStore((state) => state.setTransformMode);
  const clearAll = useSceneStore((state) => state.clearAll);
  const duplicateElement = useSceneStore((state) => state.duplicateElement);
  const undo = useSceneStore((state) => state.undo);
  const redo = useSceneStore((state) => state.redo);
  const canUndo = useSceneStore((state) => state.historyPast.length > 0);
  const canRedo = useSceneStore((state) => state.historyFuture.length > 0);
  const language = useSceneStore((state) => state.language);
  const setLanguage = useSceneStore((state) => state.setLanguage);
  const theme = useSceneStore((state) => state.theme);
  const toggleTheme = useSceneStore((state) => state.toggleTheme);
  const sourceFileName = useSceneStore((state) => state.sourceFileName);
  const sourceFileHandle = useSceneStore((state) => state.sourceFileHandle);
  const hasUnsavedChanges = useSceneStore((state) => state.hasUnsavedChanges);
  const markSceneSaved = useSceneStore((state) => state.markSceneSaved);
  const loadXmlFile = useXmlLoader();
  const t = (key, variables) => translate(language, key, variables);

  useEffect(() => () => {
    if (saveToastTimerRef.current) window.clearTimeout(saveToastTimerRef.current);
  }, []);

  const showSaveToast = (message) => {
    if (saveToastTimerRef.current) window.clearTimeout(saveToastTimerRef.current);
    setSaveToast(message);
    saveToastTimerRef.current = window.setTimeout(() => {
      setSaveToast('');
      saveToastTimerRef.current = null;
    }, 3000);
  };

  const handleClear = () => {
    if (elements.length && window.confirm(t('clearConfirm', { count: elements.length }))) clearAll();
  };

  const handleLoad = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void loadXmlFile(file);
  };

  const handleChooseFile = async () => {
    if (!window.showOpenFilePicker) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{
          description: 'MuJoCo XML',
          accept: { 'application/xml': ['.xml'] },
        }],
      });
      await loadXmlFile(await fileHandle.getFile(), fileHandle);
    } catch (error) {
      if (error.name !== 'AbortError') window.alert(`${t('loadError')}: ${error.message}`);
    }
  };

  const handleExport = () => {
    downloadXML(elements, timestampedXMLFilename());
    markSceneSaved();
  };

  const handleSave = async () => {
    if (!sourceFileHandle?.createWritable) {
      window.alert(t('saveUnavailable'));
      return;
    }
    try {
      const permissionOptions = { mode: 'readwrite' };
      if (sourceFileHandle.queryPermission && sourceFileHandle.requestPermission) {
        let permission = await sourceFileHandle.queryPermission(permissionOptions);
        if (permission !== 'granted') permission = await sourceFileHandle.requestPermission(permissionOptions);
        if (permission !== 'granted') throw new Error(t('savePermissionDenied'));
      }
      await saveXMLToHandle(elements, sourceFileHandle);
      markSceneSaved();
      showSaveToast(t('saveSuccess', { filename: sourceFileName }));
    } catch (error) {
      if (error.name !== 'AbortError') window.alert(`${t('saveError')}: ${error.message}`);
    }
  };

  return (
    <>
      <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><Box size={15} strokeWidth={1.8} /></div>
        <div>
          <div className="brand-title">MuJoCo Terrain Editor</div>
        </div>
      </div>
      <div className="toolbar-separator" />
      <div className="mode-switch">
        {MODES.map(({ mode, labelKey, key, Icon }) => (
          <button
            key={mode}
            className={`mode-btn ${transformMode === mode ? 'active' : ''}`}
            disabled={selectedCount > 1 && mode === 'rotate'}
            onClick={() => setTransformMode(mode)}
            title={selectedCount > 1 && mode === 'rotate' ? t('multiMoveOnly') : `${t(labelKey)} (${key})`}
          >
            <Icon size={14} strokeWidth={1.7} />
            <span className="mode-label">{t(labelKey)}</span>
            <kbd>{key}</kbd>
          </button>
        ))}
      </div>
      <div className="spacer" />
      <div className="history-controls">
        <button className="icon-btn" disabled={!canUndo} onClick={undo} title={`${t('undo')} (Ctrl+Z)`}>
          <Undo2 size={15} />
        </button>
        <button className="icon-btn" disabled={!canRedo} onClick={redo} title={`${t('redo')} (Ctrl+Shift+Z)`}>
          <Redo2 size={15} />
        </button>
      </div>
      <div className="language-switch" aria-label="Language">
        <button className={language === 'zh' ? 'active' : ''} onClick={() => setLanguage('zh')}>中</button>
        <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button>
      </div>
      <button
        className="icon-btn theme-toggle"
        onClick={toggleTheme}
        title={theme === 'light' ? t('darkMode') : t('lightMode')}
        aria-label={theme === 'light' ? t('darkMode') : t('lightMode')}
      >
        {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
      </button>
      <button
        className="icon-btn"
        disabled={!selectedId}
        onClick={() => duplicateElement(selectedId)}
        title={`${t('duplicate')} (Ctrl+D)`}
        style={{ opacity: selectedId ? 1 : 0.35 }}
      ><Copy size={15} /></button>
      <button className="icon-btn" onClick={handleClear} title={t('clear')}><Trash2 size={15} /></button>
      <input
        ref={fileInputRef}
        className="file-input"
        type="file"
        accept=".xml,application/xml,text/xml"
        onChange={handleLoad}
      />
      <button className="load-btn" onClick={handleChooseFile} title={t('loadTitle')}>
        <Upload size={14} strokeWidth={2.2} /> <span>{t('loadXml')}</span>
      </button>
      {sourceFileName && (
        <button
          className="save-btn"
          disabled={!hasUnsavedChanges}
          onClick={handleSave}
          title={hasUnsavedChanges ? t('saveTitle', { filename: sourceFileName }) : t('savedTitle')}
        >
          <Save size={14} strokeWidth={2.2} /> <span>{t('saveXml')}</span>
        </button>
      )}
      <button
        className="primary-btn"
        onClick={handleExport}
        title={t('exportTitle')}
      ><Download size={14} strokeWidth={2.2} /> {t('exportXml')}</button>
      </header>
      {saveToast && (
        <div className="save-toast" role="status" aria-live="polite">
          <CheckCircle2 size={18} strokeWidth={2.2} />
          <span>{saveToast}</span>
        </div>
      )}
    </>
  );
}

export default TopBar;
