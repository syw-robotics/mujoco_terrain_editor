import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Viewport from './components/Viewport';
import PropertiesPanel from './components/PropertiesPanel';
import useSceneStore from './store/useSceneStore';

function App() {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (editing) return;

      const store = useSceneStore.getState();
      const key = event.key.toLowerCase();

      if (key === 'w') store.setTransformMode('translate');
      if (key === 'e') store.setTransformMode('rotate');
      if (key === 'r') store.setTransformMode('scale');
      if (key === 'escape') store.selectElement(null);
      if ((key === 'delete' || key === 'backspace') && store.selectedId) {
        store.removeElement(store.selectedId);
      }
      if ((event.ctrlKey || event.metaKey) && key === 'd' && store.selectedId) {
        event.preventDefault();
        store.duplicateElement(store.selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <main className="app-shell">
      <TopBar />
      <div className="workspace">
        <Sidebar />
        <Viewport />
        <PropertiesPanel />
      </div>
    </main>
  );
}

export default App;
