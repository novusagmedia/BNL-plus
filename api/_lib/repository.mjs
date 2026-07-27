/**
 * Assessment submission store — handoff §13.
 *
 * Two implementations behind one interface:
 *
 *   Postgres  — production. Idempotency is enforced by the database's unique
 *               constraint on client_submission_id, not by a read-then-write
 *               check, so two concurrent requests cannot both insert.
 *   In-memory — local development and tests only. Loses everything on cold
 *               start, so it refuses to run when NODE_ENV is production.
 *
 * The repository never talks to GoHighLevel. It only records what the CRM
 * sync did, so a failed sync is retryable from stored data rather than from a
 * replayed browser request (§13.3).
 */

const SYNC_STATUSES = ["pending", "synced", "retry_required", "permanent_failure"];

/* ============================================================
   In-memory implementation
   ============================================================ */

function createInMemoryRepository() {
  const byId = new Map();
  const byClientSubmissionId = new Map();

  return {
    kind: "memory",

    async findByClientSubmissionId(clientSubmissionId) {
      const id = byClientSubmissionId.get(clientSubmissionId);
      return id ? structuredClone(byId.get(id)) : null;
    },

    async findById(id) {
      const row = byId.get(id);
      return row ? structuredClone(row) : null;
    },

    async create(record) {
      // Mirror the unique constraint: an existing key wins, it never duplicates.
      const existing = byClientSubmissionId.get(record.clientSubmissionId);
      if (existing) return structuredClone(byId.get(existing));

      const now = new Date().toISOString();
      const row = {
        ...structuredClone(record),
        id: record.id ?? crypto.randomUUID(),
        ghlContactId: null,
        ghlSyncStatus: "pending",
        ghlSyncAttempts: 0,
        ghlLastAttemptAt: null,
        ghlLastErrorCode: null,
        workflowEnrolledAt: null,
        createdAt: now,
        updatedAt: now,
      };

      byId.set(row.id, row);
      byClientSubmissionId.set(row.clientSubmissionId, row.id);
      return structuredClone(row);
    },

    async recordGhlSync(id, { status, contactId = null, errorCode = null }) {
      assertStatus(status);
      const row = byId.get(id);
      if (!row) return null;

      row.ghlSyncStatus = status;
      row.ghlSyncAttempts += 1;
      row.ghlLastAttemptAt = new Date().toISOString();
      row.ghlLastErrorCode = errorCode;
      if (contactId) row.ghlContactId = contactId;
      row.updatedAt = row.ghlLastAttemptAt;

      return structuredClone(row);
    },

    async markWorkflowEnrolled(id, at = new Date().toISOString()) {
      const row = byId.get(id);
      if (!row) return null;
      // §13.3: enrollment happens once and only once.
      if (row.workflowEnrolledAt) return structuredClone(row);

      row.workflowEnrolledAt = at;
      row.updatedAt = at;
      return structuredClone(row);
    },

    async close() {},
  };
}

/* ============================================================
   Postgres implementation
   ============================================================ */

const COLUMNS = `
  id, client_submission_id, first_name, normalized_email, normalized_phone,
  age_range, training_environment, main_goal, biggest_obstacle,
  email_consent, sms_consent, consent_timestamp,
  answers_json, scores_json, results_json, attribution_json,
  assessment_version, scoring_version, result_content_version, result_token_version,
  ghl_contact_id, ghl_sync_status, ghl_sync_attempts, ghl_last_attempt_at,
  ghl_last_error_code, workflow_enrolled_at, created_at, updated_at
`;

function toRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    clientSubmissionId: r.client_submission_id,
    firstName: r.first_name,
    email: r.normalized_email,
    phone: r.normalized_phone,
    ageRange: r.age_range,
    trainingEnvironment: r.training_environment,
    mainGoal: r.main_goal,
    biggestObstacle: r.biggest_obstacle,
    emailConsent: r.email_consent,
    smsConsent: r.sms_consent,
    consentedAt: r.consent_timestamp?.toISOString?.() ?? r.consent_timestamp,
    answers: r.answers_json,
    scores: r.scores_json,
    results: r.results_json,
    attribution: r.attribution_json,
    assessmentVersion: r.assessment_version,
    scoringVersion: r.scoring_version,
    resultContentVersion: r.result_content_version,
    resultTokenVersion: r.result_token_version,
    ghlContactId: r.ghl_contact_id,
    ghlSyncStatus: r.ghl_sync_status,
    ghlSyncAttempts: r.ghl_sync_attempts,
    ghlLastAttemptAt: r.ghl_last_attempt_at?.toISOString?.() ?? r.ghl_last_attempt_at,
    ghlLastErrorCode: r.ghl_last_error_code,
    workflowEnrolledAt: r.workflow_enrolled_at?.toISOString?.() ?? r.workflow_enrolled_at,
    createdAt: r.created_at?.toISOString?.() ?? r.created_at,
    updatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}

// One pool per process: serverless reuses warm containers, and a pool per
// invocation would exhaust Postgres connection limits under load.
let pool = null;

async function getPool(connectionString) {
  if (pool) return pool;

  // Test hook: repository.postgres.test.mjs substitutes an in-process Postgres
  // (PGlite) here so the real migration and the real queries are exercised
  // without a live database. Never set in production.
  const pg = globalThis.__PG_OVERRIDE__ ?? (await import("pg")).default;

  pool = new pg.Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    ssl: sslOptions(connectionString),
  });
  return pool;
}

/**
 * TLS settings for the database connection.
 *
 * Certificates are VERIFIED by default. This connection carries every lead's
 * email, phone, and consent record, and `rejectUnauthorized: false` — the
 * common copy-paste default — accepts any certificate at all, which makes a
 * man-in-the-middle trivial. Neon, Supabase, and Vercel Postgres all present
 * publicly-trusted certificates, so verification simply works.
 *
 * Escape hatches, both explicit and opt-in:
 *   sslmode=disable        local Postgres with no TLS
 *   PGSSL_NO_VERIFY=true   a provider using a self-signed certificate
 */
function sslOptions(connectionString) {
  if (connectionString.includes("sslmode=disable")) return false;
  if (process.env.PGSSL_NO_VERIFY === "true") return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}

function createPostgresRepository(connectionString) {
  const query = async (text, params) => {
    const client = await getPool(connectionString);
    return client.query(text, params);
  };

  return {
    kind: "postgres",

    async findByClientSubmissionId(clientSubmissionId) {
      const { rows } = await query(
        `select ${COLUMNS} from assessment_submissions where client_submission_id = $1`,
        [clientSubmissionId],
      );
      return toRow(rows[0]);
    },

    async findById(id) {
      const { rows } = await query(
        `select ${COLUMNS} from assessment_submissions where id = $1`,
        [id],
      );
      return toRow(rows[0]);
    },

    async create(record) {
      try {
        const { rows } = await query(
          `insert into assessment_submissions (
             client_submission_id, first_name, normalized_email, normalized_phone,
             age_range, training_environment, main_goal, biggest_obstacle,
             email_consent, sms_consent, consent_timestamp,
             answers_json, scores_json, results_json, attribution_json,
             assessment_version, scoring_version, result_content_version
           ) values (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
           ) returning ${COLUMNS}`,
          [
            record.clientSubmissionId, record.firstName, record.email, record.phone,
            record.ageRange, record.trainingEnvironment, record.mainGoal, record.biggestObstacle,
            record.emailConsent, record.smsConsent, record.consentedAt,
            JSON.stringify(record.answers), JSON.stringify(record.scores),
            JSON.stringify(record.results), JSON.stringify(record.attribution),
            record.assessmentVersion, record.scoringVersion, record.resultContentVersion,
          ],
        );
        return toRow(rows[0]);
      } catch (error) {
        // 23505 = unique_violation. Two requests raced on the same submission
        // id; the loser reads the winner's row rather than erroring (§13.3).
        if (error?.code === "23505") {
          return this.findByClientSubmissionId(record.clientSubmissionId);
        }
        throw error;
      }
    },

    async recordGhlSync(id, { status, contactId = null, errorCode = null }) {
      assertStatus(status);
      const { rows } = await query(
        `update assessment_submissions set
           ghl_sync_status = $2,
           ghl_sync_attempts = ghl_sync_attempts + 1,
           ghl_last_attempt_at = now(),
           ghl_last_error_code = $3,
           ghl_contact_id = coalesce($4, ghl_contact_id)
         where id = $1
         returning ${COLUMNS}`,
        [id, status, errorCode, contactId],
      );
      return toRow(rows[0]);
    },

    async markWorkflowEnrolled(id) {
      // The `is null` guard makes double enrollment impossible even under a race.
      const { rows } = await query(
        `update assessment_submissions
            set workflow_enrolled_at = now()
          where id = $1 and workflow_enrolled_at is null
          returning ${COLUMNS}`,
        [id],
      );
      return rows[0] ? toRow(rows[0]) : this.findById(id);
    },

    async close() {
      if (pool) {
        await pool.end();
        pool = null;
      }
    },
  };
}

/* ============================================================
   Factory
   ============================================================ */

// Memoized per process. This is not just an optimization: a fresh in-memory
// store on every request would silently break idempotency, since the replay
// lookup would never find the original row. Postgres keeps its own pool
// singleton, so memoizing here is consistent for both implementations.
let defaultRepository = null;

export function createRepository({
  databaseUrl = process.env.DATABASE_URL,
  allowMemory = process.env.NODE_ENV !== "production",
} = {}) {
  if (defaultRepository) return defaultRepository;

  if (databaseUrl) {
    defaultRepository = createPostgresRepository(databaseUrl);
    return defaultRepository;
  }

  if (!allowMemory) {
    throw new Error(
      "DATABASE_URL is required in production — refusing to store submissions in memory.",
    );
  }

  console.warn(
    JSON.stringify({
      scope: "repository",
      warning: "DATABASE_URL is not set — using the in-memory store. Submissions are lost on restart.",
    }),
  );
  defaultRepository = createInMemoryRepository();
  return defaultRepository;
}

/**
 * Test hook: drop the memoized instance so a suite can start clean.
 * Clears the connection pool too — leaving it behind would hand the next
 * repository a pool pointing at the previous (already closed) database.
 */
export function resetRepository() {
  defaultRepository = null;
  pool = null;
}

export { createInMemoryRepository };

function assertStatus(status) {
  if (!SYNC_STATUSES.includes(status)) {
    throw new RangeError(`Unknown ghl_sync_status: ${status}`);
  }
}
