/* Small, browser-local desktop. No external services or shell execution. */
(() => {
  "use strict";
  const apps = {
    about: { name: "About me", description: "Yuanrui Xie · profile", width: 850, height: 454, icon: "profile" },
    education: { name: "Education", description: "HKUST & Xi’an Jiaotong University", width: 660, height: 500, icon: "education" },
    skills: { name: "Skills", description: "Toolkit · programming, AI, design & languages", width: 590, height: 558, icon: "skills" },
    contact: { name: "Contact", description: "Email & LinkedIn", width: 505, height: 485, icon: "contact" },
    terminal: { name: "Terminal", description: "A little command-line playground", width: 620, height: 390, icon: "terminal" },
    settings: { name: "Desktop settings", description: "Wallpaper & appearance", width: 570, height: 440, icon: "settings" }
  };
  const desktop = document.getElementById("desktop");
  const mobile = window.matchMedia("(max-width: 760px)");
  const windows = new Map();
  let layer = 20;
  let activeApp = "about";
  let toastTimer;
  let modalReturnFocus;
  const searchPanel = document.getElementById("spotlight");
  const helpPanel = document.getElementById("help");
  const menu = document.getElementById("desktop-menu");
  const menuButton = document.getElementById("desktop-menu-button");

  function readPreference(key) {
    try { return localStorage.getItem(`yx-desktop-${key}`); } catch { return null; }
  }
  function savePreference(key, value) {
    try { localStorage.setItem(`yx-desktop-${key}`, value); } catch { /* Private browsing can disable storage. */ }
  }
  function toast(message) {
    const element = document.getElementById("toast");
    element.textContent = message;
    element.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { element.hidden = true; }, 2600);
  }
  function setWallpaper(value) {
    if (!["coast", "dawn", "night"].includes(value)) return;
    document.body.dataset.wallpaper = value;
    document.querySelector(`input[name="wallpaper"][value="${value}"]`).checked = true;
    savePreference("wallpaper", value);
  }
  function setMotion(value) {
    document.body.classList.toggle("reduce-motion", value);
    document.getElementById("reduce-motion").checked = value;
    savePreference("motion", String(value));
  }
  setWallpaper(readPreference("wallpaper") || "coast");
  setMotion(readPreference("motion") === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function defaultPosition(id) {
    const state = windows.get(id);
    const index = Object.keys(apps).indexOf(id);
    const area = desktop.getBoundingClientRect();
    const width = Math.min(apps[id].width, area.width - 32);
    const height = Math.min(apps[id].height, area.height - 28);
    state.element.style.width = `${width}px`;
    state.element.style.height = `${height}px`;
    const offset = id === "about" ? 15 : 34 + index * 12;
    state.element.style.left = `${Math.max(16, Math.min(area.width - width - 16, (area.width - width) / 2 + offset))}px`;
    state.element.style.top = `${Math.max(14, Math.min(area.height - height - 14, 70 + index * 14))}px`;
  }
  function clampWindow(state) {
    if (mobile.matches || state.element.hidden) return;
    const area = desktop.getBoundingClientRect();
    const rect = state.element.getBoundingClientRect();
    // Keep the title bar and controls reachable after resizing the browser.
    state.element.style.left = `${Math.max(0, Math.min(rect.left - area.left, area.width - Math.min(rect.width, area.width)))}px`;
    state.element.style.top = `${Math.max(0, Math.min(rect.top - area.top, area.height - Math.min(rect.height, area.height)))}px`;
  }
  function syncDesktop() {
    windows.forEach((state, id) => {
      state.element.hidden = !state.open || state.minimized || (mobile.matches && id !== activeApp);
      state.element.classList.toggle("active", id === activeApp && !state.element.hidden);
      const dockButton = document.querySelector(`.dock-item[data-open="${id}"]`);
      dockButton.classList.toggle("is-running", state.open);
      dockButton.classList.toggle("is-minimized", state.minimized);
      if (id === activeApp && !state.element.hidden) dockButton.setAttribute("aria-current", "true");
      else dockButton.removeAttribute("aria-current");
    });
    document.getElementById("active-app-name").textContent = activeApp ? apps[activeApp].name : "Yuanrui’s desktop";
  }
  function focusWindow(id) {
    const state = windows.get(id);
    if (!state || !state.open || state.minimized) return;
    if (id !== activeApp) state.element.style.zIndex = String(++layer);
    activeApp = id;
    syncDesktop();
  }
  function closeMenu() {
    menu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
  }
  function openApp(id, focus = true) {
    const state = windows.get(id);
    if (!state) return;
    closeMenu();
    const wasHidden = state.element.hidden;
    state.open = true;
    state.minimized = false;
    state.element.style.zIndex = String(++layer);
    activeApp = id;
    syncDesktop();
    if (wasHidden) {
      state.element.dataset.entering = "true";
      setTimeout(() => { delete state.element.dataset.entering; }, 240);
    }
    if (focus) {
      const target = id === "terminal" ? document.getElementById("terminal-input") : state.element;
      target.focus({ preventScroll: true });
    }
  }
  function dismissWindow(id, minimize) {
    const state = windows.get(id);
    if (minimize) state.minimized = true;
    else { state.open = false; state.minimized = false; }
    const candidates = [...windows.entries()].filter(([otherId, other]) => otherId !== id && other.open && !other.minimized);
    candidates.sort((a, b) => Number(b[1].element.style.zIndex) - Number(a[1].element.style.zIndex));
    activeApp = candidates[0]?.[0] || null;
    syncDesktop();
    document.querySelector(`.dock-item[data-open="${id}"]`).focus({ preventScroll: true });
  }
  function maximizeWindow(id) {
    if (mobile.matches) return;
    const state = windows.get(id);
    const control = state.element.querySelector('[data-action="maximize"]');
    if (!state.maximized) {
      state.previousStyle = { left: state.element.style.left, top: state.element.style.top, width: state.element.style.width, height: state.element.style.height };
      const area = desktop.getBoundingClientRect();
      Object.assign(state.element.style, { left: "12px", top: "12px", width: `${area.width - 24}px`, height: `${area.height - 24}px` });
    } else Object.assign(state.element.style, state.previousStyle);
    state.maximized = !state.maximized;
    state.element.classList.toggle("is-maximized", state.maximized);
    control.setAttribute("aria-label", `${state.maximized ? "Restore" : "Maximize"} ${apps[id].name}`);
    focusWindow(id);
  }
  function restoreLayout() {
    windows.forEach((state, id) => {
      state.open = id === "about";
      state.minimized = false;
      state.maximized = false;
      state.element.classList.remove("is-maximized");
      state.element.querySelector('[data-action="maximize"]').setAttribute("aria-label", `Maximize ${apps[id].name}`);
      defaultPosition(id);
    });
    openApp("about");
    toast("Desktop layout restored");
  }

  Object.keys(apps).forEach((id) => {
    const element = document.getElementById(`window-${id}`);
    const state = { element, open: id === "about", minimized: false, maximized: false };
    windows.set(id, state);
    element.tabIndex = -1;
    element.style.zIndex = String(++layer);
    defaultPosition(id);
    element.addEventListener("pointerdown", () => focusWindow(id));
    element.addEventListener("focusin", () => focusWindow(id));
    element.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.action === "maximize") maximizeWindow(id);
      else dismissWindow(id, button.dataset.action === "minimize");
    }));
    const bar = element.querySelector(".window-titlebar");
    let drag = null;
    bar.addEventListener("dblclick", (event) => { if (!event.target.closest("button")) maximizeWindow(id); });
    bar.addEventListener("pointerdown", (event) => {
      if (mobile.matches || state.maximized || event.button !== 0 || event.target.closest("button")) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const area = desktop.getBoundingClientRect();
      drag = { x: event.clientX, y: event.clientY, left: rect.left - area.left, top: rect.top - area.top };
      bar.setPointerCapture(event.pointerId);
      element.classList.add("is-dragging");
    });
    bar.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const area = desktop.getBoundingClientRect();
      element.style.left = `${Math.max(0, Math.min(area.width - element.offsetWidth, drag.left + event.clientX - drag.x))}px`;
      element.style.top = `${Math.max(0, Math.min(area.height - bar.offsetHeight, drag.top + event.clientY - drag.y))}px`;
    });
    const stopDrag = () => { drag = null; element.classList.remove("is-dragging"); };
    bar.addEventListener("pointerup", stopDrag);
    bar.addEventListener("pointercancel", stopDrag);
    bar.addEventListener("lostpointercapture", stopDrag);
  });
  windows.get("about").element.style.zIndex = String(++layer);
  syncDesktop();
  document.querySelectorAll("[data-open]").forEach((button) => {
    button.setAttribute("aria-controls", `window-${button.dataset.open}`);
    button.addEventListener("click", () => openApp(button.dataset.open));
  });
  document.querySelector(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    openApp("about", false);
    document.getElementById("about-content").focus({ preventScroll: true });
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      windows.forEach((state, id) => {
        if (state.maximized && !mobile.matches) {
          const area = desktop.getBoundingClientRect();
          state.element.style.width = `${area.width - 24}px`;
          state.element.style.height = `${area.height - 24}px`;
        } else clampWindow(state);
      });
      syncDesktop();
    }, 100);
  });
  mobile.addEventListener("change", () => {
    windows.forEach((state, id) => {
      state.maximized = false;
      state.element.classList.remove("is-maximized");
      state.element.querySelector('[data-action="maximize"]').setAttribute("aria-label", `Maximize ${apps[id].name}`);
      defaultPosition(id);
    });
    syncDesktop();
  });

  function updateClock() {
    const date = new Date();
    const clock = document.getElementById("desktop-clock");
    clock.dateTime = date.toISOString();
    const options = mobile.matches ? { hour: "2-digit", minute: "2-digit", hour12: false } : { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false };
    clock.textContent = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "Asia/Hong_Kong" }).format(date);
  }
  updateClock();
  setInterval(updateClock, 15000);
  mobile.addEventListener("change", updateClock);
  menuButton.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    menuButton.setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.addEventListener("pointerdown", (event) => { if (!event.target.closest(".desktop-menu")) closeMenu(); });
  document.getElementById("restore-desktop").addEventListener("click", () => { closeMenu(); restoreLayout(); });
  document.getElementById("reset-windows").addEventListener("click", restoreLayout);
  document.querySelectorAll('input[name="wallpaper"]').forEach((radio) => radio.addEventListener("change", () => setWallpaper(radio.value)));
  document.getElementById("reduce-motion").addEventListener("change", (event) => setMotion(event.target.checked));

  document.getElementById("copy-email").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("yr.xie@connect.ust.hk");
      toast("Email address copied");
    } catch { toast("Copy this address: yr.xie@connect.ust.hk"); }
  });

  // Spotlight is the same six apps, searchable and keyboard accessible.
  let searchResults = [];
  let searchIndex = 0;
  const searchInput = document.getElementById("spotlight-input");
  function renderSearch() {
    const query = searchInput.value.trim().toLowerCase();
    searchResults = Object.entries(apps).filter(([id, app]) => `${id} ${app.name} ${app.description}`.toLowerCase().includes(query));
    searchIndex = 0;
    const container = document.getElementById("spotlight-results");
    container.replaceChildren();
    if (!searchResults.length) {
      const empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent = "No matching apps. Try education, skills or contact.";
      container.append(empty);
    }
    searchResults.forEach(([id, app], index) => {
      const button = document.createElement("button");
      button.className = `search-result${index === 0 ? " is-selected" : ""}`;
      // App names and icon ids below are fixed, not user input.
      button.innerHTML = `<svg><use href="#icon-${app.icon}"/></svg><span>${app.name}<small>${app.description}</small></span>`;
      button.addEventListener("click", () => { closeModal(searchPanel); openApp(id); });
      container.append(button);
    });
  }
  function openModal(panel) {
    if (!searchPanel.hidden || !helpPanel.hidden) return;
    modalReturnFocus = document.activeElement;
    closeMenu();
    panel.hidden = false;
    desktop.inert = true;
    document.querySelector(".dock").inert = true;
    document.querySelector(".menu-bar").inert = true;
    if (panel === searchPanel) { searchInput.value = ""; renderSearch(); searchInput.focus(); }
    else document.getElementById("close-help").focus();
  }
  function closeModal(panel) {
    panel.hidden = true;
    desktop.inert = false;
    document.querySelector(".dock").inert = false;
    document.querySelector(".menu-bar").inert = false;
    modalReturnFocus?.focus({ preventScroll: true });
  }
  searchInput.addEventListener("input", renderSearch);
  searchInput.addEventListener("keydown", (event) => {
    if (!searchResults.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      searchIndex = (searchIndex + (event.key === "ArrowDown" ? 1 : -1) + searchResults.length) % searchResults.length;
      document.querySelectorAll(".search-result").forEach((button, index) => button.classList.toggle("is-selected", index === searchIndex));
      document.querySelectorAll(".search-result")[searchIndex].scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const id = searchResults[searchIndex][0];
      closeModal(searchPanel);
      openApp(id);
    }
  });
  document.getElementById("search-button").addEventListener("click", () => openModal(searchPanel));
  document.getElementById("close-spotlight").addEventListener("click", () => closeModal(searchPanel));
  document.getElementById("show-help").addEventListener("click", () => openModal(helpPanel));
  document.getElementById("close-help").addEventListener("click", () => closeModal(helpPanel));
  [searchPanel, helpPanel].forEach((panel) => panel.addEventListener("click", (event) => { if (event.target === panel) closeModal(panel); }));
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (searchPanel.hidden && helpPanel.hidden) openModal(searchPanel);
      else if (!searchPanel.hidden) closeModal(searchPanel);
    }
    if (event.key === "Escape") {
      if (!searchPanel.hidden) closeModal(searchPanel);
      else if (!helpPanel.hidden) closeModal(helpPanel);
      else closeMenu();
    }
    const panel = !searchPanel.hidden ? searchPanel : !helpPanel.hidden ? helpPanel : null;
    if (panel && event.key === "Tab") {
      const elements = [...panel.querySelectorAll('button,input,a[href]')].filter((element) => !element.hidden);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  // The terminal is an interactive menu; commands never execute code.
  const terminalInput = document.getElementById("terminal-input");
  const output = document.getElementById("terminal-output");
  const history = [];
  let historyIndex = 0;
  function terminalLine(text, className = "") {
    const line = document.createElement("p");
    line.className = className;
    line.textContent = text;
    output.append(line);
    while (output.children.length > 100) output.firstElementChild.remove();
  }
  document.getElementById("terminal-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const command = terminalInput.value.trim();
    if (!command) return;
    history.push(command);
    historyIndex = history.length;
    terminalLine(`yuanrui@desktop ~ % ${command}`, "terminal-command");
    terminalInput.value = "";
    const [verb, argument] = command.toLowerCase().split(/\s+/);
    if (verb === "help") terminalLine("about       Open my profile\neducation   Explore my education\nskills      View my toolkit\ncontact     Say hello\nwhoami      A quick introduction\ndate        Current time in Hong Kong\ntheme       coast / dawn / night\nclear       Clear the terminal");
    else if (["about", "education", "skills", "contact"].includes(verb)) { terminalLine(`Opening ${apps[verb].name}…`); openApp(verb); }
    else if (verb === "whoami") terminalLine("Yuanrui Xie · 謝遠睿\nMSc Information Technology @ HKUST\nSoftware engineering, applied AI & visual storytelling.");
    else if (verb === "date") terminalLine(new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "long", timeZone: "Asia/Hong_Kong" }).format(new Date()));
    else if (verb === "theme") {
      if (["coast", "dawn", "night"].includes(argument)) { setWallpaper(argument); terminalLine(`Wallpaper changed to ${argument}.`); }
      else terminalLine("Try: theme coast, theme dawn or theme night.");
    } else if (verb === "clear") output.replaceChildren();
    else terminalLine(`Command not found: ${verb}. Type help for available commands.`, "terminal-error");
    document.querySelector(".terminal-body").scrollTop = document.querySelector(".terminal-body").scrollHeight;
  });
  terminalInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === "ArrowUp" ? -1 : 1)));
      terminalInput.value = history[historyIndex] || "";
    }
  });
})();
