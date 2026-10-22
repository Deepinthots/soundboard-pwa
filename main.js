// Main soundboard application

// Automatically determine base path for GitHub Pages or local preview
const BASE_PATH = (() => {
	const path = window.location.pathname;
	return path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);
})();

const resolvePath = (relativeUrl) => {
	const cleanUrl = relativeUrl.startsWith("/") ? relativeUrl.slice(1) : relativeUrl;
	return `${BASE_PATH}${cleanUrl}`;
};

// Office sounds list pointing inside sounds/office/
window.OFFICE_SOUNDS = [
	{ name: "5 Farter Death Punch", artist: "Office", mp3: "sounds/office/5 Farter Death Punch.mp3" },
	{ name: "A Question, Billy", artist: "Office", mp3: "sounds/office/A Question, Billy.mp3" },
	{ name: "AH", artist: "Office", mp3: "sounds/office/AH.mp3" },
	{ name: "AHHHH", artist: "Office", mp3: "sounds/office/AHHHH.mp3" },
	{ name: "Billy Fanfare", artist: "Office", mp3: "sounds/office/Billy Fanfare.mp3" },
	{ name: "Billy Hum 1", artist: "Office", mp3: "sounds/office/Billy Hum 1.mp3" },
	{ name: "Billy Hum 2", artist: "Office", mp3: "sounds/office/Billy Hum 2.mp3" },
	{ name: "Billy Hum 3", artist: "Office", mp3: "sounds/office/Billy Hum 3.mp3" },
	{ name: "Billy Laugh 1", artist: "Office", mp3: "sounds/office/Billy Laugh 1.mp3" },
	{ name: "Boner 1", artist: "Office", mp3: "sounds/office/Boner1.mp3" },
	{ name: "Bully Maguire", artist: "Office", mp3: "sounds/office/Bully Maguire.mp3" },
	{ name: "Defeated Billy", artist: "Office", mp3: "sounds/office/Defeated Billy.mp3" },
	{ name: "DIP-PY", artist: "Office", mp3: "sounds/office/DIP-PY.mp3" },
	{ name: "Downward Fart", artist: "Office", mp3: "sounds/office/Downward Fart.mp3" },
	{ name: "Dry Mop", artist: "Office", mp3: "sounds/office/Dry Mop.mp3" },
	{ name: "Goat Ray", artist: "Office", mp3: "sounds/office/Goat Ray.mp3" },
	{ name: "GOO!", artist: "Office", mp3: "sounds/office/GOO!.mp3" },
	{ name: "HHHHHHHUUUUUOOOO", artist: "Office", mp3: "sounds/office/HHHHHHHUUUUUOOOO.mp3" },
	{ name: "HHHUUUOO", artist: "Office", mp3: "sounds/office/HHHUUUOO.mp3" },
	{ name: "Humming Billy Laugh", artist: "Office", mp3: "sounds/office/Humming Billy Laugh.mp3" },
	{ name: "HUO", artist: "Office", mp3: "office/HUO.mp3" },
	{ name: "Inflected Billy", artist: "Office", mp3: "sounds/office/Inflected Billy.mp3" },
	{ name: "JEW JEW", artist: "Office", mp3: "sounds/office/JEW JEW.mp3" },
	{ name: "Jurrassic Lomo", artist: "Office", mp3: "sounds/office/Jurrassic Lomo.mp3" },
	{ name: "No but Yes", artist: "Office", mp3: "sounds/office/No but Yes.mp3" },
	{ name: "Peckham Laugh", artist: "Office", mp3: "sounds/office/Peckham Laugh.mp3" },
	{ name: "PENQUITOS", artist: "Office", mp3: "sounds/office/PENQUITOS.mp3" },
	{ name: "PERFECT!", artist: "Office", mp3: "sounds/office/PERFECT!.mp3" },
	{ name: "Pop Fart", artist: "Office", mp3: "sounds/office/Pop Fart.mp3" },
	{ name: "SarcastiBilly", artist: "Office", mp3: "sounds/office/SarcastiBilly.mp3" },
	{ name: "Soft Billy", artist: "Office", mp3: "sounds/office/Soft Billy.mp3" },
	{ name: "TIIIIOOOTTS", artist: "Office", mp3: "sounds/office/TIIIIOOOTTS.mp3" },
	{ name: "Usual Suspects Billy", artist: "Office", mp3: "sounds/office/Usual Suspects Billy.mp3" },
	{ name: "Wet Fart", artist: "Office", mp3: "sounds/office/Wet Fart.mp3" },
	{ name: "Ya (boner!)", artist: "Office", mp3: "sounds/office/Ya (boner!).mp3" },
	{ name: "Yes but No", artist: "Office", mp3: "sounds/office/Yes but No.mp3" },
	{ name: "You're losing it, Billy", artist: "Office", mp3: "sounds/office/You're losing it, Billy.mp3" },
	{ name: "Yyyyeeaaaaaah", artist: "Office", mp3: "sounds/office/Yyyyeeaaaaaah.mp3" }
];

class SoundboardApp {
	constructor() {
		this.sounds = [];
		this.filteredSounds = [];
		this.searchQuery = "";
		this.isOnline = navigator.onLine;
		this.config = {
			title: "Office Soundboard",
			shortName: "Sounds",
			subtitle: "OFFICE SOUNDS",
			description: "Office Audio Soundboard",
			headerTitle: "♫ OFFICE SOUNDBOARD ♫",
			searchPlaceholder: "SEARCH FOR SOUNDS...",
			tipText: "↑ PRESS [S] TO SEARCH • CLICK TO PLAY ↑",
			loadingText: "LOADING SOUNDS...",
			offlineText: "OFFLINE MODE - USING CACHED SOUNDS",
			soundCountText: "AUDIO DROPS",
			themeColor: "#1a1a1a",
			backgroundColor: "#1a1a1a",
		};

		this.init();
	}

	async init() {
		await this.loadConfig();
		this.updatePageMetadata();

		if ("serviceWorker" in navigator) {
			try {
				const swPath = resolvePath("sw.js");
				await navigator.serviceWorker.register(swPath, { scope: BASE_PATH });
			} catch (error) {
				console.warn("Service Worker skipped:", error);
			}
		}

		this.setupEventListeners();
		await this.loadSounds();

		window.addEventListener("online", () => {
			this.isOnline = true;
			this.hideOfflineIndicator();
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
			const response = await fetch(resolvePath("config.json"));
			if (response.ok) {
				const data = await response.json();
				this.config = { ...this.config, ...data };
			}
		} catch (e) {
			// Maintain defaults
		}
	}

	updatePageMetadata() {
		document.title = `🔊 ${this.config.title}`;

		const headerTitle = document.querySelector(".header h1");
		if (headerTitle) {
			headerTitle.textContent = this.config.headerTitle;
		}

		const searchInput = document.getElementById("search-input");
		if (searchInput) {
			searchInput.placeholder = this.config.searchPlaceholder;
		}

		const tipElement = document.querySelector(".tip");
		if (tipElement) {
			tipElement.textContent = this.config.tipText;
		}

		const offlineIndicator = document.getElementById("offline-indicator");
		if (offlineIndicator) {
			offlineIndicator.textContent = this.config.offlineText;
		}
	}

	updateSubtitle(soundCount) {
		const subtitle = document.querySelector(".header .subtitle");
		if (subtitle) {
			subtitle.innerHTML = `${this.config.subtitle} • <span id="sound-count">${soundCount}</span> ${this.config.soundCountText}`;
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
		this.sounds = window.OFFICE_SOUNDS || [];
		localStorage.setItem("soundboard-data", JSON.stringify(this.sounds));
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

		const soundsToShow = this.filteredSounds.length ? this.filteredSounds : this.sounds;
		soundsToShow.sort((a, b) => a.name.localeCompare(b.name));

		this.updateSubtitle(this.sounds.length);

		container.innerHTML = soundsToShow
			.map(
				(sound) => `
			<button 
				class="sound-button" 
				data-sound='${JSON.stringify(sound).replace(/'/g, "&apos;")}'
			>
				<div class="sound-name">${this.escapeHtml(sound.name)}</div>
				<div class="sound-artist">${this.escapeHtml(sound.artist)}</div>
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

			const audio = new Audio(audioPath);
			await audio.play();
		} catch (error) {
			if (error.name === "NotAllowedError") {
				this.showStatus("⚠ CLICK ANYWHERE TO ENABLE AUDIO ⚠", "error");
			} else {
				this.showStatus("✗ COULD NOT PLAY SOUND ✗", "error");
				console.error("Audio playback error:", error);
			}
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

	escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
	new SoundboardApp();
});

// Unlock audio context on user gesture
document.addEventListener(
	"click",
	() => {
		const AudioContext = window.AudioContext || window.webkitAudioContext;
		if (AudioContext) {
			const context = new AudioContext();
			if (context.state === "suspended") {
				context.resume();
			}
		}
	},
	{ once: true },
);
