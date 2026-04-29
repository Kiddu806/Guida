const app = {
    lang: null,
    map: null,
    userMarker: null,
    isMapInitialized: false,
    audio: null,
    audioSeek: null,

    // 1. INIZIALIZZAZIONE
    init() {
        //const savedLang = localStorage.getItem('user_lang');
        //this.lang = savedLang || 'it';
        
        // Riferimenti Audio
        this.audio = document.getElementById('audio-element');
        this.audioSeek = document.getElementById('audio-seek');
        
        if (this.audio) {
            this.audio.ontimeupdate = () => this.updateAudioProgress();
            this.audio.onloadedmetadata = () => this.initAudioMetadata();
        }

        this.updateTexts();
        this.showView(savedLang ? 'view-menu' : 'view-language');
    },

    setLanguage(l) {
        this.lang = l;
        localStorage.setItem('user_lang', l);
        this.updateTexts();
        this.showView('view-onboarding');
    },

     updateTexts() {
    if (!this.lang || !translations[this.lang]) return;

    // Traduce tutti gli elementi con l'attributo data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[this.lang][key]) {
            el.innerText = translations[this.lang][key];
        }
    });

    // Aggiorna anche i testi specifici che non usano data-i18n se necessario
    const btnNav = document.getElementById('btn-navigate');
    if (btnNav) btnNav.innerText = translations[this.lang].btn_navigate;
    },

    // 2. NAVIGAZIONE VISTE
    showView(viewId) {
        if (viewId === 'view-map' && !document.getElementById('view-details').classList.contains('hidden')) {
            this.closeDetails();
            return;
        }

        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.remove('hidden');

        if (viewId === 'view-map') {
            setTimeout(() => this.initMap(), 150);
        }
    },

    // 3. LOGICA MAPPA
    initMap() {
        if (this.isMapInitialized) {
            this.map.invalidateSize();
            return;
        }

        // Controllo prima apertura per mostrare Legenda
        const firstTime = localStorage.getItem('tour_first_time');
        if (!firstTime) {
            this.toggleLegend();
            localStorage.setItem('tour_first_time', 'done');
        }
 
 /*maxBounds: [[37.9750, 13.9600], 
            [37.9550, 13.9850]],*/

        /*NORD : 37.971282, 13.974602
        SUD : 37.960703, 13.974906
        EST: 37.965732, 13.979434
        OVEST : 37.965645, 13.966623
        
        37.960986, 13.979792*/

        const centroGratteri = [37.966124, 13.973222];

        // Calcoliamo i confini in modo che il centro sia equidistante dai bordi
        // Offset Latitudine: 0.004 | Offset Longitudine: 0.005
        this.map = L.map('map', {
        zoomControl: false,
        // Confini simmetrici rispetto al centro (± 0.006 lat, ± 0.007 lng)
        maxBounds: [
            [37.960124, 13.966222], // Sud-Ovest
            [37.972124, 13.980222]  // Nord-Est
        ],
        maxBoundsViscosity: 1.0,
        minZoom: 16, // Ora che l'area è più grande, possiamo tornare a 16
        maxZoom: 19
        }).setView(centroGratteri, 17);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '© CARTO'
        }).addTo(this.map);

        this.loadTourData();
        this.startTracking();
        this.isMapInitialized = true;
    },

    loadTourData() {
        fetch('map.geojson')
            .then(res => res.json())
            .then(data => {
                L.geoJSON(data, {
                    pointToLayer: (feature, latlng) => {
                        const img = feature.properties.image_url || 'assets/default.jpg';
                        // Categorie: monumento, ristoro, comune
                        const cat = feature.properties.category || 'default'; 
                        
                        const photoIcon = L.divIcon({
                            className: 'custom-photo-marker',
                            html: `<div class="marker-photo-circle marker-${cat}">
                                     <img src="${img}">
                                   </div>`,
                            iconSize: [46, 46],
                            iconAnchor: [23, 23]
                        });
                        return L.marker(latlng, { icon: photoIcon });
                    },
                    style: { color: "#2d5a27", weight: 5, opacity: 0.8 },
                    onEachFeature: (feature, layer) => {
                        layer.on('click', (e) => {
                            L.DomEvent.stopPropagation(e);
                            this.openDetails(feature.properties, feature.geometry.coordinates);
                        });
                    }
                }).addTo(this.map);
            });
    },

    // 4. DETTAGLI E AUDIO
    openDetails(props, coords) {
        const title = props[`title_${this.lang}`] || props.title || "Punto";
        const desc = props[`desc_${this.lang}`] || props.description || "";
        const img = props.image_url || "assets/default.jpg";
        const audioUrl = props.audio_url || "";

        document.getElementById('detail-title').innerText = title;
        document.getElementById('detail-desc').innerText = desc;
        document.getElementById('detail-img').src = img;

        // Reset e Caricamento Audio
        const playerDiv = document.querySelector('.audio-player');
        if (audioUrl && this.audio) {
            playerDiv.style.display = "flex";
            this.audio.src = audioUrl;
            this.audio.load();
            this.resetAudioUI();
        } else if (playerDiv) {
            playerDiv.style.display = "none";
        }

        // Navigatore
        const btnNav = document.getElementById('btn-navigate');
        if (btnNav && coords && typeof coords[1] === 'number') {
            btnNav.onclick = () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`);
            btnNav.style.display = "block";
        }

        document.getElementById('view-details').classList.remove('hidden');
    },

    closeDetails() {
        if (this.audio) this.audio.pause();
        document.getElementById('view-details').classList.add('hidden');
    },

    // 5. CONTROLLI AUDIO PERSONALIZZATI
    toggleAudio() {
    const btn = document.getElementById('btn-play-pause');
    if (this.audio.paused) {
        this.audio.play();
        btn.innerHTML = '<div class="paused-icon-container"><div class="pause-bar"></div><div class="pause-bar"></div></div>';
    } else {
        this.audio.pause();
        // Creiamo un div per il triangolo invece del testo
        btn.innerHTML = '<div class="play-triangle"></div>';
    }
},

    initAudioMetadata() {
        if (this.audioSeek) this.audioSeek.max = Math.floor(this.audio.duration);
        const durationEl = document.getElementById('total-duration');
        if (durationEl) durationEl.innerText = this.formatTime(this.audio.duration);
    },

    updateAudioProgress() {
        if (this.audioSeek) this.audioSeek.value = Math.floor(this.audio.currentTime);
        const currentEl = document.getElementById('current-time');
        if (currentEl) currentEl.innerText = this.formatTime(this.audio.currentTime);
    },

    seekAudio() {
        if (this.audio && this.audioSeek) this.audio.currentTime = this.audioSeek.value;
    },

    resetAudioUI() {
        const btn = document.getElementById('btn-play-pause');
    if (btn) btn.innerHTML = '<div class="play-triangle"></div>';
        if (this.audioSeek) this.audioSeek.value = 0;
        document.getElementById('current-time').innerText = "00:00";
    },

    formatTime(seconds) {
        if (isNaN(seconds)) return "00:00";
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    },

    // 6. UTILS (LEGENDA E GPS)
    toggleLegend() {
        const popup = document.getElementById('info-popup');
        if (popup) popup.classList.toggle('hidden');
    },

    startTracking() {
        if (!navigator.geolocation) return;
        const blueDotIcon = L.divIcon({
            className: 'user-location-dot',
            html: '<div class="dot"></div><div class="pulse"></div>',
            iconSize: [20, 20]
        });
        navigator.geolocation.watchPosition((pos) => {
            const latLng = [pos.coords.latitude, pos.coords.longitude];
            if (!this.userMarker) this.userMarker = L.marker(latLng, {icon: blueDotIcon}).addTo(this.map);
            else this.userMarker.setLatLng(latLng);
        }, null, {enableHighAccuracy: true});
    }
};

window.onload = () => app.init();