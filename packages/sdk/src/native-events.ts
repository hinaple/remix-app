import type {
  RemixNativeEventAction,
  RemixNormalizedActionCall,
} from "./actions.js";
import type { RemixEventMap } from "./events.js";

export type RemixNativeEventType = keyof RemixEventMap;
export type RemixNativeEventPrimitive = string | number | boolean | null;
export type RemixNativeEventActivityState =
  | "inactive"
  | "resumed"
  | "always";

export interface RemixNativeEventMatcher {
  eq?: RemixNativeEventPrimitive;
  ne?: RemixNativeEventPrimitive;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  in?: RemixNativeEventPrimitive[];
  contains?: string;
  exists?: boolean;
}

export interface RemixNativeEventRule {
  on: RemixNativeEventType;
  /** Activity state in which the rule is evaluated. Defaults to `always`. */
  activityState?: RemixNativeEventActivityState;
  when?: Record<string, RemixNativeEventPrimitive | RemixNativeEventMatcher>;
  actions: RemixNativeEventAction[];
  expiresIn?: number;
}

export interface RemixNativeEventsConfig {
  rules: RemixNativeEventRule[];
}

export interface RemixNativeEventProjectRule {
  on: RemixNativeEventType;
  activityState: RemixNativeEventActivityState;
  when: Record<string, RemixNativeEventPrimitive | RemixNativeEventMatcher>;
  actions: RemixNormalizedActionCall[];
  expiresIn: number;
}

export interface RemixNativeEventsProjectConfig {
  rules: RemixNativeEventProjectRule[];
}
