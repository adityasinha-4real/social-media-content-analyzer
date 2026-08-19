import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function Dropzone({ onFilesSelected, disabled = false }: DropzoneProps) {
  const [isHovering, setIsHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!disabled) setIsHovering(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsHovering(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsHovering(false);
      if (disabled) return;

      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length > 0) onFilesSelected(files);
    },
    [disabled, onFilesSelected],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length > 0) onFilesSelected(files);
      event.target.value = '';
    },
    [onFilesSelected],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPicker();
      }
    },
    [openPicker],
  );

  const classNames = [
    'dropzone',
    isHovering && 'dropzone--hover',
    disabled && 'dropzone--disabled',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p className="dropzone__title">Drop a PDF or image here</p>
      <p className="dropzone__hint">or click to browse &mdash; PDF, PNG, JPEG, WebP, BMP, or TIFF, up to 15 MB</p>
      <input
        ref={inputRef}
        className="dropzone__input"
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.tif,application/pdf,image/*"
        onChange={handleInputChange}
        tabIndex={-1}
      />
    </div>
  );
}
