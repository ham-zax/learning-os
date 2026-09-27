-- Run only in a disposable PostgreSQL database made for this exercise.
-- Fails if an earlier lab schema is still present; it never overwrites it.
CREATE SCHEMA learning_os_last_seat;

CREATE TABLE learning_os_last_seat.inventory (
  sku text PRIMARY KEY,
  stock integer NOT NULL CHECK (stock >= 0)
);

INSERT INTO learning_os_last_seat.inventory (sku, stock) VALUES ('seat', 1);
