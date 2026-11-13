// `shared` is built with neither DOM nor Node types, but both runtimes provide these.
// Only the part of the API that the protocol uses is declared. They are scoped
// to this module so they never clash with the `dom` or Node typings.

declare class TextEncoder {
  encode(input: string): Uint8Array<ArrayBuffer>;
}

declare class TextDecoder {
  constructor(label: string, options: { fatal: boolean });
  decode(input: Uint8Array): string;
}

export const createTextEncoder = (
  ...args: ConstructorParameters<typeof TextEncoder>
) => new TextEncoder(...args);

export const createTextDecoder = (
  ...args: ConstructorParameters<typeof TextDecoder>
) => new TextDecoder(...args);
