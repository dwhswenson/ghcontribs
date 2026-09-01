import { describe, expect, it } from 'vitest'

import { InteractionState } from '../src/interaction/state.ts'

describe('InteractionState', () => {
  it('prioritizes hover, then keyboard focus, then semantic owner focus', () => {
    const state = new InteractionState()
    state.setFocusedOwner('ExampleOrg')
    expect(state.getSnapshot().active).toEqual({ kind: 'owner', owner: 'ExampleOrg' })

    state.setKeyboardFocused({
      kind: 'repository', owner: 'ExampleOrg', key: 'ExampleOrg/example',
    })
    expect(state.getSnapshot().active?.kind).toBe('repository')
    state.setHovered({ kind: 'owner', owner: 'AnotherOrg' })
    expect(state.getSnapshot().active).toEqual({ kind: 'owner', owner: 'AnotherOrg' })
    state.setHovered(null)
    expect(state.getSnapshot().active?.kind).toBe('repository')
    state.setKeyboardFocused(null)
    expect(state.getSnapshot().active).toEqual({ kind: 'owner', owner: 'ExampleOrg' })
  })

  it('clears transient targets without leaving semantic owner focus', () => {
    const state = new InteractionState()
    state.setFocusedOwner('ExampleOrg')
    state.setHovered({ kind: 'owner', owner: 'AnotherOrg' })
    state.setKeyboardFocused({ kind: 'owner', owner: 'ExampleOrg' })
    state.resetTransientTargets()
    expect(state.getSnapshot()).toMatchObject({
      hovered: null,
      keyboardFocused: null,
      focusedOwner: 'ExampleOrg',
      active: { kind: 'owner', owner: 'ExampleOrg' },
    })
  })
})
