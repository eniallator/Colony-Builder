import {
  createItem,
  createPlayer,
  createRobot,
  facingDirOf,
  FACINGS,
  ITEM_TILES,
  itemIds,
  REGION_SIDE_LENGTH,
  World,
  worldPosToRegionIds,
  type EntityId,
  type StructureData,
  type Task,
} from "@colony-builder/shared";
import { raise } from "niall-utils/core";
import { Vector } from "vectyped";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAtlas } from "../atlas.ts";
import { variantIndex } from "../sprite.ts";
import { conveyorSpriteName } from "../structure-sprites.ts";
import { renderAboveGround } from "./render-above-ground.ts";
import {
  atlasOf,
  createFakeContext,
  createSystemArgs,
  drawnColumns,
  FakePattern,
  spriteOf,
  TILE_SIZE,
  type FakeContext,
  type SystemArgs,
} from "./render-test-utils.ts";

vi.mock("../atlas.ts", () => ({ getAtlas: vi.fn() }));

const structure: StructureData = { type: "tree", data: true };
const otherStructure: StructureData = { type: "cactus", data: true };
const [itemId] = itemIds;
const [facing] = FACINGS;

/** The sprite's pixels are scaled by this: 16px per tile is the art's own size. */
const ZOOM = 4;
const PX_PER_TILE = 2 ** ZOOM;
/** How far a belt lifts what rides it, in art pixels. Only belts facing `facing` lift. */
const RAISE = 4;

const entitySprites = ["player", "robot"].flatMap(type =>
  FACINGS.flatMap(dir => [`${type}_${dir}`, `${type}_gather_${dir}`])
);
// Every sprite the systems may draw. Each gets two frames, in two columns of
// the sheet, so what was drawn can be read back from the cell it was cut from.
const spriteNames = [
  "shadow",
  "shadow_small",
  structure.type,
  otherStructure.type,
  ...FACINGS.map(dir => conveyorSpriteName(dir)),
  ...entitySprites,
  ...itemIds.map(id => `item_${id}`),
];
const FRAMES = 2;

const atlas = atlasOf(
  Object.fromEntries(
    spriteNames.map((name, i) => [
      name,
      spriteOf({
        mode:
          name === structure.type || name === otherStructure.type
            ? "variants"
            : "frames",
        cells: Array.from({ length: FRAMES }, (_, frame) => [
          i * FRAMES + frame,
          0,
        ]),
        frames: Array.from({ length: FRAMES }, () => ({}) as ImageBitmap),
        frameSec: 1,
        // Structures are two tiles tall, like trees.
        ...(name === structure.type || name === otherStructure.type
          ? { ground: 2 * TILE_SIZE, rows: 2 }
          : {}),
        ...(name === conveyorSpriteName(facing) ? { raise: RAISE } : {}),
      }),
    ])
  )
);

/** What each drawn cell was: its sprite's name, and which of its frames. */
const drawn = (context: FakeContext["context"]) =>
  drawnColumns(context).map(column => ({
    name: spriteNames[Math.floor(column / FRAMES)],
    frame: column % FRAMES,
  }));
const drawnNames = (context: FakeContext["context"]) =>
  drawn(context).map(({ name }) => name);

const structureAt = (
  world: World,
  x: number,
  y: number,
  data: StructureData = structure
) => {
  world.structures.addStructureAt(x, y, data);
  const [regionId, subRegionId] = worldPosToRegionIds(x, y);
  const worldPos =
    world.structures.optGetStructure(regionId, subRegionId)?.worldPos ??
    raise(new Error("Structure was not added"));
  return { regionId, subRegionId, pos: Vector.create(...worldPos) };
};

const beltData = { facing, length: REGION_SIDE_LENGTH } as const;

describe("renderAboveGround", () => {
  beforeEach(() => {
    vi.mocked(getAtlas).mockReset();
    vi.mocked(getAtlas).mockReturnValue(atlas);
  });

  afterEach(() => {
    // The system remembers which way each entity faced, so show it an empty
    // world to make it forget.
    renderAboveGround(createSystemArgs());
  });

  /** Runs the system on `world`, with the camera centred on `centre`. */
  const run = (
    world: World,
    centre: Vector<2>,
    {
      click,
      ...overrides
    }: Partial<SystemArgs> & { click?: [number, number] } = {}
  ) => {
    const fake = createFakeContext();
    const args = createSystemArgs({
      world,
      ctx: fake.ctx,
      camera: { center: centre.copy(), zoom: ZOOM },
      ...overrides,
    });
    if (click != null) {
      args.canvas.dispatchEvent(
        new MouseEvent("mousedown", { clientX: click[0], clientY: click[1] })
      );
    }
    renderAboveGround(args);
    return { ...fake, args };
  };

  const here = Vector.create(5, 5);
  // The middle of the canvas: where whatever the camera is centred on stands.
  const [middleX, middleY] = [50, 25];

  it("draws nothing until the atlas has loaded", () => {
    vi.mocked(getAtlas).mockReturnValue(undefined);
    const world = new World();
    createPlayer(world, here.copy());

    const { context, painted, args } = run(world, here, { click: [50, 25] });

    expect(context.drawImage).not.toHaveBeenCalled();
    expect(painted).toEqual([]);
    expect(args.clickDetails.value).toBeNull();
  });

  describe("structures", () => {
    it("stands a structure on its shadow, with its ground line on its position", () => {
      const world = new World();
      const { pos } = structureAt(world, 30, 40);

      const { context } = run(world, pos);

      expect(drawnNames(context)).toEqual(["shadow_small", structure.type]);
      // Its position is the middle of the canvas, and its ground line (the
      // bottom of its two tiles) rests there.
      expect(context.drawImage.mock.calls[1]?.slice(5)).toEqual([
        middleX - PX_PER_TILE / 2,
        middleY - 2 * PX_PER_TILE,
        PX_PER_TILE,
        2 * PX_PER_TILE,
      ]);
    });

    it("does not smooth art drawn at its own size", () => {
      const world = new World();
      const { pos } = structureAt(world, 30, 40);

      const { context } = run(world, pos);

      expect(context.imageSmoothingEnabled).toBe(false);
    });

    it("smooths art that is shrunk", () => {
      const world = new World();
      const { pos } = structureAt(world, 30, 40);

      const { context } = run(world, pos, {
        camera: { center: pos.copy(), zoom: ZOOM - 1 },
      });

      expect(context.imageSmoothingEnabled).toBe(true);
    });

    it("gives each structure the look its tile picks", () => {
      for (const [x, y] of [
        [30, 40],
        [7, 9],
        [100, 3],
      ]) {
        const world = new World();
        const { pos } = structureAt(world, x ?? 0, y ?? 0);

        const { context } = run(world, pos);

        const [, sprite] = drawn(context);
        expect(sprite?.frame).toBe(
          variantIndex(Math.floor(pos.x()), Math.floor(pos.y()), FRAMES)
        );
      }
    });

    it("lays a belt flat, with no shadow", () => {
      const world = new World();
      const { pos } = structureAt(world, 30, 40, {
        type: "conveyor",
        data: beltData,
      });

      const { context, painted } = run(world, pos);

      expect(context.drawImage).not.toHaveBeenCalled();
      expect(painted).toHaveLength(1);
      expect(painted[0]?.style).toBeInstanceOf(FakePattern);
    });

    it("draws what is further up the screen first", () => {
      const world = new World();
      // Added front first, so only the sorting can put the back one first.
      const front = structureAt(world, 30, 41, otherStructure);
      structureAt(world, 30, 40);

      const { context } = run(world, front.pos);

      expect(drawnNames(context)).toEqual([
        "shadow_small",
        structure.type,
        "shadow_small",
        otherStructure.type,
      ]);
    });

    it("draws a belt before what stands on it", () => {
      const world = new World();
      const { pos } = structureAt(world, 30, 40, {
        type: "conveyor",
        data: beltData,
      });
      createRobot(world, pos.copy());

      const { context } = run(world, pos);

      const [beltOrder] = context.fillRect.mock.invocationCallOrder;
      const [robotOrder] = context.drawImage.mock.invocationCallOrder;
      expect(beltOrder).toBeLessThan(robotOrder ?? 0);
    });
  });

  describe("players and robots", () => {
    it.each(["player", "robot"] as const)(
      "stands a %s facing down when it has not moved",
      type => {
        const world = new World();
        (type === "player" ? createPlayer : createRobot)(world, here.copy());

        const { context } = run(world, here);

        const [shadow, sprite] = drawn(context);
        expect(shadow).toEqual({ name: "shadow", frame: 0 });
        expect(sprite).toEqual({ name: `${type}_down`, frame: 0 });
      }
    );

    it.each(FACINGS)("faces %s when walking that way, animated", dir => {
      const world = new World();
      const id = createPlayer(world, here.copy());
      world.entities.add(
        id,
        "destination",
        here.copy().add(facingDirOf[dir].copy().multiply(3))
      );

      const { context } = run(world, here);

      expect(drawn(context)[1]).toEqual({ name: `player_${dir}`, frame: 1 });
    });

    it("keeps the way it faced once it stops", () => {
      const world = new World();
      const id = createPlayer(world, here.copy());
      world.entities.add(id, "destination", here.copy().add([3, 0]));
      run(world, here);

      world.entities.delete(id, "destination");
      const { context } = run(world, here);

      expect(drawn(context)[1]).toEqual({ name: "player_right", frame: 0 });
    });

    it("keeps its facing while walking to where it already is", () => {
      const world = new World();
      const id = createPlayer(world, here.copy());
      world.entities.add(id, "destination", here.copy().add([3, 0]));
      run(world, here);

      world.entities.add(id, "destination", here.copy());
      const { context } = run(world, here);

      expect(drawn(context)[1]).toEqual({ name: "player_right", frame: 1 });
    });

    it("forgets the facing of an entity that is gone", () => {
      const world = new World();
      const id = createPlayer(world, here.copy());
      world.entities.add(id, "destination", here.copy().add([3, 0]));
      run(world, here);
      // Nothing is left to remember it by.
      run(new World(), here);

      // A new entity may reuse the id.
      const later = new World();
      createPlayer(later, here.copy());
      const { context } = run(later, here);

      expect(drawn(context)[1]).toEqual({ name: "player_down", frame: 0 });
      expect(id).toBe(0);
    });

    describe("gathering", () => {
      const target = here.copy();
      const [regionId, subRegionId] = worldPosToRegionIds(30, 40);
      const spriteOfTask = (task: Task | undefined) => {
        const world = new World();
        const id = createRobot(world, here.copy(), task ? [task] : []);

        const { context } = run(world, here);
        return { name: drawn(context)[1], id };
      };

      it("swings its tool while gathering a tile", () => {
        const { name } = spriteOfTask({
          type: "gatherTile",
          target: target.copy(),
          endsAt: 1,
        });

        expect(name).toEqual({ name: "robot_gather_down", frame: 1 });
      });

      it("swings its tool while gathering a structure", () => {
        const { name } = spriteOfTask({
          type: "gatherStructure",
          regionId,
          subRegionId,
          endsAt: 1,
        });

        expect(name).toEqual({ name: "robot_gather_down", frame: 1 });
      });

      it("does not swing before the gather has started", () => {
        const { name } = spriteOfTask({
          type: "gatherTile",
          target: target.copy(),
          endsAt: undefined,
        });

        expect(name).toEqual({ name: "robot_down", frame: 0 });
      });

      it("does not swing while doing anything else", () => {
        const { name } = spriteOfTask({
          type: "dropInventory",
          target: target.copy(),
        });

        expect(name).toEqual({ name: "robot_down", frame: 0 });
      });

      it("does not swing with no task", () => {
        expect(spriteOfTask(undefined).name).toEqual({
          name: "robot_down",
          frame: 0,
        });
      });

      it("does not swing without a task list", () => {
        const world = new World();
        const id = createRobot(world, here.copy());
        world.entities.delete(id, "taskList");

        const { context } = run(world, here);

        expect(drawn(context)[1]).toEqual({ name: "robot_down", frame: 0 });
      });
    });

    it("draws what is further up the screen first", () => {
      const world = new World();
      createPlayer(world, here.copy().add([0, 2]));
      createRobot(world, here.copy());

      const { context } = run(world, here);

      expect(drawnNames(context)).toEqual([
        "shadow",
        "robot_down",
        "shadow",
        "player_down",
      ]);
    });

    it("throws for an entity type it does not know", () => {
      const world = new World();
      const id = createRobot(world, here.copy());
      // @ts-expect-error the type is not one of the game's entity types
      world.entities.add(id, "type", "unknown");

      expect(() => run(world, here)).toThrow("Value not exhausted");
    });
  });

  describe("dropped items", () => {
    const item = { id: itemId, count: 1, data: true } as const;
    const size = ITEM_TILES * PX_PER_TILE;

    it("draws what the item holds, small, on its own shadow", () => {
      const world = new World();
      createItem(world, item, here.copy());

      const { context } = run(world, here);

      expect(drawnNames(context)).toEqual(["shadow_small", `item_${itemId}`]);
      expect(context.drawImage.mock.calls[1]?.slice(5)).toEqual([
        middleX - size / 2,
        middleY - size,
        size,
        size,
      ]);
    });

    it("draws nothing for an item that holds nothing", () => {
      const world = new World();
      const id = createItem(world, item, here.copy());
      world.entities.add(id, "inventory", {});

      const { context } = run(world, here);

      expect(context.drawImage).not.toHaveBeenCalled();
    });

    it("draws nothing for an item with no inventory", () => {
      const world = new World();
      const id = createItem(world, item, here.copy());
      world.entities.delete(id, "inventory");

      const { context } = run(world, here);

      expect(context.drawImage).not.toHaveBeenCalled();
    });

    describe("on a belt", () => {
      const itemY = (belt: Parameters<typeof structureAt>[3] | undefined) => {
        const world = new World();
        const { pos } = structureAt(world, 30, 40, belt ?? structure);
        createItem(world, item, pos.copy());

        const { context } = run(world, pos);

        const call = context.drawImage.mock.calls.at(-1);
        return call?.[6];
      };

      it("rides above the ground by the height of the belt", () => {
        const onGround = itemY(undefined);
        const onBelt = itemY({ type: "conveyor", data: beltData });

        expect(onBelt).toBe((onGround ?? 0) - RAISE);
      });

      it("stays on the ground when the belt's sprite does not lift", () => {
        const flat = FACINGS.find(dir => dir !== facing) ?? facing;

        expect(
          itemY({ type: "conveyor", data: { ...beltData, facing: flat } })
        ).toBe(itemY(undefined));
      });
    });
  });

  describe("clicking", () => {
    const clickAt = (
      world: World,
      centre: Vector<2>,
      click: [x: number, y: number]
    ) => run(world, centre, { click }).args.clickDetails.value;

    it("leaves the click details alone when nothing was clicked", () => {
      const world = new World();
      const { pos } = structureAt(world, 30, 40);

      const { args } = run(world, pos);

      expect(args.clickDetails.value).toBeNull();
    });

    it("targets the structure clicked, and says where in the world", () => {
      const world = new World();
      const { pos, regionId, subRegionId } = structureAt(world, 30, 40);

      // The middle of the sprite, a tile above the ground line.
      const details = clickAt(world, pos, [middleX, middleY - PX_PER_TILE]);

      expect(details?.target).toEqual({
        domain: "structure",
        type: structure.type,
        regionId,
        subRegionId,
      });
      expect(details?.worldPos.toArray()).toEqual([pos.x(), pos.y() - 1]);
    });

    it("targets nothing when the click is off every sprite, but still says where", () => {
      const world = new World();
      const { pos } = structureAt(world, 30, 40);

      const details = clickAt(world, pos, [1, 1]);

      expect(details?.target).toBeNull();
      expect(details?.worldPos.toArray()).toEqual([
        pos.x() + (1 - middleX) / PX_PER_TILE,
        pos.y() + (1 - middleY) / PX_PER_TILE,
      ]);
    });

    it("targets the sprite whose middle is nearest where overlapping sprites are clicked", () => {
      const world = new World();
      const back = structureAt(world, 30, 40);
      const front = structureAt(world, 30, 41, otherStructure);
      // The back one's middle is a tile higher than the front one's, and the
      // sprites overlap between the two.
      const backMiddle = middleY - PX_PER_TILE;
      const frontMiddle = middleY;

      const nearBack = clickAt(world, back.pos, [
        middleX,
        backMiddle + PX_PER_TILE / 4,
      ]);
      const nearFront = clickAt(world, back.pos, [
        middleX,
        frontMiddle - PX_PER_TILE / 4,
      ]);

      expect(nearBack?.target).toMatchObject({
        domain: "structure",
        subRegionId: back.subRegionId,
      });
      expect(nearFront?.target).toMatchObject({
        domain: "structure",
        subRegionId: front.subRegionId,
      });
    });

    it("targets the robot or player clicked", () => {
      const world = new World();
      const id: EntityId = createRobot(world, here.copy());

      const details = clickAt(world, here, [middleX, middleY - 1]);

      expect(details?.target).toEqual({ domain: "entity", type: "robot", id });
    });

    it("targets a dropped item clicked", () => {
      const world = new World();
      const id = createItem(
        world,
        { id: itemId, count: 1, data: true },
        here.copy()
      );

      const details = clickAt(world, here, [middleX, middleY - 1]);

      expect(details?.target).toEqual({ domain: "entity", type: "item", id });
    });
  });
});
