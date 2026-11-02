// preload.js - tiny, explicit bridge for Spotlight Business Play.
// Exposes only what the renderer needs; nothing else.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("spotlight", {
  appInfo: () => ipcRenderer.invoke("app:info"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  refreshStories: (opts) => ipcRenderer.invoke("stories:refresh", opts || {}),
  loadStory: (storyId) => ipcRenderer.invoke("story:load", storyId),
  loadProgress: () => ipcRenderer.invoke("progress:load"),
  saveProgress: (progress) => ipcRenderer.invoke("progress:save", progress),
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
});
