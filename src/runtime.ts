/**
 * Dependency injection for the email plugin runtime.
 * Follows the exact same pattern as Signal/Discord/BlueBubbles plugins.
 */
import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setEmailRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getEmailRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Email plugin runtime not initialized. Was the plugin registered?");
  }
  return runtime;
}
