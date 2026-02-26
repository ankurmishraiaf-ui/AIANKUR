import React, { useEffect, useMemo, useState } from "react";
import fs from "fs";
import path from "path";
import { authenticate, changeSecretCode, sendOtp } from "./auth";
import {
  clearOpenAIApiKey,
  getCodexRoutePolicy,
  hasOpenAIKeyConfigured,
  listModels,
  queryModel,
  saveOpenAIApiKey,
  setCodexRoutePolicy,
  loadPersistentHistory
} from "./aiEngine";

function DevicePanel() {
// --- All state, hooks, handlers, and logic below ---

const loadWorkspaceStatus = async () => {
  if (!bridge?.getWorkspaceGitStatus) {
    setWorkspaceStatus("Project status works in the installed desktop app.");
    return;
  }
  const result = await bridge.getWorkspaceGitStatus({ workspacePath });
  if (!result?.ok) {
    setWorkspaceStatus(result?.message || "Project status check failed.");
    setWorkspaceBranch("(unavailable)");
    setWorkspaceChanges("(unavailable)");
    setWorkspaceCommits("(unavailable)");
    return;
  }
  setWorkspaceStatus(result.message);
  setWorkspaceBranch(result.branch || "(unknown)");
  setWorkspaceChanges(result.statusShort || "(clean)");
  setWorkspaceCommits(result.commits || "(none)");
};

const checkUpdates = async () => {
  if (!bridge?.checkUpdates) {
    setUpdateStatus("Update check works in the installed desktop app.");
    return;
  }
  const result = await bridge.checkUpdates();
  setUpdateStatus(result.message);
};

const openExtensionsDirectory = async () => {
  if (!bridge?.getExtensionsUserDir || !bridge?.openPath) {
    setExtensionsStatus("This action works in the installed desktop app.");
    return;
  }
  const dirPath = await bridge.getExtensionsUserDir();
  const result = await bridge.openPath(dirPath);
  setExtensionsStatus(result.message);
};

const toggleStartupMode = async () => {
  if (!bridge?.setStartup) {
    setStartupStatus("Startup setting can be changed in the installed desktop app.");
    return;
  }

  const result = await bridge.setStartup(!isStartupEnabled);
  if (result?.ok) {
    setIsStartupEnabled(Boolean(result.openAtLogin));
    setStartupStatus(result.message);
    setSystemMeta((previous) => ({
      ...(previous || {}),
      openAtLogin: Boolean(result.openAtLogin)
    }));
    return;
  }
  setStartupStatus(result?.message || "Could not update startup mode.");
};

const scanConnectedDevices = async () => {
  if (!bridge?.listConnectedDevices) {
    setDeviceAccessStatus("Device scan works in the installed desktop app.");
    return;
  }
  const result = await bridge.listConnectedDevices();
  if (!result?.ok) {
    setDeviceAccessStatus(result?.message || "Device scan failed.");
    return;
  }
  setConnectedDevices(result.devices || []);
  if (result.devices?.length) {
    setSelectedConnectedDevice(`${result.devices[0].deviceType}:${result.devices[0].deviceId}`);
  } else {
    setSelectedConnectedDevice("");
  }
  setDeviceAccessStatus(`${result.message} ${result.adbStatus ? `| ${result.adbStatus}` : ""}`);
};

const requestConsentForSelectedDevice = async () => {
  if (!selectedConnected) {
    setDeviceAccessStatus("Choose a connected device first.");
    return;
  }
  if (!bridge?.requestDeviceConsent) {
    setDeviceAccessStatus("Approval flow works in the installed desktop app.");
    return;
  }
  const result = await bridge.requestDeviceConsent({
    deviceType: selectedConnected.deviceType,
    deviceId: selectedConnected.deviceId,
    ownerName,
    durationMinutes: Number(consentDurationMinutes) || 120,
    accessProfile,
    persistentAccess
  });
  if (!result?.ok) {
    setDeviceAccessStatus(result?.message || "Approval request failed.");
    return;
  }
  setConsentRequestId(result.requestId || "");
  setLatestConsentCode(result.consentCode || "");
  setDeviceAccessStatus(
    `${result.message} Profile: ${result.accessProfile}. Expires: ${result.expiresLabel || result.expiresAt || "n/a"}`
  );
};

const confirmConsentForDevice = async () => {
  if (!bridge?.confirmDeviceConsent) {
    setDeviceAccessStatus("Approval confirmation works in the installed desktop app.");
    return;
  }
  const result = await bridge.confirmDeviceConsent({
    requestId: consentRequestId,
    consentCode: consentCodeInput
  });
  if (!result?.ok) {
    setDeviceAccessStatus(result?.message || "Approval confirmation failed.");
    return;
  }
  setDeviceAccessStatus(result.message);
  setConsentCodeInput("");
  await loadActiveConsents();
};

const loadActiveConsents = async () => {
  if (!bridge?.listDeviceConsents) {
    return;
  }
  const result = await bridge.listDeviceConsents();
  if (result?.ok) {
    setActiveConsents(result.consents || []);
  }
};

const revokeSelectedConsent = async () => {
  if (!selectedConnected) {
    setDeviceAccessStatus("Choose a connected device first.");
    return;
  }
  if (!bridge?.revokeDeviceConsent) {
    setDeviceAccessStatus("Approval removal works in the installed desktop app.");
    return;
  }
  const result = await bridge.revokeDeviceConsent({
    deviceType: selectedConnected.deviceType,
    deviceId: selectedConnected.deviceId
  });
  setDeviceAccessStatus(result?.message || "Approval removal failed.");
  await loadActiveConsents();
};

const readConnectedDeviceInfo = async () => {
  if (!selectedConnected) {
    setDeviceReadOutput("Choose a connected device first.");
    return;
  }
  if (selectedConnected.deviceType === "android") {
    const result = await bridge?.getAndroidDeviceInfo?.({
      serial: selectedConnected.deviceId
    });
    if (!result?.ok) {
      setDeviceReadOutput(result?.message || "Android details could not be loaded.");
      return;
    }
    const info = result.info || {};
    setDeviceReadOutput(
      [
        `Serial: ${info.serial}`,
        `Model: ${info.model}`,
        `Brand: ${info.brand}`,
        `Android Version: ${info.androidVersion}`
      ].join("\n")
    );
    return;
  }

  const windowsResult = await bridge?.getWindowsDeviceInfo?.({
    targetId: selectedConnected.deviceId
  });
  if (!windowsResult?.ok) {
    setDeviceReadOutput(windowsResult?.message || "Windows details could not be loaded.");
    return;
  }
  const info = windowsResult.info || {};
  setDeviceReadOutput(
    [
      `Host: ${info.host}`,
      `Platform: ${info.platform}`,
      `User: ${info.user}`,
      `Memory GB: ${info.memoryGB}`,
      `Drives: ${(info.drives || []).join(", ")}`
    ].join("\n")
  );
};

const listAndroidPath = async () => {
  if (!selectedConnected || selectedConnected.deviceType !== "android") {
    setDeviceReadOutput("Choose an Android device first.");
    return;
  }
  const result = await bridge?.listAndroidFiles?.({
    serial: selectedConnected.deviceId,
    remotePath: deviceTargetPath
  });
  if (!result?.ok) {
    setDeviceReadOutput(result?.message || "Android folder list failed.");
    return;
  }
  setDeviceReadOutput([result.message, "", ...(result.files || [])].join("\n"));
};

const applyConnectedDeviceChange = async () => {
  if (!selectedConnected) {
    setDeviceAccessStatus("Choose a connected device first.");
    return;
  }
  if (!deviceAuthCode) {
    setDeviceAccessStatus("Enter passcode to allow this change.");
    return;
  }

  if (selectedConnected.deviceType === "android") {
    const result = await bridge?.applyAndroidDeviceChange?.({
      serial: selectedConnected.deviceId,
      operation: deviceOperation,
      remotePath: deviceTargetPath,
      content: deviceOperationContent,
      authCode: deviceAuthCode
    });
    setDeviceAccessStatus(result?.message || "Android change failed.");
    return;
  }

  const windowsResult = await bridge?.applyWindowsDeviceChange?.({
    targetId: selectedConnected.deviceId,
    operation: deviceOperation,
    targetPath: deviceTargetPath,
    content: deviceOperationContent,
    authCode: deviceAuthCode
  });
  setDeviceAccessStatus(windowsResult?.message || "Windows change failed.");
};

const scanBrowserSources = async () => {
  if (!selectedConnected) {
    setBrowserExportStatus("Choose a connected device first.");
    return;
  }
  if (!bridge?.listBrowserSources) {
    setBrowserExportStatus("Browser source scan works in the installed desktop app.");
    return;
  }

  const result = await bridge.listBrowserSources({
    deviceType: selectedConnected.deviceType,
    deviceId: selectedConnected.deviceId
  });
  setBrowserExportStatus(result?.message || "Browser source scan failed.");
  if (!result?.ok) {
    setBrowserSourcesOutput("No browser sources available.");
    return;
  }

  const rows = (result.sources || []).map((item) => {
    if (item.browser) {
      return `${item.browser} | ${item.type} | ${item.location}`;
    }
    return `${item.browserPackage || "Android Browser"} | ${item.type} | ${item.location}`;
  });
  setBrowserSourcesOutput(rows.length ? rows.join("\n") : "No supported browser sources found.");
};

const exportBrowserDataFromDevice = async () => {
  if (!selectedConnected) {
    setBrowserExportStatus("Choose a connected device first.");
    return;
  }
  if (!browserAuthCode) {
    setBrowserExportStatus("Enter passcode to export browser data.");
    return;
  }
  if (!bridge?.exportBrowserData) {
    setBrowserExportStatus("Browser export works in the installed desktop app.");
    return;
  }

  const result = await bridge.exportBrowserData({
    deviceType: selectedConnected.deviceType,
    deviceId: selectedConnected.deviceId,
    authCode: browserAuthCode,
    sourcePath: browserSourcePath
  });
  setBrowserExportStatus(result?.message || "Browser export failed.");

  const lines = [];
  if (result?.destinationPath) {
    lines.push(`Saved to: ${result.destinationPath}`);
  }
  if (result?.files?.length) {
    lines.push("Files:");
    lines.push(...result.files);
  }
  if (result?.skipped?.length) {
    lines.push("");
    lines.push("Skipped:");
    lines.push(...result.skipped);
  }
  setBrowserExportOutput(lines.length ? lines.join("\n") : "No exported browser files.");
};

const loadBackgroundJobs = async () => {
  if (!bridge?.listBackupJobs) {
    setBackgroundModeStatus("Background jobs are available in the installed desktop app.");
    return;
  }

  const result = await bridge.listBackupJobs(
    selectedConnected
      ? { deviceType: selectedConnected.deviceType, deviceId: selectedConnected.deviceId }
      : {}
  );
  if (!result?.ok) {
    setBackgroundModeStatus(result?.message || "Background jobs could not be loaded.");
    return;
  }

  setBackgroundJobs(result.jobs || []);
  setBackgroundModeStatus(result.message || "Background jobs loaded.");
};

const createBackgroundJob = async () => {
  if (!selectedConnected) {
    setBackgroundModeStatus("Choose a connected device first.");
    return;
  }
  if (!backgroundAuthCode) {
    setBackgroundModeStatus("Enter passcode to create background mode job.");
    return;
  }
  if (!bridge?.createBackupJob) {
    setBackgroundModeStatus("Background jobs are available in the installed desktop app.");
    return;
  }

  const result = await bridge.createBackupJob({
    deviceType: selectedConnected.deviceType,
    deviceId: selectedConnected.deviceId,
    sourcePath: backgroundSourcePath,
    label: backgroundJobLabel || `${selectedConnected.deviceType}-background`,
    intervalMinutes: Number(backgroundIntervalMinutes) || 15,
    authCode: backgroundAuthCode
  });
  setBackgroundModeStatus(result?.message || "Background job creation failed.");
  if (result?.ok) {
    setBackgroundAuthCode("");
    await loadBackgroundJobs();
  }
};

const runBackgroundJobNowFor = async (jobId) => {
  if (!bridge?.runBackupJobNow) {
    setBackgroundModeStatus("Background jobs are available in the installed desktop app.");
    return;
  }
  const result = await bridge.runBackupJobNow({ jobId });
  setBackgroundModeStatus(result?.message || "Background run failed.");
  await loadBackgroundJobs();
};

const toggleBackgroundJobFor = async (jobId, enabled) => {
  if (!bridge?.setBackupJobEnabled) {
    setBackgroundModeStatus("Background jobs are available in the installed desktop app.");
    return;
  }
  const result = await bridge.setBackupJobEnabled({ jobId, enabled });
  setBackgroundModeStatus(result?.message || "Background job update failed.");
  await loadBackgroundJobs();
};

const removeBackgroundJobFor = async (jobId) => {
  if (!bridge?.removeBackupJob) {
    setBackgroundModeStatus("Background jobs are available in the installed desktop app.");
    return;
  }
  const result = await bridge.removeBackupJob({ jobId });
  setBackgroundModeStatus(result?.message || "Background job removal failed.");
  await loadBackgroundJobs();
};

const menuItems = [
  { id: "ai", label: "Ask AI" },
  { id: "build", label: "Build New App" },
  { id: "command", label: "Run PC Task" },
  { id: "security", label: "Passcode & Lock" },
  { id: "devices", label: "DEVICE" },
  { id: "workspace", label: "Project Snapshot" },
  { id: "updates", label: "App Care" }
];

const goToMainMenu = () => {
  setActiveSection("");
  if (typeof window !== "undefined") {
    window.requestAnimationFrame(() => {
      document.getElementById("aiankur-main-menu")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }
};

return (
  <section className="dashboard-grid">
    <article id="aiankur-main-menu" className="panel panel-primary">
      <h2>Choose A Task</h2>
      <p>Tap one button below. Only one section opens, so everything stays simple.</p>
      <div className="feature-grid">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={activeSection === item.id ? "btn feature-btn active" : "btn feature-btn"}
            onClick={() => setActiveSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </article>

    {activeSection ? (
      <div className="home-action-wrap">
        <button className="btn btn-home" onClick={goToMainMenu}>
          Home
        </button>
      </div>
    ) : null}

    {activeSection === "ai" ? (
      <article className="panel">
        <header className="panel-header">
          <div>
            <h2>Ask AI</h2>
            <p>Write your question and get a clear answer in seconds.</p>
          </div>
          <button className="btn btn-ghost" onClick={runModelQuery} disabled={isModelLoading}>
            {isModelLoading ? "Thinking..." : "Get Answer"}
          </button>
        </header>

        <label className="field-label">Choose AI Style</label>
        <select
          className="field-input"
          value={selectedModel}
          onChange={(event) => setSelectedModel(event.target.value)}
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} | {model.free ? "Free" : "Needs key"}
            </option>
          ))}
        </select>

        <label className="field-label">Your Question</label>
        <textarea
          className="field-input"
          rows={4}
          value={modelPrompt}
          onChange={(event) => setModelPrompt(event.target.value)}
        />

        {selectedModel === "gpt-5.3-codex" ? (
          <>
            <label className="field-label">GPT-5.3-Codex Mode</label>
            <select
              className="field-input"
              value={codexRoute}
              onChange={(event) => applyCodexRoute(event.target.value)}
            >
              <option value="local">Use free local mode (recommended)</option>
              <option value="auto">Auto pick best mode</option>
              <option value="official">Try official first, then local</option>
            </select>

            <label className="field-label">Optional OpenAI Key (advanced)</label>
            <div className="inline-buttons">
              <input
                className="field-input"
                type="password"
                value={codexApiKeyDraft}
                placeholder="sk-... (saved only on your device)"
                onChange={(event) => setCodexApiKeyDraft(event.target.value)}
              />
              <button className="btn btn-neutral" onClick={saveCodexKey}>
                Save Key
              </button>
              <button className="btn btn-danger" onClick={clearCodexKey}>
                Clear Key
              </button>
            </div>
            <small>
              OpenAI key saved: {hasOpenAIKey ? "yes" : "no"} | Free local mode always remains
              available.
            </small>
            <small>{codexConfigStatus}</small>
          </>
        ) : null}

        <div className="output-box">{modelResponse}</div>
      </article>
    ) : null}

    {activeSection === "build" ? (
      <article className="panel">
        <header className="panel-header">
          <div>
            <h2>Build New App</h2>
            <p>Create a full plan and starter files with one click.</p>
          </div>
          <button className="btn btn-accent" onClick={generateBlueprint}>
            Create Plan
          </button>
        </header>

        <label className="field-label">What are you building?</label>
        <select
          className="field-input"
          value={targetPlatform}
          onChange={(event) => setTargetPlatform(event.target.value)}
        >
          {platformTargets.map((target) => (
            <option key={target} value={target}>
              {target}
            </option>
          ))}
        </select>

        <label className="field-label">Name for your app</label>
        <input
          className="field-input"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="my-next-app"
        />

        <label className="field-label">How detailed should the plan be?</label>
        <select
          className="field-input"
          value={codeDepthMode}
          onChange={(event) => setCodeDepthMode(event.target.value)}
        >
          <option value="extreme">Detailed plan (best quality)</option>
          <option value="advanced">Balanced plan (faster start)</option>
        </select>

        <label className="field-label">Describe what you want</label>
        <textarea
          className="field-input"
          rows={3}
          value={projectGoal}
          onChange={(event) => setProjectGoal(event.target.value)}
        />

        <div className="inline-buttons">
          <button className="btn btn-neutral" onClick={createStarterScaffold}>
            Create Starter Files
          </button>
          <button className="btn btn-neutral" onClick={openScaffoldFolder}>
            Open Folder
          </button>
        </div>
        <small>{scaffoldStatus}</small>
        {scaffoldPath ? <small>{scaffoldPath}</small> : null}
        <div className="output-box">{projectBlueprint}</div>
      </article>
    ) : null}

    {activeSection === "command" ? (
      <article className="panel">
        <header className="panel-header">
          <div>
            <h2>Run PC Task</h2>
            <p>Enter your passcode first, then run your task safely.</p>
          </div>
          <button className="btn btn-danger" onClick={runSecureCommand} disabled={isCommandRunning}>
            {isCommandRunning ? "Running..." : "Run Task"}
          </button>
        </header>

        <label className="field-label">Passcode</label>
        <input
          className="field-input"
          type="password"
          placeholder="Enter numeric passcode"
          value={commandCode}
          onChange={(event) => setCommandCode(event.target.value)}
        />

        <label className="field-label">Task Instruction</label>
        <textarea
          className="field-input"
          rows={3}
          value={commandText}
          onChange={(event) => setCommandText(event.target.value)}
        />
        <div className="output-box">{commandResult}</div>
      </article>
    ) : null}

    {activeSection === "security" ? (
      <article className="panel">
        <header className="panel-header">
          <div>
            <h2>Passcode & Lock</h2>
            <p>Check your passcode and update it with one-time code.</p>
          </div>
          <button className="btn btn-neutral" onClick={requestOtp}>
            Send One-Time Code
          </button>
        </header>

        <label className="field-label">Check Passcode</label>
        <div className="inline-buttons">
          <input
            className="field-input"
            type="password"
            value={authCode}
            onChange={(event) => setAuthCode(event.target.value)}
            placeholder="Enter passcode"
          />
          <button className="btn btn-neutral" onClick={runAuthCheck}>
            Check
          </button>
        </div>
        <small>{authStatus}</small>

        <div className="inline-two">
          <div>
            <label className="field-label">Current Passcode</label>
            <input
              className="field-input"
              type="password"
              value={currentCode}
              onChange={(event) => setCurrentCode(event.target.value)}
            />
          </div>
          <div>
            <label className="field-label">New Passcode</label>
            <input
              className="field-input"
              type="password"
              value={newCode}
              onChange={(event) => setNewCode(event.target.value)}
            />
          </div>
        </div>

        <label className="field-label">One-Time Code (OTP)</label>
        <div className="inline-buttons">
          <input
            className="field-input"
            type="text"
            value={otpInput}
            onChange={(event) => setOtpInput(event.target.value)}
            placeholder="Use demo code 123456"
          />
          <button className="btn btn-accent" onClick={updateSecretCode}>
            Update Passcode
          </button>
        </div>
        <small>{otpStatus}</small>
      </article>
    ) : null}

    {activeSection === "devices" ? (
      <article className="panel">
        <header className="panel-header">
          <div>
            <h2>DEVICE</h2>
            <p>Universal device access for Android & Windows. One-time owner authentication required.</p>
          </div>
        </header>

        {selectedConnected ? (
          <div className="device-detail">
            <h3>Connected Device Info</h3>
            <p><strong>Type:</strong> {selectedConnected.deviceType}</p>
            <p><strong>ID:</strong> {selectedConnected.deviceId}</p>
            <p><strong>Status:</strong> {selectedConnected.status}</p>
            <p><strong>Manufacturer:</strong> {selectedConnected.manufacturer || "Unknown"}</p>
            <p><strong>Model:</strong> {selectedConnected.model || "Unknown"}</p>
            <p><strong>OS:</strong> {selectedConnected.osVersion || "Unknown"}</p>
          </div>
        ) : (
          <div className="device-detail">
            <p>No device connected or authenticated. Please connect a device and complete one-time authentication below.</p>
          </div>
        )}

        <div className="divider" />

        <h3 className="sub-heading">One-Time Device Owner Authentication</h3>
        <p className="helper-text">
          Click "Send Approval Request" to generate a one-time code. Device owner enters this code on their device to approve access. Once approved, AIANKUR can interact with the device until access is revoked.
        </p>
        <div className="inline-buttons">
          <button className="btn btn-accent" onClick={requestConsentForSelectedDevice}>
            Send Approval Request
          </button>
          <button className="btn btn-neutral" onClick={loadActiveConsents}>
            Refresh Approvals
          </button>
        </div>
        <label className="field-label">Owner Approval Code</label>
        <div className="inline-buttons">
          <input
            className="field-input"
            value={consentCodeInput}
            onChange={(event) => setConsentCodeInput(event.target.value)}
            placeholder="6-digit code from owner"
          />
          <button className="btn btn-neutral" onClick={confirmConsentForDevice}>
            Confirm Approval
          </button>
        </div>
        {latestConsentCode ? (
          <small>
            Latest generated code: <strong>{latestConsentCode}</strong> (share this with the owner)
          </small>
        ) : null}

        <div className="divider" />

        <h3 className="sub-heading">Device Chat & Control</h3>
        <p className="helper-text">
          Use the chat below to send prompts to AIANKUR. It will perform the requested task at the device level (manufacturer APIs if available) and explain the result.
        </p>
        <div className="chat-window">
          <div className="chat-history" style={{ maxHeight: 200, overflowY: "auto", background: "#f8f8f8", padding: 8, marginBottom: 8 }}>
            {(persistentContext.history || []).filter(h => h.type === "model-query").map((entry, idx) => (
              <div key={idx} style={{ marginBottom: 6 }}>
                <div><strong>You:</strong> {entry.prompt}</div>
                <div><strong>AIANKUR:</strong> {entry.response}</div>
              </div>
            ))}
          </div>
          <div className="chat-input-row" style={{ display: "flex", gap: 8 }}>
            <input
              className="field-input"
              style={{ flex: 1 }}
              value={modelPrompt}
              onChange={e => setModelPrompt(e.target.value)}
              placeholder="Type your device prompt here..."
            />
            <button className="btn btn-accent" onClick={runModelQuery} disabled={isModelLoading}>
              {isModelLoading ? "Working..." : "Send"}
            </button>
          </div>
          {modelResponse && (
            <div className="chat-result" style={{ marginTop: 8, background: "#e8f5e9", padding: 8, borderRadius: 4 }}>
              <strong>Result:</strong> {modelResponse}
              <div style={{ fontSize: "0.9em", color: "#555", marginTop: 4 }}>
                (AIANKUR has explained the result above.)
              </div>
            </div>
          )}
        </div>
      </article>
    ) : null}

    <h3 className="sub-heading">Trusted Device Control</h3>
    <p className="helper-text">
      Step 1: Find devices. Step 2: Ask owner for approval code. Step 3: Confirm and run
      your action. Use persistent trust for one-time pairing until owner revokes it.
    </p>

    <div className="inline-buttons">
      <button className="btn btn-neutral" onClick={scanConnectedDevices}>
        Find Connected Devices
      </button>
      <button className="btn btn-neutral" onClick={loadActiveConsents}>
        Refresh Approvals
      </button>
    </div>

    <label className="field-label">Choose Device</label>
    <select
      className="field-input"
      value={selectedConnectedDevice}
      onChange={(event) => setSelectedConnectedDevice(event.target.value)}
    >
      <option value="">Select a connected device</option>
      {connectedDevices.map((item) => (
        <option
          key={`${item.deviceType}:${item.deviceId}`}
          value={`${item.deviceType}:${item.deviceId}`}
        >
          {item.deviceType.toUpperCase()} | {item.deviceId} | {item.status}
        </option>
      ))}
    </select>

    <div className="inline-two">
      <div>
        <label className="field-label">Owner Name</label>
        <input
          className="field-input"
          value={ownerName}
          onChange={(event) => setOwnerName(event.target.value)}
        />
      </div>
      <div>
        <label className="field-label">Approval Time (Minutes)</label>
        <input
          className="field-input"
          value={consentDurationMinutes}
          onChange={(event) => setConsentDurationMinutes(event.target.value)}
          disabled={persistentAccess}
        />
      </div>
    </div>

    <div className="inline-two">
      <div>
        <label className="field-label">Access Profile</label>
        <select
          className="field-input"
          value={accessProfile}
          onChange={(event) => setAccessProfile(event.target.value)}
        >
          <option value="standard">Standard (read-only + list files)</option>
          <option value="developer">Developer (read/write + browser export)</option>
        </select>
      </div>
      <div>
        <label className="field-label">Trust Mode</label>
        <div className="inline-buttons">
          <button
            className={persistentAccess ? "btn btn-accent" : "btn btn-neutral"}
            onClick={() => setPersistentAccess(true)}
          >
            Persistent
          </button>
          <button
            className={!persistentAccess ? "btn btn-accent" : "btn btn-neutral"}
            onClick={() => setPersistentAccess(false)}
          >
            Timed
          </button>
        </div>
        <small>
          {persistentAccess
            ? "Persistent trust stays active until owner revokes it."
            : "Timed trust auto-expires after selected minutes."}
        </small>
      </div>
    </div>

    <div className="inline-buttons">
      <button className="btn btn-accent" onClick={requestConsentForSelectedDevice}>
        Send Approval Request
      </button>
      <button className="btn btn-danger" onClick={revokeSelectedConsent}>
        Remove Approval
      </button>
    </div>

    <label className="field-label">Request ID</label>
    <input
      className="field-input"
      value={consentRequestId}
      onChange={(event) => setConsentRequestId(event.target.value)}
      placeholder="Paste request ID"
    />

    <label className="field-label">Owner Approval Code</label>
    <div className="inline-buttons">
      <input
        className="field-input"
        value={consentCodeInput}
        onChange={(event) => setConsentCodeInput(event.target.value)}
        placeholder="6-digit code from owner"
      />
      <button className="btn btn-neutral" onClick={confirmConsentForDevice}>
        Confirm Approval
      </button>
    </div>
    {latestConsentCode ? (
      <small>
        Latest generated code: <strong>{latestConsentCode}</strong> (share this with the
        owner)
      </small>
    ) : null}

    <label className="field-label">File Or Folder Location</label>
    <input
      className="field-input"
      value={deviceTargetPath}
      onChange={(event) => setDeviceTargetPath(event.target.value)}
      placeholder="Android: /sdcard/... | Windows: C:\\Users\\..."
    />

    <label className="field-label">Choose Action</label>
    <select
      className="field-input"
      value={deviceOperation}
      onChange={(event) => setDeviceOperation(event.target.value)}
    >
      <option value="write-text">Write Text File</option>
      <option value="create-folder">Create Folder</option>
      <option value="delete-path">Delete File Or Folder</option>
    </select>

    <label className="field-label">Text To Save (for write action)</label>
    <textarea
      className="field-input"
      rows={3}
      value={deviceOperationContent}
      onChange={(event) => setDeviceOperationContent(event.target.value)}
    />

    <label className="field-label">Passcode (needed for change/delete)</label>
    <input
      className="field-input"
      type="password"
      value={deviceAuthCode}
      onChange={(event) => setDeviceAuthCode(event.target.value)}
      placeholder="Enter passcode"
    />

    <div className="inline-buttons">
      <button className="btn btn-neutral" onClick={readConnectedDeviceInfo}>
        Read Device Details
      </button>
      <button className="btn btn-neutral" onClick={listAndroidPath}>
        Show Android Folder
      </button>
      <button className="btn btn-accent" onClick={applyConnectedDeviceChange}>
        Run Change
      </button>
    </div>

    <small>{deviceAccessStatus}</small>
    <label className="field-label">Result</label>
    <div className="output-box">{deviceReadOutput}</div>

    <label className="field-label">Active Approvals</label>
    <div className="output-box">
      {(activeConsents || []).length
        ? activeConsents
          .map(
            (item) =>
              `${item.deviceType}:${item.deviceId} | owner=${item.ownerName} | profile=${item.accessProfile || "developer"} | expires=${item.expiresLabel || item.expiresAt || "never"}`
          )
          .join("\n")
        : "No active approvals."}
    </div>

    <div className="divider" />

    <h3 className="sub-heading">Background Mode (Owner Friendly)</h3>
    <p className="helper-text">
      After one-time owner approval, AIANKUR can run scheduled background sync jobs without
      repeated prompts. Owner can keep using the device normally.
    </p>

    <label className="field-label">Background Source Path</label>
    <input
      className="field-input"
      value={backgroundSourcePath}
      onChange={(event) => setBackgroundSourcePath(event.target.value)}
      placeholder="Android: /sdcard/Download | Windows: C:\\Users\\<you>\\Documents"
    />

    <div className="inline-two">
      <div>
        <label className="field-label">Background Job Name</label>
        <input
          className="field-input"
          value={backgroundJobLabel}
          onChange={(event) => setBackgroundJobLabel(event.target.value)}
        />
      </div>
      <div>
        <label className="field-label">Run Every (Minutes)</label>
        <input
          className="field-input"
          value={backgroundIntervalMinutes}
          onChange={(event) => setBackgroundIntervalMinutes(event.target.value)}
        />
      </div>
    </div>

    <label className="field-label">Passcode (required to create job)</label>
    <input
      className="field-input"
      type="password"
      value={backgroundAuthCode}
      onChange={(event) => setBackgroundAuthCode(event.target.value)}
      placeholder="Enter passcode"
    />

    <div className="inline-buttons">
      <button className="btn btn-accent" onClick={createBackgroundJob}>
        Enable Background Mode
      </button>
      <button className="btn btn-neutral" onClick={loadBackgroundJobs}>
        Refresh Background Jobs
      </button>
    </div>

    <small>{backgroundModeStatus}</small>
    <ul className="extension-list">
      {(backgroundJobs || []).map((job) => (
        <li key={job.id}>
          <strong>{job.label || job.id}</strong>{" "}
          <span>
            {job.deviceType}:{job.deviceId}
          </span>
          <p>
            source={job.sourcePath} | every={job.intervalMinutes}m | status=
            {job.enabled ? "enabled" : "paused"} | next=
            {job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : "paused"}
          </p>
          <div className="inline-buttons">
            <button className="btn btn-neutral" onClick={() => runBackgroundJobNowFor(job.id)}>
              Run Now
            </button>
            <button
              className="btn btn-neutral"
              onClick={() => toggleBackgroundJobFor(job.id, !job.enabled)}
            >
              {job.enabled ? "Pause" : "Resume"}
            </button>
            <button className="btn btn-danger" onClick={() => removeBackgroundJobFor(job.id)}>
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
    {(backgroundJobs || []).length ? null : (
      <div className="output-box">No background jobs configured yet.</div>
    )}

    <div className="divider" />

    <h3 className="sub-heading">Browser Data Export (Owner Approved)</h3>
    <p className="helper-text">
      This exports only safe browser data files. Passwords and cookies are not collected.
      Android export works only for files the owner exported to shared storage.
    </p>

    <label className="field-label">Android Shared Folder (used only for Android)</label>
    <input
      className="field-input"
      value={browserSourcePath}
      onChange={(event) => setBrowserSourcePath(event.target.value)}
      placeholder="/sdcard/Download"
    />

    <label className="field-label">Passcode (required for export)</label>
    <input
      className="field-input"
      type="password"
      value={browserAuthCode}
      onChange={(event) => setBrowserAuthCode(event.target.value)}
      placeholder="Enter passcode"
    />

    <div className="inline-buttons">
      <button className="btn btn-neutral" onClick={scanBrowserSources}>
        Scan Browser Sources
      </button>
      <button className="btn btn-accent" onClick={exportBrowserDataFromDevice}>
        Export Browser Data
      </button>
    </div>

    <small>{browserExportStatus}</small>
    <label className="field-label">Detected Browser Sources</label>
    <div className="output-box">{browserSourcesOutput}</div>

    <label className="field-label">Export Output</label>
    <div className="output-box">{browserExportOutput}</div>
  </section>
  );
}
export default DevicePanel;
