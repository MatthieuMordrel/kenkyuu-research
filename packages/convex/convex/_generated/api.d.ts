/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as budgetAlert from "../budgetAlert.js";
import type * as costTracking from "../costTracking.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as earnings from "../earnings.js";
import type * as earningsActions from "../earningsActions.js";
import type * as earningsTriggerActions from "../earningsTriggerActions.js";
import type * as earningsTriggers from "../earningsTriggers.js";
import type * as http from "../http.js";
import type * as lib_anthropicBatchHelpers from "../lib/anthropicBatchHelpers.js";
import type * as lib_exchangeTimezones from "../lib/exchangeTimezones.js";
import type * as lib_finnhub_mapExchange from "../lib/finnhub/mapExchange.js";
import type * as lib_finnhub_rankSearchResults from "../lib/finnhub/rankSearchResults.js";
import type * as lib_finnhub_types from "../lib/finnhub/types.js";
import type * as notifications from "../notifications.js";
import type * as prompts from "../prompts.js";
import type * as providers_anthropic from "../providers/anthropic.js";
import type * as providers_anthropicModelLimits from "../providers/anthropicModelLimits.js";
import type * as providers_constants from "../providers/constants.js";
import type * as providers_formatOpenaiAdapter from "../providers/formatOpenaiAdapter.js";
import type * as providers_index from "../providers/index.js";
import type * as providers_openai from "../providers/openai.js";
import type * as providers_openaiResponses from "../providers/openaiResponses.js";
import type * as providers_types from "../providers/types.js";
import type * as researchActions from "../researchActions.js";
import type * as researchConcurrency from "../researchConcurrency.js";
import type * as researchFormat from "../researchFormat.js";
import type * as researchFormatActions from "../researchFormatActions.js";
import type * as researchFormatCore from "../researchFormatCore.js";
import type * as researchFormatPrepass from "../researchFormatPrepass.js";
import type * as researchJobs from "../researchJobs.js";
import type * as scheduleActions from "../scheduleActions.js";
import type * as schedules from "../schedules.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as stockLookupActions from "../stockLookupActions.js";
import type * as stocks from "../stocks.js";
import type * as validation from "../validation.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auditLog: typeof auditLog;
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  budgetAlert: typeof budgetAlert;
  costTracking: typeof costTracking;
  crons: typeof crons;
  dashboard: typeof dashboard;
  earnings: typeof earnings;
  earningsActions: typeof earningsActions;
  earningsTriggerActions: typeof earningsTriggerActions;
  earningsTriggers: typeof earningsTriggers;
  http: typeof http;
  "lib/anthropicBatchHelpers": typeof lib_anthropicBatchHelpers;
  "lib/exchangeTimezones": typeof lib_exchangeTimezones;
  "lib/finnhub/mapExchange": typeof lib_finnhub_mapExchange;
  "lib/finnhub/rankSearchResults": typeof lib_finnhub_rankSearchResults;
  "lib/finnhub/types": typeof lib_finnhub_types;
  notifications: typeof notifications;
  prompts: typeof prompts;
  "providers/anthropic": typeof providers_anthropic;
  "providers/anthropicModelLimits": typeof providers_anthropicModelLimits;
  "providers/constants": typeof providers_constants;
  "providers/formatOpenaiAdapter": typeof providers_formatOpenaiAdapter;
  "providers/index": typeof providers_index;
  "providers/openai": typeof providers_openai;
  "providers/openaiResponses": typeof providers_openaiResponses;
  "providers/types": typeof providers_types;
  researchActions: typeof researchActions;
  researchConcurrency: typeof researchConcurrency;
  researchFormat: typeof researchFormat;
  researchFormatActions: typeof researchFormatActions;
  researchFormatCore: typeof researchFormatCore;
  researchFormatPrepass: typeof researchFormatPrepass;
  researchJobs: typeof researchJobs;
  scheduleActions: typeof scheduleActions;
  schedules: typeof schedules;
  seed: typeof seed;
  settings: typeof settings;
  stockLookupActions: typeof stockLookupActions;
  stocks: typeof stocks;
  validation: typeof validation;
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
