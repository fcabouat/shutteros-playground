#!/bin/sh
# Runs inside the freshly installed target through curtin in-target.
set -eu
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
payload=${1:-/opt/shutteros-provisioning}
exec python3 -B "$payload/kit/autoinstall/payload.py" install-debs "$payload"
