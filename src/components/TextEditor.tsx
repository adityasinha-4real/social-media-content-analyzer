import { useCallback, useState } from 'react';

interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
  fileName?: string;
}

export function TextEditor({ value, onChange, fileName }: TextEditorProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = fileName ? fileName.replace(/\.[^.]+$/, '') : 'extracted-text';
    a.href = url;
    a.download = `${base}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [value, fileName]);

  return (
    <div className="text-editor">
      <div className="text-editor__header">
        <div>
          <h2>Extracted text</h2>
          <p className="text-editor__hint">Edit to fix OCR mistakes — analysis updates automatically.</p>
        </div>
        <div className="text-editor__toolbar">
          <button type="button" className="text-editor__button" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="text-editor__button" onClick={handleDownload}>
            Download .txt
          </button>
        </div>
      </div>
      <textarea
        className="text-editor__textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck
        aria-label="Extracted text, editable"
      />
    </div>
  );
}
