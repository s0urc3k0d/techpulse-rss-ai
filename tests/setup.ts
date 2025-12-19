import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

global.localStorage = localStorageMock as any;

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
