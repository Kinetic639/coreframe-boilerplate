"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ExternalLink } from "lucide-react";

interface ImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
}

export function ImageModal({ open, onOpenChange, imageUrl }: ImageModalProps) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "location-image.jpg";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(imageUrl, "_blank");
  };

  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <div className="relative">
          {/* Header with controls */}
          <div className="absolute left-0 right-0 top-0 z-10 bg-black/50 backdrop-blur-sm">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="text-white hover:bg-white/20"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Pobierz
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenInNewTab}
                  className="text-white hover:bg-white/20"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Otwórz w nowej karcie
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Image */}
          <div className="flex max-h-[80vh] min-h-[400px] items-center justify-center bg-black">
            <img
              src={imageUrl}
              alt="Pełny rozmiar"
              className="max-h-full max-w-full object-contain"
              style={{ maxHeight: "80vh" }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
