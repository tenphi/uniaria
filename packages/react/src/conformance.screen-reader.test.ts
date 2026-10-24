/**
 * The conformance scenarios that need a real screen reader, against the
 * React adapter: VoiceOver or NVDA, nightly (vitest.config.ts,
 * `screen-readers`).
 */

import { suites } from '@uniaria/conformance';
import { runConformance } from '@uniaria/testing/browser';

import { reactAdapter } from './conformance-adapter';

runConformance(reactAdapter, suites, { phase: 6, screenReader: true });
