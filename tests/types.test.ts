import { describe, expect, it } from 'vitest';

import {
  LockFileMismatchError,
  VersionConflictError,
  WorkspaceDetectionError,
} from '../src/types.js';

describe('VersionConflictError', () => {
  it('should create error with package name and conflicts', () => {
    const error = new VersionConflictError('lodash', [
      { source: 'package-a', version: '^4.17.0' },
      { source: 'package-b', version: '^3.10.0' },
    ]);

    expect(error.name).toBe('VersionConflictError');
    expect(error.packageName).toBe('lodash');
    expect(error.conflicts).toHaveLength(2);
    expect(error.message).toContain('lodash');
    expect(error.message).toContain('package-a');
    expect(error.message).toContain('^4.17.0');
    expect(error.message).toContain('package-b');
    expect(error.message).toContain('^3.10.0');
  });

  it('should be an instance of Error', () => {
    const error = new VersionConflictError('test', []);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('WorkspaceDetectionError', () => {
  it('should create error with message', () => {
    const error = new WorkspaceDetectionError('No workspace found');

    expect(error.name).toBe('WorkspaceDetectionError');
    expect(error.message).toBe('No workspace found');
  });

  it('should be an instance of Error', () => {
    const error = new WorkspaceDetectionError('test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('LockFileMismatchError', () => {
  it('should create error with workspace type and lock file info', () => {
    const error = new LockFileMismatchError(
      'pnpm',
      'pnpm-lock.yaml',
      'package-lock.json'
    );

    expect(error.name).toBe('LockFileMismatchError');
    expect(error.detectedType).toBe('pnpm');
    expect(error.expectedLockFile).toBe('pnpm-lock.yaml');
    expect(error.foundLockFile).toBe('package-lock.json');
    expect(error.message).toContain('pnpm');
    expect(error.message).toContain('pnpm-lock.yaml');
    expect(error.message).toContain('package-lock.json');
  });

  it('should handle null found lock file', () => {
    const error = new LockFileMismatchError('pnpm', 'pnpm-lock.yaml', null);

    expect(error.foundLockFile).toBeNull();
    expect(error.message).toContain('none');
  });

  it('should be an instance of Error', () => {
    const error = new LockFileMismatchError('npm', 'package-lock.json', null);
    expect(error).toBeInstanceOf(Error);
  });
});
