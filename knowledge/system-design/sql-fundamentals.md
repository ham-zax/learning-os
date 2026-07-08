---
tags:
  - sql
  - interview-prep
  - airwallex
last-updated: 2026-06-22
type: concept
---

# SQL Fundamentals — Interview Guide

> [!tip] Airwallex OA includes SQL tasks: JOINs, GROUP BY, nested queries. 75 min total.

## Core Concepts

### SELECT — Retrieving Data

```sql
-- Basic select
SELECT column1, column2 FROM table_name;

-- Filter rows
SELECT * FROM payments WHERE status = 'completed';

-- Limit results
SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;
```

### WHERE — Filtering

```sql
-- Comparison operators
WHERE amount > 100
WHERE status != 'pending'
WHERE currency IN ('USD', 'AUD', 'EUR')
WHERE created_at BETWEEN '2026-01-01' AND '2026-06-30'
WHERE merchant_name LIKE '%airwallex%'  -- % = wildcard
WHERE description IS NULL
```

### JOIN — Combining Tables

**This is the #1 SQL interview topic.**

```sql
-- INNER JOIN: only matching rows
SELECT p.id, p.amount, m.name
FROM payments p
INNER JOIN merchants m ON p.merchant_id = m.id;

-- LEFT JOIN: all rows from left, matching from right
SELECT m.name, COUNT(p.id) as payment_count
FROM merchants m
LEFT JOIN payments p ON m.id = p.merchant_id
GROUP BY m.name;

-- RIGHT JOIN: all rows from right, matching from left
-- (rarely used — usually rewrite as LEFT JOIN)

-- FULL OUTER JOIN: all rows from both tables
SELECT * FROM table_a
FULL OUTER JOIN table_b ON table_a.id = table_b.a_id;
```

**Visual explanation:**
```
INNER JOIN:    A ∩ B  (only matching)
LEFT JOIN:     A      (all of A + matching B)
RIGHT JOIN:    B      (all of B + matching A)
FULL JOIN:     A ∪ B  (everything)
```

### GROUP BY — Aggregation

```sql
-- Count per group
SELECT currency, COUNT(*) as count
FROM payments
GROUP BY currency;

-- Multiple aggregations
SELECT
    currency,
    COUNT(*) as count,
    SUM(amount) as total,
    AVG(amount) as average,
    MAX(amount) as largest
FROM payments
WHERE status = 'completed'
GROUP BY currency
HAVING COUNT(*) > 10  -- Filter AFTER grouping
ORDER BY total DESC;
```

**Key distinction:**
- `WHERE` filters rows BEFORE grouping
- `HAVING` filters groups AFTER grouping

### Subqueries (Nested Queries)

```sql
-- Subquery in WHERE
SELECT * FROM payments
WHERE merchant_id IN (
    SELECT id FROM merchants WHERE country = 'AU'
);

-- Subquery in FROM (derived table)
SELECT currency, avg_amount
FROM (
    SELECT currency, AVG(amount) as avg_amount
    FROM payments
    GROUP BY currency
) AS currency_stats
WHERE avg_amount > 1000;

-- Correlated subquery (references outer query)
SELECT m.name, (
    SELECT COUNT(*)
    FROM payments p
    WHERE p.merchant_id = m.id
) as payment_count
FROM merchants m;
```

### Window Functions (Advanced)

```sql
-- Running total
SELECT
    id, amount,
    SUM(amount) OVER (ORDER BY created_at) as running_total
FROM payments;

-- Rank within groups
SELECT
    merchant_id, amount,
    RANK() OVER (PARTITION BY merchant_id ORDER BY amount DESC) as rank
FROM payments;

-- Lead/Lag (compare with previous/next row)
SELECT
    id, amount,
    LAG(amount) OVER (ORDER BY created_at) as prev_amount,
    amount - LAG(amount) OVER (ORDER BY created_at) as difference
FROM payments;
```

## Common Interview Patterns

### Pattern 1: "Find top N per group"
```sql
-- Top 3 payments per merchant
SELECT * FROM (
    SELECT
        merchant_id, amount,
        ROW_NUMBER() OVER (PARTITION BY merchant_id ORDER BY amount DESC) as rn
    FROM payments
) ranked
WHERE rn <= 3;
```

### Pattern 2: "Find duplicates"
```sql
SELECT column1, COUNT(*)
FROM table_name
GROUP BY column1
HAVING COUNT(*) > 1;
```

### Pattern 3: "Year-over-year comparison"
```sql
SELECT
    EXTRACT(YEAR FROM created_at) as year,
    SUM(amount) as total
FROM payments
GROUP BY EXTRACT(YEAR FROM created_at)
ORDER BY year;
```

### Pattern 4: "Find missing records"
```sql
-- Merchants with no payments
SELECT m.name
FROM merchants m
LEFT JOIN payments p ON m.id = p.merchant_id
WHERE p.id IS NULL;
```

### Pattern 5: "Cumulative/Running aggregation"
```sql
SELECT
    created_at, amount,
    SUM(amount) OVER (ORDER BY created_at) as cumulative
FROM payments;
```

## Airwallex OA Specifics

Based on Reddit/Glassdoor:
- **Topics:** Hash tables, trees, CAP theorem, consistency models (MCQ)
- **SQL:** JOINs, GROUP BY, nested queries
- **Duration:** 75 min total (coding + MCQ + SQL)
- **Languages:** C++, Java, Python, Kotlin, Go

## Quick Reference

| Keyword | Purpose | Example |
|---------|---------|---------|
| SELECT | Choose columns | `SELECT name, amount` |
| FROM | Source table | `FROM payments` |
| WHERE | Filter rows | `WHERE status = 'completed'` |
| JOIN | Combine tables | `JOIN merchants ON ...` |
| GROUP BY | Aggregate | `GROUP BY currency` |
| HAVING | Filter groups | `HAVING COUNT(*) > 5` |
| ORDER BY | Sort | `ORDER BY amount DESC` |
| LIMIT | Cap results | `LIMIT 10` |
| DISTINCT | Unique values | `SELECT DISTINCT currency` |
| UNION | Combine results | `SELECT ... UNION SELECT ...` |
