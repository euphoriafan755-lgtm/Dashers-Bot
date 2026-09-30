// Runtime monitor reference injected by the entrypoint. No circular imports.
export let resourceMonitor=null;
export function setResourceMonitor(monitor){resourceMonitor=monitor;}
