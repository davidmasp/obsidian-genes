---
name: land
description: >-
  Land confirmed current-thread changes into this repository's primary local
  master checkout only when the user has explicitly requested landing; do not
  invoke for review, preparation, verification, or skill installation alone.
metadata:
  delta-action: land
---

# Land local changes

An invocation through Land Changes, `/land`, or equivalent explicit language is
the authorization to carry out this workflow. Do not ask again whether to merge.
This skill lands only the confirmed changes from the current Delta thread into
the primary **local** checkout; it never publishes changes remotely.

## Sources of truth

- The build command is `npm run build`, defined by the `build` script in
  [`package.json`](../../../package.json#L8). It type-checks and runs the
  production esbuild configuration.
- Repository agent guidance requires an explicit commit request and the
  `Co-authored-by: Codex <codex@openai.com>` trailer; the landing invocation is
  that explicit request. Read the destination checkout's
  [`AGENTS.md`](../../../AGENTS.md) before committing in case it has changed.
- The local destination is discovered at run time from the source worktree's
  `local` Git remote. `origin` is never a publication target.

## Preflight and scope

1. Treat the current Delta worktree as the source. Inspect its current branch,
   `git status --porcelain=v1 --untracked-files=all`, `git diff --check`, and
   operation markers (`MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`,
   `BISECT_LOG`, `rebase-merge`, and `rebase-apply` via `git rev-parse
   --git-path`).
2. Establish an exact source-file list from the current thread. Stage only
   those paths with pathspecs; never use `git add -A` or `git add .`. If any
   modified, staged, or untracked path is unrelated or ambiguous, ask for its
   disposition. If there are no confirmed source changes, report that nothing
   was landed and stop.
3. Stop without landing if there are whitespace errors, untracked files outside
   that confirmed scope, or an in-progress source operation.
4. Resolve the `local` remote to the primary checkout and reject a non-local
   path. Inspect that checkout without modifying it. It must be clean, have no
   in-progress operation, and be checked out on `master`; otherwise report that
   changes were not landed and explain the unsafe target state. Record its
   current `master` SHA.
5. Before creating or merging a commit, use authenticated `gh` read-only API
   requests for the repository associated with `origin` to inspect the default
   branch, the effective rules for `master` (`repos/{owner}/{repo}/rules/branches/master`),
   traditional branch protection (`repos/{owner}/{repo}/branches/master/protection`),
   and Actions workflows (`repos/{owner}/{repo}/actions/workflows`). Treat a
   404 protection response as no traditional protection, not as permission to
   ignore other rules. Stop if current settings introduce required reviews,
   signatures, remote CI/checks, or another condition incompatible with this
   local-only workflow. Do not change GitHub settings or bypass a policy.

## Commit and verify the source

1. Stage the confirmed paths and create one non-interactive source commit. Its
   subject must accurately and imperatively describe the confirmed change and
   include `Co-authored-by: Codex <codex@openai.com>`. Do not amend, rebase, or
   absorb unrelated work.
2. Capture the resulting source SHA. Verify that exact commit by checking out
   no other revision and running:

   ```sh
   npm run build
   ```

   This invocation is defined in [`package.json`](../../../package.json#L8).
   If it fails, report the failure and that changes were not landed; leave the
   primary checkout untouched.

## Test the integration before changing `master`

1. Import only the captured source commit into the primary repository over the
   local filesystem, for example with `git fetch --no-tags <source-worktree>
   <source-sha>`. Verify the imported object is the captured commit. Do not
   fetch from, push to, or otherwise contact `origin`.
2. Create a uniquely named temporary linked worktree and integration branch
   from the recorded local `master` SHA. In that worktree merge the source SHA
   non-interactively with `git merge --no-ff --no-edit <source-sha>`, so the
   tested result has a distinct integration commit.
3. If the merge conflicts, collect the conflicted paths, run `git merge
   --abort`, remove the temporary worktree and its integration branch, and
   leave the primary checkout unchanged. Report that changes were **not
   landed**, list the paths, and pause for an explicit resolution decision.
   Never resolve conflicts automatically.
4. Capture the integration commit SHA and run the exact build there:

   ```sh
   npm run build
   ```

   This invocation is defined in [`package.json`](../../../package.json#L8).
   On failure, remove only the agent-created temporary worktree and integration
   branch, report that changes were not landed, and leave primary `master`
   unchanged.

## Land and confirm

1. Before touching primary `master`, recheck that the primary checkout is still
   clean, still on `master`, has no in-progress operation, and still points to
   the SHA recorded during preflight. If it changed, clean up integration
   artifacts and stop rather than overwriting concurrent local work.
2. Fast-forward the primary checkout with `git merge --ff-only
   <integration-sha>`. Do not reset, rebase, pull, force-push, or push.
3. Verify `master` now equals the tested integration SHA, then run:

   ```sh
   npm run build
   ```

   This invocation is defined in [`package.json`](../../../package.json#L8).
   Remove the agent-created temporary worktree and integration branch only
   after the landing result is known. If the post-landing build fails, report a
   failure accurately: `master` has advanced to the named commit but final
   verification failed; do not rewrite `master` to undo it.

## Report the outcome

- Report success only after local `master` equals the tested integration SHA
  and its final build passes. State the short SHA as plain text; do not invent
  hosted commit or CI links.
- For a pre-landing blocker—ambiguous scope, unsafe state, policy restriction,
  conflict, or failed build—report failure and explicitly say the changes were
  **not landed**.
- In a subthread, when `report_subthread_status` is available, emit the final
  result to the parent: use `status: "success"` only for a verified landing and
  `status: "failure"` otherwise; use a short sentence-case title and a
  one-line description with the plain short SHA where one exists. Otherwise
  report directly in the conversation. Do not use a passing build, prepared
  commit, or topic-branch import as success.
