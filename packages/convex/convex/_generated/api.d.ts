/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as prompts from "../prompts.js";
import type * as researchActions from "../researchActions.js";
import type * as researchJobs from "../researchJobs.js";
import type * as scheduleActions from "../scheduleActions.js";
import type * as schedules from "../schedules.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as stocks from "../stocks.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  prompts: typeof prompts;
  researchActions: typeof researchActions;
  researchJobs: typeof researchJobs;
  scheduleActions: typeof scheduleActions;
  schedules: typeof schedules;
  seed: typeof seed;
  settings: typeof settings;
  stocks: typeof stocks;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
