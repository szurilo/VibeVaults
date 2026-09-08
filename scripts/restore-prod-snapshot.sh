#!/usr/bin/env bash
#
# restore-prod-snapshot.sh
#
# Main Responsibility:
#   Restore the latest production Supabase backup into a throwaway database
#   inside the local Supabase Postgres container, then apply the migrations that
#   exist on this branch but are not yet deployed. This rehearses a migration
#   against real production data shapes (the failures a seeded staging DB can
#   never reproduce) and simultaneously proves the daily backup is restorable.
#
# Sensitive Dependencies:
#   - .github/workflows/supabase-backup.yml pushes nightly dumps to the PRIVATE
#     repo szurilo/VibeVaults-backups under daily/. If that layout or the tar
#     contents (backups/{roles,schema,data}.sql) change, this script breaks.
#   - Local Supabase must be running (`supabase start`). psql is executed inside
#     the supabase_db_* container, so no host psql install is required.
#   - `gh` CLI, authenticated, for artifact download (skip with --file).
#
# SAFETY: this NEVER touches your local dev database. It creates, and drops on
# each run, a SEPARATE database (default: prod_rehearsal) in the same Postgres
# instance. Your local Supabase data is left completely alone.

set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CONTAINER="${VV_DB_CONTAINER:-supabase_db_VibeVaults}"
SCRATCH_DB="${VV_SCRATCH_DB:-prod_rehearsal}"
BACKUP_REPO="${VV_BACKUP_REPO:-szurilo/VibeVaults-backups}"
BASE_REF="origin/main"
ARCHIVE=""
KEEP=0
KEEP_DB=0
SUCCESS=0
RUN_MIGRATIONS=1
WITH_ROLES=0

RED=$'\033[31m'; GRN=$'\033[32m'; YLW=$'\033[33m'; DIM=$'\033[2m'; BLD=$'\033[1m'; OFF=$'\033[0m'
log()  { printf '%s==>%s %s\n' "$BLD" "$OFF" "$*"; }
ok()   { printf '%s  ok%s %s\n' "$GRN" "$OFF" "$*"; }
warn() { printf '%swarn%s %s\n' "$YLW" "$OFF" "$*"; }
die()  { printf '%sfail%s %s\n' "$RED" "$OFF" "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Usage: scripts/restore-prod-snapshot.sh [options]

Restores the latest prod backup into a throwaway local database and applies
any migrations on this branch that are not yet on the base ref.

Options:
  --file <path.tar.gz>  Use a local backup archive instead of downloading.
  --base <git-ref>      Ref representing what is already deployed.
                        Default: origin/main
  --db <name>           Scratch database name. Default: prod_rehearsal
  --no-migrate          Restore only; do not apply pending migrations.
                        (Use this to test the backup on its own.)
  --with-roles          Also load roles.sql. Off by default: local Supabase
                        already has every standard role, and re-creating them
                        just prints noise.
  --keep                Keep the extracted dump directory for inspection.
  --keep-db             Keep the scratch database after a successful run.
                        By default it is dropped, so no production data is left
                        sitting in your local container. It is always kept on
                        failure so you can inspect what went wrong.
  -h, --help            Show this help.

Examples:
  scripts/restore-prod-snapshot.sh
  scripts/restore-prod-snapshot.sh --no-migrate
  scripts/restore-prod-snapshot.sh --file ~/Downloads/supabase_backup_20260907.tar.gz
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)        ARCHIVE="${2:?--file needs a path}"; shift 2 ;;
    --base)        BASE_REF="${2:?--base needs a ref}"; shift 2 ;;
    --db)          SCRATCH_DB="${2:?--db needs a name}"; shift 2 ;;
    --no-migrate)  RUN_MIGRATIONS=0; shift ;;
    --with-roles)  WITH_ROLES=1; shift ;;
    --keep)        KEEP=1; shift ;;
    --keep-db)     KEEP_DB=1; shift ;;
    -h|--help)     usage; exit 0 ;;
    *)             die "unknown option: $1 (try --help)" ;;
  esac
done

# psql inside the container. Everything is piped over stdin so the dump files
# never need to be copied into the container.
psql_db() { docker exec -i "$CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$1" "${@:2}"; }
# Same, but keeps going on error. Used for the managed-schema bootstrap, where a
# handful of failures are expected and harmless.
psql_soft() { docker exec -i "$CONTAINER" psql -X -q -U postgres -d "$1" "${@:2}"; }
# pg_cron can only live in the `postgres` database, so it is never installed in
# the scratch DB. See the shim below.
strip_pg_cron() { sed -E 's/^(CREATE EXTENSION[^;]*pg_cron[^;]*;)/-- [rehearsal] \1/I' "$1"; }

# ---------------------------------------------------------------- preflight --
log "Preflight"
command -v docker >/dev/null 2>&1 || die "docker not found"
docker info >/dev/null 2>&1        || die "docker daemon not reachable"
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" \
  || die "container '$CONTAINER' is not running. Start it with: supabase start"
psql_db postgres -c 'select 1' >/dev/null 2>&1 || die "cannot reach postgres in '$CONTAINER'"
ok "local Supabase container reachable ($CONTAINER)"

WORKDIR="$(mktemp -d -t vv-restore-XXXXXX)"
cleanup() {
  if [[ $KEEP -eq 1 ]]; then
    printf '%sdump kept at %s%s\n' "$DIM" "$WORKDIR" "$OFF"
  else
    rm -rf "$WORKDIR"
  fi
  # Do not leave production data sitting in the local container. Kept only when
  # explicitly asked for, or when the run failed and there is something to look at.
  if [[ $KEEP_DB -eq 1 || $SUCCESS -eq 0 ]]; then
    if psql_db postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$SCRATCH_DB'" 2>/dev/null | grep -q 1; then
      printf '%sscratch database "%s" kept. Inspect:  docker exec -it %s psql -U postgres -d %s%s\n' \
        "$DIM" "$SCRATCH_DB" "$CONTAINER" "$SCRATCH_DB" "$OFF"
      printf '%sDrop it with:  docker exec -i %s psql -U postgres -d postgres -c '"'"'DROP DATABASE IF EXISTS "%s" WITH (FORCE);'"'"'%s\n' \
        "$DIM" "$CONTAINER" "$SCRATCH_DB" "$OFF"
    fi
  else
    psql_db postgres -c "DROP DATABASE IF EXISTS \"$SCRATCH_DB\" WITH (FORCE);" >/dev/null 2>&1 \
      && printf '%sscratch database dropped (no production data left locally)%s\n' "$DIM" "$OFF"
  fi
}
trap cleanup EXIT

# ----------------------------------------------------------------- download --
if [[ -n "$ARCHIVE" ]]; then
  [[ -f "$ARCHIVE" ]] || die "no such file: $ARCHIVE"
  log "Using local archive"
  cp "$ARCHIVE" "$WORKDIR/backup.tar.gz"
  ok "$(basename "$ARCHIVE")"
else
  command -v gh >/dev/null 2>&1 || die "gh CLI not found (or pass --file <archive>)"
  gh auth status >/dev/null 2>&1 || die "gh is not authenticated. Run: gh auth login"

  log "Locating newest backup in $BACKUP_REPO"
  LATEST="$(gh api "repos/$BACKUP_REPO/contents/daily" --jq '.[].name' 2>/dev/null \
            | grep '^supabase_backup_.*\.tar\.gz$' | sort | tail -1)"
  [[ -n "$LATEST" ]] \
    || die "no backups found in $BACKUP_REPO. Run the workflow: gh workflow run supabase-backup.yml"
  ok "$LATEST"

  log "Downloading"
  gh api "repos/$BACKUP_REPO/contents/daily/$LATEST" \
     -H "Accept: application/vnd.github.raw" > "$WORKDIR/backup.tar.gz" \
    || die "download failed"
  [[ -s "$WORKDIR/backup.tar.gz" ]] || die "downloaded archive is empty"
  ok "$(du -h "$WORKDIR/backup.tar.gz" | cut -f1)"
fi

log "Extracting"
tar -xzf "$WORKDIR/backup.tar.gz" -C "$WORKDIR"
DUMP_DIR="$WORKDIR/backups"
[[ -d "$DUMP_DIR" ]] || die "expected a backups/ directory inside the archive"
for f in schema.sql data.sql; do
  [[ -s "$DUMP_DIR/$f" ]] || die "missing or empty: backups/$f"
done
ok "schema.sql $(du -h "$DUMP_DIR/schema.sql" | cut -f1), data.sql $(du -h "$DUMP_DIR/data.sql" | cut -f1)"

# ------------------------------------------------------------------ restore --
log "Recreating scratch database '$SCRATCH_DB'"
psql_db postgres -c "DROP DATABASE IF EXISTS \"$SCRATCH_DB\" WITH (FORCE);" >/dev/null
psql_db postgres -c "CREATE DATABASE \"$SCRATCH_DB\";" >/dev/null
ok "clean database created (your local dev DB was not touched)"

# `supabase db dump` emits ONLY the public schema and assumes it is restored
# into an already-bootstrapped Supabase database: it carries no CREATE SCHEMA
# for auth/storage/extensions, yet data.sql inserts into auth.users and
# storage.objects. So seed those managed schemas from the local Supabase
# instance, which already has them, schema-only so no dev data comes along.
log "Bootstrapping managed schemas (auth, storage, extensions, ...)"
docker exec -i "$CONTAINER" pg_dump -U postgres -d postgres \
  --schema-only --no-owner --no-privileges -N public -N supabase_migrations \
  > "$WORKDIR/bootstrap.sql"
[[ -s "$WORKDIR/bootstrap.sql" ]] || die "failed to dump local managed schemas"
# Expected failures here: the pg_cron comment, an ALTER ROLE we lack rights for,
# and the auth.users triggers whose public.* functions do not exist yet (they
# arrive with the prod schema below, and are retried afterwards).
strip_pg_cron "$WORKDIR/bootstrap.sql" | psql_soft "$SCRATCH_DB" >/dev/null 2>&1 || true
BOOTSTRAPPED="$(psql_db "$SCRATCH_DB" -tAc "SELECT count(*) FROM pg_namespace WHERE nspname IN ('auth','storage','extensions')")"
[[ "$BOOTSTRAPPED" -eq 3 ]] || die "managed schemas missing after bootstrap (got $BOOTSTRAPPED/3)"
ok "auth / storage / extensions ready"

if [[ $WITH_ROLES -eq 1 && -s "$DUMP_DIR/roles.sql" ]]; then
  log "Loading roles"
  # Roles are cluster-wide and mostly already exist locally, so tolerate errors.
  docker exec -i "$CONTAINER" psql -X -q -U postgres -d "$SCRATCH_DB" \
    < "$DUMP_DIR/roles.sql" >/dev/null 2>&1 || warn "some roles already existed (expected)"
  ok "roles processed"
fi

# pg_cron refuses to install anywhere except the database named in
# cron.database_name (always `postgres`), so a scratch DB cannot host the real
# extension. Migrations only ever call cron.schedule/cron.unschedule, so we
# stub those: the rehearsal is about schema and data, not about whether a cron
# job physically registers.
log "Installing pg_cron shim"
psql_db "$SCRATCH_DB" >/dev/null <<'SHIM'
CREATE SCHEMA IF NOT EXISTS cron;

CREATE TABLE IF NOT EXISTS cron.job (
  jobid    bigserial PRIMARY KEY,
  schedule text,
  command  text,
  nodename text    DEFAULT 'localhost',
  nodeport integer DEFAULT 5432,
  database text,
  username text,
  active   boolean DEFAULT true,
  jobname  text UNIQUE
);

CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE id bigint;
BEGIN
  INSERT INTO cron.job (schedule, command, jobname, database, username)
  VALUES (schedule, command, job_name, current_database(), current_user)
  ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule,
                                      command  = EXCLUDED.command
  RETURNING jobid INTO id;
  RETURN id;
END $$;

CREATE OR REPLACE FUNCTION cron.schedule(schedule text, command text)
RETURNS bigint LANGUAGE sql AS $$
  SELECT cron.schedule(md5(schedule || command), schedule, command);
$$;

CREATE OR REPLACE FUNCTION cron.unschedule(job_name text)
RETURNS boolean LANGUAGE sql AS $$
  DELETE FROM cron.job WHERE jobname = job_name; SELECT true;
$$;

CREATE OR REPLACE FUNCTION cron.unschedule(job_id bigint)
RETURNS boolean LANGUAGE sql AS $$
  DELETE FROM cron.job WHERE jobid = job_id; SELECT true;
$$;
SHIM
ok "cron.schedule / cron.unschedule stubbed"

log "Loading schema"
# Drop the pg_cron CREATE EXTENSION (shimmed above); everything else installs
# fine outside the postgres database.
strip_pg_cron "$DUMP_DIR/schema.sql" | psql_db "$SCRATCH_DB" --single-transaction -f - >/dev/null
ok "schema restored"

# The public.* functions now exist, so the auth.users triggers that failed
# during bootstrap can be created. Still tolerant: everything else re-runs as a
# no-op and reports "already exists".
strip_pg_cron "$WORKDIR/bootstrap.sql" | psql_soft "$SCRATCH_DB" >/dev/null 2>&1 || true
ok "auth triggers reattached"

log "Loading data"
# session_replication_role=replica disables FK/trigger enforcement for the load,
# so dump ordering cannot cause spurious failures. This is Supabase's own
# documented restore incantation.
docker exec -i "$CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$SCRATCH_DB" \
  -c 'SET session_replication_role = replica;' -f - < "$DUMP_DIR/data.sql" >/dev/null
ok "data restored"

# ------------------------------------------------------------ verify counts --
log "Verifying restore"
psql_db "$SCRATCH_DB" -P pager=off -c "
  SELECT 'profiles'          AS table, count(*) FROM profiles
  UNION ALL SELECT 'workspaces',        count(*) FROM workspaces
  UNION ALL SELECT 'workspace_members', count(*) FROM workspace_members
  UNION ALL SELECT 'projects',          count(*) FROM projects
  UNION ALL SELECT 'feedbacks',         count(*) FROM feedbacks
  UNION ALL SELECT 'feedback_replies',  count(*) FROM feedback_replies
  UNION ALL SELECT 'widget_identities', count(*) FROM widget_identities
  ORDER BY 1;"

PROFILE_COUNT="$(psql_db "$SCRATCH_DB" -tAc 'SELECT count(*) FROM profiles')"
if [[ "$PROFILE_COUNT" -eq 0 ]]; then
  die "profiles table is empty. The backup restored its schema but no rows: treat this as a FAILED backup and investigate supabase-backup.yml."
fi
ok "backup is restorable ($PROFILE_COUNT profiles)"

if [[ $RUN_MIGRATIONS -eq 0 ]]; then
  log "Done (--no-migrate)"
  SUCCESS=1
  exit 0
fi

# ------------------------------------------------------- pending migrations --
log "Determining pending migrations (not on $BASE_REF)"
if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
  warn "$BASE_REF not found locally, trying 'main'"
  BASE_REF="main"
  git rev-parse --verify --quiet "$BASE_REF" >/dev/null \
    || die "neither origin/main nor main resolves. Pass --base <ref>."
fi

mapfile -t DEPLOYED < <(git ls-tree -r --name-only "$BASE_REF" -- supabase/migrations/ \
                        | grep '\.sql$' | xargs -r -n1 basename | sort)
mapfile -t LOCAL    < <(find supabase/migrations -maxdepth 1 -name '*.sql' \
                        | xargs -r -n1 basename | sort)

PENDING=()
for m in "${LOCAL[@]}"; do
  printf '%s\n' "${DEPLOYED[@]}" | grep -qxF "$m" || PENDING+=("$m")
done

if [[ ${#PENDING[@]} -eq 0 ]]; then
  ok "no pending migrations: this branch matches $BASE_REF"
  SUCCESS=1
  printf '\n%sNothing to rehearse. The backup restore above still passed.%s\n\n' "$DIM" "$OFF"
  exit 0
fi

printf '\n%sPending migrations (%d):%s\n' "$BLD" "${#PENDING[@]}" "$OFF"
printf '  %s\n' "${PENDING[@]}"
printf '\n'

# ---------------------------------------------------------------- rehearsal --
log "Applying pending migrations against production data"
FAILED=""
for m in "${PENDING[@]}"; do
  path="supabase/migrations/$m"
  # CREATE INDEX CONCURRENTLY and friends cannot run inside a transaction.
  txn=(--single-transaction)
  if grep -qiE '\bCONCURRENTLY\b|\bVACUUM\b' "$path"; then
    txn=()
    warn "$m contains CONCURRENTLY/VACUUM: running without a wrapping transaction"
  fi
  started=$(date +%s)
  if psql_db "$SCRATCH_DB" "${txn[@]}" -f - < "$path" >/dev/null 2>"$WORKDIR/err.txt"; then
    elapsed=$(( $(date +%s) - started ))
    ok "$m (${elapsed}s)"
  else
    printf '%sfail%s %s\n' "$RED" "$OFF" "$m"
    sed 's/^/       /' "$WORKDIR/err.txt" >&2
    FAILED="$m"
    break
  fi
done

printf '\n'
if [[ -n "$FAILED" ]]; then
  printf '%s%sREHEARSAL FAILED at %s%s\n' "$BLD" "$RED" "$FAILED" "$OFF"
  printf 'This migration would have broken production. Fix it before merging to main.\n\n'
  exit 1
fi

SUCCESS=1
printf '%s%sREHEARSAL PASSED%s\n' "$BLD" "$GRN" "$OFF"
printf 'All %d pending migration(s) applied cleanly to a copy of production data.\n\n' "${#PENDING[@]}"
