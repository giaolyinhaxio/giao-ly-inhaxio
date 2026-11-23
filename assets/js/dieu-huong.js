"use strict";
$("#menu-button").addEventListener("click", () => toggleMenu($("#drawer").inert));
$("#close-menu").addEventListener("click", () => toggleMenu(false));
$("#drawer-backdrop").addEventListener("click", () => toggleMenu(false));
$("#drawer").addEventListener("click", (event) => { if (event.target.closest("a")) toggleMenu(false); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("#drawer").inert) toggleMenu(false); });
window.addEventListener("hashchange", route);
