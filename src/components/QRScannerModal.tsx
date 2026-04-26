import { useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, AlertCircle } from 'lucide-react';
import jsQR from 'jsqr';

interface QRScannerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (result: string) => void;
  cancellingBillNumber?: number;
}

// Manual entry dialog for when BarcodeDetector is not available
const ManualEntryDialog = ({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (text: string) => void }) => {
  const [input, setInput] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-destructive" />
            Manual QR Entry
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            If QR scanning is not working, you can manually enter the bill ID from the printed receipt.
          </p>
          <Input
            placeholder="Enter Bill ID or scan QR code text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="bg-accent/20"
          />
          <Button
            className="w-full"
            onClick={() => { if (input.trim()) onSubmit(input.trim()); }}
            disabled={!input.trim()}
          >
            Submit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface CameraDevice {
  deviceId: string;
  label: string;
}

export const QRScannerModal = ({ isOpen, onOpenChange, onScanSuccess, cancellingBillNumber }: QRScannerModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<any>(null);

  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [detectorInitFailed, setDetectorInitFailed] = useState(false);

  // On open: enumerate cameras and check for BarcodeDetector
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setReady(false);
    setDetectorInitFailed(false);

    // Check for BarcodeDetector support
    const hasDetector = 'BarcodeDetector' in window;
    setHasBarcodeDetector(hasDetector);

    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const cams = devices
          .filter(d => d.kind === 'videoinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));

        if (cams.length === 0) {
          setError('No cameras found. Please connect a webcam.');
          return;
        }
        setCameras(cams);
        const back = cams.find(c => /back|rear|environment/i.test(c.label));
        setSelectedCamera((back || cams[0]).deviceId);
      })
      .catch(() => setError('Could not access cameras. Check browser permissions.'));

    return () => stopAll();
  }, [isOpen]);

  // When camera selection changes, start stream
  useEffect(() => {
    if (!isOpen || !selectedCamera) return;
    startCamera(selectedCamera);
    return () => stopAll();
  }, [selectedCamera, isOpen]);

  const startCamera = async (deviceId: string) => {
    stopAll();
    setError(null);
    setReady(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.play();
          setReady(true);
          startDetecting();
        };
      }

      // Initialise BarcodeDetector (may not be available in all Electron setups)
      if ('BarcodeDetector' in window) {
        try {
          detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          setDetectorInitFailed(false);
        } catch (detectErr) {
          console.warn('BarcodeDetector init failed:', detectErr);
          setDetectorInitFailed(true);
        }
      } else {
        setDetectorInitFailed(true);
      }

      // Don't show error for missing BarcodeDetector - just show manual entry option
      // Camera is still usable for visual verification
    } catch (e: any) {
      setError(`Camera error: ${e?.message || 'Could not start camera.'}`);
    }
  };

  const startDetecting = () => {
    const detect = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);

      // Try BarcodeDetector first (Electron/Chrome)
      if (hasBarcodeDetector && detectorRef.current) {
        try {
          const barcodes = await detectorRef.current.detect(canvas);
          if (barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            onScanSuccess(raw);
            return;
          }
        } catch {
          // detection frame error, continue
        }
      }

      // Fallback to jsQR (web browsers without BarcodeDetector)
      if (!hasBarcodeDetector || !detectorRef.current) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          onScanSuccess(code.data);
          return;
        }
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
  };

  const stopAll = () => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setReady(false);
  };

  const handleClose = () => {
    stopAll();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="glass-strong border-border max-w-sm overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-destructive" />
            {cancellingBillNumber
              ? `Cancel Bill #${cancellingBillNumber} — Scan QR`
              : 'Scan QR Code'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Camera selector — only shown when multiple cameras */}
          {cameras.length > 1 && (
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                <SelectTrigger className="h-8 text-xs bg-accent/20 flex-1">
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map(c => (
                    <SelectItem key={c.deviceId} value={c.deviceId} className="text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Video feed */}
          {!error && (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
              {/* Scan guide overlay */}
              {ready && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-white/60 rounded-lg relative">
                    {/* Corner markers */}
                    <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary rounded-tl" />
                    <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary rounded-tr" />
                    <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary rounded-bl" />
                    <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary rounded-br" />
                  </div>
                </div>
              )}
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
                  Starting camera…
                </div>
              )}
              {/* Hidden canvas for frame capture */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Info message */}
          <p className="text-xs text-muted-foreground text-center">
            {ready && !detectorInitFailed
              ? 'Auto-scan active - hold QR code in frame'
              : ready && detectorInitFailed
                ? 'Camera ready - scanning with jsQR library'
                : 'Starting camera...'}
          </p>

          {/* Manual entry button when both scanning methods fail */}
          {detectorInitFailed && !ready && (
            <Button variant="outline" className="w-full" onClick={() => setShowManualEntry(true)}>
              Enter Bill ID Manually
            </Button>
          )}

          {/* Success message when scan is ready */}
          {ready && (
            <p className="text-xs text-success text-center font-medium">
              {detectorInitFailed ? 'jsQR scanning active' : 'BarcodeDetector active'}
            </p>
          )}

          <Button variant="outline" className="w-full" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>

      {/* Manual Entry Dialog */}
      <ManualEntryDialog
        open={showManualEntry}
        onOpenChange={setShowManualEntry}
        onSubmit={(text) => {
          onScanSuccess(text);
          setShowManualEntry(false);
        }}
      />
    </Dialog>
  );
};
