"use client";

import { RefObject, useRef, useState } from "react";

export type AttachedImage = {
  dataUrl: string;
  mediaType: string;
  filename: string;
};

const acceptedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);
const maxImageSize = 4 * 1024 * 1024;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Nie udało się wczytać obrazu."));
    reader.readAsDataURL(file);
  });
}

export function useImageAttachment() {
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [imageError, setImageError] = useState("");
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function attachFile(file: File | null | undefined) {
    if (!file) {
      return;
    }

    if (!acceptedTypes.has(file.type)) {
      setImageError("Obsługiwane formaty: PNG, JPG, JPEG, GIF, WEBP.");
      return;
    }

    if (file.size > maxImageSize) {
      setImageError("Max 4MB. Zrób screenshot fragmentu.");
      return;
    }

    setImageError("");
    setAttachedImage({
      dataUrl: await fileToDataUrl(file),
      mediaType: file.type,
      filename: file.name || "screenshot",
    });
  }

  function handlePaste(event: React.ClipboardEvent) {
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/"),
    );

    if (!imageItem) {
      return;
    }

    event.preventDefault();
    void attachFile(imageItem.getAsFile());
  }

  function handleDragOver(event: React.DragEvent) {
    if (Array.from(event.dataTransfer.items).some((item) => item.kind === "file")) {
      event.preventDefault();
      setIsDraggingImage(true);
    }
  }

  function handleDragLeave(event: React.DragEvent) {
    if (event.currentTarget === event.target) {
      setIsDraggingImage(false);
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDraggingImage(false);
    void attachFile(Array.from(event.dataTransfer.files)[0]);
  }

  return {
    attachedImage,
    attachFile,
    clearAttachedImage: () => setAttachedImage(null),
    fileInputRef,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handlePaste,
    imageError,
    isDraggingImage,
    openFilePicker: () => fileInputRef.current?.click(),
  };
}

export function HiddenImageInput({
  fileInputRef,
  onFile,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File | null | undefined) => void;
}) {
  return (
    <input
      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
      hidden
      onChange={(event) => {
        onFile(event.target.files?.[0]);
        event.target.value = "";
      }}
      ref={fileInputRef}
      type="file"
    />
  );
}

export function AttachmentPreview({
  image,
  onRemove,
}: {
  image: AttachedImage;
  onRemove: () => void;
}) {
  return (
    <div className="attachment-preview">
      <img alt="Załączony obraz" src={image.dataUrl} />
      <div>
        <strong>📎 Screenshot</strong>
        <span>zadaj pytanie o ten obraz</span>
      </div>
      <button aria-label="Usuń obraz" onClick={onRemove} type="button">
        ×
      </button>
    </div>
  );
}

export function DropOverlay({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return <div className="drop-overlay">Upuść obraz</div>;
}
