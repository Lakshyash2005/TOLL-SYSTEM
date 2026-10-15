#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate

# Auto-create admin accounts on build
python manage.py create_admin --username "${ADMIN_USERNAME:-Lakshya09}" --password "${ADMIN_PASSWORD:-admin123}" --force || true
python manage.py create_admin --username admin1 --password admin123 --force || true
