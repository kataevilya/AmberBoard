document.addEventListener('DOMContentLoaded', () => {
    // 1. Олдскульные эмодзи как на 4pda (вставка в поле ввода)
    document.querySelectorAll('.emoji').forEach(emoji => {
        emoji.addEventListener('click', (e) => {
            const textarea = document.getElementById('post-text');
            const smileText = e.target.innerText; // Можно заменить на getAttribute('data-smile') если нужны символы
            
            // Вставляем смайл туда, где стоит курсор
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + ' ' + smileText + ' ' + textarea.value.substring(end);
            
            // Возвращаем фокус
            textarea.focus();
        });
    });

    // 2. Функция создания ссылки на конкретный пост
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('share-btn')) {
            e.preventDefault();
            
            const postId = e.target.getAttribute('data-id');
            // Собираем правильный URL с хэшем (якорем) на пост
            const postUrl = window.location.origin + window.location.pathname + '#p' + postId;
            
            navigator.clipboard.writeText(postUrl).then(() => {
                // Симуляция системного alert, если не хочешь писать сложный тост
                alert('Ссылка на пост №' + postId + ' скопирована в буфер обмена:\n' + postUrl);
            });
        }
    });
});