// Intentional demo of unsafe sanitization
// DO NOT use these patterns in production

import express from "express";
import { exec } from "child_process";

const app = express();

app.get("/render", (req, res) => {
  const html = req.body.html;
  // High: XSS via innerHTML
  document.querySelector("#out").innerHTML = html;
  res.send("done");
});

app.get("/eval", (req, res) => {
  const code = req.body.code;
  // Critical: arbitrary code execution
  eval(code);
  res.send("done");
});

app.get("/exec", (req, res) => {
  const path = req.query.path;
  // Critical: command injection
  exec(`ls ${path}`, (err, stdout) => {
    res.send(stdout);
  });
});

app.get("/search", (req, res) => {
  const q = req.params.q;
  // Critical: SQL injection (pseudo-code)
  db.query(`SELECT * FROM items WHERE name = '${q}'`, (err, rows) => {
    res.send(rows);
  });
});
