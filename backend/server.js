const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, "data.json");

// load data from file, make a fresh one if it does not exist
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      users: [{ username: "manager", password: "manager123" }],
      queues: [],
      tokens: []
    };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function makeId() {
  return Date.now().toString() + Math.floor(Math.random() * 1000);
}

// login
app.post("/api/login", (req, res) => {
  const data = loadData();
  const user = data.users.find(
    (u) => u.username === req.body.username && u.password === req.body.password
  );
  if (!user) {
    return res.status(401).json({ error: "wrong username or password" });
  }
  res.json({ username: user.username });
});

// get all queues
app.get("/api/queues", (req, res) => {
  const data = loadData();
  res.json(data.queues);
});

// create a queue
app.post("/api/queues", (req, res) => {
  const data = loadData();
  if (!req.body.name) {
    return res.status(400).json({ error: "queue name is required" });
  }
  const queue = { id: makeId(), name: req.body.name, createdAt: Date.now() };
  data.queues.push(queue);
  saveData(data);
  res.json(queue);
});

// delete a queue and its tokens
app.delete("/api/queues/:id", (req, res) => {
  const data = loadData();
  data.queues = data.queues.filter((q) => q.id !== req.params.id);
  data.tokens = data.tokens.filter((t) => t.queueId !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// get tokens of one queue, waiting first in order
app.get("/api/queues/:id/tokens", (req, res) => {
  const data = loadData();
  const tokens = data.tokens
    .filter((t) => t.queueId === req.params.id)
    .sort((a, b) => a.position - b.position);
  res.json(tokens);
});

// add a person to a queue, this creates a token
app.post("/api/queues/:id/tokens", (req, res) => {
  const data = loadData();
  if (!req.body.name) {
    return res.status(400).json({ error: "person name is required" });
  }
  const sameQueue = data.tokens.filter((t) => t.queueId === req.params.id);
  const tokenNo = sameQueue.length + 1;
  const position = sameQueue.length + 1;
  const token = {
    id: makeId(),
    queueId: req.params.id,
    tokenNo: tokenNo,
    name: req.body.name,
    status: "waiting",
    position: position,
    createdAt: Date.now(),
    servedAt: null
  };
  data.tokens.push(token);
  saveData(data);
  res.json(token);
});

// move a token up or down, just swap its position with the neighbour
function moveToken(id, dir) {
  const data = loadData();
  const token = data.tokens.find((t) => t.id === id);
  if (!token || token.status !== "waiting") return null;
  const waiting = data.tokens
    .filter((t) => t.queueId === token.queueId && t.status === "waiting")
    .sort((a, b) => a.position - b.position);
  const i = waiting.findIndex((t) => t.id === id);
  const other = dir === "up" ? waiting[i - 1] : waiting[i + 1];
  if (!other) return token;
  const temp = token.position;
  token.position = other.position;
  other.position = temp;
  saveData(data);
  return token;
}

app.post("/api/tokens/:id/up", (req, res) => {
  const token = moveToken(req.params.id, "up");
  if (!token) return res.status(404).json({ error: "token not found" });
  res.json(token);
});

app.post("/api/tokens/:id/down", (req, res) => {
  const token = moveToken(req.params.id, "down");
  if (!token) return res.status(404).json({ error: "token not found" });
  res.json(token);
});

// serve the token at the top of the queue
app.post("/api/queues/:id/serve-next", (req, res) => {
  const data = loadData();
  const next = data.tokens
    .filter((t) => t.queueId === req.params.id && t.status === "waiting")
    .sort((a, b) => a.position - b.position)[0];
  if (!next) {
    return res.status(400).json({ error: "no one is waiting in this queue" });
  }
  next.status = "serving";
  next.servedAt = Date.now();
  saveData(data);
  res.json(next);
});

// mark a serving token as done
app.post("/api/tokens/:id/done", (req, res) => {
  const data = loadData();
  const token = data.tokens.find((t) => t.id === req.params.id);
  if (!token) return res.status(404).json({ error: "token not found" });
  token.status = "done";
  saveData(data);
  res.json(token);
});

// cancel a token
app.post("/api/tokens/:id/cancel", (req, res) => {
  const data = loadData();
  const token = data.tokens.find((t) => t.id === req.params.id);
  if (!token) return res.status(404).json({ error: "token not found" });
  token.status = "cancelled";
  saveData(data);
  res.json(token);
});

// dashboard stats
app.get("/api/dashboard", (req, res) => {
  const data = loadData();
  const today = new Date().toDateString();

  const waiting = data.tokens.filter((t) => t.status === "waiting");
  const serving = data.tokens.filter((t) => t.status === "serving");
  const served = data.tokens.filter(
    (t) =>
      (t.status === "done" || t.status === "serving") &&
      t.servedAt &&
      new Date(t.servedAt).toDateString() === today
  );

  // average wait time in minutes, only for tokens that got served
  let totalWait = 0;
  let servedCount = 0;
  for (const t of data.tokens) {
    if (t.servedAt) {
      totalWait += (t.servedAt - t.createdAt) / 60000;
      servedCount++;
    }
  }
  const avgWait = servedCount === 0 ? 0 : Math.round((totalWait / servedCount) * 10) / 10;

  // per queue numbers for the chart
  const queues = data.queues.map((q) => {
    const qtokens = data.tokens.filter((t) => t.queueId === q.id);
    const qserved = qtokens.filter((t) => t.servedAt);
    let qwait = 0;
    for (const t of qserved) qwait += (t.servedAt - t.createdAt) / 60000;
    return {
      id: q.id,
      name: q.name,
      waiting: qtokens.filter((t) => t.status === "waiting").length,
      serving: qtokens.filter((t) => t.status === "serving").length,
      served: qserved.length,
      avgWait: qserved.length === 0 ? 0 : Math.round((qwait / qserved.length) * 10) / 10
    };
  });

  // last served tokens, newest first
  const recent = data.tokens
    .filter((t) => t.servedAt)
    .sort((a, b) => b.servedAt - a.servedAt)
    .slice(0, 10)
    .map((t) => ({
      tokenNo: t.tokenNo,
      name: t.name,
      waitMinutes: Math.round(((t.servedAt - t.createdAt) / 60000) * 10) / 10,
      status: t.status
    }));

  res.json({
    waitingNow: waiting.length,
    servingNow: serving.length,
    servedToday: served.length,
    avgWaitMinutes: avgWait,
    totalQueues: data.queues.length,
    queues: queues,
    recentServed: recent
  });
});

app.listen(5000, () => {
  console.log("backend running on http://localhost:5000");
});
