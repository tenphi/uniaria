/**
 * Every conformance suite against the Vue adapter, up to the roadmap phase
 * it has reached.
 */

import { suites } from '@uniaria/conformance';
import { runConformance } from '@uniaria/testing/browser';

import { vueAdapter } from './conformance-adapter';

runConformance(vueAdapter, suites, { phase: 5 });
