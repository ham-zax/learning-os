# Two-connection PostgreSQL last-seat exercise

Use a **disposable PostgreSQL database** and two separate `psql` connections. This lab uses actual PostgreSQL row locking and `READ COMMITTED` behavior. It makes no claim about another isolation level or a production database. `psql` and a disposable server/database must already be available; the exercise does not provision either one.

From the repository root, connect to the disposable database and run:

```text
\i knowledge/backend-systems/labs/postgres-last-seat/setup.sql
```

Open clients A and B as separate `psql` connections to that same database. In **each** client, run `BEGIN;`, `SET TRANSACTION ISOLATION LEVEL READ COMMITTED;`, then `SELECT pg_backend_pid(), stock FROM learning_os_last_seat.inventory WHERE sku = 'seat';`. Confirm that the backend PIDs differ and both initial reads show `stock = 1`.

Then, in this order:

1. In A, run `\i knowledge/backend-systems/labs/postgres-last-seat/claim.sql`. Leave A's transaction open.
2. In B, run the same `\i` command. It should wait for A's row lock. If it finishes immediately, inspect the connection and transaction setup before assessing the exercise.
3. In A, run `COMMIT;`. B should then finish its conditional update. In B, run `COMMIT;`.
4. In either client, run `SELECT stock FROM learning_os_last_seat.inventory WHERE sku = 'seat';`.

**Expected observations, after the learner commits a prediction:** both initial reads report 1; A's update returns one row with `stock = 0`; B's update returns no row after A commits; final stock is 0. The accepted/rejected decision must come from whether `RETURNING` produced a row, not from the earlier `SELECT`. Run `ROLLBACK;` in a client after any error and reset the disposable database before repeating the sequence.

The reasoning target is why B's separate read of 1 does not reserve a seat, while the guarded `UPDATE` makes the check and decrement one database operation. PostgreSQL documents that a waiting `UPDATE` at `READ COMMITTED` reevaluates its `WHERE` condition against the committed row version: [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html). A correct trace of this lab can support a prediction objective. An implementation objective requires the learner's own query/code and executable verification under a frozen contract; reading this supplied query does not establish independent implementation.

When finished, run `\i knowledge/backend-systems/labs/postgres-last-seat/cleanup.sql` in the disposable database. This removes only the lab schema created by `setup.sql`.
