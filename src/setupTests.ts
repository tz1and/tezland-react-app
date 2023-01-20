import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';
// Workaround for Blob.arrayBuffer not being in jsdom: https://github.com/jsdom/jsdom/issues/2555#issuecomment-1076466677
import "blob-polyfill";

// extends Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
    cleanup();
});