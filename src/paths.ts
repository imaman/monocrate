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
  export function join(base: AbsolutePath, relative: PathInRepo): AbsolutePath {
    return AbsolutePath(path.join(base, relative))
  }

  export function dirname(p: AbsolutePath): AbsolutePath {
    return AbsolutePath(path.dirname(p))
  }
}

/**
 * Branded type for paths relative to the monorepo root.
 * Use PathInRepo(s) to create, PathInRepo.join() and PathInRepo.dirname() for manipulation.
 */
export type PathInRepo = string & { readonly __brand: 'PathInRepo' }

/**
 * Creates a PathInRepo from a string. Normalizes the input.
 * @throws if the path is absolute
 */
export function PathInRepo(s: string): PathInRepo {
  const normalized = path.normalize(s)
  if (path.isAbsolute(normalized)) {
    throw new Error(`Expected relative path, got: ${s}`)
  }
  return normalized as PathInRepo
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace PathInRepo {
  export function join(base: PathInRepo, relative: PathInRepo): PathInRepo {
    return PathInRepo(path.join(base, relative))
  }

  export function dirname(p: PathInRepo): PathInRepo {
    return PathInRepo(path.dirname(p))
  }
}
