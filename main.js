const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_SECRET_CODE = "621956";
const COMMAND_TIMEOUT_MS = 30_000;
const DEFAULT_OPEN_AT_LOGIN = true;

let mainWindow = null;

function getAuthFilePath() {
  return path.join(app.getPath("userData"), "auth-store.json");
}

function getSettingsFilePath() {
  return path.join(app.getPath("userData"), "app-settings.json");
}

function getUserExtensionsDir() {
  return path.join(app.getPath("userData"), "extensions");
}

function getBundledExtensionsDir() {
  return path.join(app.getAppPath(), "extensions");
}

function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function hashCode(secretCode, salt) {
  return crypto.pbkdf2Sync(secretCode, salt, 150_000, 64, "sha512").toString("hex");
}

function isNumericCode(code) {
  return typeof code === "string" && /^[0-9]{4,12}$/.test(code);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function ensureAuthStore() {
  const authFilePath = getAuthFilePath();
  const current = readJson(authFilePath);
  if (current && current.salt && current.hash) {
    return current;
  }

  const salt = generateSalt();
  const hash = hashCode(DEFAULT_SECRET_CODE, salt);
  const seed = { salt, hash, updatedAt: new Date().toISOString() };
  writeJson(authFilePath, seed);
  return seed;
}

function ensureSettingsStore() {
  const settingsFilePath = getSettingsFilePath();
  const current = readJson(settingsFilePath) || {};
  const next = {
    openAtLogin:
      typeof current.openAtLogin === "boolean" ? current.openAtLogin : DEFAULT_OPEN_AT_LOGIN,
    updatedAt: current.updatedAt || new Date().toISOString()
  };
  writeJson(settingsFilePath, next);
  return next;
}

function applyStartupSetting(openAtLogin) {
  if (process.platform !== "win32" && process.platform !== "darwin") {
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: Boolean(openAtLogin),
    path: process.execPath,
    args: app.isPackaged ? ["--launch-at-login"] : []
  });
}

function getStartupState() {
  const persisted = ensureSettingsStore();
  const runtime = app.getLoginItemSettings();
  return {
    openAtLogin:
      typeof runtime.openAtLogin === "boolean" ? runtime.openAtLogin : persisted.openAtLogin
  };
}

function validateSecretCode(inputCode) {
  if (!isNumericCode(inputCode)) {
    return false;
  }

  const authState = ensureAuthStore();
  const inputHash = hashCode(inputCode, authState.salt);
  return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(authState.hash));
}

function changeSecretCode(currentCode, newCode) {
  if (!validateSecretCode(currentCode)) {
    return { ok: false, message: "Current code is invalid." };
  }
  if (!isNumericCode(newCode)) {
    return { ok: false, message: "New code must be numeric and 4-12 digits." };
  }

  const salt = generateSalt();
  const hash = hashCode(newCode, salt);
  writeJson(getAuthFilePath(), { salt, hash, updatedAt: new Date().toISOString() });
  return { ok: true, message: "Secret code updated." };
}

function runPowerShellCommand(commandText) {
  return new Promise((resolve) => {
    const ps = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", commandText],
      { windowsHide: true }
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      ps.kill("SIGTERM");
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr: `${stderr}\nCommand timed out after ${COMMAND_TIMEOUT_MS / 1000} seconds.`
      });
    }, COMMAND_TIMEOUT_MS);

    ps.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ps.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ps.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({ ok: false, code: null, stdout, stderr: error.message });
    });

    ps.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function ensureExtensionsDirs() {
  fs.mkdirSync(getUserExtensionsDir(), { recursive: true });
}

function readExtensionsFromDir(dirPath, sourceName) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((fileName) => fileName.toLowerCase().endsWith(".json"))
    .map((fileName) => {
      const fullPath = path.join(dirPath, fileName);
      const parsed = readJson(fullPath);
      if (!parsed) {
        return null;
      }

      return {
        id: parsed.id || path.basename(fileName, ".json"),
        name: parsed.name || path.basename(fileName, ".json"),
        version: parsed.version || "0.0.0",
        description: parsed.description || "",
        source: sourceName,
        path: fullPath
      };
    })
    .filter(Boolean);
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0b1420",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const productionHtml = path.join(__dirname, "..", "AIANKUR", "dist", "index.html");
  if (!app.isPackaged) {
    const devUrl = "http://localhost:5173";
    mainWindow
      .loadURL(devUrl)
      .catch(() => mainWindow.loadFile(productionHtml))
      .catch(() => {});
  } else {
    mainWindow.loadFile(productionHtml);
  }
}

function registerIpcHandlers() {
  ipcMain.handle("system:get-meta", () => ({
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    platform: process.platform,
    ...getStartupState()
  }));

  ipcMain.handle("startup:get", () => ({
    ok: true,
    ...getStartupState()
  }));

  ipcMain.handle("startup:set", (_event, enabled) => {
    if (typeof enabled !== "boolean") {
      return { ok: false, message: "Startup flag must be boolean." };
    }

    const next = {
      ...ensureSettingsStore(),
      openAtLogin: enabled,
      updatedAt: new Date().toISOString()
    };
    writeJson(getSettingsFilePath(), next);
    applyStartupSetting(enabled);
    return {
      ok: true,
      message: enabled ? "Auto-start enabled." : "Auto-start disabled.",
      openAtLogin: enabled
    };
  });

  ipcMain.handle("auth:validate", (_event, inputCode) => {
    const ok = validateSecretCode(inputCode);
    return {
      ok,
      message: ok ? "Authentication successful." : "Authentication failed."
    };
  });

  ipcMain.handle("auth:change", (_event, payload) => {
    const currentCode = payload?.currentCode || "";
    const newCode = payload?.newCode || "";
    return changeSecretCode(currentCode, newCode);
  });

  ipcMain.handle("command:run", async (_event, payload) => {
    const code = payload?.code || "";
    const command = payload?.command || "";

    if (!validateSecretCode(code)) {
      return {
        ok: false,
        code: null,
        stdout: "",
        stderr: "Authentication failed. Command blocked."
      };
    }

    if (typeof command !== "string" || !command.trim()) {
      return {
        ok: false,
        code: null,
        stdout: "",
        stderr: "Command is empty."
      };
    }

    return runPowerShellCommand(command);
  });

  ipcMain.handle("extensions:list", () => {
    ensureExtensionsDirs();
    const bundled = readExtensionsFromDir(getBundledExtensionsDir(), "bundled");
    const user = readExtensionsFromDir(getUserExtensionsDir(), "user");
    return [...bundled, ...user];
  });

  ipcMain.handle("extensions:get-user-dir", () => {
    ensureExtensionsDirs();
    return getUserExtensionsDir();
  });

  ipcMain.handle("system:open-path", async (_event, targetPath) => {
    if (typeof targetPath !== "string" || !targetPath.trim()) {
      return { ok: false, message: "Path is empty." };
    }
    const result = await shell.openPath(targetPath);
    return { ok: result === "", message: result || "Opened path." };
  });

  ipcMain.handle("update:check", async () => {
    try {
      const updateResult = await autoUpdater.checkForUpdates();
      return {
        ok: true,
        message: updateResult?.updateInfo
          ? `Update channel checked. Current version ${app.getVersion()}.`
          : "No update information returned."
      };
    } catch (error) {
      return {
        ok: false,
        message:
          `Update check failed: ${error.message}. ` +
          "Configure publish settings in electron-builder to enable full auto-update."
      };
    }
  });
}

function wireAutoUpdaterEvents() {
  autoUpdater.autoDownload = false;

  autoUpdater.on("checking-for-update", () => {
    sendToRenderer("update:status", { level: "info", message: "Checking for updates..." });
  });

  autoUpdater.on("update-available", (info) => {
    sendToRenderer("update:status", {
      level: "info",
      message: `Update available: ${info?.version || "unknown version"}`
    });
  });

  autoUpdater.on("update-not-available", () => {
    sendToRenderer("update:status", { level: "info", message: "No updates available." });
  });

  autoUpdater.on("error", (error) => {
    sendToRenderer("update:status", {
      level: "error",
      message: `Updater error: ${error.message}`
    });
  });
}

app.whenReady().then(() => {
  ensureAuthStore();
  const settings = ensureSettingsStore();
  applyStartupSetting(settings.openAtLogin);
  ensureExtensionsDirs();
  registerIpcHandlers();
  wireAutoUpdaterEvents();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
