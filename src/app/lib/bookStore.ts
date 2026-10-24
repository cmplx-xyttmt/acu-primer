// Books kept in this browser (IndexedDB), by subject id, so "Draft lessons" on a chapter made
// from a book doesn't ask for the PDF again. The book never leaves this laptop; only the cut
// pages of a section are sent when drafting. On another device, or after clearing site data,
// the draft screen asks for the file once more. Every call fails quietly to "not kept".

const DB = "acu-books", STORE = "books";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function keepBook(subjectId: string, file: File): Promise<boolean> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(file, subjectId); // a File is stored whole, name and all
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function keptBook(subjectId: string): Promise<File | null> {
  try {
    const db = await open();
    return await new Promise<File | null>((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(subjectId);
      req.onsuccess = () => resolve(req.result instanceof File ? req.result : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Forget a subject's book, when the subject is deleted. */
export async function forgetBook(subjectId: string): Promise<void> {
  try {
    const db = await open();
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(subjectId);
  } catch {
    // Nothing kept, or storage unavailable: nothing to forget.
  }
}
