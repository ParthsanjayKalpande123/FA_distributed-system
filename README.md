# CampusWatch

> Raft-based distributed attendance & resource-booking system.  
> Built for a final-year Distributed Systems course.

## Architecture

- **3 backend nodes** (`node-a`, `node-b`, `node-c`) running a custom Raft consensus implementation
- **Next.js frontend** with 4 role-based dashboards (Teacher, Student, HOD, Admin)
- **Redis** for pub/sub messaging (leader-change events, booking notifications)
- **Resource booking** with a fair FIFO approval queue for competing requests to the same slot
- **Admin cluster monitor** with election-algorithm comparisons and a consistent global-state snapshot
- **Docker Compose** orchestration

## Communication Paradigms (Unit 2)

| Paradigm | Implementation | Code |
|----------|---------------|------|
| **RPC** | HTTP POST for Raft RPCs (RequestVote, AppendEntries) | `backend/src/raft/rpc.js` |
| **Stream-Oriented** | WebSocket push to Admin dashboard | `backend/src/communication/websocket.js` |
| **Message-Oriented** | Redis Pub/Sub for async notifications | `backend/src/communication/redisPubSub.js` |
| **Peer-to-Peer** | Gossip heartbeat between nodes | `backend/src/communication/gossip.js` |

## Synchronization (Unit 3)

| Topic | Implementation | Code / Endpoint |
|-------|---------------|-----------------|
| **Logical clocks — Lamport** | `max(local, msg) + 1`, carried on every gossip message | `backend/src/distributed/clocks.js` · `GET /api/clocks` |
| **Vector clocks** | Element-wise max + own tick; `happenedBefore()` detects causality vs concurrency | same |
| **Physical clock sync — Cristian** | Offset = `serverTime + RTT/2 − localTime` on each gossip pong | same (`cristianOffsets`) |
| **Beacon / heartbeat** | Periodic gossip ping every 1 s, peer marked dead after 3 s | `backend/src/communication/gossip.js` |
| **Election** | Raft leader election (real); Bully & Ring compared in simulation | `backend/src/raft/raftNode.js`, `distributed/electionComparison.js` |
| **Mutual exclusion** | Centralized: Raft leader serializes bookings; FIFO fair queue per resource slot | `backend/src/state-machine/booking.js` |
| **Global state** | Consistent cut from the common committed Raft log prefix | `backend/src/distributed/globalSnapshot.js` |

## Emerging Paradigms (Unit 4)

| Topic | Implementation | Code |
|-------|---------------|------|
| **Distributed object-based** | Service registry + remote invocation | `distributed/serviceRegistry.js` |
| **Distributed web-based** | API gateway | `distributed/gateway.js` |
| **Distributed file system** | Files replicated through the Raft log | `state-machine/fileSystem.js` |
| **Serverless** | FaaS engine (local VM sandbox) **+ real AWS Lambda** function | `distributed/faas.js`, `aws/lambda/index.mjs` |
| **Hadoop-style MapReduce** | Map/shuffle/reduce over cluster data | `distributed/mapReduce.js` |
| **Case study: AWS** | Whole system deployed on EC2; serverless report on Lambda | `aws/` |
| **Blockchain / distributed ledger** | Hash-chained Raft log, verifiable | `routes/blockchainRoutes.js` |
| **Distributed DB trade-offs** | CAP demonstrator | `distributed/capDemo.js` |

## AWS Deployment (Region `ap-southeast-2`)

```
Browser ──► EC2 t3.small (Docker Compose: 3 Raft nodes + Redis + Next.js)
                │  FaaS "Attendance Report (AWS Lambda)"
                └──► Lambda Function URL ── campuswatch-attendance-report
```

- **EC2**: `campuswatch` instance, security group `campuswatch-sg` (3000–3003 public, SSH from one IP), key `~/.ssh/campuswatch-key.pem`.
- **Lambda**: `campuswatch-attendance-report` (Node.js 22, public Function URL). Its URL is passed to the nodes as `AWS_LAMBDA_URL` (in `.env`, not committed). Without it, the Lambda function simply doesn't appear in the FaaS list.
- **Redeploy** after code changes: `aws/deploy.sh <ec2-public-ip> <lambda-function-url>`
- **Save credits**: `aws ec2 stop-instances --instance-ids <id>` when not demoing (the public IP changes on restart).

## Quick Start

```bash
# Boot everything
docker compose up --build

# Frontend:  http://localhost:3000
# Node A:    http://localhost:3001/health
# Node B:    http://localhost:3002/health
# Node C:    http://localhost:3003/health
```

## Demo Walkthrough

1. **Login** → pick a role (Teacher / Student / HOD / Admin)
2. **Teacher** → mark attendance → verify it's replicated on all nodes
3. **Student** → submit a booking request
4. **HOD** → approve/reject the booking in FIFO order for requests competing for the same resource and time slot → student sees status change
5. **Admin** → view live cluster, kill a node → watch leader re-election + gossip detection
6. **Restart** killed node → watch log catch-up in real time
7. **Admin** → compare Raft elections with Bully and Ring simulations, then capture a consistent global-state snapshot from the common applied log prefix. Bully and Ring are simulations, not cluster protocols; estimated metrics are illustrative. The snapshot excludes in-flight messages and is not a Chandy–Lamport implementation.

## Killing a Node (Failover Demo)

```bash
# Stop a node
docker compose stop node-b

# Watch leader re-election in Admin dashboard (~3 sec)

# Restart the node — it catches up automatically
docker compose start node-b
```

## Hardcoded Users

| User ID | Name | Role |
|---------|------|------|
| T001 | Dr. Sharma | Teacher |
| T002 | Dr. Patel | Teacher |
| S001 | Rahul Kumar | Student |
| S002 | Priya Singh | Student |
| S003 | Amit Verma | Student |
| S004 | Sneha Gupta | Student |
| S005 | Vikram Reddy | Student |
| HOD001 | Prof. Iyer | HOD |
| ADMIN001 | System Admin | Admin |

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** Next.js 14 (App Router)
- **Consensus:** Custom Raft implementation
- **Message Bus:** Redis Pub/Sub
- **Containerisation:** Docker Compose
