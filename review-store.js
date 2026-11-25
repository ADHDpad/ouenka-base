(() => {
  "use strict";

  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("OuenkaPublicationReview", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("drafts", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function run(mode, operation) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction("drafts", mode);
        const request = operation(transaction.objectStore("drafts"));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(transaction.error || request.error);
      });
    } finally {
      db.close();
    }
  }

  async function put(draft) {
    // Read file-picker objects before opening the transaction. IndexedDB only
    // receives the bytes, so it does not need access to the original files.
    const files = {};
    for (const [name, file] of Object.entries(draft.files)) {
      if (!file) continue;
      try {
        files[name] = { bytes: await file.arrayBuffer(), type: file.type };
      } catch (error) {
        throw new Error(name + " を読み込めませんでした。ファイルを選び直してください。", { cause: error });
      }
    }
    return run("readwrite", store => store.put({ ...draft, files }));
  }

  async function all() {
    const drafts = await run("readonly", store => store.getAll());
    for (const draft of drafts) {
      for (const [name, file] of Object.entries(draft.files)) {
        // Drafts saved by older versions already contain Blob or File objects.
        if (file?.bytes instanceof ArrayBuffer) {
          draft.files[name] = new Blob([file.bytes], { type: file.type });
        }
      }
    }
    return drafts;
  }

  window.OuenkaReview = {
    all,
    put,
    count: () => run("readonly", store => store.count()),
    remove: key => run("readwrite", store => store.delete(key))
  };
})();
