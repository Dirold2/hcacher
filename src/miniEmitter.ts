export class MiniEmitter<Events extends Record<string, any[]>> {
  private readonly listeners = new Map<keyof Events, Function[]>();

  on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener);
    return this;
  }

  off<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    const list = this.listeners.get(event);
    if (list) {
      const index = list.indexOf(listener);
      if (index !== -1) list.splice(index, 1);
    }
    return this;
  }

  protected emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const targets = [...list];
    for (const listener of targets) {
      listener(...args);
    }
  }
}
