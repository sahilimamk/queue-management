# Queue Management App

A simple full stack app to manage queues. A manager logs in,
creates queues, adds people to a queue, moves them up or down,
serves the next person, or cancels a token. There is also a
dashboard with basic stats like wait time and queue length.

## How to run

You need Node.js installed.

Backend (port 5000):

```
cd backend
npm install
npm start
```

Frontend (port 5173):

```
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Login

Username: `manager`
Password: `manager123`

## Tech used

- Backend: Node.js + Express, data saved in a JSON file
- Frontend: React + Vite
