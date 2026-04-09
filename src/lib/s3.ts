import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ca-central-1",
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const bucket = process.env.AWS_S3_BUCKET ?? "";

export async function getBannerUploadUrl(
  formId: string,
  ext: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const key = `banners/${formId}/${uuid()}.${ext}`;
  const region = process.env.AWS_REGION ?? "ca-central-1";
  const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
    }),
    { expiresIn: 300 }
  );

  return { uploadUrl, publicUrl };
}

export async function deleteBannerObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
