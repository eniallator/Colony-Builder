import { raise } from "niall-utils/core";
import { Vector } from "vectyped";
import { describe, expect, it } from "vitest";

import {
  encFacing,
  facingDirOf,
  facingOf,
  FACINGS,
  type Facing,
} from "./facing.ts";

const perpendicularTo = (facing: Facing) =>
  FACINGS.find(other => facingDirOf[other].dot(facingDirOf[facing]) === 0) ??
  raise(new Error("No perpendicular facing"));

describe("facingDirOf", () => {
  it.each(FACINGS)("is a unit vector along an axis for %s", facing => {
    const [x, y] = facingDirOf[facing].toArray();

    expect(Math.abs(x) + Math.abs(y)).toBe(1);
  });

  it("is different for every facing", () => {
    const keys = FACINGS.map(facing => facingDirOf[facing].toArray().join());

    expect(new Set(keys).size).toBe(FACINGS.length);
  });
});

describe("facingOf", () => {
  it.each(FACINGS)("recovers %s from a vector pointing that way", facing => {
    expect(facingOf(facingDirOf[facing].copy().multiply(3))).toBe(facing);
  });

  it.each(FACINGS)("recovers %s whatever the vector's length", facing => {
    for (const length of [0.001, 0.4, 1, 250]) {
      expect(facingOf(facingDirOf[facing].copy().multiply(length))).toBe(
        facing
      );
    }
  });

  it.each(FACINGS)("recovers %s from a vector leaning off its axis", facing => {
    const lean = facingDirOf[perpendicularTo(facing)].copy().multiply(0.5);

    expect(facingOf(facingDirOf[facing].copy().add(lean))).toBe(facing);
  });

  it("is undefined for a zero vector", () => {
    expect(facingOf(Vector.zero(2))).toBeUndefined();
  });

  describe("at 45 degrees", () => {
    // Every diagonal: a facing paired with a facing perpendicular to it.
    const DIAGONALS = FACINGS.flatMap(first =>
      FACINGS.filter(
        second => facingDirOf[first].dot(facingDirOf[second]) === 0
      ).map((second): [Facing, Facing] => [first, second])
    );
    // Whole and fractional lengths, where rounding lands differently.
    const LENGTHS = Array.from({ length: 400 }, (_, i) => i + 1).flatMap(
      length => [length, length * 0.37]
    );
    const diagonal = (first: Facing, second: Facing, length = 1) =>
      facingDirOf[first].copy().add(facingDirOf[second]).multiply(length);

    it.each(DIAGONALS)(
      "gives an exact diagonal between %s and %s a facing at any length",
      (first, second) => {
        for (const length of LENGTHS) {
          expect([first, second]).toContain(
            facingOf(diagonal(first, second, length))
          );
        }
      }
    );

    it.each(DIAGONALS)(
      "gives an exact diagonal between %s and %s to the earlier facing",
      (first, second) => {
        const earlier = FACINGS.find(
          facing => facing === first || facing === second
        );

        for (const length of LENGTHS) {
          expect(facingOf(diagonal(first, second, length))).toBe(earlier);
        }
      }
    );

    it.each(DIAGONALS)(
      "picks the nearer of %s and %s once it leans either way",
      (first, second) => {
        const lean = 1.001;

        for (const length of LENGTHS) {
          const towardsFirst = facingDirOf[first]
            .copy()
            .multiply(lean)
            .add(facingDirOf[second])
            .multiply(length);
          const towardsSecond = facingDirOf[second]
            .copy()
            .multiply(lean)
            .add(facingDirOf[first])
            .multiply(length);

          expect(facingOf(towardsFirst)).toBe(first);
          expect(facingOf(towardsSecond)).toBe(second);
        }
      }
    );
  });
});

describe("encFacing", () => {
  it.each(FACINGS)("accepts %s", facing => {
    expect(encFacing.guard(facing)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(encFacing.guard("not a facing")).toBe(false);
    expect(encFacing.guard(0)).toBe(false);
  });

  it.each(FACINGS)("round-trips %s", facing => {
    expect(encFacing.decode(encFacing.encode(facing))).toBe(facing);
  });
});
