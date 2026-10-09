#!/bin/bash
# Deploy CampusWatch to three EC2 instances, one Raft node each:
#   A: node-a + Redis + frontend    B: node-b    C: node-c
# Usage: aws/deploy.sh <A-public-ip> <B-public-ip> <C-public-ip> <lambda-function-url>
set -e
[ $# -eq 4 ] || { echo "Usage: $0 <A-ip> <B-ip> <C-ip> <lambda-url>"; exit 1; }
KEY="$HOME/.ssh/campuswatch-key.pem"
PUB=("$1" "$2" "$3")
cd "$(dirname "$0")/.."
run() { ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "ubuntu@$1" "$2"; }

PRIV=()
for ip in "${PUB[@]}"; do PRIV+=("$(run "$ip" "hostname -I | awk '{print \$1}'")"); done

ENV="AWS_LAMBDA_URL=$4
A_PUB=${PUB[0]}
B_PUB=${PUB[1]}
C_PUB=${PUB[2]}
A_PRIV=${PRIV[0]}
B_PRIV=${PRIV[1]}
C_PRIV=${PRIV[2]}"
COMPOSE="sudo docker compose -f docker-compose.yml -f aws/docker-compose.aws.yml -f aws/docker-compose.multi.yml"
SERVICES=("redis node-a frontend" "node-b" "node-c")

for i in 0 1 2; do
  echo "== ${PUB[$i]}: ${SERVICES[$i]}"
  tar czf - --exclude=node_modules --exclude=.next --exclude=.git . | run "${PUB[$i]}" 'mkdir -p campuswatch && tar xzf - -C campuswatch'
  # rm -sf: stop anything from an older layout that should not run on this machine
  others=$(echo "node-a node-b node-c frontend redis" | tr ' ' '\n' | grep -vxF -f <(echo "${SERVICES[$i]}" | tr ' ' '\n') | tr '\n' ' ')
  run "${PUB[$i]}" "cd campuswatch && printf '%s\n' \"$ENV\" > .env && $COMPOSE rm -sf $others >/dev/null 2>&1; $COMPOSE up -d --build --no-deps ${SERVICES[$i]}"
done
echo "Frontend: http://${PUB[0]}:3000"
