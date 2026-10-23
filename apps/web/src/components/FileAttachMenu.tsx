import { useEffect, useRef, type ChangeEvent } from "react";

interface FileAttachMenuProps {
  onUpload: (file: File) => void;
  onClose: () => void;
}

export function FileAttachMenu({ onUpload, onClose }: FileAttachMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onClose]);

  function handleFilesChosen(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (files) {
      for (const file of Array.from(files)) onUpload(file);
    }
    event.target.value = "";
  }

  return (
    <div className="file-attach-menu" ref={rootRef}>
      <div className="file-attach-menu-title">Attach a file</div>
      <button className="file-attach-upload" onClick={() => fileInputRef.current?.click()}>
        ⬆ Upload a document, photo, video, or audio file
      </button>
      <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesChosen} />
    </div>
  );
}
