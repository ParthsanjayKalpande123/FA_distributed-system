class FileSystemStateMachine {
  constructor() {
    this.files = new Map();
  }

  apply(command) {
    switch (command.type) {
      case 'UPLOAD_FILE': {
        const { fileId, name, content, owner, mimeType, size } = command;
        const file = { id: fileId, name, content, owner, mimeType, size, createdAt: new Date().toISOString() };
        this.files.set(fileId, file);
        return { id: fileId, name, owner, mimeType, size, createdAt: file.createdAt };
      }
      case 'DELETE_FILE': {
        const { fileId } = command;
        if (this.files.has(fileId)) {
          this.files.delete(fileId);
          return { deleted: true, fileId };
        }
        return { deleted: false, error: 'File not found' };
      }
      case 'RENAME_FILE': {
        const { fileId, newName } = command;
        if (this.files.has(fileId)) {
          const file = this.files.get(fileId);
          file.name = newName;
          return { renamed: true, fileId, newName };
        }
        return { renamed: false, error: 'File not found' };
      }
      default:
        return null;
    }
  }

  query({ owner } = {}) {
    const result = [];
    for (const [id, file] of this.files) {
      if (owner && file.owner !== owner) continue;
      result.push({ id, name: file.name, owner: file.owner, size: file.size, mimeType: file.mimeType, createdAt: file.createdAt });
    }
    return result;
  }

  getById(id) {
    return this.files.get(id) || null;
  }

  getMetadata(id) {
    const file = this.files.get(id);
    if (!file) return null;
    return { id: file.id, name: file.name, owner: file.owner, size: file.size, mimeType: file.mimeType, createdAt: file.createdAt };
  }

  getAll() {
    const result = [];
    for (const [id, file] of this.files) {
      result.push({ id, name: file.name, owner: file.owner, size: file.size, mimeType: file.mimeType, createdAt: file.createdAt });
    }
    return result;
  }

  getStats() {
    let totalSize = 0;
    const filesByOwner = {};
    for (const [, file] of this.files) {
      totalSize += file.size || 0;
      filesByOwner[file.owner] = (filesByOwner[file.owner] || 0) + 1;
    }
    return {
      totalFiles: this.files.size,
      totalSize,
      filesByOwner
    };
  }
}

module.exports = { FileSystemStateMachine };
