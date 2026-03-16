let runtime = null;
export function setEmailRuntime(next) {
    runtime = next;
}
export function getEmailRuntime() {
    if (!runtime) {
        throw new Error("Email plugin runtime not initialized. Was the plugin registered?");
    }
    return runtime;
}
//# sourceMappingURL=runtime.js.map