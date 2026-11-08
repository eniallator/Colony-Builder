// Cross-checks the game's content against the atlas, so adding a tile, item or
// entity type to the game without art is flagged immediately.
//
// Imports the game's own registries (Node strips the TypeScript types), so
// there is no second list to keep in sync.

const load = async relative => import(new URL(relative, import.meta.url).href);

/** Returns the sprite names the game needs, or throws if the registries can't load. */
const requiredSprites = async () => {
  const [{ tiles }, { itemDataRegistry }, { allEntityTypes }] =
    await Promise.all([
      load("../../shared/src/terrain/types.ts"),
      load("../../shared/src/item/registry.ts"),
      load("../../shared/src/entity/types.ts"),
    ]);
  return [
    ...tiles.map(tile => ({ kind: "tile", id: tile, sprite: tile })),
    ...Object.keys(itemDataRegistry).map(id => ({
      kind: "item",
      id,
      sprite: `item_${id}`,
    })),
    // "item" entities render the item's own icon, so they need no sprite.
    ...allEntityTypes
      .filter(type => type !== "item")
      .map(type => ({ kind: "entity", id: type, sprite: `${type}_down` })),
  ];
};

/** Returns `{ missing, error }`; `error` is set if the game registries failed to load. */
export const checkCoverage = async spriteNames => {
  const names = new Set(spriteNames);
  try {
    const required = await requiredSprites();
    return { missing: required.filter(r => !names.has(r.sprite)), error: null };
  } catch (error) {
    return { missing: [], error };
  }
};
