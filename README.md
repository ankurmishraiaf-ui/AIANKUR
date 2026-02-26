# AIANKUR

## Overview
AIANKUR is a powerful AI development assistant and code-generation environment for Windows. It supports voice commands, secure authentication, cloud integration, and project generation for web, mobile, and desktop apps.

## Tech Stack & Architecture
- **Electron + React + Node.js** for modern UI and desktop packaging
- Modular folder structure: `src/ai`, `src/core`, `src/generators`, `src/updater`, etc.
- Pluggable AI engine for local, cloud, and open-source models
- Secure authentication with secret numeric code and OTP
- Auto-update mechanism

## Features
- **Voice Command Only**: After authentication, AIANKUR responds to your voice commands and addresses you as "Ankur".
- **Legal/Non-Legal Solutions**: AIANKUR distinguishes between legal and non-legal solutions based on your request.
- **Cloud Integration**: Connects to OneDrive, Google Drive, iCloud, Gmail, Outlook, etc. (API setup required)
- **Project Generation**: Generates web/mobile/desktop projects with clear instructions.
- **Auto-Update**: Checks for updates and guides you through applying them.

## How to Build & Run
1. Install Node.js and npm.
2. Run `npm install` in the project folder.
3. Run `npm start` to launch the app.
4. Run `npm run make` to package the app as `.exe`.

## Authentication
- Initial secret code: `621956`
- Change code via OTP sent to your phone (+917838458767)
- Code is securely hashed and never stored in plain text

## Cloud Integration
- Requires API keys and OAuth setup for each service
- See `src/ai/providers/cloud.js` for integration points
- For Microsoft 365/OneDrive, use Copilot Retrieval API (see Microsoft Learn)

## Extending AIANKUR
- Add new AI providers in `src/ai/providers/`
- Add new generators in `src/generators/`
- Extend UI in `src/` components

## Limitations
- Proprietary models may require paid APIs
- Voice recognition depends on browser/OS support
- Cloud integrations require user API setup

## Unique Aspects
- Local control over code and data
- Modular, extensible architecture
- Deep integration of coding, documentation, and project generation

## How Auto-Update Works
- App checks a remote version file
- If update is available, guides user to download/apply
- User settings are preserved

## How to Add New Features
- Follow modular structure
- Add new panels/components in `src/`
- Register new AI providers in `src/ai/index.js`

---
For any legal or technical questions, AIANKUR will always clarify if a solution is legal or not. All actions are voice-driven and personalized for "Ankur" after authentication.