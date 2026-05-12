// ==========================================
// 1. НАЛАШТУВАННЯ SUPABASE
// ==========================================
const supabaseUrl = 'https://onzrbtrifqckxldpixxz.supabase.co';
const supabaseKey = 'sb_publishable_ypcv3GeJRzP-lO7_K_eQmA_t9_7JrqP';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const API_KEY = '04c35731a5ee918f014970082a0088b1';
const IMGPATH = 'https://image.tmdb.org/t/p/w1280';

// ==========================================
// 2. DOM-ЕЛЕМЕНТИ
// ==========================================
const main = document.getElementById('main');
const form = document.getElementById('form');
const search = document.getElementById('search');
const searchType = document.getElementById('searchType');
const sortSelect = document.getElementById('sort');
const genreSelect = document.getElementById('genre');
const ratingSelect = document.getElementById('rating');
const applyFiltersBtn = document.getElementById('applyFilters');
const homeBtn = document.getElementById('homeBtn');
const randomBtn = document.getElementById('randomBtn');
const favoritesBtn = document.getElementById('favoritesBtn');
const watchLaterBtn = document.getElementById('watchLaterBtn');
const contentTypeSelect = document.getElementById('contentType');
const themeToggleBtn = document.getElementById('themeToggle');
const sentinel = document.getElementById('loading-sentinel');

const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const modalCast = document.getElementById('modalCast');
const trailerContainer = document.getElementById('trailerContainer');
const similarMoviesSection = document.getElementById('similarMoviesSection');
const similarMoviesContainer = document.getElementById('similarMoviesContainer');

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authModal = document.getElementById('authModal');
const closeAuthModal = document.getElementById('closeAuthModal');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authTitle = document.getElementById('authTitle');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authToggleText = document.getElementById('authToggleText');
const authToggleLink = document.getElementById('authToggleLink');

// ==========================================
// 3. СТАН ДОДАТКУ
// ==========================================
let currentPage = 1;
let totalPages = 1;
let currentType = 'movie';
let currentUser = null;
let userFavorites = [];
let isFetching = false;
let isFavoritesMode = false;
let isWatchLaterMode = false;

// Фільтри — adult контент виключений, мінімум 500 голосів для чесного рейтингу
const ADULT_FILTER = `&include_adult=false&without_genres=10749`;
const MIN_VOTES = 500;

let currentUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=uk-UA&sort_by=popularity.desc&vote_count.gte=${MIN_VOTES}${ADULT_FILTER}`;

// Кеш об'єктів фільмів — щоб передавати дані в toggleWatchLater без проблем з екрануванням
const movieCache = {};

// ==========================================
// 4. ПЕРЕГЛЯНУТИ ПІЗНІШЕ (localStorage)
// ==========================================
const WATCHLATER_KEY = 'watchLater_movies';

function getWatchLater() {
    try { return JSON.parse(localStorage.getItem(WATCHLATER_KEY) || '[]'); }
    catch (e) { return []; }
}

function saveWatchLater(list) {
    localStorage.setItem(WATCHLATER_KEY, JSON.stringify(list));
}

function isInWatchLater(movieId) {
    return getWatchLater().some(m => m.id === Number(movieId));
}

window.toggleWatchLater = function(movieId, event) {
    event.stopPropagation();
    movieId = Number(movieId);
    const list = getWatchLater();
    const btn = event.currentTarget;
    const movie = movieCache[movieId];

    if (isInWatchLater(movieId)) {
        saveWatchLater(list.filter(m => m.id !== movieId));
        btn.classList.remove('watchlater-active');
        btn.title = 'Переглянути пізніше';
        btn.innerText = '🕐';
        if (isWatchLaterMode) btn.closest('.movie').remove();
    } else {
        if (movie) {
            list.push({
                id: movieId,
                title: movie.title || null,
                name: movie.name || null,
                poster_path: movie.poster_path || null,
                vote_average: movie.vote_average || 0,
                overview: movie.overview || ''
            });
            saveWatchLater(list);
        }
        btn.classList.add('watchlater-active');
        btn.title = 'Вже в списку — натисни щоб прибрати';
        btn.innerText = '🕑';
    }
};

watchLaterBtn.addEventListener('click', () => {
    isWatchLaterMode = true;
    isFavoritesMode = false;
    sentinel.style.display = 'none';
    main.innerHTML = '';

    const list = getWatchLater();
    if (list.length === 0) {
        main.innerHTML = `<div style="text-align:center;width:100%;padding:3rem">
            <h2>Список порожній 🕐</h2>
            <p>Натисни 🕐 на будь-якому фільмі щоб додати сюди</p>
        </div>`;
        return;
    }
    // Дані вже є локально — показуємо без запитів до API
    list.forEach(m => { movieCache[m.id] = m; });
    showMovies(list);
});

// ==========================================
// 5. ЖАНРИ — динамічно з TMDB (фільми і серіали мають різні жанри!)
// ==========================================
async function loadGenres(type) {
    genreSelect.innerHTML = '<option value="">Всі жанри</option>';
    try {
        const resp = await fetch(`https://api.themoviedb.org/3/genre/${type}/list?api_key=${API_KEY}&language=uk-UA`);
        const data = await resp.json();
        if (data.genres) {
            data.genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre.id;
                option.textContent = genre.name;
                genreSelect.appendChild(option);
            });
        }
    } catch (e) { console.error("Помилка завантаження жанрів:", e); }
}

function resetAllFiltersUI() {
    contentTypeSelect.value = 'movie';
    sortSelect.value = 'popularity.desc';
    genreSelect.value = '';
    ratingSelect.value = '';
    search.value = '';
    searchType.value = 'title';
    currentType = 'movie';
}
resetAllFiltersUI();

// ==========================================
// 6. АВТОРИЗАЦІЯ
// ==========================================
let isLoginMode = true;

loginBtn.addEventListener('click', () => {
    authModal.style.display = 'block';
    authEmail.value = '';
    authPassword.value = '';
});

closeAuthModal.addEventListener('click', () => { authModal.style.display = 'none'; });

authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    authTitle.innerText = isLoginMode ? "Вхід" : "Реєстрація";
    authSubmitBtn.innerText = isLoginMode ? "Увійти" : "Створити акаунт";
    authToggleText.innerText = isLoginMode ? "Немає акаунту?" : "Вже є акаунт?";
    authToggleLink.innerText = isLoginMode ? "Зареєструватися" : "Увійти";
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmail.value;
    const password = authPassword.value;

    if (isLoginMode) {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) alert("Помилка входу: " + error.message);
        // якщо успішно — onAuthStateChange спрацює автоматично
    } else {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
            alert("Помилка реєстрації: " + error.message);
        } else if (data.session) {
            alert("Акаунт створено! Ви увійшли автоматично.");
        } else {
            alert("Акаунт створено! Перевірте пошту для підтвердження, потім увійдіть.");
            isLoginMode = true;
            authTitle.innerText = "Вхід";
            authSubmitBtn.innerText = "Увійти";
            authToggleText.innerText = "Немає акаунту?";
            authToggleLink.innerText = "Зареєструватися";
        }
    }
});

// Вихід — видаляємо тільки токени Supabase, watchLater НЕ чіпаємо
logoutBtn.addEventListener('click', async () => {
    currentUser = null;
    userFavorites = [];
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
        }
    });
    try { await supabaseClient.auth.signOut(); } catch (e) { /* ігноруємо */ }
    window.location.reload();
});

function applySession(session) {
    if (session) {
        currentUser = session.user;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        favoritesBtn.style.display = 'inline-block';
        authModal.style.display = 'none';
    } else {
        currentUser = null;
        userFavorites = [];
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        favoritesBtn.style.display = 'none';
        isFavoritesMode = false;
    }
}

// ==========================================
// 7. ІНІЦІАЛІЗАЦІЯ — спочатку сесія, потім фільми
// ==========================================
async function init() {
    // Відновлюємо тему
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeToggleBtn.innerText = '🌙 Темна тема';
    }

    await loadGenres(currentType);

    const { data: { session } } = await supabaseClient.auth.getSession();
    applySession(session);
    if (session) await loadFavorites();
    getMovies(currentUrl, false);
}

// Слухач для подій після ініціалізації (вхід/вихід під час роботи)
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') return; // вже оброблено в init()
    applySession(session);
    if (session) {
        await loadFavorites();
        if (!isFavoritesMode && !isWatchLaterMode) getMovies(currentUrl, false);
    } else {
        getMovies(currentUrl, false);
    }
});

// ==========================================
// 8. УЛЮБЛЕНІ (Supabase)
// ==========================================
async function loadFavorites() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from('favorites')
            .select('movie_id')
            .eq('user_id', currentUser.id);
        if (error) { console.error("Помилка завантаження улюблених:", error.message); return; }
        if (data) userFavorites = data.map(item => Number(item.movie_id));
    } catch (e) { console.error("loadFavorites crash:", e); }
}

window.toggleFavorite = async function(movieId, event) {
    event.stopPropagation();
    if (!currentUser) { alert("Увійдіть, щоб зберігати!"); return; }

    const button = event.currentTarget;
    movieId = Number(movieId);
    const isLiked = userFavorites.includes(movieId);

    if (isLiked) {
        userFavorites = userFavorites.filter(id => id !== movieId);
        button.classList.remove('liked');
        button.innerText = '🤍';
        await supabaseClient.from('favorites').delete()
            .eq('user_id', currentUser.id).eq('movie_id', movieId);
        if (isFavoritesMode) button.closest('.movie').remove();
    } else {
        userFavorites.push(movieId);
        button.classList.add('liked');
        button.innerText = '❤️';
        const { error } = await supabaseClient.from('favorites').insert({
            user_id: currentUser.id,
            movie_id: movieId
        });
        if (error) {
            alert("Помилка збереження: " + error.message);
            userFavorites = userFavorites.filter(id => id !== movieId);
            button.classList.remove('liked');
            button.innerText = '🤍';
        }
    }
};

favoritesBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    isFavoritesMode = true;
    isWatchLaterMode = false;
    main.innerHTML = '';
    sentinel.style.display = 'none';

    if (userFavorites.length === 0) {
        main.innerHTML = `<div style="text-align:center;width:100%;padding:3rem">
            <h2>Порожньо 😔</h2><p>Натисни 🤍 на фільмі щоб додати</p>
        </div>`;
        return;
    }
    showSkeletons();
    const promises = userFavorites.map(id =>
        fetch(`https://api.themoviedb.org/3/${currentType}/${id}?api_key=${API_KEY}&language=uk-UA`).then(r => r.json())
    );
    const results = await Promise.all(promises);
    main.innerHTML = '';
    showMovies(results.filter(m => m && m.id));
});

// ==========================================
// 9. ФІЛЬТРИ, ТЕМА, НАВІГАЦІЯ
// ==========================================
themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeToggleBtn.innerText = isLight ? '🌙 Темна тема' : '☀️ Світла тема';
});

function updateFilters() {
    isFavoritesMode = false;
    isWatchLaterMode = false;
    sentinel.style.display = 'block';
    const sortBy = sortSelect.value;
    const genre = genreSelect.value;
    const rating = ratingSelect.value;

    let filterUrl = `https://api.themoviedb.org/3/discover/${currentType}?sort_by=${sortBy}&api_key=${API_KEY}&language=uk-UA&vote_count.gte=${MIN_VOTES}${ADULT_FILTER}`;
    if (genre) filterUrl += `&with_genres=${genre}`;
    if (rating) filterUrl += `&vote_average.gte=${rating}`;
    currentPage = 1;
    currentUrl = filterUrl;
    getMovies(currentUrl, false);
}

contentTypeSelect.addEventListener('change', () => {
    currentType = contentTypeSelect.value;
    loadGenres(currentType); // серіали і фільми мають різні жанри в TMDB
    updateFilters();
});
applyFiltersBtn.addEventListener('click', () => { updateFilters(); });
homeBtn.addEventListener('click', () => { window.location.reload(); });

randomBtn.addEventListener('click', async () => {
    isFavoritesMode = false;
    isWatchLaterMode = false;
    sentinel.style.display = 'none';
    showSkeletons();
    try {
        const randomPage = Math.floor(Math.random() * 100) + 1;
        const url = `https://api.themoviedb.org/3/discover/${currentType}?api_key=${API_KEY}&language=uk-UA&sort_by=popularity.desc&vote_count.gte=${MIN_VOTES}${ADULT_FILTER}&page=${randomPage}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
            const randomMovie = data.results[Math.floor(Math.random() * data.results.length)];
            main.innerHTML = '';
            showMovies([randomMovie]);
        }
    } catch (e) {
        main.innerHTML = '<h2 style="text-align:center;width:100%">Помилка 😔 Спробуйте ще раз</h2>';
    }
});

// ==========================================
// 10. ЗАВАНТАЖЕННЯ ТА ВІДОБРАЖЕННЯ ФІЛЬМІВ
// ==========================================
async function getMovies(url, append = false) {
    if (isFetching || isFavoritesMode || isWatchLaterMode) return;
    isFetching = true;
    if (!append) showSkeletons();
    try {
        const resp = await fetch(`${url}&page=${currentPage}`);
        const data = await resp.json();
        if (!append) main.innerHTML = '';
        if (data.results) {
            showMovies(data.results);
            totalPages = data.total_pages > 500 ? 500 : data.total_pages;
        }
    } catch (e) { console.error(e); }
    isFetching = false;
}

function showMovies(movies) {
    movies.forEach(movie => {
        if (!movie || !movie.id) return;
        const title = movie.title || movie.name || 'Без назви';
        const imageSrc = movie.poster_path
            ? IMGPATH + movie.poster_path
            : 'https://via.placeholder.com/500x750?text=No+Image';
        const isLiked = userFavorites.includes(Number(movie.id));
        const inWatchLater = isInWatchLater(movie.id);
        // Рейтинг округлюємо до 1 знаку після коми
        const rating = movie.vote_average ? Number(movie.vote_average).toFixed(1) : 'N/A';

        // Кешуємо дані фільму для watchLater
        movieCache[movie.id] = {
            id: movie.id,
            title: movie.title || null,
            name: movie.name || null,
            poster_path: movie.poster_path || null,
            vote_average: movie.vote_average || 0,
            overview: movie.overview || ''
        };

        const movieEl = document.createElement('div');
        movieEl.classList.add('movie');

        // Додаємо кнопки і контент
        movieEl.innerHTML = `
            <button class="favorite-btn ${isLiked ? 'liked' : ''}" title="${isLiked ? 'Прибрати з улюблених' : 'Додати в улюблені'}" onclick="toggleFavorite(${movie.id}, event)">
                ${isLiked ? '❤️' : '🤍'}
            </button>
            <button class="watchlater-btn ${inWatchLater ? 'watchlater-active' : ''}" title="${inWatchLater ? 'Вже в списку — натисни щоб прибрати' : 'Переглянути пізніше'}" onclick="toggleWatchLater(${movie.id}, event)">
                ${inWatchLater ? '🕑' : '🕐'}
            </button>
            <img src="${imageSrc}" alt="${title}" loading="lazy"/>
            <div class="movie-info">
                <h3>${title}</h3>
                <span class="green">${rating}</span>
            </div>
            <div class="overview">
                <h3>Опис:</h3>
                ${movie.overview || 'Опис відсутній'}
                <br><br>
                <button class="details-btn" onclick="openDetails(${movie.id})">Деталі та трейлер</button>
            </div>`;
        main.appendChild(movieEl);
    });
}

function showSkeletons() {
    main.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const div = document.createElement('div');
        div.classList.add('skeleton', 'skeleton-movie');
        main.appendChild(div);
    }
}

// ==========================================
// 11. ДЕТАЛІ ФІЛЬМУ (трейлер + актори)
// ==========================================
async function openDetails(id) {
    modal.style.display = 'block';
    modalTitle.innerText = "Завантаження...";
    if (modalCast) modalCast.innerText = "Актори: Завантаження...";
    trailerContainer.innerHTML = '<div class="spinner" style="margin-top:20px"></div>';

    try {
        // Два запити паралельно: українська і англійська
        // Трейлери шукаємо в обох, актори беремо з англійської (там завжди повний список)
        const [ukResp, enResp] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/${currentType}/${id}?api_key=${API_KEY}&language=uk-UA&append_to_response=videos,credits`),
            fetch(`https://api.themoviedb.org/3/${currentType}/${id}?api_key=${API_KEY}&language=en-US&append_to_response=videos,credits`)
        ]);
        const ukData = await ukResp.json();
        const enData = await enResp.json();

        modalTitle.innerText = ukData.title || ukData.name || enData.title || enData.name || 'Без назви';

        // Трейлер: спочатку українською, якщо немає — англійською
        const ukTrailer = ukData.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        const enTrailer = enData.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        const trailer = ukTrailer || enTrailer;

        trailerContainer.innerHTML = trailer
            ? `<iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen></iframe>`
            : '<p style="padding:16px 0">Трейлер відсутній</p>';

        // Актори: перші 8 з англійської версії
        const cast = enData.credits?.cast?.slice(0, 8) || [];
        if (modalCast) {
            modalCast.innerHTML = cast.length > 0
                ? `<strong>Актори:</strong> ${cast.map(a => a.name).join(', ')}`
                : '<strong>Актори:</strong> інформація відсутня';
        }

    } catch (e) {
        console.error("Помилка завантаження деталей:", e);
        modalTitle.innerText = "Помилка завантаження";
        if (modalCast) modalCast.innerText = "";
        trailerContainer.innerHTML = '<p style="padding:16px 0">Не вдалося завантажити дані. Спробуйте ще раз.</p>';
    }
}

closeModal.onclick = () => { modal.style.display = 'none'; trailerContainer.innerHTML = ''; };
window.addEventListener('click', (e) => {
    if (e.target === modal) { modal.style.display = 'none'; trailerContainer.innerHTML = ''; }
    if (e.target === authModal) { authModal.style.display = 'none'; }
});

// ==========================================
// 12. ПОШУК
// ==========================================
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = search.value.trim();
    if (!query) return;

    isFavoritesMode = false;
    isWatchLaterMode = false;
    sentinel.style.display = 'block';
    currentPage = 1;

    if (searchType.value === 'title') {
        currentUrl = `https://api.themoviedb.org/3/search/${currentType}?api_key=${API_KEY}&language=uk-UA&query=${encodeURIComponent(query)}`;
    } else {
        // Пошук за актором: вводь англійською ("Tom Hanks") або кирилицею ("Том Хенкс")
        // Спочатку шукаємо англійською — більше результатів, потім українською як запасний варіант
        let personData = await fetch(
            `https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}`
        ).then(r => r.json());

        if (!personData.results || personData.results.length === 0) {
            personData = await fetch(
                `https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&language=uk-UA&query=${encodeURIComponent(query)}`
            ).then(r => r.json());
        }

        if (personData.results && personData.results.length > 0) {
            const person = personData.results[0];
            console.log("Знайдено актора:", person.name, "ID:", person.id);
            currentUrl = `https://api.themoviedb.org/3/discover/${currentType}?api_key=${API_KEY}&language=uk-UA&with_cast=${person.id}&sort_by=popularity.desc&vote_count.gte=${MIN_VOTES}${ADULT_FILTER}`;
        } else {
            main.innerHTML = `<div style="text-align:center;width:100%;padding:3rem">
                <h2>Актора не знайдено 😔</h2>
                <p>Спробуйте ввести ім'я англійською, наприклад: <em>Tom Hanks</em></p>
            </div>`;
            return;
        }
    }
    getMovies(currentUrl, false);
});

// ==========================================
// 13. НЕСКІНЧЕННИЙ СКРОЛ
// ==========================================
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isFetching && !isFavoritesMode && !isWatchLaterMode) {
        currentPage++;
        getMovies(currentUrl, true);
    }
}, { rootMargin: '200px' });
observer.observe(sentinel);

// ==========================================
// СТАРТ
// ==========================================
init();
