import { growwAdapter } from "../brokers/groww";
import { runCapture } from "./run-capture";

/**
 * Content entry for groww.in — bundled standalone as content-groww.js
 * (extension/vite.content-groww.config.ts) and registered dynamically when the
 * user enables Groww capture in the panel settings.
 */
runCapture(growwAdapter);
