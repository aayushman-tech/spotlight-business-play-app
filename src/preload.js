// preload.js - tiny, explicit bridge. Exposes only what the renderer needs; nothing else.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("boardroom", {
  appInfo: () => ipcRenderer.invoke("app:info"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  refreshStories: (opts) => ipcRenderer.invoke("stories:refresh", opts || {}),
  loadStory: (storyId) => ipcRenderer.invoke("story:load", storyId),
  loadProfile: () => ipcRenderer.invoke("profile:load"),
  saveProfile: (profile) => ipcRenderer.invoke("profile:save", profile),
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
});
