-- Run inside each client's READ COMMITTED transaction.
-- One returned row means accepted; no returned row means rejected.
UPDATE learning_os_last_seat.inventory
SET stock = stock - 1
WHERE sku = 'seat' AND stock > 0
RETURNING sku, stock;
