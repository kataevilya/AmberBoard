from flask import Flask, render_template, request, redirect, url_for, flash
import time
import re

app = Flask(__name__)
app.secret_key = "super_secret_amber_key" # Нужно для flash-сообщений

# Имитация базы данных
db = {
    "boards": {
        "b": {"name": "Random", "desc": "Бред и общение"},
        "dev": {"name": "Development", "desc": "Кодинг и проекты"}
    },
    "threads": {}, # Формат: { thread_id: { board: 'b', title: '...', op_post: {}, replies: [] } }
    "post_counter": 1000000 # Стартовый номер поста (как на 4chan)
}

def generate_post_id():
    db["post_counter"] += 1
    return db["post_counter"]

def format_comment(text):
    """Парсер для гринтекста и ссылок на посты (>>123456)"""
    lines = text.split('\n')
    formatted = []
    for line in lines:
        if line.startswith('>'):
            formatted.append(f'<span class="greentext">{line}</span>')
        else:
            # Превращаем >>123456 в кликабельную ссылку
            line = re.sub(r'>>(\d+)', r'<a href="#p\1" class="post-link">&gt;&gt;\1</a>', line)
            formatted.append(line)
    return '<br>'.join(formatted)

@app.route('/')
def index():
    return render_template('index.html', boards=db["boards"])

# РОУТ ДОСКИ (Каталог тредов)
@app.route('/<board_uri>/', methods=['GET', 'POST'])
def board(board_uri):
    if board_uri not in db["boards"]:
        return "Доска не найдена", 404
        
    if request.method == 'POST':
        # Создание нового треда
        title = request.form.get('title', 'Без темы')
        name = request.form.get('name', 'Anonymous')
        comment = request.form.get('comment', '')
        
        post_id = generate_post_id()
        thread_id = post_id # ID треда = ID первого поста
        
        db["threads"][thread_id] = {
            "board": board_uri,
            "title": title,
            "timestamp": time.strftime("%d/%m/%y(%a)%H:%M"),
            "op_post": {
                "id": post_id,
                "name": name,
                "comment": format_comment(comment)
            },
            "replies": []
        }
        return redirect(url_for('view_thread', board_uri=board_uri, thread_id=thread_id))

    # Получаем треды только для текущей доски
    board_threads = {tid: t for tid, t in db["threads"].items() if t["board"] == board_uri}
    return render_template('board.html', board_uri=board_uri, board_info=db["boards"][board_uri], threads=board_threads)

# РОУТ ТРЕДА (Просмотр и ответы)
@app.route('/<board_uri>/thread/<int:thread_id>', methods=['GET', 'POST'])
def view_thread(board_uri, thread_id):
    thread = db["threads"].get(thread_id)
    if not thread or thread["board"] != board_uri:
        return "Тред не найден", 404

    if request.method == 'POST':
        # Добавление ответа в тред
        name = request.form.get('name', 'Anonymous')
        comment = request.form.get('comment', '')
        
        post_id = generate_post_id()
        thread["replies"].append({
            "id": post_id,
            "name": name,
            "timestamp": time.strftime("%d/%m/%y(%a)%H:%M"),
            "comment": format_comment(comment)
        })
        # Редирект на тот же тред с якорем на новый пост (шеринг)
        return redirect(url_for('view_thread', board_uri=board_uri, thread_id=thread_id) + f'#p{post_id}')

    return render_template('thread.html', board_uri=board_uri, thread_id=thread_id, thread=thread)

if __name__ == '__main__':
    app.run(debug=True)
