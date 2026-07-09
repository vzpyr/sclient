// accent color engine — replaces #f50 / #ff5500 in SC stylesheets
// extracted from core.js so it's only loaded/run when the feature is enabled.

function applyCustomAccentColor(newColor) {
	const targetColors = ["#f50", "#ff5500"];
	const processedNodes = new Set();

	function hexToRgb(hex) {
		let c = hex.substring(1).split("");
		if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
		c = "0x" + c.join("");
		return [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(",");
	}
	const rgbVal = hexToRgb(newColor);

	async function processCssText(cssText, originalNode) {
		if (!cssText) return;
		let modified = false;
		let newCssText = cssText;

		for (const color of targetColors) {
			const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const regex = new RegExp(escaped + "(?![a-fA-F0-9])", "gi");
			if (regex.test(newCssText)) {
				newCssText = newCssText.replace(regex, newColor);
				modified = true;
			}
		}

		const rgbRegex = /rgb\(\s*255\s*,\s*85\s*,\s*0\s*\)/gi;
		if (rgbRegex.test(newCssText)) {
			newCssText = newCssText.replace(rgbRegex, `rgb(${rgbVal})`);
			modified = true;
		}
		const rawRgbRegex = /255\s*,\s*85\s*,\s*0/gi;
		if (rawRgbRegex.test(newCssText)) {
			newCssText = newCssText.replace(rawRgbRegex, rgbVal);
			modified = true;
		}

		if (modified) {
			const style = document.createElement("style");
			style.setAttribute("data-sc-custom-accent", "true");
			style.textContent = newCssText;
			if (originalNode && originalNode.parentNode) {
				originalNode.parentNode.insertBefore(style, originalNode.nextSibling);
			} else {
				document.head.appendChild(style);
			}
		}
	}

	async function processNode(node) {
		if (node.hasAttribute("data-sc-custom-accent") || processedNodes.has(node))
			return;
		processedNodes.add(node);
		try {
			if (
				node.tagName === "LINK" &&
				node.rel === "stylesheet" &&
				node.href &&
				node.href.includes("sndcdn.com")
			) {
				const cssText = await fetch(node.href).then((r) => r.text());
				await processCssText(cssText, node);
			} else if (node.tagName === "STYLE") {
				await processCssText(node.textContent, node);
			}
		} catch (e) {
			/* skip cross-origin or fetch failures */
		}
	}

	const processStyles = () => {
		document
			.querySelectorAll('link[rel="stylesheet"], style')
			.forEach(processNode);
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", processStyles);
	} else {
		processStyles();
	}

	const observer = new MutationObserver((mutations) => {
		let shouldProcess = false;
		for (const m of mutations) {
			for (const node of m.addedNodes) {
				if (
					(node.tagName === "LINK" && node.rel === "stylesheet") ||
					node.tagName === "STYLE"
				) {
					shouldProcess = true;
				}
			}
		}
		if (shouldProcess) setTimeout(processStyles, 50);
	});
	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});
}
