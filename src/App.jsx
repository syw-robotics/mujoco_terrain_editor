import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Viewport from './components/Viewport';
import PropertiesPanel from './components/PropertiesPanel';
import useSceneStore from './store/useSceneStore';
import useXmlLoader, { isXmlFile } from './hooks/useXmlLoader';
import { translate } from './i18n';

function isFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function App() {
  const theme = useSceneStore((state) => state.theme);
  const language = useSceneStore((state) => state.language);
  const hasUnsavedChanges = useSceneStore((state) => state.hasUnsavedChanges);
  const loadXmlFile = useXmlLoader();
  const fileDragDepthRef = useRef(0);
  const [fileDragActive, setFileDragActive] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      // Required by Chrome and other browsers that still use returnValue to
      // trigger their native unsaved-changes confirmation dialog.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const editing = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (editing) return;

      const store = useSceneStore.getState();
      const key = event.key.toLowerCase();
      const commandKey = event.ctrlKey || event.metaKey;

      if (commandKey && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (commandKey && key === 'y') {
        event.preventDefault();
        store.redo();
        return;
      }

      if (store.selectedId && !commandKey && !event.altKey && !event.shiftKey) {
        if (key === 'w') {
          event.preventDefault();
          store.setTransformMode('translate');
        }
        if (key === 'e') {
          event.preventDefault();
          store.setTransformMode('rotate');
        }
      }
      if (key === 'escape') {
        if (store.colorPickTargetId) store.cancelColorPicking();
        else store.selectElement(null);
      }
      if ((key === 'delete' || key === 'backspace') && store.selectedId) {
        store.removeSelectedElements();
      }
      if (commandKey && key === 'd' && store.selectedId) {
        event.preventDefault();
        store.duplicateElement(store.selectedId);
      }
      if (event.shiftKey && store.selectedId && event.code === 'BracketLeft') {
        event.preventDefault();
        store.rotateElement90(store.selectedId, 1);
      }
      if (event.shiftKey && store.selectedId && event.code === 'BracketRight') {
        event.preventDefault();
        store.rotateElement90(store.selectedId, -1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFileDragEnter = (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    fileDragDepthRef.current += 1;
    setFileDragActive(true);
  };

  const handleFileDragOver = (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleFileDragLeave = (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1);
    if (fileDragDepthRef.current === 0) setFileDragActive(false);
  };

  const handleFileDrop = (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    fileDragDepthRef.current = 0;
    setFileDragActive(false);
    const items = Array.from(event.dataTransfer.items || []).filter((item) => item.kind === 'file');
    const selectedItem = items.find((item) => isXmlFile(item.getAsFile())) || items[0];
    const files = Array.from(event.dataTransfer.files || []);
    const file = selectedItem?.getAsFile() || files.find(isXmlFile) || files[0];
    if (!file) return;

    void (async () => {
      let fileHandle = null;
      if (selectedItem?.getAsFileSystemHandle) {
        try {
          const handle = await selectedItem.getAsFileSystemHandle();
          if (handle?.kind === 'file') fileHandle = handle;
        } catch {
          // Loading can still proceed when the browser declines a writable handle.
        }
      }
      await loadXmlFile(file, fileHandle);
    })();
  };

  return (
    <main
      className="app-shell"
      onDragEnterCapture={handleFileDragEnter}
      onDragOverCapture={handleFileDragOver}
      onDragLeaveCapture={handleFileDragLeave}
      onDropCapture={handleFileDrop}
    >
      <TopBar />
      <div className="app-workspace">
        <Sidebar />
        <Viewport />
        <PropertiesPanel />
      </div>
      {fileDragActive && (
        <div className="app-drop">
          <p>{translate(language, 'dropXml')}</p>
        </div>
      )}
    </main>
  );
}

export default App;
