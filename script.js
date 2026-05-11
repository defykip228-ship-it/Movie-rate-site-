// ==========================================
// 1. НАЛАШТУВАННЯ SUPABASE
// ==========================================
const supabaseUrl = 'https://onzrbtrifqckxldpixxz.supabase.co';
const supabaseKey = 'sb_publishable_ypcv3GeJRzP-lO7_K_eQmA_t9_7JrqP'; // <--- ВСТАВ СВІЙ КЛЮЧ!
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
const favoritesBtn = document.getElementById('favoritesBtn'); // Кнопка "Мої фільми"
const contentTypeSelect = document.getElementById('contentType');
const themeToggleBtn = document.getElementById('themeToggle');

const sentinel = document.getElementById('loading-sentinel');
let isFetching = false;
let isFavoritesMode = false; // Чи ми зараз у вкладці "Мої фільми"

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
let userFavorites = []; // Зберігає ID всіх улюблених фільмів поточного користувача

const actualDate = '2024-01-01'; 
// Добавили жесткий фильтр: минимум 300 голосов и без документалок/клипов
let currentUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=uk-UA&sort_by=popularity.desc&primary_release_date.gte=${actualDate}&vote_count.gte=300&without_genres=99,10402`;

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

const genresMap = {
    28: "Бойовик", 12: "Пригоди", 16: "Мультфільм", 35: "Комедія",
    80: "Кримінал", 99: "Документальний", 18: "Драма", 10751: "Сімейний",
    14: "Фентезі", 36: "Історія", 27: "Жахи", 10402: "Музика",
    9648: "Детектив", 10749: "Мелодрама", 878: "Фантастика",
    10770: "ТБ", 53: "Трилер", 10752: "Військовий", 37: "Вестерн",
    10759: "Бойовик/Пригоди", 10765: "Фантастика", 10768: "Війна/Політика"
};

// ==========================================
// 3. АВТОРИЗАЦІЯ ТА ЛАЙКИ (SUPABASE)
// ==========================================
let isLoginMode = true;

loginBtn.addEventListener('click', () => { authModal.style.display = 'block'; authEmail.value = ''; authPassword.value = ''; });
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
    const email = authEmail.value; const password = authPassword.value;
    if (isLoginMode) {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) alert("Помилка входу: " + error.message); else { alert("Успішний вхід!"); authModal.style.display = 'none'; }
    } else {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) alert("Помилка реєстрації: " + error.message); else { alert("Акаунт створено!"); authModal.style.display = 'none'; }
    }
});

logoutBtn.addEventListener('click', async () => { await supabaseClient.auth.signOut(); alert("Ви вийшли."); });

// Коли юзер входить - завантажуємо його лайки
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        currentUser = session.user;
        loginBtn.style.display = 'none'; 
        logoutBtn.style.display = 'inline-block';
        favoritesBtn.style.display = 'inline-block';
        await loadFavorites(); // Завантажуємо лайки
        if(!isFavoritesMode) getMovies(currentUrl, false); // Оновлюємо сторінку, щоб сердечка намалювалися
    } else {
        currentUser = null;
        userFavorites = [];
        loginBtn.style.display = 'inline-block'; 
        logoutBtn.style.display = 'none';
        favoritesBtn.style.display = 'none';
        isFavoritesMode = false;
        getMovies(currentUrl, false);
    }
});

// Функція завантаження лайків з БД
async function loadFavorites() {
    if (!currentUser) return;
    const { data, error } = await supabaseClient
        .from('user_actions')
        .select('movie_id')
        .eq('user_id', currentUser.id)
        .eq('is_favorite', true);
    if (data) userFavorites = data.map(item => item.movie_id);
}

// Функція кліку по сердечку
window.toggleFavorite = async function(movieId, event) {
    event.stopPropagation(); // Щоб не відкривалося модальне вікно фільму
    if (!currentUser) { alert("Будь ласка, увійдіть в акаунт, щоб зберігати фільми!"); return; }
    
    const button = event.target;
    const isLiked = userFavorites.includes(movieId);

    if (isLiked) {
        // Видаляємо лайк
        userFavorites = userFavorites.filter(id => id !== movieId);
        button.classList.remove('liked');
        button.innerText = '🤍';
        await supabaseClient.from('user_actions').delete().eq('user_id', currentUser.id).eq('movie_id', movieId);
        // Якщо ми у вкладці "Мої фільми" - одразу прибираємо фільм з екрану
        if (isFavoritesMode) button.closest('.movie').remove();
    } else {
        // Ставимо лайк
        userFavorites.push(movieId);
        button.classList.add('liked');
        button.innerText = '❤️';
        await supabaseClient.from('user_actions').insert({ user_id: currentUser.id, movie_id: movieId, is_favorite: true });
    }
};

// Вкладка "Мої фільми"
favoritesBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    isFavoritesMode = true;
    main.innerHTML = '';
    sentinel.style.display = 'none'; // Вимикаємо нескінченну стрічку
    
    if (userFavorites.length === 0) {
        main.innerHTML = '<h2 style="text-align: center; width: 100%;">У вас ще немає збережених фільмів 😔</h2>';
        return;
    }
    
    showSkeletons();
    
    try {
        // Завантажуємо кожен збережений фільм по його ID
        const promises = userFavorites.map(id => 
            fetch(`https://api.themoviedb.org/3/${currentType}/${id}?api_key=${API_KEY}&language=uk-UA`).then(res => res.json())
        );
        const results = await Promise.all(promises);
        main.innerHTML = '';
        
        // Фільтруємо помилки (наприклад, якщо ID серіалу, а ми шукаємо фільм)
        const validMovies = results.filter(m => m.id);
        if(validMovies.length > 0) showMovies(validMovies);
        else main.innerHTML = '<h2 style="text-align: center; width: 100%;">У цій категорії (Фільми/Серіали) немає збережень.</h2>';
    } catch(e) { console.error(e); }
});

// ==========================================
// 4. ІНШИЙ КОД САЙТУ
// ==========================================
if (localStorage.getItem('theme') === 'light') { document.body.classList.add('light-theme'); themeToggleBtn.innerText = '🌙 Темна тема'; }
themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeToggleBtn.innerText = isLight ? '🌙 Темна тема' : '☀️ Світла тема';
});

function updateFilters() {
    isFavoritesMode = false;
    sentinel.style.display = 'block';
    const sortBy = sortSelect.value; let genre = genreSelect.value; const rating = ratingSelect.value;
    if (currentType === 'tv' && genre) {
        if (genre === '28' || genre === '12') genre = '10759'; 
        if (genre === '878' || genre === '14') genre = '10765'; 
        if (genre === '53') genre = '9648'; 
    }
    let filterUrl = `https://api.themoviedb.org/3/discover/${currentType}?sort_by=${sortBy}&api_key=${API_KEY}&language=uk-UA`;
    if (genre) filterUrl += `&with_genres=${genre}`;
    if (rating) filterUrl += `&vote_average.gte=${rating}`;
    if (sortBy === 'vote_average.desc') { filterUrl += `&vote_count.gte=2000`; filterUrl += `&without_genres=99,10402`; }
    currentPage = 1; currentUrl = filterUrl; getMovies(currentUrl, false);
}

contentTypeSelect.addEventListener('change', () => { currentType = contentTypeSelect.value; updateFilters(); });
applyFiltersBtn.addEventListener('click', () => { updateFilters(); });

homeBtn.addEventListener('click', () => {
    isFavoritesMode = false; sentinel.style.display = 'block';
    resetAllFiltersUI(); currentPage = 1;
    // Тот же жесткий фильтр возвращаем при клике на "Головна"
    currentUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=uk-UA&sort_by=popularity.desc&primary_release_date.gte=${actualDate}&vote_count.gte=300&without_genres=99,10402`;
    getMovies(currentUrl, false);
});

randomBtn.addEventListener('click', async () => {
    const randomPage = Math.floor(Math.random() * 20) + 1;
    const randUrl = `https://api.themoviedb.org/3/discover/${currentType}?api_key=${API_KEY}&language=uk-UA&sort_by=popularity.desc&vote_count.gte=300&vote_average.gte=6.5&page=${randomPage}`;
    try {
        const resp = await fetch(randUrl); const data = await resp.json();
        if(data.results && data.results.length > 0) openDetails(data.results[Math.floor(Math.random() * data.results.length)].id);
    } catch(e) { console.error(e); }
});

function showSkeletons() {
    main.innerHTML = '';
    for (let i = 0; i < 20; i++) {
        const skeletonEl = document.createElement('div');
        skeletonEl.classList.add('skeleton', 'skeleton-movie');
        main.appendChild(skeletonEl);
    }
}

async function getMovies(url, append = false) {
    if (isFetching || isFavoritesMode) return;
    isFetching = true;
    if (!append) showSkeletons(); else sentinel.innerHTML = '<div class="spinner"></div>'; 

    try {
        const finalUrl = `${url}&page=${currentPage}`;
        const resp = await fetch(finalUrl); const respData = await resp.json();
        if (!append) main.innerHTML = ''; sentinel.innerHTML = ''; 
        if (respData.results && respData.results.length > 0) {
            showMovies(respData.results);
            totalPages = respData.total_pages > 500 ? 500 : respData.total_pages;
        } else if (!append) main.innerHTML = '<h2 style="text-align: center; width: 100%;">Нічого не знайдено</h2>';
    } catch (error) { console.error(error); }
    isFetching = false;
}

function showMovies(movies){
    movies.forEach(movie => {
        const title = movie.title || movie.name;
        const release_date = movie.release_date || movie.first_air_date;
        const imageSrc = movie.poster_path ? IMGPATH + movie.poster_path : 'https://via.placeholder.com/1280x1920/22254b/ffffff?text=Постер+відсутній';
        let vote = (Math.round(movie.vote_average * 10) / 10).toString();
        if (vote.endsWith('.0')) vote = vote.slice(0, -2);
        
        // Перевіряємо, чи є фільм у списку улюблених
        const isLiked = userFavorites.includes(movie.id);
        const heartClass = isLiked ? 'favorite-btn liked' : 'favorite-btn';
        const heartIcon = isLiked ? '❤️' : '🤍';

        const movieEl = document.createElement('div');
        movieEl.classList.add('movie');
        movieEl.innerHTML=`
            <button class="${heartClass}" onclick="toggleFavorite(${movie.id}, event)">${heartIcon}</button>
            <img src="${imageSrc}" alt="${title}" loading="lazy"/>
            <div class="movie-info">
                <h3>${title}</h3>
                <span class="${getClassByRate(movie.vote_average)}">${vote}</span>
            </div> 
            <div class="overview">
                <h3>Опис:</h3>
                <div style="font-size: 0.85rem; margin-bottom: 10px;">
                    <strong>Рік:</strong> ${release_date ? release_date.slice(0,4) : 'Невідомо'}<br>
                </div>
                ${movie.overview ? movie.overview.substring(0, 150) + '...' : 'Опис відсутній.'}
                <button class="details-btn" onclick="openDetails(${movie.id})">Деталі та Трейлер 🎬</button>
            </div>
            `;
        main.appendChild(movieEl);
    });
}

function getClassByRate(vote){
    if(vote >= 8) return 'green';
    else if (vote >= 5) return 'orange';
    return 'red';
}

async function openDetails(id) {
    modal.style.display = 'block'; modalTitle.innerText = "Завантаження..."; trailerContainer.innerHTML = "";
    similarMoviesSection.style.display = 'none'; similarMoviesContainer.innerHTML = '';
    try {
        const resp = await fetch(`https://api.themoviedb.org/3/${currentType}/${id}?api_key=${API_KEY}&language=uk-UA&append_to_response=credits,videos`);
        const data = await resp.json();
        modalTitle.innerText = data.title || data.name;
        modalCast.innerHTML = `<strong>Актори:</strong> ${data.credits.cast.slice(0, 5).map(a => a.name).join(', ')}`;
        let tr = data.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        if (!tr) {
            const en = await fetch(`https://api.themoviedb.org/3/${currentType}/${id}/videos?api_key=${API_KEY}&language=en-US`).then(r => r.json());
            if(en.results) tr = en.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        }
        trailerContainer.innerHTML = tr ? `<iframe src="https://www.youtube.com/embed/${tr.key}" allowfullscreen></iframe>` : '<p>Трейлер не знайдено</p>';
        
        const sim = await fetch(`https://api.themoviedb.org/3/${currentType}/${id}/similar?api_key=${API_KEY}&language=uk-UA&page=1`).then(r => r.json());
        if (sim.results && sim.results.length > 0) {
            similarMoviesSection.style.display = 'block';
            sim.results.slice(0, 8).forEach(s => {
                const img = s.poster_path ? `https://image.tmdb.org/t/p/w200${s.poster_path}` : 'https://via.placeholder.com/200x300?text=No+Image';
                const div = document.createElement('div'); div.classList.add('similar-movie-card'); div.onclick = () => openDetails(s.id);
                div.innerHTML = `<img src="${img}"><h4>${s.title || s.name}</h4>`; similarMoviesContainer.appendChild(div);
            });
        }
    } catch (e) { console.error(e); }
}

closeModal.onclick = () => { modal.style.display = "none"; trailerContainer.innerHTML = ""; };
window.onclick = (e) => { if (e.target == modal && e.target !== authModal) { modal.style.display = "none"; trailerContainer.innerHTML = ""; } };

form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if(search.value){
        isFavoritesMode = false; sentinel.style.display = 'block';
        currentPage = 1;
        if (searchType.value === 'title') currentUrl = `https://api.themoviedb.org/3/search/${currentType}?api_key=${API_KEY}&language=uk-UA&query=${search.value}`;
        else {
            const p = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&language=uk-UA&query=${search.value}`).then(r => r.json());
            if (p.results.length > 0) currentUrl = `https://api.themoviedb.org/3/discover/${currentType}?api_key=${API_KEY}&language=uk-UA&with_cast=${p.results[0].id}&sort_by=popularity.desc`;
        }
        getMovies(currentUrl, false);
    }
});

const observer = new IntersectionObserver((entries) => {
    if(entries[0].isIntersecting && !isFetching && !isFavoritesMode && currentPage < totalPages) {
        currentPage++; getMovies(currentUrl, true);
    }
}, { rootMargin: '200px' });
observer.observe(sentinel);

// Запуск
getMovies(currentUrl, false);