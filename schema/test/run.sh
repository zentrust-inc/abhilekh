#!/bin/sh
# Load schema/schema.sql into a throwaway PostgreSQL and run the gate scenario.
# Needs PostgreSQL 13+ binaries (initdb, pg_ctl). Uses a temp dir and port 54329; leaves nothing behind.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
BIN=${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
DIR=$(mktemp -d)
RUN_AS=""
[ "$(id -u)" = "0" ] && { chown -R postgres "$DIR"; RUN_AS="runuser -u postgres --"; }
$RUN_AS "$BIN/initdb" -D "$DIR/data" -A trust -U abhilekh >/dev/null
$RUN_AS "$BIN/pg_ctl" -D "$DIR/data" -o "-p 54329 -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
trap '$RUN_AS "$BIN/pg_ctl" -D "$DIR/data" -m fast stop >/dev/null; rm -rf "$DIR"' EXIT
PSQL="$BIN/psql -X -q -h $DIR -p 54329 -U abhilekh -d postgres -v ON_ERROR_STOP=1"
$PSQL -f "$HERE/../schema.sql"
$PSQL -f "$HERE/gate_test.sql"
