/**
 * Image Upload Helpers for Streme Token Deployment
 * 
 * Provides multiple upload options: IPFS (Pinata), Cloudinary, or use existing URL.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============ IPFS via Pinata ============

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export async function uploadToIPFS(
  filePath: string,
  pinataJwt: string
): Promise<string> {
  const formData = new FormData();
  const file = fs.readFileSync(filePath);
  const blob = new Blob([file]);
  formData.append('file', blob, path.basename(filePath));

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Pinata upload failed: ${response.statusText}`);
  }

  const data = (await response.json()) as PinataResponse;
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
}

// ============ Cloudinary ============

interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
}

export async function uploadToCloudinary(
  filePath: string,
  cloudName: string,
  apiKey: string,
  apiSecret: string
): Promise<string> {
  const file = fs.readFileSync(filePath);
  const base64 = file.toString('base64');
  const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'streme-tokens';
  
  // Generate signature
  const crypto = await import('crypto');
  const signatureString = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  const formData = new FormData();
  formData.append('file', `data:${mimeType};base64,${base64}`);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', folder);
  formData.append('transformation', 'w_400,h_400,c_fill');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Cloudinary upload failed: ${response.statusText}`);
  }

  const data = (await response.json()) as CloudinaryResponse;
  return data.secure_url;
}

// ============ imgBB (Free, no API key needed for basic) ============

interface ImgBBResponse {
  data: {
    url: string;
    display_url: string;
  };
  success: boolean;
}

export async function uploadToImgBB(
  filePath: string,
  apiKey?: string
): Promise<string> {
  const file = fs.readFileSync(filePath);
  const base64 = file.toString('base64');

  const formData = new FormData();
  formData.append('image', base64);
  if (apiKey) {
    formData.append('key', apiKey);
  }

  const url = apiKey
    ? `https://api.imgbb.com/1/upload?key=${apiKey}`
    : 'https://api.imgbb.com/1/upload';

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`imgBB upload failed: ${response.statusText}`);
  }

  const data = (await response.json()) as ImgBBResponse;
  if (!data.success) {
    throw new Error('imgBB upload failed');
  }
  
  return data.data.display_url;
}

// ============ Main CLI ============

async function main() {
  const [, , provider, filePath] = process.argv;

  if (!filePath) {
    console.log(`
Usage: npx ts-node upload-image.ts <provider> <file-path>

Providers:
  pinata     - IPFS via Pinata (requires PINATA_JWT)
  cloudinary - Cloudinary (requires CLOUDINARY_* vars)
  imgbb      - imgBB (optional IMGBB_API_KEY)

Environment variables:
  PINATA_JWT           - Pinata JWT token
  CLOUDINARY_CLOUD_NAME
  CLOUDINARY_API_KEY
  CLOUDINARY_API_SECRET
  IMGBB_API_KEY        - Optional
`);
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let imageUrl: string;

  switch (provider) {
    case 'pinata':
      const pinataJwt = process.env.PINATA_JWT;
      if (!pinataJwt) throw new Error('PINATA_JWT required');
      imageUrl = await uploadToIPFS(filePath, pinataJwt);
      break;

    case 'cloudinary':
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET required');
      }
      imageUrl = await uploadToCloudinary(filePath, cloudName, apiKey, apiSecret);
      break;

    case 'imgbb':
      imageUrl = await uploadToImgBB(filePath, process.env.IMGBB_API_KEY);
      break;

    default:
      console.error(`Unknown provider: ${provider}`);
      process.exit(1);
  }

  console.log(`✅ Image uploaded: ${imageUrl}`);
  console.log(`\nUse in deployment:`);
  console.log(`  TOKEN_IMAGE="${imageUrl}"`);
}

main().catch(console.error);
