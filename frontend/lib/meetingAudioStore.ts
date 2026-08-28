// 회의 녹음 원본을 이 기기의 IndexedDB에만 저장한다 (서버에는 업로드 처리 후 저장하지 않음)
const DB_NAME = "workping-meeting-audio";
const STORE_NAME = "recordings";
const DB_VERSION = 1;

export interface StoredRecording {
  id: string;
  blob: Blob;
  createdAt: string;
  durationSeconds: number;
  title?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecordingLocally(rec: StoredRecording): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listRecordingsLocally(): Promise<StoredRecording[]> {
  const db = await openDb();
  const result = await new Promise<StoredRecording[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as StoredRecording[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deleteRecordingLocally(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
