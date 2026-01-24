import path from 'node:path'

/**
 * Branded type for absolute file system paths.
 * Use AbsolutePath(s) to create, AbsolutePath.join() and AbsolutePath.dirname() for manipulation.
 */
export type AbsolutePath = string & { readonly __brand: 'AbsolutePath' }

/**
 * Creates an AbsolutePath from a string. Normalizes the input.
 * @throws if the path is not absolute
 */
export function AbsolutePath(s: string): AbsolutePath {
  const normalized = path.normalize(s)
  if (!path.isAbsolute(normalized)) {
    throw new Error(`Expected absolute path, got: ${s}`)
  }
  return normalized as AbsolutePath
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AbsolutePath {
  export function join(base: AbsolutePath, p: RelativePath, ...paths: string[]): AbsolutePath {
    return AbsolutePath(path.join(base, RelativePath.join(p, ...paths)))
  }

  export function dirname(p: AbsolutePath): AbsolutePath {
    return AbsolutePath(path.dirname(p))
  }

  /**
   * Checks if `child` is under (or equal to) `parent`.
   */
  export function isUnder(child: AbsolutePath, parent: AbsolutePath): boolean {
    const relative = path.relative(parent, child)
    return !relative.startsWith('..') && !path.isAbsolute(relative)
  }
}

/**
 * Branded type for paths relative to the monorepo root.
 * Use RelativePath(s) to create, RelativePath.join() and RelativePath.dirname() for manipulation.
 */
export type RelativePath = string & { readonly __brand: 'RelativePath' }

/**
 * Creates a RelativePath from a string. Normalizes the input.
 * @throws if the path is absolute
 */
export function RelativePath(s: string): RelativePath {
  const normalized = path.normalize(s)
  if (path.isAbsolute(normalized)) {
    throw new Error(`Expected relative path, got: ${s}`)
  }
  return normalized as RelativePath
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace RelativePath {
  export function join(base: RelativePath, ...paths: string[]): RelativePath {
    for (const at of paths) {
      if (path.isAbsolute(at)) {
        throw new Error(`Cannot join absolute path ${at} to RelativePath`)
      }
    }
    return RelativePath(path.join(base, ...paths))
  }

  export function dirname(p: RelativePath): RelativePath {
    return RelativePath(path.dirname(p))
  }
}
