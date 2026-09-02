import QRCode from 'qrcode';

// Ticket QR codes arrive from the API as an opaque `qrData` string. The mobile
// app renders it client-side; a chat bot has to produce the image itself, so we
// rasterise it here and send it as a photo/image message.
//
// Kept deliberately small (512px, margin 2) — big enough for a gate scanner to
// read off a phone screen, small enough to send quickly over WhatsApp.
export async function renderQrPng(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}
