/** Resource names are scoped per registry model id so configs never collide. */
export function agentName(
  role: "coordinator" | "researcher",
  modelId: string
): string {
  return `kenkyuu-research/${role}/${modelId}`;
}
