// Sustituto en memoria de expo-file-system para las pruebas: lo justo para que spikeStorage corra de verdad.

const files = new Map<string, string>();
const dirs = new Set<string>();

export const resetFs = () => {
  files.clear();
  dirs.clear();
};

type Part = string | { uri: string };

function join(parts: Part[]): string {
  const [first, ...rest] = parts.map((p) => (typeof p === "string" ? p : p.uri));
  return [first.replace(/\/$/, ""), ...rest.map((p) => p.replace(/^\/|\/$/g, ""))].join("/");
}

export class Directory {
  uri: string;
  constructor(...parts: Part[]) {
    this.uri = join(parts);
  }
  get exists() {
    return dirs.has(this.uri);
  }
  create() {
    dirs.add(this.uri);
  }
}

export class File {
  uri: string;
  constructor(...parts: Part[]) {
    this.uri = join(parts);
  }
  get exists() {
    return files.has(this.uri);
  }
  create() {
    files.set(this.uri, "");
  }
  write(content: string, options?: { append?: boolean }) {
    files.set(this.uri, options?.append ? (files.get(this.uri) ?? "") + content : content);
  }
  textSync() {
    return files.get(this.uri) ?? "";
  }
  delete() {
    files.delete(this.uri);
  }
}

export const Paths = { document: new Directory("file:///doc"), cache: new Directory("file:///cache") };
