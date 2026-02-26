import React, { useEffect, useMemo, useState } from "react";
import { authenticate, changeSecretCode, sendOtp } from "./auth";
import {
  clearOpenAIApiKey,
  getCodexRoutePolicy,
  hasOpenAIKeyConfigured,
  listModels,
  queryModel,
  saveOpenAIApiKey,
  setCodexRoutePolicy
} from "./aiEngine";

const mockDevices = [
  { id: 1, type: "USB", name: "USB Flash Drive", status: "Connected", info: "16GB, SanDisk" },
  { id: 2, type: "Network", name: "WiFi Adapter", status: "Connected", info: "802.11ac, Intel" },
  { id: 3, type: "Virtual", name: "Virtual Machine", status: "Running", info: "Ubuntu 22.04" },
  { id: 4, type: "Bluetooth", name: "Bluetooth Speaker", status: "Disconnected", info: "JBL Go" },
  { id: 5, type: "Printer", name: "HP LaserJet", status: "Connected", info: "HP LaserJet Pro MFP" }
];

const platformTargets = [
  "Web (Complex Sites)",
  "iOS App",
  "Android App",
  "macOS App",
  "Linux/Ubuntu App",
  "Cross-Platform Suite"
];

function DevicePanel() {
  const bridge = typeof window !== "undefined" ? window.aiankur : null;
  const models = listModels();

  const [devices, setDevices] = useState(mockDevices);
  const [selectedDeviceId, setSelectedDeviceId] = useState(mockDevices[0].id);

  const [authCode, setAuthCode] = useState("");
  const [authStatus, setAuthStatus] = useState("Enter your passcode, then click Check.");
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpStatus, setOtpStatus] = useState("No one-time code requested yet.");

  const [commandCode, setCommandCode] = useState("");
  const [commandText, setCommandText] = useState("Get-Date");
  const [commandResult, setCommandResult] = useState("No task has been run yet.");
  const [isCommandRunning, setIsCommandRunning] = useState(false);

  const [selectedModel, setSelectedModel] = useState(models[0]?.id || "");
  const [codexRoute, setCodexRoute] = useState(getCodexRoutePolicy());
  const [codexApiKeyDraft, setCodexApiKeyDraft] = useState("");
  const [hasOpenAIKey, setHasOpenAIKey] = useState(hasOpenAIKeyConfigured());
  const [codexConfigStatus, setCodexConfigStatus] = useState(
    "GPT-5.3-Codex is set to local free mode by default."
  );
  const [modelPrompt, setModelPrompt] = useState(
    "Help me plan my next app step in simple words."
  );
  const [modelResponse, setModelResponse] = useState("AI response will appear here.");
  const [isModelLoading, setIsModelLoading] = useState(false);

  const [targetPlatform, setTargetPlatform] = useState(platformTargets[0]);
  const [projectName, setProjectName] = useState("aiankur-generated-app");
  const [codeDepthMode, setCodeDepthMode] = useState("extreme");
  const [projectGoal, setProjectGoal] = useState(
    "Create a complete app with login, dashboard, reports, and smooth user flow."
  );
  const [projectBlueprint, setProjectBlueprint] = useState(
    "Your app plan will appear here after generation."
  );
  const [scaffoldStatus, setScaffoldStatus] = useState("Starter files are not created yet.");
  const [scaffoldPath, setScaffoldPath] = useState("");

  const [workspacePath, setWorkspacePath] = useState(
    "C:\\Users\\mishr\\OneDrive\\Documents\\GitHub\\AIANKUR"
  );
  const [workspaceStatus, setWorkspaceStatus] = useState("Project status not loaded yet.");
  const [workspaceBranch, setWorkspaceBranch] = useState("(unknown)");
  const [workspaceChanges, setWorkspaceChanges] = useState("(unknown)");
  const [workspaceCommits, setWorkspaceCommits] = useState("(unknown)");

  const [extensions, setExtensions] = useState([]);
  const [extensionsStatus, setExtensionsStatus] = useState("Loading add-ons...");
  const [systemMeta, setSystemMeta] = useState(null);
  const [isStartupEnabled, setIsStartupEnabled] = useState(false);
  const [startupStatus, setStartupStatus] = useState("Startup setting not loaded yet.");
  const [updateStatus, setUpdateStatus] = useState("Update check is idle.");
  const [activeSection, setActiveSection] = useState("ai");

  const [connectedDevices, setConnectedDevices] = useState([]);
  const [deviceAccessStatus, setDeviceAccessStatus] = useState(
    "Find connected devices to begin owner-approved access."
  );
  const [selectedConnectedDevice, setSelectedConnectedDevice] = useState("");
  const [ownerName, setOwnerName] = useState("Device Owner");
  const [consentDurationMinutes, setConsentDurationMinutes] = useState("120");
  const [accessProfile, setAccessProfile] = useState("developer");
  const [persistentAccess, setPersistentAccess] = useState(true);
  const [consentRequestId, setConsentRequestId] = useState("");
  const [consentCodeInput, setConsentCodeInput] = useState("");
  const [latestConsentCode, setLatestConsentCode] = useState("");
  const [activeConsents, setActiveConsents] = useState([]);
  const [deviceAuthCode, setDeviceAuthCode] = useState("");
  const [deviceOperation, setDeviceOperation] = useState("write-text");
  const [deviceTargetPath, setDeviceTargetPath] = useState("/sdcard/Download/aiankur-note.txt");
  const [deviceOperationContent, setDeviceOperationContent] = useState(
    "Hello from AIANKUR."
  );
  const [deviceReadOutput, setDeviceReadOutput] = useState("No device details loaded yet.");
  const [browserAuthCode, setBrowserAuthCode] = useState("");
  const [browserSourcePath, setBrowserSourcePath] = useState("/sdcard/Download");
  const [browserExportStatus, setBrowserExportStatus] = useState(
    "Browser export is idle. Owner approval is required."
  );
  const [browserSourcesOutput, setBrowserSourcesOutput] = useState("No browser sources scanned yet.");
  const [browserExportOutput, setBrowserExportOutput] = useState("No browser export output yet.");

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );

  const selectedConnected = useMemo(
    () =>
      connectedDevices.find(
        (item) => `${item.deviceType}:${item.deviceId}` === selectedConnectedDevice
      ) || null,
    [connectedDevices, selectedConnectedDevice]
  );

  useEffect(() => {
    let unsubscribe = null;

    const boot = async () => {
      if (!bridge) {
        setExtensionsStatus("You are in browser preview. Add-ons work in desktop app.");
        setSystemMeta({ appVersion: "web", platform: "browser", isPackaged: false });
        return;
      }

      try {
        const meta = await bridge.getMeta();
        setSystemMeta(meta);
        setIsStartupEnabled(Boolean(meta?.openAtLogin));
        setStartupStatus(
          meta?.openAtLogin ? "Auto-start is enabled for this machine." : "Auto-start is disabled."
        );
      } catch {
        setSystemMeta(null);
      }

      try {
        const loadedExtensions = await bridge.listExtensions();
        setExtensions(loadedExtensions);
        setExtensionsStatus(`Loaded ${loadedExtensions.length} add-on file(s).`);
      } catch (error) {
        setExtensionsStatus(`Could not load add-ons: ${error.message}`);
      }

      try {
        const consentResult = await bridge.listDeviceConsents?.();
        if (consentResult?.ok) {
          setActiveConsents(consentResult.consents || []);
        }
      } catch {
        // Optional load; ignore if unavailable.
      }

      if (bridge.onUpdateStatus) {
        unsubscribe = bridge.onUpdateStatus((payload) => {
          if (payload?.message) {
            setUpdateStatus(payload.message);
          }
        });
      }
    };

    boot();
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [bridge]);

  useEffect(() => {
    if (!selectedConnected) {
      return;
    }
    if (selectedConnected.deviceType === "android") {
      setDeviceTargetPath("/sdcard/Download/aiankur-note.txt");
      return;
    }
    setDeviceTargetPath("C:\\Users\\Public\\Documents\\aiankur-note.txt");
  }, [selectedConnected]);

  const refreshDeviceStatus = () => {
    if (!selectedDevice) {
      return;
    }
    setDevices((previous) =>
      previous.map((device) =>
        device.id === selectedDevice.id
          ? { ...device, info: `${device.info} | refreshed ${new Date().toLocaleTimeString()}` }
          : device
      )
    );
  };

  const disconnectDevice = () => {
    if (!selectedDevice) {
      return;
    }
    setDevices((previous) =>
      previous.map((device) =>
        device.id === selectedDevice.id ? { ...device, status: "Disconnected" } : device
      )
    );
  };

  const runAuthCheck = async () => {
    const result = await authenticate(authCode);
    setAuthStatus(result.message);
  };

  const requestOtp = async () => {
    const result = await sendOtp();
    setOtpStatus(result.message);
  };

  const updateSecretCode = async () => {
    if (!currentCode || !newCode || !otpInput) {
      setOtpStatus("Enter current passcode, new passcode, and one-time code.");
      return;
    }
    const result = await changeSecretCode(currentCode, newCode, otpInput);
    setOtpStatus(result.message);
  };

  const runSecureCommand = async () => {
    if (!commandText.trim()) {
      setCommandResult("Task instruction is empty.");
      return;
    }

    setIsCommandRunning(true);
    if (bridge?.runCommand) {
      const result = await bridge.runCommand({ code: commandCode, command: commandText });
      const statusLine = `Status: ${result.ok ? "Completed" : "Failed"} | Code: ${result.code === null ? "n/a" : result.code}`;
      const output = `${statusLine}\n\nOutput:\n${result.stdout || "(empty)"}\n\nErrors:\n${result.stderr || "(none)"}`;
      setCommandResult(output);
    } else {
      setCommandResult("This action works in the installed desktop app.");
    }
    setIsCommandRunning(false);
  };

  const runModelQuery = async () => {
    if (!modelPrompt.trim()) {
      setModelResponse("Prompt is empty.");
      return;
    }

    setIsModelLoading(true);
    const selectedInfo = selectedDevice
      ? ` Selected device: ${selectedDevice.name} (${selectedDevice.status}).`
      : "";
    const response = await queryModel(selectedModel, `${modelPrompt}${selectedInfo}`);
    setModelResponse(response);
    setIsModelLoading(false);
  };

  const applyCodexRoute = (nextRoute) => {
    const result = setCodexRoutePolicy(nextRoute);
    if (result.ok) {
      setCodexRoute(nextRoute);
      setCodexConfigStatus(result.message);
      return;
    }
    setCodexConfigStatus(result.message);
  };

  const saveCodexKey = () => {
    const result = saveOpenAIApiKey(codexApiKeyDraft);
    if (result.ok) {
      setHasOpenAIKey(true);
      setCodexApiKeyDraft("");
    }
    setCodexConfigStatus(result.message);
  };

  const clearCodexKey = () => {
    const result = clearOpenAIApiKey();
    if (result.ok) {
      setHasOpenAIKey(false);
      if (codexRoute !== "local") {
        applyCodexRoute("local");
      }
    }
    setCodexConfigStatus(result.message);
  };

  const generateBlueprint = async () => {
    const depthInstruction =
      codeDepthMode === "extreme"
        ? "Generate an extreme-depth blueprint with scalable architecture, advanced error handling, modular code boundaries, strong test strategy, CI/CD gates, security checks, and performance targets."
        : "Generate a practical blueprint suitable for fast implementation.";

    const prompt = [
      `Create an advanced implementation blueprint for target ${targetPlatform}.`,
      `Goal: ${projectGoal}.`,
      depthInstruction,
      "Include architecture, folder structure, API contracts, CI/CD, testing strategy, and rollout plan."
    ].join(" ");

    const response = await queryModel(selectedModel, prompt);
    setProjectBlueprint(response);
  };

  const createStarterScaffold = async () => {
    if (!bridge?.createScaffold) {
      setScaffoldStatus("Starter file generation works in the installed desktop app.");
      return;
    }
    const result = await bridge.createScaffold({
      projectName: projectName || "aiankur-generated-app",
      target: targetPlatform,
      codeDepthMode
    });
    if (result?.ok) {
      setScaffoldPath(result.rootPath || "");
      setScaffoldStatus(`${result.message} | Files created: ${result.fileCount}`);
      return;
    }
    setScaffoldStatus(result?.message || "Starter file generation failed.");
  };

  const openScaffoldFolder = async () => {
    if (!scaffoldPath) {
      setScaffoldStatus("No starter folder path is available yet.");
      return;
    }
    if (!bridge?.openPath) {
      setScaffoldStatus("This action works in the installed desktop app.");
      return;
    }
    const result = await bridge.openPath(scaffoldPath);
    setScaffoldStatus(result.message);
  };

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

  const menuItems = [
    { id: "ai", label: "Ask AI" },
    { id: "build", label: "Build New App" },
    { id: "command", label: "Run PC Task" },
    { id: "security", label: "Passcode & Lock" },
    { id: "devices", label: "Phone & PC Access" },
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
              <h2>Phone & PC Access</h2>
              <p>Control connected devices only after owner approval.</p>
            </div>
          </header>

          <h3 className="sub-heading">Devices In This App</h3>
          <ul className="device-list">
            {devices.map((device) => (
              <li
                key={device.id}
                className={selectedDeviceId === device.id ? "device-item active" : "device-item"}
                onClick={() => setSelectedDeviceId(device.id)}
              >
                <strong>{device.name}</strong>
                <span>{device.type}</span>
                <em className={device.status === "Connected" ? "status-ok" : "status-bad"}>
                  {device.status}
                </em>
              </li>
            ))}
          </ul>

          {selectedDevice ? (
            <div className="device-detail">
              <p><strong>Name:</strong> {selectedDevice.name}</p>
              <p><strong>Type:</strong> {selectedDevice.type}</p>
              <p><strong>Status:</strong> {selectedDevice.status}</p>
              <p><strong>Details:</strong> {selectedDevice.info}</p>
              <div className="inline-buttons">
                <button className="btn btn-neutral" onClick={refreshDeviceStatus}>
                  Refresh
                </button>
                <button className="btn btn-danger" onClick={disconnectDevice}>
                  Disconnect
                </button>
              </div>
            </div>
          ) : null}

          <div className="divider" />

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
        </article>
      ) : null}

      {activeSection === "workspace" ? (
        <article className="panel">
          <header className="panel-header">
            <div>
              <h2>Project Snapshot</h2>
              <p>See project status, changed files, and recent progress.</p>
            </div>
            <button className="btn btn-neutral" onClick={loadWorkspaceStatus}>
              Refresh Project Status
            </button>
          </header>

          <label className="field-label">Project Folder Path</label>
          <input
            className="field-input"
            value={workspacePath}
            onChange={(event) => setWorkspacePath(event.target.value)}
            placeholder="C:\\path\\to\\repo"
          />
          <small>{workspaceStatus}</small>
          <label className="field-label">Current Project Track</label>
          <div className="output-box">{workspaceBranch}</div>
          <label className="field-label">Changed Files</label>
          <div className="output-box">{workspaceChanges}</div>
          <label className="field-label">Recent Saved Milestones</label>
          <div className="output-box">{workspaceCommits}</div>
        </article>
      ) : null}

      {activeSection === "updates" ? (
        <article className="panel">
          <header className="panel-header">
            <div>
              <h2>App Care</h2>
              <p>Check updates, startup settings, and add-ons.</p>
            </div>
            <button className="btn btn-neutral" onClick={checkUpdates}>
              Check For Updates
            </button>
          </header>

          <div className="meta-strip">
            <span>
              Version: <strong>{systemMeta?.appVersion || "n/a"}</strong>
            </span>
            <span>
              Platform: <strong>{systemMeta?.platform || "n/a"}</strong>
            </span>
            <span>
              Packaged: <strong>{systemMeta?.isPackaged ? "yes" : "no"}</strong>
            </span>
            <span>
              Auto-start: <strong>{isStartupEnabled ? "enabled" : "disabled"}</strong>
            </span>
          </div>
          <small>{updateStatus}</small>
          <small>{startupStatus}</small>

          <div className="inline-buttons">
            <button className="btn btn-accent" onClick={openExtensionsDirectory}>
              Open Add-Ons Folder
            </button>
            <button className="btn btn-neutral" onClick={toggleStartupMode}>
              {isStartupEnabled ? "Turn Off Start With PC" : "Turn On Start With PC"}
            </button>
            <button
              className="btn btn-neutral"
              onClick={() =>
                bridge
                  ?.listExtensions?.()
                  .then((items) => {
                    setExtensions(items);
                    setExtensionsStatus(`Loaded ${items.length} add-on file(s).`);
                  })
                  .catch((error) => setExtensionsStatus(error.message))
              }
            >
              Reload Add-Ons
            </button>
          </div>

          <small>{extensionsStatus}</small>
          <ul className="extension-list">
            {extensions.map((extension) => (
              <li key={`${extension.source}:${extension.id}`}>
                <strong>{extension.name}</strong> <span>v{extension.version}</span>
                <p>{extension.description || "No description provided."}</p>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}

export default DevicePanel;
