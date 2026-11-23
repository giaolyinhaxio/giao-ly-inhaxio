"use strict";
function renderClass(path) {
  const info = classInfo[path];
  $("#class-crumb").textContent = info.title;
  $("#class-title").textContent = info.title;
  const mottos = { "chien-con": "Hiền lành", "au-nhi": "Ngoan", "thieu-nhi": "Hy sinh" };
  $("#class-description").textContent = mottos[path];
  $("#page-class").dataset.className = path;
  const link = info.materialsUrl;
  $("#class-link").hidden = !link;
  $("#class-empty").hidden = !!link;
  if (link) $("#class-link").href = link;
}

