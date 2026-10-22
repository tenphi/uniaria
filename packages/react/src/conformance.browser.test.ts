/**
 * Every conformance suite against the React adapter, up to the roadmap phase
 * it has reached.
 */

import { suites } from '@uniaria/conformance';
import { runConformance } from '@uniaria/testing/browser';

import { reactAdapter } from './conformance-adapter';

runConformance(reactAdapter, suites, { phase: 5 });
