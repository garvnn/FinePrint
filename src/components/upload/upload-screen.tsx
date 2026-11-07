"use client";

import { useState } from "react";
import { CircleAlert, FileUp } from "lucide-react";
import type { Phase } from "@/hooks/use-lease-session";
import { MAX_PDF_BYTES, MAX_PDF_PAGES } from "@/lib/pdf/load";
import type { SampleId } from "@/lib/fixtures/sample-leases";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Props {
  /** Any phase except "ready". */
  phase: Exclude<Phase, { kind: "ready" }>;
  /** Name of the file being read, if known (kept by the parent, not by the hook). */
  fileName: string | null;
  onFile: (file: File) => void;
  onSample: (id: SampleId) => void;
}

const SAMPLES: { id: SampleId; title: string; body: string }[] = [
  { id: "sample-a", title: "Sample A: lease with several issues", body: "Deposit, fee and late fee findings" },
  { id: "sample-b", title: "Sample B: mostly clean lease", body: "Only a few things to review" },
];

export function UploadScreen({ phase, fileName, onFile, onSample }: Props) {
  return (
    <div className="mx-auto w-full max-w-[45rem] px-4 pt-14 pb-16 sm:px-6">
      <h1 className="mb-2 font-[family-name:var(--font-serif)] text-4xl font-semibold tracking-[-0.01em]">Open your lease</h1>
      <p className="mb-6 text-foreground/80">FinePrint reads it here in your browser. Nothing is uploaded.</p>

      {phase.kind === "error" && (
        <div
          role="alert"
          data-testid="upload-error"
          className="mb-5 flex gap-3 rounded-lg border border-priority-high/30 bg-priority-high-soft px-4 py-3.5 text-priority-high"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">We couldn’t open this PDF</p>
            <p className="mt-0.5 text-foreground">{phase.message}</p>
          </div>
        </div>
      )}

      {phase.kind === "loading" ? (
        <LoadingCard label={phase.label} progress={phase.progress} fileName={fileName} />
      ) : (
        <>
          <DropZone onFile={onFile} />
          <div className="mt-7">
            <h2 className="mb-1 text-lg font-bold">No lease handy?</h2>
            <p className="mb-3 text-[0.9375rem] text-muted-foreground">Try a sample to see how FinePrint works.</p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSample(s.id)}
                  className="rounded-lg border border-transparent bg-card px-[1.125rem] py-4 text-left shadow-card transition-colors hover:border-foreground"
                >
                  <span className="block font-semibold">{s.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{s.body}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-xl border-2 border-dashed bg-card px-6 py-11 text-center transition-colors",
        dragging ? "border-primary bg-accent" : "border-input",
      )}
    >
      <FileUp aria-hidden="true" strokeWidth={1.8} className="mx-auto size-10 text-primary" />
      <p className="mt-3 mb-1 text-xl font-semibold">Drag your lease PDF here</p>
      <p className="mb-[1.125rem] text-muted-foreground">or</p>
      <label
        htmlFor="file-input"
        className="inline-flex min-h-12 cursor-pointer items-center rounded-lg bg-primary px-[1.375rem] font-semibold text-primary-foreground transition-colors hover:bg-primary/85 has-[+input:focus-visible]:outline-3 has-[+input:focus-visible]:outline-offset-2 has-[+input:focus-visible]:outline-ring"
      >
        Choose a PDF
      </label>
      <input
        id="file-input"
        data-testid="file-input"
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          take(e.target.files);
          // Allow choosing the same file again after an error.
          e.target.value = "";
        }}
      />
      <p className="mt-[1.125rem] text-sm text-muted-foreground">
        PDF only, up to {MAX_PDF_BYTES / 1024 / 1024} MB and {MAX_PDF_PAGES} pages. Massachusetts residential leases only.
      </p>
    </div>
  );
}

function LoadingCard({ label, progress, fileName }: { label: string; progress?: number; fileName: string | null }) {
  return (
    <div className="rounded-lg bg-card p-6 shadow-card sm:p-8" aria-busy="true">
      {fileName && <p className="mb-1 truncate text-sm text-muted-foreground">{fileName}</p>}
      <p className="mb-4 text-xl font-semibold" aria-live="polite">
        {label}
      </p>
      <Progress
        aria-label="Reading your lease"
        value={progress === undefined ? null : Math.round(progress * 100)}
        className="h-2.5 bg-border data-[state=indeterminate]:animate-pulse"
      />
    </div>
  );
}
