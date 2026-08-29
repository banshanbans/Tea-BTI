import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

class SpeechSynthesisUtteranceMock {
  lang = "";
  rate = 1;
  constructor(public text: string) {}
}

Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
  configurable: true,
  value: SpeechSynthesisUtteranceMock,
});
Object.defineProperty(window, "speechSynthesis", {
  configurable: true,
  value: { cancel: () => undefined, speak: () => undefined },
});
