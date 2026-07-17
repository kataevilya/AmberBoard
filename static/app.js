// 1. Умный парсинг сообщений
    function parsePost(text) {
        let safeText = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Спойлеры [spoiler]текст[/spoiler]
        safeText = safeText.replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi, '<span class="spoiler">$1</span>');

        // YouTube плеер (авто-вставка видео)
        safeText = safeText.replace(/(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=|https?:\/\/youtu\.be\/)([a-zA-Z0-9_-]{11})/g, 
            '<br><iframe width="320" height="180" src="https://www.youtube.com/embed/$2" frameborder="0" allowfullscreen></iframe><br>'
        );

        // Олдскульные смайлики (заменяем текст на картинки-колобки, если они у тебя будут в папке /static/smileys/)
        // Пока используем спецсимволы как заглушки, но ты можешь вставить ссылки на GIF
        safeText = safeText.replace(/(?<=^|\s):\)(?=\s|$)/g, ' <span style="color:#D68A00; font-weight:bold;">=)</span> ');
        safeText = safeText.replace(/(?<=^|\s):D(?=\s|$)/g, ' <span style="color:#D68A00; font-weight:bold;">=D</span> ');

        let lines = safeText.split('\n');
        lines = lines.map(line => {
            // Гринтекст
            if (line.startsWith('&gt;') && !line.startsWith('&gt;&gt;')) {
                return `<span class="greentext">${line}</span>`;
            }
            return line;
        });
        safeText = lines.join('\n');

        // Ссылки на посты >>ID
        return safeText.replace(/&gt;&gt;(\d+)/g, '<a href="#p$1" class="quotelink">&gt;&gt;$1</a>');
    }

    // НОВАЯ ФУНКЦИЯ: Генератор трипкодов (Frontend-имитация для красоты)
    // Если в имени есть решетка (Илья#secret), превращаем это в "Илья !abc123Xy"
    document.querySelectorAll('.name').forEach(nameSpan => {
        const rawName = nameSpan.innerText;
        if (rawName.includes('#')) {
            const parts = rawName.split('#');
            const name = parts[0];
            const password = parts[1];
            
            // Простая генерация "хэша" для визуала
            let hash = 0;
            for (let i = 0; i < password.length; i++) {
                hash = ((hash << 5) - hash) + password.charCodeAt(i);
                hash |= 0; 
            }
            const tripcode = '!' + Math.abs(hash).toString(16).substring(0, 8);
            
            nameSpan.innerHTML = `${name} <span class="tripcode">${tripcode}</span>`;
        }
    });