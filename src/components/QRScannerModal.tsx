import { useEffect, useRef, useState } from 'react';
import { ScanLine, AlertCircle, Camera } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import jsQR from 'jsqr';

interface QRScannerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (result: string) => void;
  cancellingBillNumber?: number;
}

const ManualEntryDialog = ({ 
  open, 
  onOpenChange, 
  onSubmit 
}: { 
  open: boolean; 
  onOpenChange: (v: boolean) => void; 
  onSubmit: (text: string) => void 
}) => {
  const [input, setInput] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-destructive" />
            Manual QR Entry
          </DialogTitle>
          <DialogDescription className="sr-only">
            Enter the details from the receipt manually if scanning fails.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Enter the Bill ID from the printed receipt.
          </p>
          <Input
            placeholder="Enter Bill ID or QR code text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && input.trim()) {
                onSubmit(input.trim());
                setInput('');
              }
            }}
            className="bg-accent/20"
            autoFocus
          />
          <Button
            className="w-full"
            onClick={() => {
              if (input.trim()) {
                onSubmit(input.trim());
                setInput('');
              }
            }}
            disabled={!input.trim()}
          >
            Submit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const QRScannerModal = ({ 
  isOpen, 
  onOpenChange, 
  onScanSuccess, 
  cancellingBillNumber 
}: QRScannerModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cameras, setCameras] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
  const [showManualEntry, setShowManualEntry] = useState(false);

  const stopAll = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setStatus('initializing');
    setCameras([]);
    setSelectedCamera('');

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((tempStream) => {
        tempStream.getTracks().forEach(t => t.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((devices) => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');

        if (videoDevices.length === 0) {
          setError('No camera found. Please connect a camera.');
          setStatus('error');
          setTimeout(() => setShowManualEntry(true), 500);
          return;
        }

        const cams = videoDevices.map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`
        }));

        setCameras(cams);
        const backCamera = cams.find(c => /back|rear|environment/i.test(c.label));
        setSelectedCamera((backCamera || cams[0]).deviceId);
      })
      .catch(err => {
        console.error('[QR] Camera permission error:', err);
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access in your browser settings.');
        } else {
          setError('Camera access failed: ' + err.message);
        }
        setStatus('error');
        setTimeout(() => setShowManualEntry(true), 500);
      });

    return () => stopAll();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedCamera) return;

    const startCamera = async () => {
      stopAll();
      setError(null);
      setStatus('initializing');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedCamera },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        video.play().catch(() => {
          setError('Could not start video playback.');
          setStatus('error');
        });

        const metadataTimeout = setTimeout(() => {
          setStatus('ready');
          startScan();
        }, 3000);
        timeoutRef.current = metadataTimeout;

        video.onloadedmetadata = () => {
          clearTimeout(metadataTimeout);
          timeoutRef.current = null;
          setStatus('ready');
          startScan();
        };

      } catch (err: any) {
        setError(`Camera error: ${err.message}`);
        setStatus('error');
      }
    };

    startCamera();
    return () => stopAll();
  }, [selectedCamera, isOpen]);

  const startScan = () => {
    const detect = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) { rafRef.current = requestAnimationFrame(detect); return; }
      if (video.paused || video.ended) { rafRef.current = requestAnimationFrame(detect); return; }

      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        if (canvas.width === 0 || canvas.height === 0) {
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        // Performance Optimization: added willReadFrequently
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { rafRef.current = requestAnimationFrame(detect); return; }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code?.data) {
          onScanSuccess(code.data);
          return;
        }
      } catch (err) {
        console.error('[QR] Detection error:', err);
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
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
            {cancellingBillNumber ? `Cancel Bill #${cancellingBillNumber}` : 'Scan QR Code'}
          </DialogTitle>
          {/* Accessibility Fix */}
          <DialogDescription className="sr-only">
            Camera interface for scanning QR codes to verify bill cancellation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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

          {status !== 'error' ? (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              
              {status === 'ready' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-white/60 rounded-lg">
                    <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
                    <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
                    <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary" />
                    <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
                  </div>
                </div>
              )}

              {status === 'initializing' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="text-center text-white">
                    <div className="inline-block animate-spin mb-2">⏳</div>
                    <p className="text-sm">Initializing camera...</p>
                  </div>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 min-h-32">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-sm font-medium text-destructive">Camera Error</p>
              </div>
              <p className="text-xs text-destructive/80 text-center">{error}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            {status === 'initializing' && 'Starting camera...'}
            {status === 'ready' && 'Position QR code in frame'}
            {status === 'error' && 'Manual entry available below'}
          </p>

          {status === 'error' && (
            <Button className="w-full" onClick={() => setShowManualEntry(true)}>
              Enter Bill ID Manually
            </Button>
          )}

          <Button variant="outline" className="w-full" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>

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