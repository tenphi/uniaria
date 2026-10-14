/**
 * Every conformance suite against the custom-elements adapter, up to the
 * roadmap phase it has reached.
 */

import { suites } from '@tenphi/sous-conformance';
import { runConformance } from '@tenphi/sous-testing/browser';

import { elementsAdapter } from './conformance-adapter';

runConformance(elementsAdapter, suites, { phase: 2 });
