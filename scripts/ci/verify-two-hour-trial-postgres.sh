#!/usr/bin/env bash
set -euo pipefail
psql -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE roofos_trial_ci'
PGDATABASE=roofos_trial_ci psql -v ON_ERROR_STOP=1 -f scripts/ci/two-hour-trial-postgres.sql
