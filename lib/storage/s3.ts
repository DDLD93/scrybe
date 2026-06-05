import {
  CopyObjectCommand,
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { config } from "@/lib/config";

let client: S3Client | null = null;
let bucketEnsured = false;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      forcePathStyle: config.s3.forcePathStyle,
      credentials:
        config.s3.accessKeyId && config.s3.secretAccessKey
          ? {
              accessKeyId: config.s3.accessKeyId,
              secretAccessKey: config.s3.secretAccessKey,
            }
          : undefined,
    });
  }
  return client;
}

export async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const s3 = getClient();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.s3.bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: config.s3.bucket }));
  }
  bucketEnsured = true;
}

async function withBucket<T>(fn: () => Promise<T>): Promise<T> {
  await ensureBucket();
  return fn();
}

export async function putFile(
  key: string,
  localPath: string,
  contentType?: string,
): Promise<void> {
  await withBucket(async () => {
    const upload = new Upload({
      client: getClient(),
      params: {
        Bucket: config.s3.bucket,
        Key: key,
        Body: createReadStream(localPath),
        ContentType: contentType,
      },
    });
    await upload.done();
  });
}

export async function getFile(key: string, localPath: string): Promise<void> {
  await withBucket(async () => {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }),
    );
    if (!res.Body) throw new Error(`Empty body for key ${key}`);
    await pipeline(res.Body as Readable, createWriteStream(localPath));
  });
}

export async function putBuffer(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string,
): Promise<void> {
  await withBucket(async () => {
    const upload = new Upload({
      client: getClient(),
      params: {
        Bucket: config.s3.bucket,
        Key: key,
        Body: typeof body === "string" ? Buffer.from(body) : body,
        ContentType: contentType,
      },
    });
    await upload.done();
  });
}

export async function getBuffer(key: string): Promise<Buffer> {
  return withBucket(async () => {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }),
    );
    if (!res.Body) throw new Error(`Empty body for key ${key}`);
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  });
}

export async function getStream(key: string): Promise<Readable> {
  await ensureBucket();
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }),
  );
  if (!res.Body) throw new Error(`Empty body for key ${key}`);
  return res.Body as Readable;
}

export type RangeResult = {
  stream: Readable;
  contentLength: number;
  contentRange?: string;
  contentType?: string;
  statusCode: 200 | 206;
};

export async function getRangeStream(
  key: string,
  rangeHeader?: string | null,
): Promise<RangeResult> {
  await ensureBucket();
  const res = await getClient().send(
    new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Range: rangeHeader ?? undefined,
    }),
  );
  if (!res.Body) throw new Error(`Empty body for key ${key}`);
  const contentLength = res.ContentLength ?? 0;
  return {
    stream: res.Body as Readable,
    contentLength,
    contentRange: res.ContentRange,
    contentType: res.ContentType,
    statusCode: res.ContentRange ? 206 : 200,
  };
}

export async function copyObject(sourceKey: string, destKey: string): Promise<void> {
  await withBucket(async () => {
    await getClient().send(
      new CopyObjectCommand({
        Bucket: config.s3.bucket,
        CopySource: `${config.s3.bucket}/${sourceKey}`,
        Key: destKey,
      }),
    );
  });
}

export async function deleteObject(key: string): Promise<void> {
  await withBucket(async () => {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await getClient().send(
      new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key }),
    );
  });
}

export function bucketName(): string {
  return config.s3.bucket;
}
