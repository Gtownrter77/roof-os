#!/usr/bin/env bash
set -euo pipefail
psql -v ON_ERROR_STOP=1 -f scripts/ci/two-hour-trial-postgres.sql
