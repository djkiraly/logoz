#!/bin/bash
# Migrate the Logoz database from Neon to a local PostgreSQL on this VPS.
#
# Run on the VPS (the box that hosts the app), from the project root, as a user
# with sudo. The migration is split into subcommands so you advance phase by
# phase with verification gates between them. Nothing destructive to production
# happens until the `cutover` step, and Neon is left fully intact as a rollback.
#
# Usage (run in this order):
#   ./deploy/migrate-neon-to-local.sh preflight     # read-only: versions + row counts
#   ./deploy/migrate-neon-to-local.sh install       # install + configure local PG
#   ./deploy/migrate-neon-to-local.sh dump          # pg_dump from Neon -> file
#   ./deploy/migrate-neon-to-local.sh restore       # restore into local PG + prisma check
#   ./deploy/migrate-neon-to-local.sh verify        # compare row counts local vs Neon
#   ./deploy/migrate-neon-to-local.sh cutover       # point .env at localhost + pm2 reload
#   ./deploy/migrate-neon-to-local.sh backup-cron   # install nightly local backups
#   ./deploy/migrate-neon-to-local.sh rollback      # revert .env to Neon + pm2 reload
#
# Optional environment overrides:
#   APP_DIR          - application directory (default: /var/www/logoz)
#   PM2_APP          - PM2 app name           (default: logoz)
#   PG_MAJOR         - Postgres major version to install (default: auto-detect Neon's)
#   LOCAL_DB         - local database name    (default: logoz)
#   LOCAL_USER       - local role name        (default: logoz)
#   BACKUP_DIR       - dump/backup directory  (default: $APP_DIR/backups)

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/logoz}"
PM2_APP="${PM2_APP:-logoz}"
LOCAL_DB="${LOCAL_DB:-logoz}"
LOCAL_USER="${LOCAL_USER:-logoz}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
ENV_FILE="$APP_DIR/.env"
PG_CONF_FILE="$APP_DIR/.pg_local.conf"   # generated; holds local PG password (chmod 600)

cd "$APP_DIR"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

die() { echo "ERROR: $*" >&2; exit 1; }

# Read a KEY="value" (or KEY=value) line from the app .env, stripping quotes.
read_env() {
  local key="$1" file="${2:-$ENV_FILE}"
  grep -E "^\s*${key}\s*=" "$file" 2>/dev/null | tail -n1 \
    | sed -E "s/^\s*${key}\s*=\s*//; s/^\"//; s/\"\s*$//; s/^'//; s/'\s*$//"
}

# Neon's pooled (PgBouncer) host cannot serve pg_dump; derive the DIRECT host by
# removing "-pooler" from the hostname. Also drop channel_binding (libpq-only).
neon_direct_url() {
  local url; url="$(read_env DATABASE_URL)"
  [ -n "$url" ] || die "DATABASE_URL not found in $ENV_FILE"
  case "$url" in
    *neon.tech*) : ;;
    *) die "DATABASE_URL does not look like a Neon URL; refusing to guess. Set it manually." ;;
  esac
  url="${url/-pooler/}"
  url="${url//&channel_binding=require/}"
  url="${url//channel_binding=require&/}"
  echo "$url"
}

local_url() {
  # Connection string for the app/admin against local PG. No SSL on localhost.
  local pw; pw="$(grep -E '^LOCAL_PG_PASSWORD=' "$PG_CONF_FILE" 2>/dev/null | cut -d= -f2-)"
  [ -n "$pw" ] || die "No local PG password found; run the 'install' step first."
  echo "postgresql://${LOCAL_USER}:${pw}@localhost:5432/${LOCAL_DB}?sslmode=disable"
}

psql_neon() { psql "$(neon_direct_url)" "$@"; }
psql_local() { PGPASSWORD="$(grep -E '^LOCAL_PG_PASSWORD=' "$PG_CONF_FILE" | cut -d= -f2-)" \
                 psql -h localhost -U "$LOCAL_USER" -d "$LOCAL_DB" "$@"; }

# List public base tables (one per line) for a given psql wrapper function.
list_tables() {
  "$1" -At -c "select tablename from pg_tables where schemaname='public' order by 1"
}

# ---------------------------------------------------------------------------
# preflight  -- read-only; capture versions and per-table row counts from Neon
# ---------------------------------------------------------------------------
cmd_preflight() {
  echo "[preflight] Checking required tooling..."
  command -v psql   >/dev/null || die "psql not found. Install postgresql-client first (the 'install' step does this)."
  command -v pg_dump>/dev/null || echo "  note: pg_dump not yet installed; 'install' step will add it."

  echo "[preflight] Neon server version:"
  psql_neon -At -c "select version();"

  echo "[preflight] Per-table row counts on Neon (save this output for verify):"
  mkdir -p "$BACKUP_DIR"
  local out="$BACKUP_DIR/neon-rowcounts.txt"
  : > "$out"
  while IFS= read -r t; do
    [ -z "$t" ] && continue
    local n; n="$(psql_neon -At -c "select count(*) from \"public\".\"$t\";")"
    printf '%-40s %s\n' "$t" "$n" | tee -a "$out"
  done < <(list_tables psql_neon)
  echo "[preflight] Wrote baseline counts to $out"
  echo "[preflight] OK. Next: ./deploy/migrate-neon-to-local.sh install"
}

# ---------------------------------------------------------------------------
# install  -- install local Postgres, create role + database (idempotent)
# ---------------------------------------------------------------------------
cmd_install() {
  # Match Neon's major version unless overridden, to avoid restore incompatibilities.
  if [ -z "${PG_MAJOR:-}" ]; then
    local v; v="$(psql_neon -At -c "show server_version;" 2>/dev/null | cut -d. -f1 || true)"
    PG_MAJOR="${v:-17}"
  fi
  echo "[install] Targeting PostgreSQL major version: $PG_MAJOR"

  if ! command -v "psql" >/dev/null || ! ls /usr/lib/postgresql/"$PG_MAJOR" >/dev/null 2>&1; then
    echo "[install] Adding PGDG apt repository and installing PostgreSQL $PG_MAJOR..."
    $SUDO apt-get update
    $SUDO apt-get install -y curl ca-certificates gnupg lsb-release
    $SUDO install -d /usr/share/postgresql-common/pgdg
    $SUDO curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
      | $SUDO tee /etc/apt/sources.list.d/pgdg.list >/dev/null
    $SUDO apt-get update
    $SUDO apt-get install -y "postgresql-$PG_MAJOR" "postgresql-client-$PG_MAJOR"
  else
    echo "[install] PostgreSQL $PG_MAJOR already present; skipping apt install."
  fi

  $SUDO systemctl enable --now postgresql

  # Generate and persist a local password once (chmod 600, app-dir).
  if [ ! -f "$PG_CONF_FILE" ]; then
    local pw; pw="$(openssl rand -hex 24)"
    umask 077
    echo "LOCAL_PG_PASSWORD=$pw" > "$PG_CONF_FILE"
    chmod 600 "$PG_CONF_FILE"
    echo "[install] Generated local DB password -> $PG_CONF_FILE (chmod 600)"
  fi
  local pw; pw="$(grep -E '^LOCAL_PG_PASSWORD=' "$PG_CONF_FILE" | cut -d= -f2-)"

  echo "[install] Creating role '$LOCAL_USER' and database '$LOCAL_DB' (idempotent)..."
  $SUDO -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${LOCAL_USER}') THEN
    CREATE ROLE ${LOCAL_USER} LOGIN PASSWORD '${pw}';
  ELSE
    ALTER ROLE ${LOCAL_USER} PASSWORD '${pw}';
  END IF;
END
\$\$;
SQL
  # CREATE DATABASE can't run inside the DO block / a transaction; guard separately.
  if ! $SUDO -u postgres psql -At -c "select 1 from pg_database where datname='${LOCAL_DB}'" | grep -q 1; then
    $SUDO -u postgres createdb -O "$LOCAL_USER" "$LOCAL_DB"
  fi

  # Headroom for PM2 cluster (one Prisma pool per worker). Raise max_connections.
  echo "[install] Raising max_connections to 200 for PM2 cluster headroom..."
  $SUDO -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER SYSTEM SET max_connections = 200;"
  $SUDO systemctl restart postgresql

  echo "[install] Local PG ready. Listening on localhost only (default)."
  echo "[install] Next: ./deploy/migrate-neon-to-local.sh dump"
}

# ---------------------------------------------------------------------------
# dump  -- pg_dump from Neon (direct host) into a compressed custom-format file
# ---------------------------------------------------------------------------
cmd_dump() {
  mkdir -p "$BACKUP_DIR"
  local stamp dump
  stamp="$(date +%Y%m%d-%H%M%S)"
  dump="$BACKUP_DIR/neon-$stamp.dump"
  echo "[dump] Dumping Neon -> $dump"
  # --no-owner/--no-privileges strip Neon's roles & grants so restore is clean.
  pg_dump -Fc --no-owner --no-privileges --no-acl "$(neon_direct_url)" -f "$dump"
  ln -sf "$(basename "$dump")" "$BACKUP_DIR/neon-latest.dump"
  echo "[dump] Wrote $dump ($(du -h "$dump" | cut -f1)) and symlink neon-latest.dump"
  echo "[dump] Next: ./deploy/migrate-neon-to-local.sh restore"
}

# ---------------------------------------------------------------------------
# restore  -- load the dump into local PG, then confirm schema with Prisma
# ---------------------------------------------------------------------------
cmd_restore() {
  local dump="$BACKUP_DIR/neon-latest.dump"
  [ -f "$dump" ] || die "No dump at $dump; run the 'dump' step first."
  echo "[restore] Restoring $dump into local '$LOCAL_DB'..."
  # Not --exit-on-error: stray Neon-internal objects may warn; the prisma db push
  # below and the verify step are the real correctness gates. Log is captured.
  local log="$BACKUP_DIR/restore-$(date +%Y%m%d-%H%M%S).log"
  PGPASSWORD="$(grep -E '^LOCAL_PG_PASSWORD=' "$PG_CONF_FILE" | cut -d= -f2-)" \
    pg_restore --no-owner --no-privileges --clean --if-exists \
      -h localhost -U "$LOCAL_USER" -d "$LOCAL_DB" "$dump" 2> >(tee "$log" >&2) || true
  echo "[restore] Restore log: $log"

  echo "[restore] Confirming schema matches Prisma (expect 'already in sync')..."
  DATABASE_URL="$(local_url)" DIRECT_URL="$(local_url)" npx prisma db push --skip-generate
  DATABASE_URL="$(local_url)" npx prisma generate
  echo "[restore] Next: ./deploy/migrate-neon-to-local.sh verify"
}

# ---------------------------------------------------------------------------
# verify  -- compare per-table row counts: local vs Neon
# ---------------------------------------------------------------------------
cmd_verify() {
  echo "[verify] Comparing per-table row counts (local vs Neon)..."
  local mismatch=0
  while IFS= read -r t; do
    [ -z "$t" ] && continue
    local ln nn
    ln="$(psql_local -At -c "select count(*) from \"public\".\"$t\";" 2>/dev/null || echo MISSING)"
    nn="$(psql_neon  -At -c "select count(*) from \"public\".\"$t\";" 2>/dev/null || echo MISSING)"
    if [ "$ln" = "$nn" ]; then
      printf '  OK   %-36s local=%s neon=%s\n' "$t" "$ln" "$nn"
    else
      printf '  DIFF %-36s local=%s neon=%s\n' "$t" "$ln" "$nn"
      mismatch=1
    fi
  done < <(list_tables psql_neon)
  if [ "$mismatch" -ne 0 ]; then
    die "Row counts differ. Do NOT cut over. Investigate before proceeding."
  fi
  echo "[verify] All table row counts match. Safe to cut over."
  echo "[verify] Next: ./deploy/migrate-neon-to-local.sh cutover"
}

# ---------------------------------------------------------------------------
# cutover  -- repoint .env at localhost, keep Neon URLs as *_NEON, reload PM2
# ---------------------------------------------------------------------------
cmd_cutover() {
  # Connection-limit per Prisma client so PM2's per-core workers stay under
  # Postgres max_connections. cores * limit should be < 200 (set in install).
  local cores; cores="$(nproc)"
  local limit=$(( 180 / (cores>0 ? cores : 1) ))
  [ "$limit" -lt 5 ] && limit=5
  local url; url="$(local_url)&connection_limit=${limit}&pool_timeout=20"

  # Back up .env, then move Neon URLs to *_NEON and set the local ones.
  cp "$ENV_FILE" "$ENV_FILE.bak-$(date +%Y%m%d-%H%M%S)"
  local neon_db neon_direct
  neon_db="$(read_env DATABASE_URL)"
  neon_direct="$(read_env DIRECT_URL)"

  # Preserve Neon as rollback (only add once).
  grep -q '^DATABASE_URL_NEON=' "$ENV_FILE" || echo "DATABASE_URL_NEON=\"$neon_db\"" >> "$ENV_FILE"
  grep -q '^DIRECT_URL_NEON='   "$ENV_FILE" || echo "DIRECT_URL_NEON=\"$neon_direct\"" >> "$ENV_FILE"

  # Repoint the active URLs to local.
  sed -i -E "s|^(\s*DATABASE_URL\s*=).*|\1\"$url\"|" "$ENV_FILE"
  sed -i -E "s|^(\s*DIRECT_URL\s*=).*|\1\"$(local_url)\"|" "$ENV_FILE"

  echo "[cutover] .env now points at local PG (connection_limit=$limit across $cores cores)."
  echo "[cutover] Neon preserved as DATABASE_URL_NEON / DIRECT_URL_NEON for rollback."

  echo "[cutover] Reloading app under PM2 to pick up new env..."
  pm2 reload ecosystem.config.cjs --update-env
  pm2 save
  echo "[cutover] Done. Smoke-test the app now."
  echo "[cutover] If anything is wrong: ./deploy/migrate-neon-to-local.sh rollback"
  echo "[cutover] When stable for a few days: install backups -> backup-cron, then delete the Neon project."
}

# ---------------------------------------------------------------------------
# backup-cron  -- nightly local pg_dump with rotation (our new safety net)
# ---------------------------------------------------------------------------
cmd_backup_cron() {
  local script="$APP_DIR/deploy/pg-backup.sh"
  cat > "$script" <<'EOS'
#!/bin/bash
# Nightly local Postgres backup with 14-day rotation. Installed by
# migrate-neon-to-local.sh backup-cron. Consider shipping $DEST off-box too.
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/logoz}"
DEST="${BACKUP_DIR:-$APP_DIR/backups}/nightly"
DB="${LOCAL_DB:-logoz}"
USER="${LOCAL_USER:-logoz}"
PW="$(grep -E '^LOCAL_PG_PASSWORD=' "$APP_DIR/.pg_local.conf" | cut -d= -f2-)"
mkdir -p "$DEST"
PGPASSWORD="$PW" pg_dump -Fc --no-owner --no-privileges \
  -h localhost -U "$USER" "$DB" -f "$DEST/$DB-$(date +\%Y\%m\%d).dump"
find "$DEST" -name "$DB-*.dump" -mtime +14 -delete
EOS
  chmod +x "$script"
  # Install a root cron entry at 03:15 nightly (idempotent).
  local line="15 3 * * * APP_DIR=$APP_DIR $script >> /var/log/logoz/pg-backup.log 2>&1"
  ( $SUDO crontab -l 2>/dev/null | grep -v "$script"; echo "$line" ) | $SUDO crontab -
  echo "[backup-cron] Installed nightly backup at 03:15 -> $APP_DIR/backups/nightly (14-day rotation)."
  echo "[backup-cron] Running one backup now to confirm it works..."
  APP_DIR="$APP_DIR" "$script"
  echo "[backup-cron] OK. IMPORTANT: also ship these dumps off-box (object storage) for real safety."
}

# ---------------------------------------------------------------------------
# rollback  -- revert active URLs to Neon, reload PM2
# ---------------------------------------------------------------------------
cmd_rollback() {
  local neon_db neon_direct
  neon_db="$(read_env DATABASE_URL_NEON)"
  neon_direct="$(read_env DIRECT_URL_NEON)"
  [ -n "$neon_db" ] || die "DATABASE_URL_NEON not found; cannot auto-rollback. Restore from an .env.bak-* file."
  sed -i -E "s|^(\s*DATABASE_URL\s*=).*|\1\"$neon_db\"|" "$ENV_FILE"
  sed -i -E "s|^(\s*DIRECT_URL\s*=).*|\1\"$neon_direct\"|" "$ENV_FILE"
  pm2 reload ecosystem.config.cjs --update-env
  pm2 save
  echo "[rollback] Reverted to Neon and reloaded PM2."
}

# ---------------------------------------------------------------------------
case "${1:-}" in
  preflight)    cmd_preflight ;;
  install)      cmd_install ;;
  dump)         cmd_dump ;;
  restore)      cmd_restore ;;
  verify)       cmd_verify ;;
  cutover)      cmd_cutover ;;
  backup-cron)  cmd_backup_cron ;;
  rollback)     cmd_rollback ;;
  *)
    echo "Usage: $0 {preflight|install|dump|restore|verify|cutover|backup-cron|rollback}"
    exit 1
    ;;
esac
