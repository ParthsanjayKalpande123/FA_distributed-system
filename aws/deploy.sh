#!/bin/bash
# Copy the repo to the EC2 instance and (re)start the stack with Docker Compose.
# Usage: aws/deploy.sh <ec2-public-ip> <lambda-function-url>
set -e
HOST="ubuntu@$1"
KEY="$HOME/.ssh/campuswatch-key.pem"
cd "$(dirname "$0")/.."
tar czf - --exclude=node_modules --exclude=.next --exclude=.git . |
  ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$HOST" 'mkdir -p campuswatch && tar xzf - -C campuswatch'
ssh -i "$KEY" "$HOST" "cd campuswatch && echo 'AWS_LAMBDA_URL=$2' > .env && sudo docker compose up -d --build"
echo "Frontend: http://$1:3000"
