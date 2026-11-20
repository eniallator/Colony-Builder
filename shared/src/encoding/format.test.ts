import { isNumber } from "deep-guards";
import { describe, expect, it } from "vitest";

import { codU8 } from "./binary/codec.ts";
import { binaryEncodable } from "./binary/encodable.ts";
import type { Codec, Format } from "./format.ts";
import { jsonArrayOf, jsonNumber } from "./json/codec.ts";
import { jsonEncodable } from "./json/encodable.ts";

type FormatA = Format<"a", string>;
type FormatB = Format<"b", string>;

describe("formats", () => {
  it("keep codecs of different formats apart", () => {
    const a: Codec<FormatA> = {};
    // @ts-expect-error a codec of one format is not a codec of another
    const b: Codec<FormatB> = a;

    expect([a, b]).toHaveLength(2);
  });

  it("only let a combinator take codecs of its own format", () => {
    // @ts-expect-error a binary codec is not a JSON codec
    const array = jsonArrayOf(codU8);

    expect(array).toBeDefined();
  });

  it("only let an encodable take a codec of its own format", () => {
    // @ts-expect-error a JSON codec is not a binary codec
    const enc = binaryEncodable(isNumber, jsonNumber);
    const json = jsonEncodable(isNumber, jsonNumber);

    expect([enc, json]).toHaveLength(2);
  });
});
