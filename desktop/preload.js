const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aiankur", {
  getMeta: () => ipcRenderer.invoke("system:get-meta"),
  getStartup: () => ipcRenderer.invoke("startup:get"),
  setStartup: (enabled) => ipcRenderer.invoke("startup:set", enabled),
  validateCode: (code) => ipcRenderer.invoke("auth:validate", code),
  changeCode: (payload) => ipcRenderer.invoke("auth:change", payload),
  runCommand: (payload) => ipcRenderer.invoke("command:run", payload),
  listConnectedDevices: () => ipcRenderer.invoke("device:list-connected"),
  requestDeviceConsent: (payload) => ipcRenderer.invoke("device:request-consent", payload),
  confirmDeviceConsent: (payload) => ipcRenderer.invoke("device:confirm-consent", payload),
  listDeviceConsents: () => ipcRenderer.invoke("device:list-consents"),
  revokeDeviceConsent: (payload) => ipcRenderer.invoke("device:revoke-consent", payload),
  getAndroidDeviceInfo: (payload) => ipcRenderer.invoke("device:android-info", payload),
  listAndroidFiles: (payload) => ipcRenderer.invoke("device:android-list-files", payload),
  getWindowsDeviceInfo: (payload) => ipcRenderer.invoke("device:windows-info", payload),
  applyWindowsDeviceChange: (payload) => ipcRenderer.invoke("device:windows-apply-change", payload),
  applyAndroidDeviceChange: (payload) => ipcRenderer.invoke("device:android-apply-change", payload),
  listBrowserSources: (payload) => ipcRenderer.invoke("browser:list-sources", payload),
  exportBrowserData: (payload) => ipcRenderer.invoke("browser:export", payload),
  listBackupJobs: (payload) => ipcRenderer.invoke("backup:list-jobs", payload),
  createBackupJob: (payload) => ipcRenderer.invoke("backup:create-job", payload),
  setBackupJobEnabled: (payload) => ipcRenderer.invoke("backup:set-enabled", payload),
  runBackupJobNow: (payload) => ipcRenderer.invoke("backup:run-now", payload),
  removeBackupJob: (payload) => ipcRenderer.invoke("backup:remove-job", payload),
  createScaffold: (payload) => ipcRenderer.invoke("project:create-scaffold", payload),
  getWorkspaceGitStatus: (payload) => ipcRenderer.invoke("workspace:get-git-status", payload),
  listExtensions: () => ipcRenderer.invoke("extensions:list"),
  getExtensionsUserDir: () => ipcRenderer.invoke("extensions:get-user-dir"),
  openPath: (targetPath) => ipcRenderer.invoke("system:open-path", targetPath),
  checkUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update:status", listener);
    return () => ipcRenderer.removeListener("update:status", listener);
  }
});
