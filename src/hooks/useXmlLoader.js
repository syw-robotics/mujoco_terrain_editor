import { useCallback } from 'react';
import useSceneStore from '../store/useSceneStore';
import { translate } from '../i18n';
import { importFromXML } from '../utils/xmlImporter';

export function isXmlFile(file) {
  if (!file) return false;
  return /\.xml$/i.test(file.name) || file.type === 'application/xml' || file.type === 'text/xml';
}

export default function useXmlLoader() {
  const language = useSceneStore((state) => state.language);
  const loadElements = useSceneStore((state) => state.loadElements);

  return useCallback(async (file, fileHandle = null) => {
    const t = (key, variables) => translate(language, key, variables);
    if (!isXmlFile(file)) {
      window.alert(t('loadFileTypeError'));
      return false;
    }

    try {
      const importedElements = importFromXML(await file.text());
      if (useSceneStore.getState().hasUnsavedChanges && !window.confirm(t('loadUnsavedConfirm'))) {
        return false;
      }
      const sourceFileName = /\.xml$/i.test(file.name) ? file.name : `${file.name || 'terrain'}.xml`;
      loadElements(importedElements, sourceFileName, fileHandle);
      return true;
    } catch (error) {
      window.alert(`${t('loadError')}: ${error.message}`);
      return false;
    }
  }, [language, loadElements]);
}
