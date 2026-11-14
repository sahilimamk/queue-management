import { useState, useEffect } from "react";
import { api } from "./api.js";

function App() {
  const [user, setUser] = useState(localStorage.getItem("user") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [tab, setTab] = useState("queues");
  const [queues, setQueues] = useState([]);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [newQueueName, setNewQueueName] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  function loadQueues() {
    api.getQueues().then(setQueues).catch((e) => setError(e.message));
  }

  function loadTokens(queueId) {
    api.getTokens(queueId).then(setTokens).catch((e) => setError(e.message));
  }

  function loadDashboard() {
    api.getDashboard().then(setDashboard).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (user) loadQueues();
  }, [user]);

  useEffect(() => {
    if (user && tab === "dashboard") loadDashboard();
  }, [tab, user]);

  useEffect(() => {
    if (selectedQueue) loadTokens(selectedQueue.id);
  }, [selectedQueue]);

  async function handleLogin(e) {
    e.preventDefault();
    try {
      const data = await api.login(username, password);
      localStorage.setItem("user", data.username);
      setUser(data.username);
      setLoginError("");
    } catch (err) {
      setLoginError(err.message);
    }
  }

  function logout() {
    localStorage.removeItem("user");
    setUser("");
    setSelectedQueue(null);
  }

  async function handleCreateQueue(e) {
    e.preventDefault();
    if (!newQueueName) return;
    const queue = await api.createQueue(newQueueName);
    setQueues([...queues, queue]);
    setNewQueueName("");
  }

  async function handleDeleteQueue(id) {
    await api.deleteQueue(id);
    setQueues(queues.filter((q) => q.id !== id));
    if (selectedQueue && selectedQueue.id === id) setSelectedQueue(null);
  }

  async function handleAddPerson(e) {
    e.preventDefault();
    if (!newPersonName || !selectedQueue) return;
    await api.addToken(selectedQueue.id, newPersonName);
    setNewPersonName("");
    loadTokens(selectedQueue.id);
  }

  async function refreshTokens() {
    if (selectedQueue) loadTokens(selectedQueue.id);
  }

  // login screen
  if (!user) {
    return (
      <div className="center">
        <div className="card login-card">
          <h1>Queue Management</h1>
          <p>Manager login</p>
          <form onSubmit={handleLogin}>
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit">Login</button>
          </form>
          {loginError && <p className="error">{loginError}</p>}
          <p className="hint">Demo login: manager / manager123</p>
        </div>
      </div>
    );
  }

  const waiting = tokens.filter((t) => t.status === "waiting");
  const serving = tokens.filter((t) => t.status === "serving");
  const done = tokens.filter((t) => t.status === "done" || t.status === "cancelled");

  return (
    <div className="page">
      <header>
        <h1>Queue Management</h1>
        <div>
          <span>Hi, {user}</span>
          <button className="small" onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="tabs">
        <button className={tab === "queues" ? "active" : ""} onClick={() => setTab("queues")}>
          Queues
        </button>
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>
          Dashboard
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {tab === "queues" && (
        <div className="layout">
          <div className="card">
            <h2>Queues</h2>
            <form onSubmit={handleCreateQueue} className="row">
              <input
                placeholder="New queue name, eg Billing"
                value={newQueueName}
                onChange={(e) => setNewQueueName(e.target.value)}
              />
              <button type="submit">Create queue</button>
            </form>
            {queues.length === 0 && <p>No queues yet. Create one above.</p>}
            {queues.map((q) => (
              <div
                key={q.id}
                className={"queue-item " + (selectedQueue && selectedQueue.id === q.id ? "selected" : "")}
                onClick={() => setSelectedQueue(q)}
              >
                <span>{q.name}</span>
                <button
                  className="small danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteQueue(q.id);
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          <div className="card">
            {selectedQueue ? (
              <>
                <h2>{selectedQueue.name}</h2>
                <form onSubmit={handleAddPerson} className="row">
                  <input
                    placeholder="Person name"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                  />
                  <button type="submit">Add to queue</button>
                </form>
                <button
                  className="serve-btn"
                  onClick={async () => {
                    try {
                      await api.serveNext(selectedQueue.id);
                      refreshTokens();
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Serve next person
                </button>

                {serving.length > 0 && (
                  <div className="serving">
                    <h3>Now serving</h3>
                    {serving.map((t) => (
                      <div key={t.id} className="token">
                        <span>Token {t.tokenNo} - {t.name}</span>
                        <button
                          onClick={async () => {
                            await api.doneToken(t.id);
                            refreshTokens();
                          }}
                        >
                          Done
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <h3>Waiting ({waiting.length})</h3>
                {waiting.length === 0 && <p>No one is waiting.</p>}
                {waiting.map((t, i) => (
                  <div key={t.id} className="token">
                    <span>
                      {i + 1}. Token {t.tokenNo} - {t.name}
                    </span>
                    <span className="actions">
                      <button onClick={async () => { await api.moveUp(t.id); refreshTokens(); }}>
                        Up
                      </button>
                      <button onClick={async () => { await api.moveDown(t.id); refreshTokens(); }}>
                        Down
                      </button>
                      <button
                        className="danger"
                        onClick={async () => { await api.cancelToken(t.id); refreshTokens(); }}
                      >
                        Cancel
                      </button>
                    </span>
                  </div>
                ))}

                {done.length > 0 && (
                  <>
                    <h3>Finished</h3>
                    {done.map((t) => (
                      <div key={t.id} className="token done-token">
                        <span>Token {t.tokenNo} - {t.name} ({t.status})</span>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              <p>Select a queue on the left to see its tokens.</p>
            )}
          </div>
        </div>
      )}

      {tab === "dashboard" && dashboard && (
        <div>
          <div className="stats">
            <div className="stat">
              <p>Waiting now</p>
              <h2>{dashboard.waitingNow}</h2>
            </div>
            <div className="stat">
              <p>Being served</p>
              <h2>{dashboard.servingNow}</h2>
            </div>
            <div className="stat">
              <p>Served today</p>
              <h2>{dashboard.servedToday}</h2>
            </div>
            <div className="stat">
              <p>Average wait</p>
              <h2>{dashboard.avgWaitMinutes} min</h2>
            </div>
            <div className="stat">
              <p>Total queues</p>
              <h2>{dashboard.totalQueues}</h2>
            </div>
          </div>

          <div className="card">
            <h2>Queue length</h2>
            {dashboard.queues.length === 0 && <p>No queues yet.</p>}
            {dashboard.queues.map((q) => (
              <div key={q.id} className="bar-row">
                <span className="bar-label">{q.name}</span>
                <div className="bar-bg">
                  <div
                    className="bar"
                    style={{ width: Math.min(q.waiting * 30, 100) + "%" }}
                  ></div>
                </div>
                <span>{q.waiting} waiting, {q.served} served, avg {q.avgWait} min</span>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Recently served</h2>
            {dashboard.recentServed.length === 0 && <p>Nothing served yet.</p>}
            {dashboard.recentServed.map((t, i) => (
              <div key={i} className="token">
                <span>Token {t.tokenNo} - {t.name}</span>
                <span>{t.waitMinutes} min wait ({t.status})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
