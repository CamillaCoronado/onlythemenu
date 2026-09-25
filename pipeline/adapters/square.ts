/**
 * square ordering pages embed the menu as JSON (script tag or public endpoint).
 * BLOCKED until the legal read on ordering-platform terms (brief §6 "legal guardrails").
 * detect.ts still recognizes square so those sources can be routed to owner claims / photo submissions.
 */
import { AdapterError, type Adapter } from '../types';

export const square: Adapter = {
  name: 'square',
  parse() {
    throw new AdapterError('square adapter disabled pending legal review of platform terms');
  }
};
