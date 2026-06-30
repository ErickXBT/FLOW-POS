import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, RefreshCw, AlertCircle } from "lucide-react";

interface CameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

interface CameraDevice {
  id: string;
  label: string;
}

export function CameraScanner({ isOpen, onClose, onScan }: CameraScannerProps) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const containerId = "flow-camera-reader";

  // Play audio feedback on successful scan
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1000Hz frequency
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime); // 15% volume

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1); // Beep duration 0.1s
    } catch (e) {
      console.warn("Failed to play scan audio feedback:", e);
    }
  };

  // Get available cameras
  useEffect(() => {
    if (!isOpen) return;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          
          // Try to select the back camera by default
          const backCam = devices.find(
            (device) =>
              device.label.toLowerCase().includes("back") ||
              device.label.toLowerCase().includes("belakang") ||
              device.label.toLowerCase().includes("environment") ||
              device.label.toLowerCase().includes("rear")
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setError("Kamera tidak ditemukan. Harap pastikan perangkat memiliki kamera aktif.");
          setIsInitializing(false);
        }
      })
      .catch((err) => {
        console.error("Failed to get cameras:", err);
        setError("Gagal mengakses daftar kamera perangkat. Pastikan izin kamera telah diberikan.");
        setIsInitializing(false);
      });
  }, [isOpen]);

  // Start scanning when camera is selected
  useEffect(() => {
    if (!isOpen || !selectedCameraId) return;

    setIsInitializing(true);
    setError("");

    // Initialize Html5Qrcode instance
    const html5QrCode = new Html5Qrcode(containerId);
    qrCodeInstanceRef.current = html5QrCode;

    // Barcode scanner configuration
    const config = {
      fps: 10,
      qrbox: (width: number, height: number) => {
        // Barcode reader frame should be wider and shorter than standard QR code box
        const scanWidth = Math.min(width * 0.75, 280);
        const scanHeight = Math.min(height * 0.35, 120);
        return { width: scanWidth, height: scanHeight };
      },
      aspectRatio: 1.777778, // 16:9
    };

    html5QrCode
      .start(
        selectedCameraId,
        config,
        (decodedText) => {
          // Success callback
          playBeep();
          
          // Stop camera scanning immediately to avoid repeated scanning
          if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
            qrCodeInstanceRef.current.stop().finally(() => {
              onScan(decodedText);
            });
          } else {
            onScan(decodedText);
          }
        },
        () => {
          // Verbose error callback, ignore to avoid spamming console
        }
      )
      .then(() => {
        setIsInitializing(false);
      })
      .catch((err) => {
        console.error("Start scanning error:", err);
        setError("Gagal menyalakan video stream kamera. Silakan pilih kamera lain.");
        setIsInitializing(false);
      });

    return () => {
      // Clean up scanner on unmount or camera switch
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch((e) => console.error("Clean up stop error:", e));
      }
      qrCodeInstanceRef.current = null;
    };
  }, [isOpen, selectedCameraId, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Scan Barcode Kamera</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Arahkan kamera HP/Tablet ke barcode produk</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl active:scale-95 transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scanner Canvas Container */}
        <div className="relative bg-slate-950 flex flex-col justify-center items-center aspect-[4/3] w-full overflow-hidden">
          
          <div id={containerId} className="w-full h-full" />

          {/* Scanning Box Overlay (Laser effect) */}
          {!error && !isInitializing && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[280px] h-[120px] border-2 border-amber-500 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                
                {/* Glowing Corners */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-amber-400 rounded-tl-md" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-amber-400 rounded-tr-md" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-amber-400 rounded-bl-md" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-amber-400 rounded-br-md" />
                
                {/* Scanning Laser Line */}
                <div className="w-full h-[2px] bg-red-500 absolute top-1/2 left-0 shadow-[0_0_8px_#ef4444] animate-pulse" />
              </div>
            </div>
          )}

          {/* Loader */}
          {isInitializing && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
              <div className="text-xs font-medium text-slate-400">Menghubungkan kamera...</div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white gap-3">
              <AlertCircle size={32} className="text-red-500 animate-bounce" />
              <div className="text-xs font-bold text-slate-350">{error}</div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-4">
          
          {/* Camera selector dropdown */}
          {cameras.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Pilih Kamera Belakang
              </label>
              <div className="relative">
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  {cameras.map((camera) => (
                    <option key={camera.id} value={camera.id}>
                      {camera.label || `Kamera ${camera.id.slice(0, 5)}...`}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <RefreshCw size={12} />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
