import { beforeEach, describe, expect, it } from 'vitest'
import {
  forgetGatheringId,
  loadKnownIds,
  rememberGatheringId,
} from './knownIds'

describe('known gathering ids', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('remembers newest first without duplicates', () => {
    rememberGatheringId('a')
    rememberGatheringId('b')
    rememberGatheringId('a')
    expect(loadKnownIds()).toEqual(['b', 'a'])
    forgetGatheringId('b')
    expect(loadKnownIds()).toEqual(['a'])
  })
})
