import { create } from 'zustand';
import type { TObjectType } from '../lib/vendorConfig';

export interface IObjectTab {
  id: string;
  type: TObjectType;
  name: string;
  schema?: string;
  tableName?: string; // for dependent objects (triggers, policies)
}

interface ObjectBrowserState {
  // Tree state
  expandedCategories: Set<string>;
  expandedObjects: Set<string>;
  expandedSubCategories: Set<string>;
  searchFilter: string;

  // Tab state
  openTabs: IObjectTab[];
  activeTabId: string | null;

  // Actions
  toggleCategory: (categoryId: string) => void;
  toggleObject: (objectId: string) => void;
  toggleSubCategory: (subCategoryId: string) => void;
  setSearchFilter: (filter: string) => void;
  openTab: (tab: IObjectTab) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  reset: () => void;
}

export const useObjectBrowserStore = create<ObjectBrowserState>((set) => ({
  expandedCategories: new Set<string>(),
  expandedObjects: new Set<string>(),
  expandedSubCategories: new Set<string>(),
  searchFilter: '',

  openTabs: [],
  activeTabId: null,

  toggleCategory: (categoryId) =>
    set((state) => {
      const next = new Set(state.expandedCategories);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return { expandedCategories: next };
    }),

  toggleObject: (objectId) =>
    set((state) => {
      const next = new Set(state.expandedObjects);
      if (next.has(objectId)) next.delete(objectId);
      else next.add(objectId);
      return { expandedObjects: next };
    }),

  toggleSubCategory: (subCategoryId) =>
    set((state) => {
      const next = new Set(state.expandedSubCategories);
      if (next.has(subCategoryId)) next.delete(subCategoryId);
      else next.add(subCategoryId);
      return { expandedSubCategories: next };
    }),

  setSearchFilter: (filter) => set({ searchFilter: filter }),

  openTab: (tab) =>
    set((state) => {
      const existing = state.openTabs.find((t) => t.id === tab.id);
      if (existing) {
        return { activeTabId: tab.id };
      }
      return {
        openTabs: [...state.openTabs, tab],
        activeTabId: tab.id,
      };
    }),

  closeTab: (tabId) =>
    set((state) => {
      const idx = state.openTabs.findIndex((t) => t.id === tabId);
      const next = state.openTabs.filter((t) => t.id !== tabId);
      let activeTabId = state.activeTabId;
      if (activeTabId === tabId) {
        activeTabId = next[Math.min(idx, next.length - 1)]?.id ?? null;
      }
      return { openTabs: next, activeTabId };
    }),

  closeOtherTabs: (tabId) =>
    set((state) => ({
      openTabs: state.openTabs.filter((t) => t.id === tabId),
      activeTabId: tabId,
    })),

  closeAllTabs: () => set({ openTabs: [], activeTabId: null }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  reset: () =>
    set({
      expandedCategories: new Set(),
      expandedObjects: new Set(),
      expandedSubCategories: new Set(),
      searchFilter: '',
      openTabs: [],
      activeTabId: null,
    }),
}));
