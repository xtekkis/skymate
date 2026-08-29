import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library registers its own cleanup only when Vitest globals are on,
// and they are off here. Without this the next test would open on the previous
// test's DOM, and getByRole would find two of everything.
afterEach(cleanup);
