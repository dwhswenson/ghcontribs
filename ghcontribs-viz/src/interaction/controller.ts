import type { VisualizationSnapshot } from '../model/model.ts'
import { renderInteraction } from '../render/ecosystem.ts'
import {
  InteractionState,
  type InteractionTarget,
} from './state.ts'

function targetFromElement(
  root: HTMLElement,
  element: Element | null,
): InteractionTarget | null {
  if (element === null || !root.contains(element)) return null
  const interactive = element.closest<HTMLElement>('[data-interaction-kind]')
  if (interactive !== null && root.contains(interactive)) {
    if (interactive.dataset.interactionKind === 'owner') {
      return { kind: 'owner', owner: interactive.dataset.owner! }
    }
    if (interactive.dataset.interactionKind === 'repository') {
      return {
        kind: 'repository',
        owner: interactive.dataset.owner!,
        key: interactive.dataset.repositoryKey!,
      }
    }
  }
  const owner = element.closest<HTMLElement>('.ghc-owner')
  return owner === null || !root.contains(owner)
    ? null
    : { kind: 'owner', owner: owner.dataset.owner! }
}

function targetForInteractiveElement(element: HTMLElement): InteractionTarget {
  if (element.dataset.interactionKind === 'owner') {
    return { kind: 'owner', owner: element.dataset.owner! }
  }
  return {
    kind: 'repository',
    owner: element.dataset.owner!,
    key: element.dataset.repositoryKey!,
  }
}

export class InteractionController {
  readonly #target: HTMLElement
  readonly #state = new InteractionState()
  readonly #onFocusedOwnerChange: () => void
  #snapshot: VisualizationSnapshot | null = null
  #restoreOwner: string | null = null
  #destroyed = false

  constructor(target: HTMLElement, onFocusedOwnerChange: () => void) {
    this.#target = target
    this.#onFocusedOwnerChange = onFocusedOwnerChange
    target.addEventListener('pointerover', this.#handlePointerOver)
    target.addEventListener('pointerout', this.#handlePointerOut)
    target.addEventListener('focusin', this.#handleFocusIn)
    target.addEventListener('focusout', this.#handleFocusOut)
    target.addEventListener('keydown', this.#handleKeyDown)
    target.addEventListener('click', this.#handleClick)
  }

  get focusedOwner(): string | null {
    return this.#state.getSnapshot().focusedOwner
  }

  update(snapshot: VisualizationSnapshot): void {
    if (this.#destroyed) return
    this.#snapshot = snapshot
    const focusedOwner = this.focusedOwner
    if (
      focusedOwner !== null &&
      !snapshot.owners.some((owner) => owner.owner === focusedOwner)
    ) {
      this.#state.setFocusedOwner(null)
      this.#onFocusedOwnerChange()
      return
    }
    this.#renderInteraction()
  }

  focusOwner(owner: string | null, restoreOnExit = false): void {
    if (this.#destroyed) return
    if (
      owner !== null &&
      this.#snapshot !== null &&
      !this.#snapshot.owners.some((candidate) => candidate.owner === owner)
    ) return

    if (owner !== null && restoreOnExit) this.#restoreOwner = owner
    const previous = this.focusedOwner
    this.#state.setFocusedOwner(owner)
    this.#state.setHovered(null)
    if (previous !== owner) this.#onFocusedOwnerChange()
    else this.#renderInteraction()

    if (owner === null && restoreOnExit && this.#restoreOwner !== null) {
      const ownerToRestore = this.#restoreOwner
      this.#restoreOwner = null
      Array.from(
        this.#target.querySelectorAll<HTMLElement>('.ghc-owner__focus'),
      ).find((element) => element.dataset.owner === ownerToRestore)?.focus()
    }
  }

  destroy(): void {
    if (this.#destroyed) return
    this.#destroyed = true
    this.#target.removeEventListener('pointerover', this.#handlePointerOver)
    this.#target.removeEventListener('pointerout', this.#handlePointerOut)
    this.#target.removeEventListener('focusin', this.#handleFocusIn)
    this.#target.removeEventListener('focusout', this.#handleFocusOut)
    this.#target.removeEventListener('keydown', this.#handleKeyDown)
    this.#target.removeEventListener('click', this.#handleClick)
    this.#state.resetTransientTargets()
    this.#snapshot = null
  }

  #renderInteraction(): void {
    if (this.#snapshot !== null) {
      renderInteraction(this.#target, this.#snapshot, this.#state.getSnapshot())
    }
  }

  #handlePointerOver = (event: PointerEvent): void => {
    const target = targetFromElement(this.#target, event.target as Element | null)
    if (target === null) return
    this.#state.setHovered(target)
    this.#renderInteraction()
  }

  #handlePointerOut = (event: PointerEvent): void => {
    const target = targetFromElement(this.#target, event.relatedTarget as Element | null)
    this.#state.setHovered(target)
    this.#renderInteraction()
  }

  #handleFocusIn = (event: FocusEvent): void => {
    const element = (event.target as Element | null)?.closest<HTMLElement>(
      '[data-interaction-kind]',
    )
    if (element === undefined || element === null || !this.#target.contains(element)) return
    const target = targetForInteractiveElement(element)
    this.#state.setKeyboardFocused(target)
    this.#renderInteraction()
  }

  #handleFocusOut = (event: FocusEvent): void => {
    if (targetFromElement(this.#target, event.relatedTarget as Element | null) !== null) return
    this.#state.setKeyboardFocused(null)
    this.#renderInteraction()
  }

  #handleClick = (event: MouseEvent): void => {
    const element = event.target as Element | null
    if (element?.closest('[data-action="overview"]') !== null) {
      this.focusOwner(null, true)
      return
    }
    const target = targetFromElement(this.#target, element)
    if (target !== null) this.focusOwner(target.owner, true)
  }

  #handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (this.focusedOwner === null) return
      event.preventDefault()
      this.focusOwner(null, true)
      return
    }
    const current = (event.target as Element | null)?.closest<HTMLElement>(
      '[data-interaction-kind]',
    )
    if (current === undefined || current === null) return
    const currentTarget = targetForInteractiveElement(current)
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      this.focusOwner(currentTarget.owner, true)
      return
    }
  }
}
