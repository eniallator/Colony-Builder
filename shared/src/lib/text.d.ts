// `shared` is built with neither DOM nor Node types, but both runtimes provide these.
// Only the part of the API that the protocol uses is declared.

declare class TextEncoder {
  encode(input: string): Uint8Array<ArrayBuffer>;
}

declare class TextDecoder {
  constructor(label: string, options: { fatal: boolean });
  decode(input: Uint8Array): string;
}
