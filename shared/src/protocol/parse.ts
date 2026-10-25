import type { Guard } from "deep-guards";
import { attempt } from "niall-utils";

export const parseJson: {
  (raw: string): unknown;
  <T>(raw: string, guard: Guard<T>): T | undefined;
} = <T>(raw: string, guard?: Guard<T>): unknown => {
  const parsed = attempt((): unknown => JSON.parse(raw));
  return guard != null ? (guard(parsed) ? parsed : undefined) : parsed;
};
