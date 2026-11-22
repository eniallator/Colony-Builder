import {
  encNumber,
  encObjectOf,
  type EncodableWritableType,
} from "./encoding/index.ts";

// All in seconds. Written to every frame/tick, hence the writable type.
export const encTime = encObjectOf({
  start: encNumber("f64"),
  lastFrame: encNumber("f64"),
  now: encNumber("f64"),
  delta: encNumber("f64"),
});
export type Time = EncodableWritableType<typeof encTime>;
