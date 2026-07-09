import React, { useRef } from 'react';
import { ProjectFileInput } from '../api';

type Props = {
  files: ProjectFileInput[];
  onFiles: (files: ProjectFileInput[]) => void;
  onSubmit: () => void;
  loading?: boolean;
};

const SOURCE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

function filePath(file: File) {
  return (file as any).webkitRelativePath || file.name;
}

function isSourceFile(file: File) {
  const name = file.name.toLowerCase();
  return SOURCE_EXTENSIONS.some(ext => name.endsWith(ext));
}

export default function ProjectFiles({ files, onFiles, onSubmit, loading }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(selected: FileList | null) {
    const next = await Promise.all(
      Array.from(selected || [])
        .filter(isSourceFile)
        .map(async file => ({
          path: filePath(file),
          code: await file.text(),
        }))
    );
    onFiles(next);
  }

  return (
    <div className="card flex flex-col" style={{ height: 420 }}>
      <div className="card-header">
        <h3>Project Files</h3>
        <div className="inline-flex items-center gap-2">
          <button className="secondary" onClick={() => inputRef.current?.click()} disabled={loading}>
            Choose files
          </button>
          <button className="primary" onClick={onSubmit} disabled={loading || files.length === 0}>
            {loading ? 'Analyzing...' : 'Analyze project'}
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        multiple
        accept={SOURCE_EXTENSIONS.join(',')}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <div className="file-list flex-1">
        {files.map(file => (
          <div key={file.path} className="file-row">
            <span className="font-mono">{file.path}</span>
            <span>{file.code.length.toLocaleString()} chars</span>
          </div>
        ))}
        {files.length === 0 && (
          <div className="empty-state">Select JavaScript or TypeScript files to analyze module dependencies.</div>
        )}
      </div>
      <div className="hint">Backend: POST application/json to /swc-app/project</div>
    </div>
  );
}
