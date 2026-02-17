import '@testing-library/jest-dom';

// Mock localStorage
const storage = new Map<string, string>();

const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, String(value));
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key);
  }),
  clear: vi.fn(() => {
    storage.clear();
  }),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock DOMParser for RSS parsing tests
global.DOMParser = class DOMParser {
  parseFromString(xmlString: string, mimeType: string) {
    // Basic mock implementation
    return {
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
    };
  }
} as any;
