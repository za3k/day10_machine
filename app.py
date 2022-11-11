#!/bin/python3
import flask, flask_login
from flask import url_for, request, render_template, redirect
from flask_login import current_user
import json
from datetime import datetime
from base import app,load_info,ajax,DBDict,DBList,random_id,hash_id

# -- Info for every Hack-A-Day project --
load_info({
    "project_name": "Hack-A-Machine",
    "source_url": "https://github.com/za3k/day10_machine",
    "subdir": "/hackaday/machine",
    "description": "a programmable virtual machine",
    "login": True,
})

# -- Routes specific to this Hack-A-Day project --
# List of saved files per-user
files = DBDict("files")
saves = DBDict("programs")
users = DBDict("data")

def file_key(user, filename):
    return "{}/{}".format(user, filename)
def empty_user(user_id):
    return {
        "id": user_id,
        "anon_files": set(),
        "files": set(),
        "favorite_files": set(),
        "favorite_anon_files": set(),
    }
def get_user(user_id):
    return users.get(user_id, empty_user(user_id))

@app.route("/")
def index():
    """Index displays a blank page if not logged in, or the last edited program if you are"""
    return flask.render_template('index.html')

# "Save" button saves the current version of a program
@app.route("/edit/<user_id>/<filename>")
def edit(user_id, filename):
    if user_id != current_user.id:
        program_hash = files[file_key(user_id, filename)]
        flask.redirect(url_for("view", program_hash=program_hash))
    if request.method == "GET":
        program = saves[files[file_key(user_id, filename)]]
        return render_template('edit.html', user_id=user_id, filename=filename, program=program)

@app.route("/submit", methods=["POST"])
def submit():
    program = request.form["program"]
    key = hash_id(program)
    saves[key] = program
    if current_user.is_authenticated:
        user = get_user(current_user.id)
        filename = request.form.get("filename", "")
        print("submit", program, repr(filename))
        if filename != "":
            files[file_key(current_user.id, filename)] = key
            user["files"].add(filename)
            users[current_user.id] = user
            return redirect(url_for("edit", user_id=current_user.id, filename=filename))
        else:
            user["anon_files"].add(key)
            users[current_user.id] = user
            return redirect(url_for("view", program_hash=key))
    else: 
        return redirect(url_for("view", program_hash=key))

@app.route("/view/<program_hash>", methods=["GET"])
def view(program_hash=None):
    if request.method == "GET":
        program = saves[program_hash]
        return render_template("view.html", program_hash=program_hash, program=program)

@app.route("/fave/<user_id>/<filename>")
@flask_login.login_required
def fave(user_id, filename):
    user = get_user(current_user.id)
    user["favorite_files"].add((user_id, filename))
    users[current_user.id] = user
    return redirect(url_for("edit", user_id=user_id, filename=filename))

@app.route("/fave/<program_hash>")
@flask_login.login_required
def fave_anon(program_hash):
    user = get_user(current_user.id)
    user["favorite_anon_files"].add(program_hash)
    users[current_user.id] = user
    return redirect(url_for("view", program_hash=program_hash))

@app.route("/faves/<user_id>")
@flask_login.login_required
def view_faves(user_id):
    return render_template("view_faves.html", user=get_user(user_id))

@app.route("/user/<user_id>")
def view_user(user_id):
    return render_template("user.html", user=get_user(user_id))
