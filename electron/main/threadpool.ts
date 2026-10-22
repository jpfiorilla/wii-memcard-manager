// Imported first by main/index.ts. Node's file I/O runs on a small thread pool (4 by default); a few
// reads stuck on a cloud-synced folder (Google Drive) or a removable volume awaiting a macOS
// permission prompt can starve every other file operation and freeze the app. Give it headroom.
if (!process.env.UV_THREADPOOL_SIZE) process.env.UV_THREADPOOL_SIZE = '24'
export {}
