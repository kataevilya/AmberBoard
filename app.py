from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    # Главная страница с тредами
    return render_template('index.html')

@app.route('/login')
def login():
    # Отдельная страница авторизации
    return render_template('login.html')

@app.route('/register')
def register():
    # Отдельная страница регистрации
    return render_template('register.html')

if __name__ == '__main__':
    app.run(debug=True)
