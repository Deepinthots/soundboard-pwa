// Main soundboard application

// Helper to determine the repository subfolder base path automatically
const BASE_PATH = (() => {
	const path = window.location.pathname;
	return path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);
})();

const resolvePath = (relativeUrl) => {
	const cleanUrl = relativeUrl.startsWith("/") ? relativeUrl.slice(1) : relativeUrl;
	return `${BASE_PATH}${cleanUrl}`;
};

// Fallback sounds data (pointing to your new office files)
window.FALLBACK_SOUNDS = [
	{ name: "5 Farter Death Punch", artist: "Office", mp3: "office/5 Farter Death Punch.mp3" },
	{ name: "A Question, Billy", artist: "Office", mp3: "office/A Question, Billy.mp3" },
	{ name: "AH", artist: "Office", mp3: "office/AH.mp3" },
	{ name: "AHHHH", artist: "Office", mp3: "office/AHHHH.mp3" },
	{ name: "Billy Fanfare", artist: "Office", mp3: "office/Billy Fanfare.mp3" },
	{ name: "Billy Hum 1", artist: "Office", mp3: "office/Billy Hum 1.mp3" },
	{ name: "Billy Hum 2", artist: "Office", mp3: "office/Billy Hum 2.mp3" },
	{ name: "Billy Hum 3", artist: "Office", mp3: "office/Billy Hum 3.mp3" },
	{ name: "Billy Laugh 1", artist: "Office", mp3: "office/Billy Laugh 1.mp3" },
	{ name: "Boner 1", artist: "Office", mp3: "office/Boner1.mp3" },
	{ name: "Bully Maguire", artist: "Office", mp3: "office/Bully Maguire.mp3" },
	{ name: "Defeated Billy", artist: "Office", mp3: "office/Defeated Billy.mp3" },
	{ name: "DIP-PY", artist: "Office", mp3: "office/DIP-PY.mp3" },
	{ name: "Downward Fart", artist: "Office", mp3: "office/Downward Fart.mp3" },
	{ name: "Dry Mop", artist: "Office", mp3: "office/Dry Mop.mp3" },
	{ name: "Goat Ray", artist: "Office", mp3: "office/Goat Ray.mp3" },
	{ name: "GOO!", artist: "Office", mp3: "office/GOO!.mp3" },
	{ name: "HHHHHHHUUUUUOOOO", artist: "Office", mp3: "office/HHHHHHHUUUUUOOOO.mp3" },
	{ name: "HHHUUUOO", artist: "Office", mp3: "office/HHHUUUOO.mp3" },
	{ name: "Humming Billy Laugh", artist: "Office", mp3: "office/Humming Billy Laugh.mp3" },
	{ name: "HUO", artist: "Office", mp3: "office/HUO.mp3" },
	{ name: "Inflected Billy", artist: "Office", mp3: "office/Inflected Billy.mp3" },
	{ name: "JEW JEW", artist: "Office", mp3: "office/JEW JEW.mp3" },
	{ name: "Jurrassic Lomo", artist: "Office", mp3: "office/Jurrassic Lomo.mp3" },
	{ name: "No but Yes", artist: "Office", mp3: "office/No but Yes.mp3" },
	{ name: "Peckham Laugh", artist: "Office", mp3: "office/Peckham Laugh.mp3" },
	{ name: "PENQUITOS", artist: "Office", mp3: "office/PENQUITOS.mp3" },
	{ name: "PERFECT!", artist: "Office", mp3: "office/PERFECT!.mp3" },
	{ name: "Pop Fart", artist: "Office", mp3: "office/Pop Fart.mp3" },
	{ name: "SarcastiBilly", artist: "Office", mp3: "office/SarcastiBilly.mp3" },
	{ name: "Soft Billy", artist: "Office", mp3: "office/Soft Billy.mp3" },
	{ name: "TIIIIOOOTTS", artist: "Office", mp3: "office/TIIIIOOOTTS.mp3" },
	{ name: "Usual Suspects Billy", artist: "Office", mp3: "office/Usual Suspects Billy.mp3" },
	{ name: "Wet Fart", artist: "Office", mp3: "office/Wet Fart.mp3" },
	{ name: "Ya (boner!)", artist: "Office", mp3: "office/Ya (boner!).mp3" },
	{ name: "Yes but No", artist: "Office", mp3: "office/Yes but No.mp3" },
	{ name: "You're losing it, Billy", artist: "Office", mp3: "office/You're losing it, Billy.mp3" },
	{ name: "Yyyyeeaaaaaah", artist: "Office", mp3: "office/Yyyyeeaaaaaah.mp3" }
];

class SoundboardApp {
	constructor() {
		this.sounds = [];
		this.filteredSounds = [];
		this.searchQuery = "";
		this.isOnline = navigator.onLine;
		this.config = null;

		this.init();
	}

	async init() {
		// Load configuration first
		await this.loadConfig();

		// Update page title and meta description with config
		this.updatePageMetadata();

		// Register service worker relative to repo base path
		if ("serviceWorker" in navigator) {
			try {
				const swPath = resolvePath("sw.js");
				const registration = await navigator.serviceWorker.register(swPath, {
					scope: BASE_PATH,
				});
				console.log("Service Worker registered with scope:", registration.scope);

				// Listen for updates
				registration.addEventListener("updatefound", () => {
					const newWorker = registration.installing;
					newWorker.addEventListener("statechange", () => {
						if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
							this.showStatus("♫ NEW SOUNDS AVAILABLE! REFRESH TO UPDATE ♫", "success");
						}
					});
				});
			} catch (error) {
				console.error("Service Worker registration failed:", error);
			}
		}

		// Listen for messages from service worker
		if ("serviceWorker" in navigator) {
			navigator.serviceWorker.addEventListener("message", (event) => {
				if (event.data && event.data.type === "AUDIO_CACHED") {
					const cachedUrl = event.data.url;
					try {
						let soundPath;
						if (cachedUrl.startsWith("http")) {
							soundPath = new URL(cachedUrl).pathname;
						} else {
							soundPath = cachedUrl;
						}
						console.log("📢 Service worker notified: Audio cached -", soundPath);
						this.updateSoundCacheStatus(soundPath, true);
					} catch (error) {
						console.error("Error processing cached URL:", cachedUrl, error);
						this.updateSoundCacheStatus(cachedUrl, true);
					}
				}
			});
		}

		// Set up event listeners
		this.setupEventListeners();

		// Load sounds
		await this.loadSounds();

		// Monitor online/offline status
		window.addEventListener("online", () => {
			this.isOnline = true;
			this.hideOfflineIndicator();
			this.checkForUpdates();
		});

		window.addEventListener("offline", () => {
			this.isOnline = false;
			this.showOfflineIndicator();
		});

		if (!this.isOnline) {
			this.showOfflineIndicator();
		}
	}

	async loadConfig() {
		try {
			console.log("🔧 Loading configuration...");
			const response = await fetch(resolvePath("config.json"));
			if (response.ok) {
				this.config = await response.json();
				console.log("✅ Configuration loaded");
			} else {
				throw new Error("Config not found");
			}
		} catch (error) {
			console.warn("⚠️ Could not load config, using defaults:", error);
			this.config = {
				title: "Office Soundboard",
				shortName: "Sounds",
				subtitle: "OFFICE SOUNDS",
				description: "A Progressive Web App soundboard",
				headerTitle: "♫ OFFICE SOUNDBOARD ♫",
				searchPlaceholder: "SEARCH FOR SOUNDS...",
				tipText: "↑ PRESS [S] TO SEARCH • CLICK TO PLAY ↑",
				loadingText: "LOADING SOUNDS...",
				offlineText: "OFFLINE MODE - USING CACHED SOUNDS",
				soundCountText: "AUDIO DROPS",
				themeColor: "#1a1a1a",
				backgroundColor: "#1a1a1a",
			};
		}
	}

	updatePageMetadata() {
		document.title = `🔊 ${this.config.title}`;

		const metaDescription = document.querySelector('meta[name="description"]');
		if (metaDescription) {
			metaDescription.setAttribute("content", this.config.description);
		}

		const themeColorMeta = document.querySelector('meta[name="theme-color"]');
		if (themeColorMeta) {
			themeColorMeta.setAttribute("content", this.config.themeColor);
		}

		const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
		if (appleTitleMeta) {
			appleTitleMeta.setAttribute("content", this.config.title);
		}

		this.updateManifest();

		const headerTitle = document.querySelector(".header h1");
		if (headerTitle) {
			headerTitle.textContent = this.config.headerTitle;
		}

		this.updateSubtitle(0);

		const searchInput = document.getElementById("search-input");
		if (searchInput) {
			searchInput.placeholder = this.config.searchPlaceholder;
		}

		const tipElement = document.querySelector(".tip");
		if (tipElement) {
			tipElement.textContent = this.config.tipText;
		}

		const loadingElement = document.querySelector(".loading");
		if (loadingElement) {
			loadingElement.textContent = this.config.loadingText;
		}

		const offlineIndicator = document.getElementById("offline-indicator");
		if (offlineIndicator) {
			offlineIndicator.textContent = this.config.offlineText;
		}
	}

	async updateManifest() {
		try {
			console.log("🔧 Manifest will be updated via service worker");
			window.soundboardConfig = this.config;

			let manifestLink = document.querySelector('link[rel="manifest"]');
			if (manifestLink) {
				const timestamp = Date.now();
				manifestLink.href = resolvePath(`manifest.json?t=${timestamp}`);
			}
		} catch (error) {
			console.warn("⚠️ Could not update manifest:", error);
		}
	}

	updateSubtitle(soundCount) {
		const subtitle = document.querySelector(".header .subtitle");
		if (subtitle) {
			subtitle.innerHTML = `${this.config.subtitle} • <span id="sound-count">${soundCount}</span> ${this.config.soundCountText}<span class="cache-legend">💾 THIS DROP IS SAVED AND CAN PLAY OFFLINE</span>`;
		}
	}

	setupEventListeners() {
		const searchInput = document.getElementById("search-input");
		if (searchInput) {
			searchInput.addEventListener("input", (e) => {
				this.searchQuery = e.target.value;
				this.filterSounds();
			});
		}

		document.addEventListener("keydown", (e) => {
			if ((e.key === "s" || e.key === "S") && searchInput && document.activeElement !== searchInput) {
				e.preventDefault();
				searchInput.focus();
				searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
			}
		});
	}

	async loadSounds() {
		try {
			const cachedSounds = await this.getCachedSounds();
			if (cachedSounds && cachedSounds.length > 0) {
				console.log(`📦 Loaded ${cachedSounds.length} sounds from cache`);
				this.sounds = cachedSounds;
				await this.renderSounds();
			}

			if (this.isOnline) {
				const apiUrls = [resolvePath("api/sounds.json"), resolvePath("public/api/sounds.json")];
				let dataLoaded = false;

				for (const url of apiUrls) {
					try {
						console.log(`🌐 Trying to fetch from ${url}...`);
						const response = await fetch(url);
						console.log(`📡 Response from ${url}:`, response.status, response.ok);
						if (response.ok) {
							const data = await response.json();
							this.sounds = data.files || data;
							this.cacheSounds(this.sounds);
							await this.renderSounds();

							this.preCachePopularSounds();
							dataLoaded = true;
							console.log(`✅ Loaded ${this.sounds.length} sounds from ${url}`);
							break;
						}
					} catch (error) {
						console.log(`❌ Failed to load from ${url}:`, error);
					}
				}

				if (!dataLoaded) {
					console.warn(
						"⚠️ Could not load sounds from any API endpoint, using cached or fallback data",
					);
					if (!this.sounds.length) {
						await this.loadFallbackSounds();
					}
				}
			}
		} catch (error) {
			console.error("💥 Error loading sounds:", error);
			await this.loadFallbackSounds();
		}
	}

	async getCachedSounds() {
		try {
			const cached = localStorage.getItem("soundboard-data");
			return cached ? JSON.parse(cached) : null;
		} catch (error) {
			console.error("Error reading cached sounds:", error);
			return null;
		}
	}

	cacheSounds(sounds) {
		try {
			localStorage.setItem("soundboard-data", JSON.stringify(sounds));
			localStorage.setItem("soundboard-data-timestamp", Date.now().toString());
		} catch (error) {
			console.error("Error caching sounds:", error);
		}
	}

	async loadFallbackSounds() {
		this.sounds = window.FALLBACK_SOUNDS || [];
		await this.renderSounds();
	}

	async filterSounds() {
		if (!this.searchQuery.trim()) {
			this.filteredSounds = [...this.sounds];
		} else {
			const query = this.searchQuery.toLowerCase();
			this.filteredSounds = this.sounds.filter(
				(sound) =>
					sound.name.toLowerCase().includes(query) || sound.artist.toLowerCase().includes(query),
			);
		}
		await this.renderSounds();
	}

	async renderSounds() {
		const container = document.getElementById("sounds-container");
		if (!container) return;

		if (!this.filteredSounds.length && this.searchQuery) {
			container.innerHTML = `
                <div class="loading">
                    ✗ NO SOUNDS FOUND FOR "${this.searchQuery}" ✗
                </div>
            `;
			return;
		}

		if (!this.sounds.length) {
			container.innerHTML = `
                <div class="loading">
                    ${this.isOnline ? this.config?.loadingText || "LOADING..." : "✗ NO SOUNDS AVAILABLE OFFLINE ✗"}
                </div>
            `;
			return;
		}

		const soundsToShow = this.filteredSounds.length ? this.filteredSounds : this.sounds;
		soundsToShow.sort((a, b) => a.name.localeCompare(b.name));

		this.updateSubtitle(this.sounds.length);

		const soundsWithCacheStatus = await this.checkCachedSounds();
		const soundsToShowWithCache = soundsToShow.map((sound) => {
			const cached = soundsWithCacheStatus.find((s) => s.mp3 === sound.mp3);
			return { ...sound, isCached: cached?.isCached || false };
		});

		container.innerHTML = soundsToShowWithCache
			.map(
				(sound) => `
            <button 
                class="sound-button ${sound.isCached ? "cached" : ""}" 
                data-sound='${JSON.stringify(sound).replace(/'/g, "&apos;")}'
            >
                <div class="sound-name">${this.escapeHtml(sound.name)}</div>
                <div class="sound-artist">${this.escapeHtml(sound.artist)}</div>
                ${sound.isCached ? '<span class="cache-icon" aria-hidden="true">💾</span>' : ""}
            </button>
        `,
			)
			.join("");

		container.querySelectorAll(".sound-button").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const sound = JSON.parse(e.currentTarget.dataset.sound);
				this.playSound(sound);
			});
		});
	}

	async playSound(sound) {
		try {
			const audioPath = resolvePath(sound.mp3);
			console.log("🎵 Playing sound:", audioPath);

			const response = await fetch(audioPath);
			if (!response.ok) {
				throw new Error(`Failed to fetch audio: ${response.status}`);
			}

			const audioBlob = await response.blob();
			const audioUrl = URL.createObjectURL(audioBlob);
			const audio = new Audio(audioUrl);

			audio.addEventListener("ended", () => {
				URL.revokeObjectURL(audioUrl);
			});

			audio.addEventListener("error", (e) => {
				console.error("Audio error:", e);
				URL.revokeObjectURL(audioUrl);
				throw new Error("Could not play sound");
			});

			await audio.play();
			this.updateSoundCacheStatus(sound.mp3, true);
		} catch (error) {
			if (error.name === "NotAllowedError") {
				this.showStatus("⚠ CLICK ANYWHERE TO ENABLE AUDIO ⚠", "error");
			} else {
				this.showStatus("✗ COULD NOT PLAY SOUND ✗", "error");
			}
			throw error;
		}
	}

	async cacheAudioFile(soundPath) {
		if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
			navigator.serviceWorker.controller.postMessage({
				type: "CACHE_AUDIO",
				url: resolvePath(soundPath),
			});
		}
	}

	async preCachePopularSounds() {
		if (
			"serviceWorker" in navigator &&
			navigator.serviceWorker.controller &&
			this.sounds.length > 0
		) {
			const popularSounds = this.sounds.slice(0, 20).map((s) => ({
				...s,
				mp3: resolvePath(s.mp3),
			}));
			navigator.serviceWorker.controller.postMessage({
				type: "CACHE_SOUNDS",
				sounds: popularSounds,
			});
			console.log(`Pre-caching ${popularSounds.length} popular sounds...`);
		}
	}

	showStatus(message, type = "info") {
		const status = document.getElementById("status");
		if (!status) return;
		status.textContent = message;
		status.className = `status show ${type}`;

		setTimeout(() => {
			status.classList.remove("show");
		}, 3000);
	}

	showOfflineIndicator() {
		const el = document.getElementById("offline-indicator");
		if (el) el.classList.add("show");
	}

	hideOfflineIndicator() {
		const el = document.getElementById("offline-indicator");
		if (el) el.classList.remove("show");
	}

	async checkForUpdates() {
		if (!this.isOnline) return;

		try {
			const timestamp = localStorage.getItem("soundboard-data-timestamp");
			const lastUpdate = timestamp ? parseInt(timestamp) : 0;
			const now = Date.now();

			if (now - lastUpdate > 3600000) {
				await this.loadSounds();
			}
		} catch (error) {
			console.error("Error checking for updates:", error);
		}
	}

	async checkCachedSounds() {
		if ("caches" in window) {
			try {
				const cache = await caches.open("neil-rogers-sounds-v2");
				const cachedRequests = await cache.keys();
				const cachedUrls = cachedRequests.map((req) => req.url);

				return this.sounds.map((sound) => ({
					...sound,
					isCached: cachedUrls.some((url) => url.endsWith(encodeURI(sound.mp3)) || url.endsWith(sound.mp3)),
				}));
			} catch (error) {
				console.error("Error checking cached sounds:", error);
				return this.sounds;
			}
		}
		return this.sounds;
	}

	escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}

	updateSoundCacheStatus(soundPath, isCached) {
		const buttons = document.querySelectorAll(".sound-button");
		buttons.forEach((button) => {
			try {
				const sound = JSON.parse(button.dataset.sound);
				if (sound.mp3 === soundPath) {
					if (isCached) {
						button.classList.add("cached");
						if (!button.querySelector(".cache-icon")) {
							const cacheIcon = document.createElement("span");
							cacheIcon.className = "cache-icon";
							cacheIcon.setAttribute("aria-hidden", "true");
							cacheIcon.textContent = "💾";
							button.appendChild(cacheIcon);
						}
						console.log("💾 UI updated: Sound cached -", soundPath);
					} else {
						button.classList.remove("cached");
						const cacheIcon = button.querySelector(".cache-icon");
						if (cacheIcon) {
							cacheIcon.remove();
						}
					}
				}
			} catch (error) {
				console.error("Error updating cache status:", error);
			}
		});
	}
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
	new SoundboardApp();
});

// Enable audio context on first user interaction
document.addEventListener(
	"click",
	function enableAudio() {
		const AudioContext = window.AudioContext || window.webkitAudioContext;
		if (AudioContext) {
			const context = new AudioContext();
			if (context.state === "suspended") {
				context.resume();
			}
		}
		document.removeEventListener("click", enableAudio);
	},
	{ once: true },
);
