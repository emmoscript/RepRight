/** Reused MoveNet input (192×192×3) — avoids allocating a new Uint8Array every inference. */
let buffer: Uint8Array | null = null;

export function reuseInferenceInput(source: Uint8Array): Uint8Array {
  if (!buffer || buffer.length !== source.length) {
    buffer = new Uint8Array(source.length);
  }
  buffer.set(source);
  return buffer;
}

export function clearInferenceInputBuffer(): void {
  buffer = null;
}
