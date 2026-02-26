# AIANKUR Desktop

AIANKUR is a Windows desktop engineering workspace built with Electron + React.  
It combines:
- AI workspace with local model routing
- secure command execution gated by numeric authentication
- device operations panel
- extension registry for future custom features
- update-check infrastructure for self-update workflows

## Important Reality Check

Some requested goals are not technically/legal-feasible in a literal sense, including:
- "all LLMs free for lifetime"
- "better than every existing AI tool"

This build provides a practical architecture to integrate free local models and optional paid connectors, so you can expand capabilities over time without rewriting the app.

## Architecture

- `desktop/main.js`: Electron main process, secure auth store, IPC, command execution, updater hooks
- `desktop/preload.js`: secure bridge exposed to renderer
- `AIANKUR/`: Vite + React renderer application
- `extensions/*.json`: extension manifests loaded at runtime

## Current Features

1. **Advanced UI dashboard**
   - Self-explanatory sections: AI Studio, Command Center, Security, Devices, Dev Workspace, Extensions, Updates
   - Responsive desktop/mobile layout and clear visual hierarchy

2. **AI model routing**
   - GPT-5.3-Codex hybrid profile (`gpt-5.3-codex`) with route policy:
     - `local` (default and recommended): always free local mode
     - `auto`: official route only when key exists, else local
     - `official`: tries official route first, then local fallback
   - Free local model support through Ollama (`llama3.2`, `qwen2.5-coder`, `mistral`)
   - Connector slots for hosted providers (OpenAI/Gemini/Claude) for future API-key integrations

3. **Secure command execution**
   - Commands are blocked unless authenticated with numeric secret code
   - Command execution handled in Electron main process

4. **Secret code management**
   - Numeric code validation and update workflow with OTP demo gate
   - Secret code hash stored in user data

5. **Extensions**
   - Manifest-based extension registry
   - User extension folder support for future additions

6. **Cross-platform scaffold generator**
   - Generates starter project structures in Documents (`AIANKUR-Generated`)
   - Targets: Web, iOS, Android, macOS, Linux/Ubuntu, Cross-platform suite

7. **Workspace inspector**
   - Git-style view with current branch, change summary, and recent commits
   - Helps mirror core visibility patterns from developer tools

8. **Updater hooks**
   - Update-check IPC and UI status channel
   - GitHub publish channel pre-configured in `electron-builder.json`

9. **Startup control**
   - Auto-start disabled by default on supported desktop platforms
   - Runtime toggle available in the "Extension + Update Hub" panel

## Build and Run

### Prerequisites
- Node.js 20+
- npm
- Windows 10/11 for `.exe` build target

### Install dependencies

```bash
npm install
npm --prefix AIANKUR install
```

### Development mode

```bash
npm run dev
```

### Build desktop installer (`.exe`)

```bash
npm run build
```

Installer output is configured to:

`C:\Users\mishr\Desktop\AIANKUR\build`

## Self-Update Configuration (Next Step)

### Publish updates to GitHub Releases

1. Set token in terminal:
   ```bash
   set GH_TOKEN=your_github_token
   ```
2. Build and publish:
   ```bash
   npm run publish:github
   ```
3. Keep release artifacts (`.exe`, `.blockmap`, `latest.yml`) attached to the same GitHub release.
4. If the repository is private, end-user auto-update checks will fail without auth. Use a public releases feed or a dedicated authenticated update server.

### Production hardening checklist

1. Add Windows code-signing certificate.
2. Use immutable version tags and semantic versioning.
3. Automate publish from CI with protected secrets.

### Signed release pipeline

Local signed release commands:

```bash
npm run build:signed
npm run publish:github:signed
```

CI signed release workflow:

- Workflow file: `.github/workflows/release-signed.yml`
- Trigger: manual (`workflow_dispatch`) or push tag (`v*`)
- Required GitHub Actions secrets:
  1. `GH_TOKEN` with repo write permissions
  2. `CSC_LINK` (base64 `.pfx` content or secure cert URL/file reference)
  3. `CSC_KEY_PASSWORD` (certificate password)

Replace temporary/self-signed certificate with your CA-issued `.pfx`:

```powershell
powershell -ExecutionPolicy Bypass -File tools/set_signing_secrets_from_pfx.ps1 -PfxPath "C:\path\real-codesign.pfx" -PfxPassword "your-pfx-password"
```

Local trust workaround (for this PC only):

```bash
npm run trust:local-cert
```

This imports AIANKUR signing certificate into current-user trusted stores so signed builds are locally trusted on this machine.

## Adding Future Functions

1. Add UI module in `AIANKUR/src/`
2. Add secure backend capability in `desktop/main.js` via IPC handler
3. Optionally register extension metadata in `extensions/*.json`

## Security Notes

- Command execution is intentionally powerful and should be used carefully.
- Keep your secret code private.
- For production, replace demo OTP with real SMS/email/TOTP provider.
- Windows build is configured with `requestedExecutionLevel: requireAdministrator`, so AIANKUR requests administrator elevation on every launch.

## Antivirus Compatibility

- AIANKUR is configured with safer defaults (auto-start disabled by default).
- Do not attempt to bypass antivirus protections.
- For fewer false positives in production:
  1. Sign the installer and app executable with a trusted code-signing certificate.
  2. Publish builds only from your official GitHub repository/releases.
  3. Keep dependencies updated and avoid bundled unknown binaries.
