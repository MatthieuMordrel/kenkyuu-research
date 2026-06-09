// Matcher type augmentation is loaded via tsconfig "types" ("@testing-library/jest-dom/vitest")
import * as jestDomMatchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

expect.extend(jestDomMatchers);

// Mock window.matchMedia for components that use it (useIsMobile, useTheme)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
