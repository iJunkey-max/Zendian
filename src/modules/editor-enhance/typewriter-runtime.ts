export interface TypewriterRuntimeClient {
  onTypewriterRuntimeChanged(): void;
}

export class TypewriterRuntimeStore {
  private active = false;
  private clients = new Set<TypewriterRuntimeClient>();

  isActive(): boolean {
    return this.active;
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.refresh();
  }

  register(client: TypewriterRuntimeClient): () => void {
    this.clients.add(client);
    return () => this.clients.delete(client);
  }

  refresh(): void {
    for (const client of this.clients) client.onTypewriterRuntimeChanged();
  }
}
