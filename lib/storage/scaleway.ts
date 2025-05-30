import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// Validate required environment variables
const requiredEnvVars = {
  accessKeyId: process.env.SCALEWAY_ACCESS_KEY_ID,
  secretAccessKey: process.env.SCALEWAY_SECRET_ACCESS_KEY,
  bucketName: process.env.SCALEWAY_BUCKET_NAME,
  region: process.env.SCALEWAY_REGION || 'nl-ams',
  endpoint: process.env.SCALEWAY_ENDPOINT || 'https://s3.nl-ams.scw.cloud',
};

if (
  !requiredEnvVars.accessKeyId ||
  !requiredEnvVars.secretAccessKey ||
  !requiredEnvVars.bucketName
) {
  throw new Error(
    'Missing required Scaleway environment variables: SCALEWAY_ACCESS_KEY_ID, SCALEWAY_SECRET_ACCESS_KEY, SCALEWAY_BUCKET_NAME',
  );
}

// Initialize Scaleway S3 client
const s3Client = new S3Client({
  region: requiredEnvVars.region,
  endpoint: requiredEnvVars.endpoint,
  credentials: {
    accessKeyId: requiredEnvVars.accessKeyId,
    secretAccessKey: requiredEnvVars.secretAccessKey,
  },
  forcePathStyle: true, // Use path-style URLs instead of virtual-hosted-style
});

const BUCKET_NAME = requiredEnvVars.bucketName;

export interface UploadResult {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
}

export async function uploadFile(
  file: Buffer,
  filename: string,
  contentType: string,
): Promise<UploadResult> {
  // Generate unique filename to avoid conflicts
  const fileExtension = filename.split('.').pop();
  const uniqueFilename = `${uuidv4()}.${fileExtension}`;
  const key = `uploads/${uniqueFilename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
      ACL: 'public-read', // Make file publicly accessible
    });

    await s3Client.send(command);

    // Construct public URL using path-style format
    const publicUrl = `${requiredEnvVars.endpoint}/${BUCKET_NAME}/${key}`;

    return {
      url: publicUrl,
      pathname: uniqueFilename,
      contentType,
      size: file.length,
    };
  } catch (error) {
    console.error('Error uploading file to Scaleway:', error);
    throw new Error('Failed to upload file to storage');
  }
}

export async function uploadImageFromBase64(
  base64Data: string,
  mimeType: string,
  filename?: string,
): Promise<UploadResult> {
  // Remove data URL prefix if present
  const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');

  // Generate filename if not provided
  const extension = mimeType.split('/')[1] || 'png';
  const finalFilename =
    filename || `generated-image-${Date.now()}.${extension}`;

  return uploadFile(buffer, finalFilename, mimeType);
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}
