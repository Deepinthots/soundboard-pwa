// Main soundboard application

const BASE_PATH = (() => {
	const path = window.location.pathname;
	return path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);
})();

const resolvePath = (relativeUrl) => {
	const cleanUrl = relativeUrl.startsWith("/") ? relativeUrl.slice(1) : relativeUrl;
	return `${BASE_PATH}${cleanUrl}`;
};

window.OFFICE_SOUNDS = [
	{ name: "5 Farter Death Punch", artist: "Office", mp3: "sounds/5 Farter Death Punch.mp3" },
	{ name: "A Question, Billy", artist: "Office", mp3: "sounds/A Question, Billy.mp3" },
	{ name: "AH", artist: "Office", mp3: "sounds/AH.mp3" },
	{ name: "AHHHH", artist: "Office", mp3: "sounds/AHHHH.mp3" },
	{ name: "Billy Fanfare", artist: "Office", mp3: "sounds/Billy Fanfare.mp3" },
	{ name: "Billy Hum 1", artist: "Office", mp3: "sounds/Billy Hum 1.mp3" },
	{ name: "Billy Hum 2", artist: "Office", mp3: "sounds/Billy Hum 2.mp3" },
	{ name: "Billy Hum 3", artist: "Office", mp3: "sounds/Billy Hum 3.mp3" },
	{ name: "Billy Laugh 1", artist: "Office", mp3: "sounds/Billy Laugh 1.mp3" },
	{ name: "Boner 1", artist: "Office", mp3: "sounds/Boner 1.mp3" },
	{ name: "Bully Maguire", artist: "Office", mp3: "sounds/Bully Maguire.mp3" },
	{ name: "Defeated Billy", artist: "Office", mp3: "sounds/Defeated Billy.mp3" },
	{ name: "DIP-PY", artist: "Office", mp3: "sounds/DIP-PY.mp3" },
	{ name: "Downward Fart", artist: "Office", mp3: "sounds/Downward Fart.mp3" },
	{ name: "Dry Mop", artist: "Office", mp3: "sounds/Dry Mop.mp3" },
	{ name: "Goat Ray", artist: "Office", mp3: "sounds/Goat Ray.mp3" },
	{ name: "GOO!", artist: "Office", mp3: "sounds/GOO!.mp3" },
	{ name: "HHHHHHHUUUUUOOOO", artist: "Office", mp3: "sounds/HHHHHHHUUUUUOOOO.mp3" },
	{ name: "HHHUUUOO", artist: "Office", mp3: "sounds/HHHUUUOO.mp3" },
	{ name: "Humming Billy Laugh", artist: "Office", mp3: "sounds/Humming Billy Laugh.mp3" },
	{ name: "HUO", artist: "Office", mp3: "sounds/HUO.mp3" },
	{ name: "Inflected Billy", artist: "Office", mp3: "sounds/Inflected Billy.mp3" },
	{ name: "JEW JEW", artist: "Office", mp3: "sounds/JEW JEW.mp3" },
	{ name: "Jurrassic Lomo", artist: "Office", mp3: "sounds/Jurrassic Lomo.mp3" },
	{ name: "No but Yes", artist: "Office", mp3: "sounds/No but Yes.mp3" },
	{ name: "Peckham Laugh", artist: "Office", mp3: "sounds/Peckham Laugh.mp3" },
	{ name: "PENQUITOS", artist: "Office", mp3: "sounds/PENQUITOS.mp3" },
	{ name: "PERFECT!", artist: "Office", mp3: "sounds/PERFECT!.mp3" },
	{ name: "Pop Fart", artist: "Office", mp3: "sounds/Pop Fart.mp3" },
	{ name: "SarcastiBilly", artist: "Office", mp3: "sounds/SarcastiBilly.mp3" },
	{ name: "Soft Billy", artist: "Office", mp3: "sounds/Soft Billy.mp3" },
	{ name: "TIIIIOOOTTS", artist: "Office", mp3: "sounds/TIIIIOOOTTS.mp3" },
	{ name: "Usual Suspects Billy", artist: "Office", mp3: "sounds/Usual Suspects Billy.mp3" },
	{ name: "Wet Fart", artist: "Office", mp3: "sounds/Wet Fart.mp3" },
	{ name: "Ya (boner!)", artist: "Office", mp3: "sounds/Ya (boner!).mp3" },
	{ name: "Yes but No", artist: "Office", mp3: "sounds/Yes but No.mp3" },
	{ name: "You're losing it, Billy", artist: "Office", mp3: "sounds/You're losing it, Billy.mp3" },
	{ name: "Yyyyeeaaaaaah", artist: "Office", mp3: "sounds/Yyyyeeaaaaaah.mp3" }
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
		} catch (e) {}
	}

	updatePageMetadata() {
		document.title = "🔊 " + this.config.title;

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
			subtitle.innerHTML = this.config.subtitle + ' • <span id="sound-count">' + soundCount + '</span> ' + this.config.soundCountText;
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
			container.innerHTML = '<div class="loading">✗ NO SOUNDS FOUND FOR "' + this.escapeHtml(this.searchQuery) + '" ✗</div>';
			return;
		}

		const soundsToShow = this.filteredSounds.length ? this.filteredSounds : this.sounds;
		soundsToShow.sort((a, b) => a.name.localeCompare(b.name));

		this.updateSubtitle(this.sounds.length);

		let html = "";
		for (let i = 0; i < soundsToShow.length; i++) {
			const sound = soundsToShow[i];
			html += '<button class="sound-button" data-index="' + i + '">';
			html += '<div class="sound-name">' + this.escapeHtml(sound.name) + '</div>';
			html += '<div class="sound-artist">' + this.escapeHtml(sound.artist) + '</div>';
			html += '</button>';
		}
		container.innerHTML = html;

		const buttons = container.querySelectorAll(".sound-button");
		for (let i = 0; i < buttons.length; i++) {
			buttons[i].addEventListener("click", (e) => {
				const index = e.currentTarget.getAttribute("data-index");
				const sound = soundsToShow[index];
				this.playSound(sound);
			});
		}
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
		status.className = "status show " + type;

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

document.addEventListener("DOMContentLoaded", () => {
	new SoundboardApp();
});

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
