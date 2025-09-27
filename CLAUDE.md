# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack ecommerce application with a FastAPI backend implementing hexagonal architecture and a React TypeScript frontend. The project manages products, users, and orders with OAuth2 authentication.

### Tech Stack

- **Frontend**: NextJs, TypeScript, Vite, TailwindCSS, Radix UI, ShadcnUI, React Query, React Router y pnpm
- **Database**: Supabase
- **Architecture**: Feature-based architecture for frontend with screaming architecture principles;

## Common Commands

### Frontend

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture

The frontend is organized by features with each feature containing:

### Modules Structure (`modules/{module}`)

- **api**(`api/`): API services, mappers, models
  - **services**(`services/`): API calls for module (files: `*.service.ts`)
  - **mappers**(`mappers/`): Data transformation between API and app models (files: `*.mapper.ts`)
  - **models**(`models/`): API request/response models (files: `*.api.ts`)
- **business**(`business/`): Business logic, use cases, and services (files: `*.business.ts`)
- **pods**(`pods/`): Feature-specific components, hooks, and data
- **models**(`models/`): Shared data models and types (files: `*.model.ts`)
- **utils**(`utils/`): Utility functions and helpers (files: `*.utils.ts`)
- **constants**(`constants/`): Constant values and configurations (e.g., API endpoints, files: `*.constants.ts`)
- **views**(`views/`): Page components and routing

### Shared Module Structure (`modules/shared`)

**Shared**: Common code used across multiple modules (e.g., auth, core, ui components) with module structure similar to other modules.

### Feature Structure (`modules/{module}/pods/{feature}`)

- **[pod].container.tsx** : Server Component (data fetching)
- **[pod].component.tsx**: Client Component (UI interactions)
- **[pod].test.tsx**: Tests for the pod
- **services/**: API services specific to the feature
- **components** (`components/`): React components using feature context if is necessary
- **models** (`data/`): Schemas (Zod) and types (TypeScript) specific to the feature
- **hooks** (`hooks/`):
  - **context Hook** (`use{Feature}Context.hook.tsx`): Feature state management and operations using context
  - **business Hook** (`use{Feature}.hook.tsx`): Feature state management and operations

### Core Infrastructure (`core/`)

- **api** (`api/`): API client, app storage, query client setup
- **auth** (`auth/`): Authentication context and hooks
- **config** (`config/`): Environment configurations
- etc.

### Common Infrastructure (`common/`)

- **components** (`components/`): Shared UI components
- **hooks** (`hooks/`): Shared custom hooks
- **utils** (`utils/`): Shared utility functions

### UI Components (`components/ui/`)

- Radix UI-based reusable components with TailwindCSS styling

## Development Guidelines

### Frontend Conventions

- Each feature exports a context provider and custom hook
- Components import UI components from `@/components/ui/`
- Use `use{Feature}Context.hook` for accessing feature state and operations for context states
- Use `use{Feature}.hook` for accessing feature state and operations
- Services use axios for API communication
- Type safety with TypeScript and Zod schemas

### Shared Assets Priority & Promotion Rules

**MANDATORY: CHECK FIRST (in this exact order):**

1. **modules/shared/domain/** - Domain models (EconomicEvents, Countries)
2. **modules/shared/api/** - API services (economicEvents.api.ts)
3. **common/components/** - UI components
4. **common/hooks/** - Custom hooks
5. **common/utils/** - Utility functions

**PROMOTION THRESHOLDS (Apply these automatically):**

- Same code 3+ times → **IMMEDIATELY promote to common/**
- 90%+ similar code in 2+ locations → **Consider promotion**
- Business logic repeated → **move to common/utils/**
- UI pattern repeated → **move to common/components/**
- Hook pattern repeated → **move to common/hooks/**
- Type definitions repeated → **move to modules/shared/domain/**

### Testing

- Coverage requirement: 80%
- Use markers for test categorization: `unit`, `integration`, `auth`, `api`

### Clean Code Principles(ENFORCE THESE)

**MANDATORY PRINCIPLES:**

- **DRY (Don't Repeat Yourself)** - Single source of truth, eliminate ALL duplication
- **YAGNI (You Aren't Gonna Need It)** - Only implement what's explicitly needed NOW
- **KISS (Keep It Simple, Stupid)** - Simple, readable solutions over clever abstractions

## WORKFLOW RULES

### Phase 1

- At the starting point of a feature on plan mode phase you MUST ALWAYS init a `.claude/sessions/context_session_{feature_name}.md` with yor first analisis
- You MUST ask to the subagents that you considered that have to be involved about the implementation and check their opinions, try always to run them on parallel if is posible
- After a plan mode phase you ALWAYS update the `.claude/sessions/context_session_{feature_name}.md` with the definition of the plan and the recomentations of the subagents
- If some subagent has a question about the implementation you MUST answer them before start the implementation phase

### Phase 2

- Before you do any work, MUST view files in `.claude/sessions/context_session_{feature_name}.md` file to get the full context and call frontend-test-engineer subagent to create test cases for the feature in TDD mode.
- Before you do any work, MUST view files in `.claude/sessions/context_session_{feature_name}.md` file to get the full context (x being the id of the session we are operate)
- `.claude/sessions/context_session_{feature_name}.md` should contain most of context of what we did, overall plan, and sub agents will continusly add context to the file
- After you finish the each phase, MUST update the `.claude/sessions/context_session_{feature_name}.md` file to make sure others can get full context of what you did.
- During the implementation phase you MUST update the `.claude/sessions/context_session_{feature_name}.md` file with the progress of the implementation
- After you finish the work, MUST update the `.claude/sessions/context_session_{feature_name}.md` file to make sure others can get full context of what you did

### Phase 3

- After finish the final implementation MUST use qa-criteria-validator subagent to provide a report feedback an iterate over this feedback until acceptance criterias are passed
- After qa-criteria-validator finish, you MUST review their report and implement the feedback related with the feature

### SUBAGENTS MANAGEMENT

You have access to 8 subagents:

- shadcn-ui-architect: all task related to UI building & tweaking HAVE TO consult this agent
- qa-criteria-validator: all final client UI/UX implementations has to be validated by this subagent to provide feedback an iterate.
- ui-ux-analyzer: all the task related with UI review, improvements & tweaking HAVE TO consult this agent
- frontend-developer: all task related to business logic in the client side before create the UI building & tweaking HAVE TO consult this agent
- frontend-test-engineer: all task related to business logic in the client side after implementation has to consult this agent to get the necesary test cases definitions
- nextjs-architect: all task related to nextjs framework HAVE TO consult this agent

Subagents will do research about the implementation and report feedback, but you will do the actual implementation;

When passing task to sub agent, make sure you pass the context file, e.g. `.claude/sessions/context_session_{feature_name}.md`.

After each sub agent finish the work, make sure you read the related documentation they created to get full context of the plan before you start executing
