const API = "http://localhost:5000/api";

async function call(path, method, body) {
  const res = await fetch(API + path, {
    method: method || "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "something went wrong");
  return data;
}

export const api = {
  login: (username, password) => call("/login", "POST", { username, password }),
  getQueues: () => call("/queues"),
  createQueue: (name) => call("/queues", "POST", { name }),
  deleteQueue: (id) => call("/queues/" + id, "DELETE"),
  getTokens: (queueId) => call("/queues/" + queueId + "/tokens"),
  addToken: (queueId, name) => call("/queues/" + queueId + "/tokens", "POST", { name }),
  moveUp: (id) => call("/tokens/" + id + "/up", "POST"),
  moveDown: (id) => call("/tokens/" + id + "/down", "POST"),
  serveNext: (queueId) => call("/queues/" + queueId + "/serve-next", "POST"),
  doneToken: (id) => call("/tokens/" + id + "/done", "POST"),
  cancelToken: (id) => call("/tokens/" + id + "/cancel", "POST"),
  getDashboard: () => call("/dashboard")
};
