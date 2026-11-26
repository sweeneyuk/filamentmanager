import { useRef, useState } from 'react';
import { Upload, Calculator } from 'lucide-react';
import Button from '../../ui/Button';

export default function FileDrop({ file, onFile, onAnalyse, parsing }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <div className="ca-drop-wrap">
      <div
        className={`ca-drop ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => { stop(e); setDragging(true); }}
        onDragEnter={(e) => { stop(e); setDragging(true); }}
        onDragLeave={(e) => { stop(e); setDragging(false); }}
        onDrop={(e) => { stop(e); setDragging(false); if (e.dataTransfer.files?.length) onFile(e.dataTransfer.files[0]); }}
      >
        <Upload size={28} aria-hidden="true" />
        <Button variant="outline" aria-label="Choose a .3mf file" onClick={() => inputRef.current?.click()}>
          {file ? file.name : 'Choose a .3mf file'}
        </Button>
        <span className="ui-muted">or drop it here</span>
        <input
          ref={inputRef}
          type="file"
          accept=".3mf"
          hidden
          onChange={(e) => { if (e.target.files?.length) onFile(e.target.files[0]); }}
        />
      </div>
      <Button variant="primary" icon={Calculator} busy={parsing} disabled={!file} onClick={onAnalyse}>
        {parsing ? 'Analysing…' : 'Analyse file'}
      </Button>
    </div>
  );
}
