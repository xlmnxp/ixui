import { File, FileText, Folder, Link2 } from "lucide-react";
import type { FileEntryType } from "../api/files";

export interface FileEntryIconProps {
  type: FileEntryType | null;
  size?: number;
}

export function FileEntryIcon({ type, size = 14 }: FileEntryIconProps) {
  if (type === "directory") return <Folder size={size} className="text-amber-300" />;
  if (type === "file") return <FileText size={size} className="text-text-tertiary" />;
  if (type === "symlink") return <Link2 size={size} className="text-sky-300" />;
  return <File size={size} className="text-text-tertiary" />;
}

export function fileTypeLabel(type: FileEntryType | null): string {
  if (type === "directory") return "Directory";
  if (type === "file") return "File";
  if (type === "symlink") return "Symlink";
  return "—";
}
