import { create } from 'zustand';

export const useUIStore = create((set) => ({
  // Modal state
  modal: {
    isOpen: false,
    type: null,
    data: null,
  },
  openModal: (type, data = null) =>
    set({ modal: { isOpen: true, type, data } }),
  closeModal: () =>
    set({ modal: { isOpen: false, type: null, data: null } }),

  // Toast notifications
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { id: Date.now(), ...toast }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Sidebar (mobile)
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),

  // Loading overlay
  globalLoading: false,
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
}));

// Helper functions for toasts
export const toast = {
  success: (message) =>
    useUIStore.getState().addToast({
      type: 'success',
      message,
      duration: 3000,
    }),
  error: (message) =>
    useUIStore.getState().addToast({
      type: 'error',
      message,
      duration: 5000,
    }),
  info: (message) =>
    useUIStore.getState().addToast({
      type: 'info',
      message,
      duration: 3000,
    }),
  warning: (message) =>
    useUIStore.getState().addToast({
      type: 'warning',
      message,
      duration: 4000,
    }),
};
