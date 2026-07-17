import os
import base64
import requests
import re
from flask import Flask, render_template, request, redirect, url_for, flash, g
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from markupsafe import Markup, escape

app = Flask(__name__)
app.config['SECRET_KEY'] = 'super-secret-amber-key-123'

# --- Настройка базы данных (Render Postgres / Локальная SQLite) ---
database_url = os.environ.get('DATABASE_URL', 'sqlite:///amberboard.db')
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

IMGBB_API_KEY = "614175d15985961d996a8c076c776f08"

# --- Модели БД ---
class Board(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(10), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    bio = db.Column(db.String(300), default="Пользователь AmberBoard")
    is_admin = db.Column(db.Boolean, default=False)

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('post.id', ondelete='CASCADE'), nullable=True)
    board_id = db.Column(db.Integer, db.ForeignKey('board.id', ondelete='CASCADE'), nullable=True) # Только для ОП треда
    title = db.Column(db.String(100), nullable=True) # Только для ОП треда
    content = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(300), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    is_anonymous = db.Column(db.Boolean, default=True)
    is_pinned = db.Column(db.Boolean, default=False) # Только для ОП треда
    is_locked = db.Column(db.Boolean, default=False) # Только для ОП треда
    
    author = db.relationship('User', backref=db.backref('posts', lazy=True))
    replies = db.relationship('Post', backref=db.backref('parent', remote_side=[id]), cascade="all, delete-orphan", lazy=True)

    @property
    def preview_replies(self):
        # Достаем последние 5 ответов для превью на главной странице доски
        r = Post.query.filter_by(parent_id=self.id).order_by(Post.timestamp.desc()).limit(5).all()
        return reversed(r)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- Фильтр разметки Greentext и упоминаний постов >> ---
@app.template_filter('format_post')
def format_post(text):
    escaped = str(escape(text))
    lines = escaped.split('\n')
    for i, line in enumerate(lines):
        # Greentext (строка начинается с > но не с >>)
        if line.startswith('&gt;') and not line.startswith('&gt;&gt;'):
            lines[i] = f'<span class="greentext">{line}</span>'
    text = '\n'.join(lines)
    
    # Парсинг ссылок вида >>123
    text = re.sub(r'&gt;&gt;(\d+)', r'<a href="#p" class="post-link">&gt;&gt;</a>', text)
    
    # Замена переносов на HTML br
    text = text.replace('\n', '<br>')
    return Markup(text)

# --- Глобальная передача списка досок в шаблоны ---
@app.context_processor
def inject_boards():
    return dict(g_boards=Board.query.all())

# --- Первичная инициализация базы данных ---
with app.app_context():
    db.create_all()
    if not Board.query.first():
        boards = [
            Board(code="b", name="Бред"),
            Board(code="a", name="Аниме"),
            Board(code="vg", name="Видеоигры"),
            Board(code="dev", name="Разработка")
        ]
        db.session.bulk_save_objects(boards)
        db.session.commit()

# --- Загрузка изображений на ImgBB ---
def upload_image(image_file):
    url = "https://api.imgbb.com/1/upload"
    payload = {
        "key": IMGBB_API_KEY,
        "image": base64.b64encode(image_file.read()).decode('utf-8')
    }
    response = requests.post(url, data=payload)
    if response.status_code == 200:
        return response.json()['data']['url']
    return None

# --- Маршруты (Routes) ---
@app.route('/')
def index():
    return redirect(url_for('board_view', board_code='b'))

@app.route('/<board_code>/', methods=['GET', 'POST'])
def board_view(board_code):
    board = Board.query.filter_by(code=board_code).first_or_404()
    
    if request.method == 'POST' and current_user.is_authenticated:
        title = request.form.get('title')
        content = request.form.get('content')
        image = request.files.get('image')
        is_anonymous = request.form.get('is_anonymous') == 'y'
        
        image_url = None
        if image and image.filename != '':
            image_url = upload_image(image)
            
        new_thread = Post(
            board_id=board.id,
            title=title,
            content=content,
            image_url=image_url,
            user_id=current_user.id,
            is_anonymous=is_anonymous
        )
        db.session.add(new_thread)
        db.session.commit()
        return redirect(url_for('board_view', board_code=board_code))
        
    threads = Post.query.filter_by(board_id=board.id, parent_id=None).order_by(Post.is_pinned.desc(), Post.timestamp.desc()).all()
    return render_template('board.html', board=board, threads=threads)

@app.route('/<board_code>/thread/<int:thread_id>/', methods=['GET', 'POST'])
def thread_view(board_code, thread_id):
    board = Board.query.filter_by(code=board_code).first_or_404()
    thread = Post.query.get_or_404(thread_id)
    
    if request.method == 'POST' and current_user.is_authenticated:
        if thread.is_locked:
            flash('Этот тред закрыт администратором.')
            return redirect(url_for('thread_view', board_code=board_code, thread_id=thread_id))
            
        content = request.form.get('content')
        image = request.files.get('image')
        is_anonymous = request.form.get('is_anonymous') == 'y'
        
        image_url = None
        if image and image.filename != '':
            image_url = upload_image(image)
            
        new_reply = Post(
            parent_id=thread.id,
            content=content,
            image_url=image_url,
            user_id=current_user.id,
            is_anonymous=is_anonymous
        )
        db.session.add(new_reply)
        # Поднимаем тред наверх при ответе (бамп)
        thread.timestamp = datetime.utcnow()
        db.session.commit()
        return redirect(url_for('thread_view', board_code=board_code, thread_id=thread_id))
        
    replies = Post.query.filter_by(parent_id=thread.id).order_by(Post.timestamp.asc()).all()
    return render_template('thread.html', board=board, thread=thread, replies=replies)

@app.route('/delete/<int:post_id>/')
@login_required
def delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    
    if post.user_id == current_user.id or current_user.is_admin:
        if post.parent_id is None:
            board = Board.query.get(post.board_id)
            db.session.delete(post)
            db.session.commit()
            flash('Тред успешно удален.')
            return redirect(url_for('board_view', board_code=board.code))
        else:
            parent_thread_id = post.parent_id
            parent_post = Post.query.get(parent_thread_id)
            board = Board.query.get(parent_post.board_id)
            db.session.delete(post)
            db.session.commit()
            flash('Ответ успешно удален.')
            return redirect(url_for('thread_view', board_code=board.code, thread_id=parent_thread_id))
            
    flash('Недостаточно прав для удаления.')
    return redirect(url_for('index'))

@app.route('/toggle-pin/<int:thread_id>/')
@login_required
def toggle_pin(thread_id):
    if not current_user.is_admin:
        flash('Доступно только модераторам.')
        return redirect(url_for('index'))
    thread = Post.query.get_or_404(thread_id)
    if thread.parent_id is not None:
        return redirect(url_for('index'))
        
    thread.is_pinned = not thread.is_pinned
    db.session.commit()
    board = Board.query.get(thread.board_id)
    flash('Статус закрепления изменен.')
    return redirect(url_for('board_view', board_code=board.code))

@app.route('/toggle-lock/<int:thread_id>/')
@login_required
def toggle_lock(thread_id):
    if not current_user.is_admin:
        flash('Доступно только модераторам.')
        return redirect(url_for('index'))
    thread = Post.query.get_or_404(thread_id)
    if thread.parent_id is not None:
        return redirect(url_for('index'))
        
    thread.is_locked = not thread.is_locked
    db.session.commit()
    board = Board.query.get(thread.board_id)
    flash('Статус блокировки изменен.')
    return redirect(url_for('board_view', board_code=board.code))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if User.query.filter_by(username=username).first():
            flash('Это имя пользователя уже занято.')
            return redirect(url_for('register'))
            
        hashed_pw = generate_password_hash(password)
        # Если регистрируется ник "admin", выдаем админа автоматически
        is_admin = username.lower() == 'admin'
        
        new_user = User(username=username, password_hash=hashed_pw, is_admin=is_admin)
        db.session.add(new_user)
        db.session.commit()
        flash('Регистрация успешна! Войдите в аккаунт.')
        return redirect(url_for('login'))
        
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for('index'))
        flash('Неверное имя пользователя или пароль.')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        new_username = request.form.get('username')
        new_bio = request.form.get('bio')
        
        if new_username != current_user.username:
            if User.query.filter_by(username=new_username).first():
                flash('Это имя пользователя занято.')
                return redirect(url_for('profile'))
            current_user.username = new_username
            
        current_user.bio = new_bio
        db.session.commit()
        flash('Профиль успешно обновлен.')
        return redirect(url_for('profile'))
        
    return render_template('profile.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)