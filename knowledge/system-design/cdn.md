# CDN (Content Delivery Network)

## Definition
A CDN is a geographically distributed network of edge servers that cache and serve content from locations close to users. It reduces latency, offloads origin servers, and improves availability by distributing content across multiple points of presence.

## Key Terms
- **Edge server**: CDN node closest to the user, serves cached content.
- **Origin server**: The source of truth — CDN fetches from origin on cache miss.
- **Pull CDN**: Edge fetches content from origin on first request (lazy).
- **Push CDN**: Content is proactively uploaded to edge servers (eager).
- **Cache-Control headers**: HTTP headers that control CDN caching behavior (max-age, no-cache).
- **Cache invalidation**: Purging or expiring cached content on CDN edges.
- **TTL (Time To Live)**: How long content stays cached on edge servers.
- **Cache hit ratio**: Percentage of requests served from cache — higher is better.
- **Signed URLs/Cookies**: CDN access control for private content.
- **DDoS protection**: CDN absorbs attack traffic across its distributed network.

## Why It Matters
CDNs are essential for any system serving static content (images, CSS, JS, video) or geographically distributed users. Interviewers expect you to propose CDNs early in system design discussions.

## Interview Questions
1. "How would you serve this content to users worldwide with low latency?"
2. "How do you handle cache invalidation on a CDN?"
3. "When would you use a push vs pull CDN?"

## Gotchas
- Cache invalidation across a global CDN takes time — design for eventual consistency.
- Dynamic content can't be cached — need to separate static and dynamic paths.
- CDN costs can spike with high traffic — monitor and set budget alerts.
- Cold start: first request to a new edge location hits origin (slow) — pre-warming helps.
- HTTPS/TLS termination at the edge is standard now — don't skip it.
