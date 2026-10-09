# CampusWatch

> Raft-based distributed attendance & resource-booking system.  
> Built for a final-year Distributed Systems course.

## Architecture

- **3 backend nodes** (`node-a`, `node-b`, `node-c`) running a custom Raft consensus implementation
- **Next.js frontend** with 4 role-based dashboards (Teacher, Student, HOD, Admin)
- **Redis** for pub/sub messaging (leader-change events, booking notifications)
- **Resource booking** with a fair FIFO approval queue for competing requests to the same slot
- **Admin cluster monitor** with election-algorithm comparisons and a consistent global-state snapshot
- **Role-based distributed workflows:** teachers generate distributed attendance reports; HODs view distributed booking analytics; Admins inspect cluster services, serverless jobs, gateway behavior, and simulated CAP trade-offs
- **Docker Compose** orchestration

## Introduction (Unit 1)

| Topic | Where it shows up in CampusWatch |
|-------|-------------------------------|
| **Definition & goals** | Independent nodes appear as one system: any node serves reads, writes go to the leader, failures are hidden (transparency), more nodes can be added (scalability), Raft keeps them consistent |
| **Types** | Distributed *information* system (replicated records) + distributed *computing* (MapReduce, FaaS) |
| **Architectures** | Client–server (browser ↔ nodes), peer-to-peer (gossip, WebRTC), layered (UI → API → Raft → state machine), event-based (Redis Pub/Sub) |
| **Design issues** | Fault tolerance (Raft, circuit breaker), consistency vs availability (CAP tab), concurrency (fair queue), scalability (gateway), heterogeneity/openness (HTTP + JSON) |
| **Middleware** | Redis Pub/Sub (message broker), API gateway, service registry, WebSocket layer |
| **Distributed multimedia** | WebRTC peer-to-peer channel (the same transport that carries audio/video) + WebSocket streaming |
| **Model of distributed computation** *(self study)* | Processes exchanging messages; send/receive events ordered by Lamport/vector clocks (Clocks tab) |
| **Virtualization** *(self study)* | Each node is a Docker container; the whole cluster runs on an AWS EC2 virtual machine |

## Communication (Unit 2)

| Paradigm | Implementation | Code |
|----------|---------------|------|
| **RPC** | HTTP POST for Raft RPCs (RequestVote, AppendEntries); RMI-style remote invocation | `backend/src/raft/rpc.js`, `distributed/serviceRegistry.js` |
| **Stream-Oriented** | WebSocket push to Admin dashboard | `backend/src/communication/websocket.js` |
| **Message-Oriented** | Redis Pub/Sub for async notifications | `backend/src/communication/redisPubSub.js` |
| **Peer-to-Peer** | Gossip heartbeat between nodes | `backend/src/communication/gossip.js` |
| **WebRTC** | Browser-to-browser data channel; signaling relayed over WebSocket + Redis Pub/Sub (Explorer → WebRTC P2P) | `frontend/src/app/explorer/page.js` (`WebRTCDemo`) |
| **Names, identifiers, addresses** *(self study)* | Node IDs (`node-a`) resolved to addresses by Docker DNS; service discovery by name | `raft/config.js`, `distributed/serviceRegistry.js` |
| **Fault tolerance** *(self study)* | Raft re-election + log catch-up, gossip failure detection, gateway circuit breaker, client failover | `raft/raftNode.js`, `distributed/gateway.js`, `frontend/src/lib/api.js` |

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
| **Deadlock detection** *(self study, Knapp)* | Local wait-for graphs per node merged by a coordinator; DFS cycle detection (centralized class) — Explorer → Deadlock Detection | `backend/src/distributed/deadlock.js` |
| **Fair mutual exclusion** *(self study, Lodha–Kshemkalyani)* | Requests served strictly in request order (FIFO queue per slot) — the fairness property that algorithm guarantees, done here by the Raft-ordered log | `backend/src/state-machine/booking.js` |

Clocks are visible live in Explorer → Clocks.

## Emerging Paradigms (Unit 4)

| Topic | Implementation | Code |
|-------|---------------|------|
| **Distributed object-based** | Service registry + remote invocation | `distributed/serviceRegistry.js` |
| **Distributed web-based** | API gateway | `distributed/gateway.js` |
| **Distributed file system** | Files replicated through the Raft log | `state-machine/fileSystem.js` |
| **Serverless** | FaaS engine (local VM sandbox) **+ real AWS Lambda** function | `distributed/faas.js`, `aws/lambda/index.mjs` |
| **Hadoop-style MapReduce** | Map/shuffle/reduce over cluster data | `distributed/mapReduce.js` |
| **Case study: AWS** | Whole system deployed on EC2; serverless report on Lambda | `aws/` |
| **Case studies: Cloudflare / Megaport** | Edge cache + latency-aware routing in the API gateway | `distributed/gateway.js` |
| **Case study: Kubernetes** | Compose stack maps 1:1 to K8s — each node → StatefulSet pod (stable name), Redis → Deployment, Docker DNS → K8s Service DNS | `docker-compose.yml` |
| **Blockchain / distributed ledger** | Hash-chained Raft log, verifiable | `routes/blockchainRoutes.js` |
| **Distributed DB trade-offs** | CAP demonstrator | `distributed/capDemo.js` |

## AWS Deployment (Region `ap-southeast-2`)

```
            ┌──► EC2 A  campuswatch-a (t3.small): node-a :3001 + Redis + Next.js :3000 ──► Lambda Function URL
Browser ────┼──► EC2 B  campuswatch-b (t3.micro): node-b :3002                       (campuswatch-attendance-report)
            └──► EC2 C  campuswatch-c (t3.micro): node-c :3003
     Raft RPC + gossip between instances over VPC private IPs; node-b/node-c use Redis on EC2 A
```

- **EC2**: three instances, one Raft node each (`campuswatch-a/b/c`), security group `campuswatch-sg` (3000–3003 public, Redis 6379 only from the group, SSH from one IP), key `~/.ssh/campuswatch-key.pem`. Stopping an instance in the EC2 console is a real node failure — the other two keep a majority and re-elect.
- **Multi-host config**: `PEERS` accepts `node-b@<host>:3002`; the frontend learns each node's public host at runtime from `/cluster-config.js` (`NODE_HOSTS`). Both default to the single-machine Docker Compose setup.
- **Lambda**: `campuswatch-attendance-report` (Node.js 22, public Function URL). Its URL is passed to the nodes as `AWS_LAMBDA_URL` (in `.env`, not committed). Without it, the Lambda function simply doesn't appear in the FaaS list.
- **Custom FaaS functions are disabled** (HTTP 403): Node's `vm` is not a security sandbox, so letting anyone on the internet register code would mean remote code execution. Set `ALLOW_CUSTOM_FAAS=true` only for local demos.
- **CloudWatch Logs**: each node's logs go to log group `/campuswatch` (streams `node-a`, `node-b`, `node-c`, 7-day retention) via the Docker `awslogs` driver (`aws/docker-compose.aws.yml`, EC2 only). Crashes, elections and recoveries show up there. The instance role `campuswatch-ec2-role` can only write to that log group.
- **Redeploy** after code changes: `aws/deploy.sh <A-public-ip> <B-public-ip> <C-public-ip> <lambda-function-url>` (uses `aws/docker-compose.multi.yml`)
- **Save credits**: stop all three instances when not demoing; public IPs change on restart, so redeploy with the new IPs afterwards.

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
2. **Teacher** → mark attendance and generate downloadable distributed and on-demand attendance summaries
3. **Student** → submit a booking request and track its status
4. **HOD** → review distributed booking analytics and approve/reject requests in FIFO order for competing requests to the same resource and time slot → student sees status change
5. **Admin** → inspect the Raft ledger, cluster/storage reports, service directory, serverless functions, gateway routing, and CAP trade-off simulator
6. **Admin** → view live cluster, stop a node, and watch leader re-election + gossip detection
7. **Restart** the stopped node → watch log catch-up in real time
8. **Admin** → compare Raft elections with Bully and Ring simulations, then capture a consistent global-state snapshot from the common applied log prefix. Bully and Ring are simulations, not cluster protocols; estimated metrics are illustrative. The snapshot excludes in-flight messages and is not a Chandy–Lamport implementation.

## Killing a Node (Failover Demo)

From the **Admin** dashboard: **Simulate Crash** on any node → it stops Raft and gossip and refuses all traffic (the
others detect it via gossip and re-elect a leader if needed) → **Recover Node** → it rejoins as a follower and
catches up from the leader. The crashed node keeps its Raft log, as Raft assumes term/vote/log are on stable storage.

For a real process failure, stop the container itself:

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
