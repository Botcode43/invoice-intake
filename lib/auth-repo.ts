import { pool } from "./db";

export interface UserRecord {
  id: string;
  email: string;
  tenantId: string;
  createdAt: string;
}

export interface UserWithPassword extends UserRecord {
  passwordHash: string;
}

/**
 * Creates a new user in the database.
 */
export async function createUser(
  email: string,
  passwordHash: string,
  tenantId: string
): Promise<UserRecord> {
  const result = await pool.query(
    `
    INSERT INTO users (email, password_hash, tenant_id)
    VALUES ($1, $2, $3)
    RETURNING id, email, tenant_id AS "tenantId", created_at AS "createdAt"
    `,
    [email.toLowerCase().trim(), passwordHash, tenantId.trim()]
  );

  return result.rows[0];
}

/**
 * Finds a user by email, returning the password hash for credential verification.
 */
export async function findUserByEmail(email: string): Promise<UserWithPassword | null> {
  const result = await pool.query(
    `
    SELECT id, email, password_hash AS "passwordHash", tenant_id AS "tenantId", created_at AS "createdAt"
    FROM users
    WHERE email = $1
    `,
    [email.toLowerCase().trim()]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Finds a user by ID (for profile / session verification).
 */
export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await pool.query(
    `
    SELECT id, email, tenant_id AS "tenantId", created_at AS "createdAt"
    FROM users
    WHERE id = $1
    `,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}
