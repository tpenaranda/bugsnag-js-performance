export abstract class Settler {
  protected settled: boolean = false

  private readonly callbacks: Array<() => void> = []

  subscribe (callback: () => void): void {
    this.callbacks.push(callback)

    // if we're already settled, call the callback immediately
    if (this.settled) {
      callback()
    }
  }

  protected settle (): void {
    this.settled = true

    for (const callback of this.callbacks) {
      callback()
    }
  }
}
