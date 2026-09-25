/**
 * toast ordering pages embed the menu as JSON (script tag or public endpoint).
 * BLOCKED until the legal read on ordering-platform terms (brief §6 "legal guardrails").
 * detect.ts still recognizes toast so those sources can be routed to owner claims / photo submissions.
 */
import { AdapterError, type Adapter } from '../types';

export const toast: Adapter = {
  name: 'toast',
  parse() {
    throw new AdapterError('toast adapter disabled pending legal review of platform terms');
  }
};
