const noop = () => {};
const html = document.documentElement;
const backPlyrConst = {
	selector: 'backplyr',
	player: 'backplyr-plyr',
	playing: 'backplyr-playing',
	paused: 'backplyr-paused',
	muted: 'backplyr-muted',
	addedButton: 'backplyr-added-button',
	togglePlay: {
		button: 'backplyr-toggle-play',
		active: 'icono-pause',
		inactive: 'icono-play',
		text: 'Pause/Play'
	},
	toggleMute: {
		button: 'backplyr-toggle-mute',
		active: 'icono-volume',
		inactive: 'icono-volumeHigh',
		text: 'Turn Sound off/on'
	}
};

if (!('remove' in Element.prototype)) {
	Element.prototype.remove = function() {
		if (this.parentNode) {
			this.parentNode.removeChild(this);
		}
	};
}

class BackPlyr {
	constructor(settings = {}) {
		let defaultSettings = {
			selector: '.' + backPlyrConst.selector,
			onReady: noop,
			onPlay: noop,
			onPause: noop,
			onEnd: noop,
			onMute: noop,
			onUnmute: noop,
			onWatchAll: noop,
			addPauseButton: false,
			addMuteButton: false,
			endOnPause: true,
			mute: true,
			volume: 10,
			loop: false
		};

		let element = this.getElement(settings);

		if (element) {
			settings = {};
		}

		this.settings = this.mergeSettings(defaultSettings, settings);

		this.element = element ? element : this.getElement(this.settings.selector);
		this.type = false;
		this.node = false;
		this.player = false;

		this.setSources();
		this.setType();

		if (this.type) {
			BackPlyr.remove();
			setTimeout(() => {
				this.addButtons();
				BackPlyr.setSize();
				this.writePlyr();
				this.setupPlyr();
				this.eventPlyr();
			}, 1);
		}
	}

	mergeSettings(defaultObject, overwriteObject) {
		let object = {};
		for (let attrname in defaultObject) {
			if (defaultObject.hasOwnProperty(attrname)) {
				object[attrname] = defaultObject[attrname];
			}
		}
		for (let attrname in overwriteObject) {
			if (overwriteObject.hasOwnProperty(attrname)) {
				object[attrname] = overwriteObject[attrname];
			}
		}
		return object;
	}

	getElement(selector) {
		let element = false;
		if (typeof selector === 'object') {
			// We got an object as a parameter
			if (selector.length && selector[0].nodeType === 1) {
				// parameter is a nodelist
				element = selector[0];
			} else if (selector.nodeType === 1) {
				// parameter is a node
				element = selector;
			}
		} else if (typeof selector === 'string') {
			// element is a selector
			element = document.querySelector(selector);
		}
		return element;
	}

	setSources() {
		this.sources = false;
		if (this.element) {
			let sources = JSON.parse(this.element.getAttribute('data-sources'));
			if (sources) {
				this.sources = sources;
			}
		}
	}

	setType() {
		if (this.sources) {
			this.type = this.sources[0].type.split('/')[0];
		}
		if (this.type == 'audio') {
			this.settings.mute = false;
			if (this.settings.addMuteButton) {
				// Prefer pause button over mute button
				this.settings.addMuteButton = false;
				this.settings.addPauseButton = true;
			}
		}
	}

	static getElements(cssClass) {
		return Array.prototype.slice.call(document.querySelectorAll('.' + cssClass));
	}

	static remove() {
		setTimeout(() => {
			window.removeEventListener('resize', BackPlyr.setSize, false);
			html.backplyr = false;
			let players = BackPlyr.getElements(backPlyrConst.player);
			let buttons = BackPlyr.getElements(backPlyrConst.addedButton);
			players.forEach(player => {
				if (player.plyr) {
					player.plyr.getContainer().remove();
				}
			});
			buttons.forEach(button => {
				button.remove();
			});
			setTimeout(() => {
				html.classList.remove(backPlyrConst.playing);
				html.classList.remove(backPlyrConst.paused);
				html.classList.remove(backPlyrConst.muted);
			}, 0);
		}, 0);
	}

	static setSize() {
		let ratio = 16 / 9;
		let height = window.innerHeight;
		let width = window.innerWidth;
		let windowRatio = width / height;
		let margin = {
			x: 0,
			y: 0,
			button: 0
		};
		if (windowRatio > ratio) {
			// We need to move the player up
			let newHeight = Math.ceil((width / ratio - height) / 2);
			margin.y = -newHeight  + 'px';
			margin.button = newHeight  + 'px';
		} else if (windowRatio < ratio) {
			// We need more with
			let newWidth = height * ratio;
			margin.x = Math.floor((newWidth - width) / -2)  + 'px';
		}
		let elements = BackPlyr.getElements(backPlyrConst.selector);
		let buttons = BackPlyr.getElements(backPlyrConst.addedButton);

		elements.forEach(element => {
			element.style.marginLeft = margin.x;
			element.style.marginRight = margin.x;
			element.style.marginTop = margin.y;
		});

		buttons.forEach(button => {
			button.style.marginTop = margin.button;
		});
	}

	play() {
		html.classList.add(backPlyrConst.playing);
		html.classList.remove(backPlyrConst.paused);
		this.settings.onPlay();
		this.player.play();
		html.backplyr.mode = 'playing';
	}

	pause() {
		this.settings.onPause();
		if (this.settings.endOnPause) {
			BackPlyr.remove();
			this.settings.onEnd();
		} else {
			this.player.pause();
			html.backplyr.mode = 'paused';
			html.classList.remove(backPlyrConst.playing);
			html.classList.add(backPlyrConst.paused);
		}
	}

	setVolume(volume) {
		if (volume) {
			html.classList.remove(backPlyrConst.muted);
			this.player.setVolume(this.settings.volume);
		} else {
			html.classList.add(backPlyrConst.muted);
			this.player.setVolume(0);
		}
	}

	writePlyr() {
		if (this.type == 'youtube' || this.type == 'vimeo') {
			this.writeEmbedVideo();
		} else if (this.type == 'video' || this.type == 'audio') {
			this.writeSourceTag(this.type);
		}
	}

	setupPlyr() {
		window.addEventListener('resize', BackPlyr.setSize, false);
		let plyrSettings = {
			controls: [],
			clickToPlay: false,
			keyboardShortcuts: {
				focused: false
			},
			fullscreen: {
				enable: false
			}
		};
		let players = plyr.setup(this.node, plyrSettings);
		this.player = players[0];
		html.backplyr = {
			togglePlay: () => {
				let mode = html.backplyr.mode;
				if (mode === 'playing') {
					this.pause();
				} else if (mode === 'paused') {
					this.play();
				}
			},
			toggleMute: () => {
				let isMuted = this.player.isMuted();
				this.setVolume(isMuted);
				if (isMuted) {
					this.settings.onUnmute();
				} else {
					this.settings.onMute();
				}
			}
		}
	}

	eventPlyr() {
		this.player.on('ready', () => {
			this.settings.onReady();
			this.setVolume(!this.settings.mute);
			this.play();
		});
		this.player.on('ended', () => {
			if (this.settings.loop) {
				this.player.play();
			} else {
				BackPlyr.remove();
				this.settings.onWatchAll();
				this.settings.onEnd();
			}
		});
	}

	writeEmbedVideo() {
		this.node = document.createElement('div');
		this.node.className = 'plyr ' + backPlyrConst.player;
		this.node.setAttribute('data-type', this.type);
		this.node.setAttribute('data-video-id', this.sources[0].src);
		this.element.appendChild(this.node);
	}

	writeSourceTag(type) {
		this.node = document.createElement(type);
		this.node.className = 'plyr ' + backPlyrConst.player;
		this.node.setAttribute('controls', true);
		let html = '';
		this.sources.forEach(source => {
			html += `<source src="${source.src}" type="${source.type}">`;
		});
		this.node.innerHTML = html;
		this.element.appendChild(this.node);
	}

	addButton(type) {
		const settings = backPlyrConst[type];
		return `<button type="button" class="${settings.button}" title="${settings.text}"><i class="${settings.button}-active ${settings.active}"></i><i class="${settings.button}-inactive ${settings.inactive}"></i></button>`;
	}

	addButtons() {
		if (this.settings.addPauseButton || this.settings.addMuteButton) {
			let buttons = document.createElement('div');
			let html = '';
			buttons.className = backPlyrConst.addedButton;

			if (this.settings.addPauseButton) {
				html += this.addButton('togglePlay');
			}
			if (this.settings.addMuteButton) {
				html +=this.addButton('toggleMute');
			}
			buttons.innerHTML = html;
			this.element.appendChild(buttons);
		}
	}

	static buttonAction(event, classSelector, callback, goUp = false) {
		let target = goUp ? event.target.parentNode : event.target;
		if (document == target) {
			return;
		}
		if (target.classList.contains(backPlyrConst[classSelector]['button'])) {
			event.preventDefault();
			event.stopPropagation();
			callback();
		} else {
			BackPlyr.buttonAction(event, classSelector, callback, true);
		}
	}

	static buttonHandler(eventType = 'click') {
		document.addEventListener(eventType, event => {
			if (html.backplyr && event.target) {
				BackPlyr.buttonAction(event, 'togglePlay', html.backplyr.togglePlay);
				BackPlyr.buttonAction(event, 'toggleMute', html.backplyr.toggleMute);
			}
		});
	}
}

BackPlyr.buttonHandler();

function backPlyr(settings = {}) {
	return new BackPlyr(settings);
}

if (typeof jQuery ==='function') {
	jQuery.fn.backPlyr = function(settings = {}) {
		return this.each(function(index) {
			if (index === 0) {
				// Only work on first element
				settings.selector = this;
				new BackPlyr(settings);
			}
		});
	}
}
// Example Call
backPlyr({
	selector: '#youtube',
	mute: false,
	addPauseButton: true,
	addMuteButton: true,
	onReady: () => {
		console.info('YouTube video is ready');
	},
	onPlay: () => {
		console.info('Play YouTube video');
	},
	onMute: () => {
		console.info('Mute video');
	},
	onUnmute: () => {
		console.info('Unmute video');
	},
	onEnd: () => {
		console.info('YouTube video ended');
		backPlyr({
			selector: '#vimeo',
			addPauseButton: true,
			onEnd: () => {
				console.info('Vimeo video ended');
				backPlyr({
					selector: '#video',
					addPauseButton: true,
					addMuteButton: true,
					onEnd: () => {
						console.info('Embeded video ended, start audio loop');
						backPlyr({
							addMuteButton: true, // This setting get overriden
							endOnPause: false,
							loop: true,
							onReady: () => {
								console.info('Audio is ready');
							},
							onPlay: () => {
								console.info('Play audio');
							},
							onPause: () => {
								console.info('Pause audio');
							}
						});
					}
				});
			}
		});
	}
});
