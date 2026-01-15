# Monocrate Agent Architecture

This directory contains agent definitions for building and maintaining the Monocrate project.

## Agents

| Agent | File | Role |
|-------|------|------|
| Project Lead | [project-lead.md](./project-lead.md) | CEO / Team coordinator |
| Core Architect | [core-architect.md](./core-architect.md) | Bundling engine & API |
| CLI Developer | [cli-developer.md](./cli-developer.md) | Command-line interface |
| Quality Engineer | [quality-engineer.md](./quality-engineer.md) | Testing & CI/CD |
| Documentation Author | [documentation-author.md](./documentation-author.md) | User documentation |
| Brand Strategist | [brand-strategist.md](./brand-strategist.md) | Identity & messaging |
| Community Architect | [community-architect.md](./community-architect.md) | OSS infrastructure |
| Example Curator | [example-curator.md](./example-curator.md) | Examples & demos |
| Code Reviewer | [code-reviewer.md](./code-reviewer.md) | Quality guardian |

## How to Use

Each `.md` file contains the complete prompt/instructions for that agent. To invoke an agent:

1. Read the agent's markdown file
2. Use its instructions as context for the task at hand
3. The agent will follow its defined responsibilities and standards

## Team Structure

```
                         ┌─────────────────┐
                         │  project-lead   │
                         └────────┬────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│brand-strategist│        │quality-engineer│        │community-architect│
└───────────────┘        └───────┬───────┘        └───────────────┘
        │                        │                         │
        ▼                        ▼                         ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│documentation- │        │ code-reviewer │        │example-curator│
│    author     │        └───────────────┘        └───────────────┘
└───────────────┘                │
                                 ▼
                    ┌─────────────────────────┐
                    │     core-architect      │
                    │     cli-developer       │
                    └─────────────────────────┘
```

## Workflow Phases

| Phase | Description | Key Agents |
|-------|-------------|------------|
| 0. Init | Charter, roadmap | project-lead |
| 1. Foundation | Identity, repo setup, architecture | brand-strategist, quality-engineer, core-architect |
| 2. Implementation | Core code, CLI | core-architect, cli-developer, code-reviewer |
| 3. Documentation | Docs, examples | documentation-author, example-curator |
| 4. Pre-Release | Validation | quality-engineer, code-reviewer, project-lead |
| 5. Launch | Publish, announce | project-lead, community-architect |
| 6. Ongoing | Maintenance | All agents |

## Quality Standards

All agents adhere to these principles:

1. User experience over implementation convenience
2. Correctness over speed
3. Consistency over local optimization
4. Documentation accuracy over comprehensiveness
5. Community trust over feature velocity
