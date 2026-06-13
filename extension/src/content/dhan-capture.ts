import { dhanAdapter } from "../brokers/dhan";
import { runCapture } from "./run-capture";

/**
 * Content entry for Dhan (web.dhan.co / tv.dhan.co / options.dhan.co) — bundled
 * standalone as content-dhan.js (extension/vite.content-dhan.config.ts) and
 * registered dynamically when the user enables Dhan capture in the panel settings.
 */
runCapture(dhanAdapter);
