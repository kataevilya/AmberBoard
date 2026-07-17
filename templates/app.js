document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('new-thread-form');
    const repliesContainer = document.getElementById('replies-container-1');
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.getElementById('emoji-picker');
    const postFileInput = document.getElementById('post-file');
    const filePreviewText = document.getElementById('file-name-preview');
    const toast = document.getElementById('toast');
    
    // 1. Генерация уникального ID юзера на сессию
    let sessionUserId = sessionStorage.getItem('sessionUserId');
    if (!sessionUserId) {
        sessionUserId = 'ID: ' + Math.random().toString(36).substring(2, 10).toUpperCase();
        sessionStorage.setItem('sessionUserId', sessionUserId);
    }

    // Счетчик ID постов
    let nextPostId = parseInt(localStorage.getItem('nextPostId')) || 3;
    let attachedImageData = ""; // Временный буфер для картинки

    // 2. Открытие/Закрытие выбора Эмодзи
    emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPicker.classList.toggle('hidden');
    });

    // Закрываем панель эмодзи при клике в любое другое место
    document.addEventListener('click', () => {
        emojiPicker.classList.add('hidden');
    });

    // Вставка эмодзи в поле ввода
    emojiPicker.addEventListener('click', (e) => {
        const item = e.target.closest('.emoji-item');
        if (!item) return;
        
        const emojiText = item.getAttribute('data-smile');
        const textInput = document.getElementById('post-text');
        
        // Вставляем на место курсора
        const start = textInput.selectionStart;
        const end = textInput.selectionEnd;
        textInput.value = textInput.value.substring(0, start) + ' ' + emojiText + ' ' + textInput.value.substring(end);
        textInput.focus();
    });

    // 3. Обработка загрузки файла (картинки)
    postFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            filePreviewText.textContent = "";
            attachedImageData = "";
            return;
        }

        filePreviewText.textContent = file.name;

        // Конвертируем в Base64 для симуляции отправки и сохранения
        const reader = new FileReader();
        reader.onload = function(event) {
            attachedImageData = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // 4. Форматирование текста (Greentext + Ссылки >>id)
    function parsePostText(text) {
        // Защита от XSS
        let cleanText = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // Разбиваем на строки для создания Greentext
        let lines = cleanText.split('\n');
        lines = lines.map(line => {
            // Если строка начинается с '>' и это НЕ ссылка на пост '>>'
            if (line.startsWith('&gt;') && !line.startsWith('&gt;&gt;')) {
                return `<span class="greentext">${line}</span>`;
            }
            return line;
        });
        cleanText = lines.join('<br>');

        // Заменяем >>номер на интерактивную ссылку
        return cleanText.replace(/&gt;&gt;(\\d+)/g, '<a href="#p$1" class="post-link">&gt;&gt;$1</a>');
    }

    // 5. Функция копирования ссылки "Поделиться"
    function setupShareButtons() {
        document.querySelectorAll('.share-btn').forEach(button => {
            // Удаляем старый листенер во избежание дублирования
            button.removeAttribute('onclick'); 
            
            button.onclick = (e) => {
                e.preventDefault();
                const postId = button.getAttribute('data-id');
                const cleanUrl = window.location.origin + window.location.pathname + '#p' + postId;
                
                navigator.clipboard.writeText(cleanUrl).then(() => {
                    // Показываем тост
                    toast.classList.remove('hidden');
                    setTimeout(() => {
                        toast.classList.add('hidden');
                    }, 2000);
                });
            };
        });
    }

    // Первичная настройка кнопок "Поделиться"
    setupShareButtons();

    // 6. Поддержка зума картинок по клику
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('attached-image')) {
            e.target.classList.toggle('expanded');
        }
    });

    // 7. Обработка отправки нового сообщения
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const textInput = document.getElementById('post-text');
        const subjectInput = document.getElementById('post-subject');
        const text = textInput.value.trim();
        const subject = subjectInput.value.trim();

        if (!text) return;

        const formattedText = parsePostText(text);
        const now = new Date();
        const dateString = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        // HTML-код для картинки (если прикрепили)
        let imageHtml = "";
        if (attachedImageData) {
            imageHtml = `
                <div class="post-image-container">
                    <img src="${attachedImageData}" class="attached-image" alt="Прикрепленный файл">
                </div>
            `;
        }

        // HTML-код для темы
        const subjectHtml = subject ? `<span class="subject">${subject}</span>` : '';

        // Создаем элемент поста
        const reply = document.createElement('div');
        reply.className = 'post reply-post';
        reply.id = `p${nextPostId}`;
        reply.innerHTML = `
            <div class="post-header">
                ${subjectHtml}
                <span class="author">Аноним</span>
                <span class="user-id">${sessionUserId}</span>
                <span class="date">${dateString}</span>
                <span class="post-number">#${nextPostId}</span>
                <button class="share-btn" data-id="${nextPostId}" title="Поделиться постом">🔗</button>
            </div>
            ${imageHtml}
            <div class="post-body">${formattedText}</div>
        `;

        // Добавляем на страницу
        repliesContainer.appendChild(reply);
        
        // Очищаем и сбрасываем форму
        textInput.value = '';
        subjectInput.value = '';
        postFileInput.value = '';
        filePreviewText.textContent = '';
        attachedImageData = "";
        
        // Повышаем счетчик ID и сохраняем
        nextPostId++;
        localStorage.setItem('nextPostId', nextPostId);
        
        // Перепривязываем листенеры кнопок "Поделиться" для нового поста
        setupShareButtons();
        
        // Плавно скроллим к созданному ответу
        reply.scrollIntoView({ behavior: 'smooth' });
    });
});