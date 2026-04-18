# Intentional demo of unsafe sanitization
# DO NOT use these patterns in production

from flask import Flask, request
import subprocess
import os
import sqlite3

app = Flask(__name__)
conn = sqlite3.connect(":memory:")

@app.route("/user")
def get_user():
    user_id = request.args.get("id")
    cursor = conn.cursor()
    # Critical: SQL injection via f-string
    cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
    return cursor.fetchone()

@app.route("/calc")
def calculate():
    expr = request.args.get("expr")
    # Critical: arbitrary code execution
    return str(eval(expr))

@app.route("/list")
def list_files():
    path = request.args.get("path", ".")
    # Critical: command injection
    subprocess.run(f"ls {path}", shell=True)
    return "done"

@app.route("/hello")
def hello():
    name = request.args.get("name")
    from flask import render_template_string
    # High: SSTI
    return render_template_string(f"Hello {name}")
