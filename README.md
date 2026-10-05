```markdown
# ContextShunt

> Reduce unnecessary context sent to large AI coding models by summarizing large file reads with a smaller model.

ContextShunt is an OpenCode plugin designed to reduce the amount of source code that needs to be processed by a primary AI coding model.

When an AI coding agent reads a large source file, sending the entire file into the main model's context can consume a significant amount of input context. ContextShunt intercepts large file reads and uses a smaller model to create a compact summary before the information is passed back to the main agent.

---

## The Problem

AI coding agents frequently read large files while working on a project.

For example:

```text
Primary AI Model
      ↓
Read large file
      ↓
Entire file enters context
      ↓
Large input consumption
```

Most of the time, the main model does not need every line of a large file.

It mainly needs to know:

- What the file does
- Important functions and classes
- Data flow
- Dependencies
- Important logic
- Integration points
- Relevant locations
- Potential warnings

ContextShunt attempts to preserve this useful information while reducing unnecessary context.

---

## The Idea

ContextShunt introduces a small "context shunting" layer between the coding agent and large file reads.

```text
                     ┌──────────────────────┐
                     │   Primary AI Model   │
                     │      Nemotron        │
                     └──────────┬───────────┘
                                │
                                │ read file
                                ▼
                     ┌──────────────────────┐
                     │    ContextShunt      │
                     │       Plugin         │
                     └──────────┬───────────┘
                                │
                         Large file?
                         /          \
                       No            Yes
                       │              │
                       ▼              ▼
                  Normal read    Worker model
                                      │
                                      ▼
                               Compact summary
                                      │
                                      ▼
                              Primary AI Model
```

Instead of making the primary model process the entire large file, ContextShunt delegates the summarization work to a smaller model.

---

## How It Works

ContextShunt hooks into OpenCode's tool execution lifecycle.

### 1. File Read Is Detected

When OpenCode executes the `read` tool, ContextShunt checks the number of lines in the returned file.

### 2. Small Files Bypass ContextShunt

Files below the configured threshold are allowed through normally.

The default threshold is:

```text
300 lines
```

### 3. Large Files Are Sent to a Worker

When a file exceeds the threshold, ContextShunt creates a separate OpenCode session and sends the file to a worker model.

The worker is instructed to produce a compact, information-dense summary.

### 4. The Worker Summarizes the File

The summary focuses on:

- Purpose
- Structure
- Data flow
- Dependencies
- Important logic
- Integration points
- Relevant locations
- Warnings

### 5. The Primary Model Receives Useful Context

Instead of requiring the primary model to reason over every line of a large file, it can work with a condensed representation of the file.

---

## Example

A large file might contain:

```text
1,200 lines
50 functions
8 classes
multiple imports
database logic
API integrations
configuration
error handling
...
```

Instead of repeatedly carrying all of that information through the primary model's context, ContextShunt can produce something like:

```text
PURPOSE
- Handles authentication and user sessions.

STRUCTURE
- AuthService: login/logout/session management
- TokenManager: JWT creation and validation
- UserRepository: database access

DATA FLOW
- Request → AuthService → UserRepository
- Authentication produces a JWT
- JWT is validated by middleware

DEPENDENCIES
- Database client
- JWT library
- User model

IMPORTANT LOGIC
- Refresh tokens expire after configured duration.
- Invalid tokens trigger authentication errors.

INTEGRATION POINTS
- Used by API authentication middleware.
- Reads user information from UserRepository.
```

The goal is not to reproduce the file.

The goal is to preserve the information another coding agent actually needs.

---

## Architecture

```text
OpenCode
   │
   ├── Primary Model
   │      └── Nemotron
   │
   ├── ContextShunt Plugin
   │      │
   │      ├── Inspect read result
   │      ├── Check totalLines
   │      └── Apply threshold
   │
   └── Worker Session
          │
          └── Nemotron 3.5 Lightning Free
```

Everything runs through OpenCode.

There is no separate inference server or external middleware layer.

---

## Technology Stack

- **OpenCode** — AI coding agent platform
- **TypeScript** — Plugin implementation
- **OpenCode Plugin API** — Tool execution hooks
- **OpenCode Sessions API** — Worker model invocation
- **OpenCode Zen** — Worker model provider
- **Nemotron 3.5 Lightning Free** — Worker model
- **Node.js `fs/promises`** — Logging
- **npm** — Package management

---

## Project Structure

```text
ContextShunt/
│
├── plugins/
│   └── ContextShunt.ts
│
├── opencode.json
├── package.json
├── package-lock.json
├── .gitignore
├── context-shunt.log
└── README.md
```

### Important Files

| File | Purpose |
|---|---|
| `plugins/ContextShunt.ts` | Main ContextShunt plugin |
| `opencode.json` | OpenCode configuration |
| `package.json` | Project dependencies and scripts |
| `context-shunt.log` | Runtime/debug logging |
| `.gitignore` | Files excluded from Git |
| `README.md` | Project documentation |

---

## Installation

Clone the repository:

```bash
[git clone https://github.com/ooppssss/ContextShunt.git]
cd ContextShunt
```

Install dependencies:

```bash
npm install
```

Make sure the plugin is configured in your OpenCode environment.

Then start OpenCode normally.

---

## Configuration

The main routing threshold is configured in the plugin:

```ts
const THRESHOLD = 300
```

This means:

```text
< 300 lines
    ↓
Normal read

>= 300 lines
    ↓
ContextShunt worker
```

The threshold can be adjusted depending on the model, project size, and desired trade-off between summarization overhead and context reduction.

---

## Worker Model

The worker is invoked through OpenCode rather than through a separate inference server.

Current worker configuration:

```ts
model: {
    providerID: "opencode",
    modelID: "nemotron-3.5-lightning-free",
}
```

This keeps the architecture entirely inside OpenCode.

---

## Design Decisions

### No Token Counting

ContextShunt intentionally uses the file's line count instead of calculating token usage.

```text
totalLines
    ↓
routing decision
```

This keeps the plugin simple and avoids adding another tokenization dependency.

Line count is used as a lightweight heuristic for identifying potentially expensive reads.

---

### No External Inference Server

The project does not require:

- Ollama
- vLLM
- FastAPI
- A custom model server
- A separate backend

The worker model is invoked through OpenCode's own session API.

---

### Fail-Safe Behavior

If the worker fails, ContextShunt should not prevent OpenCode from continuing.

The original file read remains available and the error is logged.

This makes ContextShunt an optimization layer rather than a dependency that can break the coding workflow.

---

## Logging

ContextShunt writes debugging information to:

```text
context-shunt.log
```

Example:

```text
========== READ ==========
Lines: 742

Large read detected (742 lines). Sending to worker...

Worker session ID: ses_...

========== WORKER SUMMARY ==========
...
```

Logging makes it easier to understand when ContextShunt activates and what the worker produces.

---

## Future Improvements

Possible future improvements include:

- Intelligent detection of targeted line-range reads
- Summary caching
- File-content hashing
- Avoiding repeated summarization of unchanged files
- Better routing heuristics than line count
- Measuring actual context reduction
- Benchmarking latency and model quality
- More efficient worker prompts
- Different worker models depending on file size
- Language-aware summarization
- Repository-level context indexing

---

## Why ContextShunt?

Large-context coding agents are powerful, but more context is not always better.

A coding agent reading a 2,000-line file does not necessarily need all 2,000 lines in its active reasoning context.

ContextShunt explores a simple idea:

> **Use a smaller model to compress context before asking the stronger model to reason over it.**

This creates a potential model hierarchy:

```text
                 Large / Expensive Model
                         ▲
                         │
                   Useful Context
                         │
                 Smaller Worker Model
                         ▲
                         │
                    Raw Context
```

The worker handles context compression while the primary model focuses on the actual coding task.

---

## Status

🚧 **Experimental / Prototype**

ContextShunt is an experimental OpenCode plugin exploring context reduction for AI coding agents.

Its effectiveness depends on the model, repository, file structure, and summarization quality.

---

## License

MIT
```
