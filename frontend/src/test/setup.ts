import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scrollIntoView; stub it so components that call it
// during effects don't throw in tests.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
