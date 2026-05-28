# Agent State Evals

These evals verify that Hermes and OpenClaw can independently use the hosted
Threadron shared-state surface.

## Default evals

```sh
npm run eval:agents
```

The default suite is deterministic and cheap. For each agent identity it checks:

- local config has a hosted Threadron key
- hosted MCP discovers the expected tools
- explicit shared-state round trip: create, update, read, archive a thread
- implicit shared-state capture: store a loose follow-up in the inbox, then clean it up
- session check-in returns the shared state shape agents should read on startup

## Live prompt evals

```sh
npm run eval:agents:live
```

The live suite additionally prompts the actual Hermes and OpenClaw agents. It is
slower and model-dependent, but catches the important behavioral failure mode:
the transport works, yet the agent does not choose to write shared state when the
user implies a handoff should be remembered.

Use `THREADRON_EVAL_KEEP_ARTIFACTS=1` or `--keep-artifacts` when debugging and
you want the eval-created threads/inbox items to remain visible.

Use `--agent hermes` or `--agent openclaw` to isolate one runtime while
debugging live failures.
