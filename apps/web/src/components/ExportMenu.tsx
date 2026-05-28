import { useState, useRef, useEffect } from "react";

interface ExportMenuProps {
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
}

export function ExportMenu({ onExportJson, onExportMarkdown, onExportHtml }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="export-menu" ref={ref}>
      <button className="btn btn-sm" onClick={() => setOpen(!open)}>
        Export
      </button>
      {open && (
        <div className="export-dropdown">
          <button onClick={() => { onExportJson(); setOpen(false); }}>
            JSON
          </button>
          <button onClick={() => { onExportMarkdown(); setOpen(false); }}>
            Markdown
          </button>
          <button onClick={() => { onExportHtml(); setOpen(false); }}>
            HTML Report
          </button>
        </div>
      )}
    </div>
  );
}
