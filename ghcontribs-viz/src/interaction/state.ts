export interface OwnerInteractionTarget {
  readonly kind: 'owner'
  readonly owner: string
}

export interface RepositoryInteractionTarget {
  readonly kind: 'repository'
  readonly owner: string
  readonly key: string
}

export type InteractionTarget = OwnerInteractionTarget | RepositoryInteractionTarget

export interface InteractionSnapshot {
  readonly hovered: InteractionTarget | null
  readonly keyboardFocused: InteractionTarget | null
  readonly focusedOwner: string | null
  readonly active: InteractionTarget | null
}

export class InteractionState {
  #hovered: InteractionTarget | null = null
  #keyboardFocused: InteractionTarget | null = null
  #focusedOwner: string | null = null

  setHovered(target: InteractionTarget | null): void {
    this.#hovered = target
  }

  setKeyboardFocused(target: InteractionTarget | null): void {
    this.#keyboardFocused = target
  }

  setFocusedOwner(owner: string | null): void {
    this.#focusedOwner = owner
  }

  resetTransientTargets(): void {
    this.#hovered = null
    this.#keyboardFocused = null
  }

  getSnapshot(): InteractionSnapshot {
    const active = this.#hovered ?? this.#keyboardFocused ?? (
      this.#focusedOwner === null
        ? null
        : { kind: 'owner' as const, owner: this.#focusedOwner }
    )
    return Object.freeze({
      hovered: this.#hovered,
      keyboardFocused: this.#keyboardFocused,
      focusedOwner: this.#focusedOwner,
      active,
    })
  }
}
