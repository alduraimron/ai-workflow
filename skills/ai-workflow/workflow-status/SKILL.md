---
name: workflow-status
description: Read and summarize the active local Pi workflow state without editing source or workflow files. Use only when the user explicitly runs /skill:workflow-status.
disable-model-invocation: true
---

# Workflow Status

Read-only command.

1. Read `.pi/workflow/config.md` and `.pi/workflow/current-work.md` when present.
2. Read Git branch, HEAD, and status without modifying Git.
3. Report in concise Indonesian:
   - profile;
   - active work ID, type, and lifecycle state;
   - branch and whether it is protected;
   - source paths currently changed;
   - configured lint and typecheck commands;
   - pending user action and exact next workflow command.
4. If no state exists, say which setup command to run.

Do not write, stage, commit, start servers, or run checks.
