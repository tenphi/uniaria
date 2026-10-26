/**
 * The conformance scenarios that need a real screen reader, against the
 * custom-elements adapter: VoiceOver or NVDA, nightly (vitest.config.ts,
 * `screen-readers`).
 */

import { suites } from '@uniaria/conformance';
import { runConformance } from '@uniaria/testing/browser';

import { elementsAdapter } from './conformance-adapter';

runConformance(elementsAdapter, suites, { phase: 7, screenReader: true });
