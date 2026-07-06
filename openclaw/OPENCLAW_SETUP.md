# Install the Ramen Radar skill on the OpenClaw machine

Give this file and the `ramen-radar-maintainer` folder to Codex on the machine that runs OpenClaw, or give it the repository URL and ask it to perform these steps.

## 1. Install prerequisites

The machine needs:

- OpenClaw with CLI access.
- Git.
- Node.js 22 or newer and npm.
- GitHub authentication allowed to push to `eyal-hl/ramen-radar`.

Verify:

```sh
openclaw --version
git --version
node --version
npm --version
```

## 2. Clone and prepare the repository

Choose a permanent path that the OpenClaw agent can read and write:

```sh
git clone https://github.com/eyal-hl/ramen-radar.git ~/ramen-radar
cd ~/ramen-radar
npm ci
npm test
npm run check
npm run build
```

If the repository is already cloned, use that clone and first confirm `git status --short` is clean.

Authenticate GitHub using SSH or GitHub CLI. Test without exposing credentials:

```sh
gh auth status
git -C ~/ramen-radar remote -v
```

## 3. Install the skill globally

Install the version stored in the repository:

```sh
openclaw skills install ~/ramen-radar/openclaw/ramen-radar-maintainer --global
```

Local/Git skill installs are copied, not automatically updated. Re-run the command after changing `SKILL.md`.

## 4. Configure the repository path

Add the environment value to `~/.openclaw/openclaw.json` using JSON5 syntax:

```json5
{
  skills: {
    entries: {
      "ramen-radar-maintainer": {
        enabled: true,
        env: {
          RAMEN_RADAR_REPO: "/home/YOUR_USER/ramen-radar"
        }
      }
    }
  }
}
```

On Windows, use an escaped path such as `D:\\Code\\ramen-radar`.

If the agent has a non-empty skill allowlist, add `ramen-radar-maintainer` to that agent's allowed skills. An omitted allowlist requires no change.

If the agent runs inside a sandbox/container, the repository, Git, Node, npm, GitHub credentials, and `RAMEN_RADAR_REPO` must also be available inside that sandbox. Host-only environment injection is not enough for an isolated container.

## 5. Reload and verify

Start a new OpenClaw session so it refreshes its skill snapshot. Verify discovery:

```sh
openclaw skills list
```

First send a harmless request:

```text
Use ramen-radar-maintainer to inspect the Ramen Radar repository and tell me whether it is clean and ready. Do not change anything.
```

Then try an image request:

```text
Upload this supplied image for <place-id> as <filename>, then give me the repository image path to paste into the Ramen Radar editor.
```

## 6. Expected behavior

OpenClaw should pull `master`, add only the requested file under `public/images/places/`, run all validations, commit, and push. GitHub Actions then deploys the image. Place and review data is edited through `/manage/`, not through repository JSON. If the worktree is dirty, validation fails, or GitHub authentication is unavailable, OpenClaw should stop and explain instead of forcing the update.
