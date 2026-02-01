import { describe, it, expect } from 'vitest'

/**
 * This test demonstrates a bug in the version pairing logic.
 *
 * The problematic pattern in monocrate.ts:
 * 1. Compute versions for each assembler: [v1, undefined, v3]
 * 2. Use flatMap to filter out undefined: [v1, v3]
 * 3. Pair by index: assemblers[i] gets individualVersions[i]
 *
 * The bug: After flatMap, indices no longer correspond!
 * - assemblers[0] gets individualVersions[0] = v1 ✓
 * - assemblers[1] gets individualVersions[1] = v3 ✗ (should have no version!)
 * - assemblers[2] gets individualVersions[2] = undefined ✗ (should be v3!)
 */
describe('version pairing bug', () => {
  it('demonstrates the index mismatch bug when using flatMap then pairing by index', () => {
    // Simulate 3 assemblers
    const assemblers = ['pkg-a', 'pkg-b', 'pkg-c']

    // Simulate computeNewVersion results - pkg-b returns undefined
    const computedVersions: (string | undefined)[] = ['1.0.0', undefined, '3.0.0']

    // Current buggy pattern: flatMap filters out undefined
    const individualVersions = computedVersions.flatMap((v) => (v ? [v] : []))

    // This is the bug: individualVersions has length 2, but assemblers has length 3
    expect(individualVersions).toEqual(['1.0.0', '3.0.0'])
    expect(individualVersions.length).not.toBe(assemblers.length)

    // When pairing by index, pkg-b incorrectly gets pkg-c's version
    const pairedByIndex = assemblers.map((name, i) => ({
      name,
      version: individualVersions[i], // BUG: wrong index after flatMap!
    }))

    // pkg-a correctly gets 1.0.0
    expect(pairedByIndex[0]).toEqual({ name: 'pkg-a', version: '1.0.0' })

    // BUG: pkg-b should have no version, but gets 3.0.0 (pkg-c's version!)
    expect(pairedByIndex[1]).toEqual({ name: 'pkg-b', version: '3.0.0' })

    // BUG: pkg-c should have 3.0.0, but gets undefined!
    expect(pairedByIndex[2]).toEqual({ name: 'pkg-c', version: undefined })
  })

  it('shows the correct approach: pair before filtering', () => {
    const assemblers = ['pkg-a', 'pkg-b', 'pkg-c']
    const computedVersions: (string | undefined)[] = ['1.0.0', undefined, '3.0.0']

    // Correct approach: pair assemblers with their versions first
    const paired = assemblers.map((name, i) => ({
      name,
      computedVersion: computedVersions[i],
    }))

    // Now each assembler is correctly paired with its own computed version
    expect(paired[0]).toEqual({ name: 'pkg-a', computedVersion: '1.0.0' })
    expect(paired[1]).toEqual({ name: 'pkg-b', computedVersion: undefined })
    expect(paired[2]).toEqual({ name: 'pkg-c', computedVersion: '3.0.0' })

    // Can still extract versions for max calculation
    const versionsForMax = paired.flatMap(({ computedVersion }) => (computedVersion ? [computedVersion] : []))
    expect(versionsForMax).toEqual(['1.0.0', '3.0.0'])
  })
})
