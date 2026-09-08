import React, { useState } from 'react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (projectId: string, scriptId: string, analysisId?: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const [title, setTitle] = useState('');
  const [studio, setStudio] = useState('Universal Pictures');
  const [file, setFile] = useState<File | null>(null);
  const [scriptText, setScriptText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!title) {
        // Strip extension for default title
        setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUploadAndAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a project title.');
      return;
    }
    if (!file && !scriptText.trim()) {
      setError('Please select a script file (.fountain, .pdf, .txt) or paste screenplay text.');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setStatusMessage('Ingesting screenplay and extracting structural scenes...');

      const formData = new FormData();
      formData.append('title', title.trim());

      if (file) {
        formData.append('script', file);
      } else {
        const textBlob = new Blob([scriptText], { type: 'text/plain' });
        formData.append('script', textBlob, `${title.trim().toLowerCase().replace(/\s+/g, '_')}.fountain`);
      }

      // Step 1: Upload and parse script
      const uploadRes = await fetch('/api/scripts/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json();
        throw new Error(errJson.error?.message || 'Failed to upload script.');
      }

      const uploadData = await uploadRes.json();
      const scriptId = uploadData.scriptId;
      const projectId = uploadData.projectId;

      setStatusMessage('Initiating Gemini 3.6 Flash Multi-Agent Forensics Pipeline...');

      // Step 2: Start automated clearance analysis
      let analysisId = '';
      try {
        const analysisRes = await fetch('/api/analysis/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scriptId,
            projectId,
            priority: 'high',
            agents: ['script_analyzer', 'clearance_officer', 'legal_precedent'],
          }),
        });

        if (analysisRes.ok) {
          const analysisData = await analysisRes.json();
          analysisId = analysisData.analysisId;
        }
      } catch (analysisErr) {
        console.warn('Could not auto-start analysis:', analysisErr);
      }

      setStatusMessage('Ingestion complete! Loading forensics dashboard...');
      setTimeout(() => {
        setIsUploading(false);
        onProjectCreated(projectId, scriptId, analysisId);
        onClose();
      }, 700);
    } catch (err) {
      setIsUploading(false);
      setError(err instanceof Error ? err.message : 'An error occurred during ingestion.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-surface border border-outline-variant no-radius relative overflow-hidden shadow-2xl">
        {/* Forensic Scanner bar at top */}
        <div className="h-1 w-full bg-surface-container-high relative overflow-hidden">
          {isUploading && <div className="scanner-bar" />}
        </div>

        {/* Modal Header */}
        <div className="p-6 border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl">
              upload_file
            </span>
            <div>
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
                Ingest New Screenplay
              </h3>
              <p className="font-body-md text-xs text-on-surface-variant">
                Initiate multi-agent IP pre-screening and forensic risk evaluation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-on-surface-variant hover:text-on-surface p-1 no-radius cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleUploadAndAnalyze} className="p-6 space-y-4">
          {error && (
            <div className="bg-error-container text-on-error-container p-3 no-radius font-body-md text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-label-caps text-label-caps text-on-surface mb-1">
              Project Title *
            </label>
            <input
              type="text"
              required
              disabled={isUploading}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. OMEGA PROTOCOL, NEON HORIZON"
              className="w-full bg-surface-container-high border border-outline-variant text-on-surface font-body-md px-3 py-2 no-radius focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-label-caps text-label-caps text-on-surface mb-1">
              Studio / Slate Division
            </label>
            <select
              disabled={isUploading}
              value={studio}
              onChange={(e) => setStudio(e.target.value)}
              className="w-full bg-surface-container-high border border-outline-variant text-on-surface font-body-md px-3 py-2 no-radius focus:border-primary focus:outline-none"
            >
              <option value="Warner Bros. Discovery">Warner Bros. Discovery</option>
              <option value="Universal Pictures">Universal Pictures</option>
              <option value="Sony Pictures">Sony Pictures</option>
              <option value="Paramount Global">Paramount Global</option>
              <option value="A24 Independent">A24 Independent</option>
              <option value="Studio Alpha Legal Division">Studio Alpha Legal Division</option>
            </select>
          </div>

          {/* File Upload Area */}
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface mb-1">
              Upload Script (.fountain, .pdf, .txt)
            </label>
            <div className="border-2 border-dashed border-outline-variant p-6 text-center bg-surface-container-lowest hover:border-primary transition-colors cursor-pointer relative">
              <input
                type="file"
                accept=".fountain,.txt,.pdf"
                disabled={isUploading}
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <span className="material-symbols-outlined text-3xl text-primary mb-2">
                cloud_upload
              </span>
              <p className="font-label-caps text-label-caps text-on-surface">
                {file ? file.name : 'DRAG SCREENPLAY FILE HERE OR CLICK TO BROWSE'}
              </p>
              <p className="font-body-md text-[11px] text-on-surface-variant mt-1">
                Supports Standard Industry Fountain, Text, or PDF format
              </p>
            </div>
          </div>

          {/* Fallback Direct Text Paste */}
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant text-[11px] mb-1">
              Or Paste Screenplay Excerpt
            </label>
            <textarea
              rows={3}
              disabled={isUploading}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="EXT. CYBER-ALLEY - NIGHT&#10;Jax checks his iSpark device..."
              className="w-full bg-surface-container-high border border-outline-variant text-on-surface font-body-md px-3 py-2 text-xs no-radius focus:border-primary focus:outline-none"
            />
          </div>

          {/* Ingestion Status Info */}
          {isUploading && (
            <div className="p-3 bg-surface-container-high border-l-2 border-primary text-xs font-body-md text-primary animate-pulse flex items-center gap-2">
              <span className="material-symbols-outlined text-sm animate-spin">
                progress_activity
              </span>
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-2 flex justify-end gap-3 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 bg-surface-container-high text-on-surface font-label-caps text-label-caps no-radius hover:bg-surface-variant cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-6 py-2 bg-primary-container text-on-primary-container font-label-caps text-label-caps no-radius font-bold hover:bg-primary transition-colors cursor-pointer flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">
                    sync
                  </span>
                  Processing...
                </>
              ) : (
                'Start Forensic Scan'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
