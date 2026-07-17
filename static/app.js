document.addEventListener('DOMContentLoaded', () => {

    // 1. Умный парсер: Гринтекст, Спойлеры, YouTube, Ссылки
    function parsePost(text) {
        let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Спойлеры [spoiler]текст[/spoiler]
        safeText = safeText.replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi, '<span class="spoiler">$1</span>');

        // YouTube
        safeText = safeText.replace(/(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=|https?:\/\/youtu\.be\/)([a-zA-Z0-9_-]{11})/g, 
            '<br><iframe width="320" height="180" src="https://www.youtube.com/embed/$2" frameborder="0"></iframe><br>'
        );

        let lines = safeText.split('\n');
        lines = lines.map(line => {
            if (line.startsWith('&gt;') && !line.startsWith('&gt;&gt;')) {
                return `<span class="greentext">${line}</span>`;
            }
            return line;
        });
        safeText = lines.join('\n');

        // Ссылки на посты >>ID
        return safeText.replace(/&gt;&gt;(\d+)/g, '<a href="#p$1" class="quotelink">&gt;&gt;$1</a>');
    }

    // Применяем парсер ко всем постам
    document.querySelectorAll('.postMessage').forEach(msg => {
        const raw = msg.getAttribute('data-raw');
        if (raw) msg.innerHTML = parsePost(raw);
    });

    // 2. Генератор Трипкодов (Имя#Пароль)
    document.querySelectorAll('.js-name').forEach(nameSpan => {
        const rawName = nameSpan.innerText;
        if (rawName.includes('#')) {
            const parts = rawName.split('#');
            const name = parts[0];
            const password = parts[1];
            
            let hash = 0;
            for (let i = 0; i < password.length; i++) {
                hash = ((hash << 5) - hash) + password.charCodeAt(i);
                hash |= 0; 
            }
            const tripcode = '!' + Math.abs(hash).toString(16).substring(0, 8);
            nameSpan.innerHTML = `${name} <span class="tripcode">${tripcode}</span>`;
        }
    });

    // 3. Зум картинок
    document.querySelectorAll('.post-image').forEach(img => {
        img.addEventListener('click', () => img.classList.toggle('expanded'));
    });

    // 4. Плавающая форма (Quick Reply)
    const qrBox = document.getElementById('qr-box');
    const qrTextarea = document.getElementById('qr-textarea');
    const qrClose = document.getElementById('qr-close');

    qrClose.addEventListener('click', () => qrBox.style.display = 'none');

    // Клик на номер поста: открывает Quick Reply и вставляет >>ID
    document.querySelectorAll('.num-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const postId = link.getAttribute('data-id');
            qrBox.style.display = 'block';
            qrTextarea.value += `>>${postId}\n`;
            qrTextarea.focus();
        });
    });

    // Кнопка [Ответ] на ОП-посте
    document.querySelectorAll('.reply-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            qrBox.style.display = 'block';
            qrTextarea.focus();
        });
    });

    // 5. Вставка тегов (Спойлер, Гринтекст)
    document.querySelectorAll('.js-tag').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tag = e.target.getAttribute('data-tag');
            const textarea = document.getElementById('main-textarea');
            textarea.value += tag;
            textarea.focus();
        });
    });
});