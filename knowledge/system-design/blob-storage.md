# Blob Storage (Object Storage)

## Definition
Blob storage is a data storage architecture that manages unstructured data as objects (blobs) in a flat namespace, unlike file systems with hierarchical directories. Each object has data, metadata, and a unique identifier. It's designed for massive scale, durability, and cost-effective storage of files, images, videos, backups, and logs.

## Key Terms
- **Object/Blob**: A file + metadata + unique key. Immutable (replace, don't modify in place).
- **Bucket/Container**: Top-level namespace for organizing objects (S3 bucket, Azure container).
- **S3 (Amazon)**: The dominant blob storage service. De facto industry standard API.
- **Durability**: S3 offers 11 nines (99.999999999%) durability — data is replicated across facilities.
- **Storage tiers**: Hot (frequent access), cool (infrequent), archive (rare, cheapest). Lifecycle policies auto-tier.
- **Pre-signed URLs**: Temporary URLs granting time-limited access to private objects.
- **Multipart upload**: Upload large files in parallel chunks — faster and resumable.
- **Content-Type**: MIME type header — critical for browsers to handle objects correctly.
- **Event notifications**: Trigger functions/queues when objects are created/deleted (S3 → Lambda).

## Why It Matters
Almost every system design involves storing files somewhere. Blob storage is the default answer — it's cheap, durable, and infinitely scalable. Interviewers expect you to propose it for any file-related requirement.

## Interview Questions
1. "How would you store and serve user-uploaded images?"
2. "How do you handle large file uploads?"
3. "How would you make this storage cost-effective?"

## Gotchas
- Blob storage is not a file system — no in-place modification, no directory listing (simulated with prefixes).
- Egress costs can be surprising — serving content directly from S3 can be expensive at scale (use CDN).
- Pre-signed URLs are the secure way to give clients direct upload/download access.
- Consistency: S3 is now strongly consistent (since Dec 2020) but some services still aren't.
- Don't use blob storage as a database — it's optimized for large objects, not small frequent reads.
