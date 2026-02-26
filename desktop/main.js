const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULT_SECRET_CODE = "621956";
const COMMAND_TIMEOUT_MS = 30_000;
const DEFAULT_OPEN_AT_LOGIN = false;
const SCAFFOLD_ROOT_FOLDER = "AIANKUR-Generated";
const DEVICE_ACCESS_MINUTES_DEFAULT = 120;
const DEVICE_ACCESS_MINUTES_MAX = 30 * 24 * 60;
const BACKUP_ROOT_FOLDER = "AIANKUR-Backups";
const BROWSER_EXPORT_ROOT_FOLDER = "AIANKUR-Browser-Exports";
const OWNER_REQUEST_WINDOW_MINUTES = 30;
const DEVICE_ACCESS_PROFILE_DEFAULT = "developer";
const DEVICE_ACCESS_PROFILES = Object.freeze({
  standard: ["read-device-info", "list-accessible-files"],
  developer: [
    "read-device-info",
    "list-accessible-files",
    "modify-files",
    "browser-export",
    "run-backups"
  ]
});

let mainWindow = null;
let autoUpdaterInstance = undefined;
let backupSchedulerHandle = null;

function hasElectronApp() {
  return Boolean(app && typeof app.getPath === "function");
}

function getFallbackUserDataPath() {
  return path.join(process.env.APPDATA || process.cwd(), "aiankur-desktop");
}

function getAutoUpdater() {
  if (autoUpdaterInstance !== undefined) {
    return autoUpdaterInstance;
  }

  try {
    autoUpdaterInstance = require("electron-updater").autoUpdater;
  } catch {
    autoUpdaterInstance = null;
  }

  return autoUpdaterInstance;
}

function getAuthFilePath() {
  const basePath = hasElectronApp() ? app.getPath("userData") : getFallbackUserDataPath();
  return path.join(basePath, "auth-store.json");
}

function getSettingsFilePath() {
  const basePath = hasElectronApp() ? app.getPath("userData") : getFallbackUserDataPath();
  return path.join(basePath, "app-settings.json");
}

function getDeviceAccessFilePath() {
  const basePath = hasElectronApp() ? app.getPath("userData") : getFallbackUserDataPath();
  return path.join(basePath, "device-access.json");
}

function getUserExtensionsDir() {
  const basePath = hasElectronApp() ? app.getPath("userData") : getFallbackUserDataPath();
  return path.join(basePath, "extensions");
}

function getBundledExtensionsDir() {
  if (hasElectronApp() && typeof app.getAppPath === "function") {
    return path.join(app.getAppPath(), "extensions");
  }
  return path.join(process.cwd(), "extensions");
}

function makeDeviceKey(deviceType, deviceId) {
  return `${String(deviceType || "").toLowerCase()}:${String(deviceId || "").toLowerCase()}`;
}

function hashConsentCode(consentCode) {
  return crypto.createHash("sha256").update(String(consentCode)).digest("hex");
}

function clampConsentMinutes(durationMinutes) {
  const value = Number(durationMinutes);
  if (!Number.isFinite(value)) {
    return DEVICE_ACCESS_MINUTES_DEFAULT;
  }
  return Math.max(10, Math.min(DEVICE_ACCESS_MINUTES_MAX, Math.floor(value)));
}

function parseAccessProfile(accessProfile) {
  const normalized = String(accessProfile || "").trim().toLowerCase();
  if (normalized === "standard" || normalized === "developer") {
    return normalized;
  }
  return DEVICE_ACCESS_PROFILE_DEFAULT;
}

function getScopesForAccessProfile(accessProfile) {
  const profile = parseAccessProfile(accessProfile);
  return [...(DEVICE_ACCESS_PROFILES[profile] || DEVICE_ACCESS_PROFILES[DEVICE_ACCESS_PROFILE_DEFAULT])];
}

function getGrantEffectiveScopes(grant) {
  if (!grant || !Array.isArray(grant.scopes) || grant.scopes.length === 0) {
    return getScopesForAccessProfile(DEVICE_ACCESS_PROFILE_DEFAULT);
  }

  if (!grant.accessProfile) {
    // Backward compatibility for older grants created before profile-based scopes.
    return getScopesForAccessProfile(DEVICE_ACCESS_PROFILE_DEFAULT);
  }

  return grant.scopes;
}

function grantHasScope(grant, scope) {
  const required = String(scope || "").trim();
  if (!required) {
    return true;
  }
  const scopes = getGrantEffectiveScopes(grant);
  return scopes.includes("*") || scopes.includes(required);
}

function pruneDeviceAccessState(state) {
  const nowMs = Date.now();
  const next = {
    pendingRequests: {},
    grants: {}
  };

  const pending = state?.pendingRequests || {};
  for (const [requestId, entry] of Object.entries(pending)) {
    const requestExpiry = entry?.requestExpiresAt || entry?.expiresAt;
    if (!requestExpiry || new Date(requestExpiry).getTime() > nowMs) {
      next.pendingRequests[requestId] = entry;
    }
  }

  const grants = state?.grants || {};
  for (const [grantId, entry] of Object.entries(grants)) {
    if (!entry?.expiresAt || new Date(entry.expiresAt).getTime() > nowMs) {
      next.grants[grantId] = entry;
    }
  }

  return next;
}

function ensureDeviceAccessStore() {
  const filePath = getDeviceAccessFilePath();
  const initial = {
    pendingRequests: {},
    grants: {}
  };
  const current = readJson(filePath) || initial;
  const cleaned = pruneDeviceAccessState(current);
  writeJson(filePath, cleaned);
  return cleaned;
}

function saveDeviceAccessStore(nextState) {
  const filePath = getDeviceAccessFilePath();
  writeJson(filePath, pruneDeviceAccessState(nextState));
}

function requestDeviceConsent(payload) {
  const deviceType = String(payload?.deviceType || "").toLowerCase();
  const deviceId = String(payload?.deviceId || "").trim();
  const ownerName = String(payload?.ownerName || "").trim() || "Device Owner";
  const accessProfile = parseAccessProfile(payload?.accessProfile);
  const persistentAccess = Boolean(payload?.persistentAccess);
  const scopes = getScopesForAccessProfile(accessProfile);

  if (!["android", "windows"].includes(deviceType)) {
    return { ok: false, message: "Unsupported device type." };
  }
  if (!deviceId) {
    return { ok: false, message: "Device id is required." };
  }

  const minutes = clampConsentMinutes(payload?.durationMinutes);
  const requestExpiresAt = new Date(Date.now() + OWNER_REQUEST_WINDOW_MINUTES * 60 * 1000).toISOString();
  const grantExpiresAt = persistentAccess
    ? null
    : new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const consentCode = String(crypto.randomInt(100000, 999999));
  const requestId = crypto.randomUUID();

  const state = ensureDeviceAccessStore();
  state.pendingRequests[requestId] = {
    requestId,
    deviceType,
    deviceId,
    ownerName,
    accessProfile,
    scopes,
    persistentAccess,
    codeHash: hashConsentCode(consentCode),
    createdAt: new Date().toISOString(),
    requestExpiresAt,
    grantExpiresAt,
    durationMinutes: minutes
  };
  saveDeviceAccessStore(state);

  const expiryText = grantExpiresAt || "never (until revoked)";
  return {
    ok: true,
    message: `Owner consent code generated for ${deviceType}:${deviceId}.`,
    requestId,
    consentCode,
    expiresAt: grantExpiresAt,
    expiresLabel: expiryText,
    durationMinutes: minutes,
    persistentAccess,
    accessProfile,
    scopes
  };
}

function confirmDeviceConsent(payload) {
  const requestId = String(payload?.requestId || "").trim();
  const consentCode = String(payload?.consentCode || "").trim();
  if (!requestId || !consentCode) {
    return { ok: false, message: "Request id and consent code are required." };
  }

  const state = ensureDeviceAccessStore();
  const pending = state.pendingRequests[requestId];
  if (!pending) {
    return { ok: false, message: "Consent request not found or expired." };
  }

  if (hashConsentCode(consentCode) !== pending.codeHash) {
    return { ok: false, message: "Consent code is invalid." };
  }

  const deviceKey = makeDeviceKey(pending.deviceType, pending.deviceId);
  state.grants[deviceKey] = {
    deviceType: pending.deviceType,
    deviceId: pending.deviceId,
    ownerName: pending.ownerName,
    grantedAt: new Date().toISOString(),
    expiresAt: pending.grantExpiresAt || null,
    persistentAccess: Boolean(pending.persistentAccess),
    accessProfile: parseAccessProfile(pending.accessProfile),
    scopes: Array.isArray(pending.scopes) && pending.scopes.length
      ? pending.scopes
      : getScopesForAccessProfile(DEVICE_ACCESS_PROFILE_DEFAULT)
  };
  delete state.pendingRequests[requestId];
  saveDeviceAccessStore(state);

  const expiryText = pending.grantExpiresAt || "never (until revoked)";
  return {
    ok: true,
    message: `Access granted by ${pending.ownerName} for ${pending.deviceType}:${pending.deviceId}.`,
    deviceType: pending.deviceType,
    deviceId: pending.deviceId,
    expiresAt: pending.grantExpiresAt || null,
    expiresLabel: expiryText,
    persistentAccess: Boolean(pending.persistentAccess),
    accessProfile: parseAccessProfile(pending.accessProfile),
    scopes: Array.isArray(pending.scopes) && pending.scopes.length
      ? pending.scopes
      : getScopesForAccessProfile(DEVICE_ACCESS_PROFILE_DEFAULT)
  };
}

function revokeDeviceConsent(deviceType, deviceId) {
  const key = makeDeviceKey(deviceType, deviceId);
  const state = ensureDeviceAccessStore();
  if (!state.grants[key]) {
    return { ok: false, message: "No active consent found for this device." };
  }
  delete state.grants[key];
  saveDeviceAccessStore(state);
  return { ok: true, message: `Access revoked for ${key}.` };
}

function getDeviceConsent(deviceType, deviceId) {
  const key = makeDeviceKey(deviceType, deviceId);
  const state = ensureDeviceAccessStore();
  const grant = state.grants[key];
  if (!grant) {
    return { ok: false, message: "Access denied. Owner consent is not active.", grant: null };
  }
  const effectiveGrant = {
    ...grant,
    accessProfile: parseAccessProfile(grant.accessProfile),
    scopes: getGrantEffectiveScopes(grant),
    persistentAccess: Boolean(grant.persistentAccess || !grant.expiresAt)
  };
  return { ok: true, message: "Consent active.", grant: effectiveGrant };
}

function getDeviceConsentWithScope(deviceType, deviceId, requiredScope) {
  const consent = getDeviceConsent(deviceType, deviceId);
  if (!consent.ok) {
    return consent;
  }

  if (!grantHasScope(consent.grant, requiredScope)) {
    return {
      ok: false,
      message: `Access denied. Owner granted limited scope; required scope missing: ${requiredScope}.`,
      grant: consent.grant
    };
  }
  return consent;
}

function runAdbCommand(args) {
  const result = spawnSync("adb", args, {
    encoding: "utf8",
    windowsHide: true
  });
  if (result.error) {
    return {
      ok: false,
      stdout: "",
      stderr: result.error.message
    };
  }
  return {
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim()
  };
}

function listAndroidDevices() {
  const adbResult = runAdbCommand(["devices"]);
  if (!adbResult.ok) {
    return {
      ok: false,
      devices: [],
      message: `ADB unavailable: ${adbResult.stderr || "adb command failed."}`
    };
  }

  const lines = adbResult.stdout.split(/\r?\n/).slice(1).filter(Boolean);
  const devices = lines.map((line) => {
    const [serial, status] = line.trim().split(/\s+/);
    return {
      deviceType: "android",
      deviceId: serial || "unknown",
      name: serial || "Android Device",
      status: status || "unknown",
      details: status === "device" ? "Authorized via USB debugging." : "Needs owner authorization."
    };
  });

  return {
    ok: true,
    devices,
    message: `Found ${devices.length} Android device(s).`
  };
}

function getAndroidDeviceInfo(serial) {
  const model = runAdbCommand(["-s", serial, "shell", "getprop", "ro.product.model"]);
  const brand = runAdbCommand(["-s", serial, "shell", "getprop", "ro.product.brand"]);
  const version = runAdbCommand(["-s", serial, "shell", "getprop", "ro.build.version.release"]);

  if (!model.ok) {
    return {
      ok: false,
      message: model.stderr || "Unable to query Android device info.",
      info: null
    };
  }

  return {
    ok: true,
    message: "Android device info loaded.",
    info: {
      serial,
      model: model.stdout || "(unknown)",
      brand: brand.stdout || "(unknown)",
      androidVersion: version.stdout || "(unknown)"
    }
  };
}

function listAndroidFiles(serial, remotePath) {
  const pathArg = String(remotePath || "/sdcard").trim() || "/sdcard";
  const result = runAdbCommand(["-s", serial, "shell", "ls", "-1", pathArg]);
  if (!result.ok) {
    return {
      ok: false,
      message: result.stderr || "Unable to list files on Android device.",
      files: []
    };
  }

  const files = result.stdout.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return {
    ok: true,
    message: `Loaded ${files.length} item(s) from ${pathArg}.`,
    files
  };
}

function getBrowserExportRootPath() {
  const documentsPath =
    hasElectronApp() && typeof app.getPath === "function"
      ? app.getPath("documents")
      : path.join(os.homedir(), "Documents");
  return path.join(documentsPath, BROWSER_EXPORT_ROOT_FOLDER);
}

function makeTimestampFolderName(prefix) {
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `${prefix}-${ts}`;
}

function getWindowsBrowserSources() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const roamingAppData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");

  const sources = [
    {
      browser: "Chrome",
      type: "bookmarks",
      filePath: path.join(localAppData, "Google", "Chrome", "User Data", "Default", "Bookmarks")
    },
    {
      browser: "Chrome",
      type: "history",
      filePath: path.join(localAppData, "Google", "Chrome", "User Data", "Default", "History")
    },
    {
      browser: "Edge",
      type: "bookmarks",
      filePath: path.join(localAppData, "Microsoft", "Edge", "User Data", "Default", "Bookmarks")
    },
    {
      browser: "Edge",
      type: "history",
      filePath: path.join(localAppData, "Microsoft", "Edge", "User Data", "Default", "History")
    },
    {
      browser: "Brave",
      type: "bookmarks",
      filePath: path.join(
        localAppData,
        "BraveSoftware",
        "Brave-Browser",
        "User Data",
        "Default",
        "Bookmarks"
      )
    },
    {
      browser: "Brave",
      type: "history",
      filePath: path.join(
        localAppData,
        "BraveSoftware",
        "Brave-Browser",
        "User Data",
        "Default",
        "History"
      )
    }
  ];

  const firefoxProfilesRoot = path.join(roamingAppData, "Mozilla", "Firefox", "Profiles");
  if (fs.existsSync(firefoxProfilesRoot)) {
    const profileFolders = fs
      .readdirSync(firefoxProfilesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(firefoxProfilesRoot, entry.name));

    for (const profilePath of profileFolders) {
      sources.push({
        browser: "Firefox",
        type: "history+bookmarks",
        filePath: path.join(profilePath, "places.sqlite")
      });
    }
  }

  return sources.filter((item) => fs.existsSync(item.filePath));
}

function listBrowserDataSources(payload) {
  const deviceType = String(payload?.deviceType || "").toLowerCase();
  const deviceId = String(payload?.deviceId || "").trim();

  if (!["windows", "android"].includes(deviceType) || !deviceId) {
    return { ok: false, message: "deviceType and deviceId are required.", sources: [] };
  }

  const consent = getDeviceConsentWithScope(deviceType, deviceId, "browser-export");
  if (!consent.ok) {
    return { ok: false, message: consent.message, sources: [] };
  }

  if (deviceType === "windows") {
    const expectedId = os.hostname();
    if (deviceId.toLowerCase() !== expectedId.toLowerCase()) {
      return {
        ok: false,
        message: "Only local Windows browser sources are supported in this build.",
        sources: []
      };
    }
    const sources = getWindowsBrowserSources();
    return {
      ok: true,
      message: `Found ${sources.length} browser data file(s) on Windows.`,
      sources: sources.map((item) => ({
        browser: item.browser,
        type: item.type,
        location: item.filePath
      }))
    };
  }

  const pkgResult = runAdbCommand(["-s", deviceId, "shell", "cmd", "package", "list", "packages"]);
  if (!pkgResult.ok) {
    return {
      ok: false,
      message: pkgResult.stderr || "Unable to read Android package list.",
      sources: []
    };
  }

  const known = [
    "com.android.chrome",
    "org.mozilla.firefox",
    "com.microsoft.emmx",
    "com.brave.browser",
    "com.opera.browser"
  ];
  const installed = pkgResult.stdout
    .split(/\r?\n/)
    .map((line) => line.replace(/^package:/, "").trim())
    .filter((name) => known.includes(name));

  return {
    ok: true,
    message:
      "Android browser packages listed. Only owner-exported browser files in shared storage can be pulled.",
    sources: installed.map((pkg) => ({
      browserPackage: pkg,
      type: "owner-exported-files-only",
      location: "/sdcard/Download"
    }))
  };
}

function exportWindowsBrowserData(payload) {
  const targetId = String(payload?.deviceId || os.hostname()).trim() || os.hostname();
  const authCode = String(payload?.authCode || "").trim();
  const expectedId = os.hostname();

  if (targetId.toLowerCase() !== expectedId.toLowerCase()) {
    return {
      ok: false,
      message: "Only local Windows browser export is supported in this build.",
      destinationPath: "",
      files: []
    };
  }

  const consent = getDeviceConsentWithScope("windows", targetId, "browser-export");
  if (!consent.ok) {
    return { ok: false, message: consent.message, destinationPath: "", files: [] };
  }
  if (!validateSecretCode(authCode)) {
    return {
      ok: false,
      message: "Passcode validation failed for browser export.",
      destinationPath: "",
      files: []
    };
  }

  const sources = getWindowsBrowserSources();
  if (!sources.length) {
    return {
      ok: false,
      message: "No supported Windows browser data files were found.",
      destinationPath: "",
      files: []
    };
  }

  const destinationPath = path.join(
    getBrowserExportRootPath(),
    makeTimestampFolderName(`windows-${targetId.toLowerCase()}`)
  );
  fs.mkdirSync(destinationPath, { recursive: true });

  const copied = [];
  const skipped = [];

  for (const item of sources) {
    const safeBrowser = item.browser.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const ext = path.extname(item.filePath) || "";
    const targetFileName = `${safeBrowser}-${item.type}${ext}`;
    const targetPath = path.join(destinationPath, targetFileName);
    try {
      fs.copyFileSync(item.filePath, targetPath);
      copied.push(targetPath);
    } catch (error) {
      skipped.push(`${item.browser}:${item.type} (${error.message})`);
    }
  }

  return {
    ok: copied.length > 0,
    message:
      copied.length > 0
        ? `Exported ${copied.length} browser file(s).${skipped.length ? ` Skipped ${skipped.length}.` : ""}`
        : "No browser files could be exported. Close browser apps and retry.",
    destinationPath,
    files: copied,
    skipped
  };
}

function exportAndroidBrowserData(payload) {
  const serial = String(payload?.deviceId || "").trim();
  const authCode = String(payload?.authCode || "").trim();
  const sourcePath = normalizeAndroidPath(payload?.sourcePath || "/sdcard/Download");

  if (!serial) {
    return { ok: false, message: "Android device id is required.", destinationPath: "", files: [] };
  }

  const consent = getDeviceConsentWithScope("android", serial, "browser-export");
  if (!consent.ok) {
    return { ok: false, message: consent.message, destinationPath: "", files: [] };
  }
  if (!validateSecretCode(authCode)) {
    return {
      ok: false,
      message: "Passcode validation failed for browser export.",
      destinationPath: "",
      files: []
    };
  }
  if (!isAllowedAndroidMutationPath(sourcePath)) {
    return {
      ok: false,
      message:
        "Android source path must be in shared storage (/sdcard/* or /storage/emulated/0/*).",
      destinationPath: "",
      files: []
    };
  }

  const listResult = runAdbCommand(["-s", serial, "shell", "ls", "-1", sourcePath]);
  if (!listResult.ok) {
    return {
      ok: false,
      message: listResult.stderr || "Could not list Android shared storage path.",
      destinationPath: "",
      files: []
    };
  }

  const candidateNames = listResult.stdout
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((name) =>
      /(bookmark|history|browser|export)/i.test(name) || /\.(html|json|csv|txt)$/i.test(name)
    );

  if (!candidateNames.length) {
    return {
      ok: false,
      message:
        "No owner-exported browser files found in shared storage. Export from browser app first.",
      destinationPath: "",
      files: []
    };
  }

  const destinationPath = path.join(
    getBrowserExportRootPath(),
    makeTimestampFolderName(`android-${serial.toLowerCase().replace(/[^a-z0-9-]/g, "")}`)
  );
  fs.mkdirSync(destinationPath, { recursive: true });

  const pulled = [];
  const skipped = [];
  for (const name of candidateNames) {
    const remoteFile = `${sourcePath.replace(/\/+$/, "")}/${name}`;
    const pullResult = runAdbCommand(["-s", serial, "pull", remoteFile, destinationPath]);
    if (pullResult.ok) {
      pulled.push(path.join(destinationPath, name));
    } else {
      skipped.push(`${name} (${pullResult.stderr || "pull failed"})`);
    }
  }

  return {
    ok: pulled.length > 0,
    message:
      pulled.length > 0
        ? `Pulled ${pulled.length} owner-exported browser file(s).${skipped.length ? ` Skipped ${skipped.length}.` : ""}`
        : "No files could be pulled from Android shared storage.",
    destinationPath,
    files: pulled,
    skipped
  };
}

function exportBrowserData(payload) {
  const deviceType = String(payload?.deviceType || "").toLowerCase();
  if (deviceType === "windows") {
    return exportWindowsBrowserData(payload);
  }
  if (deviceType === "android") {
    return exportAndroidBrowserData(payload);
  }
  return { ok: false, message: "Unsupported device type for browser export.", destinationPath: "", files: [] };
}

function listWindowsDevices() {
  const localDevice = {
    deviceType: "windows",
    deviceId: os.hostname(),
    name: `${os.hostname()} (This PC)`,
    status: "available",
    details: `${os.platform()} ${os.release()}`
  };
  return {
    ok: true,
    devices: [localDevice],
    message: "Local Windows device available."
  };
}

function getWindowsDeviceInfo(targetId) {
  const expectedId = os.hostname();
  const normalized = String(targetId || "").trim() || expectedId;
  if (normalized.toLowerCase() !== expectedId.toLowerCase()) {
    return {
      ok: false,
      message: "Only local Windows device info is supported in this build.",
      info: null
    };
  }

  const drivesResult = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root"
    ],
    { encoding: "utf8", windowsHide: true }
  );

  const drives =
    (drivesResult.stdout || "")
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean) || [];

  return {
    ok: true,
    message: "Windows device info loaded.",
    info: {
      host: expectedId,
      platform: `${os.platform()} ${os.release()}`,
      user: os.userInfo().username,
      memoryGB: Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10,
      drives
    }
  };
}

function isPathInside(basePath, candidatePath) {
  const resolvedBase = path.resolve(basePath);
  const resolvedCandidate = path.resolve(candidatePath);
  return (
    resolvedCandidate === resolvedBase || resolvedCandidate.startsWith(`${resolvedBase}${path.sep}`)
  );
}

function isAllowedWindowsMutationPath(targetPath) {
  if (!targetPath) {
    return false;
  }
  const userHome = process.env.USERPROFILE || os.homedir();
  const documentsPath =
    hasElectronApp() && typeof app.getPath === "function"
      ? app.getPath("documents")
      : path.join(os.homedir(), "Documents");
  const allowedBases = [userHome, documentsPath];
  return allowedBases.some((base) => isPathInside(base, targetPath));
}

function normalizeAndroidPath(remotePath) {
  return String(remotePath || "").trim().replace(/\\/g, "/");
}

function isAllowedAndroidMutationPath(remotePath) {
  const normalized = normalizeAndroidPath(remotePath);
  return normalized.startsWith("/sdcard/") || normalized.startsWith("/storage/emulated/0/");
}

function applyWindowsDeviceChange(payload) {
  const targetId = String(payload?.targetId || os.hostname()).trim() || os.hostname();
  const operation = String(payload?.operation || "").trim();
  const targetPath = String(payload?.targetPath || "").trim();
  const authCode = String(payload?.authCode || "").trim();
  const content = String(payload?.content || "");

  const consent = getDeviceConsentWithScope("windows", targetId, "modify-files");
  if (!consent.ok) {
    return { ok: false, message: consent.message };
  }
  if (!validateSecretCode(authCode)) {
    return { ok: false, message: "Secret code validation failed for write operation." };
  }
  if (!isAllowedWindowsMutationPath(targetPath)) {
    return {
      ok: false,
      message:
        "Path is outside allowed scope. Allowed scope is your user profile/Documents for safety."
    };
  }

  try {
    if (operation === "create-folder") {
      fs.mkdirSync(targetPath, { recursive: true });
      return { ok: true, message: `Folder created: ${targetPath}` };
    }
    if (operation === "write-text") {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, content, "utf8");
      return { ok: true, message: `File written: ${targetPath}` };
    }
    if (operation === "delete-path") {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return { ok: true, message: `Deleted path: ${targetPath}` };
    }
    return { ok: false, message: "Unsupported windows operation." };
  } catch (error) {
    return { ok: false, message: `Windows operation failed: ${error.message}` };
  }
}

function applyAndroidDeviceChange(payload) {
  const serial = String(payload?.serial || "").trim();
  const operation = String(payload?.operation || "").trim();
  const remotePath = normalizeAndroidPath(payload?.remotePath || "");
  const authCode = String(payload?.authCode || "").trim();
  const content = String(payload?.content || "");

  if (!serial) {
    return { ok: false, message: "Android serial is required." };
  }

  const consent = getDeviceConsentWithScope("android", serial, "modify-files");
  if (!consent.ok) {
    return { ok: false, message: consent.message };
  }
  if (!validateSecretCode(authCode)) {
    return { ok: false, message: "Secret code validation failed for write operation." };
  }
  if (!isAllowedAndroidMutationPath(remotePath)) {
    return {
      ok: false,
      message:
        "Android path is outside allowed scope. Allowed scope is /sdcard/* or /storage/emulated/0/*."
    };
  }

  if (operation === "create-folder") {
    const result = runAdbCommand(["-s", serial, "shell", "mkdir", "-p", remotePath]);
    return result.ok
      ? { ok: true, message: `Folder created on Android: ${remotePath}` }
      : { ok: false, message: result.stderr || "Android create-folder failed." };
  }

  if (operation === "delete-path") {
    const result = runAdbCommand(["-s", serial, "shell", "rm", "-rf", remotePath]);
    return result.ok
      ? { ok: true, message: `Deleted Android path: ${remotePath}` }
      : { ok: false, message: result.stderr || "Android delete-path failed." };
  }

  if (operation === "write-text") {
    const remoteDir = path.posix.dirname(remotePath);
    const makeDir = runAdbCommand(["-s", serial, "shell", "mkdir", "-p", remoteDir]);
    if (!makeDir.ok) {
      return { ok: false, message: makeDir.stderr || "Unable to create parent folder on Android." };
    }

    const tempFilePath = path.join(
      os.tmpdir(),
      `aiankur-android-write-${Date.now()}-${crypto.randomInt(1000, 9999)}.txt`
    );
    try {
      fs.writeFileSync(tempFilePath, content, "utf8");
      const push = runAdbCommand(["-s", serial, "push", tempFilePath, remotePath]);
      if (!push.ok) {
        return { ok: false, message: push.stderr || "Android write-text failed." };
      }
      return { ok: true, message: `Text file written on Android: ${remotePath}` };
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.rmSync(tempFilePath, { force: true });
      }
    }
  }

  return { ok: false, message: "Unsupported android operation." };
}

function getDefaultBackupRootPath() {
  const documentsPath =
    hasElectronApp() && typeof app.getPath === "function"
      ? app.getPath("documents")
      : path.join(os.homedir(), "Documents");
  return path.join(documentsPath, BACKUP_ROOT_FOLDER);
}

function getBackupJobsFilePath() {
  const basePath = hasElectronApp() ? app.getPath("userData") : getFallbackUserDataPath();
  return path.join(basePath, "backup-jobs.json");
}

function ensureBackupJobsStore() {
  const filePath = getBackupJobsFilePath();
  const current = readJson(filePath) || { jobs: [] };
  const jobs = Array.isArray(current.jobs) ? current.jobs : [];
  const normalized = { jobs };
  writeJson(filePath, normalized);
  return normalized;
}

function saveBackupJobsStore(store) {
  writeJson(getBackupJobsFilePath(), { jobs: Array.isArray(store.jobs) ? store.jobs : [] });
}

function sanitizeBackupLabel(label) {
  return String(label || "backup")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40) || "backup";
}

function getTimestampText() {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

function runSingleBackupJob(job) {
  const backupRoot = job.backupRoot || getDefaultBackupRootPath();
  fs.mkdirSync(backupRoot, { recursive: true });
  const jobLabel = sanitizeBackupLabel(job.label || `${job.deviceType}-${job.deviceId}`);
  const destinationPath = path.join(backupRoot, `${jobLabel}-${getTimestampText()}`);

  if (job.deviceType === "windows") {
    if (!isAllowedWindowsMutationPath(job.sourcePath)) {
      return { ok: false, message: "Backup source path is outside allowed scope." };
    }
    if (!fs.existsSync(job.sourcePath)) {
      return { ok: false, message: "Windows backup source path does not exist." };
    }

    const stat = fs.statSync(job.sourcePath);
    if (stat.isDirectory()) {
      fs.cpSync(job.sourcePath, destinationPath, { recursive: true, force: true });
      return { ok: true, message: `Windows folder backup completed: ${destinationPath}` };
    }

    fs.mkdirSync(destinationPath, { recursive: true });
    fs.copyFileSync(job.sourcePath, path.join(destinationPath, path.basename(job.sourcePath)));
    return { ok: true, message: `Windows file backup completed: ${destinationPath}` };
  }

  if (job.deviceType === "android") {
    if (!isAllowedAndroidMutationPath(job.sourcePath)) {
      return { ok: false, message: "Android backup source path is outside allowed scope." };
    }
    const consent = getDeviceConsent("android", job.deviceId);
    if (!consent.ok) {
      return { ok: false, message: consent.message };
    }

    fs.mkdirSync(destinationPath, { recursive: true });
    const pull = runAdbCommand(["-s", job.deviceId, "pull", job.sourcePath, destinationPath]);
    if (!pull.ok) {
      return {
        ok: false,
        message: pull.stderr || "Android backup failed. Ensure USB debugging authorization."
      };
    }
    return { ok: true, message: `Android backup completed: ${destinationPath}` };
  }

  return { ok: false, message: "Unsupported backup device type." };
}

function createBackupJob(payload) {
  const deviceType = String(payload?.deviceType || "").toLowerCase();
  const deviceId = String(payload?.deviceId || "").trim();
  const sourcePath = String(payload?.sourcePath || "").trim();
  const label = String(payload?.label || `${deviceType}-${deviceId}`).trim();
  const intervalMinutes = Math.max(5, Math.min(24 * 60, Number(payload?.intervalMinutes) || 60));
  const authCode = String(payload?.authCode || "").trim();
  const backupRoot = String(payload?.backupRoot || "").trim() || getDefaultBackupRootPath();

  if (!["windows", "android"].includes(deviceType) || !deviceId || !sourcePath) {
    return { ok: false, message: "deviceType, deviceId, and sourcePath are required." };
  }
  if (!validateSecretCode(authCode)) {
    return { ok: false, message: "Secret code validation failed." };
  }

  const consent = getDeviceConsent(deviceType, deviceId);
  if (!consent.ok) {
    return { ok: false, message: consent.message };
  }

  if (deviceType === "windows" && !isAllowedWindowsMutationPath(sourcePath)) {
    return {
      ok: false,
      message:
        "Windows backup path is outside allowed scope. Allowed scope is user profile/Documents."
    };
  }
  if (deviceType === "android" && !isAllowedAndroidMutationPath(sourcePath)) {
    return {
      ok: false,
      message:
        "Android backup path is outside allowed scope. Allowed scope is /sdcard/* or /storage/emulated/0/*."
    };
  }

  const store = ensureBackupJobsStore();
  const job = {
    id: crypto.randomUUID(),
    deviceType,
    deviceId,
    sourcePath,
    label,
    backupRoot,
    intervalMinutes,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunAt: null,
    lastResult: "Never run"
  };
  store.jobs.push(job);
  saveBackupJobsStore(store);

  return {
    ok: true,
    message: "Background backup job created.",
    job
  };
}

function setBackupJobEnabled(jobId, enabled) {
  const store = ensureBackupJobsStore();
  const job = store.jobs.find((item) => item.id === jobId);
  if (!job) {
    return { ok: false, message: "Backup job not found." };
  }
  job.enabled = Boolean(enabled);
  job.updatedAt = new Date().toISOString();
  saveBackupJobsStore(store);
  return {
    ok: true,
    message: job.enabled ? "Backup job enabled." : "Backup job disabled.",
    job
  };
}

function runBackupJobNow(jobId) {
  const store = ensureBackupJobsStore();
  const job = store.jobs.find((item) => item.id === jobId);
  if (!job) {
    return { ok: false, message: "Backup job not found." };
  }
  const result = runSingleBackupJob(job);
  job.lastRunAt = new Date().toISOString();
  job.lastResult = result.message;
  job.updatedAt = new Date().toISOString();
  saveBackupJobsStore(store);
  return {
    ...result,
    job
  };
}

function removeBackupJob(jobId) {
  const store = ensureBackupJobsStore();
  const nextJobs = store.jobs.filter((item) => item.id !== jobId);
  if (nextJobs.length === store.jobs.length) {
    return { ok: false, message: "Backup job not found." };
  }
  store.jobs = nextJobs;
  saveBackupJobsStore(store);
  return { ok: true, message: "Backup job removed." };
}

function startBackupScheduler() {
  if (backupSchedulerHandle) {
    clearInterval(backupSchedulerHandle);
    backupSchedulerHandle = null;
  }

  backupSchedulerHandle = setInterval(() => {
    const store = ensureBackupJobsStore();
    const now = Date.now();
    let changed = false;

    for (const job of store.jobs) {
      if (!job.enabled) {
        continue;
      }
      const lastRunMs = job.lastRunAt ? new Date(job.lastRunAt).getTime() : 0;
      const intervalMs = Math.max(5, Number(job.intervalMinutes) || 60) * 60 * 1000;
      if (now - lastRunMs < intervalMs) {
        continue;
      }

      const result = runSingleBackupJob(job);
      job.lastRunAt = new Date().toISOString();
      job.lastResult = result.message;
      job.updatedAt = new Date().toISOString();
      changed = true;
    }

    if (changed) {
      saveBackupJobsStore(store);
    }
  }, 60 * 1000);
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
  if (!hasElectronApp()) {
    return;
  }
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
  if (!hasElectronApp() || typeof app.getLoginItemSettings !== "function") {
    const persisted = ensureSettingsStore();
    return {
      openAtLogin: persisted.openAtLogin
    };
  }

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

function sanitizeProjectName(projectName) {
  if (typeof projectName !== "string") {
    return "aiankur-project";
  }
  const clean = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return clean || "aiankur-project";
}

function getScaffoldRootPath() {
  const documentsPath =
    hasElectronApp() && typeof app.getPath === "function"
      ? app.getPath("documents")
      : path.join(process.env.USERPROFILE || process.cwd(), "Documents");
  return path.join(documentsPath, SCAFFOLD_ROOT_FOLDER);
}

function writeTextFile(filePath, content, createdFiles) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  createdFiles.push(filePath);
}

function createProjectScaffold(projectName, target, codeDepthMode = "advanced") {
  const normalizedName = sanitizeProjectName(projectName);
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const rootPath = path.join(getScaffoldRootPath(), `${normalizedName}-${timestamp}`);
  const createdFiles = [];

  fs.mkdirSync(rootPath, { recursive: true });

  const nowText = new Date().toISOString();
  writeTextFile(
    path.join(rootPath, "README.md"),
    [
      `# ${projectName || normalizedName}`,
      "",
      `Target: ${target || "Cross-Platform Suite"}`,
      `Code Depth Mode: ${codeDepthMode}`,
      `Generated by AIANKUR: ${nowText}`,
      "",
      "## Next Steps",
      "1. Add source code in generated folders.",
      "2. Connect APIs and auth.",
      "3. Add CI/CD workflows.",
      "4. Use AIANKUR Command Center for secure automation."
    ].join("\n"),
    createdFiles
  );

  switch (target) {
    case "Web (Complex Sites)":
      writeTextFile(
        path.join(rootPath, "src", "index.html"),
        "<!doctype html>\n<html><head><meta charset=\"utf-8\"><title>AIANKUR Web App</title></head><body><div id=\"app\"></div><script src=\"main.js\"></script></body></html>\n",
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "src", "main.js"),
        "document.getElementById('app').textContent = 'AIANKUR generated web scaffold';\n",
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "src", "styles.css"),
        "body { font-family: Segoe UI, sans-serif; margin: 24px; }\n",
        createdFiles
      );
      break;
    case "iOS App":
      writeTextFile(
        path.join(rootPath, "mobile", "package.json"),
        JSON.stringify(
          {
            name: `${normalizedName}-mobile`,
            private: true,
            version: "0.1.0",
            scripts: {
              start: "expo start",
              ios: "expo start --ios"
            },
            dependencies: {
              expo: "^51.0.0",
              react: "^18.2.0",
              "react-native": "^0.74.0"
            }
          },
          null,
          2
        ),
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "mobile", "App.js"),
        "import { Text, View } from 'react-native';\n\nexport default function App() {\n  return (\n    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>\n      <Text>AIANKUR iOS scaffold ready.</Text>\n    </View>\n  );\n}\n",
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "ios", "README.md"),
        "iOS app scaffold created.\n1) cd mobile\n2) npm install\n3) npm run ios\n",
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "docs", "architecture-ios.md"),
        "Document modules, navigation, state management, API layer, and release profile for iOS.\n",
        createdFiles
      );
      break;
    case "Android App":
      writeTextFile(
        path.join(rootPath, "mobile", "package.json"),
        JSON.stringify(
          {
            name: `${normalizedName}-mobile`,
            private: true,
            version: "0.1.0",
            scripts: {
              start: "expo start",
              android: "expo start --android"
            },
            dependencies: {
              expo: "^51.0.0",
              react: "^18.2.0",
              "react-native": "^0.74.0"
            }
          },
          null,
          2
        ),
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "mobile", "App.js"),
        "import { Text, View } from 'react-native';\n\nexport default function App() {\n  return (\n    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>\n      <Text>AIANKUR Android scaffold ready.</Text>\n    </View>\n  );\n}\n",
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "android", "README.md"),
        "Android app scaffold created.\n1) cd mobile\n2) npm install\n3) npm run android\n",
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "docs", "architecture-android.md"),
        "Document modules, local storage, network retries, crash handling, and Play Store rollout.\n",
        createdFiles
      );
      break;
    case "macOS App":
      writeTextFile(
        path.join(rootPath, "macos", "README.md"),
        "macOS app module scaffold.\nIntegrate Electron/Tauri/Swift tooling.\n",
        createdFiles
      );
      break;
    case "Linux/Ubuntu App":
      writeTextFile(
        path.join(rootPath, "linux", "README.md"),
        "Linux/Ubuntu module scaffold.\nAdd package scripts for AppImage/Snap/Deb.\n",
        createdFiles
      );
      break;
    default:
      writeTextFile(
        path.join(rootPath, "apps", "web", "README.md"),
        "Web app workspace.\n",
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "apps", "mobile", "README.md"),
        "Mobile app workspace.\n",
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "apps", "desktop", "README.md"),
        "Desktop app workspace.\n",
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "packages", "api", "README.md"),
        "API service workspace.\n",
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "apps", "mobile", "package.json"),
        JSON.stringify(
          {
            name: `${normalizedName}-mobile`,
            private: true,
            version: "0.1.0",
            scripts: {
              start: "expo start",
              ios: "expo start --ios",
              android: "expo start --android"
            },
            dependencies: {
              expo: "^51.0.0",
              react: "^18.2.0",
              "react-native": "^0.74.0"
            }
          },
          null,
          2
        ),
        createdFiles
      );
      writeTextFile(
        path.join(rootPath, "apps", "mobile", "App.js"),
        "import { Text, View } from 'react-native';\n\nexport default function App() {\n  return (\n    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>\n      <Text>AIANKUR cross-platform mobile scaffold ready.</Text>\n    </View>\n  );\n}\n",
        createdFiles
      );
      break;
  }

  return {
    ok: true,
    rootPath,
    createdFiles
  };
}

function runGitCommand(workspacePath, args) {
  const command = spawnSync("git", ["-C", workspacePath, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
  if (command.error) {
    return {
      ok: false,
      code: null,
      stdout: "",
      stderr: command.error.message
    };
  }
  return {
    ok: command.status === 0,
    code: command.status,
    stdout: (command.stdout || "").trim(),
    stderr: (command.stderr || "").trim()
  };
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

  ipcMain.handle("device:list-connected", () => {
    const windows = listWindowsDevices();
    const android = listAndroidDevices();

    return {
      ok: true,
      message: "Connected device scan complete.",
      devices: [...windows.devices, ...android.devices],
      adbStatus: android.message
    };
  });

  ipcMain.handle("device:request-consent", (_event, payload) => requestDeviceConsent(payload));

  ipcMain.handle("device:confirm-consent", (_event, payload) => confirmDeviceConsent(payload));

  ipcMain.handle("device:list-consents", () => {
    const state = ensureDeviceAccessStore();
    const grants = Object.values(state.grants || {}).map((grant) => ({
      ...grant,
      accessProfile: parseAccessProfile(grant.accessProfile),
      scopes: getGrantEffectiveScopes(grant),
      persistentAccess: Boolean(grant.persistentAccess || !grant.expiresAt),
      expiresLabel: grant.expiresAt || "never (until revoked)"
    }));
    return {
      ok: true,
      message: "Active owner consents loaded.",
      consents: grants
    };
  });

  ipcMain.handle("device:revoke-consent", (_event, payload) => {
    const deviceType = payload?.deviceType || "";
    const deviceId = payload?.deviceId || "";
    return revokeDeviceConsent(deviceType, deviceId);
  });

  ipcMain.handle("device:android-info", (_event, payload) => {
    const serial = String(payload?.serial || "").trim();
    if (!serial) {
      return { ok: false, message: "Android serial is required.", info: null };
    }

    const consent = getDeviceConsentWithScope("android", serial, "read-device-info");
    if (!consent.ok) {
      return { ok: false, message: consent.message, info: null };
    }
    return getAndroidDeviceInfo(serial);
  });

  ipcMain.handle("device:android-list-files", (_event, payload) => {
    const serial = String(payload?.serial || "").trim();
    const remotePath = String(payload?.remotePath || "/sdcard").trim() || "/sdcard";
    if (!serial) {
      return { ok: false, message: "Android serial is required.", files: [] };
    }

    const consent = getDeviceConsentWithScope("android", serial, "list-accessible-files");
    if (!consent.ok) {
      return { ok: false, message: consent.message, files: [] };
    }
    return listAndroidFiles(serial, remotePath);
  });

  ipcMain.handle("device:windows-info", (_event, payload) => {
    const targetId = String(payload?.targetId || os.hostname()).trim() || os.hostname();
    const consent = getDeviceConsentWithScope("windows", targetId, "read-device-info");
    if (!consent.ok) {
      return { ok: false, message: consent.message, info: null };
    }
    return getWindowsDeviceInfo(targetId);
  });

  ipcMain.handle("device:windows-apply-change", (_event, payload) =>
    applyWindowsDeviceChange(payload)
  );

  ipcMain.handle("device:android-apply-change", (_event, payload) =>
    applyAndroidDeviceChange(payload)
  );

  ipcMain.handle("browser:list-sources", (_event, payload) => listBrowserDataSources(payload));

  ipcMain.handle("browser:export", (_event, payload) => exportBrowserData(payload));

  ipcMain.handle("project:create-scaffold", (_event, payload) => {
    const projectName = payload?.projectName || "AIANKUR Project";
    const target = payload?.target || "Cross-Platform Suite";
    const codeDepthMode = payload?.codeDepthMode || "advanced";
    try {
      const result = createProjectScaffold(projectName, target, codeDepthMode);
      return {
        ok: true,
        message: `Scaffold generated at ${result.rootPath}`,
        rootPath: result.rootPath,
        fileCount: result.createdFiles.length
      };
    } catch (error) {
      return {
        ok: false,
        message: `Scaffold generation failed: ${error.message}`
      };
    }
  });

  ipcMain.handle("workspace:get-git-status", (_event, payload) => {
    const workspacePath = payload?.workspacePath || "";
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return {
        ok: false,
        message: "Workspace path does not exist.",
        branch: "",
        statusShort: "",
        commits: ""
      };
    }

    const probe = runGitCommand(workspacePath, ["rev-parse", "--is-inside-work-tree"]);
    if (!probe.ok) {
      return {
        ok: false,
        message: probe.stderr || "Not a git workspace.",
        branch: "",
        statusShort: "",
        commits: ""
      };
    }

    const branch = runGitCommand(workspacePath, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const status = runGitCommand(workspacePath, ["status", "--short"]);
    const commits = runGitCommand(workspacePath, ["log", "--oneline", "-n", "5"]);

    return {
      ok: true,
      message: "Workspace status loaded.",
      branch: branch.stdout || "(unknown)",
      statusShort: status.stdout || "(clean working tree)",
      commits: commits.stdout || "(no commits)"
    };
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
    if (!app.isPackaged) {
      return {
        ok: false,
        message: "Updater checks are available in packaged builds."
      };
    }

    const autoUpdater = getAutoUpdater();
    if (!autoUpdater) {
      return {
        ok: false,
        message: "Updater module is unavailable in current runtime."
      };
    }

    try {
      const updateResult = await autoUpdater.checkForUpdates();
      return {
        ok: true,
        message: updateResult?.updateInfo
          ? `Update channel checked. Current version ${app.getVersion()}.`
          : "No update information returned."
      };
    } catch (error) {
      const errorText = String(error?.message || "");
      const isMissingGithubFeed =
        errorText.includes("/releases.atom") &&
        (errorText.includes("404") || errorText.includes("Not Found"));

      return {
        ok: false,
        message: isMissingGithubFeed
          ? "Update feed not found. Publish the app to GitHub Releases first (with latest.yml and installer assets), then retry."
          : `Update check failed: ${error.message}. Configure publish settings in electron-builder to enable full auto-update.`
      };
    }
  });
}

function wireAutoUpdaterEvents() {
  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) {
    return;
  }

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
    const errorText = String(error?.message || "");
    const isMissingGithubFeed =
      errorText.includes("/releases.atom") && (errorText.includes("404") || errorText.includes("Not Found"));

    sendToRenderer("update:status", {
      level: "error",
      message: isMissingGithubFeed
        ? "Update feed not found. Publish a GitHub release first, then check updates again."
        : `Updater error: ${error.message}`
    });
  });
}

if (hasElectronApp() && typeof app.whenReady === "function") {
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
}

module.exports = {
  __demo: {
    createProjectScaffold,
    runGitCommand,
    validateSecretCode,
    changeSecretCode,
    getScaffoldRootPath,
    listAndroidDevices,
    getWindowsDeviceInfo,
    requestDeviceConsent,
    confirmDeviceConsent,
    listBrowserDataSources,
    exportBrowserData
  }
};
