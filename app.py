from flask import Flask, render_template, request, redirect, url_for
import time
import re

app = Flask(__name__)

# Имитация БД
db = {
    "boards": {
        "b": {"name": "Random", "desc": "Бред"},
        "dev": {"name": "Development", "desc": "Разработка"}
    },
    "threads": {},
    "post_counter": 1000000
}

def generate_post_id():
    db["post_counter"] += 1
    return db["post_counter"]

def format_comment(text):
    lines = text.split('\n')
    formatted = []
    for line in lines:
        if line.startswith('>'):
            formatted.append(f'<span class="quote">{line}</span>')
        else:
            line = re.sub(r'>>(\d+)', r'<a href="#p\1" class="quotelink">&gt;&gt;\1</a>', line)
            formatted.append(line)
    return '<br>'.join(formatted)

@app.route('/')
def index():
    return render_template('index.html', boards=db["boards"])

@app.route('/<board_uri>/', methods=['GET', 'POST'])
def board(board_uri):
    if board_uri not in db["boards"]:
        return "Доска не найдена", 404
        
    if request.method == 'POST':
        name = request.form.get('name', 'Anonymous')
        subject = request.form.get('subject', '')
        comment = request.form.get('com', '')
        
        post_id = generate_post_id()
        db["threads"][post_id] = {
            "board": board_uri,
            "subject": subject,
            "timestamp": time.strftime("%m/%d/%y(%a)%H:%M:%S"),
            "op": {"id": post_id, "name": name, "comment": format_comment(comment)},
            "replies": []
        }
        return redirect(url_for('board', board_uri=board_uri))

    board_threads = {tid: t for tid, t in db["threads"].items() if t["board"] == board_uri}
    return render_template('board.html', board_uri=board_uri, board_info=db["boards"][board_uri], threads=board_threads)

if __name__ == '__main__':
    app.run(debug=True)
