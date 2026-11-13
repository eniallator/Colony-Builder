export interface ClientTransport {
  send: (bytes: Uint8Array<ArrayBuffer>) => void;
  onMessage: (listener: (bytes: Uint8Array) => void) => void;
}
