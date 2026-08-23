# CampusWatch

> Raft-based distributed attendance & resource-booking system.  
> Built for a final-year Distributed Systems course.

## Architecture

- **3 backend nodes** (`node-a`, `node-b`, `node-c`) running a custom Raft consensus implementation
- **Next.js frontend** with 4 role-based dashboards (Teacher, Student, HOD, Admin)
- **Redis** for pub/sub messaging (leader-change events, booking notifications)
- **Docker Compose** orchestration

## Communication Paradigms (Unit 2)

| Paradigm | Implementation | Code |
|----------|---------------|------|
| **RPC** | HTTP POST for Raft RPCs (RequestVote, AppendEntries) | `backend/src/raft/rpc.js` |
| **Stream-Oriented** | WebSocket push to Admin dashboard | `backend/src/communication/websocket.js` |
| **Message-Oriented** | Redis Pub/Sub for async notifications | `backend/src/communication/redisPubSub.js` |
| **Peer-to-Peer** | Gossip heartbeat between nodes | `backend/src/communication/gossip.js` |

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
4. **HOD** → approve/reject the booking → student sees status change
5. **Admin** → view live cluster, kill a node → watch leader re-election + gossip detection
6. **Restart** killed node → watch log catch-up in real time

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
