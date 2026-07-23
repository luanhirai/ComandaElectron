import type { BarApi } from "../preload/preload.js";

declare global {
  interface Window {
    barApi: BarApi;
  }
}

export {};
