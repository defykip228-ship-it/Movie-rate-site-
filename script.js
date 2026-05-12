// ==========================================
// 1. НАЛАШТУВАННЯ SUPABASE
// ==========================================
const supabaseUrl = 'https://onzrbtrifqckxldpixxz.supabase.co';
const supabaseKey = 'sb_publishable_ypcv3GeJRzP-lO7_K_eQmA_t9_7JrqP';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const API_KEY = '04c35731a5ee918f014970082a0088b1';
const IMGPATH = 'https://image.tmdb.org/t/p/w1280';

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
const contentTypeSelect = document.getElementById('contentType');
const themeToggleBtn = document.getElementById('themeToggle');

const sentinel = document.getElementById('loading-sentinel');
let isFetching = false;
let isFavoritesMode = false;

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

let currentPage = 1;
let totalPages = 1;
let currentType = 'movie';
let currentUser = null;
let userFavorites = [];

const actualDate = '2024-01-01';

// include_adult=false + without_genres=10749(дорослий контент) щоб виключити непристойне
// vote_count.gte=500 — справжній рейтинг потребує достатньо голосів
const ADULT_FILTER = `&include_adult=false&without_genres=10749`;
const MIN_VOTES = 500;

let currentUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=uk-UA&sort_by=popularity.desc&vote_count.gte=${MIN_VOTES}${ADULT_FILTER}`;

// Жанри у фільмів і серіалів різні — динамічно підвантажуємо з TMDB
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
// 3. АВТОРИЗАЦІЯ ТА ЛАЙКИ
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

// БАГ #3 ВИПРАВЛЕНО: після реєстрації показуємо чітке повідомлення,
// а після входу — одразу підвантажуємо улюблені через onAuthStateChange
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmail.value;
    const password = authPassword.value;

    if (isLoginMode) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            alert("Помилка входу: " + error.message);
        }
        // якщо успішно — onAuthStateChange спрацює автоматично і завантажить улюблені
    } else {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
            alert("Помилка реєстрації: " + error.message);
        } else {
            // Supabase може одразу дати сесію (без email confirmation) або ні
            if (data.session) {
                // Сесія є одразу — onAuthStateChange сам все зробить
                alert("Акаунт створено! Ви увійшли автоматично.");
            } else {
                // Потрібне підтвердження email
                alert("Акаунт створено! Перевірте пошту для підтвердження, потім увійдіть.");
                // Перемикаємо на форму входу
                isLoginMode = true;
                authTitle.innerText = "Вхід";
                authSubmitBtn.innerText = "Увійти";
                authToggleText.innerText = "Немає акаунту?";
                authToggleLink.innerText = "Зареєструватися";
            }
        }
    }
});

logoutBtn.addEventListener('click', async () => {
    // Чистимо локальні дані ОДРАЗУ, не чекаємо відповіді від сервера
    currentUser = null;
    userFavorites = [];
    
    // Видаляємо токени Supabase з localStorage вручну (надійніше ніж signOut через мережу)
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
        }
    });
    
    // Пробуємо signOut на сервері (не критично якщо не вдасться)
    try { await supabaseClient.auth.signOut(); } catch (e) { /* ігноруємо */ }
    
    window.location.reload();
});

// Функція оновлення UI залежно від стану сесії
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

// ГОЛОВНИЙ ЗАПУСК: спочатку чекаємо сесію, ПОТІМ завантажуємо фільми
// Це виправляє баг коли після перезавантаження кнопки скидаються і улюблені зникають
async function init() {
    await loadGenres(currentType); // завантажуємо жанри для початкового типу (movie)
    const { data: { session } } = await supabaseClient.auth.getSession();
    applySession(session);
    if (session) await loadFavorites();
    getMovies(currentUrl, false);
}

// Слухач для подій ПІСЛЯ ініціалізації (вхід/вихід під час роботи)
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    // INITIAL_SESSION вже оброблено в init(), пропускаємо щоб не дублювати запити
    if (event === 'INITIAL_SESSION') return;

    applySession(session);
    if (session) {
        await loadFavorites();
        if (!isFavoritesMode) getMovies(currentUrl, false);
    } else {
        getMovies(currentUrl, false);
    }
});

async function loadFavorites() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from('favorites')
            .select('movie_id')
            .eq('user_id', currentUser.id);
        if (error) {
            console.error("Помилка завантаження улюблених:", error.message);
            return;
        }
        if (data) {
            // movie_id може бути числом або рядком — нормалізуємо до числа
            userFavorites = data.map(item => Number(item.movie_id));
            console.log("Завантажено улюблених:", userFavorites.length);
        }
    } catch (e) {
        console.error("loadFavorites crash:", e);
    }
}

window.toggleFavorite = async function(movieId, event) {
    event.stopPropagation();
    if (!currentUser) { alert("Увійдіть, щоб зберігати!"); return; }

    const button = event.target;
    movieId = Number(movieId); // нормалізуємо до числа щоб includes() працював правильно
    const isLiked = userFavorites.includes(movieId);

    if (isLiked) {
        userFavorites = userFavorites.filter(id => id !== movieId);
        button.classList.remove('liked');
        button.innerText = '🤍';
        await supabaseClient.from('favorites').delete().eq('user_id', currentUser.id).eq('movie_id', movieId);
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
            button.classList.remove('liked');
            button.innerText = '🤍';
        }
    }
};

favoritesBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    isFavoritesMode = true;
    main.innerHTML = '';
    sentinel.style.display = 'none';
    if (userFavorites.length === 0) {
        main.innerHTML = '<h2 style="text-align:center;width:100%">Порожньо 😔</h2>';
        return;
    }
    showSkeletons();
    const promises = userFavorites.map(id =>
        fetch(`https://api.themoviedb.org/3/${currentType}/${id}?api_key=${API_KEY}&language=uk-UA`).then(res => res.json())
    );
    const results = await Promise.all(promises);
    main.innerHTML = '';
    showMovies(results.filter(m => m.id));
});

// ==========================================
// 4. ІНШИЙ ФУНКЦІОНАЛ ТА ПОШУК
// ==========================================
themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeToggleBtn.innerText = isLight ? '🌙 Темна тема' : '☀️ Світла тема';
});

function updateFilters() {
    isFavoritesMode = false;
    sentinel.style.display = 'block';
    const sortBy = sortSelect.value;
    let genre = genreSelect.value;
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
    loadGenres(currentType); // перезавантажуємо жанри для нового типу (фільм/серіал)
    updateFilters();
});
applyFiltersBtn.addEventListener('click', () => { updateFilters(); });
homeBtn.addEventListener('click', () => { window.location.reload(); });

// БАГ #4 ВИПРАВЛЕНО: кнопка "Випадковий фільм" — вибираємо рандомну сторінку і рандомний фільм
randomBtn.addEventListener('click', async () => {
    isFavoritesMode = false;
    sentinel.style.display = 'none';
    showSkeletons();

    try {
        // Беремо рандомну сторінку (1-100, щоб не виходити за межі доступних)
        const randomPage = Math.floor(Math.random() * 100) + 1;
        const url = `https://api.themoviedb.org/3/discover/${currentType}?api_key=${API_KEY}&language=uk-UA&sort_by=popularity.desc&vote_count.gte=${MIN_VOTES}${ADULT_FILTER}&page=${randomPage}`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.results && data.results.length > 0) {
            // Вибираємо один рандомний фільм зі сторінки
            const randomMovie = data.results[Math.floor(Math.random() * data.results.length)];
            main.innerHTML = '';
            showMovies([randomMovie]);
        }
    } catch (e) {
        console.error("Помилка завантаження випадкового фільму:", e);
        main.innerHTML = '<h2 style="text-align:center;width:100%">Помилка 😔 Спробуйте ще раз</h2>';
    }
});

async function getMovies(url, append = false) {
    if (isFetching || isFavoritesMode) return;
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
        const title = movie.title || movie.name;
        const imageSrc = movie.poster_path ? IMGPATH + movie.poster_path : 'https://via.placeholder.com/500x750?text=No+Image';
        const isLiked = userFavorites.includes(movie.id);

        // БАГ #1 ВИПРАВЛЕНО: toFixed(1) округлює до одного знаку після коми
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';

        const movieEl = document.createElement('div');
        movieEl.classList.add('movie');
        movieEl.innerHTML = `
            <button class="favorite-btn ${isLiked ? 'liked' : ''}" onclick="toggleFavorite(${movie.id}, event)">${isLiked ? '❤️' : '🤍'}</button>
            <img src="${imageSrc}" alt="${title}"/>
            <div class="movie-info"><h3>${title}</h3><span class="green">${rating}</span></div>
            <div class="overview"><h3>Опис:</h3>${movie.overview || 'Немає'} <br><br>
            <button class="details-btn" onclick="openDetails(${movie.id})">Деталі</button></div>`;
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

async function openDetails(id) {
    modal.style.display = 'block';
    modalTitle.innerText = "Завантаження...";
    if (modalCast) modalCast.innerText = "Актори: Завантаження...";
    trailerContainer.innerHTML = '';

    try {
        // Два запити паралельно: українська і англійська — для трейлерів і акторів
        const [ukResp, enResp] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/${currentType}/${id}?api_key=${API_KEY}&language=uk-UA&append_to_response=videos,credits`),
            fetch(`https://api.themoviedb.org/3/${currentType}/${id}?api_key=${API_KEY}&language=en-US&append_to_response=videos,credits`)
        ]);
        const ukData = await ukResp.json();
        const enData = await enResp.json();

        // Назва: українська якщо є, інакше англійська
        modalTitle.innerText = ukData.title || ukData.name || enData.title || enData.name;

        // Трейлер: спочатку шукаємо українською, якщо немає — англійською
        const ukTrailer = ukData.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        const enTrailer = enData.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        const trailer = ukTrailer || enTrailer;

        trailerContainer.innerHTML = trailer
            ? `<iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen></iframe>`
            : '<p style="padding:10px">Трейлер відсутній</p>';

        // Актори: з англійської версії (там завжди повний список), перші 8
        const cast = enData.credits?.cast?.slice(0, 8) || [];
        if (modalCast) {
            modalCast.innerText = cast.length > 0
                ? "Актори: " + cast.map(a => a.name).join(', ')
                : "Актори: інформація відсутня";
        }

    } catch (e) {
        console.error("Помилка завантаження деталей:", e);
        modalTitle.innerText = "Помилка завантаження";
        if (modalCast) modalCast.innerText = "";
        trailerContainer.innerHTML = '<p style="padding:10px">Не вдалося завантажити дані</p>';
    }
}

closeModal.onclick = () => { modal.style.display = 'none'; trailerContainer.innerHTML = ''; };

// ЛОГІКА ПОШУКУ
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (search.value) {
        isFavoritesMode = false;
        sentinel.style.display = 'block';
        currentPage = 1;
        if (searchType.value === 'title') {
            currentUrl = `https://api.themoviedb.org/3/search/${currentType}?api_key=${API_KEY}&language=uk-UA&query=${search.value}`;
        } else {
            // Пошук актора: TMDB шукає по справжньому імені (англійською або оригінальною мовою)
            // Наприклад: "Tom Hanks", "Том Хенкс", "Scarlett Johansson"
            // Спочатку шукаємо англійською (більше результатів), потім українською як fallback
            let personData = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(search.value)}`).then(r => r.json());
            if (!personData.results || personData.results.length === 0) {
                personData = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&language=uk-UA&query=${encodeURIComponent(search.value)}`).then(r => r.json());
            }
            if (personData.results && personData.results.length > 0) {
                const personId = personData.results[0].id;
                const personName = personData.results[0].name;
                console.log("Знайдено актора:", personName, "ID:", personId);
                currentUrl = `https://api.themoviedb.org/3/discover/${currentType}?api_key=${API_KEY}&language=uk-UA&with_cast=${personId}&sort_by=popularity.desc&vote_count.gte=${MIN_VOTES}${ADULT_FILTER}`;
            } else {
                main.innerHTML = `<h2 style="text-align:center;width:100%">Актора не знайдено 😔<br><small>Спробуйте ввести ім'я англійською</small></h2>`;
                return;
            }
        }
        getMovies(currentUrl, false);
    }
});

const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isFetching && !isFavoritesMode) {
        currentPage++;
        getMovies(currentUrl, true);
    }
}, { rootMargin: '200px' });
observer.observe(sentinel);

init();
