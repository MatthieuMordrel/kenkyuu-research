/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as budgetAlert from "../budgetAlert.js";
import type * as costTracking from "../costTracking.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as earnings from "../earnings.js";
import type * as earningsActions from "../earningsActions.js";
import type * as http from "../http.js";
import type * as notifications from "../notifications.js";
import type * as prompts from "../prompts.js";
import type * as researchActions from "../researchActions.js";
import type * as researchJobs from "../researchJobs.js";
import type * as scheduleActions from "../scheduleActions.js";
import type * as schedules from "../schedules.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as stocks from "../stocks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  budgetAlert: typeof budgetAlert;
  costTracking: typeof costTracking;
  crons: typeof crons;
  dashboard: typeof dashboard;
  earnings: typeof earnings;
  earningsActions: typeof earningsActions;
  http: typeof http;
  notifications: typeof notifications;
  prompts: typeof prompts;
  researchActions: typeof researchActions;
  researchJobs: typeof researchJobs;
  scheduleActions: typeof scheduleActions;
  schedules: typeof schedules;
  seed: typeof seed;
  settings: typeof settings;
  stocks: typeof stocks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
