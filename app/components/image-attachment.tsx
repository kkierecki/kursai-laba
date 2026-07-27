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
const maxImages = 5;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Nie udało się wczytać obrazu."));
    reader.readAsDataURL(file);
  });
}

export function useImageAttachment() {
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
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

    if (attachedImages.length >= maxImages) {
      setImageError(`Możesz dodać maksymalnie ${maxImages} screenów naraz.`);
      return;
    }

    const image = {
      dataUrl: await fileToDataUrl(file),
      mediaType: file.type,
      filename: file.name || "screenshot",
    };
    setImageError("");
    setAttachedImages((current) => [...current, image]);
  }

  async function attachFiles(files: Iterable<File>) {
    for (const file of Array.from(files)) {
      await attachFile(file);
    }
  }

  function handlePaste(event: React.ClipboardEvent) {
    const imageItems = Array.from(event.clipboardData.items).filter((item) => item.type.startsWith("image/"));

    if (imageItems.length === 0) {
      return;
    }

    event.preventDefault();
    void attachFiles(imageItems.map((item) => item.getAsFile()).filter((file): file is File => Boolean(file)));
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
    void attachFiles(Array.from(event.dataTransfer.files));
  }

  return {
    attachedImage: attachedImages[0] ?? null,
    attachedImages,
    attachFile,
    attachFiles,
    clearAttachedImage: () => setAttachedImages([]),
    removeImage: (index: number) => setAttachedImages((current) => current.filter((_, currentIndex) => currentIndex !== index)),
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
  onFiles,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFiles: (files: Iterable<File>) => void;
}) {
  return (
    <input
      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
      hidden
      onChange={(event) => {
        onFiles(Array.from(event.target.files ?? []));
        event.target.value = "";
      }}
      ref={fileInputRef}
      type="file"
      multiple
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
