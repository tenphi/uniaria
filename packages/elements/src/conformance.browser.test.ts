/**
 * Every conformance suite against the custom-elements adapter, up to the
 * roadmap phase it has reached.
 */

import { suites } from '@uniaria/conformance';
import { runConformance } from '@uniaria/testing/browser';

import { elementsAdapter } from './conformance-adapter';

runConformance(elementsAdapter, suites, { phase: 7 });
