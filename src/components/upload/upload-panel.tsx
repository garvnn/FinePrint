"use client";

import { useRef, useState } from "react";
import { FileText, FileUp, Lock, MapPin, TriangleAlert } from "lucide-react";
import { MAX_PDF_BYTES, MAX_PDF_PAGES } from "@/lib/pdf/load";
import { SAMPLE_A, SAMPLE_B, type SampleId } from "@/lib/fixtures/sample-leases";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onFile: (file: File) => void;
  onSample: (id: SampleId) => void;
  error?: string | null;
  busy?: boolean;
}

export function UploadPanel({ onFile, onSample, error, busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Analyze a Massachusetts lease</h1>
        <p className="mt-3 text-muted-foreground">Your PDF is read in this browser tab. It is never uploaded.</p>
      </div>

      {error && (
        <div role="alert" data-testid="upload-error" className="flex gap-3 rounded-xl border border-destructive/30 bg-priority-high-soft p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>{error}</p>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center rounded-2xl border-2 border-dashed bg-card px-6 py-12 text-center transition-colors",
          dragging ? "border-primary bg-accent" : "border-border",
        )}
      >
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <FileUp className="size-6" />
        </div>
        <p className="font-medium">Drag and drop your lease PDF here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Text-based PDF, up to {MAX_PDF_BYTES / 1024 / 1024} MB and {MAX_PDF_PAGES} pages
        </p>
        <Button className="mt-5" size="lg" disabled={busy} onClick={() => inputRef.current?.click()}>
          Choose a PDF
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label="Choose a lease PDF"
          data-testid="file-input"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Lock className="size-3.5 text-success" /> Processed on your device</span>
          <span className="flex items-center gap-1.5"><MapPin className="size-3.5" /> Massachusetts residential leases only</span>
        </div>
      </div>

      <div>
        <p className="mb-3 text-center text-sm text-muted-foreground">No lease handy? Try a fictional sample:</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[SAMPLE_A, SAMPLE_B].map((s, i) => (
            <button
              key={s.id}
              type="button"
              disabled={busy}
              onClick={() => onSample(s.id)}
              className="group flex items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-card transition-colors hover:border-primary/50 hover:bg-accent/40 disabled:opacity-60"
            >
              <FileText className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">{i === 0 ? "Sample A: problematic lease" : "Sample B: cleaner lease"}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{s.summary}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        FinePrint covers common Massachusetts residential lease terms. It is not legal advice and does not review every clause.
      </p>
    </div>
  );
}
