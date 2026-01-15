# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Monocrate project.

## What is an ADR?

An ADR captures an important architectural decision along with its context and consequences. ADRs help us:
- Document why decisions were made
- Onboard new team members
- Revisit decisions with full context

## ADR Index

| ID | Title | Status |
|----|-------|--------|
| [0001](./0001-typescript-first.md) | TypeScript-First Implementation | Accepted |
| [0002](./0002-vitest-testing.md) | Vitest for Testing | Accepted |
| [0003](./0003-commander-cli.md) | Commander for CLI Framework | Accepted |
| [0004](./0004-workspace-detection.md) | Workspace Detection Strategy | Proposed |
| [0005](./0005-version-conflict-handling.md) | Dependency Version Conflict Handling | Proposed |

## ADR Status

- **Proposed**: Under discussion, not yet decided
- **Accepted**: Decision made, implementation expected
- **Deprecated**: No longer valid, superseded by another ADR
- **Superseded**: Replaced by a newer ADR (link to replacement)

## Creating a New ADR

Use this template:

```markdown
# ADR XXXX: Title

## Status

Proposed | Accepted | Deprecated | Superseded by [YYYY](./YYYY-title.md)

## Context

What is the issue that we're seeing that is motivating this decision?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult to do because of this change?
```

## Naming Convention

`XXXX-short-title.md` where XXXX is a 4-digit number.
