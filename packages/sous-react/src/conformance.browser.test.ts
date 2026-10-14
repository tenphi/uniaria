/**
 * Every conformance suite against the React adapter, up to the roadmap phase
 * it has reached.
 */

import { suites } from '@tenphi/sous-conformance';
import { runConformance } from '@tenphi/sous-testing/browser';

import { reactAdapter } from './conformance-adapter';

runConformance(reactAdapter, suites, { phase: 2 });
