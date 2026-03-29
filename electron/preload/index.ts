import { ipcRenderer, contextBridge } from 'electron'

type GciFolderEntry = {
  path: string
  fileName: string
  saveName: string
  alreadyOnCard: boolean
  parseError: string | null
  blockCount: number
  mtimeMs: number
}

type GciFolderScanCardStats = {
  directoryFileCount: number
  freeBlocks: number
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

contextBridge.exposeInMainWorld('memcard', {
  getUserSettings: () => ipcRenderer.invoke('memcard:getUserSettings'),
  mergeUserSettings: (partial: {
    gciFolder?: string | null
    rawPath?: string | null
    lastGciPath?: string | null
    folderWatchEnabled?: boolean
    stagingDir?: string | null
    gciBatchDebounceMs?: number
    nintendontSavesRelativePath?: string
    autoBuildRaw?: boolean
    autoCopyToSd?: boolean
    confirmBeforeSdCopy?: boolean
    requireNintendontPath?: boolean
  }) => ipcRenderer.invoke('memcard:mergeUserSettings', partial),
  pickDirectory: (defaultPath?: string | null) =>
    ipcRenderer.invoke('memcard:pickDirectory', defaultPath),
  pickFile: (filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('memcard:pickFile', filters),
  startWatch: (dir: string) => ipcRenderer.invoke('memcard:startWatch', dir),
  stopWatch: (dir: string) => ipcRenderer.invoke('memcard:stopWatch', dir),
  backupBeforeWrite: (rawPath: string) => ipcRenderer.invoke('memcard:backupBeforeWrite', rawPath),
  importGci: (rawPath: string, gciPath: string) =>
    ipcRenderer.invoke('memcard:importGci', { rawPath, gciPath }) as Promise<
      { ok: true } | { ok: false; error: string }
    >,
  scanGciFolder: (args: { rawPath: string; gciFolder: string }) =>
    ipcRenderer.invoke('memcard:scanGciFolder', args) as Promise<
      | { ok: true; entries: GciFolderEntry[]; cardStats: GciFolderScanCardStats }
      | { ok: false; error: string }
    >,
  importGcis: (rawPath: string, gciPaths: string[]) =>
    ipcRenderer.invoke('memcard:importGcis', { rawPath, gciPaths }) as Promise<
      { ok: true } | { ok: false; error: string }
    >,
  syncFolderSelection: (
    rawPath: string,
    args: { gciPathsToAdd: string[]; gciPathsToRemove: string[] },
  ) =>
    ipcRenderer.invoke('memcard:syncFolderSelection', { rawPath, ...args }) as Promise<
      { ok: true } | { ok: false; error: string }
    >,
  onFolderChanged: (callback: (data: { rootDir: string; eventKind: string; filePath: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { rootDir: string; eventKind: string; filePath: string }) =>
      callback(data)
    ipcRenderer.on('memcard:folder-changed', listener)
    return () => ipcRenderer.removeListener('memcard:folder-changed', listener)
  },
  onBatchBuilt: (
    callback: (data: { outputs: { path: string; gameCode: string }[]; errors: string[] }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { outputs: { path: string; gameCode: string }[]; errors: string[] },
    ) => callback(data)
    ipcRenderer.on('memcard:batch-built', listener)
    return () => ipcRenderer.removeListener('memcard:batch-built', listener)
  },
  onBatchBuildError: (callback: (data: { error: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { error: string }) => callback(data)
    ipcRenderer.on('memcard:batch-build-error', listener)
    return () => ipcRenderer.removeListener('memcard:batch-build-error', listener)
  },
  onVolumeMounted: (callback: (data: { mountPath: string; savesDir: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { mountPath: string; savesDir: string }) =>
      callback(data)
    ipcRenderer.on('memcard:volume-mounted', listener)
    return () => ipcRenderer.removeListener('memcard:volume-mounted', listener)
  },
  onVolumeUnmounted: (callback: (data: { mountPath: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { mountPath: string }) => callback(data)
    ipcRenderer.on('memcard:volume-unmounted', listener)
    return () => ipcRenderer.removeListener('memcard:volume-unmounted', listener)
  },
  onSdTransferDone: (callback: (data: { destPath: string; localPath: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { destPath: string; localPath: string }) =>
      callback(data)
    ipcRenderer.on('memcard:sd-transfer-done', listener)
    return () => ipcRenderer.removeListener('memcard:sd-transfer-done', listener)
  },
  onSdTransferError: (callback: (data: { error: string; localPath: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { error: string; localPath: string }) =>
      callback(data)
    ipcRenderer.on('memcard:sd-transfer-error', listener)
    return () => ipcRenderer.removeListener('memcard:sd-transfer-error', listener)
  },
})

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise(resolve => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      return parent.removeChild(child)
    }
  },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 4999)