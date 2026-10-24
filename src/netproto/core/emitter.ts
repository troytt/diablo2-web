/**
 * Minimal strongly-typed event emitter with zero Node or DOM dependencies.
 */

export class TypedEmitter<T> {
  private readonly listeners = new Set<(event: T) => void>()

  on(listener: (event: T) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(event: T): void {
    for (const listener of [...this.listeners]) {
      listener(event)
    }
  }

  clear(): void {
    this.listeners.clear()
  }

  get size(): number {
    return this.listeners.size
  }
}

export { TypedEmitter as Emitter }
