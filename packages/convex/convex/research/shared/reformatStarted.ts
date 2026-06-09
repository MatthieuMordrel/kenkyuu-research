/** Result shape returned by the reformat backfill actions. */
export interface ReformatStarted {
  jobId: string;
  status: "format_started";
}
