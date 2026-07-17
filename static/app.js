document.addEventListener('DOMContentLoaded', () => {
    // 1. Парсинг сообщений: Greentext + кликабельные >>ID ссылки
    function parsePost(text) {
        // Защита от XSS (безопасное экранирование тегов)
        let safeText = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        let lines = safeText.split('\n');
        lines = lines.map(line => {
            // Если строка начинается с > (и это не ссылка >>)
            if (line.startsWith('&gt;') && !line.startsWith('&gt;&gt;')) {
                return `<span class="greentext">${line}</span>`;
            }
            return line;
        });
        safeText = lines.join('\n');

        // Превращаем >>ID в кликабельные ссылки на посты
        return safeText.replace(/&gt;&gt;(\d+)/g, '<a href="#p$1" class="quotelink">&gt;&gt;$1</a>');
    }

    // Запускаем парсинг для всех постов на странице
    document.querySelectorAll('.postMessage').forEach(msg => {
        const raw = msg.getAttribute('data-raw');
        if (raw) {
            msg.innerHTML = parsePost(raw);
        }
    });

    // 2. Клик на No.123 — авто-вставка цитаты в текстовое поле
    document.querySelectorAll('.num-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const postId = link.innerText.trim();
            const textarea = document.getElementById('post-text');
            
            if (textarea) {
                textarea.value += `>>${postId}\n`;
                textarea.focus();
            }
        });
    });

    // 3. Зум картинок по клику
    document.querySelectorAll('.post-image').forEach(img => {
        img.addEventListener('click', () => {
            img.classList.toggle('expanded');
        });
    });

    // 4. Олдскульные эмодзи
    document.querySelectorAll('.emoji').forEach(emoji => {
        emoji.addEventListener('click', (e) => {
            const textarea = document.getElementById('post-text');
            const smileSymbol = e.target.getAttribute('data-smile') || e.target.innerText;
            
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + ' ' + smileSymbol + ' ' + textarea.value.substring(end);
            textarea.focus();
        });
    });

    // 5. Кнопка быстрого копирования ссылки на пост
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('share-btn')) {
            e.preventDefault();
            const postId = e.target.getAttribute('data-id');
            const postUrl = window.location.origin + window.location.pathname + '#p' + postId;
            
            navigator.clipboard.writeText(postUrl).then(() => {
                alert('Ссылка на пост скопирована!');
            });
        }
    });

    // 6. Подсветка постов при клике на quotelink (ссылку-цитату)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('quotelink')) {
            const targetId = e.target.getAttribute('href').replace('#', '');
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                // Временно подсвечиваем рамку поста золотым цветом
                targetEl.classList.add('highlighted');
                setTimeout(() => {
                    targetEl.classList.remove('highlighted');
                }, 2000);
            }
        }
    });
});