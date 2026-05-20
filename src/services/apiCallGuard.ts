export function assertUserInitiatedApiCall(context: { source: string, userInitiated: boolean, actionName: string }) {
    if (!context.userInitiated) {
        console.warn(`[ApiCallGuard] Blocked unauthorized API call from ${context.source}: ${context.actionName}`);
    } else {
        console.log(`[ApiCallGuard] Allowed user-initiated API call from ${context.source}: ${context.actionName}`);
    }
}
