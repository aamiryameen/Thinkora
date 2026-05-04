/**
 * Document scanning service.
 *
 * Wraps `react-native-document-scanner-plugin` (capture + edge detection +
 * perspective crop) and `@react-native-ml-kit/text-recognition` (OCR).
 *
 * On Android, the scanner uses Google's ML Kit Document Scanner under the
 * hood. OCR is fully on-device — no network, no API key.
 */

import { Platform, PermissionsAndroid } from 'react-native';

// Lazy-load the native modules so the JS bundle still works in Jest / web.
let DocumentScanner: any = null;
let TextRecognition: any = null;
let RNTextRecognitionScript: any = null;

if (Platform.OS === 'android') {
  try {
    DocumentScanner = require('react-native-document-scanner-plugin').default;
  } catch {
    DocumentScanner = null;
  }
  try {
    const mod = require('@react-native-ml-kit/text-recognition');
    TextRecognition = mod.default;
    RNTextRecognitionScript = mod.TextRecognitionScript;
  } catch {
    TextRecognition = null;
    RNTextRecognitionScript = null;
  }
}

export type OcrScript = 'latin' | 'chinese' | 'devanagari' | 'japanese' | 'korean';

export interface ScanResult {
  /** File URIs of captured pages. */
  imageUris: string[];
  /** Combined OCR text across all pages, separated by double newlines. */
  text: string;
  /** Per-page OCR text. */
  perPageText: string[];
}

export class ScanError extends Error {
  constructor(message: string, readonly kind: 'cancelled' | 'permission' | 'unavailable' | 'unknown') {
    super(message);
    this.name = 'ScanError';
  }
}

async function ensureCameraPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    {
      title: 'Camera Permission',
      message: 'Thinkora needs the camera to scan documents.',
      buttonPositive: 'Allow',
      buttonNegative: 'Cancel',
    },
  );
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new ScanError('Camera permission denied.', 'permission');
  }
}

/**
 * Map our OcrScript values to the underlying ML Kit constants.
 * Falls back to Latin if the script is unknown.
 */
function resolveScript(script: OcrScript) {
  if (!RNTextRecognitionScript) return undefined;
  switch (script) {
    case 'chinese':    return RNTextRecognitionScript.CHINESE;
    case 'devanagari': return RNTextRecognitionScript.DEVANAGARI;
    case 'japanese':   return RNTextRecognitionScript.JAPANESE;
    case 'korean':     return RNTextRecognitionScript.KOREAN;
    case 'latin':
    default:           return RNTextRecognitionScript.LATIN;
  }
}

/**
 * Capture pages with the document scanner, then run OCR on each.
 *
 * @param script Which script bundle to prefer for OCR. Defaults to 'latin'.
 *               Latin works for English + most European languages.
 *               (Urdu/Arabic are not supported by ML Kit; would need a
 *               Tesseract integration instead.)
 */
export async function scanAndExtract(script: OcrScript = 'latin'): Promise<ScanResult> {
  if (!DocumentScanner) {
    throw new ScanError('Scanner not available on this device.', 'unavailable');
  }

  await ensureCameraPermission();

  let scannerResult: { scannedImages?: string[]; status?: string };
  try {
    scannerResult = await DocumentScanner.scanDocument({
      maxNumDocuments: 5,
      croppedImageQuality: 90,
      // Let the user choose to apply a B&W filter inside the native UI.
      responseType: 'imageFilePath',
    });
  } catch (e: any) {
    throw new ScanError(e?.message ?? 'Failed to start scanner.', 'unknown');
  }

  if (scannerResult?.status === 'cancel' || !scannerResult?.scannedImages?.length) {
    throw new ScanError('Scan cancelled.', 'cancelled');
  }

  const uris = scannerResult.scannedImages.filter(Boolean);
  const perPageText: string[] = [];

  if (TextRecognition) {
    const ocrScript = resolveScript(script);
    for (const uri of uris) {
      try {
        const result = ocrScript
          ? await TextRecognition.recognize(uri, ocrScript)
          : await TextRecognition.recognize(uri);
        perPageText.push((result?.text ?? '').trim());
      } catch (err) {
        console.warn('[Scan] OCR failed for page', uri, err);
        perPageText.push('');
      }
    }
  } else {
    // OCR module not present — return blank text per page; the UI handles this.
    uris.forEach(() => perPageText.push(''));
  }

  return {
    imageUris: uris,
    perPageText,
    text: perPageText.filter((t) => t.length > 0).join('\n\n'),
  };
}

/** Lightweight check the host app can use to hide Scan when unsupported. */
export function isScanAvailable(): boolean {
  return Platform.OS === 'android' && DocumentScanner !== null;
}
