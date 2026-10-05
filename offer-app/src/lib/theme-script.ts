// Shared by the root layout (server) and the client theme store.

export const THEME_STORAGE_KEY = "offer-theme";

/** Runs in <head> before first paint so the page never flashes the wrong theme. */
export const themeScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})()`;
