import { FileItem } from '../types';
import { smartSelectFiles } from './fileHelpers';

export interface SavedSelectionPref {
  preset?: 'core' | 'all' | 'none' | 'custom';
  mode?: 'include' | 'exclude';
  paths?: string[];
  updatedAt: number;
}

const STORAGE_KEY_SELECTIONS = 'repointxt_saved_selections';
const MAX_SAVED_PROJECTS = 40;

const loadAllSavedSelections = (): Record<string, SavedSelectionPref> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SELECTIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveAllSelectionsMap = (map: Record<string, SavedSelectionPref>) => {
  try {
    localStorage.setItem(STORAGE_KEY_SELECTIONS, JSON.stringify(map));
  } catch (err) {
    console.warn('Failed to save selection preferences:', err);
  }
};

export const getGitHubProjectKey = (owner: string, repo: string): string => {
  return `gh:${owner.toLowerCase()}/${repo.toLowerCase()}`;
};

export const getLocalProjectKey = (name: string, tree: FileItem[]): string => {
  const fileList = tree.slice(0, 30).map(f => f.path).join('|');
  let hash = 0;
  for (let i = 0; i < fileList.length; i++) {
    hash = (hash << 5) - hash + fileList.charCodeAt(i);
    hash |= 0;
  }
  return `loc:${name.toLowerCase()}:${Math.abs(hash)}`;
};

export const saveSelectionPref = (
  projectKey: string,
  preset: 'core' | 'all' | 'none' | 'custom',
  selectedFiles: FileItem[],
  totalTree: FileItem[]
): void => {
  if (!projectKey) return;
  const map = loadAllSavedSelections();

  let pref: SavedSelectionPref = { preset, updatedAt: Date.now() };

  if (preset === 'custom') {
    const selectedPaths = new Set(selectedFiles.map(f => f.path));
    const unselectedPaths = totalTree.filter(f => !selectedPaths.has(f.path)).map(f => f.path);

    if (selectedFiles.length <= unselectedPaths.length) {
      pref.mode = 'include';
      pref.paths = Array.from(selectedPaths);
    } else {
      pref.mode = 'exclude';
      pref.paths = unselectedPaths;
    }
  }

  map[projectKey] = pref;

  const entries = Object.entries(map);
  if (entries.length > MAX_SAVED_PROJECTS) {
    entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    const trimmed = Object.fromEntries(entries.slice(0, MAX_SAVED_PROJECTS));
    saveAllSelectionsMap(trimmed);
  } else {
    saveAllSelectionsMap(map);
  }
};

export const loadSelectionPref = (
  projectKey: string,
  tree: FileItem[]
): FileItem[] | null => {
  if (!projectKey || tree.length === 0) return null;
  const map = loadAllSavedSelections();
  const pref = map[projectKey];
  if (!pref) return null;

  if (pref.preset === 'core') return smartSelectFiles(tree);
  if (pref.preset === 'all') return tree;
  if (pref.preset === 'none') return [];

  if (pref.preset === 'custom' && pref.paths) {
    const pathSet = new Set(pref.paths);
    if (pref.mode === 'include') {
      return tree.filter(f => pathSet.has(f.path));
    } else if (pref.mode === 'exclude') {
      return tree.filter(f => !pathSet.has(f.path));
    }
  }

  return null;
};
