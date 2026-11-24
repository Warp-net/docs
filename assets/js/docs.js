(function () {
  "use strict";

  function toggle(button, target) {
    if (!button || !target) return;
    button.addEventListener("click", function () {
      var open = target.classList.toggle("is-open");
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  toggle(document.querySelector(".sidebar__toggle"), document.getElementById("sidebar-list"));

  var ui = document.body.dataset;
  var content = document.querySelector(".doc-content");
  if (!content) return;

  // Wide tables scroll inside their own box.
  content.querySelectorAll("table").forEach(function (table) {
    if (table.parentElement.classList.contains("table-wrap")) return;
    var wrap = document.createElement("div");
    wrap.className = "table-wrap";
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  });

  // Heading anchors.
  var headings = content.querySelectorAll("h2[id], h3[id], h4[id]");
  headings.forEach(function (h) {
    var a = document.createElement("a");
    a.className = "anchor";
    a.href = "#" + h.id;
    a.setAttribute("aria-label", ui.anchor || "Link to this section");
    a.textContent = "#";
    h.appendChild(a);
  });

  // "On this page" table of contents.
  var toc = document.querySelector(".toc");
  var list = toc && toc.querySelector(".toc__list");
  var tocHeadings = Array.prototype.filter.call(content.querySelectorAll("h2[id], h3[id]"), function (h) {
    return !h.closest(".pager");
  });
  if (list && tocHeadings.length > 1) {
    var links = {};
    tocHeadings.forEach(function (h) {
      var li = document.createElement("li");
      if (h.tagName === "H3") li.className = "toc__sub";
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.firstChild ? h.firstChild.textContent.trim() : h.textContent;
      li.appendChild(a);
      list.appendChild(li);
      links[h.id] = a;
    });
    toc.hidden = false;

    if ("IntersectionObserver" in window) {
      var current = null;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (current) current.classList.remove("is-active");
          current = links[entry.target.id];
          if (current) current.classList.add("is-active");
        });
      }, { rootMargin: "-90px 0px -70% 0px" });
      tocHeadings.forEach(function (h) { observer.observe(h); });
    }
  }

  // Copy buttons on code blocks.
  if (navigator.clipboard) {
    content.querySelectorAll("div.highlighter-rouge").forEach(function (block) {
      if (block.classList.contains("language-mermaid")) return;
      var code = block.querySelector("pre");
      if (!code) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-btn";
      btn.textContent = ui.copy || "Copy";
      btn.addEventListener("click", function () {
        navigator.clipboard.writeText(code.innerText.replace(/\n$/, "")).then(function () {
          btn.textContent = ui.copied || "Copied";
          setTimeout(function () { btn.textContent = ui.copy || "Copy"; }, 1500);
        });
      });
      block.appendChild(btn);
    });
  }

  // Mermaid diagrams from ```mermaid fences.
  var diagrams = content.querySelectorAll("code.language-mermaid, div.language-mermaid pre");
  if (diagrams.length) {
    var seen = [];
    diagrams.forEach(function (node) {
      var box = node.closest("div.language-mermaid") || node.closest("pre") || node;
      if (seen.indexOf(box) !== -1) return;
      seen.push(box);
      var pre = document.createElement("pre");
      pre.className = "mermaid";
      pre.textContent = node.textContent;
      box.parentNode.replaceChild(pre, box);
    });
    import("https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs").then(function (m) {
      var mermaid = m.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: "Ubuntu Mono, monospace",
        themeVariables: {
          darkMode: true,
          background: "#1c1814",
          fontFamily: "Ubuntu Mono, monospace",
          fontSize: "15px",
          primaryColor: "#241f19",
          primaryTextColor: "#d6c7a1",
          primaryBorderColor: "#a58a4a",
          secondaryColor: "#2c261e",
          tertiaryColor: "#1c1814",
          lineColor: "#a58a4a",
          textColor: "#d6c7a1",
          mainBkg: "#241f19",
          nodeBorder: "#a58a4a",
          clusterBkg: "#1a1612",
          clusterBorder: "#3a3226",
          titleColor: "#a58a4a",
          edgeLabelBackground: "#1c1814",
          actorBkg: "#241f19",
          actorBorder: "#a58a4a",
          actorTextColor: "#d6c7a1",
          actorLineColor: "#6b5c3c",
          signalColor: "#d6c7a1",
          signalTextColor: "#d6c7a1",
          labelBoxBkgColor: "#241f19",
          labelBoxBorderColor: "#a58a4a",
          labelTextColor: "#d6c7a1",
          loopTextColor: "#d6c7a1",
          noteBkgColor: "#2c261e",
          noteBorderColor: "#a58a4a",
          noteTextColor: "#d6c7a1",
          activationBkgColor: "#2c261e",
          activationBorderColor: "#a58a4a",
          sequenceNumberColor: "#14110e"
        }
      });
      mermaid.run({ querySelector: ".doc-content pre.mermaid" });
    }).catch(function () { /* diagrams stay as text */ });
  }
})();
