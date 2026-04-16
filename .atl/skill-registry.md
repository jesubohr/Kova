# Skill Registry — kova

Generated: 2026-04-15

## Project Context

- **Stack**: TypeScript monorepo (pnpm + Turborepo)
- **Packages**: web (Next.js 15), facilitator (Fastify), sdk-client, sdk-server
- **DB**: PostgreSQL via Drizzle ORM
- **Auth**: Better Auth
- **Blockchain**: Stellar SDK (x402 paywalls, USDC)
- **Testing**: Vitest (facilitator, sdk-client, sdk-server); no tests in web
- **Linting**: ESLint 9 (web), tsc --noEmit (facilitator, sdk-client, sdk-server)
- **Formatting**: Prettier

## User Skills

| Skill | Triggers (code context) | Triggers (task context) |
|-------|------------------------|------------------------|
| ui-skills | `*.tsx`, `*.css`, UI components | UI work, component design |
| react-doctor | `*.tsx`, `*.jsx`, React components | After React changes, feature completion |
| branch-pr | — | Creating PRs, preparing branches |
| issue-creation | — | Creating GitHub issues, bug reports |
| judgment-day | — | Adversarial review, dual review |
| skill-creator | — | Creating new skills |
| skill-builder | — | Building skills |

## Project Conventions

| Source | Path | Scope |
|--------|------|-------|
| CLAUDE.md (project) | `./CLAUDE.md` | Project-wide rules, DDD, TDD London, architecture |
| CLAUDE.md (user) | `~/.claude/CLAUDE.md` | Global user preferences |

## Compact Rules

### ui-skills
```
- Apply opinionated UI constraints to all interface work
- Review files against constraints: violations, why it matters, concrete fix
- Trigger: any .tsx/.css UI component work
```

### react-doctor
```
- Run `npx -y react-doctor@latest . --verbose --diff` after React changes
- Checks security, performance, correctness, architecture (0-100 score)
- Fix errors first, re-run to verify improvement
- Trigger: after modifying React components
```

### branch-pr
```
- Issue-first enforcement: every PR must link to a GitHub issue
- Follow ATL PR creation workflow
- Trigger: creating any pull request
```

### issue-creation
```
- Issue-first enforcement system
- Use when creating GitHub issues (bugs or features)
- Follow ATL issue template
- Trigger: creating GitHub issues
```

### judgment-day
```
- Parallel adversarial review: two blind judge sub-agents review independently
- Synthesize findings, apply fixes, re-judge (max 2 iterations)
- Trigger: "judgment day", after significant implementations
```

### better-auth-best-practices
```
- Configure Better Auth server and client correctly
- Trigger: when working with auth setup, sessions, or user management in this project
```
