type EventListener<Args extends readonly unknown[]> = (...args: Args) => void;

export class MiniEmitter<Events extends { [K in keyof Events]: readonly unknown[] }> {
  private readonly listeners = new Map<keyof Events, EventListener<Events[keyof Events]>[]>();

  on<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): this {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener as EventListener<Events[keyof Events]>);
    return this;
  }

  off<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): this {
    const list = this.listeners.get(event);
    if (list) {
      const index = list.indexOf(listener as EventListener<Events[keyof Events]>);
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
